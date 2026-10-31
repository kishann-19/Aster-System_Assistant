import test from 'node:test';import assert from 'node:assert/strict';
import {parseCommand} from '../src/commands.mjs';
import {dictationInput} from '../src/desktop-commands.mjs';
import {createGestureEngine} from '../src/gesture-engine.mjs';
import {classifyHand} from '../src/gestures.mjs';
import communications from '../electron/communications.cjs';
import ai from '../electron/ai.cjs';
import mac from '../electron/system.cjs';
const hand=(extra={})=>({x:.5,y:.5,palmX:.5,palmY:.5,pinch:1,scroll:false,open:false,paused:false,...extra});
test('screen, dictation and desktop controls require explicit intent',async()=>{
 for(const [phrase,action] of [['ss','screenshot'],['Take a screenshot','screenshot'],['Start screen recording','recordStart'],['Stop recording','recordStop']])assert.equal(parseCommand(phrase).action,action);
 assert.equal(parseCommand('Lock my screen').operation,'lock');assert.equal(parseCommand('Next desktop').operation,'next desktop');
 assert.equal(parseCommand('Start dictation').enabled,true);assert.equal(parseCommand('Stop dictation').enabled,false);
 for(const phrase of ['Do not lock my screen','Explain how to take a screenshot','I said "start screen recording" yesterday'])assert.equal(parseCommand(phrase).type,'chat');
 for(const phrase of ['Take a screenshot','Start screen recording','Lock my screen','Confirm email'])assert.equal((await ai.validateRoute({command:phrase,reply:''})).command,null);
 assert.throws(()=>mac.validateControl({action:'shortcut',operation:'shutdown'}));
});
test('dictation preserves ordinary commands as literal text until an escape phrase',()=>{
 assert.deepEqual(dictationInput('open Safari'),{text:'open Safari'});
 assert.deepEqual(dictationInput('Command press Enter'),{command:'press Enter'});
 assert.deepEqual(dictationInput('Aster, stop dictation.'),{command:'Stop dictation'});
 assert.throws(()=>mac.validateUI({action:'uiType',text:'hi',dictationToken:'wrong'}));
});
test('email draft resolves exact address and opens only after matching confirmation',async()=>{
 const opened=[];const api=communications.createCommunications(async()=>({contacts:[{name:'Example',emails:['one@example.com','two@example.com']}]}),async url=>opened.push(url));
 assert.equal(communications.emailAddress('one at example dot com'),'one@example.com');
 assert.equal(communications.emailAddress('one@example.com\r\nBcc:secret@example.com'),null);
 const p=await api.prepare({kind:'email',target:'Example',subject:'A & B',text:'Hello\nThanks.'});assert.equal(p.choices.length,2);assert.equal(opened.length,0);
 await assert.rejects(api.confirm(p.choices[0].token,'call'));await api.confirm(p.choices[1].token,'email');
 assert.equal(opened[0],'mailto:two%40example.com?subject=A%20%26%20B&body=Hello%0AThanks.');
 await assert.rejects(api.confirm(p.choices[1].token,'email'));
 await assert.rejects(api.prepare({kind:'email',target:'one@example.com',subject:'Hi\nBcc:someone',text:'Hi'}));
 const c=parseCommand('Write an email to Alex about moving the meeting');assert.equal(c.type,'emailDraft');assert.equal(c.target,'Alex');
 assert.equal(parseCommand('Email to one@example.com subject Hi saying Thanks!').text,'Thanks!');
});
test('quick pinches become single and double taps only on release',()=>{
 const e=createGestureEngine();assert.equal(e.step([hand({pinch:.2})],0).events.length,0);
 assert.equal(e.step([hand()],150).events[0].kind,'click');
 e.step([hand({pinch:.2})],250);assert.equal(e.step([hand()],350).events[0].kind,'doubleClick');
 const jitter=createGestureEngine();jitter.step([hand({pinch:.2})],0);assert.ok(!jitter.step([hand({x:.9})],100).events.some(x=>x.kind==='click'));
});
test('held pinch drags, tracking loss and reset always release the mouse',()=>{
 const e=createGestureEngine();e.step([hand({pinch:.2})],0);
 assert.deepEqual(e.step([hand({pinch:.2,x:.6})],400).events.map(x=>x.kind),['down','drag']);
 assert.equal(e.step([],650).events[0].kind,'up');assert.equal(e.step([],900).events.length,0);
 e.step([hand({pinch:.2})],1000);e.step([hand({pinch:.2})],1400);assert.equal(e.reset()[0].kind,'up');
});
test('scroll, two-hand zoom and palm swipes are separate modes with cooldown',()=>{
 const e=createGestureEngine();e.step([hand({scroll:true})],0);assert.ok(e.step([hand({scroll:true,y:.6})],100).events.some(x=>x.kind==='scroll'));
 e.step([hand({pinch:.2,palmX:.3}),hand({pinch:.2,palmX:.7})],300);
 assert.equal(e.step([hand({pinch:.2,palmX:.2}),hand({pinch:.2,palmX:.8})],600).events[0].kind,'zoomIn');
 const p=createGestureEngine();p.step([hand({open:true,palmX:.3})],0);
 assert.equal(p.step([hand({open:true,palmX:.6})],400).events[0].kind,'desktopPrevious');assert.equal(p.step([hand({open:true,palmX:.9})],600).events.length,0);
});
test('closed fists override close thumb/index tips while curled-index pinches remain valid',()=>{
 const points=Array.from({length:21},()=>({x:.5,y:.55}));
 points[0]={x:.5,y:.9};points[9]={x:.5,y:.6};
 for(const tip of [8,12,16,20])points[tip]={x:.5,y:.7};
 points[4]={x:.51,y:.7};
 const fist=classifyHand(points);assert.ok(fist.pinch<.35);assert.equal(fist.paused,true);
 const e=createGestureEngine();assert.equal(e.step([fist],0).events.length,0);assert.equal(e.step([fist],450).events.length,0);
 for(const tip of [12,16,20])points[tip]={x:.5,y:.35};
 const pinch=classifyHand(points);assert.equal(pinch.paused,false);assert.ok(pinch.pinch<.35);
 e.step([pinch],500);assert.deepEqual(e.step([pinch],900).events.map(x=>x.kind),['down','drag']);
 assert.deepEqual(e.step([fist],950).events.map(x=>x.kind),['up']);
 assert.equal(e.step([fist],1400).events.length,0);
});
test('a fist on the second hand stops a drag and prevents two-hand zoom',()=>{
 const e=createGestureEngine();e.step([hand({pinch:.2})],0);e.step([hand({pinch:.2})],400);
 const result=e.step([hand({pinch:.2}),hand({pinch:.2,paused:true})],450);
 assert.deepEqual(result.events.map(x=>x.kind),['up']);assert.match(result.status,/paused/);
});
test('fully opening the palm cancels a pending tap and releases a drag before desktop swipes',()=>{
 const e=createGestureEngine();e.step([hand({pinch:.2})],0);
 assert.equal(e.step([hand({open:true,palmX:.3})],150).events.length,0);
 assert.deepEqual(e.step([hand({open:true,palmX:.6})],500).events.map(x=>x.kind),['desktopPrevious']);
 const drag=createGestureEngine();drag.step([hand({pinch:.2})],0);drag.step([hand({pinch:.2})],400);
 assert.deepEqual(drag.step([hand({open:true})],450).events.map(x=>x.kind),['up']);
});
test('small pinch releases with extended fingers remain taps rather than open-palm switches',()=>{
 const points=Array.from({length:21},()=>({x:.5,y:.55}));points[0]={x:.5,y:.9};points[9]={x:.5,y:.6};
 for(const tip of [8,12,16,20])points[tip]={x:.5,y:.35};
 points[4]={x:.51,y:.35};const e=createGestureEngine();e.step([classifyHand(points)],0);
 points[4]={x:.71,y:.35};const released=classifyHand(points);
 assert.ok(released.pinch>.6&&released.pinch<.85);assert.equal(released.open,false);
 assert.equal(e.step([released],150).events[0].kind,'click');
 points[4]={x:.85,y:.35};assert.equal(classifyHand(points).open,true);
});
