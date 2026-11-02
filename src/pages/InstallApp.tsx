import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

const InstallApp = () => {
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const beforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> });
    };

    const installed = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const isStandalone = typeof window !== "undefined" && 
    (window.matchMedia("(display-mode: standalone)").matches || 
     (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={dir}>
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <img
            src="/icons/tabro-v3-192.png"
            alt="App Icon"
            className="w-24 h-24 mx-auto rounded-2xl shadow-lg"
          />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Tabro
        </h1>
        <p className="text-muted-foreground mb-6">
          {isHebrew ? "התקן את האפליקציה למסך הבית שלך לגישה מהירה וקלה" : "Install the app on your home screen for faster, easier access"}
        </p>

        {isInstalled || isStandalone ? (
          <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-lg p-4">
            {isHebrew ? "✅ האפליקציה מותקנת!" : "✅ The app is installed!"}
          </div>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} size="lg" className="w-full gap-2">
            <Download className="h-5 w-5" />
            {isHebrew ? "התקן אפליקציה" : "Install app"}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className={`bg-muted rounded-lg p-4 ${dir === "rtl" ? "text-right" : "text-left"}`}>
              <h3 className="font-semibold mb-2">{isHebrew ? "📱 באייפון:" : "📱 On iPhone:"}</h3>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li>{isHebrew ? "1. לחץ על כפתור השיתוף (Share)" : "1. Tap the Share button"}</li>
                <li>{isHebrew ? '2. גלול ובחר "הוסף למסך הבית"' : '2. Scroll and choose "Add to Home Screen"'}</li>
                <li>{isHebrew ? '3. לחץ "הוסף"' : '3. Tap "Add"'}</li>
              </ol>
            </div>
            <div className={`bg-muted rounded-lg p-4 ${dir === "rtl" ? "text-right" : "text-left"}`}>
              <h3 className="font-semibold mb-2">{isHebrew ? "📱 באנדרואיד:" : "📱 On Android:"}</h3>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li>{isHebrew ? "1. לחץ על תפריט הדפדפן (⋮)" : "1. Open the browser menu (⋮)"}</li>
                <li>{isHebrew ? '2. בחר "התקן אפליקציה" או "הוסף למסך הבית"' : '2. Choose "Install app" or "Add to Home Screen"'}</li>
              </ol>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="font-semibold text-foreground mb-3">{isHebrew ? "✨ מה תקבל:" : "✨ What you get:"}</h3>
          <ul className={`text-sm text-muted-foreground space-y-2 ${dir === "rtl" ? "text-right" : "text-left"}`}>
            <li>{isHebrew ? "✓ גישה מהירה מהמסך הראשי" : "✓ Quick access from your home screen"}</li>
            <li>{isHebrew ? "✓ הנתונים מסתנכרנים כשיש חיבור לאינטרנט" : "✓ Your data syncs when connected to the internet"}</li>
            <li>{isHebrew ? "✓ חוויה כמו אפליקציה אמיתית" : "✓ Feels like a real app"}</li>
            <li>{isHebrew ? "✓ התראות לאחר אישור וחיבור המכשיר" : "✓ Notifications after permission and device registration"}</li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">{isHebrew ? "אם האייקון הישן לא מתעדכן באייפון, פתח את האתר בספארי, רענן והוסף שוב למסך הבית. אין צורך למחוק קודם את האפליקציה הישנה. לאחר הפתיחה מהאייקון החדש, בדוק וחבר את ההתראות במכשיר." : "If the old iPhone icon does not update, open and refresh the site in Safari, then add it to the Home Screen again. Keep the old app until the new one works, and reconnect notifications in the new installation."}</p>
        </div>
      </div>
    </div>
  );
};

export default InstallApp;
