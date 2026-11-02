// Hebrew alert email listing only metadata (sender + subject) of important new mail.
const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function buildImportantMailEmail(mails: { email_subject: string | null; email_from: string | null }[]) {
  const items = mails.slice(0, 20).map(m => ({
    from: (m.email_from || "שולח לא ידוע").replace(/[\r\n]+/g, " ").slice(0, 160),
    subject: (m.email_subject || "(ללא נושא)").replace(/[\r\n]+/g, " ").slice(0, 200),
  }));
  const count = mails.length;
  const subject = count === 1 ? "Tabro: מייל חשוב חדש" : `Tabro: ${count} מיילים חשובים חדשים`;
  const settingsUrl = "https://tabro.org/personal";
  const note = "הסימון מבוסס על כללי המיון וההעדפות שלך בלבד. הוא אינו מאמת את זהות השולח — אל תלחץ על קישורים או תמסור פרטים בלי לבדוק.";
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f1d2b">
  <h2 style="color:#3525cd;margin:0 0 12px">${escapeHtml(subject)}</h2>
  <ul style="padding-inline-start:18px;margin:0 0 16px">${items.map(i => `<li style="margin:0 0 8px"><strong>${escapeHtml(i.subject)}</strong><br><span style="color:#555">${escapeHtml(i.from)}</span></li>`).join("")}</ul>
  <p style="font-size:12px;color:#666">${escapeHtml(note)}</p>
  <p style="font-size:12px;color:#666">לשינוי או כיבוי ההתראות: <a href="${settingsUrl}">הגדרות ההתראות ב-Tabro</a></p>
</div>`;
  const text = [subject, "", ...items.map(i => `• ${i.subject} — ${i.from}`), "", note, `לשינוי או כיבוי: ${settingsUrl}`].join("\n");
  return { subject, html, text };
}
