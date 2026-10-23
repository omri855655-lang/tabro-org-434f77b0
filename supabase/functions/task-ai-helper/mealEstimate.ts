export interface MealItem {name:string;grams:number;calories:number;protein:number;carbs:number;fat:number}
export interface MealEstimate {title:string;items:MealItem[];assumptions:string}
export interface SavedMeal extends MealEstimate {id:string;date:string}
export function parseMealEstimate(value:unknown):MealEstimate {
  if(!value||typeof value!=='object')throw new Error('Invalid meal');
  const data=value as Record<string,unknown>;
  if(!Array.isArray(data.items)||!data.items.length||data.items.length>30)throw new Error('No meal items');
  const items=data.items.map(raw=>{
    if(!raw||typeof raw!=='object')throw new Error('Invalid item');
    const row=raw as Record<string,unknown>;
    if(typeof row.name!=='string'||!row.name.trim())throw new Error('Invalid food name');
    const number=(key:string,max:number)=>{const value=row[key];if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)throw new Error('Invalid food quantity');return Math.round(value*10)/10;};
    return {name:row.name.slice(0,120),grams:number('grams',5000),calories:number('calories',15000),protein:number('protein',1000),carbs:number('carbs',2000),fat:number('fat',1000)};
  });
  return {title:typeof data.title==='string'?data.title.slice(0,160):'',assumptions:typeof data.assumptions==='string'?data.assumptions.slice(0,2000):'',items};
}
export function mealTotals(items:MealItem[]) {
  return items.reduce((sum,item)=>({calories:sum.calories+item.calories,protein:sum.protein+item.protein,carbs:sum.carbs+item.carbs,fat:sum.fat+item.fat}),{calories:0,protein:0,carbs:0,fat:0});
}
export function scaleMealItem(item:MealItem,grams:number):MealItem {
  if(!Number.isFinite(grams)||grams<0||grams>5000)throw new Error('Invalid portion');
  const ratio=item.grams>0?grams/item.grams:0;
  return {...item,grams,calories:item.calories*ratio,protein:item.protein*ratio,carbs:item.carbs*ratio,fat:item.fat*ratio};
}
