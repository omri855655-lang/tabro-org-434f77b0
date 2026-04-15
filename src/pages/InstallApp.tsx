import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

const InstallApp = () => {
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if app is already installed
  if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });
  }

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
     (window.navigator as any).standalone === true);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={dir}>
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <img
            src="/pwa-192x192.png"
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
            <li>{isHebrew ? "✓ עובד גם ללא אינטרנט" : "✓ Works offline too"}</li>
            <li>{isHebrew ? "✓ חוויה כמו אפליקציה אמיתית" : "✓ Feels like a real app"}</li>
            <li>{isHebrew ? "✓ התראות על משימות קרובות" : "✓ Reminders for upcoming tasks"}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InstallApp;
