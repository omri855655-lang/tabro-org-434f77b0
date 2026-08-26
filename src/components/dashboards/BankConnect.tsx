import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { financeBackendOrigin, invokeFinanceFunction } from "@/lib/financeBackend";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Building2, CreditCard, Eye, Landmark, Loader2, LockKeyhole, PiggyBank, RefreshCw, ShieldCheck, Trash2, TrendingUp, WalletCards } from "lucide-react";
import { toast } from "sonner";

type BankConnection = Database["public"]["Tables"]["bank_connections"]["Row"];
type FinancialAccount = Database["public"]["Tables"]["financial_accounts"]["Row"];

interface BankConnectProps {
  onChanged?: () => void | Promise<void>;
}

function getBankConnectionErrorMessage(
  error: { message?: string } | null,
  data: { error?: string; message?: string } | null | undefined,
  isHe: boolean,
) {
  const rawMessage = data?.error || data?.message || error?.message || "";
  const normalized = rawMessage.toLowerCase();

  if (!rawMessage) {
    return isHe ? "לא הצלחתי לפתוח חיבור בנק מאובטח" : "Could not open a secure bank connection";
  }

  if (
    normalized.includes("open_finance_client_id") ||
    normalized.includes("open_finance_client_secret") ||
    normalized.includes("not configured on the server")
  ) {
    return isHe
      ? "חיבור Open Banking לקריאה בלבד מוכן בקוד, אך עדיין חסרים מפתחות הארגון של Open-Finance.ai בשרת."
      : "Read-only Open Banking is ready, but the Open-Finance.ai organization keys are not configured on the server.";
  }

  return isHe ? `שגיאת חיבור בנק: ${rawMessage}` : `Secure bank connection error: ${rawMessage}`;
}

