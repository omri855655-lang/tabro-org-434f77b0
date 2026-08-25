import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CreditCard, Info, Landmark, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

type CreditCardConnection = Database["public"]["Tables"]["credit_card_connections"]["Row"];
const CREDIT_CARD_CONNECTIONS_EVENT = "tabro-credit-card-connections-changed";

interface CreditCardConnectProps {
  onChanged?: () => void | Promise<void>;
}

const SUPABASE_FUNCTIONS_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL).origin;
  } catch {
    return null;
  }
})();

const CARD_PROVIDERS = [
  { id: "isracard", labelHe: "ישראכרט", labelEn: "Isracard", region: "IL" },
  { id: "max", labelHe: "MAX", labelEn: "MAX", region: "IL" },
  { id: "cal", labelHe: "כאל", labelEn: "CAL", region: "IL" },
  { id: "visa-global", labelHe: "Visa עולמי", labelEn: "Visa Global", region: "GLOBAL" },
  { id: "mastercard-global", labelHe: "Mastercard עולמי", labelEn: "Mastercard Global", region: "GLOBAL" },
  { id: "amex-global", labelHe: "Amex עולמי", labelEn: "Amex Global", region: "GLOBAL" },
  { id: "other-card", labelHe: "כרטיס אחר", labelEn: "Other card", region: "GLOBAL" },
] as const;

function getSecureConnectionErrorMessage(
  error: { message?: string } | null,
  data: { error?: string; message?: string } | null | undefined,
  isHe: boolean,
) {
  const rawMessage = data?.error || data?.message || error?.message || "";
  const normalized = rawMessage.toLowerCase();

  if (!rawMessage) {
    return isHe ? "לא הצלחתי לפתוח חיבור מאובטח לאשראי" : "Could not open a secure card connection";
  }

  if (
    normalized.includes("salt_edge_app_id") ||
    normalized.includes("salt_edge_secret") ||
    normalized.includes("not configured on the server")
  ) {
    return isHe
      ? "חיבור הבנקאות הפתוחה עדיין לא מוגדר בשרת. צריך להגדיר את מפתחות Salt Edge המאובטחים."
      : "Open Banking is not configured on the server yet. Secure Salt Edge credentials are missing.";
  }

  if (normalized.includes("unauthorized")) {
    return isHe ? "החיבור המאובטח נדחה בגלל הרשאה או טוקן לא תקין." : "The secure connection was rejected due to an authorization issue.";
  }

  if (normalized.includes("provider") && normalized.includes("not found")) {
    return isHe ? "ספק האשראי לא זמין כרגע דרך החיבור המאובטח." : "This card provider is not currently available through the secure connector.";
  }

  return isHe ? `שגיאת חיבור מאובטח: ${rawMessage}` : `Secure connection error: ${rawMessage}`;
}

