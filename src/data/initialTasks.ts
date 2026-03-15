export interface Task {
  id: number;
  description: string;
  category: string;
  responsible: string;
  status: "בוצע" | "טרם החל" | "בטיפול";
  statusNotes: string;
  progress: string;
  plannedEnd: string;
  overdue: boolean;
}

export const personalTasks: Task[] = [
  { id: 1, description: "לבדוק ולהוציא לאמא ספרים שהיא רוצה", category: "אמא", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/26/25", overdue: false },
  { id: 2, description: "לקחת את הגלגלים לחנות אופניים ולעשות להם תיקון ושינוי", category: "אישי", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/27/25", overdue: false },
  { id: 3, description: "לבקש הפניה לאבא", category: "אבא", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/24/25", overdue: false },
  { id: 4, description: "להזמין שרשרת לאופניים", category: "אישי", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/26/25", overdue: false },
  { id: 5, description: "לקנות לאבא שעון בשנה הבאה חדש", category: "אבא", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "11/25/26", overdue: false },
  { id: 6, description: "להזמין מדבקות לשעונים", category: "אבא", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/25/25", overdue: false },
  { id: 7, description: "להזמין מחזיק מפתחות שידע איפה המכונה תמיד", category: "אישי", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/25/25", overdue: false },
  { id: 8, description: "לצלם את המסמך של המקווה של ללה", category: "אישי", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/20/25", overdue: false },
  { id: 9, description: "לשלוח את המסמכים של החתונה לרבנות", category: "אישי", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/26/25", overdue: false },
  { id: 10, description: "לבדוק ביטוח לחודש הבא + מבצע של הbuy של המשרד", category: "אישי", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/26/25", overdue: false },
  { id: 11, description: "להתקשר לבית מלון יום כיף", category: "אישי", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "", overdue: false },
  { id: 12, description: "להצטרף לקבוצה של יוסף חיים", category: "אישי", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "", overdue: true },
  { id: 13, description: "להוסיף לוזים ליומן שנה", category: "אישי", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "", overdue: true },
  { id: 14, description: "לחפש את הפולו הוורודה של ראלף לורן", category: "אישי", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "", overdue: true },
  { id: 15, description: "לעשות בנוטבוק את הפודקאסט מדיטציה", category: "אישי", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "", overdue: true },
  { id: 16, description: "להוסיף רישום על אבי שראה אותי חוזר מאילת", category: "אישי", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "", overdue: true },
  { id: 17, description: "במהלך השנה הקרובה לקנות קונסולה של XBOX", category: "אישי", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "11/30/26", overdue: false },
  { id: 18, description: "להזמין תיק טומי היליפינגר שראיתי או תיק אחר", category: "אישי", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "2/1/26", overdue: false },
  { id: 19, description: "לסגור מלון לרומא", category: "טיול לחול", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/30/25", overdue: false },
  { id: 20, description: "לדבר עם הבחור של הספרים", category: "אישי", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "11/30/25", overdue: true },
  { id: 21, description: "לבדוק שש בש בית\"ר", category: "קניות", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "", overdue: true },
  { id: 22, description: "לכתוב סיכום היומיים האחרונים", category: "אישי", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/25/25", overdue: false },
  { id: 23, description: "ללמוד טכניקת מוח העל", category: "לימודים", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "1/30/26", overdue: false },
  { id: 24, description: "לשלוח לאיציק מזל טוב", category: "אישי", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/25/26", overdue: false },
  { id: 25, description: "לקחת ויטמין יומי", category: "אישי יומי", responsible: "", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/25/26", overdue: false },
  { id: 26, description: "להזמין את הספרים שההורים שלנו קונים לנו אותם", category: "אישי", responsible: "", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "", overdue: true },
  { id: 27, description: "לטפל בכל השוברים שיש לנו כולל קובץ אקסל או משהו", category: "אישי", responsible: "", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "", overdue: true },
  { id: 28, description: "להזמין קריוקי לרכב", category: "אישי", responsible: "", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "30/02/2026", overdue: false },
  { id: 29, description: "להזמין משקפי שמש", category: "קניות", responsible: "", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "1/30/25", overdue: true },
  { id: 30, description: "להזמין גינס דיזל", category: "קניות", responsible: "", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/26/25", overdue: false },
  { id: 31, description: "לעלות פוסט על ביתר פרובנס פלוס יהודה אלוש", category: "אישי", responsible: "", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "12/5/25", overdue: true },
  { id: 32, description: "מחר להכין לונגו לפי ההסבר", category: "אישי", responsible: "", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/26/25", overdue: false },
  { id: 33, description: "מחר לשלם שכר דירה לרוני", category: "בית", responsible: "", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/26/25", overdue: false },
  { id: 34, description: "לסדר את הבית כולל ניקוי", category: "בית", responsible: "", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/26/25", overdue: false },
  { id: 35, description: "לבדוק היכן עומדת ההזמנה של אביתר", category: "אישי", responsible: "", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/26/25", overdue: false },
  { id: 36, description: "לשלוח לאנשים שחיפשו את הנעליים וזה היה להם מחיר גבוהה שאני יכול להשיג להם באיכות טובה", category: "עסק עצמאי", responsible: "", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "12/3/25", overdue: true },
  { id: 37, description: "להזמין מספר אמריקאי או אחר", category: "עסק עצמאי", responsible: "", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "12/1/25", overdue: true },
  { id: 38, description: "לעשות מסנן וניקוי למוכנה החדשה", category: "בית", responsible: "", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "11/25/25", overdue: false },
];

export const workTasks: Task[] = [
  { id: 1, description: "קביעת פגישה עם שירה ארנון, אפרת גרינפלד, אפרת אפללו - רופאים עולים", category: "יומן", responsible: "עומרי", status: "בוצע", statusNotes: "נקבע ל15 לדצמבר יום שני - שעה 11", progress: "", plannedEnd: "11/20/25", overdue: false },
  { id: 2, description: "סיום מכרז אופקים - הלוואות לסטודנטים", category: "מרכבה ורכש", responsible: "עומרי", status: "בטיפול", statusNotes: "מחכים לאישור מודול תמיכות מלאה מוליאן", progress: "התקיימה פגישה בנושא המצב לתכנון העתיד", plannedEnd: "11/28/25", overdue: true },
  { id: 3, description: "הזמנה (טלדור, וואן) - הזמנה בדיעבד", category: "מרכבה ורכש", responsible: "עומרי", status: "בטיפול", statusNotes: "מחכים למסמך היעדר תביעות של טלדור+בדיקה של הצמדה למדד", progress: "", plannedEnd: "11/28/25", overdue: true },
  { id: 4, description: "תשלום 10,000 ליועצים כלכלים", category: "מרכבה ורכש", responsible: "עומרי", status: "בוצע", statusNotes: "הוקמה הזמנת רכש, מחכה לאישור חשבות", progress: "", plannedEnd: "12/11/23", overdue: false },
  { id: 5, description: "הזמנת טלוויזיה לרייצ'ל", category: "רכש פנימי", responsible: "עומרי", status: "בוצע", statusNotes: "נשלחו 2 מיילים בנושא לאלעד ויהודה + שיחת טלפון", progress: "", plannedEnd: "12/5/25", overdue: false },
  { id: 6, description: "לקבוע אל מול ויזל", category: "יומן", responsible: "עומרי", status: "בטיפול", statusNotes: "תשלח היום הודעת טלפון", progress: "", plannedEnd: "12/10/25", overdue: true },
  { id: 7, description: "שיחה עם רייצ'ל לאחר חודש כולל תיאום ציפיות", category: "אישי עבודה", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "12/15/23", overdue: true },
  { id: 8, description: "הכנת טמפלט למסמך ניהול התקשרות", category: "רכש ומרכבה", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "12/20/23", overdue: true },
  { id: 9, description: "לדבר עם רייצ'ל על שיחות תקופתיות", category: "מנהלה", responsible: "עומרי ורייצ'ל", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "12/25/23", overdue: true },
  { id: 10, description: "תיאום חדר ישיבות למפגש אגף בכיר חודשי", category: "יומן", responsible: "עומרי", status: "טרם החל", statusNotes: "", progress: "", plannedEnd: "1/11/23", overdue: true },
  { id: 11, description: "אישור תקציבי לשנת 2026 עבור מכרז תרגום לפורטל עולים", category: "תקציבים", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "1/5/24", overdue: false },
  { id: 12, description: "אישור אגת מחקר רפואה ראשוני לשנת 2026", category: "תקציבים", responsible: "עומרי", status: "בוצע", statusNotes: "", progress: "", plannedEnd: "1/10/24", overdue: false },
];

export const taskHeaders = [
  "דחוף / #",
  "תיאור המשימה",
  "סיווג",
  "אחריות",
  "סטטוס",
  "היכן זה עומד",
  "משימות שבוצעו",
  "סיום מתוכנן",
  "חריגה",
  "נוצר על ידי",
  "נוצר",
  "עודכן",
  "AI",
];
