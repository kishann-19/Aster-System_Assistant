import {mkdirSync,cpSync} from 'node:fs';import {downloadAsset} from './download-asset.mjs';
mkdirSync('public/wasm',{recursive:true});cpSync('node_modules/@mediapipe/tasks-vision/wasm','public/wasm',{recursive:true});
await downloadAsset('public/models/hand_landmarker.task','https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');
console.log('Hand model and matching WASM verified. Camera frames stay on this device.');
