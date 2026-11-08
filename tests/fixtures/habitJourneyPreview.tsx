import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider, useLanguage } from '../../src/hooks/useLanguage';
import { AuthProvider } from '../../src/hooks/useAuth';
import { HabitJourneyContent } from '../../src/components/zoneflow/ZoneFlowHabitStudio';
import { LearningTopicDraw } from '../../src/components/zoneflow/LearningTopicDraw';
import DailyRoutine from '../../src/components/DailyRoutine';
import { habitDate, type HabitPlan, type HabitEntry } from '../../src/lib/habitJourney';
import '../../src/index.css';

export function Preview() {
  const { lang, setLang } = useLanguage();
  const [draw, setDraw] = useState(0);
  const [plans,setPlans] = useState<HabitPlan[]>([{id:'demo',user_id:'demo',title:'קריאה שקטה / Quiet reading',direction:'build',cue:'אחרי הקפה / After coffee',action:'עמוד אחד בספר / One page of a book',weekdays:[0,1,2,3,4,5],target_days:30,created_at:new Date().toISOString()}]);
  const [entries,setEntries] = useState<HabitEntry[]>([]);
  const store = {
    plans,entries,loading:false,error:false,busy:false,load:async()=>{},
    addPlan:async(plan:Pick<HabitPlan,'title'|'direction'|'cue'|'action'|'weekdays'|'target_days'>)=>{setPlans(value=>[...value,{...plan,id:crypto.randomUUID(),user_id:'demo',created_at:new Date().toISOString()}]);return true;},
    checkin:async(habit_id:string,outcome:HabitEntry['outcome'])=>{setEntries(value=>[...value.filter(item=>item.habit_id!==habit_id||item.kind!=='checkin'),{id:crypto.randomUUID(),habit_id,user_id:'demo',kind:'checkin',entry_date:habitDate(),outcome,intensity:null,trigger:'',response:'',created_at:new Date().toISOString()}]);return true;},
    recordUrge:async(habit_id:string,intensity:number,trigger:string,response:string)=>{setEntries(value=>[...value,{id:crypto.randomUUID(),habit_id,user_id:'demo',kind:'urge',entry_date:habitDate(),outcome:null,intensity,trigger,response,created_at:new Date().toISOString()}]);return true;},
    remove:async(id:string)=>{setPlans(value=>value.filter(item=>item.id!==id));return true;},
  };
  return <main className="mx-auto max-w-6xl space-y-5 p-4"><p className="text-sm">תצוגת בדיקה בלבד: נתונים לדוגמה בזיכרון. אין שמירה בענן.</p><label>Language <select value={lang} onChange={e=>setLang(e.target.value as typeof lang)}>{['he','en','es','zh','ar','ru'].map(value=><option key={value}>{value}</option>)}</select></label><HabitJourneyContent userId="demo" store={store}/><button onClick={()=>setDraw(value=>value+1)}>הגרלת נושא / Draw topic</button><LearningTopicDraw key={draw} category="פיזיקה" subtopic="אנרגיה" lang={lang}/><div className="h-[600px]"><DailyRoutine/></div></main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><AuthProvider><Preview/></AuthProvider></LanguageProvider>);