const CreditCardConnect = ({ onChanged }: CreditCardConnectProps) => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [connections, setConnections] = useState<CreditCardConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [secureConnecting, setSecureConnecting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("isracard");
  const [displayName, setDisplayName] = useState("");
  const [lastDigits, setLastDigits] = useState("");
  const isHe = lang === "he" || lang === "ar";

  const loadConnections = useCallback(async () => {
    if (!user) {
      setConnections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("credit_card_connections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load credit card connections:", error);
      toast.error(t("syncError" as any));
    } else {
      setConnections(data || []);
    }

    setLoading(false);
  }, [t, user]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (SUPABASE_FUNCTIONS_ORIGIN && event.origin !== SUPABASE_FUNCTIONS_ORIGIN) return;
      if (event.data?.source !== "tabro-oauth" || event.data?.provider !== "salt-edge") return;

      if (event.data?.type === "bank-connected") {
        await onChanged?.();
        toast.success(
          isHe
            ? "החיבור המאובטח הופעל ויופיע באזור הבנקאות הפתוחה."
            : "The secure connection is active and will appear under Open Banking.",
        );
      }

      if (event.data?.type === "bank-error") {
        toast.error(isHe ? "שגיאה בחיבור המאובטח" : "Error opening the secure connection");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isHe, onChanged]);

  const handleSecureConnect = async () => {
    setSecureConnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke("salt-edge-connect", {
        body: { action: "create_connect_session", origin: window.location.origin, language: lang === "en" ? "en" : "he" },
      });

      if (error || !data?.connect_url) {
        toast.error(getSecureConnectionErrorMessage(error, data, isHe));
        return;
      }

      const popup = window.open(data.connect_url, "tabro-card-connect", "width=720,height=820");
      if (!popup) {
        toast.error(isHe ? "הדפדפן חסם את חלון החיבור" : "The browser blocked the connection popup");
        return;
      }

      toast.success(
        isHe
          ? "נפתח מסך חיבור מאובטח. אם ספק האשראי נתמך, אפשר להתחבר שם בקריאה בלבד."
          : "Secure connection opened. If the card provider is supported, you can connect there in read-only mode.",
      );
    } catch (error) {
      console.error("Failed to start secure credit card connection:", error);
      toast.error(isHe ? "שגיאה בחיבור המאובטח" : "Error opening the secure connection");
    } finally {
      setSecureConnecting(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;

    setSaving(true);

    try {
      const cleanLastDigits = lastDigits.replace(/\D/g, "").slice(-4);
      const { error } = await supabase.from("credit_card_connections").insert({
        user_id: user.id,
        provider,
        display_name: displayName.trim() || null,
        card_last_digits: cleanLastDigits || null,
        sync_status: "csv_ready",
        sync_error: null,
      });

      if (error) {
        toast.error(t("syncError" as any));
        return;
      }

      setDisplayName("");
      setLastDigits("");
      await loadConnections();
      window.dispatchEvent(new CustomEvent(CREDIT_CARD_CONNECTIONS_EVENT));
      toast.success(
        isHe
          ? "מקור כרטיס נשמר. עכשיו אפשר לייבא אליו הוצאות מהפירוט."
          : "Card source saved. You can now import statement expenses into it.",
      );
    } catch (error) {
      console.error("Failed to create credit card source:", error);
      toast.error(t("syncError" as any));
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (connectionId: string) => {
    setBusyId(connectionId);

    try {
      const { data, error } = await supabase.functions.invoke("credit-card-sync", {
        body: { connectionId },
      });

      if (error) {
        toast.error(t("syncError" as any));
        return;
      }

      await loadConnections();
      toast.success(
        data?.message ||
          (isHe
            ? "בוצעה בדיקת סנכרון. אם אין API ישיר, המשך עם ייבוא CSV."
            : "Sync check completed. If there is no direct API, continue with CSV import."),
      );
    } catch (error) {
      console.error("Failed to sync credit card source:", error);
      toast.error(t("syncError" as any));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!window.confirm(isHe ? "למחוק את מקור הכרטיס הזה?" : "Delete this card source?")) return;

    setBusyId(connectionId);

    try {
      const { error } = await supabase.from("credit_card_connections").delete().eq("id", connectionId);

      if (error) {
        toast.error(t("deleteError" as any));
        return;
      }

      await loadConnections();
      window.dispatchEvent(new CustomEvent(CREDIT_CARD_CONNECTIONS_EVENT));
      toast.success(isHe ? "מקור הכרטיס נמחק" : "Card source deleted");
    } catch (error) {
      console.error("Failed to delete credit card source:", error);
      toast.error(t("deleteError" as any));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {isHe ? "מקורות כרטיס אשראי" : "Credit card sources"}
          </CardTitle>
          <CardDescription>
            {isHe
              ? "שמור כרטיסים מישראל ומהעולם, וייבא אליהם רק הוצאות אמיתיות מהפירוט."
              : "Save Israeli and global card sources, then import real statement expenses into them."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{isHe ? "מה זמין עכשיו" : "Available now"}</AlertTitle>
          <AlertDescription>
            {isHe
              ? "כרטיסים נתמכים יכולים להגיע דרך Open Finance למעלה. אפשר להמשיך להשתמש גם בייבוא CSV / Excel כשספק אינו זמין בחיבור הישיר."
              : "Supported cards can sync through Open Finance above. CSV / Excel import remains available when a provider is not supported directly."}
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {isHe ? "חיבור מאובטח לקריאה בלבד" : "Secure read-only connection"}
            </h4>
            <p className="text-xs text-muted-foreground">
              {isHe
                ? "זה המסלול הישיר למשיכת הוצאות מאפליקציית אשראי או מספק תומך. אם הספק לא מופיע בווידג'ט, נשארים עם CSV / Excel."
                : "This is the direct path for pulling expenses from a supported card app or provider. If it does not appear in the widget, use CSV / Excel."}
            </p>
          </div>

          <Button onClick={handleSecureConnect} disabled={secureConnecting} className="w-full sm:w-auto">
            {secureConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Landmark className="mr-2 h-4 w-4" />}
            {isHe ? "חבר אשראי מאובטח" : "Connect card securely"}
          </Button>

          <p className="text-xs text-muted-foreground">
            {isHe
                ? "אחרי החיבור, המקור יופיע ברשימת Open Finance למעלה ויסונכרנו ממנו הכנסות והוצאות זמינות."
                : "After connection, the source appears in the Open Finance list above and available income and expenses are synced."}
          </p>
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("creditCardProvider" as any)}</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_PROVIDERS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {isHe ? item.labelHe : item.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("cardDisplayName" as any)}</Label>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={isHe ? "למשל: כרטיס חול אישי" : "Example: Personal travel card"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("lastFourDigits" as any)}</Label>
            <Input
              value={lastDigits}
              onChange={(event) => setLastDigits(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              inputMode="numeric"
              dir="ltr"
            />
          </div>

          <Button onClick={handleCreate} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            {isHe ? "שמור מקור כרטיס" : "Save card source"}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("syncing" as any)}
          </div>
        ) : connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isHe
              ? "עדיין לא נשמרו מקורות כרטיס. שמור מקור ואז ייבא אליו פירוט."
              : "No card sources saved yet. Save one, then import statement expenses into it."}
          </p>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => {
              const providerMeta = CARD_PROVIDERS.find((item) => item.id === connection.provider);
              const isBusy = busyId === connection.id;

              return (
                <div key={connection.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {connection.display_name || (providerMeta ? (isHe ? providerMeta.labelHe : providerMeta.labelEn) : connection.provider)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{providerMeta ? (isHe ? providerMeta.labelHe : providerMeta.labelEn) : connection.provider}</span>
                        {connection.card_last_digits && <span>• ****{connection.card_last_digits}</span>}
                        {connection.last_sync && (
                          <span>
                            {isHe ? "עודכן" : "Updated"} {new Date(connection.last_sync).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {connection.sync_status === "csv_ready"
                        ? isHe ? "מוכן לייבוא" : "Ready for import"
                        : connection.sync_status === "pending"
                          ? isHe ? "ממתין" : "Pending"
                          : connection.sync_status === "syncing"
                            ? isHe ? "מסנכרן" : "Syncing"
                            : connection.sync_status}
                    </Badge>
                  </div>

                  {connection.sync_error && (
                    <p className="text-xs text-muted-foreground">{connection.sync_error}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSync(connection.id)}
                      disabled={isBusy}
                    >
                      {isBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                      {t("syncNow" as any)}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(connection.id)}
                      disabled={isBusy}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {isHe ? "מחק מקור" : "Delete"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CreditCardConnect;
