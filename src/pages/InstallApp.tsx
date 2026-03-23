import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const InstallApp = () => {
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
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
          התקן את האפליקציה למסך הבית שלך לגישה מהירה וקלה
        </p>

        {isInstalled || isStandalone ? (
          <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-lg p-4">
            ✅ האפליקציה מותקנת!
          </div>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} size="lg" className="w-full gap-2">
            <Download className="h-5 w-5" />
            התקן אפליקציה
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 text-right">
              <h3 className="font-semibold mb-2">📱 באייפון:</h3>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li>1. לחץ על כפתור השיתוף (Share)</li>
                <li>2. גלול ובחר "הוסף למסך הבית"</li>
                <li>3. לחץ "הוסף"</li>
              </ol>
            </div>
            <div className="bg-muted rounded-lg p-4 text-right">
              <h3 className="font-semibold mb-2">📱 באנדרואיד:</h3>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li>1. לחץ על תפריט הדפדפן (⋮)</li>
                <li>2. בחר "התקן אפליקציה" או "הוסף למסך הבית"</li>
              </ol>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="font-semibold text-foreground mb-3">✨ מה תקבל:</h3>
          <ul className="text-sm text-muted-foreground space-y-2 text-right">
            <li>✓ גישה מהירה מהמסך הראשי</li>
            <li>✓ עובד גם ללא אינטרנט</li>
            <li>✓ חוויה כמו אפליקציה אמיתית</li>
            <li>✓ התראות על משימות קרובות</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InstallApp;
