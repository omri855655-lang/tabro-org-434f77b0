import { useMemo, useRef, useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { ganttCopy, ganttLocales, templateCopy } from "@/lib/ganttCopy";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  LayoutTemplate,
  ListFilter,
  Loader2,
  Printer,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { printDocument } from "@/lib/printDocument";
import {
  addCalendarDays,
  buildAutomaticSchedule,
  createScheduleDates,
  differenceInCalendarDays,
  formatProjectTaskTitle,
  getGanttTaskPeriod,
  parseLocalDate,
  toLocalDateKey,
} from "@/lib/projectGantt";

export interface ProjectGanttTask {
  id: string;
  title: string;
  completed: boolean;
  urgent: boolean;
  status: string | null;
  due_date: string | null;
  sort_order: number;
  assigned_email?: string | null;
}

export interface ProjectGanttProject {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
}

interface ProjectGanttProps {
  project: ProjectGanttProject;
  tasks: ProjectGanttTask[];
  onUpdateTask?: (taskId: string, updates: Partial<ProjectGanttTask>) => Promise<void>;
  onBulkUpdate?: (updates: Array<{ id: string; due_date: string }>) => Promise<void>;
  onAddTemplate?: (tasks: Array<{ title: string; due_date: string }>) => Promise<void>;
  onUpdateProjectTarget?: (date: string) => Promise<void>;
  readOnly?: boolean;
  audience?: 'private' | 'public';
  kind?: 'project' | 'course';
}

type GanttFilter = "all" | "open" | "late" | "urgent";
type ZoomLevel = 14 | 30 | 90;

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const formatShortDate = (date: Date, locale: string) => new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "short",
}).format(date);

const isLate = (task: ProjectGanttTask, today: Date) => {
  const dueDate = parseLocalDate(task.due_date);
  return Boolean(dueDate && dueDate < today && !task.completed);
};

