import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Bell, Clock, Moon, Mail, Smartphone, MessageCircle, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

interface ChannelSettings {
  enabled: boolean;
  sendTime: string; // "08:00"
  content: string[]; // ["tasks","budget","weekly","projects"]
}

interface NotifPrefs {
  email: ChannelSettings;
  push: ChannelSettings;
  telegram: ChannelSettings;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string;   // "07:00"
  quietHoursEnabled: boolean;
  dailyLimit: number; // 0 = unlimited
}

const DEFAULT_PREFS: NotifPrefs = {
  email: { enabled: true, sendTime: "08:00", content: ["tasks", "budget", "weekly", "projects"] },
  push: { enabled: true, sendTime: "08:00", content: ["tasks", "budget", "projects"] },
  telegram: { enabled: false, sendTime: "09:00", content: ["weekly"] },
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  quietHoursEnabled: false,
  dailyLimit: 0,
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

const NotificationSettings = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load from DB
  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    const load = async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("notification_settings")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.notification_settings) {
        setPrefs(prev => ({ ...prev, ...(data.notification_settings as any) }));
      }
      setLoaded(true);
    };
    load();
  }, [user]);

  // Save to DB
  const save = useCallback(async (newPrefs: NotifPrefs) => {
    setPrefs(newPrefs);
    if (!user) {
      localStorage.setItem("notification-prefs", JSON.stringify(newPrefs));
      return;
    }
    setSaving(true);
    await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, notification_settings: newPrefs as any },
        { onConflict: "user_id" }
      );
    setSaving(false);
    // Also sync legacy localStorage keys for backward compat
    localStorage.setItem("notification-email-enabled", String(newPrefs.email.enabled));
    localStorage.setItem("notification-push-enabled", String(newPrefs.push.enabled));
    localStorage.setItem("notification-telegram-enabled", String(newPrefs.telegram.enabled));
  }, [user]);

  const updateChannel = (channel: "email" | "push" | "telegram", patch: Partial<ChannelSettings>) => {
    const newPrefs = { ...prefs, [channel]: { ...prefs[channel], ...patch } };
    save(newPrefs);
  };

  const toggleContent = (channel: "email" | "push" | "telegram", contentKey: string) => {
    const current = prefs[channel].content;
    const newContent = current.includes(contentKey)
      ? current.filter(c => c !== contentKey)
      : [...current, contentKey];
    updateChannel(channel, { content: newContent });
  };

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      {/* Per-channel settings */}
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
              {/* Send time */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs">שעת שליחה</Label>
                </div>
                <Select
                  value={prefs[key].sendTime}
                  onValueChange={(v) => updateChannel(key, { sendTime: v })}
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map(h => (
                      <SelectItem key={h.value} value={h.value} className="text-xs">{h.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Content types */}
              <Separator />
              <p className="text-xs font-medium text-muted-foreground">תוכן ההתראות:</p>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_OPTIONS.map(opt => (
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

      {/* Quiet hours */}
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
                    {HOURS.map(h => <SelectItem key={h.value} value={h.value} className="text-xs">{h.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">עד-</Label>
                <Select value={prefs.quietHoursEnd} onValueChange={(v) => save({ ...prefs, quietHoursEnd: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS.map(h => <SelectItem key={h.value} value={h.value} className="text-xs">{h.label}</SelectItem>)}
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

      {/* Daily limit */}
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
              {LIMIT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {saving && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">שומר...</p>
      )}
    </div>
  );
};

export default NotificationSettings;
