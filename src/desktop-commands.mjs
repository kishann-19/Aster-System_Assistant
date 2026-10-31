// Explicit controls stay outside the language model's action allowlist.
export function parseDesktop(raw) {
  const text = raw.replace(/[.!?]+$/, '').trim();
  let m;
  if (/^(?:take |capture )?(?:a |the )?(?:screenshot|screen shot|ss)$/i.test(text)) return {type:'capture',action:'screenshot'};
  if (/^(?:start (?:a )?(?:screen )?recording|record (?:my |the )?screen|screen record)$/i.test(text)) return {type:'capture',action:'recordStart'};
  if (/^(?:stop|finish|end) (?:the |my )?(?:screen )?recording$/i.test(text)) return {type:'capture',action:'recordStop'};
  if (/^(?:(?:open|show) (?:my |the |that |last )?(?:captures|screenshots?|recordings?)(?: (?:you took|you recorded))?)$/i.test(text)) return {type:'capture',action:'openCaptures'};
  if (/^lock (?:my |the )?(?:screen|mac|computer|laptop)$/i.test(text)) return {type:'shortcut',operation:'lock'};
  if ((m=text.match(/^(?:switch to |go to )?(next|previous) desktop$/i))) return {type:'shortcut',operation:m[1].toLowerCase()+' desktop'};
  if ((m=text.match(/^(zoom in|zoom out|reset zoom|show desktop|mission control)$/i))) return {type:'shortcut',operation:m[1].toLowerCase()};
  if (/^(?:start|enable) (?:continuous )?dictation(?: mode)?$/i.test(text)) return {type:'dictation',enabled:true};
  if (/^(?:stop|end|disable) dictation(?: mode)?$/i.test(text)) return {type:'dictation',enabled:false};
  if (/^(?:enable|start|turn on) (?:gestures|hand control|camera gestures)$/i.test(text)) return {type:'gestures',enabled:true};
  if (/^(?:enable|start) (?:mac gestures|system gestures|mac pointer|gesture control of my mac)$/i.test(text)) return {type:'gestures',enabled:true,system:true};
  if (/^(?:show|open) (?:setup|permissions|permission setup)$/i.test(text)) return {type:'setup'};
  if ((m=raw.match(/^(?:draft|write|compose|send)?\s*(?:an? )?(?:email|mail) to (.+?) subject (.+?) (?:saying|body) ([\s\S]+)$/i))) return {type:'communication',kind:'email',target:m[1],subject:m[2],text:m[3]};
  if ((m=raw.match(/^(?:draft|write|compose) (?:an? )?(?:email|mail) to (.+?) about ([\s\S]+)$/i))) return {type:'emailDraft',target:m[1],brief:m[2]};
  return null;
}

export function dictationInput(input) {
  // Command prefix is the deliberate escape hatch; ordinary words remain text.
  if (/^(?:aster[, ]+)?(?:stop|end) dictation[.!?]?$/i.test(input.trim())) return {command:'Stop dictation'};
  const command=input.match(/^(?:aster[, ]+)?command[, ]+([\s\S]+)$/i);
  if(command) return {command:command[1]};
  return {text:input.trim()};
}
