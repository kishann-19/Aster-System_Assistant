const path=require('node:path');
const {pathToFileURL}=require('node:url');
const SERVICES={mail:'https://mail.google.com/',gmail:'https://mail.google.com/',whatsapp:'https://web.whatsapp.com/',calendar:'https://calendar.google.com/',browser:'https://www.google.com/',reminders:'x-apple-reminderkit://',calls:'facetime://',facetime:'facetime://'};
function safeExternal(url){try {const u=new URL(url);return ['https:','http:'].includes(u.protocol)&& !u.username&&!u.password;}catch{return false;}}
function validState(s){return !!s&&s.version===1&&Array.isArray(s.tasks)&&Array.isArray(s.reminders)&&Array.isArray(s.history)&&Array.isArray(s.notifications)&&s.tasks.length<=2000&&s.reminders.length<=2000&&s.tasks.every(t=>typeof t.id==='string'&&typeof t.title==='string'&&t.title.length<=200&&typeof t.done==='boolean')&&s.reminders.every(r=>typeof r.id==='string'&&typeof r.title==='string'&&r.title.length<=200&&Number.isFinite(Date.parse(r.due)))&&JSON.stringify(s).length<2000000;}
function trustedFrame(event,entry){return event.senderFrame===event.sender.mainFrame&&event.senderFrame.url===pathToFileURL(path.resolve(entry)).href;}
module.exports={SERVICES,safeExternal,validState,trustedFrame};
