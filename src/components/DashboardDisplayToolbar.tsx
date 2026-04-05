import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette, LayoutGrid, List, AlignJustify, CreditCard, Grid3X3 } from "lucide-react";
import { BOARD_THEMES } from "@/hooks/useCustomBoards";
import type { DashboardViewMode } from "@/hooks/useDashboardDisplay";

interface DashboardDisplayToolbarProps {
  viewMode: DashboardViewMode;
  themeKey: string;
  onViewModeChange: (mode: DashboardViewMode) => void;
  onThemeChange: (theme: string) => void;
}

const VIEW_MODES: { mode: DashboardViewMode; icon: typeof List; label: string }[] = [
  { mode: "table", icon: AlignJustify, label: "טבלה" },
  { mode: "kanban", icon: LayoutGrid, label: "קנבן" },
  { mode: "list", icon: List, label: "רשימה" },
  { mode: "cards", icon: CreditCard, label: "כרטיסים" },
  { mode: "compact", icon: Grid3X3, label: "קומפקט" },
];

const DashboardDisplayToolbar = ({
  viewMode,
  themeKey,
  onViewModeChange,
  onThemeChange,
}: DashboardDisplayToolbarProps) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Theme selector */}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
            <Palette className="h-3.5 w-3.5" />
            עיצוב
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 max-h-[300px] overflow-y-auto" align="end">
          <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">בחר עיצוב</p>
          {BOARD_THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => onThemeChange(t.value)}
              className={`w-full text-right px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                themeKey === t.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted"
              }`}
            >
              <span>{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.description}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* View mode selector */}
      <div className="flex gap-0.5 border rounded-lg p-0.5">
        {VIEW_MODES.map(({ mode, icon: Icon, label }) => (
          <Button
            key={mode}
            size="sm"
            variant={viewMode === mode ? "default" : "ghost"}
            className="h-7 gap-1 text-xs"
            onClick={() => onViewModeChange(mode)}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default DashboardDisplayToolbar;
