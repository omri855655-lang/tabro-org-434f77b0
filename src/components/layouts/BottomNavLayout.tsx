import { useState } from "react";
import { cn } from "@/lib/utils";
import { DashboardTabGroup, DashboardTabItem } from "./dashboardGrouping";

interface BottomNavLayoutProps {
  tabs: DashboardTabItem[];
  groupedTabs?: DashboardTabGroup[];
  groupingMode?: "flat" | "grouped";
  activeTab: string;
  onTabChange: (id: string) => void;
  onReorder?: (newOrder: string[]) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  dir?: string;
}

const BottomNavLayout = ({ tabs, groupedTabs = [], groupingMode = "flat", activeTab, onTabChange, onReorder, header, children, dir = "rtl" }: BottomNavLayoutProps) => {
  // Show max 5 bottom items + "more" trigger
  const MAX_BOTTOM = 5;
  const mainTabs = tabs.slice(0, MAX_BOTTOM);
  const moreTabs = tabs.slice(MAX_BOTTOM);
  const isMoreActive = moreTabs.some(t => t.id === activeTab);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId || !onReorder) return;
    const ids = tabs.map(t => t.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    onReorder(ids);
    setDraggedId(null);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background" dir={dir}>
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
        {header}
      </header>

      <main className="flex-1 min-h-0 overflow-auto pb-28 md:pb-24">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur border-t border-border pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {groupingMode === "grouped" && groupedTabs.length > 0 ? (
          <>
            {openGroup && (
              <div className="mx-auto mb-2 max-w-lg px-3 pt-2">
                <div className="rounded-2xl border border-border bg-popover p-2 shadow-xl">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-foreground">
                      {groupedTabs.find((group) => group.key === openGroup)?.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenGroup(null)}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      סגור
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(groupedTabs.find((group) => group.key === openGroup)?.items || []).map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => { onTabChange(tab.id); setOpenGroup(null); }}
                          className={cn(
                            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                            activeTab === tab.id ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-around min-h-14 max-w-lg mx-auto px-2 pt-1">
              {groupedTabs.map((group) => {
                const isActive = group.items.some((item) => item.id === activeTab);
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setOpenGroup((prev) => prev === group.key ? null : group.key)}
                    className={cn(
                      "flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <div className={cn("h-5 w-5 rounded-full border border-current/30", isActive && "bg-primary/10")} />
                    <span className="max-w-[68px] truncate text-[10px] font-medium">{group.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-around min-h-14 max-w-lg mx-auto px-2 pt-1">
            {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                draggable={!!onReorder}
                onDragStart={() => setDraggedId(tab.id)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={() => handleDrop(tab.id)}
                onDragEnd={() => setDraggedId(null)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[56px] group",
                  isActive ? "text-primary" : "text-muted-foreground",
                  draggedId === tab.id && "opacity-50",
                  onReorder && "cursor-grab active:cursor-grabbing"
                )}
                title={onReorder ? `${tab.label} — אפשר לגרור לשינוי סדר` : tab.label}
              >
                <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                <span className="text-[10px] font-medium truncate max-w-[60px]">{tab.label}</span>
              </button>
            );
          })}
            {moreTabs.length > 0 && (
            <div className="relative group">
              <button
                type="button"
                onClick={() => setMoreOpen((prev) => !prev)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[56px]",
                  isMoreActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-current" />
                  <div className="w-1 h-1 rounded-full bg-current" />
                  <div className="w-1 h-1 rounded-full bg-current" />
                </div>
                <span className="text-[10px] font-medium">עוד</span>
              </button>
              {/* Popup menu */}
              <div className={cn(
                "absolute bottom-full mb-2 bg-popover border border-border rounded-xl shadow-xl py-2 min-w-[200px] max-h-[60vh] overflow-y-auto",
                moreOpen ? "block" : "hidden group-hover:block",
                dir === "rtl" ? "left-0" : "right-0"
              )}>
                {moreTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { onTabChange(tab.id); setMoreOpen(false); }}
                      draggable={!!onReorder}
                      onDragStart={() => setDraggedId(tab.id)}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                      onDrop={() => handleDrop(tab.id)}
                      onDragEnd={() => setDraggedId(null)}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors",
                        activeTab === tab.id ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted",
                        draggedId === tab.id && "opacity-50",
                        onReorder && "cursor-grab active:cursor-grabbing"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        )}
      </nav>
    </div>
  );
};

export default BottomNavLayout;
