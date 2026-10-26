import {useState} from 'react';
import {useAuth} from '@/hooks/useAuth';
import {useLanguage} from '@/hooks/useLanguage';
import {safeLocalStorage} from '@/lib/safeLocalStorage';
import {healthImportCopy} from '@/lib/nutritionFeaturesCopy';
import {summarizeHealthRecords,type HealthRecord,type HealthDay} from '@/lib/healthImport';
import {Button} from '@/components/ui/button';
import {nativeHealthAvailable,readNativeHealth} from '@/lib/nativeHealth';
import {nutritionWorkspaceCopy} from '@/lib/nutritionWorkspaceCopy';
import {mergeHealthDays} from '@/lib/healthSummaryImport';
import {HealthSummaryImport} from './HealthSummaryImport';

export function HealthImportCard(){const {user}=useAuth();return <HealthImport key={user?.id||'guest'} userId={user?.id||'guest'}/>;}
function HealthImport({userId}:{userId:string}){
  const {lang,dir}=useLanguage(),copy=healthImportCopy[lang],key=`tabro-health-import:${userId}`;
  const extra=nutritionWorkspaceCopy[lang];
  const [days,setDays]=useState<HealthDay[]>(()=>{const rows=safeLocalStorage.getJSON<unknown>(key,[]);return Array.isArray(rows)?rows.filter(row=>typeof row?.date==='string'&&(row?.steps===null||Number.isFinite(row?.steps))&&(row?.sleepHours===null||Number.isFinite(row?.sleepHours))).slice(0,30):[];});
  const [error,setError]=useState(false),[busy,setBusy]=useState(false);
  return <section dir={dir} className="space-y-3 rounded-2xl border bg-card p-4 text-card-foreground"><h3 className="text-lg font-semibold">{copy[0]}</h3><p className="text-xs leading-6 text-muted-foreground">{copy[2]}</p>
    {nativeHealthAvailable()&&<Button disabled={busy} onClick={async()=>{setBusy(true);setError(false);try{const rows=await readNativeHealth();if(!rows.length)throw new Error('No health samples');window.localStorage.setItem(key,JSON.stringify(rows));setDays(rows);}catch{setError(true);}finally{setBusy(false);}}}>Apple Health</Button>}
    <p className="text-sm leading-relaxed text-muted-foreground">{extra[13]}</p>
    <p className="text-xs text-muted-foreground">{extra[12]}</p>
    <HealthSummaryImport busy={busy} onError={()=>setError(true)} onImport={rows=>{const next=mergeHealthDays(days,rows);window.localStorage.setItem(key,JSON.stringify(next));setDays(next);setError(false);}} />
    <label className="block text-sm">{copy[1]}<input type="file" accept=".xml,text/xml,application/xml" disabled={busy} className="mt-2 block max-w-full text-xs" onChange={async event=>{
      const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setError(false);
      try{if(file.size>20000000)throw new Error('Too large');const xml=new DOMParser().parseFromString(await file.text(),'application/xml');if(xml.querySelector('parsererror')||xml.documentElement.nodeName!=='HealthData')throw new Error('Invalid export');
        const records:HealthRecord[]=Array.from(xml.getElementsByTagName('Record')).filter(node=>['HKQuantityTypeIdentifierStepCount','HKCategoryTypeIdentifierSleepAnalysis','HKQuantityTypeIdentifierActiveEnergyBurned','HKQuantityTypeIdentifierAppleExerciseTime'].includes(node.getAttribute('type')||'')).map(node=>({type:node.getAttribute('type')||'',value:node.getAttribute('value')||'',startDate:node.getAttribute('startDate')||'',endDate:node.getAttribute('endDate')||'',sourceName:node.getAttribute('sourceName')||'',unit:node.getAttribute('unit')||''}));
        const result=summarizeHealthRecords(records);if(!result.length)throw new Error('No records');window.localStorage.setItem(key,JSON.stringify(result));setDays(result);
      }catch{setError(true);}finally{setBusy(false);}
    }}/></label>{error&&<p role="status" className="text-sm text-destructive">{copy[5]}</p>}
    {!!days.length&&<><p className="text-xs text-muted-foreground">{copy[6]}</p><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr><th scope="col">{{he:'תאריך',en:'Date',es:'Fecha',zh:'日期',ar:'التاريخ',ru:'Дата'}[lang]}</th><th scope="col">{copy[3]}</th><th scope="col">{copy[4]}</th><th scope="col">{extra[10]}</th><th scope="col">{extra[11]}</th></tr></thead><tbody>{days.slice(0,7).map(day=><tr key={day.date} className="border-t"><td className="py-2">{day.date}</td><td>{day.steps?.toLocaleString(lang)??'-'}</td><td>{day.sleepHours??'-'}</td><td>{day.activeCalories?.toLocaleString(lang)??'-'}</td><td>{day.exerciseMinutes?.toLocaleString(lang)??'-'}</td></tr>)}</tbody></table></div><Button variant="outline" onClick={()=>{try{window.localStorage.removeItem(key);setDays([]);}catch{setError(true);}}}>{copy[7]}</Button></>}
  </section>;
}
