import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { invokeFinanceBackend } from "@/lib/financeBackend";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cloud, KeyRound, Loader2, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ProviderDefinition {
  name: string;
  fields: string[];
}

interface CloudConnection {
  id: string;
  provider_name: string | null;
  status: string;
  last_sync: string | null;
  last_error: string | null;
  metadata: { company_id?: string } | null;
}

const fieldLabels: Record<string, Record<string, string>> = {
  username: { he: "שם משתמש", en: "Username", es: "Usuario", zh: "用户名", ar: "اسم المستخدم", ru: "Имя пользователя" },
  userCode: { he: "קוד משתמש", en: "User code", es: "Código de usuario", zh: "用户代码", ar: "رمز المستخدم", ru: "Код пользователя" },
  password: { he: "סיסמה", en: "Password", es: "Contraseña", zh: "密码", ar: "كلمة المرور", ru: "Пароль" },
  id: { he: "תעודת זהות", en: "ID number", es: "Documento de identidad", zh: "身份证号", ar: "رقم الهوية", ru: "Номер удостоверения" },
  num: { he: "קוד מזהה נוסף", en: "Additional access code", es: "Código adicional", zh: "附加访问码", ar: "رمز دخول إضافي", ru: "Дополнительный код" },
  card6Digits: { he: "6 ספרות אחרונות בכרטיס", en: "Last 6 card digits", es: "Últimos 6 dígitos", zh: "卡片末6位", ar: "آخر 6 أرقام من البطاقة", ru: "Последние 6 цифр карты" },
  nationalID: { he: "מספר תעודת זהות", en: "National ID", es: "Identificación nacional", zh: "身份证号", ar: "رقم الهوية الوطنية", ru: "Национальный ID" },
};

const copy = {
  he: {
    title: "חיבור ישיר לבנק ולאשראי",
    description: "סנכרון אוטומטי בענן של חשבונות ותנועות, ללא מחשב ביתי שפועל ברקע.",
    schedule: "כל חיבור פעיל נבדק ומסתנכרן אוטומטית פעמיים ביום. אפשר גם לסנכרן ידנית בכל עת.",
    securityTitle: "גישה לקריאת נתונים בלבד בתוך Tabro",
    security: "ה-worker המבודד של Tabro כולל רק פעולות קריאה של חשבונות ותנועות. אין בו נתיב להעברה, לתשלום או לשינוי בחשבון. פרטי הכניסה מוצפנים במפתח שרת נפרד ואינם זמינים לדפדפן לאחר החיבור. מאחר שזה חיבור מבוסס סיסמה ולא הרשאת Open Banking רשמית, מגבלת הקריאה נאכפת על ידי הקוד והבידוד של Tabro ולא על ידי הרשאה ייעודית מהבנק.",
    provider: "בנק, כרטיס או מועדון",
    choose: "בחר מקור",
    connect: "חבר וסנכרן",
    connected: "חיבורים בענן",
    empty: "עדיין אין חיבור ישיר. בחר מקור והזן את פרטי הכניסה שלו.",
    sync: "סנכרן עכשיו",
    remove: "נתק ומחק פרטי התחברות",
    disconnectNote: "ניתוק מוחק מיד את החיבור ואת פרטי ההתחברות המוצפנים. תנועות שכבר יובאו נשארות בהיסטוריה הפיננסית שלך.",
    active: "פעיל",
    syncing: "מסנכרן",
    error: "דורש טיפול",
    lastSync: "סנכרון אחרון",
    never: "טרם סונכרן",
    unavailable: "שירות הסנכרון הענני עדיין לא נפרס. הקוד מוכן, אך צריך להגדיר את כתובת ה-worker ומפתחות השרת ב-Supabase.",
  },
  en: {
    title: "Direct bank and card connection",
    description: "Automatic cloud synchronization of accounts and transactions without keeping a home computer online.",
    schedule: "Every active connection is checked and synchronized automatically twice a day. Manual sync remains available.",
    securityTitle: "Read-only data access inside Tabro",
    security: "Tabro's isolated worker only contains account and transaction reading operations. It has no transfer, payment, or account-changing path. Credentials are encrypted with a separate server key and are unavailable to the browser after connecting. Because this is password-based access rather than official Open Banking consent, read-only behavior is enforced by Tabro's code and isolation rather than a dedicated bank permission.",
    provider: "Bank, card or club",
    choose: "Choose a source",
    connect: "Connect and sync",
    connected: "Cloud connections",
    empty: "No direct connection yet. Choose a source and enter its login details.",
    sync: "Sync now",
    remove: "Disconnect and delete credentials",
    disconnectNote: "Disconnecting immediately deletes the connection and its encrypted credentials. Transactions already imported remain in your financial history.",
    active: "Active",
    syncing: "Syncing",
    error: "Needs attention",
    lastSync: "Last sync",
    never: "Not synced yet",
    unavailable: "The cloud sync service has not been deployed yet. The code is ready, but its worker URL and server keys must be configured in Supabase.",
  },
} as const;

