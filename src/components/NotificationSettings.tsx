import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Clock, Moon, Mail, Smartphone, MessageCircle, Volume2, VolumeX, Plus, X, CalendarClock, Bot, Newspaper, Inbox } from "lucide-react";
import { toast } from "sonner";

interface ChannelSettings {
  enabled: boolean;
  sendTime: string;
  sendTimes: string[];
  content: string[];
}

interface PlannerSettings {
  enabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  completionEnabled: boolean;
  reminderMinutes: number[];
  invitationsEnabled: boolean;
}

interface AiSettings {
  enabled: boolean;
  dailyBriefingEnabled: boolean;
  emailDigestEnabled: boolean;
  newsBriefingEnabled: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  newsTopics: string;
}

interface NotifPrefs {
  email: ChannelSettings;
  push: ChannelSettings;
  telegram: ChannelSettings;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursEnabled: boolean;
  dailyLimit: number;
  planner: PlannerSettings;
  ai: AiSettings;
}

type ChannelKey = "email" | "push" | "telegram";

const DEFAULT_PREFS: NotifPrefs = {
  email: { enabled: true, sendTime: "08:00", sendTimes: ["08:00"], content: ["tasks", "budget", "weekly", "projects"] },
  push: { enabled: true, sendTime: "08:00", sendTimes: ["08:00"], content: ["tasks", "budget", "projects"] },
  telegram: { enabled: false, sendTime: "09:00", sendTimes: ["09:00"], content: ["weekly"] },
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  quietHoursEnabled: false,
  dailyLimit: 0,
  planner: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
    completionEnabled: true,
    reminderMinutes: [1, 10, 60],
    invitationsEnabled: true,
  },
  ai: {
    enabled: true,
    dailyBriefingEnabled: true,
    emailDigestEnabled: true,
    newsBriefingEnabled: false,
    reminderEnabled: false,
    reminderTime: "08:00",
    newsTopics: "",
  },
};

const CONTENT_OPTIONS = [
  { key: "tasks", label: "תזכורות משימות", desc: "משימות קרובות לדד-ליין" },
  { key: "budget", label: "התראות תקציב", desc: "חריגה מ-80% מהתקציב" },
  { key: "weekly", label: "סיכום שבועי", desc: "דוח ביצועים שבועי" },
  { key: "projects", label: "עדכוני פרויקטים", desc: "שינויים בפרויקטים משותפים" },
  { key: "shopping", label: "עדכוני קניות", desc: "שינויים ברשימות קניות משותפות" },
  { key: "calendar", label: "תזכורות אירועים", desc: "אירועים מהלוז" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return { value: `${h}:00`, label: `${h}:00` };
});

const LIMIT_OPTIONS = [
  { value: "0", label: "ללא הגבלה" },
  { value: "3", label: "3 ביום" },
  { value: "5", label: "5 ביום" },
  { value: "10", label: "10 ביום" },
  { value: "15", label: "15 ביום" },
];

const CHANNEL_META = [
  { key: "email" as const, label: "מייל", icon: Mail, desc: "התראות לכתובת המייל שלך" },
  { key: "push" as const, label: "Push (אפליקציה)", icon: Smartphone, desc: "התראות בדפדפן ובמכשיר" },
  { key: "telegram" as const, label: "טלגרם", icon: MessageCircle, desc: "הודעות בטלגרם" },
];

const REMINDER_OPTIONS = [1, 5, 10, 15, 30, 60];

const uniqueTimes = (times: string[]) => [...new Set(times.filter(Boolean))].sort();

const normalizeChannel = (channel: Partial<ChannelSettings> | undefined, defaults: ChannelSettings): ChannelSettings => {
  const sendTimes = uniqueTimes(
    Array.isArray(channel?.sendTimes) && channel.sendTimes.length
      ? channel.sendTimes
      : channel?.sendTime
        ? [channel.sendTime]
        : defaults.sendTimes,
  );

  return {
    enabled: channel?.enabled ?? defaults.enabled,
    sendTime: sendTimes[0] || defaults.sendTime,
    sendTimes,
    content: Array.isArray(channel?.content) && channel.content.length ? channel.content : defaults.content,
  };
};

