import { useDashboardDisplay } from "@/hooks/useDashboardDisplay";
import { useLanguage } from "@/hooks/useLanguage";
import type { DashboardViewMode } from "@/lib/responsiveWorkspace";

export function BoardViewPicker({ boardId, statusCount }: { boardId: string; statusCount: number }) {
  const { lang } = useLanguage();
  const he = lang === "he";
  const { viewMode, setViewMode } = useDashboardDisplay(`custom-board:${boardId}`, undefined, statusCount >= 3 ? "kanban" : "table");
  const views: [DashboardViewMode, string, string][] = [
    ["kanban", "קנבן", "Kanban"], ["table", "טבלה", "Table"],
    ["list", "רשימה", "List"], ["cards", "כרטיסים", "Cards"],
    ["timeline", "ציר זמן", "Timeline"], ["compact", "קומפקטי", "Compact"],
  ];
  return <label className="grid gap-1 text-xs text-muted-foreground">
    {he ? "תצוגת פתיחה" : "Default view"}
    <select value={viewMode} onChange={event => setViewMode(event.target.value as DashboardViewMode)} className="rounded-md border bg-background px-2 py-1.5 text-foreground">
      {views.map(([mode, hebrew, english]) => <option key={mode} value={mode}>{he ? hebrew : english}</option>)}
    </select>
  </label>;
}
