export interface SchedulableTask {
  id: string;
  completed: boolean;
  due_date: string | null;
  sort_order: number;
}

export interface GanttTaskPeriod {
  start: Date;
  end: Date;
  isEstimated: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (value: string | null | undefined) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const addCalendarDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const differenceInCalendarDays = (later: Date, earlier: Date) => {
  const normalizedLater = new Date(later.getFullYear(), later.getMonth(), later.getDate()).getTime();
  const normalizedEarlier = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate()).getTime();
  return Math.round((normalizedLater - normalizedEarlier) / DAY_MS);
};

export const createScheduleDates = (count: number, startDate: Date, targetDate?: Date | null) => {
  if (count <= 0) return [];

  const minimumTarget = addCalendarDays(startDate, Math.max(count - 1, 0));
  const resolvedTarget = targetDate && targetDate >= minimumTarget
    ? targetDate
    : addCalendarDays(startDate, Math.max(count * 2 - 1, 0));
  const availableDays = Math.max(differenceInCalendarDays(resolvedTarget, startDate), count - 1);

  return Array.from({ length: count }, (_, index) => {
    const offset = count === 1 ? availableDays : Math.round((index * availableDays) / (count - 1));
    return toLocalDateKey(addCalendarDays(startDate, offset));
  });
};

export const buildAutomaticSchedule = (
  tasks: SchedulableTask[],
  startDate: Date,
  targetDate?: Date | null,
) => {
  const openTasks = [...tasks]
    .filter((task) => !task.completed)
    .sort((a, b) => a.sort_order - b.sort_order);
  const dates = createScheduleDates(openTasks.length, startDate, targetDate);

  return openTasks.map((task, index) => ({ id: task.id, due_date: dates[index] }));
};

export const getGanttTaskPeriod = (
  task: Pick<SchedulableTask, "due_date">,
  fallbackStart: Date,
  fallbackIndex: number,
): GanttTaskPeriod => {
  const dueDate = parseLocalDate(task.due_date);
  if (!dueDate) {
    const start = addCalendarDays(fallbackStart, fallbackIndex * 2);
    return { start, end: addCalendarDays(start, 1), isEstimated: true };
  }

  return {
    start: addCalendarDays(dueDate, -2),
    end: dueDate,
    isEstimated: false,
  };
};

export const formatProjectTaskTitle = (value: string) => {
  const title = value.trim();
  if (!title) return "משימה ללא שם";

  try {
    const parsed = JSON.parse(title) as { title?: unknown; description?: unknown };
    if (typeof parsed.title === "string" && parsed.title.trim()) return parsed.title.trim();
    if (typeof parsed.description === "string" && parsed.description.trim()) return parsed.description.trim();
  } catch {
    // Some older AI tasks contain only a JSON fragment rather than a full object.
  }

  const embeddedTitle = title.match(/"title"\s*:\s*"([^"]+)"/);
  if (embeddedTitle?.[1]) return embeddedTitle[1].trim();

  const embeddedDescription = title.match(/"description"\s*:\s*"([^"]+)"/);
  if (embeddedDescription?.[1]) {
    const description = embeddedDescription[1].trim();
    return description.length > 100 ? `${description.slice(0, 97)}...` : description;
  }

  const truncatedDescription = title.match(/^"description"\s*:\s*"?([\s\S]*)$/);
  if (truncatedDescription?.[1]) {
    const description = truncatedDescription[1]
      .replace(/["'},\s]+$/, "")
      .replace(/\\n/g, " ")
      .trim();
    return description.length > 100 ? `${description.slice(0, 97)}...` : description;
  }

  return title;
};

