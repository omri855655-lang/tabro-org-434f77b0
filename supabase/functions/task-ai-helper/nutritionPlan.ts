import { mealTotals, parseMealEstimate, type SavedMeal } from './mealEstimate.ts';

export const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 } as const;
export type NutritionGoal = 'maintain' | 'lose' | 'gain';
export interface NutritionProfile {
  age: number | null;
  height: number | null;
  weight: number | null;
  gender: string | null;
  activity_level: string | null;
  allergies?: string[];
  dietary_preferences?: string[];
  health_goals?: string | null;
}
export interface NutritionPreferences { goal: NutritionGoal; eligible: boolean }
export const DEFAULT_NUTRITION_PREFERENCES: NutritionPreferences = { goal: 'maintain', eligible: false };
export function parseNutritionPreferences(value: unknown): NutritionPreferences {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { goal: row.goal === 'lose' || row.goal === 'gain' ? row.goal : 'maintain', eligible: row.eligible === true };
}
export type NutritionTarget = { status: 'ready'; calories: number; maintenance: number; resting: number; goal: NutritionGoal }
  | { status: 'incomplete' | 'specialist' | 'unsupported' };

export function nutritionTarget(profile: NutritionProfile, preferences: NutritionPreferences): NutritionTarget {
  const { age, height, weight, gender, activity_level } = profile;
  if ([age, height, weight].some(value => value === null) || !gender || !activity_level) return { status: 'incomplete' };
  if (!preferences.eligible || (age !== null && age < 18)) return { status: 'specialist' };
  if (typeof age !== 'number' || !Number.isInteger(age) || age > 80 || age < 18
    || typeof height !== 'number' || !Number.isFinite(height) || height < 120 || height > 230
    || typeof weight !== 'number' || !Number.isFinite(weight) || weight < 35 || weight > 300
    || !['male', 'female'].includes(gender) || !Object.hasOwn(ACTIVITY_FACTORS, activity_level)) return { status: 'unsupported' };
  const bmi = weight / (height / 100) ** 2;
  if (preferences.goal === 'lose' && bmi < 18.5) return { status: 'specialist' };
  // Mifflin-St Jeor estimates resting needs, not a measured daily allowance.
  const resting = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
  const maintenance = Math.round(resting * ACTIVITY_FACTORS[activity_level as keyof typeof ACTIVITY_FACTORS] / 50) * 50;
  const adjustment = preferences.goal === 'lose' ? -250 : preferences.goal === 'gain' ? 250 : 0;
  const calories = Math.max(Math.ceil(resting / 50) * 50, 1500, maintenance + adjustment);
  if (maintenance < 1500 || calories > 5000) return { status: 'specialist' };
  return { status: 'ready', calories, maintenance, resting: Math.round(resting), goal: preferences.goal };
}

export function localDay(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid date');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDay(date) === value;
}
export function mealsForDay(meals: SavedMeal[], day: string): SavedMeal[] {
  if (!validDay(day)) return [];
  return meals.filter(meal => {
    const date = new Date(meal.date);
    return Number.isFinite(date.getTime()) && localDay(date) === day;
  });
}
export function dailyNutrition(meals: SavedMeal[], day: string, target: NutritionTarget) {
  const entries = mealsForDay(meals, day);
  const total = mealTotals(entries.flatMap(entry => entry.items));
  const remaining = target.status === 'ready' ? target.calories - total.calories : null;
  return { entries, ...total, remaining };
}
export function parseMealHistory(value: unknown): SavedMeal[] {
  if (!Array.isArray(value)) throw new Error('Invalid journal');
  return value.flatMap(raw => {
    try {
      if (!raw || typeof raw !== 'object') return [];
      const row = raw as Record<string, unknown>;
      if (typeof row.id !== 'string' || !row.id || typeof row.date !== 'string' || !Number.isFinite(new Date(row.date).getTime())) return [];
      return [{ ...parseMealEstimate(row), id: row.id, date: row.date }];
    } catch { return []; }
  });
}

export interface NutritionCoachContext {
  profile: NutritionProfile;
  preferences: NutritionPreferences;
  day: string;
  meals: SavedMeal[];
}
export function parseNutritionCoachContext(value: unknown): NutritionCoachContext {
  if (!value || typeof value !== 'object') throw new Error('Invalid nutrition context');
  const row = value as Record<string, unknown>;
  if (!row.profile || typeof row.profile !== 'object' || !validDay(row.day) || !Array.isArray(row.meals) || row.meals.length > 100) throw new Error('Invalid nutrition context');
  const raw = row.profile as Record<string, unknown>;
  const metric = (key: string) => typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? raw[key] as number : null;
  const list = (key: string) => Array.isArray(raw[key]) ? raw[key].filter((v: unknown): v is string => typeof v === 'string').slice(0, 20).map((v: string) => v.slice(0, 120)) : [];
  const profile: NutritionProfile = { age: metric('age'), height: metric('height'), weight: metric('weight'), gender: typeof raw.gender === 'string' ? raw.gender.slice(0, 20) : null, activity_level: typeof raw.activity_level === 'string' ? raw.activity_level.slice(0, 20) : null, allergies: list('allergies'), dietary_preferences: list('dietary_preferences'), health_goals: typeof raw.health_goals === 'string' ? raw.health_goals.slice(0, 1000) : null };
  const preferences = parseNutritionPreferences(row.preferences);
  const meals = parseMealHistory(row.meals);
  if (meals.length !== row.meals.length) throw new Error('Invalid nutrition meals');
  // The client already groups by its local day. Do not regroup ISO dates in the server's UTC timezone.
  return { profile, preferences, day: row.day, meals };
}
export function nutritionCoachFacts(context: NutritionCoachContext) {
  const target = nutritionTarget(context.profile, context.preferences);
  const total = mealTotals(context.meals.flatMap(entry => entry.items));
  return { day: context.day, target, logged: total, remaining: target.status === 'ready' ? target.calories - total.calories : null, meals: context.meals.map(meal => meal.items.map(item => ({ name: item.name, grams: item.grams }))), allergies: context.profile.allergies || [], preferences: context.profile.dietary_preferences || [], userNotes: context.profile.health_goals || '' };
}
