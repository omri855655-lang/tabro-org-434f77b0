import {useEffect, useState} from 'react';
import {useLanguage} from '@/hooks/useLanguage';
import {supabase} from '@/integrations/supabase/client';
import type {NutritionJournal} from '@/hooks/useNutritionJournal';
import {mealPhotoCopy} from '@/lib/nutritionFeaturesCopy';
import {nutritionTrackerCopy} from '@/lib/nutritionTrackerCopy';
import {dailyNutrition,localDay,nutritionTarget,type NutritionProfile} from '@/lib/nutritionPlan';
import {parseMealEstimate,mealTotals,scaleMealItem,type MealEstimate,type MealItem} from '@/lib/mealEstimate';
import {Button} from '@/components/ui/button';

async function photoData(file:File):Promise<string> {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>16000000)throw new Error('Invalid image');
  const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=source;});
  const canvas=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(image.width,image.height));canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('No image context');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const result=canvas.toDataURL('image/jpeg',.82);if(result.length>3500000)throw new Error('Image too large');return result;
}
const blank=():MealItem=>({name:'',grams:100,calories:0,protein:0,carbs:0,fat:0});
const inputTime=(date:Date)=>`${localDay(date)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
const defaultTime=(day:string)=>day===localDay()?inputTime(new Date()):`${day}T12:00`;
export function MealPhotoJournal({userId,journal,profile}:{userId?:string;journal:NutritionJournal;profile:NutritionProfile}){
  const {lang,dir}=useLanguage(),copy=mealPhotoCopy[lang],c=nutritionTrackerCopy[lang];
  const [photo,setPhoto]=useState(''),[meal,setMeal]=useState<MealEstimate|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [editing,setEditing]=useState<string|null>(null),[eatenAt,setEatenAt]=useState(()=>defaultTime(journal.day));
  useEffect(()=>{if(!editing)setEatenAt(defaultTime(journal.day));},[journal.day,editing]);
  const reset=()=>{setMeal(null);setPhoto('');setEditing(null);setEatenAt(defaultTime(journal.day));};
  const analyze=async()=>{
    if(!photo||!userId)return;setBusy(true);setMessage('');
    try{const {data,error}=await supabase.functions.invoke('task-ai-helper',{body:{type:'meal-photo',imageDataUrl:photo,language:lang},timeout:60000});if(error)throw error;setMeal(parseMealEstimate(data?.meal));}
    catch{setMessage(copy[14]);}finally{setBusy(false);}
  };
  const change=(index:number,item:MealItem)=>setMeal(previous=>previous?{...previous,items:previous.items.map((value,i)=>i===index?item:value)}:null);
  const total=meal?mealTotals(meal.items):null;
  const target=nutritionTarget(profile,journal.preferences),summary=dailyNutrition(journal.history,journal.day,target);
  const date=new Date(eatenAt),dateValid=Number.isFinite(date.getTime())&&date.getTime()<=Date.now();
  const oldMeal=summary.entries.find(entry=>entry.id===editing);
  const preview=total&&target.status==='ready'&&dateValid&&localDay(date)===journal.day?target.calories-summary.calories+(oldMeal?mealTotals(oldMeal.items).calories:0)-total.calories:null;
  const save=()=>{
    if(!meal)return;
    if(!dateValid){setMessage(c.invalidDate);return;}
    try{
      const confirmed=parseMealEstimate(meal),saved={...confirmed,id:editing||crypto.randomUUID(),date:date.toISOString()};
      if(!journal.saveMeals(current=>{
        if(editing&&!current.some(entry=>entry.id===editing))throw new Error('Meal removed in another tab');
        return editing?current.map(entry=>entry.id===editing?saved:entry):[saved,...current];
      }))return;
      journal.selectDay(localDay(date));reset();setMessage(copy[6]);
    }catch{setMessage(copy[14]);}
  };
  return <section dir={dir} className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground">
    <h3 className="text-lg font-semibold">{copy[0]}</h3><p className="text-xs text-muted-foreground">{copy[15]}</p>
    <div className="flex flex-wrap items-center gap-3"><label className="max-w-full rounded-xl border px-3 py-2 text-sm">{copy[1]}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} className="block max-w-full text-xs" onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);reset();setMessage('');try{setPhoto(await photoData(file));}catch{setPhoto('');setMessage(copy[14]);}finally{setBusy(false);}}}/></label><Button disabled={!photo||busy||!userId} onClick={()=>void analyze()}>{busy?copy[3]:copy[2]}</Button><Button variant="outline" disabled={busy} onClick={()=>{reset();setMessage('');setMeal({title:'',items:[blank()],assumptions:''});}}>{copy[16]}</Button></div>
    {photo&&<img src={photo} alt={copy[0]} className="max-h-52 rounded-xl object-contain"/>}
    {message&&<p role="status" className="text-sm">{message}</p>}
    {meal&&<div className="space-y-3"><p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{copy[4]}</p>{meal.assumptions&&<p className="text-xs text-muted-foreground">{meal.assumptions}</p>}
      <label className="block text-sm">{c.eatenAt}<input type="datetime-local" className="ms-2 max-w-full rounded-lg border bg-background p-2" value={eatenAt} max={inputTime(new Date())} onChange={event=>setEatenAt(event.target.value)}/></label>
      {meal.items.map((item,index)=><fieldset key={index} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3"><label className="text-xs">{copy[17]}<input className="mt-1 w-full rounded border bg-background p-2" value={item.name} maxLength={120} onChange={event=>change(index,{...item,name:event.target.value})}/></label>
        {(['grams','calories','protein','carbs','fat'] as const).map((field,i)=><label key={field} className="text-xs">{copy[i+8]}<input className="mt-1 w-full rounded border bg-background p-2" type="number" min="0" max={field==='grams'?5000:field==='calories'?15000:2000} step="0.1" value={Math.round(item[field]*10)/10} onChange={event=>{const value=Math.max(0,Math.min(field==='grams'?5000:field==='calories'?15000:2000,Number(event.target.value)||0));change(index,field==='grams'?scaleMealItem(item,value):{...item,[field]:value});}}/></label>)}
        <Button size="sm" variant="ghost" onClick={()=>setMeal({...meal,items:meal.items.filter((_,i)=>i!==index)})}>{copy[7]}</Button></fieldset>)}
      <Button variant="outline" onClick={()=>setMeal({...meal,items:[...meal.items,blank()]})} disabled={meal.items.length>=30}>{copy[18]}</Button>
      {total&&<p className="font-medium">{copy[9]}: {Math.round(total.calories)} · {copy[10]}: {Math.round(total.protein)}g · {copy[11]}: {Math.round(total.carbs)}g · {copy[12]}: {Math.round(total.fat)}g</p>}
      {preview!==null&&<p role="status" className="rounded-lg bg-muted p-3 text-sm">{c.preview}: {Math.round(preview).toLocaleString(lang)} {c.kcal}</p>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy||!meal.items.length||!dateValid} onClick={save}>{copy[5]}</Button><Button variant="ghost" onClick={reset}>{c.cancel}</Button></div></div>}
    <h4 className="text-sm font-semibold">{c.meals} ({summary.entries.length})</h4>{summary.entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(entry=><article key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><div><time dateTime={entry.date}>{new Date(entry.date).toLocaleString(lang,{dateStyle:'medium',timeStyle:'short'})}</time><p>{entry.items.map(item=>item.name).join(', ')}</p><span className="text-xs">{Math.round(mealTotals(entry.items).calories)} {copy[9]}</span></div><div className="flex gap-1"><Button size="sm" variant="outline" disabled={busy} onClick={()=>{setPhoto('');setMeal({...entry,items:entry.items.map(item=>({...item}))});setEditing(entry.id);setEatenAt(inputTime(new Date(entry.date)));setMessage('');}}>{c.edit}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>{if(journal.saveMeals(current=>current.filter(meal=>meal.id!==entry.id))&&editing===entry.id)reset();}}>{copy[7]}</Button></div></article>)}
  </section>;
}
