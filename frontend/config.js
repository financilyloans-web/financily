/* After deploying the backend on Render, put its URL here (no trailing slash). */
window.FIN_API_URL = location.hostname==='localhost' ? 'http://localhost:3000' : 'https://financily-api.onrender.com';

/* Real OTP login through the backend (the site uses this automatically). */
window.FIN_AUTH = {
  async send(id, mode){
    const r = await fetch(window.FIN_API_URL+'/api/auth/send-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,mode})});
    const j = await r.json(); if(!j.ok) throw new Error(j.error||'send failed');
    if(j.devOtp) alert('Test mode OTP: '+j.devOtp); /* appears only when no SMS/email provider is set and NODE_ENV is not production */
  },
  async verify(id, mode, code){
    const r = await fetch(window.FIN_API_URL+'/api/auth/verify-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,code})});
    return (await r.json()).ok===true;
  }
};
