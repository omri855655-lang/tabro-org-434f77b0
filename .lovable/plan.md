
# תוכנית: תצוגות עובדות + עריכה בכל מצב + נגישות ישראלית + הסרת סימן Lovable

## מה נמצא בבדיקה

### בעיות שזוהו:
1. **תצוגות לא עובדות בדשבורד משימות** — `TaskSpreadsheetDb` יש לו סרגל "עיצוב" אבל תמיד מרנדר טבלה בלבד. ה-`dashViewMode` נשמר אבל לא משמש לרינדור.
2. **תצוגות לא עובדות בקניות/תשלומים/תזונה** — אותה בעיה: יש toolbar אבל רק טבלה מוצגת.
3. **אי אפשר לערוך בתצוגות אחרות** — ב-ListView, CardsView, KanbanView, CompactView אין אפשרות לערוך הערות, לשנות שם, לעדכן שדות וכו'. רק בטבלה אפשר.
4. **שם הטאב "סדרות"** — צריך להיות "סדרות וסרטים".
5. **אין כפתור נגישות צף** — לפי תקן ישראלי (ת"י 5568) צריך כפתור ♿ צף קבוע שפותח תפריט נגישות (הגדלת גופן, ניגודיות, השבתת אנימציות וכו').
6. **סימן Lovable** — ניתן להסתיר אותו (דורש תוכנית Pro).

---

## שלבי יישום

### שלב 1 — הוספת עריכה לקומפוננטות תצוגה
עדכון `ListView`, `CardsView`, `KanbanView`, `CompactView` כך שיתמכו ב:
- עריכת הערות inline (onNotesChange callback)
- עריכת כותרת inline (onTitleChange callback)
- שינוי סטטוס (כבר קיים בחלקם)
- אופציונלי: כל שדה נוסף שרלוונטי לסוג הדשבורד

### שלב 2 — תצוגות עובדות בדשבורד משימות
עדכון `TaskSpreadsheetDb.tsx`:
- לייבא ListView, CardsView, KanbanView, CompactView
- במקום לרנדר תמיד טבלה, לבדוק `dashViewMode` ולרנדר בהתאם
- למפות משימות לפורמט של כל קומפוננטת תצוגה
- סטטוסים לקנבן: טרם החל / בטיפול / בוצע
- לשמור על כל הפונקציונליות: עריכה, מחיקה, שינוי סטטוס

### שלב 3 — תצוגות עובדות בקניות/תשלומים/תזונה
- `ShoppingDashboard.tsx` — רינדור מותנה לפי viewMode
- `PaymentDashboard.tsx` — רינדור מותנה לפי viewMode
- `NutritionDashboard.tsx` — רינדור מותנה לפי viewMode

### שלב 4 — שינוי שם טאב
- `useLanguage.tsx`: שינוי `shows: "סדרות"` ל-`shows: "סדרות וסרטים"` (בעברית בלבד, שאר השפות בהתאם)

### שלב 5 — כפתור נגישות צף (תקן ישראלי)
יצירת `AccessibilityWidget.tsx`:
- כפתור ♿ צף קבוע בפינה שמאלית תחתונה
- בלחיצה נפתח תפריט עם:
  - הגדלת/הקטנת גופן
  - ניגודיות גבוהה
  - השבתת אנימציות
  - סמן מוגדל
  - הדגשת קישורים
  - קישור לדף הצהרת הנגישות
- שמירת העדפות ב-localStorage
- הוספה ב-`App.tsx` כך שמופיע בכל דף

### שלב 6 — הסרת סימן Lovable
- שימוש ב-`set_badge_visibility` להסתרת הסימן (דורש תוכנית Pro — אם אין Pro, אודיע)

---

## קבצים שישתנו
- `src/components/views/ListView.tsx` — הוספת onNotesChange, onTitleChange
- `src/components/views/CardsView.tsx` — הוספת onNotesChange, onTitleChange
- `src/components/views/KanbanView.tsx` — הוספת onNotesChange
- `src/components/views/CompactView.tsx` — הוספת onClick עם עריכה
- `src/components/TaskSpreadsheetDb.tsx` — רינדור מותנה לפי dashViewMode
- `src/components/dashboards/ShoppingDashboard.tsx` — רינדור מותנה
- `src/components/dashboards/PaymentDashboard.tsx` — רינדור מותנה
- `src/components/dashboards/NutritionDashboard.tsx` — רינדור מותנה
- `src/hooks/useLanguage.tsx` — שם טאב "סדרות וסרטים"
- **חדש**: `src/components/AccessibilityWidget.tsx`
- `src/App.tsx` — הוספת AccessibilityWidget
- `src/index.css` — CSS classes לנגישות (font-size, contrast, cursor)

---

## לגבי משימות ישנות שלא בוצעו
מהבדיקה, הנה מה שביקשת בעבר ועדיין לא עובד באמת:
1. ✅ ספרים/סדרות/פודקאסטים — תצוגות עובדות (נעשה)
2. ❌ משימות — תצוגות לא עובדות (יתוקן כאן)
3. ❌ קניות/תשלומים/תזונה — תצוגות לא עובדות (יתוקן כאן)
4. ❌ עריכה בתצוגות שאינן טבלה — לא קיימת (יתוקן כאן)
5. ❌ כפתור נגישות ישראלי — לא קיים (יתוקן כאן)

