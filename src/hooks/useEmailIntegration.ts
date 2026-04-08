import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

export interface EmailConnection {
  id: string;
  provider: string;
  email_address: string;
  connected_at: string;
  last_sync: string | null;
  settings: Record<string, any>;
}

export interface EmailAnalysis {
  id: string;
  connection_id: string;
  email_subject: string | null;
  email_from: string | null;
  email_date: string | null;
  category: string;
  suggested_action: Record<string, any> | null;
  is_processed: boolean;
}

export function useEmailIntegration() {
  const { user } = useAuth();
  const { lang, t } = useLanguage();
  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [analyses, setAnalyses] = useState<EmailAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const isHe = lang === "he" || lang === "ar";

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("email_connections")
        .select("id, provider, email_address, connected_at, last_sync, settings")
        .eq("user_id", user.id)
        .order("connected_at", { ascending: false });
      if (error) throw error;
      setConnections((data as any[]) || []);
    } catch (e) {
      console.error("Error fetching email connections:", e);
    }
  }, [user]);

  const fetchAnalyses = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("email_analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("email_date", { ascending: false })
        .limit(120);
      if (error) throw error;
      setAnalyses((data as any[]) || []);
    } catch (e) {
      console.error("Error fetching email analyses:", e);
    }
  }, [user]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchConnections(), fetchAnalyses()]);
      setLoading(false);
    };
    init();
  }, [fetchConnections, fetchAnalyses]);

  const addConnection = useCallback(async (provider: string, emailAddress: string, settings?: Record<string, any>) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from("email_connections")
        .insert({
          user_id: user.id,
          provider,
          email_address: emailAddress,
          settings: settings || {},
        } as any)
        .select()
        .single();
      if (error) throw error;
      await fetchConnections();
      toast.success(t("emailConnected" as any));
      return data;
    } catch (e: any) {
      toast.error(isHe ? "שגיאה בחיבור חשבון מייל" : "Error connecting email account");
      return null;
    }
  }, [user, fetchConnections, isHe, t]);

  const removeConnection = useCallback(async (connectionId: string) => {
    try {
      const { error } = await supabase.from("email_connections").delete().eq("id", connectionId);
      if (error) throw error;
      await fetchConnections();
      toast.success(isHe ? "חשבון המייל נותק" : "Email account disconnected");
    } catch (e: any) {
      toast.error(isHe ? "שגיאה בניתוק חשבון מייל" : "Error disconnecting email account");
    }
  }, [fetchConnections, isHe]);

  const syncEmails = useCallback(async (connectionId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("loginRequired" as any)); return; }
      
      const { error } = await supabase.functions.invoke("email-sync", {
        body: { connectionId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      await fetchAnalyses();
      toast.success(isHe ? "סנכרון המיילים הושלם" : "Email sync completed");
    } catch (e: any) {
      toast.error(isHe ? "שגיאה בסנכרון מיילים" : "Error syncing emails");
    }
  }, [fetchAnalyses, isHe, t]);

  const categorySummary = analyses.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    connections,
    analyses,
    loading,
    addConnection,
    removeConnection,
    syncEmails,
    categorySummary,
    refetch: () => Promise.all([fetchConnections(), fetchAnalyses()]),
  };
}
