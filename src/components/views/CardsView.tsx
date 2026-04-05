import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Pencil, Check, X } from 'lucide-react';
import InlineNotesTextarea from '@/components/InlineNotesTextarea';

export interface CardViewItem {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  statusOptions?: { value: string; label: string }[];
  notes?: string | null;
  meta?: string;
  urgent?: boolean;
}

interface CardsViewProps {
  items: CardViewItem[];
  emptyText?: string;
  onStatusChange?: (id: string, status: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  onNotesChange?: (id: string, notes: string) => void;
  onTitleChange?: (id: string, title: string) => void;
}

const statusColor = (status: string | null | undefined) => {
  if (!status) return 'bg-muted';
  if (['נקרא', 'נשמע', 'נצפה', 'בוצע', 'הושלם'].includes(status)) return 'bg-green-500/15 text-green-700';
  if (['בקריאה', 'בהאזנה', 'בצפייה', 'בטיפול'].includes(status)) return 'bg-blue-500/15 text-blue-700';
  return 'bg-orange-500/15 text-orange-700';
};

const CardsView = ({ items, emptyText = 'אין פריטים', onStatusChange, onDelete, onClick, onNotesChange, onTitleChange }: CardsViewProps) => {
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  if (items.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {items.map(item => (
        <div
          key={item.id}
          className={`rounded-xl border bg-card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow cursor-pointer ${item.urgent ? 'border-destructive/40 bg-destructive/5' : ''}`}
          onClick={() => onClick?.(item.id)}
        >
          <div className="flex items-start justify-between gap-2">
            {editingTitle === item.id ? (
              <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                <input
                  value={editTitleValue}
                  onChange={e => setEditTitleValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { onTitleChange?.(item.id, editTitleValue); setEditingTitle(null); }
                    if (e.key === 'Escape') setEditingTitle(null);
                  }}
                  className="flex-1 bg-transparent border-b border-primary outline-none text-sm font-semibold"
                  autoFocus
                  dir="auto"
                />
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { onTitleChange?.(item.id, editTitleValue); setEditingTitle(null); }}><Check className="h-3 w-3" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <h4 className="font-semibold text-sm leading-tight flex-1 truncate">{item.title}</h4>
                {onTitleChange && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-60 hover:opacity-100" onClick={e => { e.stopPropagation(); setEditTitleValue(item.title); setEditingTitle(item.id); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
          {onNotesChange ? (
            <div onClick={e => e.stopPropagation()}>
              <InlineNotesTextarea
                initialValue={item.notes}
                placeholder="הערות..."
                className="min-h-[36px] text-xs bg-muted/30 border-muted"
                onCommit={(val) => onNotesChange(item.id, val)}
              />
            </div>
          ) : (
            item.notes && <p className="text-xs text-muted-foreground line-clamp-2">{item.notes}</p>
          )}
          <div className="flex items-center justify-between mt-auto pt-1">
            {item.status && (
              item.statusOptions && onStatusChange ? (
                <Select value={item.status} onValueChange={(v) => onStatusChange(item.id, v)}>
                  <SelectTrigger className="w-[100px] h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {item.statusOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className={`text-[10px] ${statusColor(item.status)}`}>{item.status}</Badge>
              )
            )}
            {item.meta && <span className="text-[10px] text-muted-foreground">{item.meta}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardsView;
