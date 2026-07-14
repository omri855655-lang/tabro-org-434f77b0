import { BookOpen, Clock3, Gift, LockKeyhole, Route, Trophy } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/hooks/useLanguage";
import { useZoneFlowRewards, type ZoneFlowRewardEvent } from "@/hooks/useZoneFlowRewards";
import { cn } from "@/lib/utils";

const SOURCE_ICONS = {
  focus: Clock3,
  book: BookOpen,
  journey: Route,
  achievement: Trophy,
  challenge: Trophy,
  unlock: LockKeyhole,
} as const;

const COPY = {
  he: { title: "היסטוריית נקודות ודקות", empty: "עדיין אין פעולות בארנק.", earned: "הרווחת", spent: "נוצלו", minute: "דק׳", all: "כל הפעולות נשמרות כאן, כולל אתגרים, ספרים וחדרי ריכוז." },
  en: { title: "Points and minutes history", empty: "No wallet activity yet.", earned: "Earned", spent: "Spent", minute: "min", all: "Challenges, books, journeys, and focus rooms are recorded here." },
} as const;

const formatDate = (event: ZoneFlowRewardEvent, locale: string) => {
  const date = new Date(event.createdAt);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(date);
};

export function ZoneFlowRewardHistory({ className, limit = 12 }: { className?: string; limit?: number }) {
  const { events, balance } = useZoneFlowRewards();
  const { lang, dir } = useLanguage();
  const copy = COPY[lang === "he" ? "he" : "en"];
  const locale = lang === "he" ? "he-IL" : "en-US";
  const recent = [...events].reverse().slice(0, limit);

  return <Card className={cn("overflow-hidden", className)} dir={dir}>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between gap-3">
        <div><CardTitle className="flex items-center gap-2 text-base"><Gift className="h-5 w-5 text-cyan-500" />{copy.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{copy.all}</p></div>
        <div className="rounded-2xl bg-cyan-500/10 px-4 py-2 text-center"><div className="text-2xl font-black text-cyan-600">{balance}</div><div className="text-[10px] text-muted-foreground">{copy.minute}</div></div>
      </div>
    </CardHeader>
    <CardContent>
      {recent.length === 0 ? <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">{copy.empty}</div> : <div className="max-h-80 space-y-2 overflow-auto pe-1">
        {recent.map((event) => {
          const Icon = SOURCE_ICONS[event.source];
          const positive = event.points > 0;
          return <div key={event.id} className="flex items-center gap-3 rounded-2xl border bg-background/70 p-3">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", positive ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}><Icon className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{event.label}</div><div className="text-[11px] text-muted-foreground">{formatDate(event, locale)}</div></div>
            <div className={cn("text-sm font-black", positive ? "text-emerald-600" : "text-amber-600")}>{positive ? "+" : ""}{event.points} <span className="text-[10px] font-medium">{positive ? copy.earned : copy.spent}</span></div>
          </div>;
        })}
      </div>}
    </CardContent>
  </Card>;
}
