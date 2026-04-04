import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TabItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface SplitViewLayoutProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  dir?: string;
}

const SplitViewLayout = ({ tabs, activeTab, onTabChange, header, children, dir = "rtl" }: SplitViewLayoutProps) => {
  const isRtl = dir === "rtl";

  return (
    <div className="flex flex-col h-screen bg-background" dir={dir}>
      <header className="h-12 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
        {header}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left/Right navigation panel */}
        <aside className={cn(
          "w-52 shrink-0 border-border bg-muted/30",
          isRtl ? "border-l" : "border-r"
        )}>
          <ScrollArea className="h-full">
            <nav className="py-2 px-1.5 space-y-0.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </ScrollArea>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SplitViewLayout;
