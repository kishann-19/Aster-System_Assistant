const os=require('node:os');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
const PANES={sound:'com.apple.Sound-Settings.extension',displays:'com.apple.Displays-Settings.extension',wifi:'com.apple.wifi-settings-extension',bluetooth:'com.apple.BluetoothSettings',accessibility:'com.apple.Accessibility-Settings.extension','voice control':'com.apple.Accessibility-Settings.extension?VoiceControl',privacy:'com.apple.settings.PrivacySecurity.extension',notifications:'com.apple.Notifications-Settings.extension',battery:'com.apple.Battery-Settings.extension',keyboard:'com.apple.Keyboard-Settings.extension',trackpad:'com.apple.Trackpad-Settings.extension',general:'com.apple.systempreferences','screen recording':'com.apple.settings.PrivacySecurity.extension?Privacy_ScreenCapture'};
const BROWSER_ACTIONS=['next tab','previous tab','new tab','go back','go forward','reload page','scroll down','scroll up'];
function validateControl(c){
 if(!c||typeof c!=='object')throw Error('Invalid Mac command');
 switch(c.action){
 case 'shortcut':if(!['lock','next desktop','previous desktop','show desktop','mission control','zoom in','zoom out','reset zoom'].includes(c.operation))throw Error('Unsupported shortcut');return {action:'shortcut',operation:c.operation};
 case 'openApp':if(typeof c.name!=='string'||! /^[\p{L}\p{N} .+-]{1,70}$/u.test(c.name))throw Error('Use an installed application name');return {action:c.action,name:c.name};
 case 'settings':if(!Object.hasOwn(PANES,c.pane))throw Error('Unsupported settings panel');return {action:'openSettings',url:'x-apple.systempreferences:'+PANES[c.pane]};
 case 'volume':if(!Number.isInteger(c.value)||c.value<0||c.value>100)throw Error('Volume must be 0–100');return {action:'volume',value:c.value};
 case 'soundMute':if(typeof c.enabled!=='boolean')throw Error('Invalid mute value');return {action:'soundMute',enabled:c.enabled};
 case 'browser':if(!BROWSER_ACTIONS.includes(c.operation))throw Error('Unsupported browser control');return {action:'browserControl',operation:c.operation};
 default:throw Error('Unsupported Mac command');
 }
}
function validateUI(c){
 if(!c||typeof c!=='object')throw Error('Invalid app control');
 if(c.action==='uiControls'||c.action==='uiDictationStart')return {action:c.action};
 if(c.action==='uiType'&&typeof c.text==='string'&&c.text.trim()&&c.text.length<=2000&&!/[\u0000-\u001f\u007f]/.test(c.text)){if(c.dictationToken!==undefined&&(typeof c.dictationToken!=='string'||! /^[A-F0-9-]{36}$/i.test(c.dictationToken)))throw Error('Invalid dictation session');return {action:c.action,text:c.text,...(c.dictationToken?{dictationToken:c.dictationToken}:{})};}
 if(c.action==='uiClick'){
  if(Number.isInteger(c.number)&&c.number>0&&c.number<=60&&!c.label)return {action:c.action,number:c.number};
  if(typeof c.label==='string'&&c.label.trim()&&c.label.length<=120&&!c.number)return {action:c.action,label:c.label.trim()};
 }
 if(c.action==='uiKey'&&['enter','tab','escape','backspace','up','down','left','right','select all','copy','paste','undo'].includes(c.key))return {action:c.action,key:c.key};
 throw Error('Unsupported app control or invalid text');
}
const BROWSER_IDS={default:null,safari:'com.apple.Safari',chrome:'com.google.Chrome',edge:'com.microsoft.edgemac',firefox:'org.mozilla.firefox',brave:'com.brave.Browser',arc:'company.thebrowser.Browser',dia:'company.thebrowser.dia'};
function validateWeb(c){
 if(!c||!Object.hasOwn(BROWSER_IDS,c.browser)||!['visit','search'].includes(c.action))throw Error('Invalid browser request');
 let url;
 if(c.action==='search'){
  const engines={google:'https://www.google.com/search?q=',youtube:'https://www.youtube.com/results?search_query=',duckduckgo:'https://duckduckgo.com/?q='};
  if(typeof c.query!=='string'||!c.query.trim()||c.query.length>500||!Object.hasOwn(engines,c.engine))throw Error('Invalid search request');
  url=engines[c.engine]+encodeURIComponent(c.query.trim());
 }else url=c.url;
 if(typeof url!=='string'||url.length>2000||!require('./security.cjs').safeExternal(url))throw Error('Only web addresses without embedded passwords can be opened');
 return {action:'browse',url,bundle:BROWSER_IDS[c.browser]||''};
}
let lastCPU;
async function telemetry(){
 const cpus=os.cpus(),sums=cpus.reduce((s,c)=>{s.idle+=c.times.idle;s.total+=Object.values(c.times).reduce((a,b)=>a+b,0);return s},{idle:0,total:0});
 const cpu=lastCPU&&sums.total>lastCPU.total?Math.round(100*(1-(sums.idle-lastCPU.idle)/(sums.total-lastCPU.total))):null;lastCPU=sums;
 let battery=null,charging=null;
 try{const {stdout}=await exec('/usr/bin/pmset',['-g','batt'],{timeout:2000});const match=stdout.match(/(\d+)%;/);if(match){battery=Number(match[1]);charging=stdout.includes("'AC Power'");}}catch{}
 return {cpu,memoryUsed:os.totalmem()-os.freemem(),memoryTotal:os.totalmem(),uptime:os.uptime(),chip:cpus[0]?.model||os.arch(),cores:cpus.length,battery,charging,at:new Date().toISOString()};
}
async function control(command,native){
 const c=validateControl(command);
 if(c.action==='volume'||c.action==='soundMute'){
  const script=c.action==='volume'?`set volume output volume ${c.value}`:`set volume output muted ${c.enabled?'true':'false'}`;
  await exec('/usr/bin/osascript',['-e',script],{timeout:5000});
  return {ok:true,message:c.action==='volume'?`Volume set to ${c.value} percent.`:c.enabled?'Speakers muted.':'Speakers unmuted.'};
 }
 return native(c);
}
module.exports={validateControl,validateWeb,validateUI,telemetry,control};
