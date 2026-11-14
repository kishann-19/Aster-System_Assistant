import {parseControl} from './control-commands.mjs';
import * as chrono from 'chrono-node';
export function parseCommand(input, now = new Date()) {
  const text = input.trim().replace(/^(?:hey\s+)?aster[,\s:]*/i, '').trim();
  const gptTrigger = /\buse\s+(?:chat\s*)?gpt\b/i;
  if (gptTrigger.test(text)) {
    const request = text.replace(gptTrigger, '').replace(/^[\s,:;.!-]+/, '').trim();
    return request ? {type:'codex', request} : {type:'codexPrompt'};
  }
  const control=parseControl(input);if(control)return control;
  let m;
  if (/^(stop listening|turn off (the )?mic|mute|stop voice)[.!]?$/i.test(text)) return {type:'mute'};
  if (/^(stop|pause) (gestures|hand control|mouse control)[.!]?$/i.test(text)) return {type:'stopGestures'};
  if (/^(what(?:'s| is) (the )?time|time)[?!.]?$/i.test(text)) return {type:'time'};
  if (/^(what(?:'s| is) (on )?(my )?(agenda|schedule)|show (my )?(agenda|schedule)|today)[?!.]?$/i.test(text)) return {type:'agenda'};
  if ((m=text.match(/^(?:add (?:a )?task|create (?:a )?task|task)\s*:?\s+(.+)/i))) return {type:'task',title:m[1].slice(0,200)};
  if ((m=text.match(/^(?:focus on|start working on|start focus on)\s+(.+)/i))) return {type:'focus',title:m[1].slice(0,200)};
  if (/^(pause focus|stop focus|take a break)[.!]?$/i.test(text)) return {type:'pauseFocus'};
  if (/^(finish|complete) (my |the |current )?task[.!]?$/i.test(text)) return {type:'completeFocus'};
  if ((m=text.match(/^(?:open|launch)\s+(mail|gmail|whatsapp|calendar|browser|reminders|calls|facetime)[.!]?$/i))) return {type:'open',app:m[1].toLowerCase()};
  if ((m=text.match(/^(?:search (?:the web )?for|google)\s+(.+)/i))) return {type:'search',query:m[1].slice(0,500)};
  if ((m=text.match(/^(?:remind me|set (?:a )?reminder)\s+(.+)/i))) {
    const result = chrono.parse(m[1], now, {forwardDate:true})[0];
    if(!result) return {type:'clarifyReminder',message:'Include a time, for example: “Remind me to stretch in 20 minutes.”'};
    const date=result.start.date();
    const before = m[1].slice(0, result.index).replace(/(?:^|\s)(?:at|on|by|for)\s*$/i, '').trim();
    const after = m[1].slice(result.index + result.text.length).replace(/^[\s,;:]+/, '').trim();
    const title = [before, after].filter(Boolean).join(' ')
      .replace(/^(?:to|that)\b\s*/i, '')
      .replace(/\s+([.!?])/g, '$1')
      .replace(/^[.!?]+$/, '')
      .trim();
    if(!title) return {type:'clarifyReminder',message:'What should I remind you about? Try “Remind me to drink water in 30 minutes.”'};
    if(date<=now) return {type:'clarifyReminder',message:'That time has already passed. Please choose a future time.'};
    return {type:'reminder',title:title.slice(0,200),due:date.toISOString()};
  }
  return {type:'chat',text};
}
export function dueReminders(reminders, now=Date.now()) {
  return reminders.filter(r=> !r.done && !r.notified && Number.isFinite(Date.parse(r.due)) && Date.parse(r.due)<=now);
}
export function createInitialState() {
  return {version:1,tasks:[],reminders:[],focusId:null,focusEnds:null,notifications:[],history:[{role:'assistant',text:'Aster online. Say “Show commands” for voice controls, or tell me what you need. Mac controls run in the desktop app.'}],settings:{setupCompleted:false,name:'',handsFree:true,soundWake:true,wakeMode:'double',wakeThreshold:.45,startInStandby:true,voice:true,voiceId:'kokoro:af_heart',voiceVersion:3,voiceRate:0.48,model:'',modelConfigured:false}};
}
