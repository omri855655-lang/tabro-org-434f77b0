import type { AppLanguage } from './appLanguage';

type StudyCopy = {
  title: string; hours: string; exam: string; difficulties: string; materials: string;
  file: string; save: string; saved: string; failed: string; privacy: string; reading: string;
  modes: [string, string, string, string, string];
  draft: string; draftHint: string; lesson: string; minutes: string; remove: string; confirm: string; cancel: string; empty: string;
};
export const courseStudyCopy: Record<AppLanguage, StudyCopy> = {
  he: {
    title: 'מרחב הלימוד שלי', hours: 'שעות לימוד בשבוע', exam: 'תאריך מבחן או הגשה', difficulties: 'איפה אני מתקשה?', materials: 'חומר נוסף ורשימת קריאה',
    file: 'צירוף חומר (PDF / TXT / MD)', save: 'שמור העדפות', saved: 'נשמר במכשיר הזה', failed: 'לא הצלחנו לשמור או לקרוא את הנתונים. נסה שוב.', reading: 'קורא את הקובץ...',
    privacy: 'העדפות וחומר נוסף נשמרים בדפדפן הזה בלבד. הם נשלחים ל־AI רק בעת שליחת שאלה. עד 2,500 תווים של חומר נוסף נכללים; בחר את הקטע החשוב.',
    modes: ['תוכנית שבועית', 'עזרה בקושי', 'תרגול למבחן', 'תכנון עבודה', 'קריאה והעשרה'],
    draft: 'טיוטת שיעורים לאישור', draftHint: 'אפשר לערוך ולהסיר לפני השמירה. יתווספו רק כותרות חדשות; שיעורים קיימים, תאריכים והתקדמות לא יימחקו. משכי הלימוד הם הערכה.', lesson: 'כותרת השיעור', minutes: 'דקות משוערות', remove: 'הסר', confirm: 'אשר והוסף שיעורים', cancel: 'ביטול', empty: 'אין שיעורים חדשים להוספה',
  },
  en: {
    title: 'My study workspace', hours: 'Study hours per week', exam: 'Exam or submission date', difficulties: 'Where do I struggle?', materials: 'Extra material and reading list',
    file: 'Attach material (PDF / TXT / MD)', save: 'Save preferences', saved: 'Saved on this device', failed: 'Could not save or read the data. Try again.', reading: 'Reading file...',
    privacy: 'Preferences and extra material stay in this browser. They are sent to AI only when you send a question. Up to 2,500 extra-material characters are included; choose the relevant excerpt.',
    modes: ['Weekly plan', 'Help with difficulties', 'Exam practice', 'Assignment planning', 'Reading and enrichment'],
    draft: 'Review lesson draft', draftHint: 'Edit or remove before saving. Only new titles are added; existing lessons, dates and progress are preserved. Study durations are estimates.', lesson: 'Lesson title', minutes: 'Estimated minutes', remove: 'Remove', confirm: 'Approve and add lessons', cancel: 'Cancel', empty: 'No new lessons to add',
  },
  ar: {
    title: 'مساحة دراستي', hours: 'ساعات الدراسة أسبوعياً', exam: 'تاريخ الامتحان أو التسليم', difficulties: 'أين أواجه صعوبة؟', materials: 'مواد إضافية وقائمة القراءة',
    file: 'إرفاق مادة (PDF / TXT / MD)', save: 'حفظ التفضيلات', saved: 'تم الحفظ على هذا الجهاز', failed: 'تعذّر حفظ البيانات أو قراءتها. حاول مجدداً.', reading: 'جارٍ قراءة الملف...',
    privacy: 'تبقى التفضيلات والمواد في هذا المتصفح، وتُرسل للذكاء الاصطناعي فقط عند إرسال سؤال. يتم تضمين 2,500 حرف إضافي كحد أقصى؛ اختر المقطع المناسب.',
    modes: ['خطة أسبوعية', 'مساعدة في الصعوبات', 'تدريب للامتحان', 'تخطيط الواجب', 'قراءة وإثراء'],
    draft: 'مراجعة مسودة الدروس', draftHint: 'عدّل أو احذف قبل الحفظ. تُضاف العناوين الجديدة فقط مع الاحتفاظ بالدروس والتواريخ والتقدم. المدد تقديرية.', lesson: 'عنوان الدرس', minutes: 'الدقائق المقدرة', remove: 'إزالة', confirm: 'تأكيد وإضافة الدروس', cancel: 'إلغاء', empty: 'لا توجد دروس جديدة للإضافة',
  },
  es: {
    title: 'Mi espacio de estudio', hours: 'Horas de estudio por semana', exam: 'Fecha de examen o entrega', difficulties: '¿Dónde tengo dificultades?', materials: 'Material adicional y lecturas',
    file: 'Adjuntar material (PDF / TXT / MD)', save: 'Guardar preferencias', saved: 'Guardado en este dispositivo', failed: 'No se pudieron guardar o leer los datos. Inténtalo de nuevo.', reading: 'Leyendo archivo...',
    privacy: 'Las preferencias y el material se guardan en este navegador. Solo se envían a la IA al enviar una pregunta. Se incluyen hasta 2.500 caracteres adicionales; elige el fragmento relevante.',
    modes: ['Plan semanal', 'Ayuda con dificultades', 'Práctica de examen', 'Planificar un trabajo', 'Lecturas y ampliación'],
    draft: 'Revisar borrador de lecciones', draftHint: 'Edita o elimina antes de guardar. Solo se añaden títulos nuevos; se conservan las lecciones, fechas y avances. Las duraciones son estimadas.', lesson: 'Título de la lección', minutes: 'Minutos estimados', remove: 'Quitar', confirm: 'Aprobar y añadir lecciones', cancel: 'Cancelar', empty: 'No hay lecciones nuevas',
  },
  ru: {
    title: 'Моё учебное пространство', hours: 'Часы учёбы в неделю', exam: 'Дата экзамена или сдачи', difficulties: 'Что вызывает трудности?', materials: 'Дополнительные материалы и чтение',
    file: 'Прикрепить материал (PDF / TXT / MD)', save: 'Сохранить настройки', saved: 'Сохранено на этом устройстве', failed: 'Не удалось сохранить или прочитать данные. Повторите попытку.', reading: 'Чтение файла...',
    privacy: 'Настройки и материалы хранятся в этом браузере и передаются ИИ только при отправке вопроса. Включается до 2500 дополнительных символов; выберите нужный фрагмент.',
    modes: ['План на неделю', 'Разобрать трудности', 'Подготовка к экзамену', 'План работы', 'Чтение и углубление'],
    draft: 'Проверка черновика занятий', draftHint: 'Измените или удалите перед сохранением. Добавляются только новые названия; занятия, даты и прогресс сохраняются. Длительность приблизительная.', lesson: 'Название занятия', minutes: 'Примерно минут', remove: 'Убрать', confirm: 'Подтвердить и добавить', cancel: 'Отмена', empty: 'Нет новых занятий',
  },
  zh: {
    title: '我的学习空间', hours: '每周学习小时数', exam: '考试或提交日期', difficulties: '我在哪些方面有困难？', materials: '补充材料和阅读清单',
    file: '附加材料 (PDF / TXT / MD)', save: '保存偏好', saved: '已保存在此设备', failed: '无法保存或读取数据，请重试。', reading: '正在读取文件...',
    privacy: '偏好和材料仅保存在此浏览器中，只有发送问题时才发送给 AI。补充材料最多包含 2,500 个字符，请选择相关片段。',
    modes: ['每周计划', '难点辅导', '考试练习', '作业规划', '阅读与拓展'],
    draft: '审核课程草稿', draftHint: '保存前可编辑或移除。仅添加新标题，保留现有课程、日期和进度。学习时长为估算值。', lesson: '课程标题', minutes: '预计分钟数', remove: '移除', confirm: '确认并添加课程', cancel: '取消', empty: '没有可添加的新课程',
  },
};

export const studyModeInstructions = [
  'Create a realistic weekly study plan using my available hours and syllabus. Ask about missing constraints. Do not invent required lessons or dates.',
  'Ask me one diagnostic question about my difficulties, then explain with examples and check my understanding.',
  'Help me prepare for the exam with one practice question at a time. Wait for my answer before feedback. Clearly label practice questions, not predicted exam questions.',
  'Help me plan my assignment. Ask for the official brief and rubric, then suggest an outline, research steps and milestones. Do not invent sources or write work to misrepresent as my own.',
  'Suggest enrichment reading, distinguishing syllabus requirements from optional resources. Do not invent citations or links. Label unverified suggestions and provide search terms when uncertain.',
] as const;
