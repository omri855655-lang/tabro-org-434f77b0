import { useEffect, useRef, useState } from 'react';
import { Apple, ChevronDown, ChevronUp, Moon, Save, User, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useDashboardChatHistory } from '@/hooks/useDashboardChatHistory';
import { useDashboardDisplay } from '@/hooks/useDashboardDisplay';
import { useNutritionJournal } from '@/hooks/useNutritionJournal';
import { supabase } from '@/integrations/supabase/client';
import { ACTIVITY_FACTORS, dailyNutrition, nutritionTarget, mealsForDay, type NutritionProfile } from '@/lib/nutritionPlan';
import { nutritionWorkspaceCopy } from '@/lib/nutritionWorkspaceCopy';
import { nutritionTrackerCopy } from '@/lib/nutritionTrackerCopy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AiChatPanel from '@/components/AiChatPanel';
import DashboardDisplayToolbar from '@/components/DashboardDisplayToolbar';
import { MealPhotoJournal } from './MealPhotoJournal';
import { NutritionDailySummary } from './NutritionDailySummary';
import { HealthImportCard } from './HealthImportCard';

interface HealthProfile extends NutritionProfile {
  dietary_preferences: string[];
  allergies: string[];
  health_goals: string | null;
  ethnicity: string | null;
}
const emptyProfile = (): HealthProfile => ({ age: null, weight: null, height: null, gender: null, activity_level: null, dietary_preferences: [], allergies: [], health_goals: null, ethnicity: null });
const validProfile = (profile: HealthProfile) => (profile.age === null || (Number.isInteger(profile.age) && profile.age > 0 && profile.age <= 120))
  && (profile.height === null || (Number.isFinite(profile.height) && profile.height >= 30 && profile.height <= 250))
  && (profile.weight === null || (Number.isFinite(profile.weight) && profile.weight >= 2 && profile.weight <= 400));

