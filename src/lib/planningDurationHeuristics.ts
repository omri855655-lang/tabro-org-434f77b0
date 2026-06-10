interface DurationEstimate {
  minutes: number;
  reason: string;
}

const DURATION_RULES: Array<{ minutes: number; reason: string; keywords: string[] }> = [
  {
    minutes: 5,
    reason: "שליחה או אישור קצר",
    keywords: ["לשלוח", "שלח", "להחזיר תשובה", "לענות", "אישור", "זימון", "להודיע", "להגיד", "לכתוב הודעה"],
  },
  {
    minutes: 10,
    reason: "שיחה קצרה או תיאום",
    keywords: ["להתקשר", "טלפון", "לקבוע", "לתאם", "פגישה", "שיחה", "וואצפ", "וואטסאפ", "מייל"],
  },
  {
    minutes: 15,
    reason: "בדיקה או מעקב קצר",
    keywords: ["לבדוק", "לברר", "לחפש", "לעבור", "לראות", "לקרוא", "לענות לבחור", "לענות למייל"],
  },
  {
    minutes: 25,
    reason: "סידור אישי או קנייה קצרה",
    keywords: ["לקנות", "להזמין", "סופר", "קניות", "להביא", "לנספרסו", "לנסוע", "סידור"],
  },
  {
    minutes: 45,
    reason: "טיפול אדמיניסטרטיבי",
    keywords: ["ביטוח", "טופס", "טפסים", "ערעור", "מסמך", "דרישת תשלום", "תשלום", "החזר", "ביטוח לאומי"],
  },
  {
    minutes: 60,
    reason: "עבודה שדורשת ריכוז",
    keywords: ["לכתוב", "לסכם", "לימוד", "ללמוד", "קורס", "לסדר", "לארגן", "דשבורד", "פרויקט", "לבנות", "אתר"],
  },
  {
    minutes: 90,
    reason: "משימה עמוקה או יצירתית",
    keywords: ["מחקר", "לתכנן שבוע", "לעבוד על", "לסיים", "אסטרטגיה", "הכנה", "מצגת", "פיתוח"],
  },
];

export function estimateTaskDuration(title: string, source?: string): DurationEstimate {
  const normalized = `${title} ${source || ""}`.toLowerCase().trim();

  for (const rule of DURATION_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return { minutes: rule.minutes, reason: rule.reason };
    }
  }

  if (normalized.includes("מייל") || normalized.includes("reply")) {
    return { minutes: 10, reason: "טיפול ממוקד במייל" };
  }

  return { minutes: 30, reason: "ברירת מחדל למשימה כללית" };
}

export function formatDurationLabel(minutes: number): string {
  if (minutes % 60 === 0) {
    return `${minutes / 60} שעות`;
  }

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} ש' ${remainingMinutes} דק'`;
  }

  return `${minutes} דק'`;
}
