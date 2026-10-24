import {Capacitor,registerPlugin} from '@capacitor/core';
import type {HealthDay} from './healthImport';
interface NativeHealthPlugin {
  requestAuthorization():Promise<{requested:boolean}>;
  readSummary():Promise<{days:HealthDay[]}>;
}
const native=registerPlugin<NativeHealthPlugin>('TabroHealth');
export const nativeHealthAvailable=()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('TabroHealth');
export async function readNativeHealth():Promise<HealthDay[]> {
  if(!nativeHealthAvailable())throw new Error('Native health component required');
  await native.requestAuthorization();
  const {days}=await native.readSummary();
  if(!Array.isArray(days))throw new Error('Invalid health response');
  const optional=(value:number|null|undefined,max:number)=>value==null||Number.isFinite(value)&&value>=0&&value<=max;
  return days.filter(day=>day&&/^\d{4}-\d{2}-\d{2}$/.test(day.date)&&(day.steps===null||Number.isFinite(day.steps)&&day.steps>=0&&day.steps<200000)&&(day.sleepHours===null||Number.isFinite(day.sleepHours)&&day.sleepHours>=0&&day.sleepHours<=24)&&optional(day.activeCalories,20000)&&optional(day.exerciseMinutes,1440)).slice(0,30);
}
