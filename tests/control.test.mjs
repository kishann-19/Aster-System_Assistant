import test from 'node:test';import assert from 'node:assert/strict';
import {parseCommand} from '../src/commands.mjs';
import mac from '../electron/system.cjs';import ai from '../electron/ai.cjs';
test('dashboard navigation and speech settings resolve without a model',()=>{
 assert.deepEqual(parseCommand('Aster, show system'),{type:'navigate',page:'system'});
 assert.equal(parseCommand('show commands').type,'help');assert.equal(parseCommand('go to sleep').type,'standby');assert.equal(parseCommand('Aster wake up').type,'wake');
 assert.deepEqual(parseCommand('Change your voice to George'),{type:'voice',name:'george'});
 assert.equal(parseCommand('Speak slower').value,.42);
 assert.deepEqual(parseCommand('Use Qwen model'),{type:'model',name:'qwen'});
});
test('Mac actions have bounded arguments; unrecognized commands cannot become shell code',()=>{
 assert.equal(parseCommand('set volume to 40 percent').value,40);
 assert.equal(parseCommand('set volume to 101').type,'clarifyReminder');
 assert.equal(parseCommand('open Bluetooth settings').pane,'bluetooth');
 assert.equal(parseCommand('Open voice control settings').pane,'voice control');
 assert.equal(parseCommand('Open Safari').name,'Safari');
 assert.equal(parseCommand('Open WhatsApp').type,'open');
 assert.equal(parseCommand('Next tab').operation,'next tab');
 for(const command of [{action:'volume',value:-1},{action:'volume',value:101},{action:'volume',value:'40; do shell script'},{action:'openApp',name:'/bin/sh'},{action:'openApp',name:'Safari; rm -rf /'},{action:'settings',pane:'unknown'},{action:'browser',operation:'send message'},{action:'exec',text:'test'}])assert.throws(()=>mac.validateControl(command));
 assert.deepEqual(mac.validateControl({action:'volume',value:30,extra:'ignored'}),{action:'volume',value:30});
});
test('speech syntax does not execute explanations, negations, or unrecognized deletion',()=>{
 for(const input of ['Do not open Safari','Explain how to set volume to 30','Delete all files','Send a WhatsApp message','Open javascript:alert(1)','run rm -rf /'])assert.equal(parseCommand(input).type,'chat');
});
test('model output must pass shared command validation before execution',async()=>{
 assert.equal((await ai.validateRoute({command:'Open Safari',reply:''})).command.action,'openApp');
 assert.equal((await ai.validateRoute({command:'Show system',reply:''})).command.type,'navigate');
 assert.equal((await ai.validateRoute({command:'run rm -rf /',reply:''})).command,null);
 assert.equal((await ai.validateRoute({command:'stop listening',reply:''})).command,null);
 await assert.rejects(ai.validateRoute({command:[],reply:''}));
 assert.equal((await ai.validateRoute({command:'',reply:'Hello'})).reply,'Hello');
});
test('list, sync and completion commands remain distinct',()=>{
 assert.deepEqual(parseCommand('Read my tasks'),{type:'read',kind:'tasks'});
 assert.deepEqual(parseCommand('Read calendar'),{type:'sync',kind:'calendar'});
 assert.deepEqual(parseCommand('Complete task Prototype'),{type:'completeNamed',title:'Prototype'});
});
