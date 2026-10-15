import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useLanguage } from '@/hooks/useLanguage';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelLeftClose, PanelLeft, GripVertical, ChevronDown, ChevronUp, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardTabGroup, DashboardTabItem } from "./dashboardGrouping";

interface SidebarLayoutProps {
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

const SidebarLayout = ({ tabs, groupedTabs = [], groupingMode = "flat", activeTab, onTabChange, onReorder, header, children, dir = "rtl" }: SidebarLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang } = useLanguage();
  const navigation = {
    he: ['פתיחת תפריט הניווט', 'ניווט', 'בחר דשבורד כדי לעבור אליו'],
    en: ['Open navigation menu', 'Navigation', 'Choose a dashboard'],
    es: ['Abrir menú', 'Navegación', 'Elige un panel'],
    zh: ['打开导航菜单', '导航', '选择仪表板'],
    ar: ['فتح قائمة التنقل', 'التنقل', 'اختر لوحة'],
    ru: ['Открыть меню', 'Навигация', 'Выберите панель'],
  }[lang];
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isRtl = dir === "rtl";

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
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
    const btn = (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        draggable={!!onReorder}
        onDragStart={() => handleDragStart(tab.id)}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(tab.id)}
        onDragEnd={() => setDraggedId(null)}
        className={cn(
          "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors w-full text-start group",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          draggedId === tab.id && "opacity-50",
          onReorder && "cursor-grab active:cursor-grabbing"
        )}
      >
        {onReorder && !collapsed && <GripVertical className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />}
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
  };

  return (
    <div className="flex h-dvh bg-background" dir={dir}>
      <aside
        className={cn(
          "hidden flex-col border-border bg-card transition-all duration-200 shrink-0 md:flex",
          isRtl ? "border-l" : "border-r",
          collapsed ? "w-14" : "w-56"
        )}
      >
        <div className={cn("flex items-center h-14 border-b border-border px-2", collapsed ? "justify-center" : "justify-between px-3")}>
          {!collapsed && <span className="text-sm font-bold text-foreground truncate">Tabro</span>}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 py-2">
          <nav className="flex flex-col gap-0.5 px-2">
            {groupingMode === "grouped" && groupedTabs.length > 0 && !collapsed ? (
              groupedTabs.map((group) => {
                const isOpen = openGroups[group.key] ?? true;
                return (
                  <div key={group.key} className="mb-2 rounded-lg border border-border/50 bg-background/60 p-1">
                    <button
                      type="button"
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !isOpen }))}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground"
                    >
                      <span className="truncate">{group.label}</span>
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {isOpen && <div className="mt-1 flex flex-col gap-0.5">{group.items.map(renderTabButton)}</div>}
                  </div>
                );
              })
            ) : (
              tabs.map(renderTabButton)
            )}
          </nav>
        </ScrollArea>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center gap-1 px-2 sm:gap-3 sm:px-4 border-b border-border bg-card shrink-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 md:hidden" aria-label={navigation[0]}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={isRtl ? 'right' : 'left'} dir={dir} className="w-[min(85vw,320px)] p-0">
              <SheetHeader className="border-b p-5">
                <SheetTitle>Tabro · {navigation[1]}</SheetTitle>
                <SheetDescription className="sr-only">{navigation[2]}</SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100dvh-72px)]">
                <nav aria-label={navigation[1]} className="grid gap-1 p-3">
                  {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <Button key={tab.id} variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                        className="h-auto justify-start gap-3 whitespace-normal py-3 text-start"
                        aria-current={activeTab === tab.id ? 'page' : undefined}
                        onClick={() => { onTabChange(tab.id); setMobileOpen(false); }}>
                        <Icon className="h-4 w-4 shrink-0" />{tab.label}
                      </Button>
                    );
                  })}
                </nav>
              </ScrollArea>
            </SheetContent>
          </Sheet>
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
