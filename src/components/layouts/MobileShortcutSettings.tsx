import { useLanguage } from '@/hooks/useLanguage';
import { mobileShortcutCopy } from '@/lib/mobileShortcutCopy';
import { MOBILE_PRIMARY_TABS, setMobileShortcut } from '@/lib/responsiveWorkspace';
import { Button } from '@/components/ui/button';
import type { DashboardTabItem } from './dashboardGrouping';

export function MobileShortcutSettings({ tabs, slots, onChange }: {
  tabs: DashboardTabItem[];
  slots: readonly string[];
  onChange: (slots: string[]) => void;
}) {
  const { lang } = useLanguage();
  const copy = mobileShortcutCopy[lang];
  return <fieldset className="space-y-3 rounded-xl border bg-muted/20 p-3">
    <legend className="px-1 text-sm font-semibold">{copy.title}</legend>
    <p className="text-xs text-muted-foreground">{copy.description}</p>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {slots.map((value, index) => <label key={index} className="grid min-w-0 gap-1 text-xs">
        {copy.slot} {index + 1}
        <select className="min-h-11 w-full rounded-md border bg-background px-2 text-sm" value={value}
          onChange={event => onChange(setMobileShortcut(slots, index, event.target.value))}>
          <option value="">{copy.empty}</option>
          {value && !tabs.some(tab => tab.id === value) && <option value={value}>{copy.unavailable}</option>}
          {tabs.map(tab => <option key={tab.id} value={tab.id}>{copy.labels[tab.id] || tab.label}</option>)}
        </select>
      </label>)}
    </div>
    <Button type="button" size="sm" variant="outline" onClick={() => onChange([...MOBILE_PRIMARY_TABS])}>{copy.reset}</Button>
  </fieldset>;
}
