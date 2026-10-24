export type RoomDaylight = 'auto' | 'day' | 'sunset' | 'night';
export type RoomWeather = 'clear' | 'rain';
export function parseRoomDaylight(value: unknown): RoomDaylight {
  return value === 'day' || value === 'sunset' || value === 'night' ? value : 'auto';
}
export function parseRoomWeather(value: unknown): RoomWeather { return value === 'rain' ? 'rain' : 'clear'; }
export function resolveRoomDaylight(value: RoomDaylight, hour = new Date().getHours()): Exclude<RoomDaylight, 'auto'> {
  if (value !== 'auto') return value;
  // A local-clock ambience, not a geolocated sunrise or weather forecast.
  return hour >= 7 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'sunset' : 'night';
}
export function roomPixelRatio(deviceRatio: number, width: number, height: number, detailed: boolean) {
  const area = Math.max(1, width * height);
  return Math.max(.75, Math.min(deviceRatio || 1, detailed ? 2 : 1.5, Math.sqrt(2_800_000 / area)));
}
export const atmosphereCopy = {
  he: { settings: 'עיצוב ואווירה', quiet: 'תצוגה שקטה', restore: 'הצג את כלי החדר', light: 'תאורה', auto: 'לפי השעה במכשיר', day: 'אור יום', sunset: 'שעת זהב', night: 'לילה', weather: 'נוף ומזג אוויר', clear: 'בהיר', rain: 'גשם עדין', note: 'האווירה לבחירתך, ולא תחזית מזג אוויר. שינויים אלה אישיים.', spaces: 'בחר מקום לשהות בו' },
  en: { settings: 'Design & atmosphere', quiet: 'Quiet view', restore: 'Show room controls', light: 'Lighting', auto: 'Device local time', day: 'Daylight', sunset: 'Golden hour', night: 'Night', weather: 'Scenery & weather', clear: 'Clear', rain: 'Gentle rain', note: 'Choose your own ambience, not a weather forecast. These settings are personal.', spaces: 'Find your place' },
  es: { settings: 'Diseño y ambiente', quiet: 'Vista tranquila', restore: 'Mostrar controles', light: 'Iluminación', auto: 'Hora local del dispositivo', day: 'Luz de día', sunset: 'Hora dorada', night: 'Noche', weather: 'Paisaje y clima', clear: 'Despejado', rain: 'Lluvia suave', note: 'Ambiente personal, no un pronóstico del tiempo.', spaces: 'Encuentra tu lugar' },
  zh: { settings: '设计与氛围', quiet: '安静视图', restore: '显示房间控件', light: '光线', auto: '设备本地时间', day: '日光', sunset: '黄金时刻', night: '夜晚', weather: '风景与天气', clear: '晴朗', rain: '细雨', note: '选择个人氛围，并非天气预报。', spaces: '寻找你的空间' },
  ar: { settings: 'التصميم والأجواء', quiet: 'عرض هادئ', restore: 'إظهار أدوات الغرفة', light: 'الإضاءة', auto: 'الوقت المحلي للجهاز', day: 'ضوء النهار', sunset: 'الساعة الذهبية', night: 'الليل', weather: 'المنظر والطقس', clear: 'صافٍ', rain: 'مطر خفيف', note: 'أجواء شخصية تختارها وليست توقعات للطقس.', spaces: 'اختر مكانك' },
  ru: { settings: 'Дизайн и атмосфера', quiet: 'Спокойный вид', restore: 'Показать управление', light: 'Освещение', auto: 'Местное время устройства', day: 'Дневной свет', sunset: 'Золотой час', night: 'Ночь', weather: 'Пейзаж и погода', clear: 'Ясно', rain: 'Лёгкий дождь', note: 'Личная атмосфера, а не прогноз погоды.', spaces: 'Найдите своё место' },
} as const;
