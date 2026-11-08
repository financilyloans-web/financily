require('dotenv').config();
const express=require('express'),cors=require('cors'),helmet=require('helmet'),mongoose=require('mongoose'),
rate=require('express-rate-limit'),jwt=require('jsonwebtoken'),crypto=require('crypto'),nodemailer=require('nodemailer');
const {Application,Contact,Otp}=require('./models');
const app=express();app.set('trust proxy',1);
const origins=(process.env.CLIENT_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean);
app.use(helmet());
app.use(cors({origin:(o,cb)=>(!o||origins.includes(o))?cb(null,true):cb(new Error('Origin not allowed'))}));
/* --- FreeOCR proxy: rate-limited, origin-checked, optional Firebase auth; key stays on server --- */
const ocrJSON=express.json({limit:'8mb'});
const ocrLimiter=rate({windowMs:15*60*1000,max:5,message:{ok:false,error:'Too many OCR requests, try later'}});
/* Per-user OCR limiter keyed by verified Firebase UID (not spoofable via IP rotation). */
const ocrByUid=new Map();
function ocrUidAllowed(uid){
  const now=Date.now(),win=15*60*1000,max=5;
  const h=ocrByUid.get(uid);
  if(!h||h.reset<now){ocrByUid.set(uid,{n:1,reset:now+win});return true}
  if(h.n>=max)return false;
  h.n++;return true;
}
let firebaseAdmin=null;
function verifyFirebaseToken(token){
  return new Promise((resolve,reject)=>{
    if(!process.env.FIREBASE_SERVICE_ACCOUNT)return resolve(null);
    try{
      if(!firebaseAdmin){
        firebaseAdmin=require('firebase-admin');
        firebaseAdmin.initializeApp({credential:firebaseAdmin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))});
      }
      firebaseAdmin.auth().verifyIdToken(token).then(resolve).catch(reject);
    }catch(e){reject(e)}
  });
}
app.post('/api/ocr',ocrLimiter,ocrJSON,async(req,res)=>{
  try{
    if(req.headers.origin&&origins.length&&!origins.includes(req.headers.origin))return res.status(403).json({ok:false,error:'Origin not allowed'});
    // OCR requires an authenticated Firebase user (fail closed). Without the
    // service account there is no way to verify a token, so we refuse to proxy.
    if(!process.env.FIREBASE_SERVICE_ACCOUNT)return res.status(503).json({ok:false,error:'OCR disabled: FIREBASE_SERVICE_ACCOUNT not configured'});
    const authz=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!authz)return res.status(401).json({ok:false,error:'Authentication required'});
    let uid;
    try{uid=(await verifyFirebaseToken(authz)).uid;}catch{return res.status(401).json({ok:false,error:'Invalid token'})}
    if(!uid||!ocrUidAllowed(uid))return res.status(429).json({ok:false,error:'Too many OCR requests, try later'});
    const base64=(req.body||{}).image_base64;
    if(!base64||typeof base64!=='string')return res.status(400).json({ok:false,error:'image_base64 is required'});
    const key=process.env.FREEOCR_API_KEY;
    if(!key)return res.status(503).json({ok:false,error:'OCR not configured on server (set FREEOCR_API_KEY)'});
    const raw=base64.includes(',')?base64.slice(base64.indexOf(',')+1):base64;
    const buf=Buffer.from(raw,'base64');
    const form=new FormData();
    form.append('image',new Blob([buf]),'document.png');
    const r=await fetch('https://freeocr.ai/api/v1/platform/ocr',{
      method:'POST',
      headers:{Authorization:'Bearer '+key},
      body:form
    });
    if(!r.ok){const t=await r.text().catch(()=>'');return res.status(502).json({ok:false,error:'FreeOCR '+r.status+': '+t.slice(0,200)})}
    const ct=r.headers.get('content-type')||'';
    let text='';
    if(ct.indexOf('application/json')!==-1){
      const j=await r.json();
      text=j.text||j.recognized_text||j.markdown||(j.data&&(j.data.text||j.data.markdown))||JSON.stringify(j);
    }else text=await r.text();
    res.json({ok:true,text});
  }catch(e){console.error('ocr proxy:',e.message);res.status(500).json({ok:false,error:'OCR failed'})}
});
/* --- PAN OCR pipeline: image validation -> OCR (Google/Azure/FreeOCR) -> PAN
       regex -> extraction -> save. Uses the same authenticated origin gate. --- */
