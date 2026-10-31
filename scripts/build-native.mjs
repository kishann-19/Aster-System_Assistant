import {mkdirSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {resolve} from 'node:path';
if(process.platform!=='darwin')throw Error('The native bridge requires macOS.');
mkdirSync('native/build',{recursive:true});
execFileSync('xcrun',['swiftc','native/Bridge.swift','native/VoiceWake.swift','native/MacControls.swift','native/Capture.swift','native/Pointer.swift','-o','native/build/AsterBridge','-target',`${process.arch==='arm64'?'arm64':'x86_64'}-apple-macosx15.0`,'-framework','AppKit','-framework','ApplicationServices','-framework','Speech','-framework','AVFoundation','-framework','EventKit','-framework','Contacts','-framework','ScreenCaptureKit','-Xlinker','-sectcreate','-Xlinker','__TEXT','-Xlinker','__info_plist','-Xlinker',resolve('native/Info.plist')],{stdio:'inherit'});
console.log('Mac bridge compiled.');
