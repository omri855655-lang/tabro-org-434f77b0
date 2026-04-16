import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";

interface Sheet {
  id: string;
  name: string;
}

interface SheetTabsProps {
  sheets: Sheet[];
  activeSheet: string;
  onSelectSheet: (id: string) => void;
  onAddSheet: () => void;
  onDeleteSheet: (id: string) => void;
  onRenameSheet: (id: string, name: string) => void;
}

const SheetTabs = ({
  sheets,
  activeSheet,
  onSelectSheet,
  onAddSheet,
  onDeleteSheet,
  onRenameSheet,
}: SheetTabsProps) => {
  const { dir } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleDoubleClick = (sheet: Sheet) => {
    setEditingId(sheet.id);
    setEditValue(sheet.name);
  };

  const handleBlur = () => {
    if (editingId && editValue.trim()) {
      onRenameSheet(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  return (
    <div className="flex items-center gap-1 p-2 bg-muted/50 border-t border-border overflow-x-auto" dir={dir}>
      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-t-md text-sm cursor-pointer transition-colors",
            activeSheet === sheet.id
              ? "bg-background text-foreground border border-b-0 border-border"
              : "text-muted-foreground hover:bg-background/50"
          )}
          onClick={() => onSelectSheet(sheet.id)}
          onDoubleClick={() => handleDoubleClick(sheet)}
        >
          {editingId === sheet.id ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-20 bg-transparent outline-none border-b border-primary"
              autoFocus
              dir="auto"
            />
          ) : (
            <span>{sheet.name}</span>
          )}
          {sheets.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSheet(sheet.id);
              }}
              className="p-0.5 hover:bg-destructive/20 rounded"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onAddSheet}
        className="h-7 w-7 p-0"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default SheetTabs;
