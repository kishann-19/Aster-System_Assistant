const crypto=require('node:crypto');
function phoneNumber(value){
 if(typeof value!=='string')return null;
 const words={zero:'0',oh:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',plus:'+'};
 const number=value.toLowerCase().replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine|plus)\b/g,x=>words[x]).replace(/[\s().-]/g,'');
 return /^\+?\d{7,15}$/.test(number)?number:null;
}
function emailAddress(value){
 if(typeof value!=='string')return null;
 const address=value.trim().replace(/\s+at\s+/gi,'@').replace(/\s+dot\s+/gi,'.');
 return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(address)&&address.length<=254?address:null;
}
function createCommunications(native,openExternal,now=Date.now){
 const plans=new Map();
 return {
 async prepare(input){
  if(!input||!['call','whatsapp','email'].includes(input.kind)||typeof input.target!=='string'||!input.target.trim()||input.target.length>254||typeof input.text!=='string'||input.text.length>2000)throw Error('Invalid contact request');
  const subject=input.subject||'';if(typeof subject!=='string'||subject.length>200||/[\r\n]/.test(subject))throw Error('Invalid email subject');
  plans.clear();let choices=[];const direct=input.kind==='email'?emailAddress(input.target):phoneNumber(input.target);
  const field=input.kind==='email'?'address':'phone';
  if(direct)choices=[{name:direct,[field]:direct}];
  else{
   const result=await native({action:'contacts',name:input.target.trim()});
   for(const contact of result.contacts||[]){for(const raw of (input.kind==='email'?contact.emails:contact.phones)||[]){
    const value=input.kind==='email'?emailAddress(raw):phoneNumber(raw);
    if(value&&!choices.some(c=>c[field]===value))choices.push({name:contact.name,[field]:value});
   }}
  }
  if(!choices.length)throw Error(input.kind==='email'?'No matching email address found. Say the email address explicitly.':'No matching phone number found. Say the full number, including country code for WhatsApp.');
  const expires=now()+120000;
  return {kind:input.kind,text:input.text,subject,expires,choices:choices.slice(0,12).map(c=>{const token=crypto.randomUUID();plans.set(token,{...c,kind:input.kind,text:input.text,subject,expires});return {...c,token};})};
 },
 async confirm(token,kind){
  const plan=plans.get(token);if(!plan||plan.expires<now()||plan.kind!==kind)throw Error('That request expired. Please say the call or message request again.');
  plans.clear();
  if(kind==='call'){await openExternal('tel:'+plan.phone);return {message:'Call request handed to the Mac phone app for '+plan.name+'. If macOS asks, confirm there. Calls need your iPhone connected.'};}
  if(kind==='email'){
   await openExternal('mailto:'+encodeURIComponent(plan.address)+'?subject='+encodeURIComponent(plan.subject)+'&body='+encodeURIComponent(plan.text));
   return {message:'Email draft opened in your default mail app for '+plan.address+'. Review it, then say Click Send if you want to send. Nothing has been sent yet.'};
  }
  await openExternal('https://web.whatsapp.com/send?phone='+encodeURIComponent(plan.phone.replace(/^\+/,''))+'&text='+encodeURIComponent(plan.text));
  return {message:'WhatsApp opened with the draft for '+plan.name+'. Review the chat and message. To send, say Click Send when WhatsApp is in front. Nothing has been sent by Aster yet.'};
 },cancel(){plans.clear();return true}
 };
}
module.exports={phoneNumber,emailAddress,createCommunications};