export function CloudFinanceConnector({ onChanged }: { onChanged?: () => void | Promise<void> }) {
  const { lang } = useLanguage();
  const labels = copy[lang === "he" ? "he" : "en"];
  const [providers, setProviders] = useState<Record<string, ProviderDefinition>>({});
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  const selected = providers[companyId];
  const currentLanguage = fieldLabels.username[lang] ? lang : "en";

  const invoke = useCallback(
    (action: string, payload: Record<string, unknown> = {}) => invokeFinanceBackend(action, payload),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [providerData, connectionData] = await Promise.all([
        invoke("providers"),
        invoke("list"),
        invoke("worker_status"),
      ]);
      setProviders(providerData.providers || {});
      setConnections(connectionData.connections || []);
      setServiceUnavailable(false);
    } catch (error) {
      console.error("Failed to load cloud finance connector", error);
      setServiceUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCredentials({});
  }, [companyId]);

  const canConnect = useMemo(
    () => Boolean(selected && selected.fields.every((field) => credentials[field]?.trim())),
    [credentials, selected],
  );

  const connect = async () => {
    if (!canConnect) return;
    setBusy("connect");
    try {
      const result = await invoke("connect", { companyId, credentials });
      toast.success(
        lang === "he"
          ? `החיבור הושלם: ${result.accounts_count || 0} חשבונות ו-${result.transactions_count || 0} תנועות חדשות`
          : `Connected: ${result.accounts_count || 0} accounts and ${result.transactions_count || 0} new transactions`,
      );
      setCredentials({});
      setCompanyId("");
      await load();
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setBusy(null);
    }
  };

  const sync = async (connectionId: string) => {
    setBusy(connectionId);
    try {
      const result = await invoke("sync", { connectionId });
      toast.success(
        lang === "he"
          ? `נוספו ${result.transactions_count || 0} תנועות חדשות`
          : `${result.transactions_count || 0} new transactions imported`,
      );
      await load();
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (connectionId: string) => {
    if (!window.confirm(lang === "he"
      ? "לנתק את החיבור ולמחוק לצמיתות את פרטי ההתחברות המוצפנים? התנועות שכבר יובאו יישארו בהיסטוריה."
      : "Disconnect and permanently delete the encrypted credentials? Previously imported transactions will remain in history.")) return;
    setBusy(connectionId);
    try {
      await invoke("delete", { connectionId });
      await load();
      await onChanged?.();
      toast.success(lang === "he" ? "החיבור ופרטי ההתחברות המוצפנים נמחקו" : "Connection and encrypted credentials deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  const statusLabel = (status: string) => {
    if (status === "active") return labels.active;
    if (status === "syncing" || status === "pending") return labels.syncing;
    return labels.error;
  };

  return (
    <Card className="md:col-span-2 overflow-hidden border-sky-200/80 dark:border-sky-900">
      <CardHeader className="bg-gradient-to-l from-sky-50 via-background to-amber-50 pb-3 dark:from-sky-950/20 dark:to-amber-950/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base"><Cloud className="h-5 w-5 text-sky-600" />{labels.title}</CardTitle>
            <CardDescription>{labels.description}</CardDescription>
          </div>
          <Badge variant="secondary">Israeli Bank Scrapers</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <ShieldCheck className="h-4 w-4 text-amber-700" />
          <AlertTitle>{labels.securityTitle}</AlertTitle>
          <AlertDescription>{labels.security}</AlertDescription>
        </Alert>
        <Alert className="border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20">
          <RefreshCw className="h-4 w-4 text-sky-700" />
          <AlertTitle>{lang === "he" ? "סנכרון אוטומטי פעמיים ביום" : "Twice-daily automatic sync"}</AlertTitle>
          <AlertDescription>{labels.schedule}</AlertDescription>
        </Alert>

        {serviceUnavailable ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>{lang === "he" ? "נדרשת הגדרת שרת" : "Server setup required"}</AlertTitle>
            <AlertDescription>{labels.unavailable}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4 rounded-2xl border bg-muted/15 p-4">
            <div className="space-y-1.5">
              <Label>{labels.provider}</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder={labels.choose} /></SelectTrigger>
                <SelectContent>
                  {Object.entries(providers).map(([id, provider]) => (
                    <SelectItem key={id} value={id}>{provider.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected && (
              <div className="grid gap-3 sm:grid-cols-2">
                {selected.fields.map((field) => (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`cloud-finance-${field}`}>{fieldLabels[field]?.[currentLanguage] || field}</Label>
                    <div className="relative">
                      {field === "password" && <KeyRound className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />}
                      <Input
                        id={`cloud-finance-${field}`}
                        type={field === "password" ? "password" : "text"}
                        autoComplete={field === "password" ? "new-password" : "off"}
                        className={field === "password" ? "ps-9" : undefined}
                        value={credentials[field] || ""}
                        onChange={(event) => setCredentials((current) => ({ ...current, [field]: event.target.value }))}
                        dir="ltr"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={connect} disabled={!canConnect || busy === "connect"} className="gap-2">
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
              {labels.connect}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{labels.connected}</h3>
          <p className="text-xs text-muted-foreground">{labels.disconnectNote}</p>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : connections.length === 0 ? (
            <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {connections.map((connection) => (
                <div key={connection.id} className="space-y-3 rounded-xl border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{connection.provider_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {labels.lastSync}: {connection.last_sync ? new Date(connection.last_sync).toLocaleString() : labels.never}
                      </p>
                    </div>
                    <Badge variant={connection.status === "active" ? "default" : connection.status === "error" ? "destructive" : "secondary"}>
                      {statusLabel(connection.status)}
                    </Badge>
                  </div>
                  {connection.last_error && <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{connection.last_error}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => sync(connection.id)} disabled={busy === connection.id}>
                      {busy === connection.id ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="me-1 h-3.5 w-3.5" />}
                      {labels.sync}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(connection.id)} disabled={busy === connection.id}>
                      <Trash2 className="me-1 h-3.5 w-3.5" />{labels.remove}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
