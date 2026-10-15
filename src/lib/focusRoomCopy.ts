const en = {
  computer: 'Computer', notebook: 'Writing', book: 'Reading', preparing: 'Getting ready', focusing: 'Focusing', break: 'On a break', away: 'Away',
  people: 'People', quiet: 'A quiet room. Audio chat is not available.', leave: 'Leave room', hint: 'Work quietly together. Choose a desk or move with the arrow keys.',
  space: 'Room space. Click to move your avatar.', sit: 'Sit here', occupied: 'Occupied', desk: 'Desk', empty: 'Real participants appear when they join.',
  move: 'Click the room or use arrow keys to move', connected: 'in this room', pause: 'Pause', start: 'Start focus', reset: 'Reset timer', minutes: 'min',
  personal: 'My quiet room', personalHint: 'Your private space. Join Together to focus with other people.', me: 'Me', level: 'Level',
};
type RoomCopy = { [K in keyof typeof en]: string };
const baseFocusRoomCopy: Record<'he' | 'en' | 'es' | 'zh' | 'ar' | 'ru', RoomCopy> = {
  en,
  he: { computer: 'מחשב', notebook: 'כתיבה', book: 'קריאה', preparing: 'מתארגן', focusing: 'בפוקוס', break: 'בהפסקה', away: 'לא זמין', people: 'משתתפים', quiet: 'חדר שקט. שיחה קולית אינה זמינה.', leave: 'יציאה מהחדר', hint: 'עובדים יחד בשקט. בחר שולחן או זוז באמצעות החצים.', space: 'מרחב החדר. לחץ להזזת הדמות.', sit: 'שב כאן', occupied: 'תפוס', desk: 'שולחן', empty: 'משתתפים אמיתיים יופיעו כשיצטרפו.', move: 'לחץ במרחב או השתמש בחצים כדי לזוז', connected: 'בחדר עכשיו', pause: 'השהה', start: 'התחל פוקוס', reset: 'אפס טיימר', minutes: 'דקות', personal: 'החדר השקט שלי', personalHint: 'מרחב אישי. לפוקוס עם אנשים נוספים היכנס ל־Together.', me: 'אני', level: 'רמה' },
  es: { computer: 'Ordenador', notebook: 'Escritura', book: 'Lectura', preparing: 'Preparándose', focusing: 'Concentrado', break: 'En descanso', away: 'Ausente', people: 'Participantes', quiet: 'Sala silenciosa. El chat de voz no está disponible.', leave: 'Salir de la sala', hint: 'Trabaja en silencio. Elige un escritorio o usa las flechas.', space: 'Sala. Haz clic para mover tu avatar.', sit: 'Sentarse aquí', occupied: 'Ocupado', desk: 'Escritorio', empty: 'Los participantes reales aparecen al unirse.', move: 'Haz clic o usa las flechas para moverte', connected: 'en esta sala', pause: 'Pausar', start: 'Concentrarse', reset: 'Reiniciar temporizador', minutes: 'min', personal: 'Mi sala tranquila', personalHint: 'Tu espacio privado. Entra en Together para trabajar con otras personas.', me: 'Yo', level: 'Nivel' },
  zh: { computer: '电脑', notebook: '写作', book: '阅读', preparing: '准备中', focusing: '专注中', break: '休息中', away: '离开', people: '参与者', quiet: '安静房间，暂不支持语音聊天。', leave: '离开房间', hint: '安静地一起学习。选择座位或使用方向键移动。', space: '点击房间来移动你的角色。', sit: '坐在这里', occupied: '已占用', desk: '书桌', empty: '真实参与者加入后会出现在这里。', move: '点击房间或使用方向键移动', connected: '人在房间内', pause: '暂停', start: '开始专注', reset: '重置计时器', minutes: '分钟', personal: '我的安静房间', personalHint: '这是你的私人空间。前往 Together 与他人一起专注。', me: '我', level: '等级' },
  ar: { computer: 'حاسوب', notebook: 'كتابة', book: 'قراءة', preparing: 'يستعد', focusing: 'يركز', break: 'في استراحة', away: 'غير متاح', people: 'المشاركون', quiet: 'غرفة هادئة. المحادثة الصوتية غير متاحة.', leave: 'مغادرة الغرفة', hint: 'اعملوا معاً بهدوء. اختر مكتباً أو استخدم الأسهم للتحرك.', space: 'مساحة الغرفة. انقر لتحريك شخصيتك.', sit: 'اجلس هنا', occupied: 'مشغول', desk: 'مكتب', empty: 'يظهر المشاركون الحقيقيون عند انضمامهم.', move: 'انقر في الغرفة أو استخدم الأسهم للتحرك', connected: 'في الغرفة الآن', pause: 'إيقاف مؤقت', start: 'ابدأ التركيز', reset: 'إعادة ضبط المؤقت', minutes: 'دقائق', personal: 'غرفتي الهادئة', personalHint: 'مساحتك الخاصة. انضم إلى Together للتركيز مع الآخرين.', me: 'أنا', level: 'المستوى' },
  ru: { computer: 'Компьютер', notebook: 'Письмо', book: 'Чтение', preparing: 'Подготовка', focusing: 'В фокусе', break: 'Перерыв', away: 'Отошёл', people: 'Участники', quiet: 'Тихая комната. Голосовой чат недоступен.', leave: 'Выйти', hint: 'Работайте вместе в тишине. Выберите стол или двигайтесь стрелками.', space: 'Нажмите в комнате, чтобы переместить аватар.', sit: 'Сесть здесь', occupied: 'Занято', desk: 'Стол', empty: 'Реальные участники появятся после подключения.', move: 'Нажмите в комнате или используйте стрелки', connected: 'в комнате', pause: 'Пауза', start: 'Начать фокус', reset: 'Сбросить таймер', minutes: 'мин', personal: 'Моя тихая комната', personalHint: 'Ваше личное пространство. В Together можно работать с другими людьми.', me: 'Я', level: 'Уровень' },
};

const roomNavigation = {
  he: { chooseDesk: 'בחר שולחן פנוי והתיישב', zoomIn: 'הגדלת החדר', zoomOut: 'הצגת החדר המלא' },
  en: { chooseDesk: 'Choose an empty desk and settle in', zoomIn: 'Zoom into the room', zoomOut: 'Show the full room' },
  es: { chooseDesk: 'Elige un escritorio libre y siéntate', zoomIn: 'Ampliar la sala', zoomOut: 'Ver toda la sala' },
  zh: { chooseDesk: '选择空桌并坐下', zoomIn: '放大房间', zoomOut: '显示整个房间' },
  ar: { chooseDesk: 'اختر مكتباً فارغاً واجلس', zoomIn: 'تكبير الغرفة', zoomOut: 'عرض الغرفة كاملة' },
  ru: { chooseDesk: 'Выберите свободный стол и садитесь', zoomIn: 'Увеличить комнату', zoomOut: 'Показать всю комнату' },
};
export const focusRoomCopy = Object.fromEntries(Object.entries(baseFocusRoomCopy).map(([language, copy]) => [language, {
  ...copy, ...roomNavigation[language as keyof typeof roomNavigation],
}])) as Record<keyof typeof baseFocusRoomCopy, RoomCopy & typeof roomNavigation.en>;
