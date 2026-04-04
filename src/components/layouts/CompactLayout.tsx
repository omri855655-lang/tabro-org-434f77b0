import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface TabItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  group?: string;
}

interface CompactLayoutProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  dir?: string;
}

const TAB_GROUPS: { id: string; label: string; tabIds: string[] }[] = [
  { id: "main", label: "ראשי", tabIds: ["dashboard", "tasks", "work"] },
  { id: "media", label: "מדיה", tabIds: ["books", "shows", "podcasts", "deeply"] },
  { id: "planning", label: "תכנון", tabIds: ["routine", "planner", "projects", "courses", "challenges"] },
  { id: "life", label: "חיים", tabIds: ["nutrition", "dreams", "shopping", "payments", "notes"] },
  { id: "more", label: "עוד", tabIds: ["sharing", "contact", "settings"] },
];

const CompactLayout = ({ tabs, activeTab, onTabChange, header, children, dir = "rtl" }: CompactLayoutProps) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Find which group the active tab is in
  const activeGroupId = TAB_GROUPS.find(g => g.tabIds.includes(activeTab))?.id;

  // Tabs that don't belong to any group (shared sheets, custom boards)
  const ungroupedTabs = tabs.filter(t => !TAB_GROUPS.some(g => g.tabIds.includes(t.id)));

  return (
    <div className="flex flex-col h-screen bg-background" dir={dir}>
      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
        {header}
      </header>

      {/* Compact nav bar */}
      <div className="border-b border-border bg-card px-4 py-1.5 shrink-0" ref={dropdownRef}>
        <div className="flex items-center gap-1 overflow-x-auto">
          {TAB_GROUPS.map((group) => {
            const groupTabs = tabs.filter(t => group.tabIds.includes(t.id));
            if (groupTabs.length === 0) return null;

            const isGroupActive = activeGroupId === group.id;
            const activeTabInGroup = groupTabs.find(t => t.id === activeTab);

            return (
              <div key={group.id} className="relative">
                <Button
                  variant={isGroupActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("gap-1.5 text-xs h-8", isGroupActive && "font-medium")}
                  onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)}
                >
                  {activeTabInGroup && (() => {
                    const Icon = activeTabInGroup.icon;
                    return <Icon className="h-3.5 w-3.5" />;
                  })()}
                  {activeTabInGroup ? activeTabInGroup.label : group.label}
                  <ChevronDown className={cn("h-3 w-3 transition-transform", openGroup === group.id && "rotate-180")} />
                </Button>

                {openGroup === group.id && (
                  <div className={cn(
                    "absolute top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px]",
                    dir === "rtl" ? "right-0" : "left-0"
                  )}>
                    {groupTabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => { onTabChange(tab.id); setOpenGroup(null); }}
                          className={cn(
                            "flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors",
                            activeTab === tab.id
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped tabs (shared/custom) */}
          {ungroupedTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate">{tab.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default CompactLayout;
