import { useLanguage } from '@/hooks/useLanguage';
import { HEALTH_SUMMARY_TEMPLATE, parseHealthSummary } from '@/lib/healthSummaryImport';
import type { HealthDay } from '@/lib/healthImport';
import { Button } from '@/components/ui/button';

const copy = {
  he: ['ייבוא סיכום מכל שעון', 'אפשר להכין קובץ לפי התבנית עבור Garmin, Fitbit, Samsung ושעונים אחרים. זה ייבוא ידני של סיכומים יומיים, ולא חיבור חי לחשבון היצרן.', 'הורדת תבנית CSV', 'הקובץ חייב להתאים לתבנית. תאים ריקים מציינים שאין נתון; ייבוא חוזר מעדכן את אותו היום.'],
  en: ['Import summaries from any watch', 'Prepare a file using this template for Garmin, Fitbit, Samsung or other watches. This imports daily summaries manually; it is not a live vendor connection.', 'Download CSV template', 'Files must match the template. Blank cells mean missing data; reimporting updates the same day.'],
  es: ['Importar resúmenes de cualquier reloj', 'Prepara un archivo con la plantilla para Garmin, Fitbit, Samsung u otros relojes. Importación manual de resúmenes diarios, sin conexión en vivo.', 'Descargar plantilla CSV', 'Usa la plantilla. Celdas vacías indican datos ausentes; reimportar actualiza el mismo día.'],
  ar: ['استيراد ملخصات من أي ساعة', 'جهز ملفاً وفق القالب لـ Garmin أو Fitbit أو Samsung وغيرها. استيراد يدوي لملخصات يومية وليس اتصالاً مباشراً بالحساب.', 'تنزيل قالب CSV', 'يجب مطابقة القالب. الخلايا الفارغة تعني عدم وجود بيانات؛ الاستيراد مجدداً يحدث اليوم نفسه.'],
  ru: ['Импорт сводок любых часов', 'Подготовьте файл по шаблону для Garmin, Fitbit, Samsung и других часов. Это ручной импорт дневных сводок, не прямое подключение.', 'Скачать шаблон CSV', 'Файл должен соответствовать шаблону. Пустые ячейки означают отсутствие данных; повторный импорт обновляет тот же день.'],
  zh: ['导入任意手表的汇总', '按模板准备Garmin、Fitbit、Samsung或其他手表的数据。这是每日汇总的手动导入，并非实时连接厂商账户。', '下载CSV模板', '文件必须符合模板。空白表示无数据；再次导入会更新同一天。'],
};
export function HealthSummaryImport({ busy, onImport, onError }: { busy: boolean; onImport: (days: HealthDay[]) => void; onError: () => void }) {
  const { lang } = useLanguage(), c = copy[lang];
  return <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-medium">{c[0]}</summary>
    <p className="my-3 text-muted-foreground">{c[1]}</p>
    <Button type="button" size="sm" variant="outline" onClick={() => {
      const url = URL.createObjectURL(new Blob([HEALTH_SUMMARY_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'tabro-health-template.csv'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>{c[2]}</Button>
    <p className="my-2 text-xs text-muted-foreground">{c[3]}</p>
    <label>{c[0]}<input className="mt-2 block max-w-full text-xs" disabled={busy} type="file" accept=".csv,.json" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      try { if (file.size > 2_000_000) throw new Error('File too large'); onImport(parseHealthSummary(await file.text(), file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv')); } catch { onError(); }
    }} /></label>
  </details>;
}
