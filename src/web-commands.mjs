const SITES={google:'https://www.google.com/',youtube:'https://www.youtube.com/',gmail:'https://mail.google.com/',whatsapp:'https://web.whatsapp.com/',github:'https://github.com/',chatgpt:'https://chatgpt.com/',wikipedia:'https://www.wikipedia.org/',reddit:'https://www.reddit.com/',instagram:'https://www.instagram.com/',facebook:'https://www.facebook.com/',linkedin:'https://www.linkedin.com/',netflix:'https://www.netflix.com/',amazon:'https://www.amazon.com/'};
const BROWSERS={'the browser':'default','a browser':'default','my browser':'default','india browser':'default',browser:'default',safari:'safari',chrome:'chrome','google chrome':'chrome',edge:'edge','microsoft edge':'edge',firefox:'firefox',brave:'brave',arc:'arc',dia:'dia'};
export function parseWeb(input){
 let text=input.replace(/^(?:can you|could you|would you|please)\s+/i,'').replace(/\s+please$/i,'').trim(),m;
 // Apple Speech sometimes renders "in the browser" as "India browser".
 const suffix=/\s+(?:(?:in|on|using|with)\s+(?:the |my |a )?(?:browser|safari|chrome|google chrome|edge|firefox|brave|arc|dia)|india browser)$/i;
 const target=s=>BROWSERS[s.toLowerCase().trim()]||'default';
 const search=(query,browser='default',engine='google')=>({type:'web',action:'search',query:query.trim().slice(0,500),browser,engine});
 if((m=text.match(/^(?:open|launch)\s+(.+?)\s+(?:and|then|and then)\s+(?:search(?:\s+for)?|google|look up)\s+(.+)$/i))&&Object.hasOwn(BROWSERS,m[1].toLowerCase()))return search(m[2],target(m[1]));
 if((m=text.match(/^(?:search|find)\s+(youtube|google|duckduckgo)\s+(?:for\s+)?(.+)$/i)))return search(m[2],'default',m[1].toLowerCase());
 if((m=text.match(/^(?:search(?:\s+(?:the web|the browser))?(?:\s+for)?|google|look up)\s+(.+)$/i))){const ending=m[1].match(suffix);return search(ending?m[1].slice(0,ending.index):m[1],ending?target(ending[0].replace(/^\s*(?:in|on|using|with)\s+/i,'').replace(/^(?:the|my|a)\s+(?!browser)/i,'')):'default');}
 if((m=text.match(/^(?:open|visit|go to)\s+(.+)$/i))){let name=m[1],browser='default';const ending=name.match(suffix);if(ending){name=name.slice(0,ending.index);browser=target(ending[0].replace(/^\s*(?:in|on|using|with)\s+/i,'').replace(/^(?:the|my|a)\s+(?!browser)/i,''));}name=name.replace(/^(?:the )?(?:website|site)\s+/i,'').replace(/\s+(?:website|site)$/i,'').trim();const lower=name.toLowerCase();if(SITES[lower])return {type:'web',action:'visit',url:SITES[lower],browser,label:name};
 const domain=name.replace(/\s+dot\s+/gi,'.').replace(/\s+slash\s+/gi,'/');
 if(/^(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+(?::\d+)?(?:\/[^\s]*)?$/i.test(domain))return {type:'web',action:'visit',url:/^https?:/i.test(domain)?domain:'https://'+domain,browser,label:domain};
 if(Object.hasOwn(BROWSERS,lower)&&BROWSERS[lower]==='default')return {type:'web',action:'visit',url:'https://www.google.com/',browser:target(lower),label:lower};
 }
 return null;
}
