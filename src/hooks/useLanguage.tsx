import { useState, useEffect, createContext, useContext, ReactNode } from "react";

type Language = "he" | "en";

const translations = {
  he: {
    // Header
    personalArea: "אזור אישי",
    installApp: "התקנת אפליקציה",
    signOut: "התנתק",
    signedOutSuccess: "התנתקת בהצלחה",
    loading: "טוען...",

    // Tabs
    dashboard: "דשבורד",
    personalTasks: "משימות אישיות",
    workTasks: "משימות עבודה",
    books: "ספרים",
    shows: "סדרות",
    podcasts: "פודקאסטים",
    dailyRoutine: "לוז יומי",
    projects: "פרויקטים",
    courses: "קורסים",
    planner: "מתכנן לוז",
    deeply: "Deeply",
    settings: "הגדרות",
    challenges: "אתגרים",

    // Settings
    security: "אבטחה",
    pinCode: "קוד גישה (PIN)",
    pinDescription: "דרוש קוד 4 ספרות בכל כניסה לאתר",
    changePin: "שנה קוד גישה",
    setPin: "הגדר קוד גישה",
    enterNewCode: "הזן קוד חדש:",
    cancel: "ביטול",
    customDashboards: "דשבורדים מותאמים אישית",
    customDashboardsDesc: "צור דשבורדים מותאמים לעקוב אחר כל דבר שתרצה (למידה, כושר, מתכונים ועוד). הם יופיעו כלשוניות בסרגל העליון.",
    newDashboard: "דשבורד חדש",
    chooseTemplate: "בחר תבנית",
    taskList: "רשימת משימות (כולל דשבורד)",
    trackingList: "רשימת מעקב (כמו ספרים/פודקאסטים)",
    kanban: "קנבן (לביצוע → בבדיקה → הושלם)",
    custom: "מותאם אישית",
    dashboardName: "שם הדשבורד",
    dashboardNamePlaceholder: 'לדוגמה: "לימודים", "כושר", "מתכונים"',
    statuses: "סטטוסים (מופרדים בפסיק)",
    statusesDesc: "הסטטוסים שיופיעו בתפריט הבחירה של כל פריט",
    showInMainDashboard: "הצג סיכום בדשבורד הראשי",
    createDashboard: "צור דשבורד",
    addNewDashboard: "הוסף דשבורד חדש",
    showTabs: "הצגת לשוניות",
    showTabsDesc: "בחר אילו לשוניות יוצגו בסרגל העליון. לשוניות מוסתרות לא יופיעו אבל הנתונים שלהן נשמרים.",
    displayedInDashboard: "מוצג בדשבורד",
    language: "שפה",
    languageDesc: "בחר את שפת הממשק",
    hebrew: "עברית",
    english: "English",

    // Tasks
    newTask: "משימה חדשה",
    deleteTask: "מחק משימה",
    export: "ייצוא",
    noSort: "ללא מיון",
    byStatus: "לפי סטטוס",
    byPlannedEnd: "לפי סיום מתוכנן",
    byCreatedAt: "לפי תאריך יצירה",
    byOverdue: "לפי חריגה",
    byUrgent: "לפי דחיפות",
    done: "בוצע",
    notStarted: "טרם החל",
    inProgress: "בטיפול",
    completionRate: "אחוז ביצוע",
    activeTasks: "משימות פעילות",
    completed: "בוצעו",
    archive: "ארכיון",
    noTasksYet: "אין משימות עדיין",
    noArchivedTasks: "אין משימות בארכיון",
    noCompletedTasks: "אין משימות שבוצעו",
    addFirstTask: "הוסף משימה ראשונה",
    share: "שתף",
    similarTasks: "משימות דומות:",
    moveToSheet: "העבר משימה לגליון אחר",
    task: "משימה:",
    moveToSheetLabel: "העבר לגליון:",
    moveTask: "העבר משימה",
    aiHelp: "עזרה מ-AI",
    gettingSuggestions: "מקבל הצעות...",
    loadingTasks: "טוען משימות...",

    // Planner
    addEvent: "הוסף אירוע",
    deleteEvent: "מחק אירוע",
    eventTitle: "כותרת",
    eventDescription: "תיאור",
    startTime: "שעת התחלה",
    endTime: "שעת סיום",
    category: "קטגוריה",
    allDay: "כל היום",
    save: "שמור",
    delete: "מחק",
    today: "היום",
    day: "יום",
    week: "שבוע",
    month: "חודש",
    year: "שנה",

    // Daily Routine
    addRecurringTask: "הוסף משימה חוזרת",
    frequency: "תדירות",
    daily: "יומי",
    weekly: "שבועי",
    monthly: "חודשי",
    yearly: "שנתי",
    thriceWeekly: "3 פעמים בשבוע",
    flexible: "גמיש",
    selectDays: "בחר ימים",
    sun: "א׳",
    mon: "ב׳",
    tue: "ג׳",
    wed: "ד׳",
    thu: "ה׳",
    fri: "ו׳",
    sat: "ש׳",

    // Books / Shows / Podcasts
    addBook: "הוסף ספר",
    addShow: "הוסף סדרה",
    addPodcast: "הוסף פודקאסט",
    title: "כותרת",
    author: "מחבר",
    host: "מנחה",
    status: "סטטוס",
    notes: "הערות",
    toRead: "לקרוא",
    reading: "קורא",
    read: "נקרא",
    toWatch: "לצפות",
    watching: "צופה",
    watched: "נצפה",
    toListen: "להאזין",
    listening: "מאזין",
    listened: "נשמע",

    // Projects
    addProject: "הוסף פרויקט",
    projectName: "שם הפרויקט",
    description: "תיאור",
    targetDate: "תאריך יעד",
    active: "פעיל",
    onHold: "בהמתנה",
    completedStatus: "הושלם",

    // Courses
    addCourse: "הוסף קורס",
    courseName: "שם הקורס",
    syllabus: "סילבוס",
    lessons: "שיעורים",

    // Common
    add: "הוסף",
    edit: "ערוך",
    remove: "הסר",
    confirm: "אשר",
    close: "סגור",
    search: "חיפוש",
    filter: "סינון",
    all: "הכל",
    none: "ללא",
  },
  en: {
    // Header
    personalArea: "Personal Area",
    installApp: "Install App",
    signOut: "Sign Out",
    signedOutSuccess: "Signed out successfully",
    loading: "Loading...",

    // Tabs
    dashboard: "Dashboard",
    personalTasks: "Personal Tasks",
    workTasks: "Work Tasks",
    books: "Books",
    shows: "Shows",
    podcasts: "Podcasts",
    dailyRoutine: "Daily Routine",
    projects: "Projects",
    courses: "Courses",
    planner: "Planner",
    deeply: "Deeply",
    settings: "Settings",
    challenges: "Challenges",

    // Settings
    security: "Security",
    pinCode: "Access Code (PIN)",
    pinDescription: "Require a 4-digit code on every login",
    changePin: "Change PIN",
    setPin: "Set PIN",
    enterNewCode: "Enter new code:",
    cancel: "Cancel",
    customDashboards: "Custom Dashboards",
    customDashboardsDesc: "Create custom dashboards to track anything you want (learning, fitness, recipes, etc.). They will appear as tabs in the top bar.",
    newDashboard: "New Dashboard",
    chooseTemplate: "Choose Template",
    taskList: "Task List (with dashboard)",
    trackingList: "Tracking List (like books/podcasts)",
    kanban: "Kanban (To Do → Review → Done)",
    custom: "Custom",
    dashboardName: "Dashboard Name",
    dashboardNamePlaceholder: 'e.g. "Learning", "Fitness", "Recipes"',
    statuses: "Statuses (comma-separated)",
    statusesDesc: "The statuses that will appear in the selection menu of each item",
    showInMainDashboard: "Show summary in main dashboard",
    createDashboard: "Create Dashboard",
    addNewDashboard: "Add New Dashboard",
    showTabs: "Tab Visibility",
    showTabsDesc: "Choose which tabs are displayed in the top bar. Hidden tabs won't appear but their data is preserved.",
    displayedInDashboard: "Displayed in dashboard",
    language: "Language",
    languageDesc: "Choose the interface language",
    hebrew: "עברית",
    english: "English",

    // Tasks
    newTask: "New Task",
    deleteTask: "Delete Task",
    export: "Export",
    noSort: "No Sort",
    byStatus: "By Status",
    byPlannedEnd: "By Planned End",
    byCreatedAt: "By Created Date",
    byOverdue: "By Overdue",
    byUrgent: "By Urgency",
    done: "Done",
    notStarted: "Not Started",
    inProgress: "In Progress",
    completionRate: "Completion Rate",
    activeTasks: "Active Tasks",
    completed: "Completed",
    archive: "Archive",
    noTasksYet: "No tasks yet",
    noArchivedTasks: "No archived tasks",
    noCompletedTasks: "No completed tasks",
    addFirstTask: "Add first task",
    share: "Share",
    similarTasks: "Similar tasks:",
    moveToSheet: "Move task to another sheet",
    task: "Task:",
    moveToSheetLabel: "Move to sheet:",
    moveTask: "Move Task",
    aiHelp: "AI Help",
    gettingSuggestions: "Getting suggestions...",
    loadingTasks: "Loading tasks...",

    // Planner
    addEvent: "Add Event",
    deleteEvent: "Delete Event",
    eventTitle: "Title",
    eventDescription: "Description",
    startTime: "Start Time",
    endTime: "End Time",
    category: "Category",
    allDay: "All Day",
    save: "Save",
    delete: "Delete",
    today: "Today",
    day: "Day",
    week: "Week",
    month: "Month",
    year: "Year",

    // Daily Routine
    addRecurringTask: "Add Recurring Task",
    frequency: "Frequency",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    thriceWeekly: "3 Times a Week",
    flexible: "Flexible",
    selectDays: "Select Days",
    sun: "Sun",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",

    // Books / Shows / Podcasts
    addBook: "Add Book",
    addShow: "Add Show",
    addPodcast: "Add Podcast",
    title: "Title",
    author: "Author",
    host: "Host",
    status: "Status",
    notes: "Notes",
    toRead: "To Read",
    reading: "Reading",
    read: "Read",
    toWatch: "To Watch",
    watching: "Watching",
    watched: "Watched",
    toListen: "To Listen",
    listening: "Listening",
    listened: "Listened",

    // Projects
    addProject: "Add Project",
    projectName: "Project Name",
    description: "Description",
    targetDate: "Target Date",
    active: "Active",
    onHold: "On Hold",
    completedStatus: "Completed",

    // Courses
    addCourse: "Add Course",
    courseName: "Course Name",
    syllabus: "Syllabus",
    lessons: "Lessons",

    // Common
    add: "Add",
    edit: "Edit",
    remove: "Remove",
    confirm: "Confirm",
    close: "Close",
    search: "Search",
    filter: "Filter",
    all: "All",
    none: "None",
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem("app-language") as Language) || "he";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("app-language", newLang);
  };

  useEffect(() => {
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || translations.he[key] || key;
  };

  const dir = lang === "he" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