function NutritionWorkspace({ userId }: { userId?: string }) {
  const { viewMode, themeKey, setViewMode, setTheme } = useDashboardDisplay('nutrition');
  const { lang, dir } = useLanguage(), c = nutritionTrackerCopy[lang];
  const journal = useNutritionJournal(userId);
  const [activeTab, setActiveTab] = useState('nutrition');
  const [profile, setProfile] = useState<HealthProfile>(emptyProfile);
  const [savedProfile, setSavedProfile] = useState<HealthProfile>(emptyProfile);
  const [profileLoaded, setProfileLoaded] = useState(!userId);
  const [profileError, setProfileError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const nutritionChat = useDashboardChatHistory('nutrition'), sleepChat = useDashboardChatHistory('sleep');
  const [aiLoading, setAiLoading] = useState(false);
  const [availableFood, setAvailableFood] = useState('');
  const extra = nutritionWorkspaceCopy[lang];
  const target = nutritionTarget(savedProfile, journal.preferences);
  const todaySummary = dailyNutrition(journal.history, journal.today, target);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setProfileLoaded(false); setProfileError(false);
    void (async () => {
      try {
        const { data, error } = await supabase.from('health_profiles').select('*').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        const next: HealthProfile = data ? { age: data.age, height: data.height as number | null, weight: data.weight as number | null, gender: data.gender, activity_level: data.activity_level, dietary_preferences: Array.isArray(data.dietary_preferences) ? data.dietary_preferences.filter((v): v is string => typeof v === 'string') : [], allergies: Array.isArray(data.allergies) ? data.allergies.filter((v): v is string => typeof v === 'string') : [], health_goals: data.health_goals, ethnicity: data.ethnicity } : emptyProfile();
        setProfile(next); setSavedProfile(next);
      } catch { if (!cancelled) setProfileError(true); }
      finally { if (!cancelled) setProfileLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [userId, retry]);

  const saveProfile = async () => {
    if (!userId || !profileLoaded || profileError || saving) return;
    if (!validProfile(profile)) { toast.error(c.invalidProfile); return; }
    setSaving(true);
    try {
      const cleaned = { ...profile, allergies: profile.allergies.map(v => v.trim()).filter(Boolean), dietary_preferences: profile.dietary_preferences.map(v => v.trim()).filter(Boolean) };
      const { error } = await supabase.from('health_profiles').upsert({ ...cleaned, user_id: userId }, { onConflict: 'user_id' });
      if (error) throw error;
      setProfile(cleaned); setSavedProfile(cleaned); toast.success(c.saved); setProfileOpen(false);
    } catch { toast.error(c.saveError); }
    finally { setSaving(false); }
  };

  const sendMessage = async (type: 'nutrition' | 'sleep', question: string) => {
    if (!question.trim() || aiLoading || !userId) return;
    const chat = type === 'nutrition' ? nutritionChat : sleepChat;
    const nextMessages = [...chat.messages, { role: 'user', content: question }];
    chat.setMessages(nextMessages); setAiLoading(true);
    try {
      const conversationHistory = nextMessages.slice(-12, -1).filter(message => message.role === 'user' || message.role === 'assistant').map(message => ({ role: message.role, content: message.content.slice(0, 5000) }));
      const body = type === 'nutrition' ? {
        type: 'nutrition-coach', taskDescription: question, language: lang,
        nutritionContext: { profile: { age: savedProfile.age, height: savedProfile.height, weight: savedProfile.weight, gender: savedProfile.gender, activity_level: savedProfile.activity_level, allergies: savedProfile.allergies, dietary_preferences: savedProfile.dietary_preferences, health_goals: savedProfile.health_goals }, preferences: journal.preferences, day: journal.day, meals: mealsForDay(journal.history, journal.day) },
        conversationHistory,
      } : {
        type: 'sleep-coach', taskDescription: question, language: lang,
        conversationHistory,
      };
      const { data, error } = await supabase.functions.invoke('task-ai-helper', { body, timeout: 60000 });
      if (error || typeof data?.suggestion !== 'string' || !data.suggestion.trim()) throw error || new Error('No response');
      chat.setMessages(previous => [...previous, { role: 'assistant', content: data.suggestion }]);
    } catch { chat.setMessages(previous => [...previous, { role: 'assistant', content: c.aiError }]); }
    finally { setAiLoading(false); }
  };
  const editProfile = () => { setProfileOpen(true); profileRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' }); };

  return <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4" dir={dir}>
    <div className="flex flex-wrap items-center gap-3"><Apple className="h-6 w-6 text-primary" /><h2 className="text-2xl font-bold">{c.dashboard}</h2><div className="flex-1" /><DashboardDisplayToolbar viewMode={viewMode} themeKey={themeKey} onViewModeChange={setViewMode} onThemeChange={setTheme} /></div>
    <div className="sticky top-0 z-20 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur" aria-label={c.daily}>
      <p className="mb-2 text-xs font-medium">{extra[14]}</p>
      <dl className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
        {[[c.target, target.status === 'ready' ? target.calories : null], [c.logged, todaySummary.calories], [todaySummary.remaining !== null && todaySummary.remaining < 0 ? c.above : c.remaining, todaySummary.remaining === null ? null : Math.abs(todaySummary.remaining)]].map(([label, value]) => <div key={String(label)}><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{typeof value === 'number' ? Math.round(value).toLocaleString(lang) : '—'} {c.kcal}</dd></div>)}
      </dl>
    </div>
    {!profileLoaded && <p role="status" className="text-sm">{c.loading}</p>}
    {profileError && <div role="alert" className="rounded-xl border p-3 text-sm"><p>{c.profileError}</p><Button variant="outline" className="mt-2" onClick={() => setRetry(value => value + 1)}>{c.reload}</Button></div>}
    <div ref={profileRef}><Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
      <Card><CollapsibleTrigger className="w-full"><CardHeader className="py-3 transition-colors hover:bg-muted/30"><CardTitle className="flex items-center justify-between gap-2 text-base"><span className="flex items-center gap-2"><User className="h-5 w-5" />{c.profile}</span>{profileOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</CardTitle></CardHeader></CollapsibleTrigger>
        <CollapsibleContent><CardContent className="space-y-3 pt-0"><p className="text-sm text-muted-foreground">{c.profileHelp}</p>
          <fieldset disabled={!profileLoaded || profileError || saving} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">{(['age', 'weight', 'height'] as const).map(field => <label key={field} className="text-xs">{c[field]}<Input className="mt-1" type="number" step={field === 'age' ? 1 : 0.1} min={field === 'age' ? 1 : field === 'weight' ? 2 : 30} max={field === 'age' ? 120 : field === 'weight' ? 400 : 250} value={profile[field] ?? ''} onChange={event => setProfile(previous => ({ ...previous, [field]: event.target.value === '' ? null : Number(event.target.value) }))} /></label>)}
              <label className="text-xs">{c.sex}<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={profile.gender || ''} onChange={e => setProfile(previous => ({ ...previous, gender: e.target.value || null }))}><option value="">—</option><option value="male">{c.male}</option><option value="female">{c.female}</option></select></label>
              <label className="text-xs sm:col-span-2">{c.activity}<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={profile.activity_level || ''} onChange={e => setProfile(previous => ({ ...previous, activity_level: e.target.value || null }))}><option value="">—</option>{(Object.keys(ACTIVITY_FACTORS) as (keyof typeof ACTIVITY_FACTORS)[]).map(activity => <option key={activity} value={activity}>{c[activity]}</option>)}</select></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">{(['allergies', 'dietary_preferences'] as const).map(field => <label key={field} className="text-xs">{field === 'allergies' ? c.allergies : c.preferences}<Input className="mt-1" maxLength={2000} value={profile[field].join(',')} onChange={e => setProfile(previous => ({ ...previous, [field]: e.target.value.split(/[,،]/).slice(0, 20) }))} /></label>)}</div>
            <label className="block text-xs">{c.healthGoals}<Textarea className="mt-1 min-h-[60px]" maxLength={1000} value={profile.health_goals || ''} onChange={e => setProfile(previous => ({ ...previous, health_goals: e.target.value }))} /></label>
            <label className="block text-xs">{c.ethnicity}<Input className="mt-1" maxLength={120} value={profile.ethnicity || ''} onChange={e => setProfile(previous => ({ ...previous, ethnicity: e.target.value }))} /></label>
            <Button disabled={!userId || saving} onClick={() => void saveProfile()}><Save className="me-2 h-4 w-4" />{saving ? c.loading : c.save}</Button>
          </fieldset>
        </CardContent></CollapsibleContent>
      </Card>
    </Collapsible></div>
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="w-full"><TabsTrigger value="nutrition" className="flex-1 gap-2"><UtensilsCrossed className="h-4 w-4" />{c.nutrition}</TabsTrigger><TabsTrigger value="sleep" className="flex-1 gap-2"><Moon className="h-4 w-4" />{c.sleep}</TabsTrigger></TabsList>
      <TabsContent value="nutrition" className="space-y-4">
        <NutritionDailySummary profile={savedProfile} journal={journal} onEditProfile={editProfile} />
        <MealPhotoJournal userId={userId} journal={journal} profile={savedProfile} />
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">{c.aiPrivacy}</p>
        <form className="space-y-3 rounded-2xl border bg-card p-4" onSubmit={event => { event.preventDefault(); void sendMessage('nutrition', `${extra[8]}\n${availableFood.trim()}`); }}>
          <label className="block font-medium">{extra[5]}<Textarea className="mt-2" maxLength={1200} value={availableFood} onChange={e => setAvailableFood(e.target.value)} placeholder={extra[6]} /></label>
          <Button type="submit" disabled={!availableFood.trim() || aiLoading || !userId}>{aiLoading ? c.loading : extra[7]}</Button>
        </form>
        <AiChatPanel title={c.coach} messages={nutritionChat.messages} loaded={nutritionChat.loaded} aiLoading={aiLoading} archive={nutritionChat.archive} onSend={msg => void sendMessage('nutrition', msg)} onClearAndArchive={nutritionChat.clearAndArchive} onLoadConversation={nutritionChat.loadConversation} placeholder={c.ask} emptyText={c.ask} quickPrompts={c.nutritionPrompts} />
      </TabsContent>
      <TabsContent value="sleep" className="space-y-4"><HealthImportCard /><AiChatPanel title={c.sleepCoach} messages={sleepChat.messages} loaded={sleepChat.loaded} aiLoading={aiLoading} archive={sleepChat.archive} onSend={msg => void sendMessage('sleep', msg)} onClearAndArchive={sleepChat.clearAndArchive} onLoadConversation={sleepChat.loadConversation} placeholder={c.askSleep} emptyText={c.askSleep} quickPrompts={c.sleepPrompts} /></TabsContent>
    </Tabs>
  </div>;
}

export default function NutritionDashboard() {
  const { user } = useAuth();
  return <NutritionWorkspace key={user?.id || 'guest'} userId={user?.id} />;
}
