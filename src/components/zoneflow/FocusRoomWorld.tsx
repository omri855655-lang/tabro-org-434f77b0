import { useId, useLayoutEffect, useRef, useState } from 'react';
import { FOCUS_SEATS, planFocusWalk } from '@/lib/focusRoom';
import type { FocusRoomParticipant, FocusRoomScene } from './FocusRoomInterior';

const PALETTES = {
  library: { wall: '#e7d7b8', trim: '#385a4b', floor: '#c5a07a', wood: '#b88253', edge: '#775037', sky: '#b9d4d0' },
  cafe: { wall: '#f0d9c8', trim: '#8a5443', floor: '#d3b391', wood: '#c8996b', edge: '#835540', sky: '#c1d3dc' },
  office: { wall: '#dce9df', trim: '#356a65', floor: '#c2b8a0', wood: '#c59e72', edge: '#7e674b', sky: '#badbdf' },
  plane: { wall: '#dce7ef', trim: '#466b87', floor: '#7f98ac', wood: '#d6c5ab', edge: '#8e816f', sky: '#a2d6ed' },
};
const AVATARS = [
  ['#efb78f', '#302829', '#71b7b3'], ['#d99b76', '#653b28', '#df998c'],
  ['#8f5e43', '#2f2b2d', '#dfb35c'], ['#f3c8a4', '#9c5738', '#91ac72'],
  ['#bb805b', '#322a27', '#b1a2cc'], ['#e8ac83', '#bd8c40', '#83a7d0'],
  ['#79513c', '#292b32', '#afbf74'], ['#deb08e', '#743f36', '#dba7ba'],
];

