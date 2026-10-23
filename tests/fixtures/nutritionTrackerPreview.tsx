import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '@/hooks/useLanguage';
import { useNutritionJournal } from '@/hooks/useNutritionJournal';
import { NutritionDailySummary } from '@/components/dashboards/NutritionDailySummary';
import { MealPhotoJournal } from '@/components/dashboards/MealPhotoJournal';
import '@/index.css';

const profile = { age: 30, weight: 80, height: 180, gender: 'male', activity_level: 'moderate' };
function Fixture() {
  const journal = useNutritionJournal('nutrition-public-fixture-only');
  return <main className="mx-auto max-w-4xl space-y-4 p-4"><p className="rounded border p-2 text-xs">QA fixture: sample adult profile; local test data only. No account or AI requests.</p><NutritionDailySummary profile={profile} journal={journal} onEditProfile={() => {}} /><MealPhotoJournal journal={journal} profile={profile} /></main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><Fixture /></LanguageProvider>);
