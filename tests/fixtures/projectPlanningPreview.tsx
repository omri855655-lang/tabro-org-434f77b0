import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Toaster} from 'sonner';
import {LanguageProvider,useLanguage} from '../../src/hooks/useLanguage';
import ProjectGantt,{type ProjectGanttTask} from '../../src/components/projects/ProjectGantt';
import {PlanningAdvisorPanel} from '../../src/components/PlanningAdvisor';
import {GanttSharePanel} from '../../src/components/projects/ProjectGanttShareLink';
import {type AdvisorRequest} from '../../src/lib/planningAdvisor';
import {addCalendarDays,toLocalDateKey} from '../../src/lib/projectGantt';
import {Dialog,DialogContent,DialogTitle} from '../../src/components/ui/dialog';
import {Button} from '../../src/components/ui/button';
import '../../src/index.css';

const today=new Date();
const initial:ProjectGanttTask[]=[
  {id:'one',title:'Research / מחקר',completed:false,urgent:false,status:'בטיפול',due_date:toLocalDateKey(addCalendarDays(today,3)),sort_order:0},
  {id:'two',title:'Delivery / מסירה',completed:false,urgent:true,status:'לא התחיל',due_date:toLocalDateKey(addCalendarDays(today,7)),sort_order:1},
  {id:'three',title:'Review / בדיקה',completed:true,urgent:false,status:'בוצע',due_date:toLocalDateKey(addCalendarDays(today,-1)),sort_order:2},
  {id:'four',title:'Undated / ללא תאריך',completed:false,urgent:false,status:null,due_date:null,sort_order:3},
];
export function ProjectPlanningPreview(){
  const {lang,setLang}=useLanguage();
  const [tasks,setTasks]=useState(initial),[mode,setMode]=useState('private'),[ai,setAi]=useState('success'),[fail,setFail]=useState(false),[changes,setChanges]=useState(0),[links,setLinks]=useState(0);
  const [target,setTarget]=useState(toLocalDateKey(addCalendarDays(today,20)));
  const [modal,setModal]=useState(false);
  const check=()=>{if(fail)throw new Error('Fixture-only save failure');setChanges(count=>count+1);};
  const ask:AdvisorRequest=async()=>{if(ai==='error')throw new Error('Fixture-only AI failure');if(ai==='wait')return new Promise(()=>{});return 'Fictional advice only: start with research, then review the delivery date. No server was contacted.';};
  return <main className="mx-auto max-w-6xl space-y-4 p-4">
    <h1 className="text-xl font-bold">Project planning UI fixture</h1><p>Fictional data only. All writes and AI replies below are local fakes; no production records or public links are created.</p>
    <div className="flex flex-wrap gap-4"><label>Language <select aria-label="Fixture language" value={lang} onChange={e=>setLang(e.target.value as typeof lang)}>{['he','en','es','zh','ar','ru'].map(value=><option key={value}>{value}</option>)}</select></label><label>View <select aria-label="Fixture view" value={mode} onChange={e=>setMode(e.target.value)}>{['private','public','course'].map(value=><option key={value}>{value}</option>)}</select></label><label>AI <select aria-label="Fixture AI" value={ai} onChange={e=>setAi(e.target.value)}>{['success','error','wait'].map(value=><option key={value}>{value}</option>)}</select></label><label><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/>Fail local saves</label><output>Local changes: {changes}; local link requests: {links}</output></div>
    <div className="flex h-[680px] min-w-0"><ProjectGantt project={{id:'fictional',title:'Demo project',description:'Fictional UI test only',target_date:target}} tasks={tasks} kind={mode==='course'?'course':'project'} readOnly={mode!=='private'} audience={mode==='public'?'public':'private'} onUpdateTask={async(id,updates)=>{check();setTasks(rows=>rows.map(row=>row.id===id?{...row,...updates}:row));}} onBulkUpdate={async(updates)=>{check();setTasks(rows=>rows.map(row=>({...row,due_date:updates.find(update=>update.id===row.id)?.due_date || row.due_date})));}} onAddTemplate={async(rows)=>{check();setTasks(tasks=>[...tasks,...rows.map((row,index)=>({...row,id:`fake-${tasks.length+index}`,sort_order:tasks.length+index,completed:false,urgent:false,status:'לא התחיל'}))]);}} onUpdateProjectTarget={async date=>{check();setTarget(date);}}/></div>
    <PlanningAdvisorPanel key={ai} storageKey="fixture:planning-advisor:20261021" title="Demo project" context="Fictional test project" requestAdvice={ask}/>
    <GanttSharePanel projectId="fictional" projectTitle="Demo project" createLinkRequest={async()=>{setLinks(count=>count+1);return '00000000-0000-0000-0000-000000000000';}} disableLinkRequest={async()=>{setLinks(count=>count+1);}}/>
    <Button onClick={()=>setModal(true)}>Open modal print fixture</Button>
    <Dialog open={modal} onOpenChange={setModal}><DialogContent aria-describedby={undefined}><DialogTitle>Modal report fixture</DialogTitle><Button onClick={()=>{void import('../../src/lib/printDocument').then(({printDocument})=>printDocument('Nested modal report',['Task'],[['Fictional task']], '',{lang,dir:lang==='he'||lang==='ar'?'rtl':'ltr'}));}}>Preview nested report</Button></DialogContent></Dialog>
    <Toaster/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><ProjectPlanningPreview/></LanguageProvider>);
