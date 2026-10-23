export const UNLOCK_POINTS_PER_MINUTE = 10;
export function unlockCost(minutes:number) {
  if(!Number.isInteger(minutes)||minutes<1||minutes>120)throw new Error('Invalid unlock duration');
  return minutes*UNLOCK_POINTS_PER_MINUTE;
}
