import { useCallback, useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Push = ReturnType<typeof usePushNotifications>;
type Device = { device: number; service: string; registeredOn: string };
type Result = Device & { outcome: "accepted" | "expired" | "rejected" | "retryable"; status: number; reason: string | null };
type Vapid = { configured: boolean; pairValid: boolean; matchesAppKey: boolean; publicKeyFormatValid: boolean; privateKeyFormatValid: boolean };
type ServerStatus = { vapid: Vapid; publicKey: string | null; devices: Device[] };
type TestResponse = { sent?: boolean; error?: string; results?: Result[]; summary?: { devicesFound: number; providerAccepted: number; expired: number; rejected: number; retryable: number } };

const SERVICE: Record<string, string> = { apple: "Apple", google: "Google", mozilla: "Mozilla", microsoft: "Microsoft", other: "שירות אחר" };
const ERRORS: Record<string, string> = {
  no_subscription: "אין מכשיר רשום לחשבון. באייפון: פתח את Tabro מהסמל במסך הבית ולחץ \"חיבור התראות למכשיר\".",
  vapid_missing: "מפתחות ההתראות בשרת אינם מוגדרים, ולכן השרת לא יכול לשלוח Push.",
  vapid_pair_invalid: "מפתחות ההתראות בשרת אינם תואמים זה לזה, ולכן שירותי ה-Push ידחו שליחה.",
  daily_test_limit: "הגעת למגבלה של 5 בדיקות שרת ביום.",
  one_test_per_minute: "אפשר להריץ בדיקת שרת אחת בדקה. נסה שוב בעוד רגע.",
  registration_failed: "לא הצלחנו לרשום מחדש את המכשיר. רענן את האפליקציה ונסה שוב.",
};

const toB64Url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function invoke(action: "status" | "send"): Promise<TestResponse & Partial<ServerStatus>> {
  const { data, error } = await supabase.functions.invoke("push-delivery-test", { body: { action } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try { return await error.context.json(); } catch { /* fall through */ }
    }
    throw new Error("server_unreachable");
  }
  return data;
}

function outcomeText(r: Result): string {
  const name = SERVICE[r.service] || r.service;
  if (r.outcome === "accepted") return `שירות ${name} קיבל את ההודעה. זה עדיין לא מאשר שהיא הוצגה במכשיר.`;
  if (r.outcome === "expired") return `הרישום פג (${name}) והוסר. צריך לחבר את המכשיר מחדש.`;
  if (r.outcome === "retryable") return `שירות ${name} לא זמין כרגע (${r.reason || r.status}). נסה שוב מאוחר יותר.`;
  return `שירות ${name} דחה את ההודעה (${r.reason || r.status}).`;
}

/** Signed-in, user-scoped push diagnostics: device state, server key check, and one explicit server test. */
export default function PushDeliveryTest({ push }: { push: Push }) {
  const { user } = useAuth();
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [browserSub, setBrowserSub] = useState<"none" | "present" | "unknown">("unknown");
  const [keyMatch, setKeyMatch] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<TestResponse | null>(null);

  const permission = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const status = await invoke("status");
      if (status.vapid) setServer({ vapid: status.vapid, publicKey: status.publicKey ?? null, devices: status.devices || [] });
      setServerError(null);
      const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/") : undefined;
      const sub = await reg?.pushManager?.getSubscription();
      setBrowserSub(sub ? "present" : "none");
      const key = sub?.options?.applicationServerKey;
      setKeyMatch(sub && key && status.publicKey ? toB64Url(key) === status.publicKey.replace(/=+$/, "") : null);
    } catch {
      setServerError("לא הצלחנו לבדוק את מצב ההתראות בשרת.");
    }
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh, push.isSubscribed]);

  const runTest = async () => {
    setBusy(true);
    setTest(null);
    try {
      setTest(await invoke("send"));
    } catch {
      setTest({ error: "server_unreachable" });
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  // Explicit re-registration: drop this browser's old subscription, then subscribe with the current key.
  const reRegister = async () => {
    if (!user) return;
    setBusy(true);
    setTest(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", user.id);
        await sub.unsubscribe();
      }
      if (!await push.subscribe()) setTest({ error: "registration_failed" });
    } catch {
      setTest({ error: "registration_failed" });
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const vapidOk = server?.vapid.configured && server.vapid.pairValid && server.vapid.matchesAppKey;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/60 px-3 py-3 text-[11px] text-muted-foreground">
      <p className="text-xs font-medium text-foreground">בדיקת Push מהשרת</p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={permission === "granted" ? "default" : "outline"}>הרשאה במכשיר: {permission === "granted" ? "מאושרת" : permission === "denied" ? "חסומה" : permission === "default" ? "טרם נשאלה" : "לא נתמך"}</Badge>
        <Badge variant={browserSub === "present" ? "default" : "outline"}>רישום בדפדפן הזה: {browserSub === "present" ? "קיים" : browserSub === "none" ? "אין" : "לא ידוע"}</Badge>
        <Badge variant={push.isSubscribed ? "default" : "outline"}>מקושר לחשבון: {push.isSubscribed ? "כן" : "לא"}</Badge>
        <Badge variant="outline">מכשירים רשומים בחשבון: {server ? server.devices.length : "…"}</Badge>
        {server && <Badge variant={vapidOk ? "default" : "destructive"}>מפתחות שרת: {vapidOk ? "תקינים ותואמים" : "בעיה"}</Badge>}
        {/iPhone|iPad/.test(navigator.userAgent) && <Badge variant={standalone ? "default" : "outline"}>{standalone ? "נפתח ממסך הבית" : "נפתח בדפדפן (באייפון נדרש מסך הבית)"}</Badge>}
      </div>
      {permission === "granted" && !push.isSubscribed && <p>יש הרשאה במכשיר, אבל המכשיר הזה לא רשום לחשבון — הרשאה לבדה לא מספיקה לקבלת Push.</p>}
      {keyMatch === false && <p className="text-destructive">הרישום בדפדפן הזה נוצר עם מפתח שונה מזה של השרת. יש לבצע רישום מחדש.</p>}
      {server && !server.vapid.matchesAppKey && <p className="text-destructive">המפתח הציבורי באפליקציה שונה מהמפתח בשרת.</p>}
      {server?.devices.map(d => <p key={d.device}>מכשיר {d.device}: {SERVICE[d.service] || d.service}, נרשם ב-{d.registeredOn || "לא ידוע"}</p>)}
      {serverError && <p className="text-destructive">{serverError}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="min-h-11" disabled={busy || !server?.devices.length} onClick={() => void runTest()}>
          {busy ? "שולח..." : "שליחת בדיקה מהשרת למכשירים שלי"}
        </Button>
        <Button variant="outline" size="sm" className="min-h-11" disabled={busy || !push.isSupported} onClick={() => void reRegister()}>
          רישום מחדש של המכשיר הזה
        </Button>
      </div>
      {test && (
        <div className="space-y-1 rounded-md border border-border px-2 py-2">
          {test.error && <p className="text-destructive">{ERRORS[test.error] || "הבדיקה נכשלה. נסה שוב מאוחר יותר."}</p>}
          {test.results?.map(r => <p key={r.device}>מכשיר {r.device}: {outcomeText(r)}</p>)}
          {test.summary && test.summary.providerAccepted > 0 && <p className="font-medium text-foreground">אם לא הופיעה התראה תוך דקה: בדוק מצב ריכוז, את הגדרות ההתראות של Tabro באייפון, ובצע "רישום מחדש" מתוך האפליקציה במסך הבית.</p>}
        </div>
      )}
      <p>הבדיקה נשלחת רק למכשירים הרשומים לחשבון שלך. "התקבל" פירושו ששירות ה-Push קיבל את ההודעה — לא שהיא הוצגה.</p>
    </div>
  );
}
