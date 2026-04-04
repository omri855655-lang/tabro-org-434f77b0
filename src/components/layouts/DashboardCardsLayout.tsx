import { cn } from "@/lib/utils";

interface TabItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface DashboardCardsLayoutProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  dir?: string;
}

const DashboardCardsLayout = ({ tabs, activeTab, onTabChange, header, children, dir = "rtl" }: DashboardCardsLayoutProps) => {
  // Show dashboard cards when on "dashboard" or first tab, otherwise show content
  const showingCards = activeTab === "dashboard";

  return (
    <div className="flex flex-col h-screen bg-background" dir={dir}>
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
        {header}
        {!showingCards && (
          <button
            onClick={() => onTabChange("dashboard")}
            className="text-xs text-primary hover:underline mr-auto"
          >
            חזור לדשבורד
          </button>
        )}
      </header>

      {showingCards ? (
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-5xl mx-auto">
            {tabs.filter(t => t.id !== "dashboard").map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-card",
                    "hover:bg-primary/5 hover:border-primary/30 hover:shadow-md transition-all",
                    "text-foreground group cursor-pointer min-h-[100px]"
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <main className="flex-1 min-h-0 overflow-auto">
          {children}
        </main>
      )}
    </div>
  );
};

export default DashboardCardsLayout;
