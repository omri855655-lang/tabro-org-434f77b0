import {createRoot} from "react-dom/client";
import {LanguageProvider,useLanguage} from "../../src/hooks/useLanguage";
import {ZoneFlowLearningStudio} from "../../src/components/zoneflow/ZoneFlowLearningStudio";
import {safeLocalStorage} from "../../src/lib/safeLocalStorage";
import {learningHistoryKey} from "../../src/lib/learningHistory";
import {printDocument} from "../../src/lib/printDocument";
import "../../src/index.css";

safeLocalStorage.setJSON(learningHistoryKey(),[{id:"fictional-preview",date:"2026-10-21T10:00:00Z",category:"פיזיקה",subtopic:"אנרגיה",title:"Demo lesson / שיעור לדוגמה",content:"Fictional preview content only.",summary:"This is a fictional learning summary for UI testing, not a real saved lesson.",feedback:"Preview feedback"}]);
export function Preview(){const {lang,setLang}=useLanguage();return <main className="mx-auto max-w-6xl space-y-4 p-4"><label>Preview language <select aria-label="Preview language" value={lang} onChange={e=>setLang(e.target.value as typeof lang)}>{["he","en","es","zh","ar","ru"].map(value=><option key={value}>{value}</option>)}</select></label><button type="button" onClick={()=>printDocument("תוכנית לדוגמה / Preview report",["תאריך / Date","אירוע / Event"],[["21/10/2026","למידה / Study"],["22/10/2026","<script>Not executable</script>"]],"Fictional UI test only",{lang,dir:lang==='he'||lang==='ar'?'rtl':'ltr'})}>Preview print report</button><p>UI test: fictional data only. Guest preview never writes to cloud history.</p><ZoneFlowLearningStudio/></main>;}
createRoot(document.getElementById("root")!).render(<LanguageProvider><Preview/></LanguageProvider>);
