import { useEffect, useState } from "react";
import { MailWarning } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Alerts = { enabled: boolean; push: boolean; email: boolean; since: string | null };
type Delivery = { created_at: string; channel: string; status: string; last_error: string | null; provider_accepted: number | null };

const STATUS: Record<string, string> = { accepted: "התקבל אצל ספק השליחה", skipped: "דולג", failed: "נכשל", sending: "בשליחה" };
const REASON: Record<string, string> = { no_subscription: "אין מכשיר רשום", vapid_missing: "מפתחות שרת חסרים", no_verified_email: "אין כתובת מאומתת", suppressed: "הכתובת הוסרה מדיוור" };

const normalize = (raw: any): Alerts => ({
  enabled: raw?.enabled === true && typeof raw?.since === "string",
  push: raw?.push !== false,
  email: raw?.email === true,
  since: typeof raw?.since === "string" ? raw.since : null,
});

/** Opt-in for server-side alerts about important NEW Gmail messages (works while the site is closed). */
export default function ImportantMailAlertSettings() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [recent, setRecent] = useState<Delivery[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("user_preferences").select("notification_settings").eq("user_id", user.id).maybeSingle();
      setAlerts(normalize((data?.notification_settings as any)?.importantMailAlerts));
      const { data: rows } = await supabase.from("notification_deliveries")
        .select("created_at, channel, status, last_error, provider_accepted")
        .eq("user_id", user.id).eq("kind", "important_mail").order("created_at", { ascending: false }).limit(5);
      setRecent((rows as Delivery[]) || []);
    })();
  }, [user]);

  const save = async (patch: Partial<Alerts>) => {
    if (!user || !alerts) return;
    const next = { ...alerts, ...patch };
    // Turning alerts on starts from now, so older mail never triggers a backfill burst.
    if (patch.enabled === true && !alerts.enabled) next.since = new Date().toISOString();
    setSaving(true);
    try {
      const { data, error: readError } = await supabase.from("user_preferences").select("notification_settings").eq("user_id", user.id).maybeSingle();
      if (readError) throw readError;
      const existing = (data?.notification_settings as Record<string, unknown> | null) || {};
      const { error } = await supabase.from("user_preferences")
        .upsert({ user_id: user.id, notification_settings: { ...existing, importantMailAlerts: next } as any }, { onConflict: "user_id" });
      if (error) throw error;
      setAlerts(next);
    } catch {
      toast.error("שמירת התראות המייל נכשלה");
    } finally {
      setSaving(false);
    }
  };

  if (!user || !alerts) return null;
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2"><MailWarning className="h-4 w-4 text-primary" />התראה על מייל חשוב חדש</div>
          <Switch checked={alerts.enabled} disabled={saving} onCheckedChange={(checked) => void save({ enabled: checked })} />
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          השרת בודק את Gmail המחובר (קריאה בלבד) כל 10 דקות, גם כשהאתר סגור, ומתריע רק על מיילים חדשים שסומנו כחשובים לפי כללי המיון שלך (VIP, מילות מפתח, מיון שולחים). קודי אימות ופרסומות אינם מתריעים. ההתראה במסך הנעילה כוללת רק כמות — לא את תוכן המייל.
        </p>
      </CardHeader>
      {alerts.enabled && (
        <CardContent className="space-y-3 pt-0 text-xs">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">Push למכשירים הרשומים</Label>
            <Switch checked={alerts.push} disabled={saving} onCheckedChange={(checked) => void save({ push: checked })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">מייל (שולח ונושא בלבד)</Label>
            <Switch checked={alerts.email} disabled={saving} onCheckedChange={(checked) => void save({ email: checked })} />
          </div>
          <p className="text-muted-foreground">שעות שקט, מגבלה יומית וכיבוי ערוצים בהגדרות למעלה חלים גם כאן. הסימון אינו מאמת את זהות השולח.</p>
          {recent.length > 0 && (
            <div className="space-y-1 text-muted-foreground">
              {recent.map((r, i) => (
                <p key={i}>{new Date(r.created_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })} · {r.channel === "push" ? "Push" : "מייל"} · {STATUS[r.status] || r.status}{r.last_error ? ` (${REASON[r.last_error] || r.last_error})` : ""}</p>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
