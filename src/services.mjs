async function localRequest(route,data){
 const response=await fetch('/api/aster/'+route,{method:data===undefined?'GET':'POST',headers:{'X-Aster-Client':'1',...(data!==undefined?{'Content-Type':'application/json'}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})});
 const body=await response.json().catch(()=>({error:'Local services are unavailable. Start the Mac app or development server.'}));if(!response.ok||body.error)throw Error(body.error||'Local service request failed');return body.result;
}
export const services=typeof window!=='undefined'&&window.aster?{
 telemetry:()=>window.aster.telemetry(),control:c=>window.aster.control(c),route:(model,messages)=>window.aster.route(model,messages),models:()=>window.aster.models(),chat:(model,messages)=>window.aster.chat(model,messages),voices:()=>window.aster.voices(),speak:(text,voice,rate)=>window.aster.speak(text,voice,rate),stopSpeaking:()=>window.aster.stopSpeaking()
}:{telemetry:()=>localRequest('telemetry'),control:()=>Promise.reject(Error('Mac controls require the Aster desktop app.')),route:(model,messages)=>localRequest('route',{model,messages}),models:()=>localRequest('models'),chat:(model,messages)=>localRequest('chat',{model,messages}),voices:()=>localRequest('voices'),speak:(text,voice,rate)=>localRequest('speak',{text,voice,rate}),stopSpeaking:()=>localRequest('stop-speaking',{})};
export function chooseVoice(voices,selected){return voices.find(v=>v.id===selected)||voices.find(v=>v.id==='kokoro:af_heart')||[...voices].sort((a,b)=>b.quality-a.quality)[0]}
export function spokenText(text){return text.replace(/```[\s\S]*?```/g,' Code is shown in the conversation. ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[*_`#]/g,'').replace(/^\s*[-•]\s+/gm,'').trim().slice(0,1400)}

let playback=null,playbackDone=null,generation=0;
export function cancelVoice(){
 generation++;if(playback){playback.pause();playback.src='';playback=null;}if(playbackDone){playbackDone();playbackDone=null;}
 return services.stopSpeaking().catch(()=>{});
}
export async function playVoice(text,voice,rate){
 const stopped=cancelVoice(),token=generation;await stopped;if(token!==generation)return;
 const result=await services.speak(text,voice,rate);if(token!==generation||!result.wav)return;
 const bytes=Uint8Array.from(atob(result.wav),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
 try{await new Promise((resolve,reject)=>{
  const audio=new Audio(url);playback=audio;let timer;
  const finish=()=>{clearTimeout(timer);if(playback===audio)playback=null;playbackDone=null;resolve()};playbackDone=finish;
  audio.onended=finish;audio.onerror=()=>{clearTimeout(timer);playback=null;playbackDone=null;reject(Error('Could not play voice audio'))};
  timer=setTimeout(()=>{audio.pause();finish()},Math.ceil((result.duration+5)*1000));
  audio.play().catch(e=>{clearTimeout(timer);playback=null;playbackDone=null;reject(e)});
 })}finally{URL.revokeObjectURL(url)}
}
