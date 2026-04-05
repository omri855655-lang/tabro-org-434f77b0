import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';

export interface ListViewItem {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  statusOptions?: { value: string; label: string }[];
  notes?: string | null;
  meta?: string;
  urgent?: boolean;
}

interface ListViewProps {
  items: ListViewItem[];
  emptyText?: string;
  onStatusChange?: (id: string, status: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
}

const statusColor = (status: string | null | undefined) => {
  if (!status) return 'bg-muted text-muted-foreground';
  if (['נקרא', 'נשמע', 'נצפה', 'בוצע', 'הושלם'].includes(status)) return 'bg-green-500/15 text-green-700 border-green-500/30';
  if (['בקריאה', 'בהאזנה', 'בצפייה', 'בטיפול'].includes(status)) return 'bg-blue-500/15 text-blue-700 border-blue-500/30';
  return 'bg-orange-500/15 text-orange-700 border-orange-500/30';
};

const ListView = ({ items, emptyText = 'אין פריטים', onStatusChange, onDelete, onClick }: ListViewProps) => {
  if (items.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="space-y-1">
      {items.map(item => (
        <div
          key={item.id}
          className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer ${item.urgent ? 'border-destructive/40 bg-destructive/5' : ''}`}
          onClick={() => onClick?.(item.id)}
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{item.title}</div>
            {item.subtitle && <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>}
            {item.notes && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.notes}</div>}
          </div>
          {item.status && (
            item.statusOptions && onStatusChange ? (
              <Select value={item.status} onValueChange={(v) => { onStatusChange(item.id, v); }}>
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
          {item.meta && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.meta}</span>}
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ListView;
