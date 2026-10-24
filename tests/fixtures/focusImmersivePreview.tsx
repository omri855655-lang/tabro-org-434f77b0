import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../src/hooks/useLanguage';
import { FocusRoomInterior, type FocusActivity, type FocusRoomParticipant } from '../../src/components/zoneflow/FocusRoomInterior';
import '../../src/index.css';

function Preview() {
  const [position, setPosition] = useState({x:50,y:74});
  const [seated,setSeated] = useState(false), [active,setActive] = useState(false);
  const [activity,setActivity] = useState<FocusActivity>('book');
  const [peer,setPeer] = useState(true);
  // ?elapsed=N starts the fixture N seconds into the session so takeoff/climb can be inspected without waiting.
  const [duration,setDuration] = useState(25), [seconds,setSeconds] = useState(() => 1500 - Math.min(1500, Math.max(0, Number(new URLSearchParams(location.search).get('elapsed')) || 0)));
  useEffect(() => { if (!active) return; const interval = setInterval(() => setSeconds(value => Math.max(0,value - 1)),1000); return () => clearInterval(interval); },[active]);
  const participants:FocusRoomParticipant[] = [
    { userId:'me',displayName:'You / אני',...position,isMe:true,avatarStyle:1,status:active?'focusing':'setting-up',seated,activity,durationMinutes:duration },
    ...(peer ? [{userId:'fictional-reader',displayName:'Demo reader',x:24,y:46,status:'focusing',seated:true,activity:'book',avatarStyle:2},{userId:'fictional-writer',displayName:'Demo writer',x:50,y:46,status:'focusing',seated:true,activity:'notebook',avatarStyle:3},{userId:'fictional-typist',displayName:'Demo typist',x:76,y:46,status:'focusing',seated:true,activity:'computer',avatarStyle:5}] as FocusRoomParticipant[] : []),
  ];
  return <main className="mx-auto max-w-6xl p-3"><p className="mb-3">Local UI fixture. Fictional peers only, no account or cloud writes.</p><button className="mb-3 rounded border p-2" onClick={()=>setPeer(value=>!value)}>Toggle fictional peers</button><FocusRoomInterior scene="library" name="ספריית הריכוז" topic="לומדים יחד, בקצב שלך" participants={participants} timer={`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`} active={active} activity={activity} onActivityChange={setActivity} onToggle={()=>setActive(value=>!value)} onReset={()=>{setActive(false);setSeconds(duration*60);}} onDurationChange={minutes=>{setDuration(minutes);setSeconds(minutes*60);}} onMove={p=>{setSeated(false);setPosition(p);}} onSelectSeat={p=>{setPosition(p);setSeated(true);}}/></main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><Preview/></LanguageProvider>);
