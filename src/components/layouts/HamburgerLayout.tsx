import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

interface TabItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface HamburgerLayoutProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  dir?: string;
}

const HamburgerLayout = ({ tabs, activeTab, onTabChange, header, children, dir = "rtl" }: HamburgerLayoutProps) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeTabObj = tabs.find(t => t.id === activeTab);

  return (
    <div className="flex flex-col h-screen bg-background" dir={dir}>
      {/* Fixed top bar */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0 relative z-40">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        {activeTabObj && (() => {
          const Icon = activeTabObj.icon;
          return (
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{activeTabObj.label}</span>
            </div>
          );
        })()}
        <div className="flex-1" />
        {header}
      </header>

      {/* Overlay menu */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setOpen(false)}>
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute top-14 bg-card border-b border-border shadow-xl w-full max-w-sm max-h-[70vh] overflow-y-auto",
              dir === "rtl" ? "right-0 rounded-bl-xl" : "left-0 rounded-br-xl"
            )}
          >
            <nav className="py-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { onTabChange(tab.id); setOpen(false); }}
                    className={cn(
                      "flex items-center gap-3 w-full px-5 py-3 text-sm transition-colors",
                      isActive ? "bg-primary/10 text-primary font-medium border-r-2 border-primary" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default HamburgerLayout;
