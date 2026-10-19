import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, BookOpen, CalendarClock, ChevronDown, CreditCard, Gift, History, LayoutDashboard, ListFilter, Plus, Settings2, Sparkles, Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FinanceWorkspaceProps {
  isRtl: boolean;
  activeTab: string;
  onTabChange: (value: string) => void;
  onImport: () => void;
  monthControl: ReactNode;
  exportControl: ReactNode;
  children: ReactNode;
}

export default function FinanceWorkspace({ isRtl, activeTab, onTabChange, onImport, monthControl, exportControl, children }: FinanceWorkspaceProps) {
  const [toolsOpen, setToolsOpen] = useState(() => ["add", "budget", "history", "ai", "guides", "clubs"].includes(activeTab));
  useEffect(() => { setToolsOpen(["add", "budget", "history", "ai", "guides", "clubs"].includes(activeTab)); }, [activeTab]);
  const primary = [
    { value: "overview", label: isRtl ? "מבט כללי" : "Overview", icon: LayoutDashboard },
    { value: "transactions", label: isRtl ? "תנועות" : "Transactions", icon: ListFilter },
    { value: "insights", label: isRtl ? "פילוח וזיכויים" : "Insights & refunds", icon: BarChart3 },
    { value: "forecast", label: isRtl ? "תזרים עתידי" : "Cash flow", icon: CalendarClock },
    { value: "credit-cards", label: isRtl ? "בנק ואשראי" : "Bank & cards", icon: CreditCard },
  ];
  const secondary = [
    { value: "add", label: isRtl ? "הוספה ידנית" : "Manual entry", icon: Plus },
    { value: "budget", label: isRtl ? "תקציב וקבועות" : "Budget & recurring", icon: Wallet },
    { value: "history", label: isRtl ? "היסטוריה" : "History", icon: History },
    { value: "ai", label: isRtl ? "יועץ AI" : "AI advisor", icon: Sparkles },
    { value: "guides", label: isRtl ? "מדריכים" : "Guides", icon: BookOpen },
    { value: "clubs", label: isRtl ? "מועדונים ותווים" : "Clubs & vouchers", icon: Gift },
  ];
  const activeTool = secondary.find(item => item.value === activeTab);
  return <Tabs value={activeTab} onValueChange={onTabChange} dir={isRtl ? "rtl" : "ltr"} className="space-y-5">
    <header className="relative overflow-hidden rounded-3xl border border-sky-200/60 bg-gradient-to-bl from-sky-100/70 via-background to-emerald-50/60 p-5 dark:border-sky-900/50 dark:from-sky-950/30 dark:to-emerald-950/20 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-sky-800 dark:text-sky-300">TABRO / {isRtl ? "הכסף שלך, מסודר" : "Your money, organized"}</p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{isRtl ? "הכנסות והוצאות" : "Income & expenses"}</h2>
          <p className="hidden max-w-lg text-sm leading-6 text-muted-foreground sm:block">{isRtl ? "מה נכנס, מה יצא ומה צפוי. כל הפרטים כאן, רק כשצריך אותם." : "What came in, what went out, and what is ahead. Details when you need them."}</p>
        </div>
        <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
          <span className="block">{isRtl ? "חודש לסיכום ולפילוח" : "Summary & analysis month"}</span>
          {monthControl}
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-sky-200/60 pt-4 dark:border-sky-900/50">
        <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => onTabChange("add")}><Plus className="h-4 w-4" aria-hidden="true" />{isRtl ? "הוספת תנועה" : "Add entry"}</Button>
        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl bg-background/80" onClick={onImport}><Upload className="h-4 w-4" aria-hidden="true" />{isRtl ? "ייבוא Amex" : "Import Amex"}</Button>
        <span className="hidden flex-1 sm:block" />
        {exportControl}
      </div>
    </header>
    <nav aria-label={isRtl ? "אזורי הכנסות והוצאות" : "Finance sections"} className="space-y-2">
      <TabsList aria-label={isRtl ? "פעולות יומיומיות" : "Everyday finance"} className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl bg-muted/60 p-1.5 sm:grid-cols-5">
        {primary.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className="min-w-0 gap-1.5 whitespace-normal rounded-xl px-2 py-3 text-xs leading-4 sm:text-sm"><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0">{label}</span></TabsTrigger>)}
      </TabsList>
      <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
        <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground"><Settings2 className="h-3.5 w-3.5" aria-hidden="true" />{isRtl ? "כלים נוספים" : "More tools"}{activeTool && <span className="font-semibold text-foreground">· {activeTool.label}</span>}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${toolsOpen ? "rotate-180" : ""}`} aria-hidden="true" /></Button></CollapsibleTrigger>
        <CollapsibleContent forceMount className="data-[state=closed]:hidden">
          <TabsList aria-label={isRtl ? "כלים נוספים" : "More tools"} className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border bg-background p-1 sm:grid-cols-3 lg:grid-cols-6">
            {secondary.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className="gap-1.5 rounded-lg px-2 py-2.5 text-xs"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</TabsTrigger>)}
          </TabsList>
        </CollapsibleContent>
      </Collapsible>
    </nav>
    {children}
  </Tabs>;
}
