export const FOCUS_SEATS = [
  { x: 24, y: 46 }, { x: 50, y: 46 }, { x: 76, y: 46 },
  { x: 24, y: 69 }, { x: 50, y: 69 }, { x: 76, y: 69 },
] as const;

export function occupiedFocusSeat(seat: { x: number; y: number }, people: { x: number; y: number; seated?: boolean; isMe?: boolean }[]) {
  return people.some(person => !person.isMe && person.seated && Math.hypot(person.x - seat.x, person.y - seat.y) < 12);
}

export function clampRoomPosition(position: { x: number; y: number }) {
  return {
    x: Math.min(93, Math.max(7, Number.isFinite(position.x) ? position.x : 50)),
    y: Math.min(77, Math.max(28, Number.isFinite(position.y) ? position.y : 62)),
  };
}

export function nearestAvailableFocusSeat(position: { x: number; y: number }, people: { x: number; y: number; seated?: boolean; isMe?: boolean }[]) {
  return [...FOCUS_SEATS].filter(seat => !occupiedFocusSeat(seat, people))
    .sort((a, b) => Math.hypot(a.x - position.x, a.y - position.y) - Math.hypot(b.x - position.x, b.y - position.y))[0];
}

export type RoomPosition = { x: number; y: number };
const intersectsDesk = (p: RoomPosition, s: RoomPosition, facingRows: boolean) => {
  const offset = (p.y - s.y) * (facingRows && s.y === 69 ? -1 : 1);
  return Math.abs(s.x-p.x)<11 && offset>1 && offset<13;
};
const walkable = (p: RoomPosition, facingRows = false) => !FOCUS_SEATS.some(s => intersectsDesk(p,s,facingRows));
export function safeFloorPosition(position: RoomPosition, facingRows = false): RoomPosition {
  const p=clampRoomPosition(position);
  if(walkable(p,facingRows))return p;
  const desk=FOCUS_SEATS.find(s=>intersectsDesk(p,s,facingRows))!;
  return {x:p.x,y:desk.y};
}

// Route on the same floor coordinates used by the furniture, leaving aisles clear.
export function planFocusWalk(from: RoomPosition, to: RoomPosition, facingRows = false): RoomPosition[] {
  const start=safeFloorPosition(from,facingRows), end=safeFloorPosition(to,facingRows);
  const a={x:Math.round(start.x),y:Math.round(start.y)}, b={x:Math.round(end.x),y:Math.round(end.y)};
  const key=(p:RoomPosition)=>`${p.x},${p.y}`;
  const queue=[a], previous=new Map<string,RoomPosition|null>([[key(a),null]]);
  for(let i=0;i<queue.length;i++){
    const p=queue[i]; if(key(p)===key(b))break;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next={x:p.x+dx,y:p.y+dy};
      if(next.x<7||next.x>93||next.y<28||next.y>77||!walkable(next,facingRows)||previous.has(key(next)))continue;
      previous.set(key(next),p);queue.push(next);
    }
  }
  if(!previous.has(key(b)))return [start];
  const reversed:RoomPosition[]=[];let cursor:RoomPosition|null=b;
  while(cursor){reversed.push(cursor);cursor=previous.get(key(cursor))||null;}
  const path=reversed.reverse(), corners=[start];
  for(let i=1;i<path.length-1;i++)if((path[i].x-path[i-1].x)!==(path[i+1].x-path[i].x)||(path[i].y-path[i-1].y)!==(path[i+1].y-path[i].y))corners.push(path[i]);
  corners.push(end);return corners;
}
