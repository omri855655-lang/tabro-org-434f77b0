import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Calendar, Plus, X, Check, List, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface YearSelectorProps {
  selectedYear: string | null;
  onYearChange: (year: string | null) => void;
  years: string[];
  onAddYear?: (year: string) => void;
  onDeleteYear?: (year: string) => void;
}

const YearSelector = ({ 
  selectedYear, 
  onYearChange, 
  years,
  onAddYear,
  onDeleteYear
}: YearSelectorProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [yearToDelete, setYearToDelete] = useState<string | null>(null);

  const handleAddYear = () => {
    const trimmed = newYear.trim();
    if (!trimmed) return;
    
    // Check if already exists
    if (years.includes(trimmed)) {
      setNewYear("");
      setIsAdding(false);
      return;
    }
    
    onAddYear?.(trimmed);
    setNewYear("");
    setIsAdding(false);
  };

  const handleDeleteYear = () => {
    if (yearToDelete !== null) {
      onDeleteYear?.(yearToDelete);
      // If we're deleting the currently selected year, switch to "all"
      if (selectedYear === yearToDelete) {
        onYearChange(null);
      }
      setYearToDelete(null);
    }
  };

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border" dir="rtl">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground ml-2">גליון:</span>
        <div className="flex min-w-0 gap-1 items-center flex-wrap">
          {/* All tasks button */}
          <Button
            variant={selectedYear === null ? "default" : "outline"}
            size="sm"
            onClick={() => onYearChange(null)}
            className={cn(
              "h-7 px-3 gap-1",
              selectedYear === null && "font-bold"
            )}
          >
            <List className="h-3.5 w-3.5" />
            הכל
          </Button>
          
          {[...years].sort((a, b) => {
            const aNum = parseInt(a, 10);
            const bNum = parseInt(b, 10);
            const aIsNum = !isNaN(aNum);
            const bIsNum = !isNaN(bNum);
            if (aIsNum && bIsNum) return aNum - bNum;
            if (aIsNum) return -1;
            if (bIsNum) return 1;
            return a.localeCompare(b, 'he');
          }).map((year) => (
            <div key={year} className="relative group">
              <Button
                variant={selectedYear === year ? "default" : "outline"}
                size="sm"
                onClick={() => onYearChange(year)}
                className={cn(
                  "h-7 px-3 pr-7",
                  selectedYear === year && "font-bold"
                )}
              >
                {year}
              </Button>
              {onDeleteYear && years.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setYearToDelete(year);
                  }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-destructive/20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  title="מחק גליון"
                >
                  <X className="h-3 w-3 text-destructive" />
                </button>
              )}
            </div>
          ))}
          
          {isAdding ? (
            <div className="flex items-center gap-1">
              <Input
                type="text"
                placeholder="שנה או טקסט"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="h-7 w-24 text-center"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddYear();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleAddYear}
              >
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsAdding(false)}
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsAdding(true)}
              title="הוסף שנה חדשה"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={yearToDelete !== null} onOpenChange={(open) => !open && setYearToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת גליון "{yearToDelete}"</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את גליון "{yearToDelete}"?
              <br />
              <strong className="text-destructive">פעולה זו תמחק את כל המשימות בגליון זה לצמיתות!</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteYear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 ml-2" />
              מחק גליון
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default YearSelector;
