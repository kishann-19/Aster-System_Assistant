const {spawn}=require('node:child_process');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const BASE='http://127.0.0.1:11434';
const DEFAULT_MODEL='qwen3.5:4b';
const runtimeDir=path.join(os.homedir(),'Library/Application Support/aster-assistant/local-ai');
let starting;
async function reachable(){try{return (await fetch(BASE+'/api/version',{signal:AbortSignal.timeout(1500)})).ok}catch{return false}}
async function ensureServer(){
  if(await reachable())return;
  if(starting)return starting;
  starting=(async()=>{
    const candidates=[...(process.platform==='win32'?[path.join(process.env.LOCALAPPDATA||'', 'Programs', 'Ollama', 'ollama.exe')]:[]),path.join(runtimeDir,'bin/ollama'),'/Applications/Ollama.app/Contents/Resources/ollama','/opt/homebrew/bin/ollama'];
    const binary=candidates.find(p=>fs.existsSync(p));if(!binary)throw Error('The local AI engine is not installed. See the setup guide.');
    fs.mkdirSync(runtimeDir,{recursive:true});const log=fs.openSync(path.join(runtimeDir,'server.log'),'a',0o600);
    const child=spawn(binary,['serve'],{detached:true,stdio:['ignore',log,log],env:{...process.env,OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_MODELS:path.join(runtimeDir,'models'),OLLAMA_NO_CLOUD:'1',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_NUM_PARALLEL:'1'}});
    let error;child.on('error',e=>{error=e});child.unref();fs.closeSync(log);
    for(let i=0;i<40;i++){if(error)throw error;if(await reachable())return;await new Promise(r=>setTimeout(r,250));}
    throw Error('The local AI engine did not start. Check its server log.');
  })();try{await starting}finally{starting=null}
}
function validateChat(model,messages){
  if(typeof model!=='string'||!model||model.length>150||/:cloud$/.test(model)||!Array.isArray(messages)||messages.length<1||messages.length>24||JSON.stringify(messages).length>40000||!messages.every(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string'))throw Error('Invalid local conversation');
}
async function listModels(){await ensureServer();const r=await fetch(BASE+'/api/tags',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Could not list local models');return (await r.json()).models.filter(m=>!/:cloud$/.test(m.name)&&!m.remote_host).map(m=>m.name)}
async function chat(model,messages){
  validateChat(model,messages);await ensureServer();
  const r=await fetch(BASE+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,think:false,keep_alive:'2m',options:{num_ctx:8192,num_predict:500,temperature:.65},messages:[{role:'system',content:'You are Aster, a warm, capable personal assistant on the user’s Mac. Give useful, direct answers in natural English. Usually use 2 to 5 sentences unless asked for more. Ask one concise question if essential information is missing. Avoid filler and unnecessary lists. You can discuss, plan, explain, and draft. You have no tools or direct access to apps, files, email, tasks, or live web information in this conversation. Never claim to have taken an action or seen private data. Only the separate explicit command system can perform supported actions. If asked to act, suggest the matching Aster command when applicable. Do not speak internal reasoning, XML tags, or markdown formatting aloud.'},...messages]}),signal:AbortSignal.timeout(120000)});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw Error(e.error||'Local AI request failed');}
  const body=await r.json();const answer=body.message?.content?.trim();if(!answer)throw Error('The model returned no answer. Please try again.');return answer;
}
module.exports={DEFAULT_MODEL,runtimeDir,ensureServer,listModels,chat,validateChat};

