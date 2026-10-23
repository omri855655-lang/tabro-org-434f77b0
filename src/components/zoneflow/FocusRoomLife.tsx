import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { roomLifeCopy } from '@/lib/focusRoomLife';

export function FocusRoomLife({enabled,onChange}:{enabled:boolean;onChange:(value:boolean)=>void}) {
  const {lang}=useLanguage(),copy=roomLifeCopy[lang];
  const [playing,setPlaying]=useState(false),[volume,setVolume]=useState(.12);
  const context=useRef<AudioContext|null>(null),gain=useRef<GainNode|null>(null);
  const stop=()=>{const current=context.current;context.current=null;gain.current=null;void current?.close();setPlaying(false);};
  useEffect(()=>()=>{void context.current?.close();},[]);
  useEffect(()=>{if(gain.current&&context.current)gain.current.gain.setTargetAtTime(volume,context.current.currentTime,.1);},[volume]);
  const toggle=async()=>{
    if(context.current){stop();return;}
    try{
      const audio=new AudioContext();context.current=audio;
      const buffer=audio.createBuffer(1,audio.sampleRate*4,audio.sampleRate),samples=buffer.getChannelData(0);
      let previous=0;for(let i=0;i<samples.length;i++){previous=(previous+(Math.random()*2-1)*.025)/1.025;samples[i]=previous*3;}
      const source=audio.createBufferSource();source.buffer=buffer;source.loop=true;
      const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=900;
      const level=audio.createGain();level.gain.value=volume;gain.current=level;
      source.connect(filter).connect(level).connect(audio.destination);source.start();await audio.resume();
      if(context.current===audio)setPlaying(true);
    }catch{stop();}
  };
  return <div className="flex flex-wrap items-center gap-4 text-xs text-[#38594b]">
    <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={event=>onChange(event.target.checked)}/>{copy[1]}</label>
    <button type="button" className="rounded-xl border bg-white px-3 py-2" aria-pressed={playing} onClick={()=>void toggle()}>{playing?copy[3]:copy[2]}</button>
    {playing&&<label className="flex items-center gap-2">{copy[4]}<input type="range" min="0" max="0.3" step="0.01" value={volume} onChange={event=>setVolume(Number(event.target.value))}/></label>}
  </div>;
}
