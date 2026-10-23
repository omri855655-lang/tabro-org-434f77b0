import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bell, Calendar, CreditCard, LayoutDashboard, ListTodo, Settings, Users } from 'lucide-react';
import { LanguageProvider } from '@/hooks/useLanguage';
import { useCompactWorkspace } from '@/hooks/use-mobile';
import { useDashboardDisplay } from '@/hooks/useDashboardDisplay';
import MobileWorkspaceLayout from '@/components/layouts/MobileWorkspaceLayout';
import SidebarLayout from '@/components/layouts/SidebarLayout';
import DashboardDisplayToolbar from '@/components/DashboardDisplayToolbar';
import ListView from '@/components/views/ListView';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import '@/index.css';

const tabs = [
  { id: 'dashboard', label: 'דשבורד', icon: LayoutDashboard }, { id: 'tasks', label: 'משימות אישיות', icon: ListTodo },
  { id: 'work', label: 'משימות עבודה', icon: ListTodo }, { id: 'planner', label: 'מתכנן לוז', icon: Calendar },
  { id: 'payments', label: 'הכנסות והוצאות', icon: CreditCard }, { id: 'nutrition', label: 'תזונה ושינה', icon: ListTodo },
  { id: 'shared-test', label: 'לוח משותף לבדיקה', icon: Users }, { id: 'board-test', label: 'לוח אישי מותאם', icon: ListTodo },
  { id: 'settings', label: 'הגדרות', icon: Settings },
];
const items = Array.from({ length: 12 }, (_, i) => ({ id: String(i), title: `משימת דוגמה ארוכה ${i + 1} — עם כל הפרטים החשובים לצורך בדיקת תצוגה במכשיר קטן`, subtitle: 'קטגוריה · איש קשר', status: 'טרם החל', meta: '23/10/2026', notes: 'זהו תוכן בדיקה בלבד, ללא נתונים אמיתיים.' }));
function Fixture() {
  const compact = useCompactWorkspace(), [active, setActive] = useState('tasks'), [dialog, setDialog] = useState(false);
  const display = useDashboardDisplay('responsive-workspace-qa-only', 'list');
  const content = <div className="min-h-full min-w-0 space-y-4 p-3"><p className="rounded-xl border p-3 text-xs">QA fixture — local fake data, no account requests. Current: {active}</p><h2 className="text-xl font-bold">{tabs.find(tab => tab.id === active)?.label}</h2>
    <DashboardDisplayToolbar viewMode={display.viewMode} themeKey={display.themeKey} onViewModeChange={display.setViewMode} onThemeChange={display.setTheme} />
    <Button onClick={() => setDialog(true)}>פתיחת טופס בדיקה</Button>
    {display.viewMode === 'table' ? <div className="max-w-full overflow-x-auto" data-qa-table><table className="min-w-[1200px]"><thead><tr>{Array.from({ length: 8 }, (_, i) => <th key={i}>עמודה {i}</th>)}</tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.title}</td>{Array.from({ length: 7 }, (_, i) => <td key={i}>{item.subtitle}</td>)}</tr>)}</tbody></table></div> : <ListView items={items} onClick={() => setDialog(true)} />}
    <Dialog open={dialog} onOpenChange={setDialog}><DialogContent dir="rtl"><DialogHeader><DialogTitle>טופס ארוך לבדיקת נייד</DialogTitle><DialogDescription>בדיקת גלילה, מקלדת וכפתור סגירה בלבד.</DialogDescription></DialogHeader>{Array.from({ length: 14 }, (_, i) => <label key={i}>שדה {i + 1}<Input placeholder={`שדה ${i + 1}`} /></label>)}<Button onClick={() => setDialog(false)}>סיום בדיקה</Button></DialogContent></Dialog>
  </div>;
  return compact ? <MobileWorkspaceLayout tabs={tabs} activeTab={active} onTabChange={setActive} notification={<Button variant="ghost" size="icon" aria-label="התראות"><Bell /></Button>} accountActions={<Button>חשבון בדיקה</Button>} email="sample@example.invalid">{content}</MobileWorkspaceLayout> : <SidebarLayout tabs={tabs} activeTab={active} onTabChange={setActive} header={<h1>Desktop fixture</h1>}>{content}</SidebarLayout>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><TooltipProvider><Fixture /></TooltipProvider></LanguageProvider>);
