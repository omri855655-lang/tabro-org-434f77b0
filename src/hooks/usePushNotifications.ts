import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ensurePushWorker } from "@/lib/registerPushWorker";
import { readPushEnvironment, withPushTimeout } from "@/lib/pushEnvironment";

const VAPID_PUBLIC_KEY = "BDA-BXp_JflLBc2rOgpr5AYyPtiqLKvzeJsoRoahBYItep2e_pU5la9Y38fcPF7M2MMuMDEQom2VjHbcAKZFU8I";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getOrRegisterSW(): Promise<ServiceWorkerRegistration> {
  const reg = await withPushTimeout(ensurePushWorker());
  await withPushTimeout(navigator.serviceWorker.ready);
  return reg;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    const check = async () => {
      setIsSubscribed(false);
      if (!supported || !user) { setLoading(false); return; }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) return;
        // Browser permission alone does not mean this account can receive pushes.
        const { data, error } = await supabase.from("push_subscriptions").select("id")
          .eq("user_id", user.id).eq("endpoint", subscription.endpoint).maybeSingle();
        if (error) throw error;
        if (!cancelled) setIsSubscribed(Boolean(data) && Notification.permission === "granted");
      } catch {
        if (!cancelled) setIsSubscribed(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void check();
    window.addEventListener("tabro-push-changed", check);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      window.removeEventListener("tabro-push-changed", check);
      window.removeEventListener("focus", check);
    };
  }, [user?.id]);

  const subscribe = useCallback(async () => {
    setSetupError(null);
    const fail = (message: string) => { setSetupError(message); toast.error(message); return false; };
    if (!user) return fail("יש להתחבר לחשבון Tabro לפני חיבור ההתראות.");
    const environment = readPushEnvironment();
    if (environment.reason === "home-screen") return fail("באייפון יש לפתוח את Tabro מהסמל במסך הבית, לא מתוך Safari או דפדפן אחר. לאחר הפתיחה לחץ שוב על חיבור התראות.");
    if (environment.reason === "insecure") return fail("התראות דורשות חיבור מאובטח HTTPS.");
    if (environment.reason === "unsupported") return fail("ההתראות אינן זמינות בחלון הזה. באייפון פתח מהסמל במסך הבית; אם כבר פתחת כך, עדכן את iOS ונסה לרענן את האפליקציה.");
    setLoading(true);
    try {
      if (!window.isSecureContext) {
        toast.error("התראות Push דורשות חיבור מאובטח (HTTPS) או אפליקציה מותקנת");
        return false;
      }

      if (Notification.permission === "denied") return fail("הרשאת ההתראות חסומה. באייפון פתח הגדרות → התראות → Tabro ואפשר התראות, ואז חזור לחיבור המכשיר.");
      // Keep the permission request in the direct button gesture, before any network or worker await.
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        return fail("לא ניתנה הרשאת התראות. לחץ שוב על חיבור התראות ואשר את הבקשה של המכשיר.");
      }

      let registration: ServiceWorkerRegistration;
      try {
        registration = await getOrRegisterSW();
      } catch (swErr: any) {
        console.error("SW registration error:", swErr);
        return fail("שירות ההתראות במכשיר לא סיים להיטען. רענן את האפליקציה ממסך הבית ונסה שוב.");
      }

      // Wait for SW to be active
      if (registration.installing || registration.waiting) {
        await new Promise<void>((resolve) => {
          const sw = registration.installing || registration.waiting;
          if (!sw) { resolve(); return; }
          sw.addEventListener("statechange", () => {
            if (sw.state === "activated") resolve();
          });
          // Timeout after 5s
          setTimeout(resolve, 5000);
        });
      }

      const pm = (registration as any).pushManager;
      if (!pm) {
        toast.error("הדפדפן לא תומך בהתראות Push");
        return false;
      }

      const existingSubscription = await pm.getSubscription();
      if (existingSubscription) {
        const existingJson = existingSubscription.toJSON();
        if (existingJson.endpoint && existingJson.keys?.p256dh && existingJson.keys?.auth) {
          const { error } = await supabase.from("push_subscriptions").upsert(
            {
              user_id: user.id,
              endpoint: existingJson.endpoint,
              p256dh: existingJson.keys.p256dh,
              auth: existingJson.keys.auth,
            },
            { onConflict: "endpoint" }
          );

          if (error) throw error;

          setIsSubscribed(true);
          window.dispatchEvent(new Event("tabro-push-changed"));
          toast.success("התראות push כבר היו פעילות וחוברו מחדש לחשבון שלך");
          return true;
        }
      }

      let subscription;
      try {
        subscription = await pm.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } catch (pushErr: any) {
        setSetupError("המכשיר לא הצליח להירשם לשירות ההתראות. פתח את האפליקציה ממסך הבית, בדוק הרשאות וחיבור לאינטרנט ונסה שוב.");
        console.error("PushManager.subscribe error:", pushErr);
        const isBrave = !!(navigator as any).brave;
        const message = String(pushErr?.message || "");
        const name = String(pushErr?.name || "");
        if (message.includes("push service") || message.includes("AbortError") || name === "AbortError") {
          if (isBrave) {
            toast.error("ב-Brave שירות ה-Push לא זמין כרגע. אם Shields כבר כבוי, נסה לרענן, לפתוח חלון פרטי, או להתקין את האתר למסך הבית ואז לנסות שוב.");
          } else {
            toast.error("שגיאת push service - נסה להתקין את האפליקציה (PWA) או להשתמש ב-Chrome/Brave/Edge");
          }
        } else if (name === "NotAllowedError") {
          toast.error("הדפדפן חסם את הרשמת ה-Push. בדוק הרשאות אתר ונסה שוב.");
        } else if (name === "NotSupportedError") {
          toast.error("הדפדפן או סביבת העבודה הזו לא תומכים כרגע ב-Push.");
        } else {
          toast.error(`שגיאה בהרשמה ל-Push: ${message || "נסה שוב"}`);
        }
        return false;
      }

      const subJson = subscription.toJSON();

      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Missing subscription keys");
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        { onConflict: "endpoint" }
      );

      if (error) throw error;

      setIsSubscribed(true);
      window.dispatchEvent(new Event("tabro-push-changed"));
      toast.success("המכשיר נרשם לקבלת התראות לחשבון שלך");
      return true;
    } catch (e: any) {
      console.error("Push subscription error:", e);
      return fail("חיבור המכשיר להתראות לא הושלם. בדוק חיבור לאינטרנט ונסה שוב; לא שונו העדפות השליחה שלך.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;

    try {
      const registration = await getOrRegisterSW();
      const subscription = await (registration as any).pushManager?.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint)
          .eq("user_id", user.id);
      }
      setIsSubscribed(false);
      window.dispatchEvent(new Event("tabro-push-changed"));
      toast.success("התראות push כובו");
    } catch (e: any) {
      console.error("Error unsubscribing:", e);
      toast.error("שגיאה בכיבוי התראות");
    }
  }, [user]);

  const testLocalNotification = async () => {
    try {
      if (!isSupported || Notification.permission !== "granted") {
        toast.error("יש לחבר ולאשר התראות במכשיר קודם");
        return;
      }
      const registration = await getOrRegisterSW();
      await registration.showNotification("Tabro: בדיקת התראות במכשיר", {
        body: "זו בדיקה מקומית בלבד, לא בדיקת שליחה מהשרת.",
        tag: "tabro-local-test", icon: "/icons/tabro-v4-192.png", data: { url: "/personal" },
      });
      toast.info("בקשת תצוגה נשלחה למכשיר. אם לא הופיעה, בדוק מצב ריכוז והרשאות התראות.");
    } catch {
      toast.error("המכשיר לא הצליח להציג התראה. בדוק את הרשאות האתר בהגדרות המכשיר.");
    }
  };

  return { isSubscribed, isSupported, loading, setupError, subscribe, unsubscribe, testLocalNotification };
}
