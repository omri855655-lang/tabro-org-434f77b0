export type FocusFlightTime = 'day' | 'night';

export const focusFlightTimeCopy = {
  he: ['אווירת טיסה', 'טיסת יום', 'טיסת לילה'],
  en: ['Flight ambience', 'Day flight', 'Night flight'],
  es: ['Ambiente de vuelo', 'Vuelo diurno', 'Vuelo nocturno'],
  zh: ['飞行氛围', '日间航班', '夜间航班'],
  ar: ['أجواء الرحلة', 'رحلة نهارية', 'رحلة ليلية'],
  ru: ['Атмосфера полёта', 'Дневной рейс', 'Ночной рейс'],
} as const;

export function parseFocusFlightTime(value: unknown): FocusFlightTime {
  return value === 'night' ? 'night' : 'day';
}
