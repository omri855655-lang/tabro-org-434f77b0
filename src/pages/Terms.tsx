import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

const Terms = () => {
  const navigate = useNavigate();
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-1 mb-4">
          <ArrowRight className="h-4 w-4" />{isHebrew ? "חזרה" : "Back"}
        </Button>
        <h1 className="text-3xl font-bold">{isHebrew ? "תנאי שימוש" : "Terms of Use"}</h1>
        <p className="text-sm text-muted-foreground">{isHebrew ? "עדכון אחרון" : "Last updated"}: {new Date().toLocaleDateString(isHebrew ? 'he-IL' : 'en-US')}</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "1. כללי" : "1. General"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? 'ברוכים הבאים ל-Tabro ("המערכת"). השימוש במערכת מהווה הסכמה לתנאים אלה. אם אינך מסכים לתנאים, אנא הימנע משימוש במערכת.'
              : 'Welcome to Tabro ("the platform"). Using the platform means you agree to these terms. If you do not agree, please avoid using the platform.'}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "2. שימוש במערכת" : "2. Use of the Platform"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "המערכת מיועדת לניהול משימות, פרויקטים, לוח זמנים ותוכן אישי. המשתמש אחראי על התוכן שהוא מזין למערכת. אין להשתמש במערכת למטרות בלתי חוקיות או לפגיעה בצדדים שלישיים."
              : "The platform is intended for managing tasks, projects, schedules, and personal content. Users are responsible for the content they add. The platform may not be used for illegal purposes or to harm third parties."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "3. קניין רוחני" : "3. Intellectual Property"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "כל הזכויות על המערכת, הקוד, העיצוב והתוכן המערכתי שמורות. אין להעתיק, לשכפל, להפיץ או לעשות שימוש מסחרי בכל חלק מהמערכת ללא אישור מפורש בכתב."
              : "All rights to the platform, code, design, and system content are reserved. You may not copy, reproduce, distribute, or commercially use any part of the platform without prior written permission."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "4. שימוש ב-AI" : "4. Use of AI"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "המערכת כוללת תכונות AI (בינה מלאכותית). תוצאות ה-AI הן המלצות בלבד ואינן מהוות ייעוץ מקצועי — לא פיננסי, לא רפואי ולא משפטי. השימוש בהמלצות הוא באחריות המשתמש בלבד."
              : "The platform includes AI features. AI output is provided as guidance only and does not constitute professional advice of any kind, including financial, medical, or legal advice. Use of these recommendations is at your own responsibility."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "5. שיתוף ושיתוף פעולה" : "5. Sharing and Collaboration"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "המערכת מאפשרת שיתוף גליונות ופרויקטים עם משתמשים אחרים. המשתמש אחראי על ניהול ההרשאות ועל התוכן שהוא משתף. המערכת אינה אחראית לשימוש שיעשו צדדים שלישיים בתוכן משותף."
              : "The platform allows sharing sheets and projects with other users. You are responsible for permissions and for the content you choose to share. The platform is not responsible for how third parties use shared content."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "6. הגבלת אחריות" : "6. Limitation of Liability"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? 'המערכת מסופקת "כמות שהיא" (AS IS). אנו עושים מאמץ לשמור על זמינות ואבטחה, אך אין אחריות על אובדן נתונים, השבתות או טעויות. מומלץ לגבות נתונים חשובים באופן עצמאי.'
              : 'The platform is provided "as is" (AS IS). We work to maintain availability and security, but we are not liable for data loss, outages, or mistakes. We recommend backing up important data independently.'}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isHebrew ? "7. שינויים בתנאים" : "7. Changes to These Terms"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isHebrew
              ? "אנו שומרים את הזכות לעדכן תנאים אלו מעת לעת. שימוש מתמשך במערכת מהווה הסכמה לתנאים המעודכנים."
              : "We reserve the right to update these terms from time to time. Continued use of the platform means you agree to the updated terms."}
          </p>
        </section>
      </div>
    </div>
  );
};

export default Terms;
