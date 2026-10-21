export const escapePrintText = (value: unknown): string => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const printCopy = {
  he: { print: "הדפסה / שמירה כ-PDF", close: "סגור", empty: "אין פריטים בטווח שנבחר", blocked: "הדפדפן חסם את חלון הדוח. אפשר פתיחת חלונות לאתר ונסה שוב.", hint: "בדוק את הדוח, ואז בחר הדפסה או שמירה כ-PDF בחלון ההדפסה." },
  en: { print: "Print / Save as PDF", close: "Close", empty: "No items in this range", blocked: "The browser blocked the report window. Allow pop-ups for this site and try again.", hint: "Review the report, then choose Print or Save as PDF in the print dialog." },
  es: { print: "Imprimir / Guardar como PDF", close: "Cerrar", empty: "No hay elementos en este período", blocked: "El navegador bloqueó el informe. Permite ventanas emergentes en este sitio e inténtalo de nuevo.", hint: "Revisa el informe y elige Imprimir o Guardar como PDF en el diálogo de impresión." },
  zh: { print: "打印 / 另存为 PDF", close: "关闭", empty: "此范围内没有项目", blocked: "浏览器阻止了报告窗口。请允许此网站的弹出窗口后重试。", hint: "检查报告后，在打印对话框中选择打印或另存为 PDF。" },
  ar: { print: "طباعة / حفظ PDF", close: "إغلاق", empty: "لا توجد عناصر في هذه الفترة", blocked: "حظر المتصفح نافذة التقرير. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول مجدداً.", hint: "راجع التقرير ثم اختر الطباعة أو الحفظ بصيغة PDF في نافذة الطباعة." },
  ru: { print: "Печать / Сохранить PDF", close: "Закрыть", empty: "В этом периоде нет записей", blocked: "Браузер заблокировал отчёт. Разрешите всплывающие окна для сайта и повторите попытку.", hint: "Проверьте отчёт и выберите печать или сохранение PDF в диалоге печати." },
};

// Print the top-level document, not a hidden iframe. The native dialog avoids
// popup restrictions and isolates the report from app layouts and scroll areas.
export function printDocument(title: string, columns: string[], rows: unknown[][], subtitle = "", options: { lang?: string; dir?: 'rtl' | 'ltr'; emptyMessage?: string } = {}) {
  const lang = Object.hasOwn(printCopy, options.lang || 'he') ? (options.lang || 'he') as keyof typeof printCopy : 'en';
  const copy = printCopy[lang];
  const report = document.createElement('dialog');
  report.setAttribute('data-tabro-report', '');
  report.setAttribute('aria-label', title);
  report.lang = lang;
  report.dir = options.dir || (lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr');
  const text = escapePrintText;
  report.innerHTML = `<style>
    @page{size:A4 landscape;margin:14mm}
    [data-tabro-report]{position:fixed;inset:0;margin:0;width:100vw;max-width:none;height:100dvh;max-height:none;overflow:auto;border:0;padding:24px;background:white;color:#172b40;font-family:Arial,sans-serif;pointer-events:auto}
    [data-tabro-report] *{box-sizing:border-box}
    [data-tabro-report] .report-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px;margin-bottom:22px;background:#e9f3f6;border-radius:12px}
    [data-tabro-report] .report-toolbar p{flex:1;min-width:180px;margin:0;font-size:13px}
    [data-tabro-report] button{padding:10px 16px;border:1px solid #157e96;border-radius:8px;background:white;color:#172b40;cursor:pointer;font:inherit}
    [data-tabro-report] button:first-child{background:#157e96;color:white}[data-tabro-report] button:focus-visible{outline:3px solid #e4a83a;outline-offset:3px}
    [data-tabro-report] header{border-bottom:3px solid #157e96;padding:0 0 16px;margin-bottom:20px}[data-tabro-report] h1{font-size:26px;margin:0 0 8px}
    [data-tabro-report] p{color:#526575;white-space:pre-wrap}[data-tabro-report] table{width:100%;border-collapse:collapse;font-size:12px}[data-tabro-report] thead{display:table-header-group}
    [data-tabro-report] th{background:#e9f3f6;text-align:start}[data-tabro-report] td,[data-tabro-report] th{padding:10px;border:1px solid #cedde2;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
    [data-tabro-report] tr{break-inside:avoid}[data-tabro-report] tbody tr:nth-child(even){background:#f5f8fa}[data-tabro-report] footer{margin-top:18px;font-size:10px;color:#526575}
    @media print{
      html:has([data-tabro-report]),body:has([data-tabro-report]){height:auto!important;overflow:visible!important;background:white!important}
      body:has([data-tabro-report]) > *:not([data-tabro-report]){display:none!important}
      body:has([data-tabro-report]) > [data-tabro-report],body:has([data-tabro-report]) > [data-tabro-report] *{visibility:visible!important}
      body:has([data-tabro-report]) > [data-tabro-report]{display:block!important;position:static!important;inset:auto!important;width:100%!important;height:auto!important;max-height:none!important;overflow:visible!important;padding:0!important}
      [data-tabro-report] .report-toolbar{display:none!important}[data-tabro-report]::backdrop{display:none}
    }
  </style><nav class="report-toolbar"><button type="button" id="tabro-print-report">${text(copy.print)}</button><p>${text(copy.hint)}</p><button type="button" id="tabro-close-report">${text(copy.close)}</button></nav><header><h1>${text(title)}</h1><p>${text(subtitle)}</p></header><table><thead><tr>${columns.map(c => `<th>${text(c)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${text(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}">${text(options.emptyMessage || copy.empty)}</td></tr>`}</tbody></table><footer>Tabro · ${text(new Date().toLocaleDateString(lang))}</footer>`;
  const previousTitle = document.title;
  const previousFocus = document.activeElement;
  // A report can open above a Radix modal that disables body pointer events.
  // Keep its input inside the native top layer, not the underlying dismiss layer.
  report.addEventListener('pointerdown', event => event.stopPropagation());
  report.addEventListener('focusin', event => event.stopPropagation());
  const closeWithEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !report.contains(event.target as Node)) return;
    event.preventDefault(); event.stopPropagation(); report.close();
  };
  window.addEventListener('keydown', closeWithEscape, true);
  report.addEventListener('close', () => {
    window.removeEventListener('keydown', closeWithEscape, true);
    report.remove(); document.title = previousTitle;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  }, { once: true });
  report.querySelector('#tabro-print-report')?.addEventListener('click', () => window.print());
  report.querySelector('#tabro-close-report')?.addEventListener('click', () => report.close());
  document.body.append(report);
  document.title = title;
  report.showModal();
  return true;
}
