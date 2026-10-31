export function classifyHand(points) {
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const scale=Math.max(.03,dist(points[0],points[9]));
  const indexUp=points[8].y<points[6].y, middleUp=points[12].y<points[10].y;
  const ringUp=points[16].y<points[14].y, pinkyUp=points[20].y<points[18].y;
  const pinch=dist(points[4],points[8])/scale;
  // A curled index is normal during a deliberate pinch. A fist instead has
  // all four non-thumb fingers folded, even if thumb/index tips are touching.
  const paused=!indexUp&&!middleUp&&!ringUp&&!pinkyUp;
  // Full palm spread is a separate mode. A small pinch release can still tap
  // while the other fingers remain extended.
  const open=indexUp&&middleUp&&ringUp&&pinkyUp&&pinch>.85;
  return {x:Math.max(0,Math.min(1,(1-points[8].x-.12)/.76)),y:Math.max(0,Math.min(1,(points[8].y-.15)/.65)),palmX:1-points[9].x,palmY:points[9].y,open,pinch,scroll:indexUp&&middleUp&&!ringUp,paused};
}