const { processPanImage } = require('./services/panOcr');
app.post('/api/ocr/pan', ocrLimiter, ocrJSON, async (req, res) => {
  try {
    if (req.headers.origin && origins.length && !origins.includes(req.headers.origin)) {
      return res.status(403).json({ ok: false, error: 'Origin not allowed' });
    }
    const { image_base64, save } = req.body || {};
    if (!image_base64) return res.status(400).json({ ok: false, error: 'image_base64 is required' });
    const result = await processPanImage({ image_base64, save: save !== false });
    if (!result.ok) return res.status(422).json(result);
    res.json(result);
  } catch (e) {
    console.error('pan ocr:', e.message);
    const msg = e && e.message ? e.message : 'PAN OCR failed';
    res.status(500).json({ ok: false, error: msg });
  }
});
app.use(express.json({limit:'50kb'}));
app.use('/api',rate({windowMs:15*60*1000,max:100}));
const limiter=(max)=>rate({windowMs:15*60*1000,max,message:{ok:false,error:'Too many requests, try later'}});
const formLimit=limiter(10),otpSendLimit=limiter(6),otpVerifyLimit=limiter(15),loginLimit=limiter(10);

const clean=v=>String(v??'').replace(/[<>]/g,'').trim().slice(0,300);
const num=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:0};
const ref=()=>'FIN'+Date.now().toString().slice(-7)+crypto.randomInt(10,99);
const LOANS=['Personal Loan','Business Loan','Home Loan','Mortgage Loan','Car Loan','Other'];
/* Email: Brevo HTTP API (works on Render free tier, where SMTP ports are blocked). Falls back to SMTP if no BREVO_API_KEY. */
const mailer=(process.env.SMTP_HOST&&process.env.SMTP_USER)?nodemailer.createTransport({host:process.env.SMTP_HOST,port:+process.env.SMTP_PORT||587,secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000}):null;
const emailEnabled=()=>!!(process.env.BREVO_API_KEY||mailer);
async function sendMail(to,subject,text){
  if(process.env.BREVO_API_KEY){
    const fromEmail=process.env.MAIL_FROM_EMAIL||process.env.SMTP_USER;
    if(!fromEmail)throw new Error('Set MAIL_FROM_EMAIL (a sender verified in Brevo)');
    const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':process.env.BREVO_API_KEY,'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({sender:{name:process.env.MAIL_FROM_NAME||'Financily',email:fromEmail},to:[{email:to}],subject,textContent:text})});
    if(!r.ok)throw new Error('Brevo '+r.status+': '+(await r.text()).slice(0,300));
    return true;
  }
  if(mailer){await mailer.sendMail({from:process.env.MAIL_FROM||process.env.SMTP_USER,to,subject,text});return true}
  return false;
}
const notify=(subject,text)=>{if(emailEnabled()&&process.env.NOTIFY_EMAIL)sendMail(process.env.NOTIFY_EMAIL,subject,text).catch(e=>console.error('notify mail:',e.message))};
if(process.env.BREVO_API_KEY)console.log('Email: Brevo API enabled');
else if(mailer)mailer.verify().then(()=>console.log('Email: SMTP ready')).catch(e=>console.error('Email: SMTP FAILED -',e.message));
else console.log('Email: not configured (set SMTP_HOST/SMTP_USER or BREVO_API_KEY to enable OTP email).');

app.get('/api/health',(q,r)=>r.json({ok:true,db:mongoose.connection.readyState===1}));

app.post('/api/applications',formLimit,async(req,res)=>{
  try{
    const b={};for(const k of Object.keys(req.body||{}).slice(0,40))b[clean(k).slice(0,30)]=clean(req.body[k]);
    if((b.Name||'').length<2||!/^[6-9]\d{9}$/.test(b.Mobile||''))return res.status(400).json({ok:false,error:'Valid name and 10-digit mobile are required'});
    if(b.Email&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.Email))return res.status(400).json({ok:false,error:'Invalid email'});
    if(b.PAN&&!/^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(b.PAN))return res.status(400).json({ok:false,error:'Invalid PAN'});
    const doc=await Application.create({ref:ref(),name:b.Name,mobile:b.Mobile,email:b.Email,city:b.City,
      loanType:LOANS.includes(b.LoanType)?b.LoanType:'Other',amount:num(b.Amount),tenure:num(b.Tenure),income:num(b.Income),
      cibil:b.CIBIL,source:b.source==='quick'?'quick':'full',data:b,ip:req.ip});
    notify('New loan application '+doc.ref,`${doc.name} | ${doc.mobile} | ${doc.loanType} | Rs ${doc.amount}`);
    res.json({ok:true,ref:doc.ref});
  }catch(e){console.error(e);res.status(500).json({ok:false,error:'Server error'})}
});

