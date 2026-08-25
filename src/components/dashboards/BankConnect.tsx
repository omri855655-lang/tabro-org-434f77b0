import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CreditCard, Landmark, Loader2, PiggyBank, RefreshCw, ShieldCheck, Trash2, TrendingUp, WalletCards } from "lucide-react";
import { toast } from "sonner";

type BankConnection = Database["public"]["Tables"]["bank_connections"]["Row"];
type FinancialAccount = Database["public"]["Tables"]["financial_accounts"]["Row"];

interface BankConnectProps {
  onChanged?: () => void | Promise<void>;
}

const SUPABASE_FUNCTIONS_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL).origin;
  } catch {
    return null;
  }
})();

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
      ? "חיבור Open Finance עדיין לא מוגדר בשרת. צריך להגדיר את מפתחות הארגון המאובטחים."
      : "Open Finance is not configured on the server yet. Secure organization credentials are missing.";
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const isHe = lang === "he" || lang === "ar";

  const loadConnections = useCallback(async () => {
    if (!user) {
      setConnections([]);
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("open-finance-connect", {
      body: { action: "list_connections" },
    });

    if (error) {
      console.error("Failed to load bank connections:", error);
      toast.error(t("bankConnectError" as any));
    } else {
      setConnections(data?.connections || []);
      setAccounts(data?.accounts || []);
    }

    setLoading(false);
  }, [t, user]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (SUPABASE_FUNCTIONS_ORIGIN && event.origin !== SUPABASE_FUNCTIONS_ORIGIN) return;
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
      const { data, error } = await supabase.functions.invoke("open-finance-connect", {
        body: { action: "create_connect_session", origin: window.location.origin, language: lang === "en" ? "en" : "he" },
      });

      if (error || !data?.connect_url) {
        toast.error(getBankConnectionErrorMessage(error, data, isHe));
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
      const { data, error } = await supabase.functions.invoke("open-finance-connect", {
        body: { action: "refresh_connection", connectionId },
      });

      if (error) {
        toast.error(t("syncError" as any));
        return;
      }

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
      const { error } = await supabase.functions.invoke("open-finance-connect", {
        body: { action: "delete_connection", connectionId },
      });

      if (error) {
        toast.error(t("deleteError" as any));
        return;
      }

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
              {isHe ? "Open Finance — כל התמונה הפיננסית" : "Open Finance — your financial picture"}
            </CardTitle>
            <CardDescription>
              {isHe
                ? "חיבור מאובטח וקריאה בלבד לבנקים, כרטיסים, חסכונות, הלוואות וניירות ערך."
                : "Secure read-only access to banks, cards, savings, loans and securities."}
            </CardDescription>
          </div>
          <Badge variant="secondary">Open Finance</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>{isHe ? "שליטה והרשאה נשארות אצלך" : "You stay in control"}</AlertTitle>
          <AlertDescription>
            {isHe
              ? "Tabro לא מקבלת את סיסמת הבנק. האישור נעשה אצל הבנק דרך Open Finance, וניתן לנתק אותו בכל עת. הכנסות והוצאות נשמרות בנפרד מתשלומים מתוכננים."
              : "Tabro never receives your bank password. Consent is completed with your bank through Open Finance and can be revoked at any time. Actual income and expenses stay separate from planned payments."}
          </AlertDescription>
        </Alert>

        <Button onClick={handleConnect} disabled={connecting} className="w-full sm:w-auto">
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
