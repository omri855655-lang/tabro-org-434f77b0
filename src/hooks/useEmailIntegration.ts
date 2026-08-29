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

export interface EmailPriorityPrefs {
  vipSenders: string[];
  lowPrioritySenders: string[];
  importantKeywords: string[];
  ignoredKeywords: string[];
  importantCategories: string[];
  senderBuckets: Record<string, "action" | "finance" | "shopping" | "updates" | "personal" | "promotions" | "low">;
  notifyOnImportantPush: boolean;
  notifyOnImportantEmail: boolean;
}

const DEFAULT_EMAIL_PRIORITY_PREFS: EmailPriorityPrefs = {
  vipSenders: [],
  lowPrioritySenders: [],
  importantKeywords: [],
  ignoredKeywords: [],
  importantCategories: ["task", "payment", "bill"],
  senderBuckets: {},
  notifyOnImportantPush: true,
  notifyOnImportantEmail: false,
};

export function useEmailIntegration() {
  const { user } = useAuth();
  const { lang, t } = useLanguage();
  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [analyses, setAnalyses] = useState<EmailAnalysis[]>([]);
  const [emailPriorityPrefs, setEmailPriorityPrefs] = useState<EmailPriorityPrefs>(DEFAULT_EMAIL_PRIORITY_PREFS);
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
        .limit(200);
      if (error) throw error;
      const unique = new Map<string, EmailAnalysis>();
      ((data as EmailAnalysis[]) || []).forEach((analysis) => {
        const key = [
          analysis.connection_id,
          analysis.email_subject || "",
          analysis.email_from || "",
          analysis.email_date ? new Date(analysis.email_date).toISOString() : "",
        ].join("|");
        if (!unique.has(key)) unique.set(key, analysis);
      });
      setAnalyses([...unique.values()]);
    } catch (e) {
      console.error("Error fetching email analyses:", e);
    }
  }, [user]);

  const fetchEmailPriorityPrefs = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("notification_settings")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;

      const nextPrefs = (data?.notification_settings as Record<string, any> | null)?.emailTriage;
      setEmailPriorityPrefs({
        ...DEFAULT_EMAIL_PRIORITY_PREFS,
        ...(nextPrefs || {}),
        vipSenders: Array.isArray(nextPrefs?.vipSenders) ? nextPrefs.vipSenders : DEFAULT_EMAIL_PRIORITY_PREFS.vipSenders,
        lowPrioritySenders: Array.isArray(nextPrefs?.lowPrioritySenders) ? nextPrefs.lowPrioritySenders : DEFAULT_EMAIL_PRIORITY_PREFS.lowPrioritySenders,
        importantKeywords: Array.isArray(nextPrefs?.importantKeywords) ? nextPrefs.importantKeywords : DEFAULT_EMAIL_PRIORITY_PREFS.importantKeywords,
        ignoredKeywords: Array.isArray(nextPrefs?.ignoredKeywords) ? nextPrefs.ignoredKeywords : DEFAULT_EMAIL_PRIORITY_PREFS.ignoredKeywords,
        importantCategories: Array.isArray(nextPrefs?.importantCategories) ? nextPrefs.importantCategories : DEFAULT_EMAIL_PRIORITY_PREFS.importantCategories,
        senderBuckets: nextPrefs?.senderBuckets && typeof nextPrefs.senderBuckets === "object"
          ? nextPrefs.senderBuckets
          : DEFAULT_EMAIL_PRIORITY_PREFS.senderBuckets,
      });
    } catch (e) {
      console.error("Error fetching email priority prefs:", e);
    }
  }, [user]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchConnections(), fetchAnalyses(), fetchEmailPriorityPrefs()]);
      setLoading(false);
    };
    init();
  }, [fetchConnections, fetchAnalyses, fetchEmailPriorityPrefs]);

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
      
      const { data, error } = await supabase.functions.invoke("email-sync", {
        body: { connectionId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      await Promise.all([fetchAnalyses(), fetchConnections()]);
      const processed = Number(data?.emails_processed || 0);
      toast.success(isHe
        ? `סנכרון המיילים הושלם · ${processed} מיילים עודכנו`
        : `Email sync completed · ${processed} emails updated`);
      return true;
    } catch (e: any) {
      console.error("Email sync failed:", e);
      toast.error(isHe ? "שגיאה בסנכרון מיילים" : "Error syncing emails");
      return false;
    }
  }, [fetchAnalyses, fetchConnections, isHe, t]);

  const saveEmailPriorityPrefs = useCallback(async (nextPrefs: EmailPriorityPrefs) => {
    if (!user) return false;
    try {
      const { data, error: fetchError } = await supabase
        .from("user_preferences")
        .select("notification_settings")
        .eq("user_id", user.id)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const existingSettings = ((data?.notification_settings as Record<string, any> | null) || {});
      const mergedSettings = {
        ...existingSettings,
        emailTriage: nextPrefs,
      };

      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          notification_settings: mergedSettings as any,
        }, { onConflict: "user_id" });
      if (error) throw error;

      setEmailPriorityPrefs(nextPrefs);
      return true;
    } catch (e) {
      console.error("Error saving email priority prefs:", e);
      toast.error(isHe ? "שגיאה בשמירת העדפות המיילים" : "Error saving email preferences");
      return false;
    }
  }, [user, isHe]);

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
    emailPriorityPrefs,
    saveEmailPriorityPrefs,
    refetch: () => Promise.all([fetchConnections(), fetchAnalyses(), fetchEmailPriorityPrefs()]),
  };
}
