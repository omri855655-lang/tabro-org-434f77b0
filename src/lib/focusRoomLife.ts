export const roomLifeCopy={
  he:['חיים בחדר','דמויות אווירה ממוחשבות','צליל סביבה','השתק','עוצמת צליל'],
  en:['Room life','Computer-controlled scenery characters','Ambient sound','Mute','Sound volume'],
  es:['Vida en la sala','Personajes ambientales controlados por ordenador','Sonido ambiental','Silenciar','Volumen'],
  zh:['房间氛围','电脑控制的环境角色','环境音效','静音','音量'],
  ar:['حيوية الغرفة','شخصيات بيئية يتحكم بها الحاسوب','صوت محيطي','كتم','مستوى الصوت'],
  ru:['Жизнь комнаты','Персонажи окружения под управлением компьютера','Звуки окружения','Выключить звук','Громкость'],
};

// Scenery never enters room membership or presence data.
export function sceneryTargets(seconds:number) {
  const stops=[{x:12,y:28},{x:12,y:84},{x:88,y:84},{x:88,y:28}];
  const step=Math.floor(Math.max(0,seconds)/24)%stops.length;
  return [stops[step],stops[(step+2)%stops.length]];
}