const ProjectGantt = ({
  project,
  tasks,
  onUpdateTask,
  onBulkUpdate,
  onAddTemplate,
  onUpdateProjectTarget,
  readOnly = false,
  audience = 'private',
  kind = 'project',
}: ProjectGanttProps) => {
  const { lang, dir } = useLanguage();
  const copy = ganttCopy[lang];
  const locale = ganttLocales[lang];
  const templates = templateCopy[lang];
  const today = useMemo(startOfToday, []);
  const [zoom, setZoom] = useState<ZoomLevel>(30);
  const [windowStart, setWindowStart] = useState(today);
  const [filter, setFilter] = useState<GanttFilter>("all");
  const [templateId, setTemplateId] = useState<keyof typeof templates>("foundation");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const operation = useRef(false);
  const runChange = async (change: () => Promise<void>) => {
    if (readOnly || operation.current) return;
    operation.current = true; setSaving(true); setSaveError(false);
    try { await change(); } catch { setSaveError(true); }
    finally { operation.current = false; setSaving(false); }
  };

  const orderedTasks = useMemo(() => [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  }), [tasks]);

  const visibleTasks = useMemo(() => orderedTasks.filter((task) => {
    if (filter === "open") return !task.completed;
    if (filter === "late") return isLate(task, today);
    if (filter === "urgent") return task.urgent && !task.completed;
    return true;
  }), [filter, orderedTasks, today]);

  const days = useMemo(
    () => Array.from({ length: zoom }, (_, index) => addCalendarDays(windowStart, index)),
    [windowStart, zoom],
  );
  const dayWidth = zoom === 90 ? 20 : zoom === 30 ? 34 : 54;
  const timelineWidth = zoom * dayWidth;
  const completedCount = tasks.filter((task) => task.completed).length;
  const lateCount = tasks.filter((task) => isLate(task, today)).length;
  const undatedCount = tasks.filter((task) => !parseLocalDate(task.due_date) && !task.completed).length;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const targetDate = parseLocalDate(project.target_date);

  const runAutomaticSchedule = async () => {
    const openTasks = orderedTasks.filter((task) => !task.completed);
    if (!openTasks.length || !onBulkUpdate) return;

    await runChange(async () => {
      const schedule = buildAutomaticSchedule(openTasks, today, targetDate);
      await onBulkUpdate(schedule);
    });
  };

  const addTemplate = async () => {
    if (!onAddTemplate) return;
    const template = templates[templateId];
    const dueDates = createScheduleDates(template.tasks.length, today, targetDate);
    await runChange(async () => {
      await onAddTemplate(template.tasks.map((title, index) => ({ title, due_date: dueDates[index] })));
    });
  };

  const moveWindow = (direction: -1 | 1) => {
    setWindowStart((current) => addCalendarDays(current, direction * Math.max(7, Math.floor(zoom / 2))));
  };

  const jumpToTarget = () => {
    if (!targetDate) return;
    setWindowStart(addCalendarDays(targetDate, -Math.floor(zoom * 0.7)));
  };

  const todayOffset = differenceInCalendarDays(today, windowStart);
  const taskStatus = (status: string | null, completed: boolean) => completed ? copy.done
    : ({'לא התחיל':copy.open,'טרם החל':copy.open,'פתוח':copy.open,'בטיפול':copy.inProgress,'בהמתנה':copy.waiting,'בלמידה':copy.learning,'בוצע':copy.done,'הושלם':copy.done}[status || ''] || status || copy.open);
  const printReport = () => printDocument(`${copy.gantt} · ${project.title}`,
    [copy.task,copy.start,copy.target,copy.status,copy.priority],
    visibleTasks.map((task,index) => {
      const period = getGanttTaskPeriod(task,windowStart,index);
      return [formatProjectTaskTitle(task.title,copy.untitled),`${toLocalDateKey(period.start)}${period.isEstimated ? ` (${copy.estimated})` : ''}`,toLocalDateKey(period.end),taskStatus(task.status,task.completed),task.urgent ? copy.urgent : copy.normal];
    }), project.description || (kind === 'course' ? copy.coursePlan : copy.projectPlan), {lang,dir});

  return (
    <div className="gantt-print-surface flex min-h-0 min-w-0 flex-1 flex-col gap-4" dir={dir}>
      {saveError && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{copy.saveError}</p>}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-gradient-to-br from-sky-500/10 to-cyan-500/5 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{copy.progress}</span>
            <Check className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold">{progress}%</div>
          <Progress value={progress} className="mt-2 h-2" />
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{copy.openTasks}</span>
            <ListFilter className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold">{tasks.length - completedCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">{copy.ofTasks.replace('{count}',String(tasks.length))}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{copy.late}</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className={cn("mt-2 text-2xl font-bold", lateCount > 0 && "text-amber-700")}>{lateCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">{copy.attention}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{copy.undated}</span>
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold">{undatedCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">{copy.canSchedule}</p>
        </div>
      </section>

      <section className="rounded-2xl border bg-muted/20 p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && <>
              <Button onClick={() => void runAutomaticSchedule()} disabled={saving || !onBulkUpdate || tasks.every((task) => task.completed)} size="sm">
                {saving ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <Sparkles className="me-1 h-4 w-4" />}
                {copy.automatic}
              </Button>
              <Select disabled={saving} value={templateId} onValueChange={(value) => setTemplateId(value as keyof typeof templates)}>
                <SelectTrigger aria-label={copy.template} className="h-9 w-[160px] bg-background">
                  <LayoutTemplate className="me-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(templates).map(([id, template]) => (
                    <SelectItem key={id} value={id}>{template.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => void addTemplate()} disabled={saving || !onAddTemplate} size="sm" variant="outline">
                {copy.addStages}
              </Button>
            </>}
            <Button type="button" onClick={printReport} size="sm" variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              {copy.print}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{kind === 'course' ? copy.courseTarget : copy.projectTarget}</span>
            {readOnly ? (
              <Badge variant="outline" className="h-9 px-3 text-sm">
                {targetDate ? targetDate.toLocaleDateString(locale) : copy.notSet}
              </Badge>
            ) : (
              <Input
                type="date"
                value={targetDate ? toLocalDateKey(targetDate) : ""}
                disabled={saving || !onUpdateProjectTarget}
                onChange={(event) => { const date = event.target.value; void runChange(async () => { await onUpdateProjectTarget?.(date); }); }}
                className="h-9 w-[150px] bg-background"
                aria-label={copy.targetDate}
              />
            )}
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {audience === 'public' ? copy.publicHint : kind === 'course' ? copy.courseHint : copy.privateHint}
        </p>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onValueChange={(value) => setFilter(value as GanttFilter)}>
              <SelectTrigger aria-label={copy.all} className="h-8 w-[135px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.all}</SelectItem>
                <SelectItem value="open">{copy.open}</SelectItem>
                <SelectItem value="late">{copy.late}</SelectItem>
                <SelectItem value="urgent">{copy.urgent}</SelectItem>
              </SelectContent>
            </Select>
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" aria-label={copy.zoom}>
              {([14, 30, 90] as ZoomLevel[]).map((level) => (
                <Button
                  key={level}
                  size="sm"
                  variant={zoom === level ? "secondary" : "ghost"}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setZoom(level)}
                  aria-pressed={zoom === level}
                >
                  {level === 14 ? copy.twoWeeks : level === 30 ? copy.month : copy.quarter}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => moveWindow(1)} aria-label={copy.forward}>
              <ChevronRight className={cn("h-4 w-4",dir === 'rtl' && 'rotate-180')} />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setWindowStart(today)}>{copy.today}</Button>
            {targetDate && (
              <Button variant="ghost" size="sm" className="h-8" onClick={jumpToTarget}>
                <Target className="me-1 h-4 w-4" />
                {copy.toTarget}
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => moveWindow(-1)} aria-label={copy.back}>
              <ChevronLeft className={cn("h-4 w-4",dir === 'rtl' && 'rotate-180')} />
            </Button>
          </div>
        </div>

        {visibleTasks.length === 0 ? (
          <div className="grid flex-1 place-items-center p-10 text-center">
            <div>
              <CircleDot className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <h3 className="mt-3 font-semibold">{copy.empty}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{readOnly ? copy.readOnlyEmpty : copy.emptyHint}</p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="min-w-max">
              <div className="sticky top-0 z-20 flex border-b bg-background/95 backdrop-blur" dir={dir}>
                <div className="sticky start-0 z-30 flex w-[210px] shrink-0 items-center border-e bg-background px-3 py-2 text-xs font-semibold sm:w-[270px]">
                  {copy.taskDate}
                </div>
                <div className="relative flex" style={{ width: timelineWidth }} dir={dir}>
                  {days.map((day, index) => {
                    const isToday = toLocalDateKey(day) === toLocalDateKey(today);
                    const isWeekend = day.getDay() === 5 || day.getDay() === 6;
                    const showLabel = zoom !== 90 || index % 7 === 0;
                    return (
                      <div
                        key={toLocalDateKey(day)}
                        className={cn(
                          "shrink-0 border-e px-1 py-2 text-center text-[10px] text-muted-foreground",
                          isWeekend && "bg-muted/55",
                          isToday && "bg-sky-500/10 font-bold text-sky-700",
                        )}
                        style={{ width: dayWidth }}
                      >
                        {showLabel ? formatShortDate(day,locale) : ""}
                      </div>
                    );
                  })}
                </div>
              </div>

              {visibleTasks.map((task, index) => {
                const displayTitle = formatProjectTaskTitle(task.title,copy.untitled);
                const period = getGanttTaskPeriod(task, windowStart, index);
                const barStart = Math.max(0, differenceInCalendarDays(period.start, windowStart));
                const barEnd = Math.min(zoom - 1, differenceInCalendarDays(period.end, windowStart));
                const showBar = barEnd >= 0 && barStart < zoom && barEnd >= barStart;
                const late = isLate(task, today);

                return (
                  <div key={task.id} className="group flex min-h-[58px] border-b last:border-b-0" dir={dir}>
                    <div className="sticky start-0 z-10 flex w-[210px] shrink-0 items-center gap-2 border-e bg-background px-3 py-2 group-hover:bg-muted/35 sm:w-[270px]">
                      <button
                        onClick={() => {
                          if (readOnly || !onUpdateTask) return;
                          void runChange(() => onUpdateTask(task.id, {
                            completed: !task.completed,
                            status: !task.completed ? "בוצע" : "לא התחיל",
                          }));
                        }}
                        disabled={readOnly || saving || !onUpdateTask}
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
                          task.completed ? "border-emerald-500 bg-emerald-500 text-white" : "hover:border-primary",
                          readOnly && "cursor-default",
                        )}
                        aria-label={(task.completed ? copy.reopen : copy.complete).replace('{title}',displayTitle)}
                      >
                        {task.completed && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span title={displayTitle} className={cn("truncate text-sm font-medium", task.completed && "text-muted-foreground line-through")}>{displayTitle}</span>
                          {task.urgent && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" title={copy.urgent} />}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {readOnly ? (
                            <span className="text-[11px] text-muted-foreground">
                              {parseLocalDate(task.due_date)?.toLocaleDateString(locale) || copy.undated}
                            </span>
                          ) : (
                            <Input
                              type="date"
                              value={parseLocalDate(task.due_date) ? task.due_date || '' : ''}
                              disabled={saving || !onUpdateTask}
                              onChange={(event) => { const due_date = event.target.value || null; void runChange(async () => { await onUpdateTask?.(task.id,{due_date}); }); }}
                              className="h-6 w-[118px] border-0 bg-transparent p-0 text-[11px] shadow-none focus-visible:ring-0"
                              aria-label={copy.dueFor.replace('{title}',displayTitle)}
                            />
                          )}
                          {late && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 px-1.5 text-[9px] text-amber-700">{copy.late}</Badge>}
                          {period.isEstimated && <span className="text-[9px] text-muted-foreground">{copy.estimated}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="relative" style={{ width: timelineWidth }} dir={dir}>
                      <div className="absolute inset-0 flex">
                        {days.map((day) => (
                          <div
                            key={toLocalDateKey(day)}
                            className={cn("h-full shrink-0 border-e", (day.getDay() === 5 || day.getDay() === 6) && "bg-muted/35")}
                            style={{ width: dayWidth }}
                          />
                        ))}
                      </div>
                      {todayOffset >= 0 && todayOffset < zoom && (
                        <div className="absolute inset-y-0 z-10 w-px bg-sky-500" style={{ insetInlineStart: todayOffset * dayWidth + dayWidth / 2 }} />
                      )}
                      {showBar && (
                        <div
                          className={cn(
                            "absolute top-1/2 z-10 h-7 -translate-y-1/2 rounded-lg border px-2 text-[10px] font-medium leading-7 shadow-sm transition-all group-hover:shadow",
                            task.completed && "border-emerald-500/30 bg-emerald-500/20 text-emerald-800",
                            !task.completed && !late && !task.urgent && "border-sky-500/30 bg-sky-500/20 text-sky-800",
                            !task.completed && task.urgent && "border-rose-500/30 bg-rose-500/20 text-rose-800",
                            late && "border-amber-500/40 bg-amber-500/20 text-amber-900",
                            period.isEstimated && "border-dashed opacity-70",
                          )}
                          style={{
                            insetInlineStart: barStart * dayWidth + 3,
                            width: Math.max((barEnd - barStart + 1) * dayWidth - 6, 24),
                          }}
                          title={`${displayTitle}${period.isEstimated ? ` (${copy.estimatedSchedule})` : ""}`}
                        >
                          <span className="block truncate">{displayTitle}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ProjectGantt;

