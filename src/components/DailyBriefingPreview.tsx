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
import { useLanguage } from "@/hooks/useLanguage";
import { buildNewspaper, normalizeEdition, selectEditionArticles } from "../../supabase/functions/_shared/newspaper.ts";

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

export default function DailyBriefingPreview({ initialDate }: { initialDate?: string } = {}) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [edition, setEdition] = useState(() => normalizeEdition(null, lang));
  const [editionDate, setEditionDate] = useState(initialDate || israelDate(new Date()));
  const [editionMode, setEditionMode] = useState<BriefingMode>("morning");
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
    if (!prefs.error) setEdition(normalizeEdition(raw?.newspaperEdition, lang));
    setSettings(normalizeBriefingSettings(raw?.dailyBriefingEmail));
    setDeliveries((history.data || []) as Delivery[]);
  }, [user, lang]);

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

  const saveEdition = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("user_preferences").select("notification_settings").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      const existing = (data?.notification_settings as Record<string, unknown> | null) || {};
      const { error: writeError } = await supabase.from("user_preferences").upsert({
        user_id: user.id, notification_settings: { ...existing, newspaperEdition: normalizeEdition(edition, lang) } as never,
      }, { onConflict: "user_id" });
      if (writeError) throw writeError;
      toast.success("העדפות המהדורה נשמרו");
    } catch { toast.error("לא הצלחנו לשמור את העדפות המהדורה"); }
    finally { setSaving(false); }
  };

   const currentReport = async (mode: BriefingMode, date?: string) => {
    if (!user) throw new Error("Login required");
  const now = date && date !== israelDate(new Date()) ? new Date(`${date}T12:00:00Z`) : new Date();
  const [tasks, events, mail, prefs, recurring, completions, projects] = await Promise.all([
    supabase.from("tasks").select("id,description,status,status_notes,planned_end,urgent,overdue,archived,responsible,task_type,progress").eq("user_id", user.id).eq("archived", false).order("planned_end", { ascending: true }).limit(2000),
    supabase.from("calendar_events").select("id,title,start_time,end_time,location,all_day,description").eq("user_id", user.id).gte("end_time", new Date(now.getTime() - 86400000).toISOString()).lte("start_time", new Date(now.getTime() + 86400000).toISOString()).order("start_time").limit(500),
    (!date || settings?.includeMail !== false) ? supabase.from("email_analyses").select("email_subject,email_from,email_date,category").eq("user_id", user.id).gte("email_date", new Date(now.getTime() - 7 * 86400000).toISOString()).lte("email_date", now.toISOString()).order("email_date", { ascending: false }).limit(1000) : { data: [], error: null },
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
  const options = normalizeBriefingSettings(stored?.dailyBriefingEmail);
  const report = makeDailyBriefing(combinedTasks, events.data || [], mail.data || [], mode, now, stored?.emailTriage as Parameters<typeof makeDailyBriefing>[5], date ? {
    includeTasks: options.includeTasks, includeEvents: options.includePlanner, includeMail: options.includeMail && mode === "morning", includeDeliveries: true,
    includeSuggestions: options.includeSuggestions, language: normalizeEdition(null, lang).language,
  } : {});
    return report;
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

  const openNewspaper = async () => {
    if (!user || busy || !editionDate) return;
    setBusy(true);
    try {
      const includeNews = editionMode === "morning" && edition.news && editionDate === israelDate(new Date());
      const [report, news] = await Promise.all([
        currentReport(editionMode, editionDate),
        includeNews
          ? supabase.functions.invoke("good-news").catch(() => null) : null,
      ]);
      if (includeNews && (!news || news.error)) toast.info("מקורות החדשות אינם זמינים כרגע");
      const options = editionMode === "morning" ? edition : { ...edition, practice: false, habits: "" };
      const paper = buildNewspaper(report, options, selectEditionArticles(news?.data?.items, edition.topics));
      printDocument(paper.title, [], [], `${paper.dateLabel} · ${paper.edition}`, {
        lang: paper.language, dir: paper.dir, newspaper: paper.sections, emptyMessage: paper.empty,
      });
    } catch { toast.error("המהדורה לא נטענה. אפשר לנסות שוב."); }
    finally { setBusy(false); }
  };

  return <Card className="card-surface">
    <CardHeader><CardTitle className="text-base">תדריך יומי · מהדורת העיתון</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <section className="space-y-3 rounded-xl border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">סוג התדריך<select className="rounded-md border bg-background p-2" value={editionMode} onChange={event => setEditionMode(event.target.value as BriefingMode)}>
            <option value="morning">מהדורת בוקר מלאה</option>
            <option value="urgent">דחופים להמשך היום</option>
          </select></label>
          <label className="grid gap-1 text-sm">תאריך המהדורה<input className="rounded-md border bg-background p-2" type="date" value={editionDate} onChange={event => setEditionDate(event.target.value)} /></label>
          <label className="grid gap-1 text-sm">שם העיתון<input className="rounded-md border bg-background p-2" maxLength={100} value={edition.title} onChange={event => setEdition({ ...edition, title: event.target.value })} /></label>
          <label className="grid gap-1 text-sm">מה לומדים?<input className="rounded-md border bg-background p-2" maxLength={300} value={edition.study} onChange={event => setEdition({ ...edition, study: event.target.value })} /></label>
          <label className="grid gap-1 text-sm">הרגלים לסימון (מופרדים בפסיקים)<input className="rounded-md border bg-background p-2" maxLength={300} value={edition.habits} onChange={event => setEdition({ ...edition, habits: event.target.value })} /></label>
          <label className="grid gap-1 text-sm">נושאי חדשות מועדפים (מופרדים בפסיקים)<input className="rounded-md border bg-background p-2" maxLength={180} value={edition.topics} onChange={event => setEdition({ ...edition, topics: event.target.value })} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edition.practice} onChange={event => setEdition({ ...edition, practice: event.target.checked })} />מילה באנגלית ותרגול זיכרון</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edition.news} onChange={event => setEdition({ ...edition, news: event.target.checked })} />חדשות טובות במהדורה של היום</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edition.enabled} onChange={event => setEdition({ ...edition, enabled: event.target.checked })} />השתמש בעיצוב העיתון במיילי התדריך</label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!user || busy || !editionDate} onClick={() => void openNewspaper()}><Printer className="me-2 h-4 w-4" />פתח מהדורה להדפסה / PDF</Button>
          <Button variant="outline" disabled={!user || saving || !settings} onClick={() => void saveEdition()}>שמור העדפות מהדורה</Button>
        </div>
      </section>
      <p className="text-sm text-muted-foreground">משימות שהגיע מועדן או שסומנו כדחופות, לו״ז ומיילים חשובים פוטנציאליים. הדוח מתרחב לעמודים נוספים לפי הצורך.</p>
      <div className="flex flex-wrap gap-2">
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
