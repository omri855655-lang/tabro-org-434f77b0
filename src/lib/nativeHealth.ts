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
  return days.filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day.date)&&(day.steps===null||Number.isFinite(day.steps)&&day.steps>=0&&day.steps<200000)&&(day.sleepHours===null||Number.isFinite(day.sleepHours)&&day.sleepHours>=0&&day.sleepHours<=24)).slice(0,30);
}
