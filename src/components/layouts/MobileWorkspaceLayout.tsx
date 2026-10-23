import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, MoreHorizontal, Search } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { filterWorkspaceTabs, mobilePrimaryTabs } from '@/lib/responsiveWorkspace';
import { mobileWorkspaceCopy } from '@/lib/mobileWorkspaceCopy';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { DashboardTabGroup, DashboardTabItem } from './dashboardGrouping';

interface Props {
  tabs: DashboardTabItem[];
  groups?: DashboardTabGroup[];
  activeTab: string;
  onTabChange: (id: string) => void;
  notification?: ReactNode;
  accountActions?: ReactNode;
  email?: string;
  children: ReactNode;
}
export default function MobileWorkspaceLayout({ tabs, groups = [], activeTab, onTabChange, notification, accountActions, email, children }: Props) {
  const { lang, dir } = useLanguage(), c = mobileWorkspaceCopy[lang];
  const [open, setOpen] = useState(false), [search, setSearch] = useState('');
  const contentRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const primary = mobilePrimaryTabs(tabs), current = tabs.find(tab => tab.id === activeTab);
  const visible = filterWorkspaceTabs(tabs, search), primaryActive = primary.some(tab => tab.id === activeTab);
  useEffect(() => {
    const root = document.documentElement, viewport = window.visualViewport;
    const beforeHeight = root.style.getPropertyValue('--tabro-viewport-height'), beforeTop = root.style.getPropertyValue('--tabro-viewport-top');
    const update = () => {
      // Do not counteract the user's pinch zoom by resizing the layout to the zoomed viewport.
      if (viewport && viewport.scale > 1.05) return;
      root.style.setProperty('--tabro-viewport-height', `${Math.round(viewport?.height || window.innerHeight)}px`);
      root.style.setProperty('--tabro-viewport-top', `${Math.round(viewport?.offsetTop || 0)}px`);
      const editing = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,[contenteditable=true]');
      root.toggleAttribute('data-mobile-keyboard', Boolean(editing && viewport && window.innerHeight - viewport.height > 140));
    };
    update();
    viewport?.addEventListener('resize', update); viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update); document.addEventListener('focusin', update); document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update); document.removeEventListener('focusin', update); document.removeEventListener('focusout', update);
      if (beforeHeight) root.style.setProperty('--tabro-viewport-height', beforeHeight); else root.style.removeProperty('--tabro-viewport-height');
      if (beforeTop) root.style.setProperty('--tabro-viewport-top', beforeTop); else root.style.removeProperty('--tabro-viewport-top');
      root.removeAttribute('data-mobile-keyboard');
    };
  }, []);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, [activeTab]);
  const choose = (id: string) => { onTabChange(id); setOpen(false); setSearch(''); };
  const tabButton = (tab: DashboardTabItem) => {
    const Icon = tab.icon;
    return <button key={tab.id} type="button" onClick={() => choose(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === tab.id ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'}`}><Icon className="h-5 w-5 shrink-0" /><span className="min-w-0 break-words">{tab.label}</span></button>;
  };
  return <div className="mobile-workspace flex w-full min-w-0 flex-col bg-background" dir={dir}>
    <Sheet open={open} onOpenChange={value => { setOpen(value); if (!value) setSearch(''); }}>
      <header className="mobile-workspace-header flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2">
        <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label={c.menu} className="shrink-0"><Menu className="h-5 w-5" /></Button></SheetTrigger>
        <div className="min-w-0 flex-1"><span className="block text-[10px] font-bold tracking-widest text-primary">TABRO</span><h1 className="truncate text-base font-semibold">{current?.label || c.all}</h1></div>
        {notification}
      </header>
      <main id="mobile-workspace-content" ref={contentRef} className="mobile-workspace-content min-h-0 min-w-0 flex-1 overflow-auto" tabIndex={-1}>{children}</main>
      <nav className="mobile-workspace-nav grid shrink-0 border-t bg-card/95 px-1 pt-1 shadow-[0_-4px_24px_hsl(var(--foreground)/0.04)]" style={{ gridTemplateColumns: `repeat(${primary.length + 1},minmax(0,1fr))` }} aria-label={c.navigation}>
        {primary.map(tab => { const Icon = tab.icon; return <button key={tab.id} type="button" aria-label={tab.label} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => choose(tab.id)} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === tab.id ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground'}`}><Icon className="h-5 w-5 shrink-0" /><span className="w-full truncate text-center">{tab.label}</span></button>; })}
        <SheetTrigger asChild><button type="button" aria-label={c.menu} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!primaryActive ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground'}`}><MoreHorizontal className="h-5 w-5" /><span>{c.more}</span></button></SheetTrigger>
      </nav>
      <SheetContent side={dir === 'rtl' ? 'right' : 'left'} className="mobile-workspace-menu flex w-[min(92vw,26rem)] max-w-none flex-col gap-0 p-0" dir={dir} onOpenAutoFocus={event => { event.preventDefault(); titleRef.current?.focus(); }}>
        <SheetHeader className="shrink-0 border-b px-4 pb-4 pr-14 pt-6 text-start"><SheetTitle ref={titleRef} tabIndex={-1} className="outline-none">{c.all}</SheetTitle><SheetDescription>{c.description}</SheetDescription></SheetHeader>
        <label className="mx-4 my-3 flex shrink-0 items-center gap-2 rounded-xl border bg-muted/30 px-3"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><input aria-label={c.search} type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={c.search} className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none" /></label>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
          {visible.length === 0 ? <p role="status" className="p-4 text-sm text-muted-foreground">{c.empty}</p> : groups.length && !search.trim() ? groups.map(group => <section key={group.key} className="mb-3"><h2 className="px-3 py-2 text-xs font-semibold text-muted-foreground">{group.label}</h2>{group.items.map(tabButton)}</section>) : visible.map(tabButton)}
        </div>
        <footer className="mobile-workspace-account shrink-0 space-y-2 border-t bg-muted/20 p-4"><h2 className="text-xs font-semibold">{c.account}</h2>{email && <p className="truncate text-xs text-muted-foreground" dir="ltr">{email}</p>}<div className="flex flex-wrap gap-2">{accountActions}</div></footer>
      </SheetContent>
    </Sheet>
  </div>;
}
