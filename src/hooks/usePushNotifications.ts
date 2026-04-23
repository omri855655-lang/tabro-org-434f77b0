import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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
  // Check for existing registration first
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) {
    await navigator.serviceWorker.ready;
    return existing;
  }

  // Register our push SW as fallback
  const reg = await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
  await reg.update();
  await navigator.serviceWorker.ready;
  return reg;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (supported && user) {
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await getOrRegisterSW();
      const subscription = await (registration as any).pushManager?.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.error("Error checking push subscription:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return false;

    try {
      if (!window.isSecureContext) {
        toast.error("התראות Push דורשות חיבור מאובטח (HTTPS) או אפליקציה מותקנת");
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("יש לאשר התראות בדפדפן");
        return false;
      }

      let registration: ServiceWorkerRegistration;
      try {
        registration = await getOrRegisterSW();
      } catch (swErr: any) {
        console.error("SW registration error:", swErr);
        toast.error("שגיאה ברישום Service Worker - נסה לפרסם ולבדוק מהאפליקציה המותקנת");
        return false;
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
      toast.success("התראות push הופעלו! תקבל תזכורות 5 דקות לפני כל אירוע");
      return true;
    } catch (e: any) {
      console.error("Push subscription error:", e);
      toast.error(`שגיאה בהפעלת התראות: ${e.message || "נסה שוב"}`);
      return false;
    }
  }, [user, isSupported]);

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
      toast.success("התראות push כובו");
    } catch (e: any) {
      console.error("Error unsubscribing:", e);
      toast.error("שגיאה בכיבוי התראות");
    }
  }, [user]);

  return { isSubscribed, isSupported, loading, subscribe, unsubscribe };
}
