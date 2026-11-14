import test from 'node:test';import assert from 'node:assert/strict';
import {parseCommand} from '../src/commands.mjs';
import mac from '../electron/system.cjs';
import communications from '../electron/communications.cjs';
import ai from '../electron/ai.cjs';
test('web destinations and compound browser search preserve intent',()=>{
 for(const phrase of ['Open YouTube','Open YouTube in the browser','Open YouTube India browser']){const c=parseCommand(phrase);assert.equal(c.type,'web');assert.equal(c.url,'https://www.youtube.com/');}
 for(const phrase of ['Open browser and search for YouTube','Open India browser and search for YouTube']){const c=parseCommand(phrase);assert.equal(c.action,'search');assert.equal(c.query,'YouTube');assert.equal(c.browser,'default');}
 assert.equal(parseCommand('Open Chrome and search for CPU design').browser,'chrome');
 assert.equal(parseCommand('Search YouTube for C tutorials').engine,'youtube');
 assert.equal(parseCommand('Open github dot com').url,'https://github.com');
 assert.equal(parseCommand('Open example.com in Safari').browser,'safari');
 assert.equal(parseCommand('Search for hello in Chrome').browser,'chrome');
});
test('website policy rejects scripts, credentials and unsupported browser IDs',()=>{
 for(const url of ['javascript:alert(1)','file:///tmp/a','https://name:secret@example.com'])assert.throws(()=>mac.validateWeb({action:'visit',url,browser:'default'}));
 assert.throws(()=>mac.validateWeb({action:'visit',url:'https://example.com',browser:'injected'}));
 assert.equal(mac.validateWeb({action:'search',query:'a & b',engine:'google',browser:'chrome'}).url,'https://www.google.com/search?q=a%20%26%20b');
});
test('voice typing preserves punctuation and cannot become a model-generated action',async()=>{
 assert.deepEqual(parseCommand('Aster type Hello, I will be there!'),{type:'ui',action:'uiType',text:'Hello, I will be there!'});
 assert.equal(parseCommand('Press Return').key,'enter');assert.equal(parseCommand('Click number 12').number,12);
 assert.equal(parseCommand('Click Send').label,'Send');
 assert.equal((await ai.validateRoute({command:'Type hello',reply:''})).command,null);
 assert.equal((await ai.validateRoute({command:'Click Send',reply:''})).command,null);
 for(const c of [{action:'uiType',text:'hello\nsubmit'},{action:'uiKey',key:'shell'},{action:'uiClick',number:0},{action:'uiClick',number:100},{action:'uiClick',label:'x'.repeat(121)}])assert.throws(()=>mac.validateUI(c));
});
test('wake settings and communication commands are explicit',()=>{
 assert.deepEqual(parseCommand('Enable clap wake'),{type:'soundWake',enabled:true});
 assert.equal(parseCommand('Set wake mode to single').mode,'single');
 assert.equal(parseCommand('Set wake sensitivity to high').threshold,.2);
 assert.deepEqual(parseCommand('WhatsApp Alex saying I will be there!'),{type:'communication',kind:'whatsapp',target:'Alex',text:'I will be there!'});
 assert.equal(parseCommand('confirm call').kind,'call');
 assert.equal(parseCommand('call Alex').target,'Alex');
 assert.equal(parseCommand('choose contact 2').number,2);
});
test('contacts must be selected and confirmed; tokens expire and are single-use',async()=>{
 let tick=0;const opened=[];const api=communications.createCommunications(async()=>({contacts:[{name:'Test Person',phones:['+1 202-555-0100','+1 202-555-0101']}]}),async url=>opened.push(url),()=>tick);
 const p=await api.prepare({kind:'call',target:'Test Person',text:''});assert.equal(p.choices.length,2);assert.equal(opened.length,0);
 await assert.rejects(api.confirm(p.choices[0].token,'whatsapp'));
 await api.confirm(p.choices[1].token,'call');assert.equal(opened[0],'tel:+12025550101');await assert.rejects(api.confirm(p.choices[1].token,'call'));
 const q=await api.prepare({kind:'whatsapp',target:'+12025550100',text:'Hello & goodbye'});tick=120001;await assert.rejects(api.confirm(q.choices[0].token,'whatsapp'));assert.equal(opened.length,1);
 const r=await api.prepare({kind:'whatsapp',target:'+12025550100',text:'Hello & goodbye'});await api.confirm(r.choices[0].token,'whatsapp');assert.ok(opened[1].includes('text=Hello%20%26%20goodbye'));
});
test('spoken numbers are normalized without interpreting arbitrary names as numbers',()=>{
 assert.equal(communications.phoneNumber('plus one two zero two five five five zero one zero zero'),'+12025550100');
 assert.equal(communications.phoneNumber('Alex'),null);assert.equal(communications.phoneNumber('tel:1234567890'),null);
});

test('use GPT routes the complete request to the dedicated Codex chat', () => {
  assert.deepEqual(parseCommand('Aster, use GPT open Safari and research laptops'), {
    type: 'codex',
    request: 'open Safari and research laptops',
  });
  assert.deepEqual(parseCommand('summarise this using GPT'), {type: 'chat', text: 'summarise this using GPT'});
  assert.deepEqual(parseCommand('remind me tomorrow at nine use GPT'), {
    type: 'codex',
    request: 'remind me tomorrow at nine',
  });
  assert.deepEqual(parseCommand('use GPT'), {type: 'codexPrompt'});
});
