export const escapePrintText = (value: unknown): string => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Use a separate document so dialogs, virtual scroll areas and app print CSS
// cannot hide the actual report. Values are always text, never supplied HTML.
export function printDocument(title: string, columns: string[], rows: unknown[][], subtitle = "") {
  const frame = document.createElement("iframe");
  frame.title = title;
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1120px;height:800px;border:0";
  document.body.append(frame);
  const report = frame.contentDocument;
  if (!report) { frame.remove(); return; }
  const text = escapePrintText;
  report.open();
  report.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${text(title)}</title><style>
    @page{size:A4 landscape;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172b40;margin:0}
    header{border-bottom:3px solid #157e96;padding:0 0 16px;margin-bottom:20px}h1{font-size:26px;margin:0 0 8px}
    p{color:#526575;white-space:pre-wrap}table{width:100%;border-collapse:collapse;font-size:12px}thead{display:table-header-group}
    th{background:#e9f3f6;text-align:right}td,th{padding:10px;border:1px solid #cedde2;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
    tr{break-inside:avoid}tbody tr:nth-child(even){background:#f5f8fa}footer{margin-top:18px;font-size:10px;color:#526575}
  </style></head><body><header><h1>${text(title)}</h1><p>${text(subtitle)}</p></header><table><thead><tr>${columns.map(c => `<th>${text(c)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${text(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}">אין פריטים בטווח שנבחר</td></tr>`}</tbody></table><footer>Tabro · ${text(new Date().toLocaleDateString("he-IL"))}</footer></body></html>`);
  report.close();
  const target = frame.contentWindow;
  if (!target) { frame.remove(); return; }
  target.addEventListener("afterprint", () => frame.remove(), { once: true });
  target.requestAnimationFrame(() => { target.focus(); target.print(); });
}
