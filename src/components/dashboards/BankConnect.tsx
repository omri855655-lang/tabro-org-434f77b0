import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Landmark, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

type BankConnection = Database["public"]["Tables"]["bank_connections"]["Row"];

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
    normalized.includes("salt_edge_app_id") ||
    normalized.includes("salt_edge_secret") ||
    normalized.includes("not configured on the server")
  ) {
    return isHe
      ? "חיבור הבנק המאובטח עדיין לא מוגדר בשרת. צריך להגדיר מפתחות Salt Edge."
      : "The secure bank connection is not configured on the server yet. Salt Edge credentials are missing.";
  }

  return isHe ? `שגיאת חיבור בנק: ${rawMessage}` : `Secure bank connection error: ${rawMessage}`;
}

const BankConnect = ({ onChanged }: BankConnectProps) => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isHe = lang === "he" || lang === "ar";

  const loadConnections = useCallback(async () => {
    if (!user) {
      setConnections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("salt-edge-connect", {
      body: { action: "list_connections" },
    });

    if (error) {
      console.error("Failed to load bank connections:", error);
      toast.error(t("bankConnectError" as any));
    } else {
      setConnections(data?.connections || []);
    }

    setLoading(false);
  }, [t, user]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (SUPABASE_FUNCTIONS_ORIGIN && event.origin !== SUPABASE_FUNCTIONS_ORIGIN) return;
      if (event.data?.source !== "tabro-oauth" || event.data?.provider !== "bank") return;

      if (event.data?.type === "bank-connected") {
        await loadConnections();
        await onChanged?.();
        toast.success(
          isHe
            ? `חיבור לקריאת הוצאות הופעל${event.data?.providerName ? `: ${event.data.providerName}` : ""}`
            : `Expense connection enabled${event.data?.providerName ? `: ${event.data.providerName}` : ""}`,
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
      const { data, error } = await supabase.functions.invoke("salt-edge-connect", {
        body: { action: "create_connect_session", origin: window.location.origin },
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
      const { data, error } = await supabase.functions.invoke("salt-edge-connect", {
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
          ? `סונכרנו ${data?.transactions_count ?? 0} הוצאות`
          : `Synced ${data?.transactions_count ?? 0} expense transactions`,
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
      const { error } = await supabase.functions.invoke("salt-edge-connect", {
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
              {isHe ? "חיבורי בנק / Open Banking" : "Bank / Open Banking"}
            </CardTitle>
            <CardDescription>
              {isHe
                ? "קריאה בלבד של הוצאות אמיתיות. אם החשבון חושף גם כרטיסים, גם התנועות שלהם יסונכרנו."
                : "Read-only sync for real spending. If your account exposes card activity, those expenses can sync too."}
            </CardDescription>
          </div>
          <Badge variant="secondary">{isHe ? "ישראל + חו\"ל" : "Israel + global"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>{isHe ? "הוצאות בלבד" : "Expenses only"}</AlertTitle>
          <AlertDescription>
            {isHe
              ? "החיבור הזה מיועד לניתוח תקציב וחיסכון. אנחנו מסנכרנים רק תנועות הוצאה בפועל ולא מייצרים מהן משימות תשלום מתוכננות."
              : "This connection is for budgeting and savings. Only real expense transactions are synced and they stay separate from planned payments."}
          </AlertDescription>
        </Alert>

        <Button onClick={handleConnect} disabled={connecting} className="w-full sm:w-auto">
          {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Landmark className="mr-2 h-4 w-4" />}
          {t("connectBank" as any)}
        </Button>

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
