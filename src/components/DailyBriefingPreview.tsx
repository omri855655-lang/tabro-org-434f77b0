import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { makeDailyBriefing, type BriefingMode } from "@/lib/dailyBriefing";
import { printDocument } from "@/lib/printDocument";
import { toast } from "sonner";
import { Printer } from "lucide-react";

export default function DailyBriefingPreview() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const preview = async (mode: BriefingMode) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const [tasks, events, mail, prefs] = await Promise.all([
        supabase.from("tasks").select("id,description,status,planned_end,urgent,overdue,archived,responsible,task_type,progress").eq("user_id", user.id).eq("archived", false).order("planned_end", { ascending: true }).limit(2000),
        supabase.from("calendar_events").select("id,title,start_time,end_time,location,all_day,description").eq("user_id", user.id).gte("end_time", new Date(Date.now() - 86400000).toISOString()).lte("start_time", new Date(Date.now() + 86400000).toISOString()).order("start_time").limit(500),
        supabase.from("email_analyses").select("email_subject,email_from,email_date,category").eq("user_id", user.id).gte("email_date", new Date(Date.now() - 7 * 86400000).toISOString()).order("email_date", { ascending: false }).limit(1000),
        supabase.from("user_preferences").select("notification_settings").eq("user_id", user.id).maybeSingle(),
      ]);
      for (const result of [tasks, events, mail, prefs]) if (result.error) throw result.error;
      const settings = prefs.data?.notification_settings as Record<string, unknown> | null;
      const report = makeDailyBriefing(tasks.data || [], events.data || [], mail.data || [], mode, new Date(), settings?.emailTriage as Parameters<typeof makeDailyBriefing>[5]);
      printDocument(report.title, ["סוג", "מה לעשות", "מועד", "אחראי / שולח / מיקום", "פרטים / הצעה לצעד הבא"], report.rows,
        `${report.date} · שעון ישראל\n${report.summary}\n${report.recommendation}\nמיילים מסווגים לפי מטא־נתונים, לא לפי אימות תוכנם. הדוח מציג עד 2,000 משימות ו־500 אירועים.`, { lang: "he", dir: "rtl", emptyMessage: "אין משימות מתאימות או אירועים בטווח. אפשר לבדוק את כלל המשימות בלוח." });
    } catch {
      toast.error("לא הצלחנו לטעון את כל חלקי הסיכום. לא הופק דוח חלקי מטעה; נסה שוב.");
    } finally { setBusy(false); }
  };
  return <Card className="card-surface">
    <CardHeader><CardTitle className="text-base">הסיכום היומי שלך</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">משימות שהגיע מועדן או שסומנו כדחופות, לו״ז ומיילים חשובים פוטנציאליים. הדוח מתרחב לעמודים נוספים לפי הצורך.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || !user} onClick={() => void preview("morning")} className="gap-2"><Printer className="h-4 w-4" />סיכום בוקר · הדפסה / PDF</Button>
        <Button variant="outline" disabled={busy || !user} onClick={() => void preview("urgent")}>דחופים להמשך היום · הדפסה / PDF</Button>
      </div>
      <p className="text-xs text-muted-foreground">זו תצוגה מקדימה לפי הנתונים עכשיו. שליחה קבועה ב־08:00 וב־16:00 וצירוף PDF למייל דורשים הפעלה ואימות בשרת ואינם מופעלים באמצעות הכפתורים האלה.</p>
    </CardContent>
  </Card>;
}
