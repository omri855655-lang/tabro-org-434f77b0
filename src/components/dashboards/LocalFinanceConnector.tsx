import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Clipboard, Download, KeyRound, Laptop, Loader2, RefreshCw, ShieldCheck, Terminal, Trash2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

interface ConnectorDevice {
  id: string;
  name: string;
  status: string;
  platform: string | null;
  connector_version: string | null;
  sync_interval_minutes: number;
  providers: string[] | null;
  last_seen_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
}

const PROVIDER_GROUPS = [
  {
    title: "בנקים",
    items: ["הפועלים", "לאומי", "דיסקונט", "מזרחי טפחות", "הבינלאומי", "מרכנתיל", "מסד", "יהב", "אוצר החייל", "פאגי"],
  },
  { title: "כרטיסי אשראי", items: ["ישראכרט", "MAX", "כאל", "American Express"] },
  { title: "מועדוני צרכנות", items: ["ביחד בשבילך", "בהצדעה"] },
] as const;

const copy = {
  he: {
    title: "Tabro Finance Connector",
    description: "ייבוא אוטומטי מהמחשב שלך לבנקים, אשראי ומועדוני צרכנות נתמכים.",
    privacyTitle: "פרטי הכניסה נשארים במחשב",
    privacy: "המחבר פועל מקומית ושולח ל-Tabro רק חשבונות ותנועות. זהו ייבוא אוטומטי בהתנהגות קריאה בלבד, לא הרשאת Open Banking רשמית.",
    add: "חבר מחשב",
    deviceName: "שם המחשב",
    interval: "תדירות סנכרון",
    download: "הורד את המחבר",
    pair: "צור קוד צימוד",
    setupTitle: "התקנת המחבר",
    setupDescription: "הפקודה מוצגת פעם אחת ומחברת את המחשב לחשבון שלך. אין לשלוח אותה לאדם אחר.",
    copy: "העתק התקנה אוטומטית למק",
    copied: "הועתק",
    waiting: "ממתין לחיבור מהמחשב",
    noDevices: "עדיין לא חובר מחשב. לאחר ההתקנה ניתן לבחור מקורות ולהפעיל סנכרון מחזורי.",
    revoke: "נתק מחשב",
    lastSync: "סנכרון אחרון",
    never: "טרם סונכרן",
    supported: "מקורות שהמחבר מכיר",
    stepOne: "פתח את Terminal במק",
    stepTwo: "הדבק את הפקודה ולחץ Enter",
    stepThree: "בחר בנק, אשראי או מועדון והזן את פרטי הכניסה בחלון המקומי",
    stepFour: "המחבר יפעל ברקע ויסנכרן אוטומטית לפי התדירות שבחרת",
    localCredentials: "Tabro לא מקבל את הסיסמה. היא נשמרת בכספת הסיסמאות של macOS.",
  },
  en: {
    title: "Tabro Finance Connector",
    description: "Automatic local import for supported Israeli banks, cards and consumer clubs.",
    privacyTitle: "Login details stay on your computer",
    privacy: "The connector runs locally and sends only accounts and transactions to Tabro. This is read-only behavior, not official Open Banking consent.",
    add: "Connect a computer",
    deviceName: "Computer name",
    interval: "Sync frequency",
    download: "Download connector",
    pair: "Create pairing code",
    setupTitle: "Install the connector",
    setupDescription: "This one-time command pairs this computer with your account. Do not share it.",
    copy: "Copy automatic Mac install",
    copied: "Copied",
    waiting: "Waiting for this computer",
    noDevices: "No computer is connected yet. Install the connector, choose sources and enable scheduled sync.",
    revoke: "Disconnect computer",
    lastSync: "Last sync",
    never: "Not synced yet",
    supported: "Supported connector sources",
    stepOne: "Open Terminal on your Mac",
    stepTwo: "Paste the command and press Enter",
    stepThree: "Choose a bank, card or club and enter the login details locally",
    stepFour: "The connector runs in the background and syncs automatically",
    localCredentials: "Tabro never receives the password. It is stored in the macOS credential vault.",
  },
};

