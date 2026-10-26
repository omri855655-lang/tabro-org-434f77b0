export interface StudyProfile {
  weeklyHours: number;
  examDate: string;
  difficulties: string;
  materials: string;
}
export interface StudyLesson {
  title: string;
  completed?: boolean;
  scheduled_date?: string | null;
  duration_minutes?: number | null;
}
export type LessonDraft = { title: string; duration_minutes: number };

export function parseStudyProfile(value: unknown): StudyProfile {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = (key: string, limit: number) => typeof row[key] === 'string' ? row[key].slice(0, limit) : '';
  const hours = Number(row.weeklyHours);
  const date = text('examDate', 10);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  return {
    weeklyHours: Number.isFinite(hours) && hours > 0 ? Math.min(40, Math.max(1, hours)) : 4,
    examDate: validDate ? date : '', difficulties: text('difficulties', 1000), materials: text('materials', 2500),
  };
}

export function newCourseLessons(candidates: readonly StudyLesson[], existing: readonly Pick<StudyLesson, 'title'>[]): LessonDraft[] {
  const normalize = (title: string) => title.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const seen = new Set(existing.map(row => normalize(row.title)));
  const result: LessonDraft[] = [];
  for (const row of candidates) {
    const title = typeof row?.title === 'string' ? row.title.trim().slice(0, 300) : '';
    const key = normalize(title);
    if (!title || seen.has(key)) continue;
    seen.add(key);
    const minutes = Number(row.duration_minutes);
    result.push({ title, duration_minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(Math.min(300, Math.max(5, minutes))) : 30 });
    if (result.length === 60) break;
  }
  return result;
}

export function courseStudyContext(syllabus: string | null, lessons: readonly StudyLesson[], profile: StudyProfile) {
  return JSON.stringify({
    purpose: 'Course study support. Ask what the learner finds difficult. Distinguish required syllabus material from optional enrichment. Do not invent citations, links, exam dates or requirements. Help with assignment planning, not misrepresenting authorship.',
    profile: parseStudyProfile(profile),
    syllabus: (syllabus || '').slice(0, 12000),
    lessons: lessons.slice(0, 40).map(row => ({ title: row.title.slice(0, 100), completed: !!row.completed, date: row.scheduled_date || null })),
    sourceCoverage: { syllabusTruncated: (syllabus?.length || 0) > 12000, lessonsIncluded: Math.min(40, lessons.length), lessonsTotal: lessons.length },
  });
}
