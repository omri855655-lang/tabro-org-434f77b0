import { useState, useEffect, createContext, useContext, ReactNode } from "react";

type Language = "he" | "en" | "es" | "zh" | "ar" | "ru";

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
    recycleBin: "סל מחזור", emptyBin: "רוקן סל", recycleBinEmpty: "סל המחזור ריק", recycleBinNote: "פריטים נמחקים אוטומטית לאחר 7 ימים", restore: "שחזר", deletedAt: "נמחק", permanentDelete: "מחק לצמיתות",
    email: "מייל", emailAccounts: "חשבונות מייל", addConnection: "חבר חשבון", connectEmail: "חיבור חשבון מייל", chooseProvider: "בחר ספק מייל:", emailAddress: "כתובת מייל", noEmailConnections: "אין חשבונות מייל מחוברים", connectEmailDesc: "חבר Gmail, Outlook או IMAP לניתוח אוטומטי", lastSync: "סנכרון אחרון", neverSynced: "לא סונכרן", sync: "סנכרן", confirmDisconnect: "לנתק את חשבון המייל?", emailSummary: "סיכום מיילים", recentEmails: "מיילים אחרונים", emailInsights: "תובנות מייל", emailsAnalyzed: "מיילים נותחו", oauthNote: "לאחר שמירה, תתבצע הפנייה לאימות חשבון.", password: "סיסמה", back: "חזור", connect: "חבר",
    editItem: "עריכת פריט",
    // New keys - tabs
    nutrition: "תזונה ושינה", dreams: "מפת חלומות", shopping: "קניות", payments: "הכנסות והוצאות", notesTab: "פתקים", sharingTab: "שיתופים",
    // Accessibility
    accessibilitySettings: "הגדרות נגישות", fontSize: "גודל גופן", highContrast: "ניגודיות גבוהה", disableAnimations: "השבת אנימציות", bigCursor: "סמן מוגדל", highlightLinks: "הדגש קישורים", reset: "איפוס", accessibilityStatement: "הצהרת נגישות", skipToContent: "דלג לתוכן הראשי", reduceFontSize: "הקטן גופן", increaseFontSize: "הגדל גופן",
    // Credit card
    creditCard: "כרטיס אשראי", connectCreditCard: "חבר כרטיס אשראי", creditCardProvider: "חברת אשראי", username: "שם משתמש", syncNow: "סנכרן עכשיו", importCSV: "ייבוא קובץ CSV", importCreditCard: "ייבוא פירוט אשראי", transactions: "עסקאות", noTransactions: "אין עסקאות", lastFourDigits: "4 ספרות אחרונות", cardDisplayName: "שם הכרטיס", syncing: "מסנכרן...", syncSuccess: "סנכרון הושלם", syncError: "שגיאה בסנכרון", disconnectCard: "נתק כרטיס", confirmDisconnectCard: "לנתק את כרטיס האשראי?",
    // Bank connections
    bankConnections: "חיבורי בנק ואשראי", connectBank: "חבר בנק", bankConnectStarted: "נפתח חלון חיבור בנק", bankConnectError: "שגיאה בחיבור בנק", bankDisconnected: "חיבור בנק נמחק", noBankConnections: "אין חיבורי בנק. לחץ 'חבר בנק' כדי להתחיל.", syncComplete: "סנכרון הושלם", deleteError: "שגיאה במחיקה", loginRequired: "יש להתחבר מחדש", emailConnected: "חשבון מייל חובר", oauthError: "שגיאה בפתיחת OAuth", bankAndCredit: "בנק ואשראי",
    // Settings extras
    changePassword: "שנה סיסמה", currentPassword: "סיסמה נוכחית", newPassword: "סיסמה חדשה", confirmPassword: "אימות סיסמה", passwordChanged: "הסיסמה שונתה בהצלחה", passwordMismatch: "הסיסמאות לא תואמות", theme: "ערכת נושא", darkMode: "מצב כהה", lightMode: "מצב בהיר", systemMode: "לפי המערכת",
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
    recycleBin: "Recycle Bin", emptyBin: "Empty Bin", recycleBinEmpty: "Recycle bin is empty", recycleBinNote: "Items are automatically deleted after 7 days", restore: "Restore", deletedAt: "Deleted", permanentDelete: "Delete permanently",
    email: "Email", emailAccounts: "Email Accounts", addConnection: "Connect Account", connectEmail: "Connect Email Account", chooseProvider: "Choose email provider:", emailAddress: "Email Address", noEmailConnections: "No email accounts connected", connectEmailDesc: "Connect Gmail, Outlook or IMAP for automatic analysis", lastSync: "Last sync", neverSynced: "Never synced", sync: "Sync", confirmDisconnect: "Disconnect email account?", emailSummary: "Email Summary", recentEmails: "Recent Emails", emailInsights: "Email Insights", emailsAnalyzed: "emails analyzed", oauthNote: "After saving, you'll be redirected for authentication.", password: "Password", back: "Back", connect: "Connect",
    editItem: "Edit Item",
    nutrition: "Nutrition & Sleep", dreams: "Dream Map", shopping: "Shopping", payments: "Income & Expenses", notesTab: "Notes", sharingTab: "Sharing",
    accessibilitySettings: "Accessibility Settings", fontSize: "Font Size", highContrast: "High Contrast", disableAnimations: "Disable Animations", bigCursor: "Large Cursor", highlightLinks: "Highlight Links", reset: "Reset", accessibilityStatement: "Accessibility Statement", skipToContent: "Skip to main content", reduceFontSize: "Reduce font size", increaseFontSize: "Increase font size",
    creditCard: "Credit Card", connectCreditCard: "Connect Credit Card", creditCardProvider: "Card Provider", username: "Username", syncNow: "Sync Now", importCSV: "Import CSV", importCreditCard: "Import Credit Card Statement", transactions: "Transactions", noTransactions: "No transactions", lastFourDigits: "Last 4 digits", cardDisplayName: "Card Name", syncing: "Syncing...", syncSuccess: "Sync complete", syncError: "Sync error", disconnectCard: "Disconnect Card", confirmDisconnectCard: "Disconnect this credit card?",
    a11yCommitment: "Commitment to Accessibility", a11yCommitmentText: "We are committed to making Tabro accessible to all users, including people with disabilities, in compliance with WCAG 2.1 Level AA guidelines.", a11yWhatWeDid: "What We Did", a11yLimitations: "Known Limitations", a11yLimitationsText: "Some components may not yet be fully accessible. We are continuously working to improve accessibility.", a11yContact: "Contact Us", a11yContactText: "Encountered an accessibility issue? We'd love to hear from you. Please reach out through the contact form on the site.", lastUpdated: "Last updated",
    a11yFeatureKeyboard: "Full keyboard navigation support", a11yFeatureRtl: "RTL (right-to-left) support for Hebrew", a11yFeatureHeadings: "Proper heading hierarchy (H1-H6)", a11yFeatureAria: "ARIA labels on interactive elements", a11yFeatureContrast: "Sufficient color contrast", a11yFeatureSkip: "Skip to content link for quick navigation", a11yFeatureTheme: "Dark and light modes for viewing comfort", a11yFeatureForms: "Forms with clear labels and error messages",
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
    recycleBin: "Papelera", emptyBin: "Vaciar papelera", recycleBinEmpty: "La papelera está vacía", recycleBinNote: "Los elementos se eliminan automáticamente después de 7 días", restore: "Restaurar", deletedAt: "Eliminado", permanentDelete: "Eliminar permanentemente",
    email: "Correo", emailAccounts: "Cuentas de correo", addConnection: "Conectar cuenta", connectEmail: "Conectar cuenta de correo", chooseProvider: "Elige proveedor:", emailAddress: "Dirección de correo", noEmailConnections: "Sin cuentas conectadas", connectEmailDesc: "Conecta Gmail, Outlook o IMAP para análisis automático", lastSync: "Última sincronización", neverSynced: "Nunca sincronizado", sync: "Sincronizar", confirmDisconnect: "¿Desconectar cuenta?", emailSummary: "Resumen de correos", recentEmails: "Correos recientes", emailInsights: "Análisis de correos", emailsAnalyzed: "correos analizados", oauthNote: "Después de guardar, serás redirigido para autenticación.", password: "Contraseña", back: "Atrás", connect: "Conectar",
    editItem: "Editar elemento",
    nutrition: "Nutrición y Sueño", dreams: "Mapa de Sueños", shopping: "Compras", payments: "Ingresos y Gastos", notesTab: "Notas", sharingTab: "Compartir",
    accessibilitySettings: "Configuración de Accesibilidad", fontSize: "Tamaño de fuente", highContrast: "Alto contraste", disableAnimations: "Desactivar animaciones", bigCursor: "Cursor grande", highlightLinks: "Resaltar enlaces", reset: "Restablecer", accessibilityStatement: "Declaración de accesibilidad", skipToContent: "Saltar al contenido principal", reduceFontSize: "Reducir fuente", increaseFontSize: "Aumentar fuente",
    creditCard: "Tarjeta de crédito", connectCreditCard: "Conectar tarjeta", creditCardProvider: "Proveedor", username: "Usuario", syncNow: "Sincronizar", importCSV: "Importar CSV", importCreditCard: "Importar extracto", transactions: "Transacciones", noTransactions: "Sin transacciones", lastFourDigits: "Últimos 4 dígitos", cardDisplayName: "Nombre de tarjeta", syncing: "Sincronizando...", syncSuccess: "Sincronización completa", syncError: "Error de sincronización", disconnectCard: "Desconectar tarjeta", confirmDisconnectCard: "¿Desconectar esta tarjeta?",
    a11yCommitment: "Compromiso con la accesibilidad", a11yCommitmentText: "Nos comprometemos a hacer Tabro accesible para todos los usuarios, incluidas las personas con discapacidades, conforme a las pautas WCAG 2.1 Nivel AA.", a11yWhatWeDid: "Qué hicimos", a11yLimitations: "Limitaciones conocidas", a11yLimitationsText: "Algunos componentes pueden no ser completamente accesibles aún. Trabajamos continuamente para mejorar.", a11yContact: "Contacto", a11yContactText: "¿Encontraste un problema de accesibilidad? Contáctanos a través del formulario del sitio.", lastUpdated: "Última actualización",
    a11yFeatureKeyboard: "Navegación completa por teclado", a11yFeatureRtl: "Soporte RTL para hebreo", a11yFeatureHeadings: "Jerarquía de encabezados correcta", a11yFeatureAria: "Etiquetas ARIA en elementos interactivos", a11yFeatureContrast: "Contraste de colores suficiente", a11yFeatureSkip: "Enlace para saltar al contenido", a11yFeatureTheme: "Modos claro y oscuro", a11yFeatureForms: "Formularios con etiquetas claras",
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
    recycleBin: "回收站", emptyBin: "清空回收站", recycleBinEmpty: "回收站为空", recycleBinNote: "项目将在7天后自动删除", restore: "恢复", deletedAt: "已删除", permanentDelete: "永久删除",
    email: "邮件", emailAccounts: "邮件账户", addConnection: "连接账户", connectEmail: "连接邮件账户", chooseProvider: "选择邮件提供商：", emailAddress: "邮件地址", noEmailConnections: "没有连接的邮件账户", connectEmailDesc: "连接Gmail、Outlook或IMAP进行自动分析", lastSync: "上次同步", neverSynced: "从未同步", sync: "同步", confirmDisconnect: "断开邮件账户？", emailSummary: "邮件摘要", recentEmails: "最近邮件", emailInsights: "邮件洞察", emailsAnalyzed: "封邮件已分析", oauthNote: "保存后将跳转至身份验证页面。", password: "密码", back: "返回", connect: "连接",
    editItem: "编辑项目",
    nutrition: "营养与睡眠", dreams: "梦想地图", shopping: "购物", payments: "收入与支出", notesTab: "便签", sharingTab: "分享",
    accessibilitySettings: "无障碍设置", fontSize: "字体大小", highContrast: "高对比度", disableAnimations: "禁用动画", bigCursor: "大光标", highlightLinks: "突出显示链接", reset: "重置", accessibilityStatement: "无障碍声明", skipToContent: "跳至主要内容", reduceFontSize: "缩小字体", increaseFontSize: "放大字体",
    creditCard: "信用卡", connectCreditCard: "连接信用卡", creditCardProvider: "发卡机构", username: "用户名", syncNow: "立即同步", importCSV: "导入CSV", importCreditCard: "导入信用卡账单", transactions: "交易记录", noTransactions: "没有交易", lastFourDigits: "后4位", cardDisplayName: "卡片名称", syncing: "同步中...", syncSuccess: "同步完成", syncError: "同步错误", disconnectCard: "断开卡片", confirmDisconnectCard: "断开此信用卡？",
    a11yCommitment: "无障碍承诺", a11yCommitmentText: "我们致力于让Tabro对所有用户（包括残障人士）无障碍使用，符合WCAG 2.1 AA级标准。", a11yWhatWeDid: "我们做了什么", a11yLimitations: "已知限制", a11yLimitationsText: "某些组件可能尚未完全无障碍。我们持续改进中。", a11yContact: "联系我们", a11yContactText: "遇到无障碍问题？请通过网站联系表单与我们联系。", lastUpdated: "最后更新",
    a11yFeatureKeyboard: "完整键盘导航支持", a11yFeatureRtl: "RTL支持", a11yFeatureHeadings: "正确的标题层次结构", a11yFeatureAria: "交互元素的ARIA标签", a11yFeatureContrast: "足够的颜色对比度", a11yFeatureSkip: "跳至内容链接", a11yFeatureTheme: "深色和浅色模式", a11yFeatureForms: "表单带清晰标签和错误消息",
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
    recycleBin: "سلة المحذوفات", emptyBin: "إفراغ السلة", recycleBinEmpty: "سلة المحذوفات فارغة", recycleBinNote: "تُحذف العناصر تلقائياً بعد 7 أيام", restore: "استعادة", deletedAt: "حُذف", permanentDelete: "حذف نهائي",
    email: "البريد", emailAccounts: "حسابات البريد", addConnection: "ربط حساب", connectEmail: "ربط حساب بريد", chooseProvider: "اختر مزود البريد:", emailAddress: "عنوان البريد", noEmailConnections: "لا توجد حسابات بريد مرتبطة", connectEmailDesc: "اربط Gmail أو Outlook أو IMAP للتحليل التلقائي", lastSync: "آخر مزامنة", neverSynced: "لم تتم المزامنة", sync: "مزامنة", confirmDisconnect: "فصل حساب البريد؟", emailSummary: "ملخص البريد", recentEmails: "رسائل حديثة", emailInsights: "تحليل البريد", emailsAnalyzed: "رسالة تم تحليلها", oauthNote: "بعد الحفظ، ستتم إعادة التوجيه للمصادقة.", password: "كلمة المرور", back: "رجوع", connect: "ربط",
    editItem: "تعديل العنصر",
    nutrition: "التغذية والنوم", dreams: "خريطة الأحلام", shopping: "التسوق", payments: "الدخل والمصروفات", notesTab: "ملاحظات", sharingTab: "مشاركة",
    accessibilitySettings: "إعدادات إمكانية الوصول", fontSize: "حجم الخط", highContrast: "تباين عالي", disableAnimations: "تعطيل الحركات", bigCursor: "مؤشر كبير", highlightLinks: "إبراز الروابط", reset: "إعادة تعيين", accessibilityStatement: "بيان إمكانية الوصول", skipToContent: "انتقل إلى المحتوى الرئيسي", reduceFontSize: "تصغير الخط", increaseFontSize: "تكبير الخط",
    creditCard: "بطاقة ائتمان", connectCreditCard: "ربط بطاقة ائتمان", creditCardProvider: "مزود البطاقة", username: "اسم المستخدم", syncNow: "مزامنة الآن", importCSV: "استيراد CSV", importCreditCard: "استيراد كشف حساب", transactions: "المعاملات", noTransactions: "لا توجد معاملات", lastFourDigits: "آخر 4 أرقام", cardDisplayName: "اسم البطاقة", syncing: "جاري المزامنة...", syncSuccess: "تمت المزامنة", syncError: "خطأ في المزامنة", disconnectCard: "فصل البطاقة", confirmDisconnectCard: "فصل هذه البطاقة؟",
    a11yCommitment: "التزامنا بإمكانية الوصول", a11yCommitmentText: "نحن ملتزمون بجعل Tabro متاحاً لجميع المستخدمين بما في ذلك ذوي الإعاقة وفقاً لمعايير WCAG 2.1 AA.", a11yWhatWeDid: "ما فعلناه", a11yLimitations: "القيود المعروفة", a11yLimitationsText: "قد لا تكون بعض المكونات متاحة بالكامل بعد. نعمل باستمرار على التحسين.", a11yContact: "اتصل بنا", a11yContactText: "واجهت مشكلة في إمكانية الوصول؟ تواصل معنا عبر نموذج الاتصال.", lastUpdated: "آخر تحديث",
    a11yFeatureKeyboard: "دعم كامل للتنقل بلوحة المفاتيح", a11yFeatureRtl: "دعم RTL للعربية والعبرية", a11yFeatureHeadings: "تسلسل عناوين صحيح", a11yFeatureAria: "تسميات ARIA للعناصر التفاعلية", a11yFeatureContrast: "تباين ألوان كافٍ", a11yFeatureSkip: "رابط تخطي للمحتوى", a11yFeatureTheme: "وضع داكن وفاتح", a11yFeatureForms: "نماذج بتسميات واضحة",
  },
  ru: {
    personalArea: "Личный кабинет", installApp: "Установить приложение", signOut: "Выйти", signedOutSuccess: "Вы успешно вышли", loading: "Загрузка...",
    dashboard: "Панель управления", personalTasks: "Личные задачи", workTasks: "Рабочие задачи", books: "Книги", shows: "Сериалы и фильмы", podcasts: "Подкасты", dailyRoutine: "Ежедневный распорядок", projects: "Проекты", courses: "Курсы", planner: "Планировщик", deeply: "Deeply", settings: "Настройки", challenges: "Вызовы",
    security: "Безопасность", pinCode: "Код доступа (PIN)", pinDescription: "Требовать 4-значный код при каждом входе", changePin: "Изменить PIN", setPin: "Установить PIN", enterNewCode: "Введите новый код:", cancel: "Отмена",
    customDashboards: "Пользовательские панели", customDashboardsDesc: "Создавайте панели для отслеживания чего угодно.", newDashboard: "Новая панель", chooseTemplate: "Выбрать шаблон", taskList: "Список задач", trackingList: "Список отслеживания", kanban: "Канбан", custom: "Пользовательский", dashboardName: "Название панели", dashboardNamePlaceholder: 'Напр.: "Учёба", "Фитнес"', statuses: "Статусы (через запятую)", statusesDesc: "Статусы в меню выбора", showInMainDashboard: "Показать на главной панели", createDashboard: "Создать панель", addNewDashboard: "Добавить новую панель",
    showTabs: "Видимость вкладок", showTabsDesc: "Выберите, какие вкладки отображать.", displayedInDashboard: "Отображается на панели", language: "Язык", languageDesc: "Выберите язык интерфейса", hebrew: "עברית", english: "English",
    newTask: "Новая задача", deleteTask: "Удалить задачу", export: "Экспорт", noSort: "Без сортировки", byStatus: "По статусу", byPlannedEnd: "По сроку", byCreatedAt: "По дате создания", byOverdue: "По просрочке", byUrgent: "По срочности", done: "Выполнено", notStarted: "Не начато", inProgress: "В работе", completionRate: "Процент выполнения", activeTasks: "Активные задачи", completed: "Завершённые", archive: "Архив", noTasksYet: "Задач пока нет", noArchivedTasks: "Нет архивных задач", noCompletedTasks: "Нет завершённых задач", addFirstTask: "Добавить первую задачу", share: "Поделиться", similarTasks: "Похожие задачи:", moveToSheet: "Переместить на другой лист", task: "Задача:", moveToSheetLabel: "Переместить на лист:", moveTask: "Переместить задачу", aiHelp: "Помощь ИИ", gettingSuggestions: "Получение предложений...", loadingTasks: "Загрузка задач...",
    addEvent: "Добавить событие", deleteEvent: "Удалить событие", eventTitle: "Заголовок", eventDescription: "Описание", startTime: "Начало", endTime: "Окончание", category: "Категория", allDay: "Весь день", save: "Сохранить", delete: "Удалить", today: "Сегодня", day: "День", week: "Неделя", month: "Месяц", year: "Год",
    addRecurringTask: "Добавить повторяющуюся задачу", frequency: "Частота", daily: "Ежедневно", weekly: "Еженедельно", monthly: "Ежемесячно", yearly: "Ежегодно", thriceWeekly: "3 раза в неделю", flexible: "Гибкий", selectDays: "Выбрать дни", sun: "Вс", mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб",
    addBook: "Добавить книгу", addShow: "Добавить сериал", addPodcast: "Добавить подкаст", title: "Название", author: "Автор", host: "Ведущий", status: "Статус", notes: "Заметки", toRead: "К прочтению", reading: "Читаю", read: "Прочитано", toWatch: "К просмотру", watching: "Смотрю", watched: "Просмотрено", toListen: "К прослушиванию", listening: "Слушаю", listened: "Прослушано",
    addProject: "Добавить проект", projectName: "Название проекта", description: "Описание", targetDate: "Целевая дата", active: "Активный", onHold: "На паузе", completedStatus: "Завершён",
    addCourse: "Добавить курс", courseName: "Название курса", syllabus: "Программа", lessons: "Уроки",
    add: "Добавить", edit: "Редактировать", remove: "Удалить", confirm: "Подтвердить", close: "Закрыть", search: "Поиск", filter: "Фильтр", all: "Все", none: "Нет",
    contactForm: "Связаться / Поддержка",
    recycleBin: "Корзина", emptyBin: "Очистить корзину", recycleBinEmpty: "Корзина пуста", recycleBinNote: "Элементы автоматически удаляются через 7 дней", restore: "Восстановить", deletedAt: "Удалено", permanentDelete: "Удалить навсегда",
    email: "Почта", emailAccounts: "Почтовые аккаунты", addConnection: "Подключить аккаунт", connectEmail: "Подключить почту", chooseProvider: "Выберите почтовый сервис:", emailAddress: "Адрес электронной почты", noEmailConnections: "Нет подключённых аккаунтов", connectEmailDesc: "Подключите Gmail, Outlook или IMAP для автоматического анализа", lastSync: "Последняя синхронизация", neverSynced: "Не синхронизировано", sync: "Синхронизировать", confirmDisconnect: "Отключить почтовый аккаунт?", emailSummary: "Сводка по почте", recentEmails: "Недавние письма", emailInsights: "Аналитика почты", emailsAnalyzed: "писем проанализировано", oauthNote: "После сохранения вы будете перенаправлены для аутентификации.", password: "Пароль", back: "Назад", connect: "Подключить",
    editItem: "Редактировать элемент",
    nutrition: "Питание и сон", dreams: "Карта мечты", shopping: "Покупки", payments: "Доходы и расходы", notesTab: "Заметки", sharingTab: "Общий доступ",
    accessibilitySettings: "Настройки доступности", fontSize: "Размер шрифта", highContrast: "Высокий контраст", disableAnimations: "Отключить анимации", bigCursor: "Большой курсор", highlightLinks: "Выделить ссылки", reset: "Сброс", accessibilityStatement: "Заявление о доступности", skipToContent: "Перейти к основному содержанию", reduceFontSize: "Уменьшить шрифт", increaseFontSize: "Увеличить шрифт",
    creditCard: "Кредитная карта", connectCreditCard: "Подключить карту", creditCardProvider: "Поставщик карты", username: "Имя пользователя", syncNow: "Синхронизировать", importCSV: "Импорт CSV", importCreditCard: "Импорт выписки", transactions: "Транзакции", noTransactions: "Нет транзакций", lastFourDigits: "Последние 4 цифры", cardDisplayName: "Название карты", syncing: "Синхронизация...", syncSuccess: "Синхронизация завершена", syncError: "Ошибка синхронизации", disconnectCard: "Отключить карту", confirmDisconnectCard: "Отключить эту карту?",
    a11yCommitment: "Обязательство по доступности", a11yCommitmentText: "Мы стремимся сделать Tabro доступным для всех пользователей, включая людей с ограниченными возможностями, в соответствии с WCAG 2.1 уровня AA.", a11yWhatWeDid: "Что мы сделали", a11yLimitations: "Известные ограничения", a11yLimitationsText: "Некоторые компоненты могут быть не полностью доступны. Мы постоянно работаем над улучшением.", a11yContact: "Свяжитесь с нами", a11yContactText: "Обнаружили проблему с доступностью? Свяжитесь с нами через форму на сайте.", lastUpdated: "Последнее обновление",
    a11yFeatureKeyboard: "Полная поддержка навигации с клавиатуры", a11yFeatureRtl: "Поддержка RTL", a11yFeatureHeadings: "Правильная иерархия заголовков", a11yFeatureAria: "ARIA-метки на интерактивных элементах", a11yFeatureContrast: "Достаточный цветовой контраст", a11yFeatureSkip: "Ссылка перехода к содержимому", a11yFeatureTheme: "Тёмный и светлый режимы", a11yFeatureForms: "Формы с чёткими метками",
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
