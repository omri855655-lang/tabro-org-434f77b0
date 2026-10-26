import { useEffect, useState } from 'react';
import { Headphones, Square } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { zoneflowExperienceCopy } from '@/lib/zoneflowExperienceCopy';
import { getActiveZoneFlowAudio, getZoneFlowMixEnabled, setZoneFlowMixEnabled, subscribeToZoneFlowAudioState } from './zoneflowAudioState';

export function ZoneFlowSoundMix() {
  const {lang,dir}=useLanguage(),copy=zoneflowExperienceCopy[lang];
  const [mix,setMix]=useState(getZoneFlowMixEnabled),[sounds,setSounds]=useState(getActiveZoneFlowAudio);
  useEffect(()=>subscribeToZoneFlowAudioState(()=>{setSounds(getActiveZoneFlowAudio());setMix(getZoneFlowMixEnabled());}),[]);
  return <details className="mb-4 rounded-2xl border bg-card text-card-foreground p-3" dir={dir}>
    <summary className="cursor-pointer text-sm font-medium"><Headphones className="me-2 inline h-4 w-4"/>{copy.sound}<span className="ms-3 text-xs text-muted-foreground">{sounds.map(s=>s.name).join(' + ')||copy.silent}</span></summary>
    <div className="mt-3 flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mix} onChange={e=>{setZoneFlowMixEnabled(e.target.checked);setMix(getZoneFlowMixEnabled());}}/>{copy.mix}</label><button type="button" className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs disabled:opacity-40" disabled={!sounds.length} onClick={()=>sounds.forEach(s=>s.stop())}><Square className="h-3 w-3"/>{copy.stop}</button></div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy.mixHint}</p>
  </details>;
}
