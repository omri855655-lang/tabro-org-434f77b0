import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Bot, CalendarClock, Clock, Inbox, Mail, MessageCircle, Moon, Newspaper, Smartphone, VolumeX } from "lucide-react";
import { toast } from "sonner";

type ChannelKey = "email" | "push" | "telegram";

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
  sameDayChannel: "app" | "email" | "both" | "off";
  dayBeforeEnabled: boolean;
  dayBeforeChannel: "app" | "email" | "both" | "off";
  dayBeforeTime: string;
  completionChannel: "app" | "email" | "both" | "off";
  invitationsChannel: "app" | "email" | "both" | "off";
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

const DEFAULT_PREFS: NotifPrefs = {
  email: { enabled: true, sendTime: "08:00", sendTimes: ["08:00"], content: ["tasks", "budget", "weekly", "projects"] },
  push: { enabled: true, sendTime: "08:00", sendTimes: ["08:00"], content: ["tasks", "budget", "projects", "calendar"] },
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
    sameDayChannel: "both",
    dayBeforeEnabled: false,
    dayBeforeChannel: "both",
    dayBeforeTime: "18:00",
    completionChannel: "app",
    invitationsChannel: "both",
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

const CHANNEL_META = [
  { key: "email" as const, label: "מייל", icon: Mail, desc: "התראות לכתובת המייל שלך" },
  { key: "push" as const, label: "Push (אפליקציה)", icon: Smartphone, desc: "התראות בדפדפן ובמכשיר, כולל באייפון כשמאשרים הרשאות" },
  { key: "telegram" as const, label: "טלגרם", icon: MessageCircle, desc: "הודעות בטלגרם" },
];

const CONTENT_OPTIONS = [
  { key: "tasks", label: "תזכורות משימות", desc: "משימות קרובות לדד-ליין" },
  { key: "budget", label: "התראות תקציב", desc: "חריגה מ-80% מהתקציב" },
  { key: "weekly", label: "סיכום שבועי", desc: "דוח ביצועים שבועי" },
  { key: "projects", label: "עדכוני פרויקטים", desc: "שינויים בפרויקטים משותפים" },
  { key: "shopping", label: "עדכוני קניות", desc: "שינויים ברשימות קניות משותפות" },
  { key: "calendar", label: "תזכורות אירועים", desc: "אירועים ופגישות מהלוז" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return { value: `${h}:00`, label: `${h}:00` };
});

const REMINDER_OPTIONS = [1, 5, 10, 15, 30, 60];
const DELIVERY_OPTIONS = [
  { value: "off", label: "כבוי" },
  { value: "app", label: "רק באפליקציה" },
  { value: "email", label: "רק במייל" },
  { value: "both", label: "גם במייל וגם באפליקציה" },
] as const;
const LIMIT_OPTIONS = [
  { value: "0", label: "ללא הגבלה" },
  { value: "3", label: "3 ביום" },
  { value: "5", label: "5 ביום" },
  { value: "10", label: "10 ביום" },
  { value: "15", label: "15 ביום" },
];

const uniqueTimes = (times: string[]) => [...new Set(times.filter(Boolean))].sort();

const normalizeChannel = (channel: Partial<ChannelSettings> | undefined, defaults: ChannelSettings): ChannelSettings => {
  const nextTimes = uniqueTimes(
    Array.isArray(channel?.sendTimes) && channel.sendTimes.length
      ? channel.sendTimes
      : channel?.sendTime
        ? [channel.sendTime]
        : defaults.sendTimes,
  );

  return {
    enabled: channel?.enabled ?? defaults.enabled,
    sendTime: nextTimes[0] || defaults.sendTime,
    sendTimes: nextTimes,
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
      ? [...new Set(raw.planner.reminderMinutes.filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b)
      : DEFAULT_PREFS.planner.reminderMinutes,
    invitationsEnabled: raw?.planner?.invitationsEnabled ?? DEFAULT_PREFS.planner.invitationsEnabled,
    sameDayChannel:
      raw?.planner?.sameDayChannel ||
      ((raw?.planner?.pushEnabled ?? DEFAULT_PREFS.planner.pushEnabled) && (raw?.planner?.emailEnabled ?? DEFAULT_PREFS.planner.emailEnabled)
        ? "both"
        : raw?.planner?.pushEnabled ?? DEFAULT_PREFS.planner.pushEnabled
          ? "app"
          : raw?.planner?.emailEnabled ?? DEFAULT_PREFS.planner.emailEnabled
            ? "email"
            : "off"),
    dayBeforeEnabled: raw?.planner?.dayBeforeEnabled ?? DEFAULT_PREFS.planner.dayBeforeEnabled,
    dayBeforeChannel: raw?.planner?.dayBeforeChannel || DEFAULT_PREFS.planner.dayBeforeChannel,
    dayBeforeTime: raw?.planner?.dayBeforeTime || DEFAULT_PREFS.planner.dayBeforeTime,
    completionChannel: raw?.planner?.completionChannel || (raw?.planner?.completionEnabled ? "app" : DEFAULT_PREFS.planner.completionChannel),
    invitationsChannel: raw?.planner?.invitationsChannel || (raw?.planner?.invitationsEnabled ? "both" : DEFAULT_PREFS.planner.invitationsChannel),
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

const deliveryToLegacyFlags = (value: PlannerSettings["sameDayChannel"]) => ({
  emailEnabled: value === "email" || value === "both",
  pushEnabled: value === "app" || value === "both",
});

const withPlannerChannelSync = (planner: PlannerSettings): PlannerSettings => {
  const sameDayFlags = deliveryToLegacyFlags(planner.sameDayChannel);
  return {
    ...planner,
    emailEnabled: sameDayFlags.emailEnabled,
    pushEnabled: sameDayFlags.pushEnabled,
    completionEnabled: planner.completionChannel !== "off",
    invitationsEnabled: planner.invitationsChannel !== "off",
  };
};

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
    let mounted = true;

    const loadPrefs = async () => {
      try {
        if (!user) {
          const local = localStorage.getItem("notification-prefs");
          const parsed = local ? JSON.parse(local) : null;
          if (mounted) {
            const normalized = normalizePrefs(parsed);
            setPrefs(normalized);
            setPendingTimes({
              email: normalized.email.sendTimes[0] || "08:00",
              push: normalized.push.sendTimes[0] || "08:00",
              telegram: normalized.telegram.sendTimes[0] || "09:00",
            });
            setLoaded(true);
          }
          return;
        }

        const { data, error } = await supabase
          .from("user_preferences")
          .select("notification_settings")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (mounted) {
          const normalized = normalizePrefs((data?.notification_settings as Partial<NotifPrefs> | null) || null);
          setPrefs(normalized);
          setPendingTimes({
            email: normalized.email.sendTimes[0] || "08:00",
            push: normalized.push.sendTimes[0] || "08:00",
            telegram: normalized.telegram.sendTimes[0] || "09:00",
          });
          setLoaded(true);
        }
      } catch (error) {
        console.error("NotificationSettings load error", error);
        if (mounted) {
          setPrefs(DEFAULT_PREFS);
          setLoaded(true);
          toast.error("לא הצלחנו לטעון את ההתראות. נטענו הגדרות ברירת מחדל.");
        }
      }
    };

    void loadPrefs();

    return () => {
      mounted = false;
    };
  }, [user]);

  const savePrefs = useCallback(async (nextPrefs: NotifPrefs) => {
    const normalized = normalizePrefs(nextPrefs);
    setPrefs(normalized);
    localStorage.setItem("notification-prefs", JSON.stringify(normalized));
    localStorage.setItem("notification-email-enabled", String(normalized.email.enabled));
    localStorage.setItem("notification-push-enabled", String(normalized.push.enabled));
    localStorage.setItem("notification-telegram-enabled", String(normalized.telegram.enabled));

    if (!user) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, notification_settings: normalized as any }, { onConflict: "user_id" });
      if (error) throw error;
    } catch (error) {
      console.error("NotificationSettings save error", error);
      toast.error("שגיאה בשמירת ההתראות");
    } finally {
      setSaving(false);
    }
  }, [user]);

  const updateChannel = (channel: ChannelKey, patch: Partial<ChannelSettings>) => {
    void savePrefs({
      ...prefs,
      [channel]: normalizeChannel({ ...prefs[channel], ...patch }, DEFAULT_PREFS[channel]),
    });
  };

  const toggleContent = (channel: ChannelKey, contentKey: string) => {
    const current = prefs[channel].content;
    const content = current.includes(contentKey)
      ? current.filter((item) => item !== contentKey)
      : [...current, contentKey];
    updateChannel(channel, { content });
  };

  const addSendTime = (channel: ChannelKey) => {
    const pending = pendingTimes[channel];
    if (prefs[channel].sendTimes.includes(pending)) {
      toast.error("השעה כבר נוספה");
      return;
    }
    updateChannel(channel, { sendTimes: [...prefs[channel].sendTimes, pending] });
  };

  const removeSendTime = (channel: ChannelKey, time: string) => {
    const nextTimes = prefs[channel].sendTimes.filter((entry) => entry !== time);
    if (!nextTimes.length) {
      toast.error("חייבת להישאר לפחות שעה אחת");
      return;
    }
    updateChannel(channel, { sendTimes: nextTimes, sendTime: nextTimes[0] });
  };

  const togglePlannerReminder = (minutes: number) => {
    const exists = prefs.planner.reminderMinutes.includes(minutes);
    const reminderMinutes = exists
      ? prefs.planner.reminderMinutes.filter((value) => value !== minutes)
      : [...prefs.planner.reminderMinutes, minutes].sort((a, b) => a - b);

    void savePrefs({
      ...prefs,
      planner: withPlannerChannelSync({
        ...prefs.planner,
        reminderMinutes: reminderMinutes.length ? reminderMinutes : [minutes],
      }),
    });
  };

  const updatePlanner = (patch: Partial<PlannerSettings>) => {
    void savePrefs({
      ...prefs,
      planner: withPlannerChannelSync({
        ...prefs.planner,
        ...patch,
      }),
    });
  };

  const requestPushPermission = async () => {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) {
        toast.error("הדפדפן הזה לא תומך בהתראות Push");
        return;
      }
      const result = await Notification.requestPermission();
      if (result === "granted") {
        toast.success("התראות Push אושרו");
      } else if (result === "denied") {
        toast.error("ההתראות נחסמו. אפשר לשנות זאת מהגדרות הדפדפן.");
      } else {
        toast.info("הבקשה להתראות נסגרה בלי אישור");
      }
    } catch (error) {
      console.error(error);
      toast.error("לא הצלחנו לבקש הרשאת התראות");
    }
  };

  const pushStatus = useMemo(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  }, []);

  if (!loaded) {
    return <div className="py-4 text-sm text-muted-foreground">טוען התראות...</div>;
  }

  return (
    <div className="space-y-4">
      {CHANNEL_META.map(({ key, label, icon: Icon, desc }) => (
        <Card key={key}>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </div>
              <Switch checked={prefs[key].enabled} onCheckedChange={(checked) => updateChannel(key, { enabled: checked })} />
            </CardTitle>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </CardHeader>

          {prefs[key].enabled && (
            <CardContent className="space-y-3 pt-0">
              {key === "push" && (
                <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-[11px] text-muted-foreground">
                  <p>באייפון כדאי לאשר התראות בדפדפן ולהוסיף את Tabro למסך הבית כדי לקבל חוויה קרובה לאפליקציה.</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={pushStatus === "granted" ? "default" : "outline"}>
                      {pushStatus === "granted" ? "התראות מאושרות" : pushStatus === "denied" ? "התראות חסומות" : pushStatus === "unsupported" ? "לא נתמך" : "טרם אושר"}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => void requestPushPermission()}>
                      בקש הרשאת Push
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs">שעות שליחה</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={pendingTimes[key]} onValueChange={(value) => setPendingTimes((prev) => ({ ...prev, [key]: value }))}>
                      <SelectTrigger className="h-8 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((hour) => (
                          <SelectItem key={hour.value} value={hour.value} className="text-xs">
                            {hour.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => addSendTime(key)}>
                      הוסף שעה
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {prefs[key].sendTimes.map((time) => (
                    <Badge key={time} variant="secondary" className="gap-1 pr-2">
                      {time}
                      <button type="button" onClick={() => removeSendTime(key, time)} className="rounded-full p-0.5 hover:bg-background/70">
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">תוכן ההתראות</p>
                <div className="grid grid-cols-2 gap-2">
                  {CONTENT_OPTIONS.map((option) => {
                    const active = prefs[key].content.includes(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleContent(key, option.key)}
                        className={`rounded-md border p-2 text-right text-xs transition-colors ${
                          active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <span className="block font-medium">{option.label}</span>
                        <span className="block text-[10px] opacity-70">{option.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              תזכורות מתכנן לו״ז
            </div>
            <Switch checked={prefs.planner.enabled} onCheckedChange={(checked) => updatePlanner({ enabled: checked })} />
          </CardTitle>
          <p className="text-xs text-muted-foreground">עכשיו אפשר להחליט לכל סוג תזכורת אם היא תגיע רק באפליקציה, רק במייל, או בשניהם, כולל תזכורת יום לפני.</p>
        </CardHeader>
        {prefs.planner.enabled && (
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border p-3 bg-muted/10 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold">תזכורת רגילה לפני אירוע</p>
                    <p className="text-[11px] text-muted-foreground">זוהי התזכורת הראשית שמגיעה לפני האירוע לפי המרווח שתבחר.</p>
                  </div>
                  <Select value={prefs.planner.sameDayChannel} onValueChange={(value) => updatePlanner({ sameDayChannel: value as PlannerSettings["sameDayChannel"] })}>
                    <SelectTrigger className="w-full sm:w-56 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border p-3 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold">תזכורת יום לפני</p>
                    <p className="text-[11px] text-muted-foreground">מומלץ לפגישות חשובות, נסיעות או דברים שאסור לפספס.</p>
                  </div>
                  <Switch checked={prefs.planner.dayBeforeEnabled} onCheckedChange={(checked) => updatePlanner({ dayBeforeEnabled: checked })} />
                </div>

                {prefs.planner.dayBeforeEnabled && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">ערוץ שליחה</Label>
                      <Select value={prefs.planner.dayBeforeChannel} onValueChange={(value) => updatePlanner({ dayBeforeChannel: value as PlannerSettings["dayBeforeChannel"] })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERY_OPTIONS.filter((option) => option.value !== "off").map((option) => (
                            <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">שעה ביום שלפני</Label>
                      <Select value={prefs.planner.dayBeforeTime} onValueChange={(value) => updatePlanner({ dayBeforeTime: value })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((hour) => (
                            <SelectItem key={hour.value} value={hour.value} className="text-xs">{hour.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3 bg-muted/10 space-y-2">
                  <p className="text-xs font-semibold">התראת סיום אירוע</p>
                  <Select value={prefs.planner.completionChannel} onValueChange={(value) => updatePlanner({ completionChannel: value as PlannerSettings["completionChannel"] })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border p-3 bg-muted/10 space-y-2">
                  <p className="text-xs font-semibold">זימונים, הזמנות ושינויים</p>
                  <Select value={prefs.planner.invitationsChannel} onValueChange={(value) => updatePlanner({ invitationsChannel: value as PlannerSettings["invitationsChannel"] })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">כמה זמן לפני האירוע תרצה תזכורת?</Label>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map((minutes) => (
                  <Badge
                    key={minutes}
                    variant={prefs.planner.reminderMinutes.includes(minutes) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => togglePlannerReminder(minutes)}
                  >
                    {minutes === 60 ? "שעה" : `${minutes} דק׳`}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">רעיון מומלץ לקהל רחב</p>
              <p>תזכורת רגילה: גם במייל וגם באפליקציה · תזכורת יום לפני: רק במייל · סיום אירוע: רק באפליקציה.</p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              תדריכי AI והתראות AI
            </div>
            <Switch checked={prefs.ai.enabled} onCheckedChange={(checked) => void savePrefs({ ...prefs, ai: { ...prefs.ai, enabled: checked } })} />
          </CardTitle>
          <p className="text-xs text-muted-foreground">כאן שומרים את כל ההעדפות של הסוכן: תדריך יומי, סיכום מיילים, חדשות, ותזכורת קבועה.</p>
        </CardHeader>
        {prefs.ai.enabled && (
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { key: "dailyBriefingEnabled", label: "תדריך מלא על היום", icon: Bot },
                { key: "emailDigestEnabled", label: "סיכום מיילים מסונכרנים", icon: Inbox },
                { key: "newsBriefingEnabled", label: "תדריך חדשות בוקר", icon: Newspaper },
                { key: "reminderEnabled", label: "תזכורת AI קבועה", icon: Clock },
              ].map((option) => {
                const ActiveIcon = option.icon;
                const value = prefs.ai[option.key as keyof AiSettings] as boolean;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => void savePrefs({ ...prefs, ai: { ...prefs.ai, [option.key]: !value } })}
                    className={`rounded-lg border p-3 text-right text-xs ${value ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
                  >
                    <div className="flex items-center gap-2">
                      <ActiveIcon className="h-3.5 w-3.5" />
                      {option.label}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">שעת תזכורת/תדריך</Label>
                <Select value={prefs.ai.reminderTime} onValueChange={(value) => void savePrefs({ ...prefs, ai: { ...prefs.ai, reminderTime: value } })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour.value} value={hour.value} className="text-xs">
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">תחומי עניין לחדשות</Label>
                <Input
                  value={prefs.ai.newsTopics}
                  onChange={(event) => void savePrefs({ ...prefs, ai: { ...prefs.ai, newsTopics: event.target.value } })}
                  placeholder="למשל: טכנולוגיה, כלכלה, בריאות, ספורט"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <p>ההעדפות כאן מזינות גם את Tabro AI, גם את התדריכים, וגם את ערוצי ההתראות העתידיים לאייפון ולדפדפן.</p>
              <p>אם תדליק מההגדרות את טאב Tabro AI, תקבל גם דשבורד שיחה מלא עם העלאת קבצים ומצבי סוכן.</p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-primary" />
              שעות שקט
            </div>
            <Switch checked={prefs.quietHoursEnabled} onCheckedChange={(checked) => void savePrefs({ ...prefs, quietHoursEnabled: checked })} />
          </CardTitle>
          <p className="text-xs text-muted-foreground">לא יישלחו התראות בשעות האלו.</p>
        </CardHeader>
        {prefs.quietHoursEnabled && (
          <CardContent className="space-y-3 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">מ-</Label>
                <Select value={prefs.quietHoursStart} onValueChange={(value) => void savePrefs({ ...prefs, quietHoursStart: value })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour.value} value={hour.value} className="text-xs">
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">עד-</Label>
                <Select value={prefs.quietHoursEnd} onValueChange={(value) => void savePrefs({ ...prefs, quietHoursEnd: value })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour.value} value={hour.value} className="text-xs">
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <VolumeX className="h-3.5 w-3.5" />
              התראות שיגיעו בשעות השקט יישמרו ויטופלו בהמשך.
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            כמות התראות ביום
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Select value={String(prefs.dailyLimit)} onValueChange={(value) => void savePrefs({ ...prefs, dailyLimit: Number(value) })}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {saving && <p className="text-center text-xs text-muted-foreground animate-pulse">שומר...</p>}
    </div>
  );
};

export default NotificationSettings;
