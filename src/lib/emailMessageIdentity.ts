type MailIdentity = { connection_id: string; external_message_id?: string | null; email_subject: string | null; email_from: string | null; email_date: string | null };

const fingerprint = (mail: MailIdentity) => {
  const date = new Date(mail.email_date || "");
  return JSON.stringify([mail.connection_id, mail.email_subject || "", mail.email_from || "", Number.isNaN(date.getTime()) ? mail.email_date || "" : date.toISOString()]);
};

// Provider IDs distinguish separate emails with identical subjects and timestamps.
// Legacy duplicate rows remain stored, but no longer mask the identified message.
export function uniqueEmailMessages<T extends MailIdentity>(messages: T[]): T[] {
  const identified = new Set(messages.filter(mail => mail.external_message_id).map(fingerprint));
  const unique = new Map<string, T>();
  for (const mail of messages) {
    if (!mail.external_message_id && identified.has(fingerprint(mail))) continue;
    const key = mail.external_message_id ? JSON.stringify([mail.connection_id, mail.external_message_id]) : fingerprint(mail);
    if (!unique.has(key)) unique.set(key, mail);
  }
  return [...unique.values()];
}
