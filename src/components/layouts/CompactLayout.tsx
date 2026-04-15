import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { DashboardTabGroup, DashboardTabItem } from "./dashboardGrouping";

interface CompactLayoutProps {
  tabs: DashboardTabItem[];
  groupedTabs?: DashboardTabGroup[];
  groupingMode?: "flat" | "grouped";
  activeTab: string;
  onTabChange: (id: string) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  dir?: string;
}

const TAB_GROUPS: { id: string; label: string; tabIds: string[] }[] = [
  { id: "main", label: "ראשי", tabIds: ["dashboard", "tasks", "work"] },
  { id: "media", label: "מדיה", tabIds: ["books", "shows", "podcasts", "zoneflow"] },
  { id: "planning", label: "תכנון", tabIds: ["routine", "planner", "projects", "courses", "challenges"] },
  { id: "life", label: "חיים", tabIds: ["nutrition", "dreams", "shopping", "payments", "notes"] },
  { id: "more", label: "עוד", tabIds: ["sharing", "contact", "settings"] },
];

const CompactLayout = ({ tabs, groupedTabs = [], groupingMode = "flat", activeTab, onTabChange, header, children, dir = "rtl" }: CompactLayoutProps) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!openGroup) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const dropdownEl = document.getElementById("compact-dropdown-portal");
      const btn = buttonRefs.current[openGroup];
      if (dropdownEl?.contains(target) || btn?.contains(target)) return;
      setOpenGroup(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openGroup]);

  useEffect(() => {
    if (openGroup) {
      const btn = buttonRefs.current[openGroup];
      if (btn) {
        const rect = btn.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 4,
          left: dir === "rtl" ? rect.right : rect.left,
        });
      }
    } else {
      setDropdownPos(null);
    }
  }, [openGroup, dir]);

  const activeGroupId = groupingMode === "grouped"
    ? groupedTabs.find((group) => group.items.some((item) => item.id === activeTab))?.key
    : TAB_GROUPS.find(g => g.tabIds.includes(activeTab))?.id;
  const ungroupedTabs = groupingMode === "grouped"
    ? []
    : tabs.filter(t => !TAB_GROUPS.some(g => g.tabIds.includes(t.id)));

  const openGroupTabs = groupingMode === "grouped"
    ? groupedTabs.find((group) => group.key === openGroup)?.items || []
    : openGroup
      ? tabs.filter(t => TAB_GROUPS.find(g => g.id === openGroup)?.tabIds.includes(t.id))
      : [];

  return (
    <div className="flex flex-col h-screen bg-background" dir={dir}>
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
        {header}
      </header>

      <div className="border-b border-border bg-card px-4 py-1.5 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TAB_GROUPS.map((group) => {
            if (groupingMode === "grouped") return null;
            const groupTabs = tabs.filter(t => group.tabIds.includes(t.id));
            if (groupTabs.length === 0) return null;

            const isGroupActive = activeGroupId === group.id;
            const activeTabInGroup = groupTabs.find(t => t.id === activeTab);

            return (
              <Button
                key={group.id}
                ref={(el) => { buttonRefs.current[group.id] = el; }}
                variant={isGroupActive ? "secondary" : "ghost"}
                size="sm"
                className={cn("gap-1.5 text-xs h-8 shrink-0", isGroupActive && "font-medium")}
                onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)}
              >
                {activeTabInGroup && (() => {
                  const Icon = activeTabInGroup.icon;
                  return <Icon className="h-3.5 w-3.5" />;
                })()}
                {activeTabInGroup ? activeTabInGroup.label : group.label}
                <ChevronDown className={cn("h-3 w-3 transition-transform", openGroup === group.id && "rotate-180")} />
              </Button>
            );
          })}

          {groupingMode === "grouped" && groupedTabs.map((group) => {
            const isGroupActive = activeGroupId === group.key;
            const activeTabInGroup = group.items.find((tab) => tab.id === activeTab);

            return (
              <Button
                key={group.key}
                ref={(el) => { buttonRefs.current[group.key] = el; }}
                variant={isGroupActive ? "secondary" : "ghost"}
                size="sm"
                className={cn("gap-1.5 text-xs h-8 shrink-0", isGroupActive && "font-medium")}
                onClick={() => setOpenGroup(openGroup === group.key ? null : group.key)}
              >
                {activeTabInGroup && (() => {
                  const Icon = activeTabInGroup.icon;
                  return <Icon className="h-3.5 w-3.5" />;
                })()}
                {activeTabInGroup ? activeTabInGroup.label : group.label}
                <ChevronDown className={cn("h-3 w-3 transition-transform", openGroup === group.key && "rotate-180")} />
              </Button>
            );
          })}

          {ungroupedTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs h-8 shrink-0"
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate">{tab.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Dropdown portal */}
      {openGroup && dropdownPos && createPortal(
        <div
          id="compact-dropdown-portal"
          className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
          style={{
            top: dropdownPos.top,
            ...(dir === "rtl"
              ? { right: window.innerWidth - dropdownPos.left }
              : { left: dropdownPos.left }),
          }}
        >
          {openGroupTabs.map((tab) => {
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
        </div>,
        document.body
      )}

      <main className="flex-1 min-h-0 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default CompactLayout;