export function LocalFinanceConnector({ onChanged }: { onChanged?: () => void | Promise<void> }) {
  const { lang } = useLanguage();
  const labels = copy[lang === "he" ? "he" : "en"];
  const [devices, setDevices] = useState<ConnectorDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [interval, setIntervalValue] = useState("360");
  const [pairingToken, setPairingToken] = useState("");
  const [copied, setCopied] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("finance-local-connector", {
      body: { action: "list_devices" },
    });
    if (error) {
      console.error("Failed to load finance connector devices", error);
    } else {
      setDevices(data?.devices || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDevices();
    const timer = window.setInterval(loadDevices, 30000);
    return () => window.clearInterval(timer);
  }, [loadDevices]);

  const setupCommand = useMemo(() => {
    if (!pairingToken) return "";
    const archiveUrl = `${window.location.origin}/downloads/tabro-finance-connector.zip`;
    const installDir = "$HOME/Tabro-Finance-Connector";
    return [
      "set -e",
      `mkdir -p "${installDir}"`,
      `curl -fsSL "${archiveUrl}" -o /tmp/tabro-finance-connector.zip`,
      `unzip -oq /tmp/tabro-finance-connector.zip -d "${installDir}"`,
      `cd "${installDir}"`,
      "npm install",
      `npm run setup -- --url "${SUPABASE_URL}" --key "${SUPABASE_PUBLISHABLE_KEY}" --token "${pairingToken}"`,
      "npm run add-source",
      "npm run sync",
      "npm run install-service",
    ].join(" && ");
  }, [pairingToken]);

  const createPairing = async () => {
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("finance-local-connector", {
      body: {
        action: "create_pairing",
        name: deviceName.trim() || (lang === "he" ? "המחשב שלי" : "My computer"),
        sync_interval_minutes: Number(interval),
      },
    });
    setCreating(false);
    if (error || !data?.pairing_token) {
      toast.error(lang === "he" ? "לא ניתן ליצור קוד צימוד" : "Could not create pairing code");
      return;
    }
    setPairingToken(data.pairing_token);
    setDialogOpen(true);
    await loadDevices();
  };

  const revoke = async (deviceId: string) => {
    const { error } = await supabase.functions.invoke("finance-local-connector", {
      body: { action: "revoke_device", device_id: deviceId },
    });
    if (error) {
      toast.error(lang === "he" ? "ניתוק המחבר נכשל" : "Could not disconnect connector");
      return;
    }
    await loadDevices();
    await onChanged?.();
  };

  const copyCommand = async () => {
    await navigator.clipboard.writeText(setupCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card className="md:col-span-2 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-l from-sky-50 via-background to-emerald-50 dark:from-sky-950/20 dark:to-emerald-950/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base"><Laptop className="h-5 w-5 text-sky-600" />{labels.title}</CardTitle>
            <CardDescription>{labels.description}</CardDescription>
          </div>
          <Badge className="bg-emerald-600 hover:bg-emerald-600">Automatic sync</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <Alert className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <AlertTitle>{labels.privacyTitle}</AlertTitle>
          <AlertDescription>{labels.privacy}</AlertDescription>
        </Alert>

        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="connector-device-name">{labels.deviceName}</Label>
            <Input id="connector-device-name" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder={lang === "he" ? "למשל: MacBook בבית" : "Example: Home MacBook"} />
          </div>
          <div className="space-y-1.5">
            <Label>{labels.interval}</Label>
            <Select value={interval} onValueChange={setIntervalValue}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="60">{lang === "he" ? "כל שעה" : "Hourly"}</SelectItem>
                <SelectItem value="360">{lang === "he" ? "כל 6 שעות" : "Every 6 hours"}</SelectItem>
                <SelectItem value="720">{lang === "he" ? "כל 12 שעות" : "Every 12 hours"}</SelectItem>
                <SelectItem value="1440">{lang === "he" ? "פעם ביום" : "Daily"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={createPairing} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Laptop className="h-4 w-4" />}{labels.add}
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {PROVIDER_GROUPS.map((group) => (
            <div key={group.title} className="rounded-xl border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{group.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => <Badge key={item} variant="outline" className="bg-background font-normal">{item}</Badge>)}
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : devices.length === 0 ? (
          <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">{labels.noDevices}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {devices.map((device) => {
              const online = device.status === "online" && device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < 15 * 60 * 1000;
              return (
                <div key={device.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full p-2 ${online ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                      </span>
                      <div><p className="text-sm font-semibold">{device.name}</p><p className="text-xs text-muted-foreground">{device.platform || labels.waiting}</p></div>
                    </div>
                    <Badge variant={online ? "default" : "secondary"}>{online ? (lang === "he" ? "מחובר" : "Online") : device.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{labels.lastSync}: {device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : labels.never}</p>
                  {device.providers && device.providers.length > 0 && <div className="flex flex-wrap gap-1">{device.providers.map((provider) => <Badge key={provider} variant="outline">{provider}</Badge>)}</div>}
                  {device.last_error && <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{device.last_error}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={loadDevices}><RefreshCw className="me-1 h-3.5 w-3.5" />Refresh</Button>
                    <Button size="sm" variant="ghost" onClick={() => revoke(device.id)}><Trash2 className="me-1 h-3.5 w-3.5" />{labels.revoke}</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{labels.setupTitle}</DialogTitle><DialogDescription>{labels.setupDescription}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[labels.stepOne, labels.stepTwo, labels.stepThree, labels.stepFour].map((step, index) => (
                <div key={step} className="flex gap-3 rounded-xl border bg-muted/25 p-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <Alert className="border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/20">
              <KeyRound className="h-4 w-4 text-sky-600" />
              <AlertDescription>{labels.localCredentials}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Terminal className="h-4 w-4" />{lang === "he" ? "פקודת התקנה מלאה:" : "Complete installation command:"}</Label>
              <div dir="ltr" className="max-h-28 overflow-auto rounded-xl border bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100 break-all">{setupCommand}</div>
              <Button onClick={copyCommand} className="w-full gap-2">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? labels.copied : labels.copy}</Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed p-3">
              <p className="text-xs text-muted-foreground">{lang === "he" ? "להתקנה ידנית או במערכת אחרת אפשר להוריד את קובצי המחבר." : "For manual installation or another OS, download the connector files."}</p>
              <Button asChild size="sm" variant="outline" className="shrink-0 gap-2"><a href="/downloads/tabro-finance-connector.zip" download><Download className="h-4 w-4" />{labels.download}</a></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
