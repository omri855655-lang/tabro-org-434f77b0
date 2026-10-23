export interface HealthRecord {type:string;value:string;startDate:string;endDate:string;sourceName:string}
export interface HealthDay {date:string;steps:number|null;sleepHours:number|null}
function healthDate(value:string) {
  const normalized=value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/,'$1T$2$3:$4');
  return new Date(normalized);
}
const dayKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function summarizeHealthRecords(records:HealthRecord[]):HealthDay[] {
  const steps=new Map<string,Map<string,number>>(),sleep=new Map<string,[number,number][]>(),sleepRanges:[number,number][]=[],seen=new Set<string>();
  for(const row of records){
    const start=healthDate(row.startDate),end=healthDate(row.endDate),a=start.getTime(),b=end.getTime();
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)continue;
    const id=JSON.stringify([row.type,row.value,a,b,row.sourceName]);if(seen.has(id))continue;seen.add(id);
    if(row.type==='HKQuantityTypeIdentifierStepCount'){
      const count=Number(row.value);if(!Number.isFinite(count)||count<0||count>200000)continue;
      const key=dayKey(start),sources=steps.get(key)||new Map<string,number>();
      sources.set(row.sourceName,(sources.get(row.sourceName)||0)+count);steps.set(key,sources);
    }else if(row.type==='HKCategoryTypeIdentifierSleepAnalysis'&&/^HKCategoryValueSleepAnalysisAsleep(?:Core|Deep|REM|Unspecified)?$/.test(row.value)&&b-a<=86400000){
      sleepRanges.push([a,b]);
    }
  }
  const merged:[number,number][]=[];
  for(const range of sleepRanges.sort((a,b)=>a[0]-b[0])){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
  for(const range of merged){const key=dayKey(new Date(range[1])),ranges=sleep.get(key)||[];ranges.push(range);sleep.set(key,ranges);}
  return [...new Set([...steps.keys(),...sleep.keys()])].map(date=>{
    const ranges=(sleep.get(date)||[]).sort((a,b)=>a[0]-b[0]);let total=0,from=0,to=0;
    for(const [a,b] of ranges){if(a>to){total+=to-from;from=a;to=b;}else to=Math.max(to,b);}total+=to-from;
    // Pick one source per day so phone and watch samples are not counted twice.
    return {date,steps:steps.has(date)?Math.round(Math.max(0,...steps.get(date)!.values())):null,sleepHours:sleep.has(date)?Math.round(total/360000)/10:null};
  }).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
}
