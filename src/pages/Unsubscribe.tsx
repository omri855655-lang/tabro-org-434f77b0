import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="max-w-md w-full text-center space-y-6">
        <img src="/tabro-logo.png" alt="Tabro" className="h-20 mx-auto" />
        
        {status === "loading" && (
          <p className="text-muted-foreground animate-pulse">טוען...</p>
        )}

        {status === "valid" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">ביטול הרשמה למיילים</h1>
            <p className="text-muted-foreground">
              לחצו על הכפתור למטה כדי להפסיק לקבל מיילים מ-Tabro.
            </p>
            <button
              onClick={handleUnsubscribe}
              className="px-6 py-3 rounded-lg text-white font-bold"
              style={{ backgroundColor: "#3B4C8A" }}
            >
              אישור ביטול הרשמה
            </button>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold text-green-600">בוטל בהצלחה ✓</h1>
            <p className="text-muted-foreground">לא תקבלו יותר מיילים מ-Tabro.</p>
          </>
        )}

        {status === "already" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">כבר בוטל</h1>
            <p className="text-muted-foreground">ההרשמה שלכם כבר בוטלה בעבר.</p>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1 className="text-2xl font-bold text-destructive">קישור לא תקין</h1>
            <p className="text-muted-foreground">הקישור שגוי או שפג תוקפו.</p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold text-destructive">שגיאה</h1>
            <p className="text-muted-foreground">אירעה שגיאה. נסו שוב מאוחר יותר.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
