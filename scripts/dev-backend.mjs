import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import mac from '../electron/system.cjs';
import ai from '../electron/ai.cjs';
import {voices,synthesize} from '../electron/neural-voice.mjs';
const bridgePath=fileURLToPath(new URL('../native/build/AsterBridge',import.meta.url));
export function devBackend(){
 let bridge,buffer='',seq=0;const requests=new Map();
 function native(action,payload={}){return new Promise((resolve,reject)=>{
  if(!bridge){bridge=spawn(bridgePath,[],{stdio:['pipe','pipe','pipe']});bridge.stdout.on('data',data=>{buffer+=data;let idx;while((idx=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,idx);buffer=buffer.slice(idx+1);try{const result=JSON.parse(line),item=requests.get(result.id);if(item){clearTimeout(item.timer);requests.delete(result.id);result.error?item.reject(Error(result.error)):item.resolve(result)}}catch{}}});bridge.stderr.on('data',()=>{});const fail=()=>{bridge=null;for(const r of requests.values()){clearTimeout(r.timer);r.reject(Error('Mac voice bridge unavailable. Run npm run native.'));}requests.clear()};bridge.on('error',fail);bridge.on('exit',fail);}
  const id=++seq;const timer=setTimeout(()=>{requests.delete(id);reject(Error('Voice request timed out'))},90000);requests.set(id,{resolve,reject,timer});bridge.stdin.write(JSON.stringify({action,...payload,id})+'\n');
 })}
 return {name:'aster-local-services',configureServer(server){
  server.httpServer?.on('close',()=>bridge?.kill());
  server.middlewares.use(async(req,res,next)=>{
   const route=req.url?.split('?')[0];if(!route?.startsWith('/api/aster/'))return next();
   const origin='http://'+req.headers.host;
   if(!['127.0.0.1:5173','localhost:5173'].includes(req.headers.host)||req.headers['x-aster-client']!=='1'||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site'){
    res.statusCode=403;res.end('Forbidden');return;
   }
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   try{
    let data={};if(req.method==='POST'){let text='';for await(const chunk of req){text+=chunk;if(text.length>50000)throw Error('Request too large')}data=JSON.parse(text||'{}');}
    let result;
    if(route==='/api/aster/models'&&req.method==='GET')result=await ai.listModels();
    else if(route==='/api/aster/telemetry'&&req.method==='GET')result=await mac.telemetry();
    else if(route==='/api/aster/route'&&req.method==='POST')result=await ai.route(data.model,data.messages);
    else if(route==='/api/aster/chat'&&req.method==='POST')result=await ai.chat(data.model,data.messages);
    else if(route==='/api/aster/voices'&&req.method==='GET')result={voices:[...voices,...(await native('ttsVoices')).voices]};
    else if(route==='/api/aster/speak'&&req.method==='POST'){
     if(typeof data.text!=='string'||data.text.length>2000||!data.text||typeof data.voice!=='string'||data.voice.length>200||!Number.isFinite(data.rate)||data.rate<.35||data.rate>.6)throw Error('Invalid speech request');
     result=data.voice.startsWith('kokoro:')?await synthesize(data.text,data.voice,data.rate):await native('ttsSpeak',{text:data.text,voice:data.voice,rate:data.rate});
    }
    else if(route==='/api/aster/stop-speaking'&&req.method==='POST')result=await native('ttsStop');
    else{res.statusCode=404;res.end(JSON.stringify({error:'Unknown service'}));return;}
    res.end(JSON.stringify({result}));
   }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}
  });
 }};
}
