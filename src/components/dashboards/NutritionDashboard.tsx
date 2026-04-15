import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Apple, Sparkles, MessageCircle, User, ChevronDown, ChevronUp, Save, UtensilsCrossed, Moon as MoonIcon, Dumbbell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useDashboardChatHistory } from "@/hooks/useDashboardChatHistory";
import AiChatPanel from "@/components/AiChatPanel";
import DashboardDisplayToolbar from "@/components/DashboardDisplayToolbar";
import { useDashboardDisplay } from "@/hooks/useDashboardDisplay";
import { useLanguage } from "@/hooks/useLanguage";

interface HealthProfile {
  age: number | null;
  weight: number | null;
  height: number | null;
  gender: string | null;
  activity_level: string | null;
  dietary_preferences: string[];
  allergies: string[];
  health_goals: string | null;
  ethnicity: string | null;
}

const NutritionDashboard = () => {
  const { viewMode, themeKey, setViewMode, setTheme } = useDashboardDisplay("nutrition");
  const { user } = useAuth();
  const { lang, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState("nutrition");
  const [profile, setProfile] = useState<HealthProfile>({
    age: null, weight: null, height: null, gender: null,
    activity_level: "moderate", dietary_preferences: [], allergies: [],
    health_goals: null, ethnicity: null,
  });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Persistent AI Chat with archive
  const nutritionChatHistory = useDashboardChatHistory("nutrition");
  const sleepChatHistory = useDashboardChatHistory("sleep");
  const [nutritionInput, setNutritionInput] = useState("");
  const [sleepInput, setSleepInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const copy = {
    he: {
      saveError: "שגיאה בשמירה",
      saved: "פרופיל בריאות נשמר ✅",
      communicationError: "שגיאה בתקשורת",
      loading: "טוען...",
      title: "תזונה ושינה",
      profile: "פרופיל בריאות",
      profileHelp: "מלא את הפרטים שלך כדי לקבל המלצות מותאמות אישית",
      saveProfile: "שמור פרופיל",
      nutrition: "תזונה",
      sleep: "שינה",
      nutritionAi: "יועץ תזונה AI",
      sleepAi: "מדריך שינה AI",
      askNutrition: "שאל על תזונה...",
      askSleep: "שאל על שינה...",
      nutritionEmpty: "שאל על תזונה, דיאטות, תפריטים ועוד",
      sleepEmpty: "שאל על שינה, הרגלים, מדריכים ועוד",
    },
    en: {
      saveError: "Error saving",
      saved: "Health profile saved ✅",
      communicationError: "Communication error",
      loading: "Loading...",
      title: "Nutrition & Sleep",
      profile: "Health Profile",
      profileHelp: "Fill in your details to get personalized recommendations",
      saveProfile: "Save profile",
      nutrition: "Nutrition",
      sleep: "Sleep",
      nutritionAi: "AI Nutrition Coach",
      sleepAi: "AI Sleep Guide",
      askNutrition: "Ask about nutrition...",
      askSleep: "Ask about sleep...",
      nutritionEmpty: "Ask about nutrition, diets, meal plans, and more",
      sleepEmpty: "Ask about sleep, habits, guides, and more",
    },
  }[lang === "he" ? "he" : "en"];

  // Fetch health profile
  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("health_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProfile({
          age: data.age,
          weight: data.weight as number | null,
          height: data.height as number | null,
          gender: data.gender,
          activity_level: data.activity_level,
          dietary_preferences: (data.dietary_preferences as string[]) || [],
          allergies: (data.allergies as string[]) || [],
          health_goals: data.health_goals,
          ethnicity: data.ethnicity,
        });
      }
      setProfileLoaded(true);
    };
    fetch();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      age: profile.age,
      weight: profile.weight,
      height: profile.height,
      gender: profile.gender,
      activity_level: profile.activity_level,
      dietary_preferences: profile.dietary_preferences,
      allergies: profile.allergies,
      health_goals: profile.health_goals,
      ethnicity: profile.ethnicity,
    };

    const { error } = await supabase.from("health_profiles").upsert(payload, { onConflict: "user_id" });
    if (error) { toast.error(copy.saveError); return; }
    toast.success(copy.saved);
  };

  const getProfileContext = () => {
    const parts: string[] = [];
    if (profile.age) parts.push(`גיל: ${profile.age}`);
    if (profile.weight) parts.push(`משקל: ${profile.weight} ק"ג`);
    if (profile.height) parts.push(`גובה: ${profile.height} ס"מ`);
    if (profile.gender) parts.push(`מין: ${profile.gender}`);
    if (profile.activity_level) parts.push(`רמת פעילות: ${profile.activity_level}`);
    if (profile.ethnicity) parts.push(`מוצא: ${profile.ethnicity}`);
    if (profile.dietary_preferences.length) parts.push(`העדפות: ${profile.dietary_preferences.join(", ")}`);
    if (profile.allergies.length) parts.push(`אלרגיות: ${profile.allergies.join(", ")}`);
    if (profile.health_goals) parts.push(`מטרות: ${profile.health_goals}`);
    return parts.join(". ");
  };

  const sendMessage = async (type: "nutrition" | "sleep", chatInput: string) => {
    const history = type === "nutrition" ? nutritionChatHistory : sleepChatHistory;

    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    const nextMessages = [...history.messages, userMsg];
    history.setMessages(nextMessages);
    setAiLoading(true);

    const profileCtx = getProfileContext();
    const systemPrompt = type === "nutrition"
      ? `אתה תזונאי מומחה מבוסס מחקרים. ${profileCtx ? `פרופיל המשתמש: ${profileCtx}.` : ""} 
         ספק עצות תזונה מותאמות אישית, תפריטים, דיאטות, וחלופות בריאות. 
         התייחס למחקרים ומקורות מקצועיים. כולל BMI, צריכה קלורית יומית מומלצת.
         אם למשתמש יש מוצא אתני ספציפי, התייחס לזה (למשל אנשים מסוימים נוטים לשמן באזורי גוף מסוימים).`
      : `אתה מומחה שינה מבוסס מחקרים מספרים כמו "Why We Sleep" (Matthew Walker), "The Sleep Revolution" (Arianna Huffington).
         ${profileCtx ? `פרופיל: ${profileCtx}.` : ""}
         ספק עצות שינה מותאמות אישית, מדריכים, והסברים מדעיים על שינה בריאה.`;

    try {
      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          taskDescription: chatInput,
          taskCategory: type,
          conversationHistory: nextMessages.slice(-20),
          customPrompt: `${systemPrompt}\n\nהמשתמש שואל: ${chatInput}`,
        },
      });
      if (error) throw error;
      history.setMessages(prev => [...prev, { role: "assistant", content: data?.suggestion || "אין תשובה" }]);
    } catch {
      history.setMessages(prev => [...prev, { role: "assistant", content: copy.communicationError }]);
    }
    setAiLoading(false);
  };

  const quickNutritionPrompts = [
    "תן לי תפריט יומי בריא",
    "מה הצריכה הקלורית המומלצת שלי?",
    "תכנן לי דיאטה ים-תיכונית",
    "מה לאכול לפני ואחרי אימון?",
    "תן לי חלופות בריאות לחטיפים",
    "תפריט דיאטת קטו שבועי",
    "מאכלים שמגבירים אנרגיה",
  ];

  const quickSleepPrompts = [
    "איך לשפר את איכות השינה?",
    "מה הזמן האידיאלי ללכת לישון?",
    "מדריך שגרת ערב מושלמת",
    "מאכלים שעוזרים לישון טוב",
    "איך להתמודד עם נדודי שינה?",
    "כמה שעות שינה אני צריך?",
    "מדריך Power Nap",
  ];

  if (!profileLoaded) return <div className="p-6 text-center text-muted-foreground">{copy.loading}</div>;

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto" dir={dir}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Apple className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">{copy.title}</h2>
        <div className="flex-1" />
        <DashboardDisplayToolbar viewMode={viewMode} themeKey={themeKey} onViewModeChange={setViewMode} onThemeChange={setTheme} />
      </div>

      {/* Health Profile Collapsible */}
      <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="py-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <CardTitle className="text-base flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2"><User className="h-5 w-5" />{copy.profile}</div>
                {profileOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 pt-0">
              <p className="text-sm text-muted-foreground">{copy.profileHelp}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Input type="number" placeholder="גיל" value={profile.age || ""} onChange={e => setProfile(p => ({ ...p, age: e.target.value ? parseInt(e.target.value) : null }))} />
                <Input type="number" placeholder='משקל (ק"ג)' value={profile.weight || ""} onChange={e => setProfile(p => ({ ...p, weight: e.target.value ? parseFloat(e.target.value) : null }))} />
                <Input type="number" placeholder='גובה (ס"מ)' value={profile.height || ""} onChange={e => setProfile(p => ({ ...p, height: e.target.value ? parseFloat(e.target.value) : null }))} />
                <Select value={profile.gender || ""} onValueChange={v => setProfile(p => ({ ...p, gender: v }))}>
                  <SelectTrigger><SelectValue placeholder="מין" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">זכר</SelectItem>
                    <SelectItem value="female">נקבה</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={profile.activity_level || "moderate"} onValueChange={v => setProfile(p => ({ ...p, activity_level: v }))}>
                  <SelectTrigger><SelectValue placeholder="רמת פעילות" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">יושבני</SelectItem>
                    <SelectItem value="light">קל</SelectItem>
                    <SelectItem value="moderate">בינוני</SelectItem>
                    <SelectItem value="active">פעיל</SelectItem>
                    <SelectItem value="very_active">מאוד פעיל</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="מוצא אתני" value={profile.ethnicity || ""} onChange={e => setProfile(p => ({ ...p, ethnicity: e.target.value }))} />
              </div>
              <Textarea placeholder="מטרות בריאות (ירידה במשקל, בניית שריר, אנרגיה...)" value={profile.health_goals || ""} onChange={e => setProfile(p => ({ ...p, health_goals: e.target.value }))} className="min-h-[60px]" />
              <Button onClick={saveProfile} className="gap-2"><Save className="h-4 w-4" />{copy.saveProfile}</Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="nutrition" className="flex-1 gap-2"><UtensilsCrossed className="h-4 w-4" />{copy.nutrition}</TabsTrigger>
          <TabsTrigger value="sleep" className="flex-1 gap-2"><MoonIcon className="h-4 w-4" />{copy.sleep}</TabsTrigger>
        </TabsList>

        {/* Nutrition Tab */}
        <TabsContent value="nutrition" className="space-y-4">
          <AiChatPanel
            title={copy.nutritionAi}
            messages={nutritionChatHistory.messages}
            loaded={nutritionChatHistory.loaded}
            aiLoading={aiLoading}
            archive={nutritionChatHistory.archive}
            onSend={(msg) => sendMessage("nutrition", msg)}
            onClearAndArchive={nutritionChatHistory.clearAndArchive}
            onLoadConversation={nutritionChatHistory.loadConversation}
            placeholder={copy.askNutrition}
            emptyText={copy.nutritionEmpty}
            quickPrompts={quickNutritionPrompts}
          />
        </TabsContent>

        {/* Sleep Tab */}
        <TabsContent value="sleep" className="space-y-4">
          <AiChatPanel
            title={copy.sleepAi}
            messages={sleepChatHistory.messages}
            loaded={sleepChatHistory.loaded}
            aiLoading={aiLoading}
            archive={sleepChatHistory.archive}
            onSend={(msg) => sendMessage("sleep", msg)}
            onClearAndArchive={sleepChatHistory.clearAndArchive}
            onLoadConversation={sleepChatHistory.loadConversation}
            placeholder={copy.askSleep}
            emptyText={copy.sleepEmpty}
            quickPrompts={quickSleepPrompts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NutritionDashboard;
