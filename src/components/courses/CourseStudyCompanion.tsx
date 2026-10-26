import { useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlanningAdvisorPanel } from '@/components/PlanningAdvisor';
import { safeLocalStorage } from '@/lib/safeLocalStorage';
import { courseStudyContext, parseStudyProfile, type StudyLesson } from '@/lib/courseStudy';
import { courseStudyCopy, studyModeInstructions } from '@/lib/courseStudyCopy';
import type { AdvisorRequest } from '@/lib/planningAdvisor';
import { readSyllabusFile } from './readSyllabusFile';

interface CourseStudyProps { course: { id: string; title: string; syllabus: string | null }; lessons: StudyLesson[] }

export default function CourseStudyCompanion(props: CourseStudyProps) {
  const { user } = useAuth();
  if (!user) return null;
  return <CourseStudyPanel key={`${user.id}:${props.course.id}`} {...props} storageKey={`tabro-course-study:${user.id}:${props.course.id}`} advisorKey={`planning-advisor:${user.id}:course:${props.course.id}`} />;
}

export function CourseStudyPanel({ course, lessons, storageKey, advisorKey, requestAdvice }: CourseStudyProps & { storageKey: string; advisorKey: string; requestAdvice?: AdvisorRequest }) {
  const { lang, dir } = useLanguage();
  const copy = courseStudyCopy[lang];
  const [profile, setProfile] = useState(() => parseStudyProfile(safeLocalStorage.getJSON(storageKey, {})));
  const [status, setStatus] = useState<'saved' | 'failed' | ''>('');
  const [reading, setReading] = useState(false);
  const filePending = useRef(false);
  const change = (key: keyof typeof profile, value: string | number) => { setProfile(p => ({ ...p, [key]: value })); setStatus(''); };
  const save = () => {
    const normalized = parseStudyProfile(profile);
    const encoded = JSON.stringify(normalized);
    safeLocalStorage.setString(storageKey, encoded);
    setProfile(normalized);
    setStatus(safeLocalStorage.getString(storageKey) === encoded ? 'saved' : 'failed');
  };
  const load = async (file: File) => {
    if (filePending.current) return;
    filePending.current = true; setReading(true); setStatus('');
    try { change('materials', (await readSyllabusFile(file)).slice(0, 2500)); }
    catch { setStatus('failed'); }
    finally { filePending.current = false; setReading(false); }
  };
  return <section className="my-4 rounded-2xl border bg-card p-4 sm:p-6" dir={dir}>
    <h3 className="text-lg font-semibold">{copy.title}</h3>
    <p className="mb-5 mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">{copy.privacy}</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm">{copy.hours}<Input type="number" min={1} max={40} value={profile.weeklyHours} onChange={e => change('weeklyHours', Number(e.target.value))} /></label>
      <label className="space-y-2 text-sm">{copy.exam}<Input type="date" value={profile.examDate} onChange={e => change('examDate', e.target.value)} /></label>
      <label className="space-y-2 text-sm">{copy.difficulties}<Textarea value={profile.difficulties} maxLength={1000} onChange={e => change('difficulties', e.target.value)} /></label>
      <label className="space-y-2 text-sm">{copy.materials}<Textarea disabled={reading} value={profile.materials} maxLength={2500} onChange={e => change('materials', e.target.value)} /></label>
    </div>
    <label className="my-4 block text-sm">{copy.file}<Input type="file" accept=".pdf,.txt,.md" disabled={reading} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void load(file); }} /></label>
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={save} disabled={reading}>{copy.save}</Button><span role="status" className="text-sm">{reading ? copy.reading : status ? copy[status] : ''}</span></div>
    <PlanningAdvisorPanel storageKey={advisorKey} title={course.title} context={courseStudyContext(course.syllabus, lessons, profile)} requestAdvice={requestAdvice} quickPrompts={copy.modes.map((label, i) => ({ label, prompt: `${label}\n${studyModeInstructions[i]}` }))} />
  </section>;
}
