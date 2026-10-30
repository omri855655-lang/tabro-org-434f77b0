export const GIFT_CARD_TYPE = "GIFT_CARD";
export const GIFT_CARD_PROVIDERS = [
  { id: "BUYME", url: "https://buyme.co.il/" },
  { id: "MAX / MyGift", url: "https://www.max.co.il/" },
  { id: "ישראכרט", url: "https://www.isracard.co.il/" },
  { id: "אחר", url: null },
] as const;

export function giftCardInput(name: string, provider: string, balance: string, expiry: string) {
  const amount = Number(balance);
  if (!name.trim() || name.trim().length > 80 || !GIFT_CARD_PROVIDERS.some(item => item.id === provider)) throw new Error("יש לבחור מנפיק ולכתוב שם קצר לשובר.");
  if (!/^\d+(?:\.\d{1,2})?$/.test(balance.trim()) || !Number.isFinite(amount) || amount > 1_000_000) throw new Error("יש להזין יתרה תקינה בשקלים, עד שתי ספרות אחרי הנקודה.");
  if (expiry && (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || !Number.isFinite(Date.parse(`${expiry}T12:00:00Z`)) || new Date(`${expiry}T12:00:00Z`).toISOString().slice(0, 10) !== expiry)) throw new Error("תאריך התוקף אינו תקין.");
  return { name: name.trim(), provider, balance: amount, expiry: expiry || null };
}

export function giftCardStatus(expiry: string | null, balance: number, today: string) {
  if (expiry && expiry < today) return "expired";
  if (balance === 0) return "empty";
  if (expiry && Date.parse(`${expiry}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`) <= 30 * 86400000) return "soon";
  return "active";
}
