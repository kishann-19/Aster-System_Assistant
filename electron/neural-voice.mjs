import {KokoroTTS} from 'kokoro-js';
import {env} from '@huggingface/transformers';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import path from 'node:path';
const packaged=process.versions.electron&&process.resourcesPath&&existsSync(path.join(process.resourcesPath,'voice-model'));
const modelPath=packaged?path.join(process.resourcesPath,'voice-model'):fileURLToPath(new URL('../native/voice-model',import.meta.url));
env.allowRemoteModels=false;
env.backends.onnx.logLevel='error';
let instance;
export const voices=[{id:'kokoro:af_heart',name:'Heart',language:'en-US',quality:3},{id:'kokoro:af_bella',name:'Bella',language:'en-US',quality:3},{id:'kokoro:am_michael',name:'Michael',language:'en-US',quality:3},{id:'kokoro:bf_emma',name:'Emma',language:'en-GB',quality:3},{id:'kokoro:bm_george',name:'George',language:'en-GB',quality:3}];
export async function synthesize(text,voice,rate){
 if(!voices.some(v=>v.id===voice)||typeof text!=='string'||!text||text.length>2000||!Number.isFinite(rate)||rate<.35||rate>.6)throw Error('Invalid neural voice request');
 if(!instance)instance=KokoroTTS.from_pretrained(modelPath,{dtype:'q8',device:'cpu'}).catch(e=>{instance=null;throw e});
 const tts=await instance;
 // Sentence chunks keep the model's 510-token limit from cutting off longer replies.
 const sentences=text.match(/[^.!?]+(?:[.!?]+|$)/g)||[text];const chunks=[];let current='';
 for(const sentence of sentences){if((current+sentence).length>320&&current){chunks.push(current);current=''}if(sentence.length>320){const words=sentence.split(/\s+/);for(const word of words){if((current+' '+word).length>320){chunks.push(current);current=''}current+=' '+word}}else current+=sentence;}
 if(current.trim())chunks.push(current);
 const clips=[];let length=0;
 for(const chunk of chunks){const clip=await tts.generate(chunk.trim(),{voice:voice.slice(7),speed:rate/.48});clips.push(clip.audio);length+=clip.audio.length;}
 const wav=Buffer.alloc(44+length*2);wav.write('RIFF',0);wav.writeUInt32LE(36+length*2,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(length*2,40);let at=44;
 for(const clip of clips)for(const sample of clip){wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample))*32767),at);at+=2;}
 return {wav:wav.toString('base64'),duration:length/24000,voice};
}
