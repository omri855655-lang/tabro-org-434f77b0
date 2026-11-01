import { useCallback, useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { israelDate, makeDailyBriefing, projectBriefingTasks, recurringBriefingTasks, type BriefingMode } from "@/lib/dailyBriefing";
import { normalizeBriefingSettings, type BriefingEmailSettings, type BriefingSlot } from "../../supabase/functions/_shared/briefingSchedule.ts";
import { printDocument } from "@/lib/printDocument";
import { toast } from "sonner";
import { briefingCoachRequest } from "@/lib/briefingCoach";
import { Mail, Printer, Send } from "lucide-react";

type Delivery = { id: string; local_date: string; slot: string; kind: string; status: string; retryable: boolean; last_error: string | null; pdf_pages: number | null; created_at: string };

const STATUS_LABEL: Record<string, string> = {
  accepted: "נמסר לשירות המייל",
  sending: "בשליחה",
  failed: "נכשל",
  skipped: "דולג",
  duplicate_suppressed: "נחסם ככפול",
};
const SKIP_LABEL: Record<string, string> = {
  quiet_hours: "שעות שקטות",
  email_disabled: "התראות מייל כבויות",
  daily_limit: "הגעת למגבלה היומית",
  suppressed: "הכתובת הוסרה מרשימת התפוצה",
  no_verified_email: "אין כתובת מייל מאומתת",
  nothing_remaining: "לא נשאר מה לדווח",
};

const OPTIONS: { key: keyof BriefingEmailSettings; label: string }[] = [
  { key: "morning", label: "08:00 · משימות להיום, לו״ז, הצעות לצעד הבא ומיילים חשובים" },
  { key: "afternoon", label: "16:00 · מה שנשאר: דחופים, באיחור ופגישות שנותרו" },
  { key: "includeTasks", label: "לכלול משימות (אישיות, עבודה, פרויקטים וקבועות)" },
  { key: "includePlanner", label: "לכלול אירועים מהלו״ז" },
  { key: "includeMail", label: "לכלול מיילים שעשויים לדרוש טיפול (בבוקר בלבד)" },
  { key: "includeSuggestions", label: "לכלול הצעות לצעד הבא" },
  { key: "attachPdf", label: "לצרף PDF להדפסה" },
];

export default function DailyBriefingPreview() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<BriefingEmailSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [coaching, setCoaching] = useState(false);
  const [coach, setCoach] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [prefs, history] = await Promise.all([
      supabase.from("user_preferences").select("notification_settings").eq("user_id", user.id).maybeSingle(),
      supabase.from("daily_briefing_deliveries").select("id,local_date,slot,kind,status,retryable,last_error,pdf_pages,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]);
    const raw = prefs.data?.notification_settings as Record<string, unknown> | null;
    setSettings(normalizeBriefingSettings(raw?.dailyBriefingEmail));
    setDeliveries((history.data || []) as Delivery[]);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const save = async (next: BriefingEmailSettings) => {
    if (!user || saving) return;
    setSaving(true);
    const previous = settings;
    setSettings(next);
    try {
      // Merge into the stored settings so every other notification choice is kept.
      const { data, error } = await supabase.from("user_preferences").select("notification_settings").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      const existing = (data?.notification_settings as Record<string, unknown> | null) || {};
      const { error: saveError } = await supabase.from("user_preferences")
        .upsert({ user_id: user.id, notification_settings: { ...existing, dailyBriefingEmail: { ...next } } as never }, { onConflict: "user_id" });
      if (saveError) throw saveError;
      toast.success(next.enabled ? "התדריך היומי במייל נשמר" : "התדריך היומי במייל כבוי");
    } catch {
      setSettings(previous);
      toast.error("השמירה נכשלה. ההגדרות לא שונו.");
    } finally { setSaving(false); }
  };

  const sendTest = async (slot: BriefingSlot) => {
    if (!user || testing) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-briefing-email", { body: { action: "test", slot } });
      if (error) {
        let message = "שליחת הבדיקה נכשלה.";
        if (error instanceof FunctionsHttpError) {
          const details = await error.context.json().catch(() => null);
          if (details?.message) message = details.message;
          else if (details?.delivery?.last_error) message = `שליחת הבדיקה נכשלה: ${SKIP_LABEL[details.delivery.last_error] || details.delivery.last_error}`;
        }
        toast.error(message);
      } else if (data?.outcome === "accepted") {
        toast.success("שירות המייל קיבל את הבדיקה. היא אמורה להגיע לתיבה שלך בדקות הקרובות.");
      }
    } finally {
      setTesting(false);
      void load();
    }
  };

   const currentReport = async (mode: BriefingMode) => {
    if (!user) throw new Error("Login required");
  const now = new Date();
  const [tasks, events, mail, prefs, recurring, completions, projects] = await Promise.all([
    supabase.from("tasks").select("id,description,status,status_notes,planned_end,urgent,overdue,archived,responsible,task_type,progress").eq("user_id", user.id).eq("archived", false).order("planned_end", { ascending: true }).limit(2000),
    supabase.from("calendar_events").select("id,title,start_time,end_time,location,all_day,description").eq("user_id", user.id).gte("end_time", new Date(Date.now() - 86400000).toISOString()).lte("start_time", new Date(Date.now() + 86400000).toISOString()).order("start_time").limit(500),
    supabase.from("email_analyses").select("email_subject,email_from,email_date,category").eq("user_id", user.id).gte("email_date", new Date(Date.now() - 7 * 86400000).toISOString()).order("email_date", { ascending: false }).limit(1000),
    supabase.from("user_preferences").select("notification_settings").eq("user_id", user.id).maybeSingle(),
    supabase.from("recurring_tasks").select("id,title,description,frequency,day_of_week,day_of_month,reminder_time").eq("user_id", user.id).limit(1000),
    supabase.from("recurring_task_completions").select("recurring_task_id").eq("user_id", user.id).eq("completed_date", israelDate(now)).limit(1000),
    supabase.from("project_tasks").select("id,title,status,due_date,urgent,completed,assigned_email,instructions,notes").eq("user_id", user.id).limit(2000),
  ]);
  for (const result of [tasks, events, mail, prefs, recurring, completions, projects]) if (result.error) throw result.error;
  const stored = prefs.data?.notification_settings as Record<string, unknown> | null;
  const combinedTasks = [
    ...(tasks.data || []).map(task => ({ ...task, notes: task.status_notes })),
    ...recurringBriefingTasks(recurring.data || [], (completions.data || []).map(row => row.recurring_task_id), now),
    ...projectBriefingTasks(projects.data || []),
  ];
  const report = makeDailyBriefing(combinedTasks, events.data || [], mail.data || [], mode, now, stored?.emailTriage as Parameters<typeof makeDailyBriefing>[5]);
    return report;
  };
  const preview = async (mode: BriefingMode) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const report = await currentReport(mode);
      printDocument(report.title, ["סוג", "מה לעשות", "מועד", "אחראי / שולח / מיקום", "פרטים / הצעה לצעד הבא"], report.rows,
        `${report.date} · שעון ישראל\n${report.summary}\n${report.recommendation}\nכולל משימות אישיות, עבודה, פרויקטים ומשימות קבועות להיום. ההמלצות הן הצעות בלבד. מיילים מסווגים לפי נושא ושולח בלבד, ללא אימות תוכנם.`, { lang: "he", dir: "rtl", emptyMessage: "אין משימות מתאימות או אירועים בטווח. אפשר לבדוק את כלל המשימות בלוח." });
    } catch {
      toast.error("לא הצלחנו לטעון את כל חלקי הסיכום. לא הופק דוח חלקי מטעה; נסה שוב.");
    } finally { setBusy(false); }
  };

  const requestCoach = async () => {
    if (!user || coaching) return;
    if (!window.confirm("הייעוץ ישלח עד 20 פריטי סיכום (כותרות, מועדים, אנשי קשר והערות) לספק ה־AI המחובר דרך Lovable. הפעולה עשויה לצרוך שימוש AI. לא יישלחו גופי מיילים או קבצים, ולא ישונו משימות. להמשיך?")) return;
    setCoaching(true); setCoach(null);
    try {
      const report = await currentReport("morning");
      if (!report.items.length) { toast.info("אין כרגע פריטים לניתוח בסיכום."); return; }
      const { data, error } = await supabase.functions.invoke("task-ai-helper", { body: briefingCoachRequest(report) });
      if (error || typeof data?.suggestion !== "string" || !data.suggestion.trim()) throw new Error("Coach unavailable");
      setCoach(data.suggestion.slice(0, 20000));
    } catch { toast.error("הייעוץ לא זמין כרגע. הסיכום הרגיל נשאר זמין ולא שונו משימות."); }
    finally { setCoaching(false); }
  };

  return <Card className="card-surface">
    <CardHeader><CardTitle className="text-base">הסיכום היומי שלך</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">משימות שהגיע מועדן או שסומנו כדחופות, לו״ז ומיילים חשובים פוטנציאליים. הדוח מתרחב לעמודים נוספים לפי הצורך.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || !user} onClick={() => void preview("morning")} className="gap-2"><Printer className="h-4 w-4" />סיכום בוקר · הדפסה / PDF</Button>
        <Button variant="outline" disabled={busy || !user} onClick={() => void preview("urgent")}>דחופים להמשך היום · הדפסה / PDF</Button>
        <Button variant="outline" disabled={coaching || !user} onClick={() => void requestCoach()}>{coaching ? "מכין ייעוץ…" : "ייעוץ AI לתכנון וללמידה"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">הסיכומים האוטומטיים אינם מפעילים AI בתשלום. הייעוץ הנוסף מופעל רק בלחיצה ולאחר אישור שיתוף הנתונים; הוא טיוטה לבדיקה ולא משנה את הלוחות.</p>
      {coach && <section aria-label="ייעוץ AI לבדיקה" className="space-y-2 rounded-xl border p-3">
        <h3 className="font-medium">הצעות AI לבדיקה ולאישור שלך</h3>
        <p className="whitespace-pre-wrap text-sm leading-7">{coach}</p>
        <Button size="sm" variant="outline" onClick={() => printDocument("Tabro · ייעוץ לתכנון וללמידה", ["טיוטת ייעוץ AI"], [[coach]], "הצעות בלבד. בדוק עובדות ואנשי קשר לפני פעולה.", { lang: "he" })}>הדפסה / שמירה כ־PDF</Button>
      </section>}

      {user && settings && <div className="space-y-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="briefing-email-enabled" className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4" />לשלוח לי את התדריך במייל</Label>
          <Switch id="briefing-email-enabled" checked={settings.enabled} disabled={saving} onCheckedChange={enabled => void save({ ...settings, enabled })} />
        </div>
        <p className="text-xs text-muted-foreground">כבוי עד שתפעיל. נשלח לכתובת המאומתת של החשבון שלך בלבד, לפי שעון ישראל, ומכבד שעות שקטות, מגבלה יומית והסרה מרשימת התפוצה.</p>
        {settings.enabled && <div className="space-y-2">
          {OPTIONS.map(option => <div key={option.key} className="flex items-center justify-between gap-3">
            <Label htmlFor={`briefing-${option.key}`} className="text-sm font-normal">{option.label}</Label>
            <Switch id={`briefing-${option.key}`} checked={settings[option.key]} disabled={saving} onCheckedChange={value => void save({ ...settings, [option.key]: value })} />
          </div>)}
        </div>}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={testing} onClick={() => void sendTest("morning")} className="gap-2"><Send className="h-4 w-4" />שלח לי בדיקה של סיכום הבוקר</Button>
          <Button variant="secondary" size="sm" disabled={testing} onClick={() => void sendTest("afternoon")}>בדיקה של סיכום 16:00</Button>
        </div>
        <p className="text-xs text-muted-foreground">עד 3 בדיקות ב־24 שעות. ״נמסר לשירות המייל״ אינו מבטיח שההודעה הגיעה לתיבה הראשית; כדאי לבדוק גם בספאם.</p>
        {deliveries.length > 0 && <ul className="space-y-1 text-xs">
          {deliveries.map(item => <li key={item.id} className={item.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
            {item.local_date} · {item.slot === "morning" ? "08:00" : "16:00"}{item.kind === "test" ? " · בדיקה" : ""} · {STATUS_LABEL[item.status] || item.status}
            {item.status === "skipped" && item.last_error ? ` (${SKIP_LABEL[item.last_error] || item.last_error})` : ""}
            {item.status === "failed" ? (item.retryable && item.kind !== "test" ? " · ננסה שוב אוטומטית בתוך שעת השליחה" : " · לא יישלח שוב אוטומטית") : ""}
            {item.pdf_pages ? ` · PDF ${item.pdf_pages} עמ׳` : ""}
          </li>)}
        </ul>}
      </div>}
    </CardContent>
  </Card>;
}