app.post('/api/contact',formLimit,async(req,res)=>{
  try{const {n,p,l,a}=req.body||{};
    if(clean(n).length<2||!/^[0-9+ ]{10,14}$/.test(clean(p)))return res.status(400).json({ok:false,error:'Valid name and mobile required'});
    const c=await Contact.create({name:clean(n),mobile:clean(p),loanType:clean(l),amount:clean(a)});
    notify('New callback request',`${c.name} | ${c.mobile} | ${c.loanType} | ${c.amount}`);res.json({ok:true})
  }catch(e){res.status(500).json({ok:false,error:'Server error'})}
});

/* OTP: SMS via Fast2SMS, email via SMTP. Without keys it works only outside production and returns the OTP for testing. */
const hash=(id,o)=>crypto.createHash('sha256').update(id+o+(process.env.JWT_SECRET||'')).digest('hex');
app.post('/api/auth/send-otp',otpSendLimit,async(req,res)=>{
  try{const id=clean(req.body?.id),mode=req.body?.mode==='email'?'email':'mobile';
    if(mode==='mobile'?!/^[6-9]\d{9}$/.test(id):!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(id))return res.status(400).json({ok:false,error:'Invalid ID'});
    const otp=String(crypto.randomInt(100000,999999));
    await Otp.findOneAndUpdate({id},{id,hash:hash(id,otp),tries:0,expiresAt:new Date(Date.now()+5*60000)},{upsert:true});
    let sent=false;
    if(mode==='mobile'&&process.env.FAST2SMS_KEY){const r=await fetch('https://www.fast2sms.com/dev/bulkV2?authorization='+process.env.FAST2SMS_KEY+'&route=otp&variables_values='+otp+'&numbers='+id);sent=r.ok}
    else if(mode==='email'&&emailEnabled()){sent=await sendMail(id,'Your Financily OTP',`Your OTP is ${otp}. Valid for 5 minutes. Do not share it with anyone.`)}
    if(!sent&&process.env.NODE_ENV==='production')return res.status(503).json({ok:false,error:'OTP service not configured'});
    res.json({ok:true,...(sent?{}:{devOtp:otp})});
  }catch(e){console.error('send-otp failed:',e.message);res.status(500).json({ok:false,error:'Could not send OTP'})}
});
app.post('/api/auth/verify-otp',otpVerifyLimit,async(req,res)=>{
  try{
    const id=clean(req.body?.id),code=clean(req.body?.code),d=await Otp.findOne({id});
    if(!d||d.expiresAt<new Date()||d.tries>=3)return res.json({ok:false});
    if(d.hash!==hash(id,code)){d.tries++;await d.save();return res.json({ok:false})}
    await d.deleteOne();res.json({ok:true});
  }catch(e){console.error(e);res.status(500).json({ok:false})}
});

/* Admin */
const auth=(req,res,next)=>{try{jwt.verify((req.headers.authorization||'').slice(7),process.env.JWT_SECRET);next()}catch{res.status(401).json({ok:false,error:'Unauthorized'})}};
app.post('/api/admin/login',loginLimit,(req,res)=>{
  const {user,pass}=req.body||{},eq=(a,b)=>a&&b&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
  if(eq(user,process.env.ADMIN_USER)&&eq(pass,process.env.ADMIN_PASS))return res.json({ok:true,token:jwt.sign({r:'admin'},process.env.JWT_SECRET,{expiresIn:'8h'})});
  res.status(401).json({ok:false,error:'Wrong credentials'})});
app.get('/api/admin/applications',auth,async(q,r)=>r.json({ok:true,items:await Application.find().sort('-createdAt').limit(500).lean(),contacts:await Contact.find().sort('-createdAt').limit(200).lean()}));
app.patch('/api/admin/applications/:id',auth,async(req,res)=>{
  const s=['new','contacted','docs','approved','rejected','disbursed'];if(!s.includes(req.body.status))return res.status(400).json({ok:false});
  await Application.findByIdAndUpdate(req.params.id,{status:req.body.status,note:clean(req.body.note)});res.json({ok:true})});

app.use((e,q,res,n)=>res.status(400).json({ok:false,error:e.message}));
if(!process.env.MONGODB_URI||!process.env.JWT_SECRET){console.error('Set MONGODB_URI and JWT_SECRET');process.exit(1)}
if(process.env.NODE_ENV==='production'&&(!process.env.ADMIN_USER||!process.env.ADMIN_PASS)){console.error('Set ADMIN_USER and a non-empty ADMIN_PASS in production');process.exit(1)}
mongoose.connect(process.env.MONGODB_URI).then(()=>app.listen(process.env.PORT||3000,()=>console.log('Financily API running'))).catch(e=>{console.error(e.message);process.exit(1)});
