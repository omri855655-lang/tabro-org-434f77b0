import {useState} from 'react';
import {useAuth} from '@/hooks/useAuth';
import {useLanguage} from '@/hooks/useLanguage';
import {supabase} from '@/integrations/supabase/client';
import {safeLocalStorage} from '@/lib/safeLocalStorage';
import {mealPhotoCopy} from '@/lib/nutritionFeaturesCopy';
import {parseMealEstimate,mealTotals,scaleMealItem,type MealEstimate,type MealItem,type SavedMeal} from '@/lib/mealEstimate';
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
export function MealPhotoJournal(){
  const {user}=useAuth();return <Journal key={user?.id||'guest'} userId={user?.id}/>;
}
function Journal({userId}:{userId?:string}){
  const {lang,dir}=useLanguage(),copy=mealPhotoCopy[lang],key=`tabro-meals:${userId||'guest'}`;
  const [history,setHistory]=useState<SavedMeal[]>(()=>{
    const rows=safeLocalStorage.getJSON<unknown>(key,[]);if(!Array.isArray(rows))return [];
    return rows.slice(0,100).flatMap(row=>{try{return [{...parseMealEstimate(row),id:String(row.id),date:String(row.date)}];}catch{return [];}});
  });
  const [photo,setPhoto]=useState(''),[meal,setMeal]=useState<MealEstimate|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const persist=(rows:SavedMeal[])=>{try{window.localStorage.setItem(key,JSON.stringify(rows));setHistory(rows);return true;}catch{setMessage(copy[14]);return false;}};
  const analyze=async()=>{
    if(!photo||!userId)return;setBusy(true);setMessage('');
    try{const {data,error}=await supabase.functions.invoke('task-ai-helper',{body:{type:'meal-photo',imageDataUrl:photo,language:lang}});if(error)throw error;setMeal(parseMealEstimate(data?.meal));}
    catch{setMessage(copy[14]);}finally{setBusy(false);}
  };
  const change=(index:number,item:MealItem)=>setMeal(previous=>previous?{...previous,items:previous.items.map((value,i)=>i===index?item:value)}:null);
  const total=meal?mealTotals(meal.items):null;
  return <section dir={dir} className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground">
    <h3 className="text-lg font-semibold">{copy[0]}</h3><p className="text-xs text-muted-foreground">{copy[15]}</p>
    <div className="flex flex-wrap items-center gap-3"><label className="rounded-xl border px-3 py-2 text-sm">{copy[1]}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} className="block max-w-full text-xs" onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setMeal(null);setMessage('');try{setPhoto(await photoData(file));}catch{setPhoto('');setMessage(copy[14]);}finally{setBusy(false);}}}/></label><Button disabled={!photo||busy||!userId} onClick={()=>void analyze()}>{busy?copy[3]:copy[2]}</Button><Button variant="outline" disabled={busy} onClick={()=>setMeal({title:'',items:[blank()],assumptions:''})}>{copy[16]}</Button></div>
    {photo&&<img src={photo} alt={copy[0]} className="max-h-52 rounded-xl object-contain"/>}
    {message&&<p role="status" className="text-sm">{message}</p>}
    {meal&&<div className="space-y-3"><p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{copy[4]}</p>{meal.assumptions&&<p className="text-xs text-muted-foreground">{meal.assumptions}</p>}
      {meal.items.map((item,index)=><fieldset key={index} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3"><label className="text-xs">{copy[17]}<input className="mt-1 w-full rounded border bg-background p-2" value={item.name} maxLength={120} onChange={event=>change(index,{...item,name:event.target.value})}/></label>
        {(['grams','calories','protein','carbs','fat'] as const).map((field,i)=><label key={field} className="text-xs">{copy[i+8]}<input className="mt-1 w-full rounded border bg-background p-2" type="number" min="0" max={field==='grams'?5000:field==='calories'?15000:2000} step="0.1" value={Math.round(item[field]*10)/10} onChange={event=>{const value=Math.max(0,Math.min(field==='grams'?5000:field==='calories'?15000:2000,Number(event.target.value)||0));change(index,field==='grams'?scaleMealItem(item,value):{...item,[field]:value});}}/></label>)}
        <Button size="sm" variant="ghost" onClick={()=>setMeal({...meal,items:meal.items.filter((_,i)=>i!==index)})}>{copy[7]}</Button></fieldset>)}
      <Button variant="outline" onClick={()=>setMeal({...meal,items:[...meal.items,blank()]})} disabled={meal.items.length>=30}>{copy[18]}</Button>
      {total&&<p className="font-medium">{copy[9]}: {Math.round(total.calories)} · {copy[10]}: {Math.round(total.protein)}g · {copy[11]}: {Math.round(total.carbs)}g · {copy[12]}: {Math.round(total.fat)}g</p>}
      <Button onClick={()=>{try{const confirmed=parseMealEstimate(meal);if(!persist([{...confirmed,id:crypto.randomUUID(),date:new Date().toISOString()},...history].slice(0,100)))return;setMeal(null);setPhoto('');setMessage(copy[6]);}catch{setMessage(copy[14]);}}}>{copy[5]}</Button></div>}
    <h4 className="text-sm font-semibold">{copy[13]} ({history.length})</h4>{history.slice(0,14).map(entry=><article key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><div><time>{new Date(entry.date).toLocaleDateString(lang)}</time><p>{entry.items.map(item=>item.name).join(', ')}</p><span className="text-xs">{Math.round(mealTotals(entry.items).calories)} {copy[9]}</span></div><Button size="sm" variant="ghost" onClick={()=>persist(history.filter(meal=>meal.id!==entry.id))}>{copy[7]}</Button></article>)}
  </section>;
}
