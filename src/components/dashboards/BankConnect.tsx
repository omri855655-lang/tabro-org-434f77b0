import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Landmark, Plus, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BankConnection {
  id: string;
  provider_name: string | null;
  status: string;
  last_sync: string | null;
  salt_edge_connection_id: string | null;
  created_at: string;
}

const BankConnect = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("salt-edge-connect", {
        body: { action: "list_connections" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!error && data?.connections) {
        setConnections(data.connections);
      }
    } catch {
      // fallback: direct query
      const { data } = await supabase
        .from("bank_connections")
        .select("id, provider_name, status, last_sync, salt_edge_connection_id, created_at")
        .eq("user_id", user.id)
        .neq("status", "pending")
        .order("created_at", { ascending: false });
      setConnections((data as any[]) || []);
    }
  }, [user]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  // Listen for callback messages from popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "bank-connected") {
        toast.success(`${t("syncComplete" as any)} — ${event.data.provider}`);
        fetchConnections();
      } else if (event.data?.type === "bank-error") {
        toast.error(t("bankConnectError" as any));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [fetchConnections, t]);

  const startConnect = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("loginRequired" as any)); return; }

      const { data, error } = await supabase.functions.invoke("salt-edge-connect", {
        body: { action: "create_connect_session" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.connect_url) {
        window.open(data.connect_url, "_blank", "width=600,height=700");
        toast.success(t("bankConnectStarted" as any));
      }
    } catch (e: any) {
      toast.error(t("bankConnectError" as any));
    } finally {
      setConnecting(false);
    }
  };

  const refreshConnection = async (connId: string) => {
    setRefreshingId(connId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("salt-edge-connect", {
        body: { action: "refresh_connection", connectionId: connId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      toast.success(`${t("syncComplete" as any)} — ${data?.transactions_count || 0} ${t("transactions" as any)}`);
      fetchConnections();
    } catch {
      toast.error(t("syncError" as any));
    } finally {
      setRefreshingId(null);
    }
  };

  const deleteConnection = async (connId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke("salt-edge-connect", {
        body: { action: "delete_connection", connectionId: connId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      toast.success(t("bankDisconnected" as any));
      fetchConnections();
    } catch {
      toast.error(t("deleteError" as any));
    }
  };

  const dateLang = lang === "he" ? "he-IL" : lang === "ar" ? "ar-SA" : lang === "zh" ? "zh-CN" : lang === "ru" ? "ru-RU" : lang === "es" ? "es-ES" : "en-US";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            {t("bankConnections" as any)}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={startConnect} disabled={connecting}>
            {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            <span className="mr-1">{t("connectBank" as any)}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {connections.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t("noBankConnections" as any)}
          </p>
        ) : (
          connections.map((conn) => (
            <div key={conn.id} className="flex items-center justify-between p-2 border rounded-lg">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">{conn.provider_name || t("bankAndCredit" as any)}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant={conn.status === "active" ? "default" : "secondary"} className="text-[10px]">
                      {conn.status === "active" ? "✓" : conn.status}
                    </Badge>
                    {conn.last_sync && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(conn.last_sync).toLocaleDateString(dateLang)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => refreshConnection(conn.id)}
                  disabled={refreshingId === conn.id || !conn.salt_edge_connection_id}
                  aria-label={t("syncNow" as any)}
                >
                  {refreshingId === conn.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteConnection(conn.id)} aria-label={t("delete" as any)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default BankConnect;
