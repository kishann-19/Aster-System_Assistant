const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const ai=require('./ai.cjs');
const exec=promisify(execFile);
let running=null,controller=null;
async function install(progress=()=>{}){
 if(running)return running;
 if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('Automatic model setup currently supports Apple Silicon Macs.');
 controller=new AbortController();const signal=controller.signal;
 running=(async()=>{
  const dir=path.join(ai.runtimeDir,'bin'),binary=path.join(dir,'ollama');await fs.mkdir(dir,{recursive:true});
  try{await fs.access(binary)}catch{
   progress({phase:'engine',message:'Downloading the local AI engine from Ollama…'});
   const response=await fetch('https://github.com/ollama/ollama/releases/download/v0.40.11/ollama-darwin.tgz',{signal});
   if(!response.ok)throw Error('AI engine download failed. Check your connection and try again.');
   const archive=path.join(ai.runtimeDir,'engine-download.tgz'),file=await fs.open(archive,'w',0o600),hash=crypto.createHash('sha256');
   try{for await(const chunk of response.body){signal.throwIfAborted();hash.update(chunk);await file.write(chunk)}}finally{await file.close()}
   try{
    if(hash.digest('hex')!=='aea7d3f2e32371b7644a6e2ec8d4f26820a0e3965918cce8a46cef3e947f6291')throw Error('Downloaded engine failed its integrity check.');
    signal.throwIfAborted();await exec('/usr/bin/tar',['-xzf',archive,'-C',dir],{timeout:120000,signal});
   }finally{await fs.unlink(archive).catch(()=>{})}
  }
  signal.throwIfAborted();await ai.ensureServer();
  progress({phase:'model',message:'Downloading Qwen 3.5 4B. Several GB; progress resumes if interrupted.'});
  const r=await fetch('http://127.0.0.1:11434/api/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:ai.DEFAULT_MODEL,stream:true}),signal});
  if(!r.ok)throw Error('Could not download the conversation model.');
  const decoder=new TextDecoder();let buffer='';
  for await(const chunk of r.body){buffer+=decoder.decode(chunk,{stream:true});let at;
   while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);if(!line)continue;const p=JSON.parse(line);if(p.error)throw Error(p.error);progress({phase:'model',message:p.status||'Downloading…',percent:p.total?Math.floor(100*(p.completed||0)/p.total):null});}
  }
  const models=await ai.listModels();if(!models.includes(ai.DEFAULT_MODEL))throw Error('Download ended before the model became available. Retry setup.');
  progress({phase:'ready',message:'Local conversation is ready.'});return {model:ai.DEFAULT_MODEL};
 })();
 try{return await running}finally{running=null;controller=null}
}
function cancel(){controller?.abort();}
module.exports={install,cancel};
