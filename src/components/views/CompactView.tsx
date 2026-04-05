import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export interface CompactViewItem {
  id: string;
  title: string;
  status?: string | null;
  subtitle?: string | null;
  urgent?: boolean;
}

interface CompactViewProps {
  items: CompactViewItem[];
  emptyText?: string;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
}

const statusDot = (status: string | null | undefined) => {
  if (!status) return 'bg-muted-foreground';
  if (['נקרא', 'נשמע', 'נצפה', 'בוצע', 'הושלם'].includes(status)) return 'bg-green-500';
  if (['בקריאה', 'בהאזנה', 'בצפייה', 'בטיפול'].includes(status)) return 'bg-blue-500';
  return 'bg-orange-500';
};

const CompactView = ({ items, emptyText = 'אין פריטים', onDelete, onClick }: CompactViewProps) => {
  if (items.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="divide-y divide-border">
      {items.map(item => (
        <div
          key={item.id}
          className={`flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 cursor-pointer text-sm ${item.urgent ? 'bg-destructive/5' : ''}`}
          onClick={() => onClick?.(item.id)}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(item.status)}`} />
          <span className="flex-1 truncate">{item.title}</span>
          {item.subtitle && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{item.subtitle}</span>}
          {item.status && <Badge variant="outline" className="text-[9px] h-5 px-1.5">{item.status}</Badge>}
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};

export default CompactView;
