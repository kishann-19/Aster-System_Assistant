import {parseDesktop} from './desktop-commands.mjs';
import {parseWeb} from './web-commands.mjs';
// Voice grammar shared by the renderer and the model's constrained action router.
export const SETTINGS_PANES=['sound','displays','wifi','bluetooth','accessibility','voice control','privacy','notifications','battery','keyboard','trackpad','general','screen recording'];
export function parseControl(input){
 const raw=input.trim().replace(/^(?:hey\s+)?aster\b[,\s:]*/i,'').replace(/^(?:can you|could you|would you|please)\s+/i,'').trim();const text=raw.replace(/[.!?]+$/,'').trim();let m;
 const extra=parseDesktop(raw);if(extra)return extra;
 if((m=raw.match(/^(?:type|dictate|write text)\s+([\s\S]+)$/i)))return {type:'ui',action:'uiType',text:m[1].slice(0,2000)};
 if(/^(?:show|list|read) (?:screen |app |available )?controls$/i.test(text))return {type:'ui',action:'uiControls'};
 if((m=text.match(/^(?:click|activate|focus field)\s+(?:(?:control|number)\s+)?(.+)$/i)))return /^\d+$/.test(m[1])?{type:'ui',action:'uiClick',number:Number(m[1])}:{type:'ui',action:'uiClick',label:m[1]};
 if((m=text.match(/^press (enter|return|tab|escape|backspace|up|down|left|right|select all|copy|paste|undo)$/i)))return {type:'ui',action:'uiKey',key:m[1].toLowerCase()==='return'?'enter':m[1].toLowerCase()};
 if(/^(?:enable computer control|allow computer control|review accessibility permission)$/i.test(text))return {type:'accessibility'};
 if((m=text.match(/^(?:enable|disable|turn on|turn off) (?:clap|snap|sound) wake$/i)))return {type:'soundWake',enabled:/^(enable|turn on)/i.test(text)};
 if((m=text.match(/^set wake (?:mode|sound) to (single|double)$/i)))return {type:'wakeMode',mode:m[1].toLowerCase()};
 if((m=text.match(/^set wake sensitivity to (high|medium|low)$/i)))return {type:'wakeThreshold',threshold:{high:.2,medium:.45,low:.7}[m[1].toLowerCase()]};
 if((m=text.match(/^(?:call|phone|dial)\s+(.+)$/i)))return {type:'communication',kind:'call',target:m[1],text:''};
 if((m=raw.match(/^(?:whatsapp|(?:send |draft )?(?:a )?whatsapp message to)\s+(.+?)\s+(?:saying|that says)\s+([\s\S]+)$/i)))return {type:'communication',kind:'whatsapp',target:m[1],text:m[2].slice(0,2000)};
 if((m=text.match(/^open (?:a )?(?:whatsapp chat with (.+)|chat with (.+) on whatsapp)$/i)))return {type:'communication',kind:'whatsapp',target:m[1]||m[2],text:''};
 if((m=text.match(/^choose contact (\d{1,2})$/i)))return {type:'chooseContact',number:Number(m[1])};
 if((m=text.match(/^confirm (call|whatsapp|email)$/i)))return {type:'confirmCommunication',kind:m[1].toLowerCase()};
 if(/^(?:cancel|cancel (?:call|whatsapp|email|request))$/i.test(text))return {type:'cancelCommunication'};
 const web=parseWeb(text);if(web&&!/^(?:open|launch) (?:gmail|whatsapp|browser)$/i.test(text))return web;
 if(/^(?:show aster|bring (?:up|back) aster)$/i.test(text))return {type:'navigate',page:'dashboard'};
 if(/^(?:help|what can you do|show (?:voice )?commands|voice commands)$/i.test(text))return {type:'help'};
 if(/^(?:go to sleep|stand by|standby|sleep mode)$/i.test(text))return {type:'standby'};
 if(/^(?:wake up|I'm back|resume listening)$/i.test(text))return {type:'wake'};
 if(/^(?:close (?:this |the )?(?:dialog|settings|panel)|dismiss)$/i.test(text))return {type:'dismiss'};
 if((m=text.match(/^(?:show|go to|open) (?:my |the )?(dashboard|overview|tasks|conversation|connections|system|models|settings|notifications|reminders list)$/i)))return {type:'navigate',page:m[1].toLowerCase()};
 if((m=text.match(/^(?:enable|turn on|disable|turn off) hands[ -]?free(?: mode)?$/i)))return {type:'handsfree',enabled:/^(enable|turn on)/i.test(text)};
 if((m=text.match(/^(?:change|set|switch) (?:your |the )?voice to (heart|bella|michael|emma|george)$/i)))return {type:'voice',name:m[1].toLowerCase()};
 if((m=text.match(/^(?:speak|talk) (slower|faster|normally)$/i)))return {type:'pace',value:{slower:.42,faster:.54,normally:.48}[m[1].toLowerCase()]};
 if((m=text.match(/^(?:use|switch to) (?:model )?(.+?)(?: model)$/i)))return {type:'model',name:m[1].toLowerCase()};
 if(/^(?:list|show|what are) (?:my |the |available )?models$/i.test(text))return {type:'listModels'};
 if(/^(?:system status|status report|how is my mac|battery status)$/i.test(text))return {type:'telemetry'};
 if((m=text.match(/^(?:read|list) (?:my )?(tasks|reminders|notifications)$/i)))return {type:'read',kind:m[1].toLowerCase()};
 if((m=text.match(/^(?:connect|refresh|sync|read) (?:my |apple )?(calendar|mail|reminders)$/i)))return {type:'sync',kind:m[1].toLowerCase()};
 if((m=text.match(/^(?:complete|finish) task (.+)$/i)))return {type:'completeNamed',title:m[1]};
 if((m=text.match(/^(?:set |change )?(?:the )?(?:system )?volume (?:to )?(\d{1,3})(?:\s*(?:percent|%))?$/i)))return Number(m[1])<=100?{type:'mac',action:'volume',value:Number(m[1])}:{type:'clarifyReminder',message:'Choose a volume between 0 and 100 percent.'};
 if(/^(?:mute|unmute) (?:the )?(?:sound|speakers|volume)$/i.test(text))return {type:'mac',action:'soundMute',enabled:!/^unmute/i.test(text)};
 if((m=text.match(/^(?:open|show) (?:the )?(.+?) (?:settings|preferences)$/i))){const pane=m[1].toLowerCase().replace('wi-fi','wifi');if(SETTINGS_PANES.includes(pane))return {type:'mac',action:'settings',pane};if(pane==='system')return {type:'mac',action:'settings',pane:'general'};}
 if(/^(?:set up|setup|enable) (?:mac |system )?voice control$/i.test(text))return {type:'mac',action:'settings',pane:'voice control'};
 if((m=text.match(/^(?:open|launch|switch to) (?:app )?([\p{L}\p{N} .+-]{1,70})$/iu))&&!/^(?:mail|gmail|whatsapp|calendar|browser|reminders|calls|facetime)$/i.test(m[1]))return {type:'mac',action:'openApp',name:m[1].replace(/\s+app$/i,'')};
 if((m=text.match(/^(?:browser )?(next tab|previous tab|new tab|go back|go forward|reload page|scroll down|scroll up)$/i)))return {type:'mac',action:'browser',operation:m[1].toLowerCase()};
 return null;
}
export const COMMAND_EXAMPLES=[
 ['WORKSPACE','Show dashboard','Read my tasks','Add task finish the prototype','Focus on finish the prototype','Remind me to stretch in 20 minutes'],
 ['MAC CONTROL','Open Notes','Open YouTube in the browser','Open Chrome and search for Mac tips','Search YouTube for coding tutorials','Open Safari','Set volume to 40 percent','Open Bluetooth settings','System status','Next tab','Scroll down'],
 ['SCREEN & WRITING','Take a screenshot','Start screen recording','Stop recording','Lock my screen','Start dictation','Stop dictation','Write an email to NAME about TOPIC'],
 ['GESTURES','Enable Mac gestures','Stop gestures','Zoom in','Next desktop','Show setup'],
 ['VOICE & MODELS','Change your voice to George','Speak slower','List models','Use Qwen model','Go to sleep','Aster, wake up'],
 ['APPS & DICTATION','Show controls','Click 3','Type I will be there soon','Press Enter','Call followed by a name or number','WhatsApp NAME saying MESSAGE','Go to sleep · clap twice to wake']
];
