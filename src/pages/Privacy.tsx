import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

const Privacy = () => {
  const navigate = useNavigate();
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-1 mb-4">
          <ArrowRight className="h-4 w-4" />{isHebrew ? "חזרה" : "Back"}
        </Button>
        <h1 className="text-3xl font-bold">{isHebrew ? "מדיניות פרטיות" : "Privacy Policy"}</h1>
        <p className="text-sm text-muted-foreground">{isHebrew ? "עדכון אחרון" : "Last updated"}: {new Date().toLocaleDateString(isHebrew ? 'he-IL' : 'en-US')}</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "1. מידע שאנו אוספים" : "1. Information We Collect"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "בעת ההרשמה אנו אוספים כתובת אימייל, שם תצוגה ופרטים נוספים שתבחר למסור. בנוסף, המערכת שומרת את התוכן שתזין: משימות, פרויקטים, פתקים, אירועים ונתונים נוספים."
              : "When you sign up, we collect your email address, display name, and any additional details you choose to provide. The system also stores the content you enter, including tasks, projects, notes, events, and related data."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "2. כיצד אנו משתמשים במידע" : "2. How We Use Information"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "המידע משמש אך ורק לצורך הפעלת המערכת, שיפור חוויית המשתמש, שליחת התראות ותזכורות (על פי בחירתך), ומתן שירותי AI מותאמים. איננו מוכרים או משתפים מידע אישי עם צדדים שלישיים."
              : "We use this information only to operate the platform, improve the user experience, send notifications and reminders based on your preferences, and provide tailored AI features. We do not sell or share personal information with third parties."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "3. אבטחת מידע" : "3. Data Security"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "אנו משתמשים בפרוטוקולי אבטחה מתקדמים כולל הצפנה, אימות רב-שלבי וגישה מאובטחת לבסיס הנתונים. עם זאת, אין שיטת אבטחה מושלמת ואיננו יכולים להבטיח הגנה מוחלטת."
              : "We use modern security measures including encryption, multi-step authentication, and secured database access. However, no security method is perfect and we cannot guarantee absolute protection."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "4. שיתוף מידע" : "4. Sharing Information"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "כאשר תשתף גליונות, פרויקטים או רשימות עם משתמשים אחרים, הם יוכלו לראות את התוכן ששיתפת. אחריות השיתוף היא שלך."
              : "When you share sheets, projects, or lists with other users, they will be able to see the content you share. You are responsible for how you choose to share content."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "5. זכויותיך" : "5. Your Rights"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "באפשרותך לעדכן, לערוך או למחוק את המידע שלך בכל עת דרך הגדרות החשבון. כמו כן, תוכל לבקש מחיקת חשבון מלאה."
              : "You can update, edit, or delete your information at any time through your account settings. You may also request full account deletion."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "6. עוגיות" : "6. Cookies"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "המערכת משתמשת בעוגיות (cookies) לצורך אימות, שמירת העדפות ושיפור חוויית השימוש. אין שימוש בעוגיות מעקב של צדדים שלישיים."
              : "The platform uses cookies for authentication, saving preferences, and improving the experience. We do not use third-party tracking cookies."}
          </p>
        </section>
      </div>
    </div>
  );
};

export default Privacy;
