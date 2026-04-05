import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Plus, Minus, Eye, MousePointer, Link2, Pause } from 'lucide-react';

const STORAGE_KEY = 'a11y-prefs';

interface A11yPrefs {
  fontSize: number;
  highContrast: boolean;
  disableAnimations: boolean;
  bigCursor: boolean;
  highlightLinks: boolean;
}

const defaultPrefs: A11yPrefs = {
  fontSize: 100,
  highContrast: false,
  disableAnimations: false,
  bigCursor: false,
  highlightLinks: false,
};

const AccessibilityWidget = () => {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs;
    } catch {
      return defaultPrefs;
    }
  });

  const applyPrefs = useCallback((p: A11yPrefs) => {
    const root = document.documentElement;
    root.style.fontSize = `${p.fontSize}%`;
    root.classList.toggle('a11y-high-contrast', p.highContrast);
    root.classList.toggle('a11y-no-animations', p.disableAnimations);
    root.classList.toggle('a11y-big-cursor', p.bigCursor);
    root.classList.toggle('a11y-highlight-links', p.highlightLinks);
  }, []);

  useEffect(() => {
    applyPrefs(prefs);
  }, [prefs, applyPrefs]);

  const update = (partial: Partial<A11yPrefs>) => {
    const next = { ...prefs, ...partial };
    setPrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const reset = () => {
    setPrefs(defaultPrefs);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 left-4 z-[9999] w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="תפריט נגישות"
        title="נגישות"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <circle cx="12" cy="4.5" r="2.5" />
          <path d="M12 7v4m0 0l-4 7m4-7l4 7" />
          <path d="M6 11h12" />
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 left-4 z-[9999] w-72 rounded-xl border bg-card shadow-2xl p-4 space-y-3" dir="rtl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">הגדרות נגישות</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
          </div>

          {/* Font size */}
          <div className="flex items-center justify-between">
            <span className="text-sm">גודל גופן</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => update({ fontSize: Math.max(80, prefs.fontSize - 10) })} aria-label="הקטן גופן">
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-xs w-10 text-center font-medium">{prefs.fontSize}%</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => update({ fontSize: Math.min(150, prefs.fontSize + 10) })} aria-label="הגדל גופן">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* High contrast */}
          <button
            onClick={() => update({ highContrast: !prefs.highContrast })}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${prefs.highContrast ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
          >
            <Eye className="h-4 w-4" />
            <span>ניגודיות גבוהה</span>
          </button>

          {/* Disable animations */}
          <button
            onClick={() => update({ disableAnimations: !prefs.disableAnimations })}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${prefs.disableAnimations ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
          >
            <Pause className="h-4 w-4" />
            <span>השבת אנימציות</span>
          </button>

          {/* Big cursor */}
          <button
            onClick={() => update({ bigCursor: !prefs.bigCursor })}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${prefs.bigCursor ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
          >
            <MousePointer className="h-4 w-4" />
            <span>סמן מוגדל</span>
          </button>

          {/* Highlight links */}
          <button
            onClick={() => update({ highlightLinks: !prefs.highlightLinks })}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${prefs.highlightLinks ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
          >
            <Link2 className="h-4 w-4" />
            <span>הדגש קישורים</span>
          </button>

          <div className="flex items-center justify-between pt-1 border-t">
            <Button variant="ghost" size="sm" className="text-xs" onClick={reset}>איפוס</Button>
            <a href="/accessibility" className="text-xs text-primary hover:underline">הצהרת נגישות</a>
          </div>
        </div>
      )}
    </>
  );
};

export default AccessibilityWidget;
