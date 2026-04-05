import { useState, useEffect, createContext, useContext, ReactNode } from "react";

type Language = "he" | "en" | "es" | "zh" | "ar";

const translations = {
  he: {
    personalArea: "אזור אישי", installApp: "התקנת אפליקציה", signOut: "התנתק", signedOutSuccess: "התנתקת בהצלחה", loading: "טוען...",
    dashboard: "דשבורד", personalTasks: "משימות אישיות", workTasks: "משימות עבודה", books: "ספרים", shows: "סדרות וסרטים", podcasts: "פודקאסטים", dailyRoutine: "לוז יומי", projects: "פרויקטים", courses: "קורסים", planner: "מתכנן לוז", deeply: "Deeply", settings: "הגדרות", challenges: "אתגרים",
    security: "אבטחה", pinCode: "קוד גישה (PIN)", pinDescription: "דרוש קוד 4 ספרות בכל כניסה לאתר", changePin: "שנה קוד גישה", setPin: "הגדר קוד גישה", enterNewCode: "הזן קוד חדש:", cancel: "ביטול",
    customDashboards: "דשבורדים מותאמים אישית", customDashboardsDesc: "צור דשבורדים מותאמים לעקוב אחר כל דבר שתרצה (למידה, כושר, מתכונים ועוד). הם יופיעו כלשוניות בסרגל העליון.", newDashboard: "דשבורד חדש", chooseTemplate: "בחר תבנית", taskList: "רשימת משימות (כולל דשבורד)", trackingList: "רשימת מעקב (כמו ספרים/פודקאסטים)", kanban: "קנבן (לביצוע → בבדיקה → הושלם)", custom: "מותאם אישית", dashboardName: "שם הדשבורד", dashboardNamePlaceholder: 'לדוגמה: "לימודים", "כושר", "מתכונים"', statuses: "סטטוסים (מופרדים בפסיק)", statusesDesc: "הסטטוסים שיופיעו בתפריט הבחירה של כל פריט", showInMainDashboard: "הצג סיכום בדשבורד הראשי", createDashboard: "צור דשבורד", addNewDashboard: "הוסף דשבורד חדש",
    showTabs: "הצגת לשוניות", showTabsDesc: "בחר אילו לשוניות יוצגו בסרגל העליון. לשוניות מוסתרות לא יופיעו אבל הנתונים שלהן נשמרים.", displayedInDashboard: "מוצג בדשבורד", language: "שפה", languageDesc: "בחר את שפת הממשק", hebrew: "עברית", english: "English",
    newTask: "משימה חדשה", deleteTask: "מחק משימה", export: "ייצוא", noSort: "ללא מיון", byStatus: "לפי סטטוס", byPlannedEnd: "לפי סיום מתוכנן", byCreatedAt: "לפי תאריך יצירה", byOverdue: "לפי חריגה", byUrgent: "לפי דחיפות", done: "בוצע", notStarted: "טרם החל", inProgress: "בטיפול", completionRate: "אחוז ביצוע", activeTasks: "משימות פעילות", completed: "בוצעו", archive: "ארכיון", noTasksYet: "אין משימות עדיין", noArchivedTasks: "אין משימות בארכיון", noCompletedTasks: "אין משימות שבוצעו", addFirstTask: "הוסף משימה ראשונה", share: "שתף", similarTasks: "משימות דומות:", moveToSheet: "העבר משימה לגליון אחר", task: "משימה:", moveToSheetLabel: "העבר לגליון:", moveTask: "העבר משימה", aiHelp: "עזרה מ-AI", gettingSuggestions: "מקבל הצעות...", loadingTasks: "טוען משימות...",
    addEvent: "הוסף אירוע", deleteEvent: "מחק אירוע", eventTitle: "כותרת", eventDescription: "תיאור", startTime: "שעת התחלה", endTime: "שעת סיום", category: "קטגוריה", allDay: "כל היום", save: "שמור", delete: "מחק", today: "היום", day: "יום", week: "שבוע", month: "חודש", year: "שנה",
    addRecurringTask: "הוסף משימה חוזרת", frequency: "תדירות", daily: "יומי", weekly: "שבועי", monthly: "חודשי", yearly: "שנתי", thriceWeekly: "3 פעמים בשבוע", flexible: "גמיש", selectDays: "בחר ימים", sun: "א׳", mon: "ב׳", tue: "ג׳", wed: "ד׳", thu: "ה׳", fri: "ו׳", sat: "ש׳",
    addBook: "הוסף ספר", addShow: "הוסף סדרה", addPodcast: "הוסף פודקאסט", title: "כותרת", author: "מחבר", host: "מנחה", status: "סטטוס", notes: "הערות", toRead: "לקרוא", reading: "קורא", read: "נקרא", toWatch: "לצפות", watching: "צופה", watched: "נצפה", toListen: "להאזין", listening: "מאזין", listened: "נשמע",
    addProject: "הוסף פרויקט", projectName: "שם הפרויקט", description: "תיאור", targetDate: "תאריך יעד", active: "פעיל", onHold: "בהמתנה", completedStatus: "הושלם",
    addCourse: "הוסף קורס", courseName: "שם הקורס", syllabus: "סילבוס", lessons: "שיעורים",
    add: "הוסף", edit: "ערוך", remove: "הסר", confirm: "אשר", close: "סגור", search: "חיפוש", filter: "סינון", all: "הכל", none: "ללא",
    contactForm: "פנייה / תמיכה",
  },
  en: {
    personalArea: "Personal Area", installApp: "Install App", signOut: "Sign Out", signedOutSuccess: "Signed out successfully", loading: "Loading...",
    dashboard: "Dashboard", personalTasks: "Personal Tasks", workTasks: "Work Tasks", books: "Books", shows: "Shows & Movies", podcasts: "Podcasts", dailyRoutine: "Daily Routine", projects: "Projects", courses: "Courses", planner: "Planner", deeply: "Deeply", settings: "Settings", challenges: "Challenges",
    security: "Security", pinCode: "Access Code (PIN)", pinDescription: "Require a 4-digit code on every login", changePin: "Change PIN", setPin: "Set PIN", enterNewCode: "Enter new code:", cancel: "Cancel",
    customDashboards: "Custom Dashboards", customDashboardsDesc: "Create custom dashboards to track anything you want.", newDashboard: "New Dashboard", chooseTemplate: "Choose Template", taskList: "Task List (with dashboard)", trackingList: "Tracking List", kanban: "Kanban", custom: "Custom", dashboardName: "Dashboard Name", dashboardNamePlaceholder: 'e.g. "Learning", "Fitness"', statuses: "Statuses (comma-separated)", statusesDesc: "Statuses in the selection menu", showInMainDashboard: "Show in main dashboard", createDashboard: "Create Dashboard", addNewDashboard: "Add New Dashboard",
    showTabs: "Tab Visibility", showTabsDesc: "Choose which tabs are displayed.", displayedInDashboard: "Displayed in dashboard", language: "Language", languageDesc: "Choose the interface language", hebrew: "עברית", english: "English",
    newTask: "New Task", deleteTask: "Delete Task", export: "Export", noSort: "No Sort", byStatus: "By Status", byPlannedEnd: "By Planned End", byCreatedAt: "By Created Date", byOverdue: "By Overdue", byUrgent: "By Urgency", done: "Done", notStarted: "Not Started", inProgress: "In Progress", completionRate: "Completion Rate", activeTasks: "Active Tasks", completed: "Completed", archive: "Archive", noTasksYet: "No tasks yet", noArchivedTasks: "No archived tasks", noCompletedTasks: "No completed tasks", addFirstTask: "Add first task", share: "Share", similarTasks: "Similar tasks:", moveToSheet: "Move task to another sheet", task: "Task:", moveToSheetLabel: "Move to sheet:", moveTask: "Move Task", aiHelp: "AI Help", gettingSuggestions: "Getting suggestions...", loadingTasks: "Loading tasks...",
    addEvent: "Add Event", deleteEvent: "Delete Event", eventTitle: "Title", eventDescription: "Description", startTime: "Start Time", endTime: "End Time", category: "Category", allDay: "All Day", save: "Save", delete: "Delete", today: "Today", day: "Day", week: "Week", month: "Month", year: "Year",
    addRecurringTask: "Add Recurring Task", frequency: "Frequency", daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly", thriceWeekly: "3 Times a Week", flexible: "Flexible", selectDays: "Select Days", sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat",
    addBook: "Add Book", addShow: "Add Show", addPodcast: "Add Podcast", title: "Title", author: "Author", host: "Host", status: "Status", notes: "Notes", toRead: "To Read", reading: "Reading", read: "Read", toWatch: "To Watch", watching: "Watching", watched: "Watched", toListen: "To Listen", listening: "Listening", listened: "Listened",
    addProject: "Add Project", projectName: "Project Name", description: "Description", targetDate: "Target Date", active: "Active", onHold: "On Hold", completedStatus: "Completed",
    addCourse: "Add Course", courseName: "Course Name", syllabus: "Syllabus", lessons: "Lessons",
    add: "Add", edit: "Edit", remove: "Remove", confirm: "Confirm", close: "Close", search: "Search", filter: "Filter", all: "All", none: "None",
    contactForm: "Contact / Support",
  },
  es: {
    personalArea: "Área Personal", installApp: "Instalar App", signOut: "Cerrar Sesión", signedOutSuccess: "Sesión cerrada", loading: "Cargando...",
    dashboard: "Panel", personalTasks: "Tareas Personales", workTasks: "Tareas de Trabajo", books: "Libros", shows: "Series y Películas", podcasts: "Podcasts", dailyRoutine: "Rutina Diaria", projects: "Proyectos", courses: "Cursos", planner: "Planificador", deeply: "Deeply", settings: "Ajustes", challenges: "Desafíos",
    security: "Seguridad", pinCode: "Código de Acceso (PIN)", pinDescription: "Requiere un código de 4 dígitos en cada inicio de sesión", changePin: "Cambiar PIN", setPin: "Establecer PIN", enterNewCode: "Ingresa nuevo código:", cancel: "Cancelar",
    customDashboards: "Paneles Personalizados", customDashboardsDesc: "Crea paneles personalizados para hacer seguimiento de lo que quieras.", newDashboard: "Nuevo Panel", chooseTemplate: "Elegir Plantilla", taskList: "Lista de Tareas", trackingList: "Lista de Seguimiento", kanban: "Kanban", custom: "Personalizado", dashboardName: "Nombre del Panel", dashboardNamePlaceholder: 'Ej: "Estudios", "Fitness"', statuses: "Estados (separados por coma)", statusesDesc: "Estados en el menú de selección", showInMainDashboard: "Mostrar en panel principal", createDashboard: "Crear Panel", addNewDashboard: "Agregar Nuevo Panel",
    showTabs: "Visibilidad de Pestañas", showTabsDesc: "Elige qué pestañas se muestran.", displayedInDashboard: "Mostrado en panel", language: "Idioma", languageDesc: "Elige el idioma de la interfaz", hebrew: "עברית", english: "English",
    newTask: "Nueva Tarea", deleteTask: "Eliminar Tarea", export: "Exportar", noSort: "Sin Orden", byStatus: "Por Estado", byPlannedEnd: "Por Fecha Final", byCreatedAt: "Por Fecha de Creación", byOverdue: "Por Vencido", byUrgent: "Por Urgencia", done: "Hecho", notStarted: "No Iniciado", inProgress: "En Progreso", completionRate: "Tasa de Completado", activeTasks: "Tareas Activas", completed: "Completadas", archive: "Archivo", noTasksYet: "No hay tareas aún", noArchivedTasks: "No hay tareas archivadas", noCompletedTasks: "No hay tareas completadas", addFirstTask: "Agregar primera tarea", share: "Compartir", similarTasks: "Tareas similares:", moveToSheet: "Mover tarea a otra hoja", task: "Tarea:", moveToSheetLabel: "Mover a hoja:", moveTask: "Mover Tarea", aiHelp: "Ayuda IA", gettingSuggestions: "Obteniendo sugerencias...", loadingTasks: "Cargando tareas...",
    addEvent: "Agregar Evento", deleteEvent: "Eliminar Evento", eventTitle: "Título", eventDescription: "Descripción", startTime: "Hora Inicio", endTime: "Hora Fin", category: "Categoría", allDay: "Todo el Día", save: "Guardar", delete: "Eliminar", today: "Hoy", day: "Día", week: "Semana", month: "Mes", year: "Año",
    addRecurringTask: "Agregar Tarea Recurrente", frequency: "Frecuencia", daily: "Diario", weekly: "Semanal", monthly: "Mensual", yearly: "Anual", thriceWeekly: "3 Veces por Semana", flexible: "Flexible", selectDays: "Seleccionar Días", sun: "Dom", mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb",
    addBook: "Agregar Libro", addShow: "Agregar Serie", addPodcast: "Agregar Podcast", title: "Título", author: "Autor", host: "Presentador", status: "Estado", notes: "Notas", toRead: "Por Leer", reading: "Leyendo", read: "Leído", toWatch: "Por Ver", watching: "Viendo", watched: "Visto", toListen: "Por Escuchar", listening: "Escuchando", listened: "Escuchado",
    addProject: "Agregar Proyecto", projectName: "Nombre del Proyecto", description: "Descripción", targetDate: "Fecha Objetivo", active: "Activo", onHold: "En Espera", completedStatus: "Completado",
    addCourse: "Agregar Curso", courseName: "Nombre del Curso", syllabus: "Programa", lessons: "Lecciones",
    add: "Agregar", edit: "Editar", remove: "Eliminar", confirm: "Confirmar", close: "Cerrar", search: "Buscar", filter: "Filtrar", all: "Todo", none: "Ninguno",
    contactForm: "Contacto / Soporte",
  },
  zh: {
    personalArea: "个人区域", installApp: "安装应用", signOut: "退出登录", signedOutSuccess: "已成功退出", loading: "加载中...",
    dashboard: "仪表板", personalTasks: "个人任务", workTasks: "工作任务", books: "书籍", shows: "剧集和电影", podcasts: "播客", dailyRoutine: "每日日程", projects: "项目", courses: "课程", planner: "日程规划", deeply: "Deeply", settings: "设置", challenges: "挑战",
    security: "安全", pinCode: "访问码 (PIN)", pinDescription: "每次登录需输入4位数字", changePin: "更改PIN", setPin: "设置PIN", enterNewCode: "输入新密码:", cancel: "取消",
    customDashboards: "自定义面板", customDashboardsDesc: "创建自定义面板来跟踪任何事物。", newDashboard: "新面板", chooseTemplate: "选择模板", taskList: "任务列表", trackingList: "跟踪列表", kanban: "看板", custom: "自定义", dashboardName: "面板名称", dashboardNamePlaceholder: '例如: "学习", "健身"', statuses: "状态（逗号分隔）", statusesDesc: "选择菜单中的状态", showInMainDashboard: "在主面板显示", createDashboard: "创建面板", addNewDashboard: "添加新面板",
    showTabs: "标签可见性", showTabsDesc: "选择显示哪些标签。", displayedInDashboard: "在面板显示", language: "语言", languageDesc: "选择界面语言", hebrew: "עברית", english: "English",
    newTask: "新任务", deleteTask: "删除任务", export: "导出", noSort: "不排序", byStatus: "按状态", byPlannedEnd: "按截止日期", byCreatedAt: "按创建日期", byOverdue: "按逾期", byUrgent: "按紧急", done: "完成", notStarted: "未开始", inProgress: "进行中", completionRate: "完成率", activeTasks: "活跃任务", completed: "已完成", archive: "归档", noTasksYet: "暂无任务", noArchivedTasks: "暂无归档任务", noCompletedTasks: "暂无已完成任务", addFirstTask: "添加第一个任务", share: "分享", similarTasks: "相似任务:", moveToSheet: "移动到其他工作表", task: "任务:", moveToSheetLabel: "移至:", moveTask: "移动任务", aiHelp: "AI助手", gettingSuggestions: "获取建议中...", loadingTasks: "加载任务中...",
    addEvent: "添加事件", deleteEvent: "删除事件", eventTitle: "标题", eventDescription: "描述", startTime: "开始时间", endTime: "结束时间", category: "类别", allDay: "全天", save: "保存", delete: "删除", today: "今天", day: "日", week: "周", month: "月", year: "年",
    addRecurringTask: "添加重复任务", frequency: "频率", daily: "每日", weekly: "每周", monthly: "每月", yearly: "每年", thriceWeekly: "每周3次", flexible: "弹性", selectDays: "选择日期", sun: "日", mon: "一", tue: "二", wed: "三", thu: "四", fri: "五", sat: "六",
    addBook: "添加书籍", addShow: "添加剧集", addPodcast: "添加播客", title: "标题", author: "作者", host: "主持人", status: "状态", notes: "笔记", toRead: "待读", reading: "在读", read: "已读", toWatch: "待看", watching: "在看", watched: "已看", toListen: "待听", listening: "在听", listened: "已听",
    addProject: "添加项目", projectName: "项目名称", description: "描述", targetDate: "目标日期", active: "活跃", onHold: "暂停", completedStatus: "已完成",
    addCourse: "添加课程", courseName: "课程名称", syllabus: "大纲", lessons: "课时",
    add: "添加", edit: "编辑", remove: "移除", confirm: "确认", close: "关闭", search: "搜索", filter: "筛选", all: "全部", none: "无",
    contactForm: "联系 / 支持",
  },
  ar: {
    personalArea: "المنطقة الشخصية", installApp: "تثبيت التطبيق", signOut: "تسجيل الخروج", signedOutSuccess: "تم تسجيل الخروج بنجاح", loading: "جاري التحميل...",
    dashboard: "لوحة المعلومات", personalTasks: "مهام شخصية", workTasks: "مهام العمل", books: "كتب", shows: "مسلسلات وأفلام", podcasts: "بودكاست", dailyRoutine: "الروتين اليومي", projects: "مشاريع", courses: "دورات", planner: "المخطط", deeply: "Deeply", settings: "الإعدادات", challenges: "تحديات",
    security: "الأمان", pinCode: "رمز الوصول (PIN)", pinDescription: "يتطلب رمزاً من 4 أرقام عند كل تسجيل دخول", changePin: "تغيير PIN", setPin: "تعيين PIN", enterNewCode: "أدخل الرمز الجديد:", cancel: "إلغاء",
    customDashboards: "لوحات مخصصة", customDashboardsDesc: "أنشئ لوحات مخصصة لتتبع أي شيء تريده.", newDashboard: "لوحة جديدة", chooseTemplate: "اختر قالب", taskList: "قائمة المهام", trackingList: "قائمة التتبع", kanban: "كانبان", custom: "مخصص", dashboardName: "اسم اللوحة", dashboardNamePlaceholder: 'مثال: "دراسة", "لياقة"', statuses: "الحالات (مفصولة بفاصلة)", statusesDesc: "الحالات في قائمة الاختيار", showInMainDashboard: "عرض في اللوحة الرئيسية", createDashboard: "إنشاء لوحة", addNewDashboard: "إضافة لوحة جديدة",
    showTabs: "إظهار التبويبات", showTabsDesc: "اختر التبويبات المعروضة.", displayedInDashboard: "معروض في اللوحة", language: "اللغة", languageDesc: "اختر لغة الواجهة", hebrew: "עברית", english: "English",
    newTask: "مهمة جديدة", deleteTask: "حذف مهمة", export: "تصدير", noSort: "بدون ترتيب", byStatus: "حسب الحالة", byPlannedEnd: "حسب الموعد النهائي", byCreatedAt: "حسب تاريخ الإنشاء", byOverdue: "حسب التأخير", byUrgent: "حسب الأولوية", done: "تم", notStarted: "لم يبدأ", inProgress: "قيد التنفيذ", completionRate: "نسبة الإنجاز", activeTasks: "مهام نشطة", completed: "مكتملة", archive: "أرشيف", noTasksYet: "لا توجد مهام بعد", noArchivedTasks: "لا توجد مهام مؤرشفة", noCompletedTasks: "لا توجد مهام مكتملة", addFirstTask: "أضف أول مهمة", share: "مشاركة", similarTasks: "مهام مشابهة:", moveToSheet: "نقل إلى ورقة أخرى", task: "مهمة:", moveToSheetLabel: "نقل إلى:", moveTask: "نقل مهمة", aiHelp: "مساعدة AI", gettingSuggestions: "جاري الحصول على اقتراحات...", loadingTasks: "جاري تحميل المهام...",
    addEvent: "إضافة حدث", deleteEvent: "حذف حدث", eventTitle: "العنوان", eventDescription: "الوصف", startTime: "وقت البدء", endTime: "وقت الانتهاء", category: "الفئة", allDay: "طوال اليوم", save: "حفظ", delete: "حذف", today: "اليوم", day: "يوم", week: "أسبوع", month: "شهر", year: "سنة",
    addRecurringTask: "إضافة مهمة متكررة", frequency: "التكرار", daily: "يومي", weekly: "أسبوعي", monthly: "شهري", yearly: "سنوي", thriceWeekly: "3 مرات أسبوعياً", flexible: "مرن", selectDays: "اختر الأيام", sun: "أحد", mon: "اثن", tue: "ثلا", wed: "أرب", thu: "خمي", fri: "جمع", sat: "سبت",
    addBook: "إضافة كتاب", addShow: "إضافة مسلسل", addPodcast: "إضافة بودكاست", title: "العنوان", author: "المؤلف", host: "المقدم", status: "الحالة", notes: "ملاحظات", toRead: "للقراءة", reading: "أقرأ", read: "مقروء", toWatch: "للمشاهدة", watching: "أشاهد", watched: "شوهد", toListen: "للاستماع", listening: "أستمع", listened: "سُمع",
    addProject: "إضافة مشروع", projectName: "اسم المشروع", description: "الوصف", targetDate: "التاريخ المستهدف", active: "نشط", onHold: "معلق", completedStatus: "مكتمل",
    addCourse: "إضافة دورة", courseName: "اسم الدورة", syllabus: "المنهج", lessons: "الدروس",
    add: "إضافة", edit: "تعديل", remove: "إزالة", confirm: "تأكيد", close: "إغلاق", search: "بحث", filter: "تصفية", all: "الكل", none: "لا شيء",
    contactForm: "اتصل بنا / دعم",
  },
} as const;

type TranslationKey = keyof typeof translations.he;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  dir: "rtl" | "ltr";
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "he",
  setLang: () => {},
  t: (key) => translations.he[key],
  dir: "rtl",
});

const RTL_LANGS: Language[] = ["he", "ar"];

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem("app-language") as Language) || "he";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("app-language", newLang);
  };

  useEffect(() => {
    const isRtl = RTL_LANGS.includes(lang);
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: TranslationKey): string => {
    return translations[lang]?.[key] || translations.he[key] || key;
  };

  const dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
