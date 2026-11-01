import type { BriefingItem, DailyBriefing } from "../_shared/dailyBriefing.ts";
import { formatIsraelDay } from "../_shared/dailyBriefing.ts";

export const SITE_URL = "https://tabro.org";
const HTML_ITEM_LIMIT = 25;

export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));

const SECTION: Record<BriefingItem["kind"], string> = { task: "משימות", event: "לו״ז היום", mail: "מיילים שעשויים לדרוש טיפול" };

export function briefingSubject(report: DailyBriefing, test: boolean): string {
  const prefix = test ? "[בדיקה] " : "";
  return `${prefix}${report.mode === "morning" ? "התדריך היומי שלך" : "מה נשאר להיום"} · ${formatIsraelDay(report.date)} · ${report.summary}`;
}

export function buildBriefingEmail(report: DailyBriefing, opts: { test: boolean; pdfAttached: boolean; unsubscribeUrl: string | null }) {
  const shown = report.items.slice(0, HTML_ITEM_LIMIT);
  const hidden = report.items.length - shown.length;
  let section: BriefingItem["kind"] | null = null;
  const blocks: string[] = [];
  const text: string[] = [report.title, `${formatIsraelDay(report.date)} · שעון ישראל`, report.summary];
  if (report.recommendation) text.push(report.recommendation);
  for (const item of shown) {
    if (item.kind !== section) {
      section = item.kind;
      blocks.push(`<h2 style="font-size:16px;color:#3525cd;margin:22px 0 8px">${SECTION[item.kind]}</h2>`);
      text.push("", `== ${SECTION[item.kind]} ==`);
    }
    const meta = item.kind === "event" ? "מיקום" : item.kind === "mail" ? "שולח" : "אחראי / איש קשר";
    blocks.push(`<div style="border-right:3px solid ${item.urgent ? "#b42318" : "#d9dbe6"};padding:6px 12px;margin:0 0 10px">
<div style="font-weight:bold;color:${item.urgent ? "#b42318" : "#1c1f33"}">${escapeHtml(item.label)}: ${escapeHtml(item.title)}</div>
<div style="color:#5f6376;font-size:13px">מועד: ${escapeHtml(item.when || "—")} · ${meta}: ${escapeHtml(item.who || "—")}</div>
${item.details ? `<div style="font-size:13px">${escapeHtml(item.details)}</div>` : ""}
${item.suggestion ? `<div style="font-size:13px;color:#3525cd">${escapeHtml(item.suggestion)}</div>` : ""}
</div>`);
    text.push(`- ${item.label}: ${item.title}`, `  מועד: ${item.when || "—"} · ${meta}: ${item.who || "—"}`);
    if (item.details) text.push(`  ${item.details}`);
    if (item.suggestion) text.push(`  ${item.suggestion}`);
  }
  if (!report.items.length) {
    blocks.push(`<p>אין משימות פתוחות להיום, משימות דחופות או אירועים שנותרו.</p>`);
    text.push("", "אין משימות פתוחות להיום, משימות דחופות או אירועים שנותרו.");
  }
  if (hidden > 0) {
    const note = opts.pdfAttached ? `ועוד ${hidden} פריטים מופיעים בקובץ ה־PDF המצורף.` : `ועוד ${hidden} פריטים מחכים לך באתר.`;
    blocks.push(`<p style="font-weight:bold">${note}</p>`);
    text.push("", note);
  }
  const footerLinks = [`<a href="${SITE_URL}/personal" style="color:#3525cd">פתיחת Tabro</a>`, `<a href="${SITE_URL}/personal" style="color:#3525cd">שינוי או כיבוי התדריך (מיילים ← הסיכום היומי שלך)</a>`];
  if (opts.unsubscribeUrl) footerLinks.push(`<a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#5f6376">הסרה מרשימת התפוצה</a>`);
  const disclaimer = "ההמלצות הן הצעות בלבד, על סמך מה ששמרת ב־Tabro. סיווג מיילים מבוסס על נושא ושולח בלבד ואינו מאמת את ההודעה.";
  const html = `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#f5f6fb">
<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;color:#1c1f33;text-align:right">
${opts.test ? `<p style="background:#fff4e0;padding:8px 12px;border-radius:6px">זו שליחת בדיקה שביקשת מהאתר.</p>` : ""}
<h1 style="font-size:22px;color:#3525cd;margin:0 0 4px">${escapeHtml(report.title)}</h1>
<div style="color:#5f6376;font-size:13px">${escapeHtml(formatIsraelDay(report.date))} · שעון ישראל</div>
<p style="font-weight:bold;margin:14px 0 4px">${escapeHtml(report.summary)}</p>
${report.recommendation ? `<p style="margin:0 0 8px">${escapeHtml(report.recommendation)}</p>` : ""}
${opts.pdfAttached ? `<p style="font-size:13px;color:#5f6376">מצורף קובץ PDF להדפסה עם כל הפרטים.</p>` : ""}
${blocks.join("\n")}
<hr style="border:none;border-top:1px solid #e3e4ec;margin:24px 0 12px">
<p style="font-size:12px;color:#5f6376">${disclaimer}</p>
<p style="font-size:12px">${footerLinks.join(" · ")}</p>
<p style="font-size:11px;color:#8a8ea0">${opts.test ? "נשלח לבקשתך כבדיקה מתוך Tabro." : "נשלח אליך כי הפעלת את התדריך היומי במייל ב־Tabro."} לשאלות אפשר להשיב למייל הזה.</p>
</div></body></html>`;
  text.push("", disclaimer, `פתיחת Tabro: ${SITE_URL}/personal`);
  if (opts.unsubscribeUrl) text.push(`הסרה מרשימת התפוצה: ${opts.unsubscribeUrl}`);
  return { html, text: text.join("\n") };
}