const normalizePrefs = (raw?: Partial<NotifPrefs> | null): NotifPrefs => ({
  email: normalizeChannel(raw?.email, DEFAULT_PREFS.email),
  push: normalizeChannel(raw?.push, DEFAULT_PREFS.push),
  telegram: normalizeChannel(raw?.telegram, DEFAULT_PREFS.telegram),
  quietHoursStart: raw?.quietHoursStart || DEFAULT_PREFS.quietHoursStart,
  quietHoursEnd: raw?.quietHoursEnd || DEFAULT_PREFS.quietHoursEnd,
  quietHoursEnabled: raw?.quietHoursEnabled ?? DEFAULT_PREFS.quietHoursEnabled,
  dailyLimit: typeof raw?.dailyLimit === "number" ? raw.dailyLimit : DEFAULT_PREFS.dailyLimit,
  planner: {
    enabled: raw?.planner?.enabled ?? DEFAULT_PREFS.planner.enabled,
    emailEnabled: raw?.planner?.emailEnabled ?? DEFAULT_PREFS.planner.emailEnabled,
    pushEnabled: raw?.planner?.pushEnabled ?? DEFAULT_PREFS.planner.pushEnabled,
    completionEnabled: raw?.planner?.completionEnabled ?? DEFAULT_PREFS.planner.completionEnabled,
    reminderMinutes: Array.isArray(raw?.planner?.reminderMinutes) && raw.planner.reminderMinutes.length
      ? [...new Set(raw.planner.reminderMinutes.filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b)
      : DEFAULT_PREFS.planner.reminderMinutes,
    invitationsEnabled: raw?.planner?.invitationsEnabled ?? DEFAULT_PREFS.planner.invitationsEnabled,
  },
  ai: {
    enabled: raw?.ai?.enabled ?? DEFAULT_PREFS.ai.enabled,
    dailyBriefingEnabled: raw?.ai?.dailyBriefingEnabled ?? DEFAULT_PREFS.ai.dailyBriefingEnabled,
    emailDigestEnabled: raw?.ai?.emailDigestEnabled ?? DEFAULT_PREFS.ai.emailDigestEnabled,
    newsBriefingEnabled: raw?.ai?.newsBriefingEnabled ?? DEFAULT_PREFS.ai.newsBriefingEnabled,
    reminderEnabled: raw?.ai?.reminderEnabled ?? DEFAULT_PREFS.ai.reminderEnabled,
    reminderTime: raw?.ai?.reminderTime || DEFAULT_PREFS.ai.reminderTime,
    newsTopics: raw?.ai?.newsTopics || DEFAULT_PREFS.ai.newsTopics,
  },
});

const NotificationSettings = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingTimes, setPendingTimes] = useState<Record<ChannelKey, string>>({
    email: "08:00",
    push: "08:00",
    telegram: "09:00",
  });

  useEffect(() => {
    if (!user) {
      const local = localStorage.getItem("notification-prefs");
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setPrefs(normalizePrefs(parsed));
        } catch {
          setPrefs(DEFAULT_PREFS);
        }
      }
      setLoaded(true);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("notification_settings")
        .eq("user_id", user.id)
        .maybeSingle();

      const nextPrefs = normalizePrefs((data?.notification_settings as Partial<NotifPrefs> | null) || null);
      setPrefs(nextPrefs);
      setPendingTimes({
        email: nextPrefs.email.sendTimes[0] || "08:00",
        push: nextPrefs.push.sendTimes[0] || "08:00",
        telegram: nextPrefs.telegram.sendTimes[0] || "09:00",
      });
      setLoaded(true);
    };

    load();
  }, [user]);

  const save = useCallback(async (newPrefs: NotifPrefs) => {
    const normalized = normalizePrefs(newPrefs);
    setPrefs(normalized);

    if (!user) {
      localStorage.setItem("notification-prefs", JSON.stringify(normalized));
      return;
    }

    setSaving(true);
    await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id, notification_settings: normalized as any }, { onConflict: "user_id" });
    setSaving(false);

    localStorage.setItem("notification-email-enabled", String(normalized.email.enabled));
    localStorage.setItem("notification-push-enabled", String(normalized.push.enabled));
    localStorage.setItem("notification-telegram-enabled", String(normalized.telegram.enabled));
  }, [user]);

  const updateChannel = (channel: ChannelKey, patch: Partial<ChannelSettings>) => {
    save({
      ...prefs,
      [channel]: normalizeChannel({ ...prefs[channel], ...patch }, DEFAULT_PREFS[channel]),
    });
  };

  const toggleContent = (channel: ChannelKey, contentKey: string) => {
    const current = prefs[channel].content;
    const newContent = current.includes(contentKey)
      ? current.filter((c) => c !== contentKey)
      : [...current, contentKey];
    updateChannel(channel, { content: newContent });
  };

  const addSendTime = (channel: ChannelKey) => {
    const nextTime = pendingTimes[channel];
    if (prefs[channel].sendTimes.includes(nextTime)) {
      toast.error("השעה כבר נוספה");
      return;
    }
    updateChannel(channel, { sendTimes: [...prefs[channel].sendTimes, nextTime] });
  };

  const removeSendTime = (channel: ChannelKey, time: string) => {
    const next = prefs[channel].sendTimes.filter((entry) => entry !== time);
    if (next.length === 0) {
      toast.error("חייבת להישאר לפחות שעה אחת");
      return;
    }
    updateChannel(channel, { sendTimes: next, sendTime: next[0] });
  };

  const togglePlannerMinute = (minutes: number) => {
    const exists = prefs.planner.reminderMinutes.includes(minutes);
    const nextMinutes = exists
      ? prefs.planner.reminderMinutes.filter((m) => m !== minutes)
      : [...prefs.planner.reminderMinutes, minutes].sort((a, b) => a - b);

    save({
      ...prefs,
      planner: {
        ...prefs.planner,
        reminderMinutes: nextMinutes.length ? nextMinutes : [minutes],
      },
    });
  };

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      {CHANNEL_META.map(({ key, label, icon: Icon, desc }) => (
        <Card key={key}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </div>
              <Switch
                checked={prefs[key].enabled}
                onCheckedChange={(checked) => {
                  updateChannel(key, { enabled: checked });
                  toast.success(checked ? `${label} הופעלו` : `${label} בוטלו`);
                }}
              />
            </CardTitle>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </CardHeader>

          {prefs[key].enabled && (
            <CardContent className="space-y-3 pt-0">
              {key === "push" && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
                  באייפון כדאי לאשר התראות בדפדפן ולהוסיף את Tabro למסך הבית כדי שהתראות Push יעבדו בצורה הטובה ביותר.
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs">שעות שליחה</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={pendingTimes[key]} onValueChange={(v) => setPendingTimes((prev) => ({ ...prev, [key]: v }))}>
                      <SelectTrigger className="w-24 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((h) => (
                          <SelectItem key={h.value} value={h.value} className="text-xs">{h.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => addSendTime(key)}>
                      <Plus className="h-3 w-3" />הוסף שעה
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {prefs[key].sendTimes.map((time) => (
                    <Badge key={time} variant="secondary" className="gap-1 pr-2">
                      {time}
                      <button onClick={() => removeSendTime(key, time)} className="rounded-full hover:bg-background/70 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />
              <p className="text-xs font-medium text-muted-foreground">תוכן ההתראות:</p>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => toggleContent(key, opt.key)}
                    className={`text-right rounded-md border p-2 text-xs transition-colors ${
                      prefs[key].content.includes(opt.key)
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="block font-medium">{opt.label}</span>
                    <span className="block text-[10px] opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              תזכורות מתכנן לו״ז
            </div>
            <Switch
              checked={prefs.planner.enabled}
              onCheckedChange={(checked) => {
                save({ ...prefs, planner: { ...prefs.planner, enabled: checked } });
                toast.success(checked ? "תזכורות הלוז הופעלו" : "תזכורות הלוז בוטלו");
              }}
            />
          </CardTitle>
          <p className="text-xs text-muted-foreground">ברירת המחדל נשארת כמו עכשיו: הלוז ממשיך לשלוח תזכורות גם אם שאר ההתראות כבויות, אבל עכשיו אפשר לכוון את זה כאן.</p>
        </CardHeader>

        {prefs.planner.enabled && (
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => save({ ...prefs, planner: { ...prefs.planner, pushEnabled: !prefs.planner.pushEnabled } })}
                className={`rounded-lg border p-3 text-right text-xs ${prefs.planner.pushEnabled ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
              >Push לפני אירוע</button>
              <button
                onClick={() => save({ ...prefs, planner: { ...prefs.planner, emailEnabled: !prefs.planner.emailEnabled } })}
                className={`rounded-lg border p-3 text-right text-xs ${prefs.planner.emailEnabled ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
              >מייל לפני אירוע</button>
              <button
                onClick={() => save({ ...prefs, planner: { ...prefs.planner, completionEnabled: !prefs.planner.completionEnabled } })}
                className={`rounded-lg border p-3 text-right text-xs ${prefs.planner.completionEnabled ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
              >התראת סיום אירוע</button>
              <button
                onClick={() => save({ ...prefs, planner: { ...prefs.planner, invitationsEnabled: !prefs.planner.invitationsEnabled } })}
                className={`rounded-lg border p-3 text-right text-xs ${prefs.planner.invitationsEnabled ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
              >התראות זימונים</button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">כמה זמן לפני האירוע תרצה תזכורת?</Label>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map((minutes) => (
                  <Badge
                    key={minutes}
                    variant={prefs.planner.reminderMinutes.includes(minutes) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => togglePlannerMinute(minutes)}
                  >
                    {minutes === 60 ? "שעה" : `${minutes} דק׳`}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              תדריכי AI ותזכורות
            </div>
            <Switch
              checked={prefs.ai.enabled}
              onCheckedChange={(checked) => {
                save({ ...prefs, ai: { ...prefs.ai, enabled: checked } });
                toast.success(checked ? "פיצ'רי ה-AI הופעלו" : "פיצ'רי ה-AI בוטלו");
              }}
            />
          </CardTitle>
          <p className="text-xs text-muted-foreground">כאן מגדירים מה תרצה שסוכן ה-AI יכין עבורך: תדריך יומי, סיכום מיילים ותדריך חדשות לפי תחומי עניין.</p>
        </CardHeader>

        {prefs.ai.enabled && (
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => save({ ...prefs, ai: { ...prefs.ai, dailyBriefingEnabled: !prefs.ai.dailyBriefingEnabled } })}
                className={`rounded-lg border p-3 text-right text-xs ${prefs.ai.dailyBriefingEnabled ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
              >
                <div className="flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5" />
                  תדריך מלא על היום
                </div>
              </button>
              <button
                onClick={() => save({ ...prefs, ai: { ...prefs.ai, emailDigestEnabled: !prefs.ai.emailDigestEnabled } })}
                className={`rounded-lg border p-3 text-right text-xs ${prefs.ai.emailDigestEnabled ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
              >
                <div className="flex items-center gap-2">
                  <Inbox className="h-3.5 w-3.5" />
                  סיכום מיילים מסונכרנים
                </div>
              </button>
              <button
                onClick={() => save({ ...prefs, ai: { ...prefs.ai, newsBriefingEnabled: !prefs.ai.newsBriefingEnabled } })}
                className={`rounded-lg border p-3 text-right text-xs ${prefs.ai.newsBriefingEnabled ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
              >
                <div className="flex items-center gap-2">
                  <Newspaper className="h-3.5 w-3.5" />
                  תדריך חדשות בוקר
                </div>
              </button>
              <button
                onClick={() => save({ ...prefs, ai: { ...prefs.ai, reminderEnabled: !prefs.ai.reminderEnabled } })}
                className={`rounded-lg border p-3 text-right text-xs ${prefs.ai.reminderEnabled ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  תזכורת קבועה ל-AI
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">שעת תזכורת/תדריך</Label>
                <Select
                  value={prefs.ai.reminderTime}
                  onValueChange={(v) => save({ ...prefs, ai: { ...prefs.ai, reminderTime: v } })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h.value} value={h.value} className="text-xs">{h.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">תחומי עניין לחדשות</Label>
                <Input
                  value={prefs.ai.newsTopics}
                  onChange={(e) => save({ ...prefs, ai: { ...prefs.ai, newsTopics: e.target.value } })}
                  placeholder="למשל: טכנולוגיה, כלכלה, בריאות, ספורט"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <p>התדריכים נשמרים עכשיו כהעדפה למשתמש, והסוכן יכול להשתמש בהם בתוך הממשק כבר עכשיו.</p>
              <p>חדשות בזמן אמת יופעלו בצורה מלאה ברגע שנחבר מקור חדשות חיצוני, אבל כבר עכשיו אפשר לשמור תחומי עניין ופורמט.</p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-primary" />
              שעות שקט
            </div>
            <Switch
              checked={prefs.quietHoursEnabled}
              onCheckedChange={(checked) => {
                save({ ...prefs, quietHoursEnabled: checked });
                toast.success(checked ? "שעות שקט הופעלו" : "שעות שקט בוטלו");
              }}
            />
          </CardTitle>
          <p className="text-xs text-muted-foreground">לא יישלחו התראות בשעות אלו</p>
        </CardHeader>
        {prefs.quietHoursEnabled && (
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs">מ-</Label>
                <Select value={prefs.quietHoursStart} onValueChange={(v) => save({ ...prefs, quietHoursStart: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => <SelectItem key={h.value} value={h.value} className="text-xs">{h.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">עד-</Label>
                <Select value={prefs.quietHoursEnd} onValueChange={(v) => save({ ...prefs, quietHoursEnd: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => <SelectItem key={h.value} value={h.value} className="text-xs">{h.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <VolumeX className="h-3.5 w-3.5" />
              <span>התראות שיגיעו בשעות שקט יישמרו ויישלחו בבוקר</span>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />
            כמות התראות ביום
          </CardTitle>
          <p className="text-xs text-muted-foreground">הגבל את מספר ההתראות שתקבל ביום</p>
        </CardHeader>
        <CardContent className="pt-0">
          <Select
            value={String(prefs.dailyLimit)}
            onValueChange={(v) => {
              save({ ...prefs, dailyLimit: Number(v) });
              toast.success(v === "0" ? "ללא הגבלה" : `מוגבל ל-${v} התראות ביום`);
            }}
          >
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {saving && <p className="text-xs text-muted-foreground text-center animate-pulse">שומר...</p>}
    </div>
  );
};

export default NotificationSettings;
