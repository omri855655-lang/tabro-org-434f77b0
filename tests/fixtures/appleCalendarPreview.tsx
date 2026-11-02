import React from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../src/hooks/useLanguage';
import AppleCalendarGuide from '../../src/components/AppleCalendarGuide';
import '../../src/index.css';

createRoot(document.getElementById('root')!).render(<LanguageProvider><main dir="rtl" className="min-h-screen bg-background p-6"><div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-2xl border bg-card p-6"><img src="/icons/tabro-v3-512.png" alt="Tabro" className="h-40 w-40 rounded-[2rem]"/><h1 className="text-2xl font-bold">מתכנן הלוז שלך</h1><AppleCalendarGuide onExport={() => { document.getElementById('export-result')!.textContent = 'בקשת ייצוא התקבלה — נתוני הדגמה בלבד'; }} /><p id="export-result" role="status" /></div></main></LanguageProvider>);
