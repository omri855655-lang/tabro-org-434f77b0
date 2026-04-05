import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import InlineNotesTextarea from '@/components/InlineNotesTextarea';

export interface KanbanItem {
  id: string;
  title: string;
  subtitle?: string | null;
  status: string;
  notes?: string | null;
  urgent?: boolean;
}

interface KanbanViewProps {
  items: KanbanItem[];
  columns: { value: string; label: string; color?: string }[];
  emptyText?: string;
  onStatusChange?: (id: string, status: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  onNotesChange?: (id: string, notes: string) => void;
}

const KanbanView = ({ items, columns, emptyText = 'אין פריטים', onStatusChange, onDelete, onClick, onNotesChange }: KanbanViewProps) => {
  if (items.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 h-full">
      {columns.map(col => {
        const colItems = items.filter(i => i.status === col.value);
        return (
          <div
            key={col.value}
            className="min-w-[220px] max-w-[280px] flex-1 flex flex-col rounded-lg border bg-muted/30"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const itemId = e.dataTransfer.getData('text/plain');
              if (itemId && onStatusChange) onStatusChange(itemId, col.value);
            }}
          >
            <div className={`px-3 py-2 rounded-t-lg font-medium text-sm flex items-center justify-between ${col.color || 'bg-muted'}`}>
              <span>{col.label}</span>
              <span className="text-xs text-muted-foreground">{colItems.length}</span>
            </div>
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {colItems.map(item => (
                  <div
                    key={item.id}
                    className={`rounded-lg border bg-card p-3 cursor-pointer hover:shadow-sm transition-shadow ${item.urgent ? 'border-destructive/40 bg-destructive/5' : ''}`}
                    onClick={() => onClick?.(item.id)}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-sm font-medium leading-tight">{item.title}</span>
                      {onDelete && (
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {item.subtitle && <p className="text-[10px] text-muted-foreground mt-1">{item.subtitle}</p>}
                    {onNotesChange ? (
                      <div className="mt-1" onClick={e => e.stopPropagation()}>
                        <InlineNotesTextarea
                          initialValue={item.notes}
                          placeholder="הערות..."
                          className="min-h-[28px] text-[10px] bg-muted/30 border-muted p-1"
                          onCommit={(val) => onNotesChange(item.id, val)}
                        />
                      </div>
                    ) : (
                      item.notes && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanView;
