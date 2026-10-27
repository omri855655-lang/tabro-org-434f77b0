import { useState, type ReactNode } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { safeLocalStorage } from '@/lib/safeLocalStorage';

const copy = {
  he: ['פתיחה או הסתרת המדריך', 'הסתר תוכן', 'הבחירה נשמרת במכשיר זה. אפשר לפתוח שוב בכל עת.'],
  en: ['Show or hide guide', 'Hide content', 'Saved on this device. Reopen at any time.'],
  es: ['Mostrar u ocultar guía', 'Ocultar contenido', 'Guardado en este dispositivo. Puedes volver a abrirlo.'],
  zh: ['显示或隐藏指南', '隐藏内容', '保存在此设备上。随时可以重新打开。'],
  ar: ['إظهار الدليل أو إخفاؤه', 'إخفاء المحتوى', 'محفوظ على هذا الجهاز. يمكنك فتحه مجدداً في أي وقت.'],
  ru: ['Показать или скрыть руководство', 'Скрыть содержимое', 'Сохранено на этом устройстве. Можно открыть снова.'],
};

export function ZoneFlowGuide(props: { id: string; userId?: string; title: string; children: ReactNode }) {
  return <Guide key={`${props.userId || 'guest'}:${props.id}`} {...props} />;
}

function Guide({ id, userId, title, children }: { id: string; userId?: string; title: string; children: ReactNode }) {
  const { lang } = useLanguage();
  const key = `zoneflow-guide:v1:${userId || 'guest'}:${id}`;
  const [open, setOpen] = useState(() => safeLocalStorage.getJSON<unknown>(key, false) === true);
  const change = (value: boolean) => { setOpen(value); safeLocalStorage.setJSON(key, value); };
  return <details open={open} onToggle={event => {
    if (event.currentTarget.open !== open) change(event.currentTarget.open);
  }} className="rounded-2xl border border-current/15 bg-white/5 text-inherit">
    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2" aria-label={`${title}: ${copy[lang][0]}`}>{title}</summary>
    {open && <div className="space-y-2 px-2 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-xs">
        <p className="opacity-80">{copy[lang][2]}</p>
        <button type="button" className="rounded-lg border border-current/20 px-3 py-2" onClick={event => {
          event.currentTarget.closest('details')?.querySelector('summary')?.focus();
          change(false);
        }}>{copy[lang][1]}</button>
      </div>
      {children}
    </div>}
  </details>;
}
