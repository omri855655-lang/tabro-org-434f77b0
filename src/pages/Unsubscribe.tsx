import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/config";
import { useLanguage } from "@/hooks/useLanguage";

const Unsubscribe = () => {
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");
  const copy = isHebrew ? {
    loading: "טוען...",
    title: "ביטול הרשמה למיילים",
    subtitle: "לחצו על הכפתור למטה כדי להפסיק לקבל מיילים מ-Tabro.",
    action: "אישור ביטול הרשמה",
    successTitle: "בוטל בהצלחה ✓",
    successText: "לא תקבלו יותר מיילים מ-Tabro.",
    alreadyTitle: "כבר בוטל",
    alreadyText: "ההרשמה שלכם כבר בוטלה בעבר.",
    invalidTitle: "קישור לא תקין",
    invalidText: "הקישור שגוי או שפג תוקפו.",
    errorTitle: "שגיאה",
    errorText: "אירעה שגיאה. נסו שוב מאוחר יותר.",
  } : {
    loading: "Loading...",
    title: "Unsubscribe from emails",
    subtitle: "Click the button below to stop receiving emails from Tabro.",
    action: "Confirm unsubscribe",
    successTitle: "Unsubscribed successfully ✓",
    successText: "You will no longer receive emails from Tabro.",
    alreadyTitle: "Already unsubscribed",
    alreadyText: "Your subscription was already canceled earlier.",
    invalidTitle: "Invalid link",
    invalidText: "The link is incorrect or has expired.",
    errorTitle: "Error",
    errorText: "Something went wrong. Please try again later.",
  };

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === false && data.reason === "already_unsubscribed") setStatus("already");
        else if (data.valid) setStatus("valid");
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={dir}>
      <div className="max-w-md w-full text-center space-y-6">
        <img src="/tabro-logo.png" alt="Tabro" className="h-20 mx-auto" />
        
        {status === "loading" && (
          <p className="text-muted-foreground animate-pulse">{copy.loading}</p>
        )}

        {status === "valid" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
            <p className="text-muted-foreground">{copy.subtitle}</p>
            <button
              onClick={handleUnsubscribe}
              className="px-6 py-3 rounded-lg text-white font-bold"
              style={{ backgroundColor: "#3B4C8A" }}
            >
              {copy.action}
            </button>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold text-green-600">{copy.successTitle}</h1>
            <p className="text-muted-foreground">{copy.successText}</p>
          </>
        )}

        {status === "already" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">{copy.alreadyTitle}</h1>
            <p className="text-muted-foreground">{copy.alreadyText}</p>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1 className="text-2xl font-bold text-destructive">{copy.invalidTitle}</h1>
            <p className="text-muted-foreground">{copy.invalidText}</p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold text-destructive">{copy.errorTitle}</h1>
            <p className="text-muted-foreground">{copy.errorText}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
