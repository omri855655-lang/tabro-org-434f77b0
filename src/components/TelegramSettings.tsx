import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_PROJECT_ID, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageCircle, Link2, Unlink, ExternalLink } from "lucide-react";

const TelegramSettings = () => {
  const { user } = useAuth();
  const [linked, setLinked] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [botUsername, setBotUsername] = useState("");

  useEffect(() => {
    if (!user) return;
    checkLink();
    fetchBotInfo();
  }, [user]);

  const checkLink = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("telegram_users")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data && data.chat_id > 0) {
      setLinked(true);
    } else {
      setLinked(false);
    }
    setLoading(false);
  };

  const fetchBotInfo = async () => {
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/telegram-webhook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: "get_bot_info" }),
        }
      );
      // Bot info is optional, don't fail if it errors
    } catch {
      // ignore
    }
  };

  const startLink = async () => {
    if (!user) return;
    setLinking(true);

    // Generate a random 6-char code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setLinkCode(code);

    // Create or update pending record
    const { data: existing } = await supabase
      .from("telegram_users")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("telegram_users")
        .update({ chat_id: 0, username: `pending:${code}`, is_active: false })
        .eq("id", existing.id);
    } else {
      await supabase.from("telegram_users").insert({
        user_id: user.id,
        chat_id: 0,
        username: `pending:${code}`,
        is_active: false,
      });
    }

    toast.info("שלח את הקוד לבוט בטלגרם");
  };

  const unlink = async () => {
    if (!user) return;
    if (!confirm("לנתק את חשבון הטלגרם?")) return;

    await supabase
      .from("telegram_users")
      .delete()
      .eq("user_id", user.id);

    setLinked(false);
    setLinking(false);
    setLinkCode("");
    toast.success("טלגרם נותק בהצלחה");
  };

  const setupWebhook = async () => {
    try {
      const webhookUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/telegram-webhook`;
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: "setup_webhook", webhook_url: webhookUrl }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Webhook הוגדר בהצלחה!");
      } else {
        toast.error("שגיאה בהגדרת Webhook");
      }
    } catch {
      toast.error("שגיאה בהגדרת Webhook");
    }
  };

  if (loading) return null;

  const botLink = linkCode
    ? `https://t.me/exceltimebot?start=${linkCode}`
    : "https://t.me/exceltimebot";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          בוט טלגרם
          {linked && (
            <Badge variant="default" className="mr-2 text-xs">
              מחובר ✓
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          חבר את חשבון הטלגרם שלך כדי לקבל סיכום יומי, תזכורות למשימות דחופות ולנהל משימות ישירות מטלגרם.
        </p>

        {linked ? (
          <div className="space-y-3">
            <div className="p-3 rounded-lg border bg-muted/30 text-sm">
              ✅ החשבון מחובר! אתה מקבל עדכונים בטלגרם.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={unlink} className="gap-2">
                <Unlink className="h-4 w-4" />
                נתק טלגרם
              </Button>
              <Button variant="outline" size="sm" onClick={setupWebhook} className="gap-2">
                הגדר Webhook
              </Button>
            </div>
          </div>
        ) : linking ? (
          <div className="space-y-3">
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <p className="text-sm font-medium">שלב 1: לחץ על הכפתור לפתיחת הבוט בטלגרם</p>
              <Button asChild variant="default" className="w-full gap-2">
                <a href={botLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  פתח בוט בטלגרם
                </a>
              </Button>
              <p className="text-sm font-medium">שלב 2: לחץ START בטלגרם</p>
              <p className="text-xs text-muted-foreground">
                הבוט יזהה את הקוד שלך אוטומטית ויחבר את החשבון.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={checkLink}>
                  בדוק חיבור
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setLinking(false); setLinkCode(""); }}>
                  ביטול
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={startLink} className="w-full gap-2">
              <Link2 className="h-4 w-4" />
              חבר טלגרם
            </Button>
            <Button variant="outline" size="sm" onClick={setupWebhook} className="w-full gap-2">
              הגדר Webhook (פעם ראשונה)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TelegramSettings;
