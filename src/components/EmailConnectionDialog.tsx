import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Globe, Server, Loader2 } from "lucide-react";
import { useEmailIntegration } from "@/hooks/useEmailIntegration";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailConnectionDialogProps {
  open: boolean;
  onClose: () => void;
}

const PROVIDERS = [
  { id: "gmail", name: "Gmail", icon: Mail, color: "text-red-500" },
  { id: "outlook", name: "Outlook", icon: Globe, color: "text-blue-500" },
  { id: "imap", name: "IMAP", icon: Server, color: "text-gray-500" },
];

const EmailConnectionDialog = ({ open, onClose }: EmailConnectionDialogProps) => {
  const { t } = useLanguage();
  const { addConnection, refetch } = useEmailIntegration();
  const [provider, setProvider] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapPassword, setImapPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  // Listen for Gmail OAuth callback
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "gmail-connected") {
        toast.success(`${t("emailConnected" as any) || "חשבון מייל חובר"}: ${event.data.email}`);
        refetch();
        setProvider(null);
        onClose();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refetch, onClose, t]);

  const handleGmailOAuth = async () => {
    setOauthLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("loginRequired" as any) || "יש להתחבר מחדש"); return; }

      const { data, error } = await supabase.functions.invoke("gmail-auth", {
        body: { action: "get_auth_url" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank", "width=500,height=600");
      }
    } catch {
      toast.error(t("oauthError" as any) || "שגיאה בפתיחת OAuth");
    } finally {
      setOauthLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!provider || !email.trim()) return;

    if (provider === "gmail") {
      await handleGmailOAuth();
      return;
    }

    setSaving(true);
    if (provider === "imap") {
      await addConnection(provider, email, {
        host: imapHost, port: parseInt(imapPort), password: imapPassword,
      });
    } else {
      await addConnection(provider, email, { oauth_pending: true });
    }

    setSaving(false);
    setProvider(null);
    setEmail("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setProvider(null); onClose(); } }}>
      <DialogContent className="max-w-sm" dir="auto">
        <DialogHeader>
          <DialogTitle>{t("connectEmail" as any) || "חיבור חשבון מייל"}</DialogTitle>
        </DialogHeader>

        {!provider ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("chooseProvider" as any) || "בחר ספק מייל:"}
            </p>
            {PROVIDERS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (p.id === "gmail") {
                      handleGmailOAuth();
                    } else {
                      setProvider(p.id);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-right"
                >
                  <Icon className={`h-5 w-5 ${p.color}`} />
                  <span className="font-medium text-sm">{p.name}</span>
                  {p.id === "gmail" && (
                    <span className="text-[10px] text-muted-foreground mr-auto">OAuth</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("emailAddress" as any) || "כתובת מייל"}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                dir="ltr"
              />
            </div>
            {provider === "imap" && (
              <>
                <div className="space-y-1">
                  <Label>IMAP Host</Label>
                  <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.example.com" dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>Port</Label>
                  <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} type="number" dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>{t("password" as any) || "סיסמה"}</Label>
                  <Input type="password" value={imapPassword} onChange={(e) => setImapPassword(e.target.value)} dir="ltr" />
                </div>
              </>
            )}
            {provider === "outlook" && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                {t("oauthNote" as any) || "לאחר שמירה, תתבצע הפנייה לאימות חשבון. יש לאשר גישה כדי לאפשר סנכרון מיילים."}
              </p>
            )}
          </div>
        )}

        {provider && provider !== "gmail" && (
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setProvider(null)}>
              {t("back" as any) || "חזור"}
            </Button>
            <Button size="sm" onClick={handleConnect} disabled={!email.trim() || saving}>
              {saving ? "..." : t("connect" as any) || "חבר"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmailConnectionDialog;
