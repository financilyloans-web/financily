const m=require('mongoose'),S=m.Schema;
const Application=m.model('Application',new S({ref:{type:String,unique:true},name:String,mobile:{type:String,index:true},email:String,city:String,loanType:String,amount:Number,tenure:Number,income:Number,cibil:String,source:String,
 status:{type:String,default:'new',index:true},note:String,data:S.Types.Mixed,ip:String},{timestamps:true}));
const Contact=m.model('Contact',new S({name:String,mobile:String,loanType:String,amount:String},{timestamps:true}));
const Otp=m.model('Otp',new S({id:{type:String,unique:true},hash:String,tries:Number,expiresAt:{type:Date,expires:0}}));
module.exports={Application,Contact,Otp};
