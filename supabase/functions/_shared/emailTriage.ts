export type MailBucket = "action" | "finance" | "shopping" | "updates" | "personal" | "promotions" | "low";

export interface MailPreferences {
  vipSenders: string[];
  lowPrioritySenders: string[];
  importantKeywords: string[];
  ignoredKeywords: string[];
  importantCategories: string[];
  senderBuckets: Record<string, MailBucket>;
}

export function senderDomain(from = ""): string {
  return from.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase() || "";
}

// Metadata can suggest priority, but cannot authenticate a sender or detect all scams.
export function triageEmail(mail: { email_subject: string | null; email_from: string | null; category: string }, prefs?: MailPreferences) {
  const subject = (mail.email_subject || "").toLowerCase();
  const from = (mail.email_from || "").toLowerCase();
  const domain = senderDomain(from);
  const has = (pattern: RegExp) => pattern.test(subject);
  const matchesSender = (list: string[] = []) => list.some(value => value.toLowerCase() === domain || value.toLowerCase() === from);
  const security = has(/\b(password|verification code|security alert|suspicious|unauthorized|account locked|one.time code)\b|סיסמ[אה]|קוד אימות|פעילות חשודה|התראת אבטחה|חשבון.*נחסם/iu);
  const action = has(/\b(action required|reply needed|follow.up|deadline|urgent|asap)\b|נדרשת פעולה|נדרש אישור|מועד אחרון|דחוף|לטיפול|נא להשיב/iu);
  const urgent = has(/\b(urgent|asap|today|overdue)\b|דחוף|היום|באיחור/iu);
  const finance = ["payment", "bill"].includes(mail.category) || has(/\b(invoice|receipt|payment|billing|statement|charge)\b|חשבונית|קבלה|חיוב|תשלום/iu);
  const promotional = ["newsletter", "promotion", "social"].includes(mail.category) || has(/\b(sale|discount|coupon|newsletter|special offer|unsubscribe)\b|מבצע|קופון|פרסומת|הסר מרשימת|הסרה מרשימת/iu);
  const learned = prefs?.senderBuckets?.[domain] || prefs?.senderBuckets?.[from];
  const validBuckets: MailBucket[] = ["action", "finance", "shopping", "updates", "personal", "promotions", "low"];
  let bucket: MailBucket;
  let reason: string;
  if (learned && validBuckets.includes(learned)) { bucket = learned; reason = "preference"; }
  else if (security || action || ["task", "meeting"].includes(mail.category)) { bucket = "action"; reason = security ? "security" : "action"; }
  else if (matchesSender(prefs?.vipSenders)) { bucket = "personal"; reason = "vip"; }
  else if (finance) { bucket = "finance"; reason = "finance"; }
  else if (matchesSender(prefs?.lowPrioritySenders) || promotional) { bucket = "promotions"; reason = "promotion"; }
  else if (["shopping", "delivery"].includes(mail.category) || has(/\b(shipping|delivery|tracking|order)\b|משלוח|מספר מעקב|הזמנה/iu)) { bucket = "shopping"; reason = "shopping"; }
  else if (has(/\b(update|summary|digest|notification|report)\b|עדכון|התראה|סיכום/iu)) { bucket = "updates"; reason = "update"; }
  else { bucket = "personal"; reason = "unclassified"; }
  let priority = { action: urgent || security ? 5 : 4, finance: 3.5, shopping: 2.5, updates: 2, personal: 2.2, promotions: 0.5, low: 0.5 }[bucket];
  if (matchesSender(prefs?.vipSenders)) priority += 2;
  if (prefs?.importantCategories?.includes(mail.category)) priority += 0.75;
  if (prefs?.importantKeywords?.some(word => word.trim() && subject.includes(word.toLowerCase()))) priority += 1.5;
  if (prefs?.ignoredKeywords?.some(word => word.trim() && subject.includes(word.toLowerCase()))) priority -= 1.25;
  if (matchesSender(prefs?.lowPrioritySenders)) priority -= 1.5;
  return { bucket, priority: Math.max(0.5, Math.min(6, priority)), reason, security, requiresAction: security || action || ["task", "meeting"].includes(mail.category) };
}
