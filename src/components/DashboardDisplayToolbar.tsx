import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette, LayoutGrid, List, AlignJustify, CreditCard, Grid3X3 } from "lucide-react";
import { BOARD_THEMES } from "@/hooks/useCustomBoards";
import type { DashboardViewMode } from "@/hooks/useDashboardDisplay";
import { useLanguage } from "@/hooks/useLanguage";

interface DashboardDisplayToolbarProps {
  viewMode: DashboardViewMode;
  themeKey: string;
  onViewModeChange: (mode: DashboardViewMode) => void;
  onThemeChange: (theme: string) => void;
}

const DashboardDisplayToolbar = ({
  viewMode,
  themeKey,
  onViewModeChange,
  onThemeChange,
}: DashboardDisplayToolbarProps) => {
  const { t } = useLanguage();

  const VIEW_MODES: { mode: DashboardViewMode; icon: typeof List; labelKey: string }[] = [
    { mode: "table", icon: AlignJustify, labelKey: "viewTable" },
    { mode: "kanban", icon: LayoutGrid, labelKey: "viewKanban" },
    { mode: "list", icon: List, labelKey: "viewList" },
    { mode: "cards", icon: CreditCard, labelKey: "viewCards" },
    { mode: "compact", icon: Grid3X3, labelKey: "viewCompact" },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Theme selector */}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
            <Palette className="h-3.5 w-3.5" />
            {t("design" as any)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 max-h-[300px] overflow-y-auto" align="end">
          <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">{t("chooseDesign" as any)}</p>
          {BOARD_THEMES.map((th) => (
            <button
              key={th.value}
              onClick={() => onThemeChange(th.value)}
              className={`w-full text-right px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                themeKey === th.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted"
              }`}
            >
              <span>{th.label}</span>
              <span className="text-xs text-muted-foreground">{th.description}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* View mode selector */}
      <div className="flex gap-0.5 border rounded-lg p-0.5">
        {VIEW_MODES.map(({ mode, icon: Icon, labelKey }) => (
          <Button
            key={mode}
            size="sm"
            variant={viewMode === mode ? "default" : "ghost"}
            className="h-7 gap-1 text-xs"
            onClick={() => onViewModeChange(mode)}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(labelKey as any)}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default DashboardDisplayToolbar;
