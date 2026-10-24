import { validDay } from './nutritionPlan.ts';
import type { HealthDay } from './healthImport.ts';

export const HEALTH_SUMMARY_TEMPLATE = 'date,steps,sleepHours,activeCalories,exerciseMinutes\n2026-10-25,6500,7.5,320,35\n';

// This is a documented interchange format, not a parser for every vendor's export.
export function parseHealthSummary(text: string, format: 'json' | 'csv'): HealthDay[] {
  if (text.length > 2_000_000) throw new Error('File too large');
  let records: unknown;
  if (format === 'json') records = JSON.parse(text);
  else {
    const [header, ...lines] = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    const columns = header.split(',').map(value => value.trim());
    if (columns.join(',') !== 'date,steps,sleepHours,activeCalories,exerciseMinutes') throw new Error('Use the provided template');
    records = lines.filter(line => line.trim()).map(line => {
      const values = line.split(',').map(value => value.trim());
      if (values.length !== columns.length) throw new Error('Invalid column count');
      return Object.fromEntries(columns.map((column, i) => [column, i === 0 ? values[i] : values[i] === '' ? null : Number(values[i])]));
    });
  }
  if (!Array.isArray(records) || !records.length || records.length > 10000) throw new Error('Invalid daily summaries');
  const dates = new Set<string>();
  const result = records.map(value => {
    if (!value || typeof value !== 'object' || !validDay(value.date) || dates.has(value.date)) throw new Error('Invalid or duplicate date');
    dates.add(value.date);
    const metric = (key: string, max: number) => {
      const number = value[key];
      if (number === undefined || number === null) return null;
      if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > max) throw new Error('Invalid metric');
      return number;
    };
    const row = { date: value.date, steps: metric('steps', 200000), sleepHours: metric('sleepHours', 24), activeCalories: metric('activeCalories', 20000), exerciseMinutes: metric('exerciseMinutes', 1440) };
    if (Object.values(row).slice(1).every(number => number === null)) throw new Error('Empty day');
    return row;
  });
  return result.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
}

export function mergeHealthDays(current: HealthDay[], incoming: HealthDay[]): HealthDay[] {
  const days = new Map(current.map(day => [day.date, day]));
  for (const day of incoming) {
    const previous = days.get(day.date);
    days.set(day.date, { date: day.date, steps: day.steps ?? previous?.steps ?? null, sleepHours: day.sleepHours ?? previous?.sleepHours ?? null, activeCalories: day.activeCalories ?? previous?.activeCalories ?? null, exerciseMinutes: day.exerciseMinutes ?? previous?.exerciseMinutes ?? null });
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
}
