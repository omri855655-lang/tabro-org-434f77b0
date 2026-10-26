import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { safeLocalStorage } from '@/lib/safeLocalStorage';
import { printDocument } from '@/lib/printDocument';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { toast } from 'sonner';
import { planningToolsCopy } from '@/lib/planningToolsCopy';
import { advisorCopy } from '@/lib/advisorCopy';
import { ADVISOR_MAX_REQUEST, advisorPrompt, appendAdvisorRequest, awaitAdvisorReply, normalizeAdvisorMessages, validatePlanFile, type AdvisorMessage, type AdvisorRequest } from '@/lib/planningAdvisor';

const askAdvisor: AdvisorRequest = async ({prompt,title,signal}) => {
  const { data,error } = await supabase.functions.invoke('task-ai-helper',{signal,body:{type:'custom',taskDescription:title,customPrompt:prompt}});
  if(error || data?.error)throw new Error('ADVISOR_UNAVAILABLE');
  return data?.suggestion || data?.result || data?.response;
};
export default function PlanningAdvisor({ id, title, context }: { id: string; title: string; context: string }) {
  const { user } = useAuth();
  return <PlanningAdvisorPanel key={`${user?.id || 'guest'}:${id}`} storageKey={`planning-advisor:${user?.id || 'guest'}:${id}`} title={title} context={context} />;
}
export function PlanningAdvisorPanel({ storageKey: key, title, context, requestAdvice=askAdvisor, quickPrompts=[] }: { storageKey: string; title: string; context: string; requestAdvice?:AdvisorRequest; quickPrompts?: { label: string; prompt: string }[] }) {
  const { lang, dir } = useLanguage();
  const copy = planningToolsCopy[lang];
  const ui = advisorCopy[lang];
  const [messages, setMessages] = useState<AdvisorMessage[]>(() => normalizeAdvisorMessages(safeLocalStorage.getJSON(key, [])));
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [storageFailed,setStorageFailed] = useState(false);
  const [visible,setVisible] = useState(40);
  const [loadingFile,setLoadingFile] = useState(false);
  const fileReading = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
  const save = (next:AdvisorMessage[]) => {
    setMessages(next);
    const encoded=JSON.stringify(next);safeLocalStorage.setString(key,encoded);
    setStorageFailed(safeLocalStorage.getString(key)!==encoded);
  };
  const send = async () => {
    const original=prompt.trim();
    if (!original || pending.current || fileReading.current) return;
    if(original.length>ADVISOR_MAX_REQUEST){setNotice(ui.fileLarge);return;}
    pending.current=true;const requestController=new AbortController();controller.current=requestController;
    const next = appendAdvisorRequest(messages,original);
    save(next);setPrompt('');setBusy(true);setNotice('');
    try {
      const reply=await awaitAdvisorReply(requestAdvice,{prompt:advisorPrompt(lang,title,original,context,messages),title},requestController);
      if(alive.current)save([...next,{role:'assistant',content:reply}]);
    } catch (error) {
      if(alive.current){setPrompt(original);setNotice(error instanceof Error && error.message==='ADVISOR_TIMEOUT' ? ui.timeout : requestController.signal.aborted ? ui.cancelled : ui.failed);}
    } finally {pending.current=false;if(alive.current)setBusy(false);}
  };
  const loadPlan = async (file:File) => {
    if(pending.current || fileReading.current)return;
    const before=validatePlanFile(file.name,file.size);
    if(before){setNotice(before==='large'?ui.fileLarge:ui.fileUnsupported);return;}
    fileReading.current=true;setLoadingFile(true);
    try {
      const text=await file.text(), invalid=validatePlanFile(file.name,file.size,text);
      if(!alive.current)return;
      if(invalid){setNotice(invalid==='large'?ui.fileLarge:ui.fileBinary);return;}
      setPrompt(text);setNotice('');toast.success(ui.loaded);
    } catch {if(alive.current)setNotice(ui.fileError);}
    finally {fileReading.current=false;if(alive.current)setLoadingFile(false);}
  };
  const backup = () => {
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,title,messages},null,2)],{type:'application/json;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='tabro-planning-chat.json';anchor.click();URL.revokeObjectURL(url);
  };
  return <details className="my-3 rounded-2xl border bg-card p-4" dir={dir}>
    <summary className="cursor-pointer font-semibold">{copy.advisor} · {title}</summary>
    <p className="my-3 text-sm text-muted-foreground">{copy.advisorHint}</p>
    <p className="mb-3 text-xs text-muted-foreground">{ui.adviceOnly}</p>
    <div className="my-3 flex flex-wrap gap-2">{quickPrompts.map(item => <Button key={item.label} size="sm" variant="outline" disabled={busy || loadingFile} onClick={() => { setPrompt(item.prompt); setNotice(''); }}>{item.label}</Button>)}</div>
    {storageFailed && <p role="alert" className="my-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{ui.storage}</p>}
    {messages.length>visible && <Button variant="ghost" size="sm" onClick={()=>setVisible(count=>count+40)}>{ui.older}</Button>}
    <div className="max-h-80 space-y-3 overflow-auto" aria-live="polite">{messages.slice(-visible).map((m, i) => <div key={Math.max(0,messages.length-visible)+i} className={`break-words whitespace-pre-wrap rounded-xl p-3 text-sm ${m.role === 'user' ? 'bg-muted' : 'border bg-primary/5'}`}><span className="mb-1 block text-xs font-semibold text-muted-foreground">{m.role === 'user' ? copy.me : copy.advisor}</span>{m.content}</div>)}</div>
    <label className="my-3 block text-sm font-medium">{ui.file}<input className="mt-2 block w-full text-xs" type="file" accept=".txt,.md,.json" disabled={busy || loadingFile} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void loadPlan(file);}}/><span className="mt-1 block text-xs font-normal text-muted-foreground">{ui.fileHint}</span></label>
    <Textarea aria-label={ui.request} className="my-3" disabled={busy || loadingFile} value={prompt} onChange={e => {setPrompt(e.target.value);setNotice('');}} placeholder={copy.placeholder} maxLength={ADVISOR_MAX_REQUEST} />
    <p className="mb-3 text-xs text-muted-foreground">{ui.characters.replace('{count}',String(prompt.length))}</p>
    {notice && <p role="status" className="my-3 rounded-xl border bg-muted p-3 text-sm">{notice}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || loadingFile || !prompt.trim()} onClick={() => void send()}>{busy ? copy.sending : copy.send}</Button>{busy && <Button variant="outline" onClick={()=>controller.current?.abort()}>{ui.cancel}</Button>}<Button variant="outline" disabled={!messages.length} onClick={() => printDocument(`${copy.plan} · ${title}`, [copy.author, copy.content], messages.map(m => [m.role === 'user' ? copy.me : copy.advisor, m.content]), '', { lang, dir })}>{copy.printPlan}</Button><Button variant="ghost" disabled={!messages.length} onClick={backup}>{ui.backup}</Button></div>
  </details>;
}
