import { LayoutGrid, Star, Target, BookOpen, Briefcase, ShoppingCart, Heart, Plane, Music, CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const icons = { LayoutGrid, Star, Target, BookOpen, Briefcase, ShoppingCart, Heart, Plane, Music, CalendarDays };
export function getBoardIcon(name: string) {
  return icons[name as keyof typeof icons] || LayoutGrid;
}
export function BoardIcon({ name, className }: { name: string; className?: string }) {
  const Icon = getBoardIcon(name);
  return <Icon className={className} />;
}
export default function BoardIconPicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <Select value={value in icons ? value : "LayoutGrid"} onValueChange={onChange}>
    <SelectTrigger className="w-20 min-h-11" aria-label={label}><SelectValue /></SelectTrigger>
    <SelectContent>{Object.entries(icons).map(([name, Icon]) => <SelectItem key={name} value={name}><Icon className="h-5 w-5" /><span className="sr-only">{name}</span></SelectItem>)}</SelectContent>
  </Select>;
}