function RoomPlant({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <ellipse cy="17" rx="32" ry="10" fill="#283f35" opacity=".15" />
    <path d="M-24-17H24L18 20Q0 31-18 20Z" fill="#b87c59" /><ellipse cy="-17" rx="24" ry="8" fill="#d5a580" />
    <path d="M0-15V-85M0-32-25-69M0-43 25-83" stroke="#3e7153" strokeWidth="5" fill="none" />
    <ellipse cx="-19" cy="-65" rx="12" ry="25" transform="rotate(-38 -19 -65)" fill="#65936e" />
    <ellipse cx="22" cy="-76" rx="13" ry="27" transform="rotate(35 22 -76)" fill="#4b805d" /><ellipse cy="-91" rx="13" ry="28" fill="#7aa47b" />
  </g>;
}

function RoomAvatar({ person, walking }: { person: FocusRoomParticipant; walking: boolean }) {
  const root=useRef<SVGGElement>(null);
  const position=useRef({x:person.x,y:person.y});
  const [travelling,setTravelling]=useState(false);
  useLayoutEffect(()=>{
    const points=planFocusWalk(position.current,{x:person.x,y:person.y});
    const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,(p.y-points[i].y)*.7));
    const total=lengths.reduce((a,b)=>a+b,0),duration=Math.max(250,Math.min(3500,total*30));
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame=0;const started=performance.now();
    const draw=(p:{x:number;y:number})=>{position.current=p;if(root.current)root.current.style.transform=`translate(${p.x*10}px, ${p.y*7}px)`;};
    if(total<.1||reduced){draw(points[points.length-1]);setTravelling(false);return;}
    setTravelling(true);draw(points[0]);
    const tick=(now:number)=>{
      const progress=Math.min(1,(now-started)/duration);let distance=progress*total,index=0;
      while(index<lengths.length-1&&distance>lengths[index])distance-=lengths[index++];
      const ratio=lengths[index]?distance/lengths[index]:1,a=points[index],b=points[index+1];
      draw({x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio});
      if(root.current)root.current.dataset.facing=b.x<a.x?'left':'right';
      if(progress<1)frame=requestAnimationFrame(tick);else setTravelling(false);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[person.x,person.y]);
  const seated=person.seated&&!travelling;
  const seed = [...person.userId].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  const variant = Number.isInteger(person.avatarStyle) && person.avatarStyle! >= 0 ? person.avatarStyle! : seed;
  const [skin, hair, shirt] = AVATARS[variant % AVATARS.length];
  return <g ref={root} className={`focus-world-person ${travelling || walking && person.isMe ? 'is-walking' : ''} ${seated ? 'is-seated' : ''}`}
    data-participant={person.userId} style={{ transform: `translate(${person.x * 10}px, ${person.y * 7}px)` }}>
    <title>{person.displayName}</title>
    <ellipse cy="8" rx="34" ry="10" fill="#263b33" opacity=".18" />
    {person.isMe && <ellipse cy="7" rx="40" ry="15" fill="none" stroke="#288579" strokeWidth="3" opacity=".6" />}
    <g className="focus-world-body focus-world-illustrated">
      <path className="focus-world-leg-left" d={seated ? 'M-15-5-22 12H-5V-3' : 'M-17-17-19 4H-4V-15'} fill="#344451" />
      <path className="focus-world-leg-right" d={seated ? 'M15-5 22 12H5V-3' : 'M17-17 19 4H4V-15'} fill="#344451" />
      <path d="M-30-51Q0-69 30-51L26-10Q0 0-26-10Z" fill={shirt} stroke="#ffffff" strokeOpacity=".25" strokeWidth="2" />
      <path className="focus-world-arm-left" d="M-28-49Q-40-33-30-14" stroke={skin} strokeWidth="12" strokeLinecap="round" fill="none" />
      <path className="focus-world-arm-right" d="M28-49Q40-33 30-14" stroke={skin} strokeWidth="12" strokeLinecap="round" fill="none" />
      <ellipse cy="-82" rx="35" ry="39" fill={skin} />
      <ellipse cx="-34" cy="-76" rx="5" ry="9" fill={skin} /><ellipse cx="34" cy="-76" rx="5" ry="9" fill={skin} />
      {variant % 3 === 0 ? <path d="M-35-88Q-40-127 0-124Q41-125 35-84L21-105Q-9-90-25-104Z" fill={hair} /> :
        variant % 3 === 1 ? <path d="M-34-83Q-45-121-9-124Q31-132 37-90L30-68 24-98Q-13-83-30-104Z" fill={hair} /> :
          <path d="M-34-90Q-28-132 13-124L37-102 30-83 20-103Q-3-93-26-106Z" fill={hair} />}
      <g className="focus-world-eyes"><ellipse cx="-12" cy="-79" rx="4" ry="5" fill="#332e2a" /><ellipse cx="12" cy="-79" rx="4" ry="5" fill="#332e2a" /></g>
      {variant % 4 === 0 && <g fill="none" stroke="#594b44" strokeWidth="2.5"><circle cx="-12" cy="-79" r="10" /><circle cx="12" cy="-79" r="10" /><path d="M-2-79H2" /></g>}
      <path d="M-6-64Q0-60 6-64" stroke="#955e4d" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="-23" cy="-68" rx="6" ry="3" fill="#cf8174" opacity=".3" /><ellipse cx="23" cy="-68" rx="6" ry="3" fill="#cf8174" opacity=".3" />
      {person.status === 'focusing' && <g fill="none" stroke="#37505a" strokeWidth="5"><path d="M-34-85Q-32-131 0-131Q34-128 34-85" /><path d="M-35-88V-72M35-88V-72" strokeWidth="9" strokeLinecap="round" /></g>}
    </g>
    <g className="focus-world-pixel" shapeRendering="crispEdges">
      <path d="M-20-20H-4V6H-24V-2H-20ZM4-20H20V-2H24V6H4Z" fill="#344451"/>
      <path d="M-28-58H28V-14H-28Z" fill={shirt}/><path d="M-40-54H-28V-20H-40ZM28-54H40V-20H28Z" fill={skin}/>
      <path d="M-28-114H28V-104H36V-66H28V-58H-28V-66H-36V-104H-28Z" fill={skin}/>
      <path d="M-28-120H28V-110H36V-92H24V-102H0V-94H-28V-80H-36V-110H-28Z" fill={hair}/>
      <path d="M-18-87H-10V-77H-18ZM10-87H18V-77H10Z" fill="#302c30"/><path d="M-7-68H7V-64H-7Z" fill="#995e4d"/>
      {person.status==='focusing'&&<path d="M-40-94V-114H-32V-126H32V-114H40V-94M-42-94V-72M42-94V-72" fill="none" stroke="#3f5962" strokeWidth="8"/>}
    </g>
    <g transform="translate(0 -151)" pointerEvents="none"><rect x="-66" y="-13" width="132" height="25" rx="12" fill="#fffaf0" fillOpacity=".95" /><text textAnchor="middle" y="4" fontSize="13" fontWeight="600" fill="#38534b">{person.displayName.length > 16 ? `${person.displayName.slice(0, 15)}…` : person.displayName}</text>{person.status === 'focusing' && <circle cx="-54" cy="-1" r="3" fill="#3c9a78" />}</g>
  </g>;
}

function DeskSurface({ scene, person, selected }: { scene: FocusRoomScene; person?: FocusRoomParticipant; selected: boolean }) {
  const colors = PALETTES[scene];
  return <g data-furniture="desk">
    <ellipse cy="89" rx="91" ry="17" fill="#443327" opacity=".13" />
    <path d="M-72 40-68 91H-57L-56 40M62 40 58 91H70L78 40" fill={colors.edge} />
    <path d="M-91 12-76-6H76L91 12V48Q0 61-91 48Z" fill={colors.edge} />
    <path d="M-91 12-76-6H76L91 12V38Q0 49-91 38Z" fill={colors.wood} stroke={selected ? '#2f8d7c' : '#ecd0a7'} strokeWidth={selected ? 4 : 2} />
    <path d="M-81 19Q0 30 81 19M-78 30Q0 40 78 30" stroke={colors.edge} strokeOpacity=".2" fill="none" />
    <g transform="translate(-62 4)"><ellipse rx="15" ry="5" fill="#755740" /><path d="M0-3V-35L13-48" fill="none" stroke="#49665b" strokeWidth="5" /><path d="M2-48Q22-67 33-45Z" fill="#49665b" /><ellipse cx="19" cy="-44" rx="14" ry="4" fill="#f4db9e" /></g>
    {person?.activity === 'book' ? <g data-activity="book" className={person.status === 'focusing' ? 'focus-world-reading' : ''}>
      <path d="M-37 7Q-15-4 0 7Q19-4 40 7L35 32Q15 21 0 30Q-17 22-38 31Z" fill="#fff7de" stroke="#c1a274" strokeWidth="2" />
      <path d="M0 8V29M-29 12-8 13M-30 19-8 20M9 13 30 12M9 20 29 19" stroke="#cbb990" strokeWidth="2" />
    </g> : person?.activity === 'notebook' ? <g data-activity="notebook">
      <path d="M-29 2 26-2 32 31-24 35Z" fill="#fff9e8" stroke="#c7b696" strokeWidth="2" />
      <path d="M-16 8 18 6M-15 16 19 14M-14 24 20 22" stroke="#c0cdd2" strokeWidth="2" />
      <path d="M35 0 11 24" stroke="#cc8458" strokeWidth="5" className={person.status === 'focusing' ? 'focus-world-writing' : ''} />
    </g> : person ? <g data-activity="computer">
      <path d="M-35-34H32L38 13H-31Z" fill="#3c5157" stroke="#d2dfda" strokeWidth="2" /><path d="M-29-28H26L30 7H-25Z" fill={person.status === 'focusing' ? '#a8d3c2' : '#8eaaa7'} />
      <path d="M-31 14H38L47 28H-41Z" fill="#bdcac6" stroke="#81938f" strokeWidth="1.5" /><path d="M-22-18H16M-20-10H7" stroke="#e0eee2" strokeWidth="3" />
    </g> : <g><path d="M-22 7 17 2 22 25-17 30Z" fill="#738a75" /><path d="M-16 30 24 23" stroke="#f0e4c7" strokeWidth="3" /></g>}
    <g transform="translate(62 12)"><ellipse cy="3" rx="10" ry="5" fill="#775440" opacity=".25" /><path d="M-8-10H8L6 6Q0 12-6 6Z" fill="#fff4dc" /><path d="M8-7Q21-8 17 1Q14 5 7 1" fill="none" stroke="#fff4dc" strokeWidth="4" /></g>
  </g>;
}

export function FocusRoomWorld({ scene, participants, walking, deskLabel, selectedSeat }: {
  scene: FocusRoomScene; participants: FocusRoomParticipant[]; walking: boolean; deskLabel: string; selectedSeat: number;
}) {
  const id = useId().replace(/:/g, '');
  const colors = PALETTES[scene];
  // Shared scene coordinates keep the avatar behind the desk, not above a photograph.
  const layers = [
    ...FOCUS_SEATS.map((seat, index) => ({ key: `desk-${index}`, depth: seat.y + 8, element: <g data-seat-index={index} transform={`translate(${seat.x * 10} ${seat.y * 7})`}>
      <DeskSurface scene={scene} selected={selectedSeat === index} person={participants.find(person => person.seated && Math.hypot(person.x - seat.x, person.y - seat.y) < 12)} />
      <g transform="translate(0 71)"><rect x="-17" y="-10" width="34" height="22" rx="10" fill="#fffaee" opacity=".9" /><text y="5" textAnchor="middle" fontSize="14" fill="#624f3f">{index + 1}</text></g>
    </g> })),
    ...participants.map(person => ({ key: person.userId, depth: person.y, element: <RoomAvatar person={person} walking={walking} /> })),
  ].sort((a, b) => a.depth - b.depth);
  return <svg className="focus-world-svg block h-auto w-full" viewBox="0 0 1000 700" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}wall`} x2="0" y2="1"><stop stopColor={colors.wall} /><stop offset="1" stopColor="#f1e8d5" /></linearGradient>
      <linearGradient id={`${id}floor`} x2="0" y2="1"><stop stopColor={colors.floor} /><stop offset="1" stopColor="#ead1a8" /></linearGradient>
      <linearGradient id={`${id}window`} x2="0" y2="1"><stop stopColor={colors.sky} /><stop offset="1" stopColor="#e7ecce" /></linearGradient>
      <radialGradient id={`${id}sun`}><stop stopColor="#fff6cb" stopOpacity=".7" /><stop offset="1" stopColor="#fff6cb" stopOpacity="0" /></radialGradient>
    </defs>
    <rect width="1000" height="700" fill={`url(#${id}wall)`} /><path d="M0 220H1000V700H0Z" fill={`url(#${id}floor)`} /><path d="M0 215H1000V232H0Z" fill={colors.trim} />
    {[0, 1, 2, 3, 4, 5, 6, 7].map(row => <path key={row} d={`M0 ${255 + row * 65}H1000`} stroke={colors.edge} strokeOpacity=".12" />)}
    {[-200, 50, 300, 550, 800, 1050, 1300].map(x => <path key={x} d={`M${500 + (x - 500) * .6} 230 ${x} 700`} stroke={colors.edge} strokeOpacity=".12" />)}
    <path d="M52 27H209Q226 27 226 44V187H35V44Q35 27 52 27Z" fill={colors.trim} /><path d="M51 40H210V174H51Z" fill={`url(#${id}window)`} />
    <path d="M51 143Q96 92 132 135Q167 93 210 121V174H51Z" fill="#92b99f" opacity=".65" /><path d="M51 111H210M130 40V174" stroke={colors.trim} strokeWidth="7" /><rect x="24" y="181" width="212" height="14" rx="5" fill="#b08c67" />
    {scene === 'plane' ? [370, 580, 790].map(x => <g key={x}><rect x={x} y="42" width="124" height="140" rx="52" fill={colors.trim} /><rect x={x + 10} y="52" width="104" height="120" rx="45" fill={`url(#${id}window)`} /><path d={`M${x + 12} 129Q${x + 44} 106 ${x + 74} 125Q${x + 94} 107 ${x + 111} 125V141H${x + 12}Z`} fill="#f8fcff" /></g>) :
      <g><rect x="323" y="28" width="490" height="174" rx="10" fill={colors.trim} />
        {[0, 1].map(row => <g key={row}>{Array.from({ length: 23 }, (_, index) => <g key={index} transform={`translate(${338 + index * 20} ${47 + row * 75})`}><rect width={12 + index % 4} height={48 + index % 3 * 5} y={10 - index % 3 * 5} rx="2" fill={['#d8ac73', '#9eb6a0', '#d5b5a4', '#758d91', '#d8c9a3'][index % 5]} /><path d="M2 17H10M2 45H10" stroke="#f4e7c8" strokeOpacity=".6" strokeWidth="2" /></g>)}<path d={`M332 ${110 + row * 75}H804`} stroke="#b59c76" strokeWidth="7" /></g>)}
      </g>}
    <circle cx="903" cy="81" r="37" fill="#faf0d9" stroke={colors.trim} strokeWidth="6" /><path d="M903 56V81L920 90" stroke={colors.trim} strokeWidth="4" strokeLinecap="round" fill="none" />
    <ellipse cx="380" cy="364" rx="310" ry="145" fill={`url(#${id}sun)`} /><path d="M120 278H880L947 651H53Z" fill="#eee5cd" stroke="#b1a78d" strokeWidth="3" opacity=".7" /><path d="M137 291H863L920 632H80Z" fill="none" stroke="#adab8b" strokeWidth="3" strokeDasharray="6 8" opacity=".6" />
    <RoomPlant x={71} y={236} /><RoomPlant x={924} y={231} />
    {FOCUS_SEATS.map((seat, index) => <g key={index} data-furniture="chair" transform={`translate(${seat.x * 10} ${seat.y * 7})`}>
      <title>{`${deskLabel} ${index + 1}`}</title><path d="M-26 9-24 43M26 9 24 43" stroke={colors.edge} strokeWidth="7" /><rect x="-36" y="-59" width="72" height="68" rx="21" fill={colors.trim} stroke="#e8d4b0" strokeWidth="3" /><path d="M-32-6Q0-18 32-6V11Q0 24-32 11Z" fill="#a5b5a0" />
    </g>)}
    {layers.map(layer => <g key={layer.key}>{layer.element}</g>)}
    <RoomPlant x={55} y={649} /><RoomPlant x={947} y={648} />
  </svg>;
}
