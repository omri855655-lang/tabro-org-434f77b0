import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { financeCalendarDate, formatFinanceMoney } from "@/lib/financeInsights";
import { GIFT_CARD_TYPE, GIFT_CARD_PROVIDERS, giftCardInput, giftCardStatus } from "@/lib/giftCards";
import type { Tables } from "@/integrations/supabase/types";

type Gift = Tables<"financial_accounts">;
const metadata = (gift: Gift) => {
  const raw = gift.raw_data && typeof gift.raw_data === "object" && !Array.isArray(gift.raw_data) ? gift.raw_data : {};
  return { expiry: typeof raw.expiry === "string" ? raw.expiry : null, archived: raw.archived === true, updated: typeof raw.balance_checked_at === "string" ? raw.balance_checked_at : null };
};
const blank = {name:"",provider:"BUYME",balance:"",expiry:""};

export default function GiftCardWallet({ userId }: { userId?: string }) {
  const [items, setItems] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Gift | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => {
    let active = true;
    if (!userId) { setLoading(false); return; }
    void supabase.from("financial_accounts").select("*").eq("user_id", userId).eq("account_type", GIFT_CARD_TYPE).order("updated_at", {ascending:false})
      .then(({data,error}) => { if (active) { setItems(data || []); setError(error ? "לא הצלחנו לטעון את ארנק השוברים. אפשר לרענן ולנסות שוב." : ""); setLoading(false); } });
    return () => {active=false;};
  }, [userId]);
  async function save() {
    if (!userId || saving) return;
    setError("");
    try {
      const parsed = giftCardInput(draft.name,draft.provider,draft.balance,draft.expiry);
      setSaving(true);
      const now = new Date().toISOString();
      const payload = {display_name:parsed.name,provider_name:parsed.provider,current_balance:parsed.balance,currency:"ILS",updated_at:now,
        raw_data:{expiry:parsed.expiry,archived:false,balance_checked_at:now,source:"manual_gift_card"}};
      const response = editing ? await supabase.from("financial_accounts").update(payload).eq("id", editing.id).eq("user_id",userId).eq("account_type",GIFT_CARD_TYPE).eq("updated_at",editing.updated_at).select("*").single()
        : await supabase.from("financial_accounts").insert({...payload,user_id:userId,account_type:GIFT_CARD_TYPE,external_account_id:`gift:${crypto.randomUUID()}`}).select("*").single();
      if (response.error || !response.data) throw new Error("השמירה לא הושלמה. אם השובר עודכן במכשיר אחר, רענן לפני ניסיון נוסף.");
      setItems(current => [response.data, ...current.filter(item => item.id !== response.data.id)]);
      setFormOpen(false); setEditing(null); setDraft(blank);
    } catch (err) {setError(err instanceof Error ? err.message : "השמירה לא הושלמה.");}
    finally {setSaving(false);}
  }
  async function archive(gift: Gift) {
    if (!userId || saving) return;
    setSaving(true); setError("");
    const info = metadata(gift);
    try {
      const {data,error} = await supabase.from("financial_accounts").update({raw_data:{expiry:info.expiry,archived:!info.archived,balance_checked_at:info.updated,source:"manual_gift_card"},updated_at:new Date().toISOString()})
        .eq("id",gift.id).eq("user_id",userId).eq("account_type",GIFT_CARD_TYPE).eq("updated_at",gift.updated_at).select("*").single();
      if (error || !data) throw new Error("לא ניתן לעדכן כרגע. רענן ובדוק אם השובר השתנה במכשיר אחר.");
      setItems(current => current.map(item => item.id === data.id ? data : item));
    } catch (err) {setError(err instanceof Error ? err.message : "העדכון לא הושלם.");}
    finally {setSaving(false);}
  }
  const today = financeCalendarDate(new Date())!;
  const shown = items.filter(item => metadata(item).archived === showArchived);
  return <details className="rounded-2xl border bg-background p-4" dir="rtl">
    <summary className="cursor-pointer text-sm font-semibold">ארנק גיפט קארדס · עדכון ידני</summary>
    <p className="my-3 text-xs leading-5 text-muted-foreground">שומרים שם, יתרה ותוקף בלבד, בלי קוד מימוש או סיסמה. היתרה היא דיווח שלך, לא סנכרון חי, והיא אינה מצטרפת ליתרת הבנק או לתקציב. ההתחברות ובדיקת היתרה נעשות באתר המנפיק.</p>
    <p className="text-xs text-muted-foreground mb-3">חיבור אוטומטי ל־BUYME ולמנפיקים אחרים עדיין לא זמין ב־Tabro; הוא דורש ממשק מורשה שניתן לבדוק. כפתורי המנפיקים אינם מפעילים סנכרון.</p>
    <div className="flex gap-2 flex-wrap mb-3"><Button size="sm" disabled={saving || loading || !userId} onClick={() => {setEditing(null);setDraft(blank);setFormOpen(true);}}>הוספת שובר</Button><Button size="sm" variant="outline" onClick={() => setShowArchived(value => !value)}>{showArchived ? "שוברים פעילים" : "ארכיון שוברים"}</Button></div>
    {error && <p role="alert" className="text-sm text-destructive mb-3">{error}</p>}
    {formOpen && <form className="grid gap-3 rounded-xl border p-3 mb-3 sm:grid-cols-2" onSubmit={event => {event.preventDefault();void save();}}>
      <label className="text-sm">שם השובר (ללא קוד)<Input value={draft.name} maxLength={80} required disabled={saving} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
      <label className="text-sm">מנפיק<select className="block w-full h-10 rounded-md border bg-background px-2" value={draft.provider} disabled={saving} onChange={event=>setDraft({...draft,provider:event.target.value})}>{GIFT_CARD_PROVIDERS.map(provider=><option key={provider.id}>{provider.id}</option>)}</select></label>
      <label className="text-sm">יתרה ידנית בשקלים<Input type="number" min="0" max="1000000" step="0.01" required value={draft.balance} disabled={saving} onChange={event=>setDraft({...draft,balance:event.target.value})}/></label>
      <label className="text-sm">תוקף (אפשר להשאיר ריק)<Input type="date" value={draft.expiry} disabled={saving} onChange={event=>setDraft({...draft,expiry:event.target.value})}/></label>
      <div className="flex gap-2"><Button type="submit" size="sm" disabled={saving}>{saving ? "שומר..." : "שמירת השובר"}</Button><Button type="button" variant="ghost" size="sm" disabled={saving} onClick={()=>setFormOpen(false)}>ביטול</Button></div>
    </form>}
    {loading ? <p role="status" className="text-sm">טוען שוברים...</p> : <div className="grid gap-3 sm:grid-cols-2">{shown.map(gift => {
      const info = metadata(gift), status = giftCardStatus(info.expiry,gift.current_balance || 0,today);
      const provider = GIFT_CARD_PROVIDERS.find(item => item.id === gift.provider_name);
      return <article key={gift.id} className="rounded-xl border p-3 space-y-2"><h4 className="font-semibold break-words">{gift.display_name}</h4><p className="text-xs text-muted-foreground">{gift.provider_name} · דיווח ידני</p>
        <p className="text-xl font-semibold">{formatFinanceMoney(gift.current_balance || 0,"ILS","he-IL")}</p>
        <p className="text-xs">{info.expiry ? `תוקף: ${info.expiry}` : "לא הוזן תוקף"}{status === "expired" ? " · התוקף המדווח חלף; בדוק אצל המנפיק" : status === "soon" ? " · התוקף המדווח קרוב" : status === "empty" ? " · ללא יתרה מדווחת" : ""}</p>
        <p className="text-xs text-muted-foreground">עודכן ידנית: {info.updated ? financeCalendarDate(info.updated) : "לא ידוע"}</p>
        <div className="flex flex-wrap gap-2">{provider?.url && <a className="text-sm underline text-primary" href={provider.url} target="_blank" rel="noopener noreferrer">בדיקת יתרה באתר המנפיק</a>}</div>
        <div className="flex flex-wrap gap-2">{!info.archived && <Button size="sm" variant="outline" disabled={saving} onClick={()=>{setEditing(gift);setDraft({name:gift.display_name || "",provider:gift.provider_name || "אחר",balance:String(gift.current_balance ?? ""),expiry:info.expiry || ""});setFormOpen(true);}}>עדכון יתרה ופרטים</Button>}<Button size="sm" variant="ghost" disabled={saving} onClick={()=>void archive(gift)}>{info.archived ? "שחזור מהארכיון" : "העברה לארכיון"}</Button></div>
      </article>;
    })}</div>}
    {!loading && !error && !shown.length && <p className="text-sm text-muted-foreground">{showArchived ? "אין שוברים בארכיון." : "עדיין לא הוספת שוברים. הקוד המלא נשאר אצלך ובאתר המנפיק בלבד."}</p>}
  </details>;
}
