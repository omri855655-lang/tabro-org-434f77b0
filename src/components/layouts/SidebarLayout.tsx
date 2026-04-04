import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface SidebarLayoutProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  dir?: string;
}

const SidebarLayout = ({ tabs, activeTab, onTabChange, header, children, dir = "rtl" }: SidebarLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const isRtl = dir === "rtl";

  return (
    <div className="flex h-screen bg-background" dir={dir}>
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-border bg-card transition-all duration-200 shrink-0",
          isRtl ? "border-l" : "border-r",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Sidebar header */}
        <div className={cn("flex items-center h-14 border-b border-border px-2", collapsed ? "justify-center" : "justify-between px-3")}>
          {!collapsed && <span className="text-sm font-bold text-foreground truncate">Tabro</span>}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        {/* Nav items */}
        <ScrollArea className="flex-1 py-2">
          <nav className="flex flex-col gap-0.5 px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const btn = (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors w-full text-start",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{tab.label}</span>}
                </button>
              );

              if (collapsed) {
                return (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side={isRtl ? "left" : "right"}>{tab.label}</TooltipContent>
                  </Tooltip>
                );
              }
              return btn;
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
          {header}
        </header>
        <main className="flex-1 min-h-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SidebarLayout;
