// Temporal gesture state machine. No browser/native side effects, so loss,
// release, double-tap and cooldown behavior can be tested with recorded features.
export function createGestureEngine() {
  let pinch=null, dragging=false, lastTap=null, scroll=null, zoom=null, palm=null;
  let lastSeen=-Infinity, lastStep=-Infinity, cooldown=0, position={x:.5,y:.5};
  function release(events){if(dragging)events.push({...position,kind:'up'});dragging=false;pinch=null;scroll=null;zoom=null;palm=null;}
  return {
    reset(){const events=[];release(events);lastTap=null;return events;},
    step(hands,now){
      const events=[];
      if(!hands.length){if(now-lastSeen>200){release(events);lastTap=null;}return {events,status:'Show your hand'};}
      lastSeen=now;const g=hands[0];position={x:g.x,y:g.y};
      // Fist is a stop gesture, not a pinch. Give it precedence on either
      // tracked hand so entering it cannot click, drag or zoom.
      if(hands.some(h=>h.paused)){release(events);lastTap=null;return {events,status:'Fist · pointer paused'};}
      const two=hands.length===2&&hands.every(h=>h.pinch<.45);
      if(two){
        if(pinch||dragging)release(events);
        scroll=null;palm=null;lastTap=null;
        const distance=Math.hypot(hands[0].palmX-hands[1].palmX,hands[0].palmY-hands[1].palmY);
        if(zoom&&now-lastStep>180&&Math.abs(distance-zoom)>.045){events.push({...position,kind:distance>zoom?'zoomIn':'zoomOut'});zoom=distance;lastStep=now;}
        if(zoom===null)zoom=distance;
        return {events,status:'Two pinches · spread / close to zoom'};
      }
      if(zoom!==null){release(events);cooldown=now+250;}
      if(now<cooldown)return {events,status:'Hold steady'};
      if(g.open){
        // Spreading the palm deliberately switches modes. Do not turn the
        // released pinch into a click before starting a desktop swipe.
        if(pinch||dragging)release(events);
        scroll=null;lastTap=null;
        if(!palm)palm={at:now,x:g.palmX,y:g.palmY};
        if(now-palm.at>250&&now-palm.at<1100&&Math.abs(g.palmY-palm.y)<.15&&Math.abs(g.palmX-palm.x)>.22){
          events.push({...position,kind:g.palmX>palm.x?'desktopPrevious':'desktopNext'});palm=null;cooldown=now+1300;
          return {events,status:'Desktop switch requested'};
        }
        if(now-palm.at>1100)palm={at:now,x:g.palmX,y:g.palmY};
        return {events,status:'Open palm · swipe sideways for desktops'};
      }
      palm=null;
      if(g.pinch<.35||pinch&&g.pinch<.6){
        scroll=null;palm=null;
        if(!pinch)pinch={at:now,x:g.x,y:g.y};
        if(!dragging&&now-pinch.at>=380){dragging=true;events.push({x:pinch.x,y:pinch.y,kind:'down'});lastTap=null;}
        if(dragging)events.push({...position,kind:'drag'});
        return {events,status:dragging?'Pinch held · drag · release to drop':'Pinch · release for tap'};
      }
      if(pinch){
        if(dragging){events.push({...position,kind:'up'});dragging=false;lastTap=null;}
        else if(now-pinch.at<380&&Math.hypot(g.x-pinch.x,g.y-pinch.y)<.12){
          const double=lastTap&&now-lastTap.at<500&&Math.hypot(pinch.x-lastTap.x,pinch.y-lastTap.y)<.09;
          events.push({x:pinch.x,y:pinch.y,kind:double?'doubleClick':'click'});
          lastTap=double?null:{...pinch,at:now};
        }
        pinch=null;
      }
      if(g.scroll){
        if(scroll!==null){const delta=Math.max(-70,Math.min(70,(scroll-g.y)*1300));if(Math.abs(delta)>1)events.push({...position,kind:'scroll',delta});}
        scroll=g.y;lastTap=null;
        return {events,status:'Two fingers · scroll'};
      }
      scroll=null;
      events.push({...position,kind:'move'});
      return {events,status:'Point · move cursor'};
    }
  };
}