const BankConnect = ({ onChanged }: BankConnectProps) => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const autoSyncStarted = useRef(false);
  const isHe = lang === "he" || lang === "ar";

  const loadConnections = useCallback(async () => {
    if (!user) {
      setConnections([]);
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [status, data] = await Promise.all([
        invokeFinanceFunction<{ configured?: boolean }>("open-finance-connect", { action: "status" }),
        invokeFinanceFunction<{ connections?: BankConnection[]; accounts?: FinancialAccount[] }>("open-finance-connect", { action: "list_connections" }),
      ]);
      setConfigured(Boolean(status.configured));
      const nextConnections = data.connections || [];
      setConnections(nextConnections);
      setAccounts(data.accounts || []);
      const stale = nextConnections.some((connection) =>
        !connection.last_sync || Date.now() - new Date(connection.last_sync).getTime() > 15 * 60 * 1000
      );
      if (!autoSyncStarted.current && stale) {
        autoSyncStarted.current = true;
        const syncData = await invokeFinanceFunction<{ success?: boolean }>("open-finance-connect", { action: "sync_all" });
        if (syncData.success) {
          const refreshed = await invokeFinanceFunction<{ connections?: BankConnection[]; accounts?: FinancialAccount[] }>("open-finance-connect", { action: "list_connections" });
          setConnections(refreshed.connections || nextConnections);
          setAccounts(refreshed.accounts || data.accounts || []);
          await onChanged?.();
        }
      }
    } catch (error) {
      console.error("Failed to load bank connections:", error);
    }

    setLoading(false);
  }, [onChanged, user]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (financeBackendOrigin && event.origin !== financeBackendOrigin) return;
      if (event.data?.source !== "tabro-oauth" || event.data?.provider !== "open-finance") return;

      if (event.data?.type === "bank-connected") {
        await loadConnections();
        await onChanged?.();
        toast.success(
          isHe
            ? "החיבור הפיננסי הופעל. אפשר לסנכרן עכשיו את החשבונות והתנועות."
            : "Financial connection enabled. You can now sync accounts and transactions.",
        );
      }

      if (event.data?.type === "bank-error") {
        toast.error(t("bankConnectError" as any));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isHe, loadConnections, onChanged, t]);

  const handleConnect = async () => {
    setConnecting(true);

    try {
      const data = await invokeFinanceFunction<{ connect_url?: string; error?: string }>("open-finance-connect", {
        action: "create_connect_session",
        origin: window.location.origin,
        language: lang === "en" ? "en" : "he",
      });

      if (!data.connect_url) {
        toast.error(getBankConnectionErrorMessage(null, data, isHe));
        return;
      }

      const popup = window.open(data.connect_url, "tabro-bank-connect", "width=720,height=820");
      if (!popup) {
        toast.error(isHe ? "הדפדפן חסם את חלון החיבור" : "The browser blocked the connection popup");
        return;
      }

      toast.success(t("bankConnectStarted" as any));
    } catch (error) {
      console.error("Failed to start bank connection:", error);
      toast.error(t("bankConnectError" as any));
    } finally {
      setConnecting(false);
    }
  };

  const handleRefresh = async (connectionId: string) => {
    setBusyId(connectionId);

    try {
      const data = await invokeFinanceFunction<{ accounts_count?: number; transactions_count?: number }>(
        "open-finance-connect",
        { action: "refresh_connection", connectionId },
      );

      await loadConnections();
      await onChanged?.();
      toast.success(
        isHe
          ? `סונכרנו ${data?.accounts_count ?? 0} חשבונות ו־${data?.transactions_count ?? 0} תנועות`
          : `Synced ${data?.accounts_count ?? 0} accounts and ${data?.transactions_count ?? 0} transactions`,
      );
    } catch (error) {
      console.error("Failed to refresh bank connection:", error);
      toast.error(t("syncError" as any));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!window.confirm(isHe ? "למחוק את חיבור הבנק הזה?" : "Remove this bank connection?")) return;

    setBusyId(connectionId);

    try {
      await invokeFinanceFunction("open-finance-connect", { action: "delete_connection", connectionId });

      await loadConnections();
      await onChanged?.();
      toast.success(t("bankDisconnected" as any));
    } catch (error) {
      console.error("Failed to delete bank connection:", error);
      toast.error(t("deleteError" as any));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              {isHe ? "Open Banking רשמי — קריאה בלבד" : "Official Open Banking — read only"}
            </CardTitle>
            <CardDescription>
              {isHe
                ? "חיבור מאובטח וקריאה בלבד לבנקים, כרטיסים, חסכונות, הלוואות וניירות ערך."
                : "Secure read-only access to banks, cards, savings, loans and securities."}
            </CardDescription>
          </div>
          <Badge variant="secondary">Open-Finance.ai</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>{isHe ? "שליטה והרשאה נשארות אצלך" : "You stay in control"}</AlertTitle>
          <AlertDescription>
            {isHe
              ? "Tabro לא מקבלת או שומרת את סיסמת הבנק. האישור נעשה במסך הבנק דרך Open Banking, וניתן לבטל אותו בכל עת."
              : "Tabro never receives your bank password. Consent is completed with your bank through Open Finance and can be revoked at any time. Actual income and expenses stay separate from planned payments."}
          </AlertDescription>
        </Alert>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-xl border bg-muted/20 p-3 text-xs">
            <Eye className="h-4 w-4 text-emerald-600" />
            {isHe ? "יתרות ותנועות בלבד" : "Balances and transactions only"}
          </div>
          <div className="flex items-center gap-2 rounded-xl border bg-muted/20 p-3 text-xs">
            <LockKeyhole className="h-4 w-4 text-sky-600" />
            {isHe ? "בלי סיסמה ב-Tabro" : "No bank password in Tabro"}
          </div>
          <div className="flex items-center gap-2 rounded-xl border bg-muted/20 p-3 text-xs">
            <Building2 className="h-4 w-4 text-amber-600" />
            {isHe ? "אישור ישירות בבנק" : "Consent directly with your bank"}
          </div>
        </div>

        {!configured && (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>{isHe ? "ממתין להפעלת ספק Open Banking" : "Open Banking provider setup pending"}</AlertTitle>
            <AlertDescription>
              {isHe
                ? "המסלול מוכן, אך יש להגדיר בשרת Client ID ו-Client Secret של Open-Finance.ai לפני פתיחת מסך ההסכמה."
                : "The flow is ready, but the Open-Finance.ai Client ID and Client Secret must be configured on the server first."}
            </AlertDescription>
          </Alert>
        )}

        <Button onClick={handleConnect} disabled={connecting || !configured} className="w-full sm:w-auto">
          {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Landmark className="mr-2 h-4 w-4" />}
          {t("connectBank" as any)}
        </Button>

        {accounts.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {accounts.map((account) => {
              const type = account.account_type.toUpperCase();
              const AccountIcon = type === "CARD" ? CreditCard : type === "LOAN" ? WalletCards : type === "SAVINGS" ? PiggyBank : type === "SECURITIES" ? TrendingUp : Landmark;
              const balance = account.available_balance ?? account.current_balance;
              return (
                <div key={account.id} className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-lg bg-background p-2"><AccountIcon className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{account.display_name || account.provider_name || type}</p>
                        <p className="text-xs text-muted-foreground">{account.masked_number || type}</p>
                      </div>
                    </div>
                    {balance !== null && <p className="whitespace-nowrap text-sm font-semibold">{Number(balance).toLocaleString()} {account.currency}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("syncing" as any)}
          </div>
        ) : connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noBankConnections" as any)}</p>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => {
              const isBusy = busyId === connection.id;

              return (
                <div key={connection.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {connection.provider_name || (isHe ? "חיבור בנק" : "Bank connection")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {connection.last_sync
                          ? isHe
                            ? `עודכן לאחרונה: ${new Date(connection.last_sync).toLocaleString()}`
                            : `Last sync: ${new Date(connection.last_sync).toLocaleString()}`
                          : isHe
                            ? "טרם בוצע סנכרון"
                            : "Not synced yet"}
                      </p>
                    </div>
                    <Badge variant={connection.status === "active" ? "default" : "outline"}>
                      {connection.status === "active"
                        ? isHe ? "פעיל" : "Active"
                        : connection.status === "pending"
                          ? isHe ? "ממתין" : "Pending"
                          : connection.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRefresh(connection.id)}
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
                      {isHe ? "מחק חיבור" : "Delete"}
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

export default BankConnect;