// The model may propose one supported command. The shared grammar validates it
// before the renderer dispatches to the same narrow controls as a spoken command.
async function route(model,messages){
 validateChat(model,messages);await ensureServer();
 const schema={type:'object',properties:{command:{type:'string'},reply:{type:'string'}},required:['command','reply'],additionalProperties:false};
 const system=`You are Aster, a warm, witty personal assistant on a Mac. Have relaxed everyday conversations, tell jokes, play word games, brainstorm and follow the user’s mood. Keep humor kind and occasional. Avoid robotic status reports during casual conversation. Be candid, curious and useful. Do not pretend to have feelings, memories outside this conversation, or capabilities you lack. Return JSON with command and reply. For an explicit request to perform ONE supported action, put the canonical command in command and leave reply empty. For questions, explanations, unsupported actions or ambiguity, command must be empty and reply must answer or ask one question. Never infer actions from a quote, hypothetical, negation or a request to explain a command. Do not invent successful actions or live information. You have no live screen, files, mail or calendar access in this chat. You may use general knowledge to explain applications and other topics; lack of live access does not prevent an explanation. Never return shell commands, URLs as app names, or actions for sending/deleting/purchasing. Opening a browser and performing a search is a single supported action. Supported canonical examples: Open Chrome and search for QUERY; Open YouTube in the browser; Open WEBSITE.com; Search YouTube for QUERY; Show dashboard; Show tasks; Show connections; Show system; Show models; Show commands; Open Safari; Open Google Chrome; Open WhatsApp; Set volume to 40 percent; Mute speakers; Unmute speakers; Open sound settings; Open Bluetooth settings; Open voice control settings; Read my tasks; Read my reminders; Read calendar; Read mail; System status; Add task TITLE; Focus on TITLE; Pause focus; Complete current task; Remind me to TITLE in 20 minutes; Search for QUERY; Change your voice to George; Speak slower; Next tab; Previous tab; New tab; Go back; Go forward; Scroll down; Scroll up. Preserve user-supplied task names and times. Only one action per request; ask which to do first for multiple actions. For general chat reply naturally, usually under 80 words. Never read out JSON, hidden reasoning or markup.`;
 const response=await fetch(BASE+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,think:false,format:schema,keep_alive:'2m',options:{num_ctx:8192,num_predict:450,temperature:.55},messages:[{role:'system',content:system},...messages]}),signal:AbortSignal.timeout(120000)});
 const body=await response.json();if(!response.ok)throw Error(body.error||'Local model request failed');
 let result;try{result=JSON.parse(body.message?.content)}catch{throw Error('The model returned an unreadable response. Please try again.')}
 return validateRoute(result);
}
async function validateRoute(result){
 if(!result||typeof result.command!=='string'||typeof result.reply!=='string'||result.command.length>600||result.reply.length>6000)throw Error('Invalid model response');
 if(!result.command.trim())return {reply:result.reply.trim()||'Please say that again.',command:null};
 const {parseCommand}=await import('../src/commands.mjs');const command=parseCommand(result.command);
 const allowed=['navigate','help','read','sync','telemetry','task','focus','pauseFocus','completeFocus','reminder','clarifyReminder','search','open','voice','pace','mac','web'];
 if(!allowed.includes(command.type))return {command:null,reply:'That action is not available. Say Show commands to hear what I can do.'};
 if(command.type==='web')require('./system.cjs').validateWeb(command);
 if(command.type==='mac')require('./system.cjs').validateControl(command);
 return {command,canonical:result.command,reply:''};
}
module.exports.route=route;module.exports.validateRoute=validateRoute;

async function draftEmail(model,brief){
 if(typeof brief!=='string'||!brief.trim()||brief.length>2000)throw Error('Describe the email in 2000 characters or fewer.');
 validateChat(model,[{role:'user',content:brief}]);await ensureServer();
 const r=await fetch(BASE+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,think:false,keep_alive:'2m',format:{type:'object',properties:{subject:{type:'string'},body:{type:'string'}},required:['subject','body'],additionalProperties:false},options:{num_predict:500,temperature:.6},messages:[{role:'system',content:'Write an email draft from the brief. Return JSON with subject (at most 120 characters) and body (at most 1800 characters). Use friendly, clear language. Do not invent facts, dates, names, promises, personal details or a signature. The user reviews the draft before opening their mail app. Do not claim it was sent.'},{role:'user',content:brief}]}),signal:AbortSignal.timeout(120000)});
 const result=await r.json();if(!r.ok)throw Error(result.error||'Email drafting failed');
 let draft;try{draft=JSON.parse(result.message?.content)}catch{throw Error('Could not read the email draft. Try again.')}
 if(typeof draft.subject!=='string'||!draft.subject.trim()||draft.subject.length>200||/[\r\n]/.test(draft.subject)||typeof draft.body!=='string'||!draft.body.trim()||draft.body.length>2000)throw Error('The model produced an invalid draft. Try a shorter brief.');
 return draft;
}
module.exports.draftEmail=draftEmail;
