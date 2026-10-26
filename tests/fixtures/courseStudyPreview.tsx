import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { CourseStudyPanel } from '@/components/courses/CourseStudyCompanion';
import { CourseLessonDraft } from '@/components/courses/CourseLessonDraft';
import { newCourseLessons, type LessonDraft } from '@/lib/courseStudy';
import { courseStudyCopy } from '@/lib/courseStudyCopy';
import { Button } from '@/components/ui/button';
import type { AppLanguage } from '@/lib/appLanguage';
import '@/index.css';

function Fixture() {
  const { lang, setLang } = useLanguage();
  const [lessons, setLessons] = useState<LessonDraft[]>([{ title: 'קביעת סדר יום ציבורי', duration_minutes: 45 }]);
  const [draft, setDraft] = useState<LessonDraft[] | null>(null);
  return <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
    <p className="rounded-xl border bg-amber-50 p-3 text-sm text-amber-950">תצוגת בדיקה בלבד · נתונים לדוגמה · תשובת AI מדומה · אין קריאות AI או שמירה לשרת</p>
    <select aria-label="Language" value={lang} onChange={e => setLang(e.target.value as AppLanguage)}>{['he','en','ar','es','ru','zh'].map(code => <option key={code}>{code}</option>)}</select>
    <h1 className="text-3xl font-bold">מבוא למדיניות ציבורית</h1>
    <CourseStudyPanel storageKey="course-study-qa" advisorKey="course-advisor-qa" course={{ id: 'fixture', title: 'מבוא למדיניות ציבורית', syllabus: 'שיעור 1: קביעת סדר יום ציבורי\nשיעור 2: יישום מדיניות\nשיעור 3: הערכת תוכניות' }} lessons={lessons} requestAdvice={async () => 'תשובת הדגמה בלבד: נתחיל בהבחנה בין קביעת סדר יום ליישום מדיניות. איזה שלב קשה לך יותר, ולמה?'} />
    <Button variant="outline" onClick={() => setDraft([{title:'קביעת סדר יום ציבורי',duration_minutes:45},{title:'יישום מדיניות',duration_minutes:30}])}>{courseStudyCopy[lang].draft}</Button>
    <p role="status">שיעורים בדוגמה: {lessons.length}</p>
    <CourseLessonDraft lessons={draft} onChange={setDraft} onCancel={() => setDraft(null)} busy={false} onConfirm={() => {setLessons(current => [...current, ...newCourseLessons(draft || [], current)]); setDraft(null);}} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><Fixture /></LanguageProvider>);
