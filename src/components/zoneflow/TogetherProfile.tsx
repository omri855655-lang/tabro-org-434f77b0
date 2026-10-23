import { useId } from 'react';
import { ChevronDown, Globe2, Settings2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/hooks/useLanguage';
import { togetherCopy } from '@/lib/togetherCopy';
import { cn } from '@/lib/utils';
import { decodeAvatar, encodeAvatar, avatarEditorCopy, AVATAR_SKINS, AVATAR_HAIR, AVATAR_PANTS, type AvatarDesign } from '@/lib/focusAvatar';

const SHIRTS = ['#71b7b3', '#df998c', '#dfb35c', '#91ac72', '#b1a2cc', '#83a7d0', '#afbf74', '#dba7ba'];

export function TogetherProfile({ title, subtitle, labels, username, avatarStyle, points, unlockMinutes, onUsernameChange, onAvatarChange }: {
  title: string; subtitle: string; labels: { username: string; points: string; unlock: string; minutes: string };
  username: string; avatarStyle: number; points: number; unlockMinutes: number;
  onUsernameChange: (value: string) => void; onAvatarChange: (value: number) => void;
}) {
  const { lang } = useLanguage();
  const copy = togetherCopy[lang];
  const inputId = useId();
  const design=decodeAvatar(avatarStyle),editor=avatarEditorCopy[lang];
  const update=(key:keyof AvatarDesign,value:number)=>onAvatarChange(encodeAvatar({...design,[key]:value}));
  return <section className="rounded-3xl border bg-card p-4 text-card-foreground sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"><Globe2 className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{subtitle}</p></div></div>
      <div className="flex flex-wrap gap-2 text-xs"><div className="rounded-xl bg-muted/60 px-3 py-2"><span className="text-muted-foreground">{labels.points}</span><strong className="ms-2 font-mono text-base">{points}</strong></div><div className="rounded-xl bg-muted/60 px-3 py-2"><span className="text-muted-foreground">{labels.unlock}</span><strong className="ms-2 font-mono text-base">{unlockMinutes}</strong><span className="ms-1 text-muted-foreground">{labels.minutes}</span></div></div>
    </div>
    <details className="group mt-3 border-t pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex items-center gap-2"><Settings2 className="h-3.5 w-3.5" />{copy.profile}<span className="max-w-32 truncate text-foreground">{username}</span></span><ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label htmlFor={inputId} className="mb-2 block text-xs text-muted-foreground">{labels.username}</label><Input id={inputId} value={username} maxLength={60} onChange={event => onUsernameChange(event.target.value)} /></div><fieldset><legend className="mb-2 text-xs text-muted-foreground">{copy.choose}</legend><div className="flex flex-wrap gap-2">{SHIRTS.map((shirt, index) => <button key={shirt} type="button" aria-label={`${copy.avatar} ${index + 1}`} aria-pressed={avatarStyle === index} onClick={() => onAvatarChange(index)} className={cn('relative h-9 w-9 rounded-full border-2 bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', avatarStyle === index ? 'border-emerald-600 ring-2 ring-emerald-600/20' : 'border-border hover:border-emerald-500')}><span className="absolute bottom-1 left-1/2 h-4 w-6 -translate-x-1/2 rounded-t-full" style={{ backgroundColor: shirt }} /><span className="absolute left-1/2 top-1 h-4 w-4 -translate-x-1/2 rounded-full bg-[#e3a278]" /></button>)}</div></fieldset></div>
      <fieldset className="mt-4 rounded-2xl bg-muted/40 p-4"><legend className="px-2 text-sm font-medium">{editor[0]}</legend><div className="grid gap-4 sm:grid-cols-2">
        {([{key:'skin',label:editor[1],colors:AVATAR_SKINS},{key:'hair',label:editor[2],colors:AVATAR_HAIR},{key:'pants',label:editor[5],colors:AVATAR_PANTS}] as const).map(({key,label,colors})=><div key={key}><p className="mb-2 text-xs">{label}</p><div className="flex gap-2">{colors.map((color,index)=><button key={color} type="button" aria-label={`${label} ${index+1}`} aria-pressed={design[key]===index} onClick={()=>update(key,index)} className={cn('h-9 w-9 rounded-full border-2 focus-visible:ring-2 focus-visible:ring-ring',design[key]===index?'border-emerald-600 ring-2 ring-emerald-600/30':'border-border')} style={{backgroundColor:`#${color.toString(16).padStart(6,'0')}`}}/>)}</div></div>)}
        <label className="grid gap-2 text-xs">{editor[3]}<select className="rounded-xl border bg-background p-2" value={design.cut} onChange={event=>update('cut',Number(event.target.value))}>{[6,7,8].map((label,index)=><option key={label} value={index}>{editor[label]}</option>)}</select></label>
        <label className="grid gap-2 text-xs">{editor[4]}<select className="rounded-xl border bg-background p-2" value={design.accessory} onChange={event=>update('accessory',Number(event.target.value))}>{[9,10,11].map((label,index)=><option key={label} value={index}>{editor[label]}</option>)}</select></label>
      </div></fieldset>
    </details>
  </section>;
}
