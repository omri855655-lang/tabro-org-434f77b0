import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, ShieldCheck } from "lucide-react";
import { useEmailIntegration } from "@/hooks/useEmailIntegration";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailConnectionDialogProps {
  open: boolean;
  onClose: () => void;
}

const PROVIDERS = [
  { id: "gmail", name: "Gmail", icon: Mail, color: "text-red-500", oauth: true },
];

const EmailConnectionDialog = ({ open, onClose }: EmailConnectionDialogProps) => {
  const { t, lang } = useLanguage();
  const { refetch } = useEmailIntegration();
  const [oauthLoading, setOauthLoading] = useState(false);
  const isHe = lang === "he" || lang === "ar";
  const oauthOrigin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== oauthOrigin) return;
      if (event.data?.type === "gmail-connected") {
        toast.success(`${t("emailConnected" as any)}: ${event.data.email}`);
        refetch();
        onClose();
      }

      if (event.data?.type === "gmail-error") {
        toast.error(isHe ? "שגיאה בחיבור Gmail" : "Error connecting Gmail");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isHe, oauthOrigin, onClose, refetch, t]);

  const handleGmailOAuth = async () => {
    setOauthLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t("loginRequired" as any));
        return;
      }

      const { data, error } = await supabase.functions.invoke("gmail-auth", {
        body: { action: "get_auth_url" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || !data?.url) {
        toast.error(t("oauthError" as any));
        return;
      }

      const popup = window.open(data.url, "gmail-oauth", "width=620,height=760");
      if (!popup) {
        toast.error(isHe ? "הדפדפן חסם את חלון ההרשאות" : "The browser blocked the permissions popup");
        return;
      }
    } catch {
      toast.error(t("oauthError" as any));
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm" dir={isHe ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{t("connectEmail" as any)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("chooseProvider" as any)}
            </p>
            {PROVIDERS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={handleGmailOAuth}
                  disabled={oauthLoading}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-right disabled:opacity-50"
                  aria-label={`${t("connect" as any)} ${p.name}`}
                >
                  <Icon className={`h-5 w-5 ${p.color}`} />
                  <span className="font-medium text-sm">{p.name}</span>
                  {p.oauth && (
                    <span className="text-[10px] text-muted-foreground mr-auto">
                      {oauthLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "OAuth"}
                    </span>
                  )}
                </button>
              );
            })}
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{isHe ? "החיבור מתבצע אצל Google בהרשאת קריאה בלבד. Tabro אינה מקבלת או שומרת את סיסמת Gmail שלך." : "Google handles sign-in with read-only access. Tabro never receives or stores your Gmail password."}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailConnectionDialog;
