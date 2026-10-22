export type RoomAtmosphere = 'library' | 'grand' | 'intimate' | 'plane' | 'airport' | 'cafe' | 'office';
// Curated focus-session lengths, not live airline schedules.
export const FOCUS_FLIGHTS = [
  { id: 'BCN-LHR', from: 'Barcelona', to: 'London', minutes: 135 },
  { id: 'CDG-FCO', from: 'Paris', to: 'Rome', minutes: 120 },
  { id: 'LHR-AMS', from: 'London', to: 'Amsterdam', minutes: 75 },
  { id: 'BCN-CDG', from: 'Barcelona', to: 'Paris', minutes: 110 },
  { id: 'TLV-LCA', from: 'Tel Aviv', to: 'Larnaca', minutes: 60 },
  { id: 'TLV-ATH', from: 'Tel Aviv', to: 'Athens', minutes: 120 },
  { id: 'TLV-FCO', from: 'Tel Aviv', to: 'Rome', minutes: 180 },
  { id: 'ATH-JTR', from: 'Athens', to: 'Santorini', minutes: 45 },
  { id: 'LIS-MAD', from: 'Lisbon', to: 'Madrid', minutes: 80 },
  { id: 'ZRH-VCE', from: 'Zurich', to: 'Venice', minutes: 70 },
  { id: 'CPH-BER', from: 'Copenhagen', to: 'Berlin', minutes: 65 },
  { id: 'JFK-BOS', from: 'New York', to: 'Boston', minutes: 75 },
  { id: 'SFO-LAX', from: 'San Francisco', to: 'Los Angeles', minutes: 90 },
  { id: 'YVR-SEA', from: 'Vancouver', to: 'Seattle', minutes: 55 },
  { id: 'MIA-NAS', from: 'Miami', to: 'Nassau', minutes: 60 },
  { id: 'HND-ITM', from: 'Tokyo', to: 'Osaka', minutes: 75 },
  { id: 'ICN-KIX', from: 'Seoul', to: 'Osaka', minutes: 110 },
  { id: 'SIN-KUL', from: 'Singapore', to: 'Kuala Lumpur', minutes: 65 },
  { id: 'SYD-MEL', from: 'Sydney', to: 'Melbourne', minutes: 95 },
  { id: 'AKL-WLG', from: 'Auckland', to: 'Wellington', minutes: 65 },
  { id: 'DXB-DOH', from: 'Dubai', to: 'Doha', minutes: 70 },
  { id: 'RAK-CMN', from: 'Marrakesh', to: 'Casablanca', minutes: 50 },
] as const;
export const roomJourneyCopy = {
  he: ['אווירת החדר', 'ספרייה קלאסית', 'הספרייה הגדולה', 'ספרייה אינטימית', 'מטוס', 'טרמינל שדה תעופה', 'בית קפה', 'משרד', 'מסלול ריכוז', 'הגדר זמן לפי המסלול', 'דקות', 'זמנים משוערים לחוויית ריכוז, לא לוח טיסות. שינוי האווירה אישי; המשתתפים נשארים באותו חדר.', 'בשער', 'המראה', 'בשיוט', 'נחיתה', 'אפשר לשנות מסלול לאחר איפוס הסשן.'],
  en: ['Room atmosphere', 'Classic library', 'Grand library', 'Intimate library', 'Aircraft', 'Airport terminal', 'Cafe', 'Office', 'Focus route', 'Use route duration', 'minutes', 'Approximate focus durations, not flight schedules. Atmosphere is personal; participants stay in the same room.', 'At the gate', 'Takeoff', 'Cruising', 'Landed', 'Reset the session before changing route.'],
  es: ['Ambiente', 'Biblioteca clásica', 'Gran biblioteca', 'Biblioteca íntima', 'Avión', 'Terminal de aeropuerto', 'Café', 'Oficina', 'Ruta de concentración', 'Usar duración de ruta', 'minutos', 'Duraciones aproximadas de concentración, no horarios de vuelos. El ambiente es personal; todos siguen en la misma sala.', 'En la puerta', 'Despegue', 'En vuelo', 'Aterrizado', 'Reinicia la sesión para cambiar la ruta.'],
  zh: ['房间氛围', '经典图书馆', '大型图书馆', '小型图书馆', '飞机', '机场航站楼', '咖啡馆', '办公室', '专注航线', '使用航线时长', '分钟', '专注时长为估算，并非航班时刻。氛围为个人设置，参与者仍在同一房间。', '登机口', '起飞', '巡航', '已降落', '重置专注后再更改航线。'],
  ar: ['أجواء الغرفة', 'مكتبة كلاسيكية', 'مكتبة كبيرة', 'مكتبة صغيرة', 'طائرة', 'صالة المطار', 'مقهى', 'مكتب', 'مسار التركيز', 'استخدام مدة المسار', 'دقيقة', 'مدد تقريبية للتركيز وليست مواعيد رحلات. الأجواء شخصية ويبقى الجميع في الغرفة نفسها.', 'عند البوابة', 'إقلاع', 'تحليق', 'هبوط', 'أعد ضبط الجلسة قبل تغيير المسار.'],
  ru: ['Атмосфера', 'Классическая библиотека', 'Большая библиотека', 'Уютная библиотека', 'Самолёт', 'Терминал аэропорта', 'Кафе', 'Офис', 'Маршрут фокуса', 'Использовать время маршрута', 'минут', 'Примерное время фокуса, не расписание рейсов. Атмосфера личная, участники остаются в одной комнате.', 'У выхода', 'Взлёт', 'В полёте', 'Посадка', 'Сбросьте сессию перед сменой маршрута.'],
} as const;

export function flightPhase(elapsed: number, duration: number, started: boolean) {
  if (!started) return 12;
  if (elapsed >= duration) return 15;
  return elapsed < Math.min(90, duration * .1) ? 13 : 14;
}
