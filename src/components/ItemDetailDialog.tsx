import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Save } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export interface ItemDetailData {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  notes?: string | null;
  statusOptions?: { value: string; label: string }[];
}

interface ItemDetailDialogProps {
  item: ItemDetailData | null;
  open: boolean;
  onClose: () => void;
  onSave?: (id: string, updates: { title?: string; status?: string; notes?: string }) => void;
  onDelete?: (id: string) => void;
}

const ItemDetailDialog = ({ item, open, onClose, onSave, onDelete }: ItemDetailDialogProps) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setStatus(item.status || "");
      setNotes(item.notes || "");
    }
  }, [item]);

  if (!item) return null;

  const handleSave = () => {
    onSave?.(item.id, {
      title: title !== item.title ? title : undefined,
      status: status !== item.status ? status : undefined,
      notes: notes !== (item.notes || "") ? notes : undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" dir="auto">
        <DialogHeader>
          <DialogTitle>{t("edit" as any) || "עריכה"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{t("title" as any) || "כותרת"}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" />
          </div>
          {item.subtitle && (
            <p className="text-xs text-muted-foreground">{item.subtitle}</p>
          )}
          {item.statusOptions && item.statusOptions.length > 0 && (
            <div className="space-y-1">
              <Label>{t("status" as any) || "סטטוס"}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {item.statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>{t("notes" as any) || "הערות"}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notes" as any) || "הערות..."}
              className="min-h-[80px]"
              dir="auto"
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { onDelete(item.id); onClose(); }}
              className="gap-1 mr-auto"
            >
              <Trash2 className="h-3 w-3" />
              {t("delete" as any) || "מחק"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("cancel" as any) || "ביטול"}
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1">
            <Save className="h-3 w-3" />
            {t("save" as any) || "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ItemDetailDialog;
