import { useRecycleBin, RecycleBinItem } from "@/hooks/useRecycleBin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, RotateCcw, Recycle, Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { format } from "date-fns";

const SOURCE_LABELS: Record<string, string> = {
  books: "ספרים",
  shows: "סדרות",
  podcasts: "פודקאסטים",
  tasks: "משימות",
  projects: "פרויקטים",
  courses: "קורסים",
  custom_board_items: "רשימות",
  shopping_items: "קניות",
  payment_tracking: "תשלומים",
  notes: "פתקים",
};

const RecycleBin = () => {
  const { items, loading, restore, permanentDelete, emptyBin } = useRecycleBin();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Recycle className="h-5 w-5" />
            {t("recycleBin" as any) || "סל מחזור"}
          </CardTitle>
          {items.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("למחוק את כל הפריטים לצמיתות?")) emptyBin();
              }}
            >
              <Trash2 className="h-3 w-3 ml-1" />
              {t("emptyBin" as any) || "רוקן סל"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("recycleBinEmpty" as any) || "סל המחזור ריק"}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {item.item_data?.title || item.item_data?.description || item.item_data?.name || "פריט"}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {SOURCE_LABELS[item.source_table] || item.source_table}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("deletedAt" as any) || "נמחק"}: {format(new Date(item.deleted_at), "dd/MM/yyyy HH:mm")}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restore(item)}
                  className="gap-1 shrink-0"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t("restore" as any) || "שחזר"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive shrink-0"
                  onClick={() => {
                    if (confirm("למחוק לצמיתות?")) permanentDelete(item.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3 text-center">
          {t("recycleBinNote" as any) || "פריטים נמחקים אוטומטית לאחר 7 ימים"}
        </p>
      </CardContent>
    </Card>
  );
};

export default RecycleBin;
