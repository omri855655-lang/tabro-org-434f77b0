import { cn } from "@/lib/utils";
import { DashboardTabGroup, DashboardTabItem } from "./dashboardGrouping";

interface DashboardCardsLayoutProps {
  tabs: DashboardTabItem[];
  groupedTabs?: DashboardTabGroup[];
  groupingMode?: "flat" | "grouped";
  activeTab: string;
  onTabChange: (id: string) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  dir?: string;
}

const DashboardCardsLayout = ({ tabs, groupedTabs = [], groupingMode = "flat", activeTab, onTabChange, header, children, dir = "rtl" }: DashboardCardsLayoutProps) => {
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
          {groupingMode === "grouped" && groupedTabs.length > 0 ? (
            <div className="mx-auto flex max-w-6xl flex-col gap-5">
              {groupedTabs.map((group) => (
                <section key={group.key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                    <span className="text-xs text-muted-foreground">{group.items.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {group.items.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => onTabChange(tab.id)}
                          className={cn(
                            "flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-md group"
                          )}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <span className="text-center text-xs font-medium leading-tight">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
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
          )}
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
