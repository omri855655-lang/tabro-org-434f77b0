export const SCENERY_PRESETS = ['auto', 'new-york-high', 'tokyo-high', 'new-york-street', 'tokyo-street'] as const;
export type SceneryPreset = typeof SCENERY_PRESETS[number];
export function parseSceneryPreset(value: unknown): SceneryPreset {
  return SCENERY_PRESETS.includes(value as SceneryPreset) ? value as SceneryPreset : 'auto';
}
export function isReadingRoom(kind: string) { return ['library', 'grand', 'intimate', 'modern-library', 'heritage-library', 'monastery-library'].includes(kind); }
export const scenerySettingsCopy = {
  he: ['הנוף מחוץ לחדר', 'לפי סוג החדר', 'ניו יורק · קומה גבוהה', 'טוקיו · קומה גבוהה', 'ניו יורק · רחוב סואן', 'טוקיו · רחוב סואן', 'חלונות בספרייה', 'נופים מעוצבים בהשראת הערים, לא צילום או שידור חי. הבחירה אישית.'],
  en: ['Outside view', 'Match the room', 'New York · high floor', 'Tokyo · high floor', 'New York · busy street', 'Tokyo · busy street', 'Library windows', 'Designed city-inspired views, not photography or a live feed. Your selection is personal.'],
  es: ['Vista exterior', 'Según la sala', 'Nueva York · planta alta', 'Tokio · planta alta', 'Nueva York · calle animada', 'Tokio · calle animada', 'Ventanas de biblioteca', 'Vistas diseñadas e inspiradas en ciudades, no fotos ni vídeo en directo. Selección personal.'],
  zh: ['窗外景色', '匹配房间', '纽约 · 高层', '东京 · 高层', '纽约 · 繁忙街道', '东京 · 繁忙街道', '图书馆窗户', '城市灵感设计，并非照片或直播。选择仅对你生效。'],
  ar: ['المنظر الخارجي', 'حسب الغرفة', 'نيويورك · طابق مرتفع', 'طوكيو · طابق مرتفع', 'نيويورك · شارع حيوي', 'طوكيو · شارع حيوي', 'نوافذ المكتبة', 'مناظر مصممة بإلهام من المدن وليست صوراً أو بثاً مباشراً. اختيار شخصي.'],
  ru: ['Вид снаружи', 'По типу комнаты', 'Нью-Йорк · высокий этаж', 'Токио · высокий этаж', 'Нью-Йорк · оживлённая улица', 'Токио · оживлённая улица', 'Окна библиотеки', 'Авторские виды по мотивам городов, не фотографии и не трансляция. Личная настройка.'],
} as const;

/** Wrap only beyond the visible panorama, never reverse the vehicle on-screen. */
export function sceneryTravel(seconds: number, speed: number, offset = 0) { return ((seconds * speed + offset) % 180 + 180) % 180 - 90; }
