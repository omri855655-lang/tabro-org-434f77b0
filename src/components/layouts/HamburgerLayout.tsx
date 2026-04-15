import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { DashboardTabGroup, DashboardTabItem } from "./dashboardGrouping";

interface HamburgerLayoutProps {
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

const HamburgerLayout = ({ tabs, groupedTabs = [], groupingMode = "flat", activeTab, onTabChange, onReorder, header, children, dir = "rtl" }: HamburgerLayoutProps) => {
  const [open, setOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
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

  const renderTabButton = (tab: DashboardTabItem) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => { onTabChange(tab.id); setOpen(false); }}
        draggable={!!onReorder}
        onDragStart={() => setDraggedId(tab.id)}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDrop={() => handleDrop(tab.id)}
        onDragEnd={() => setDraggedId(null)}
        className={cn(
          "flex items-center gap-3 w-full px-5 py-3 text-sm transition-colors group",
          isActive ? "bg-primary/10 text-primary font-medium border-r-2 border-primary" : "text-foreground hover:bg-muted",
          draggedId === tab.id && "opacity-50",
          onReorder && "cursor-grab active:cursor-grabbing"
        )}
      >
        {onReorder && <GripVertical className="h-3 w-3 shrink-0 opacity-30 group-hover:opacity-60" />}
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{tab.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background" dir={dir}>
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
              {groupingMode === "grouped" && groupedTabs.length > 0 ? (
                groupedTabs.map((group) => {
                  const isOpen = openGroups[group.key] ?? true;
                  return (
                    <div key={group.key} className="border-b border-border/60 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !isOpen }))}
                        className="flex w-full items-center justify-between px-5 py-3 text-xs font-semibold text-muted-foreground"
                      >
                        <span>{group.label}</span>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {isOpen && <div className="pb-2">{group.items.map(renderTabButton)}</div>}
                    </div>
                  );
                })
              ) : (
                tabs.map(renderTabButton)
              )}
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
