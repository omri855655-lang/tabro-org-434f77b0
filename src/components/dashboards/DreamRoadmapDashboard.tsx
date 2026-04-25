import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Target, Sparkles, ChevronDown, ChevronUp, MapPin, CheckCircle2, Calendar, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDashboardChatHistory } from "@/hooks/useDashboardChatHistory";
import AiChatPanel from "@/components/AiChatPanel";
import { useLanguage } from "@/hooks/useLanguage";

interface DreamMilestone {
  id: string;
  title: string;
  done: boolean;
  week?: number;
}

interface DreamGoal {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  progress: number;
  milestones: DreamMilestone[];
  ai_roadmap: any;
  notes: string | null;
  category: string | null;
  archived: boolean;
  created_at: string;
}

const MILESTONE_OPTIONS = [10, 15, 20, 30, 40, 50, 75];

const parseRoadmapLines = (rawText: string, requestedCount: number, stageLabel: string) => {
  const lines = rawText
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•\d\.\)\-]+\s*/, "").trim())
    .filter((line) => line.length >= 2 && line.length <= 220)
    .filter((line) => !line.startsWith("{") && !line.startsWith("[") && !line.includes("```"))
    .slice(0, requestedCount);

  return lines.map((title, index) => ({
    id: `ms-fallback-${Date.now()}-${index}`,
    title: title || `${stageLabel} ${index + 1}`,
    done: false,
    week: index + 1,
  }));
};

const DreamRoadmapDashboard = () => {
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  const { user } = useAuth();
  const [goals, setGoals] = useState<DreamGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [generatingRoadmap, setGeneratingRoadmap] = useState<string | null>(null);
  const [milestoneCount, setMilestoneCount] = useState<Record<string, string>>({});
  const [pendingRoadmap, setPendingRoadmap] = useState<{ goalId: string; milestones: DreamMilestone[] } | null>(null);

  // Use DB-persisted chat history per goal (keyed by "dreams-{goalId}")
  const [activeGoalChatId, setActiveGoalChatId] = useState<string | null>(null);
  const dreamChatHistory = useDashboardChatHistory(`dreams-${activeGoalChatId || "none"}`);
  const copy = isHebrew ? {
    load: "טוען...",
    genericError: "שגיאה",
    dreamAdded: "חלום חדש נוסף! 🌟",
    deleted: "נמחק",
    chooseMilestones: "בחר מספר בין 10 ל-75",
    roadmapError: "שגיאה ביצירת מפת דרכים",
    roadmapCreated: "נוצרו",
    roadmapCheck: "אבני דרך - בדוק ואשר ✅",
    saveError: "שגיאה בשמירה",
    roadmapApproved: "מפת הדרכים אושרה! 🎯",
    plannerError: "שגיאה בהוספה ללוז",
    addedToPlanner: "נוסף למתכנן הלוז! 📅",
    plannerGenericError: "שגיאה",
    allAddedToPlanner: "אבני דרך נוספו ללוז! 📅",
    title: "מפת חלומות",
    dreamPrompt: "מה החלום שלך? (לדוגמה: להקים פודקאסט, לפתוח עסק...)",
    dreamDesc: "תאר את החלום בכמה מילים (אופציונלי)...",
    addDream: "הוסף חלום",
    readyRoadmap: "מפת דרכים מוכנה",
    milestones: "אבני דרך",
    approve: "מרוצה! אשר ושמור",
    regenerate: "צור מחדש",
    cancel: "ביטול",
    howMany: "כמה אבני דרך?",
    generating: "יוצר מפת דרכים...",
    generate: "צור מפת דרכים עם AI 🗺️",
    milestonesTitle: "אבני דרך",
    addAllPlanner: "הוסף הכל ללוז",
    addToPlanner: "הוסף ללוז",
    aiError: "שגיאה",
    noAnswer: "אין תשובה",
    stage: "שלב",
  } : {
    load: "Loading...",
    genericError: "Error",
    dreamAdded: "New dream added! 🌟",
    deleted: "Deleted",
    chooseMilestones: "Choose a number between 10 and 75",
    roadmapError: "Error creating roadmap",
    roadmapCreated: "Created",
    roadmapCheck: "milestones - review and approve ✅",
    saveError: "Error saving",
    roadmapApproved: "Roadmap approved! 🎯",
    plannerError: "Error adding to planner",
    addedToPlanner: "Added to planner! 📅",
    plannerGenericError: "Error",
    allAddedToPlanner: "Milestones added to planner! 📅",
    title: "Dream roadmap",
    dreamPrompt: "What's your dream? (for example: launch a podcast, start a business...)",
    dreamDesc: "Describe the dream in a few words (optional)...",
    addDream: "Add dream",
    readyRoadmap: "Roadmap ready",
    milestones: "milestones",
    approve: "Looks good! Approve & save",
    regenerate: "Generate again",
    cancel: "Cancel",
    howMany: "How many milestones?",
    generating: "Creating roadmap...",
    generate: "Create roadmap with AI 🗺️",
    milestonesTitle: "Milestones",
    addAllPlanner: "Add all to planner",
    addToPlanner: "Add to planner",
    aiError: "Error",
    noAnswer: "No answer",
    stage: "Stage",
  };

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("dream_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    setGoals(
      ((data as any[]) || []).map((goal) => ({
        ...goal,
        milestones: Array.isArray(goal.milestones) ? goal.milestones : [],
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const addGoal = async () => {
    if (!user || !newTitle.trim()) return;
    const { error } = await supabase.from("dream_goals").insert({
      user_id: user.id,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
    });
    if (error) { toast.error(copy.genericError); return; }
    setNewTitle("");
    setNewDescription("");
    toast.success(copy.dreamAdded);
    fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase
      .from("dream_goals")
      .update({ archived: true })
      .eq("id", id);
    if (error) {
      console.error("Dream goal archive error", error);
      toast.error(copy.genericError);
      return;
    }
    setGoals((prev) => prev.filter((goal) => goal.id !== id));
    toast.success(copy.deleted);
  };

  const normalizeMilestones = (items: any[], requestedCount: number): DreamMilestone[] => {
    const cleaned = items
      .map((item, index) => ({
        id: `ms-${Date.now()}-${index}`,
        title: (typeof item?.title === "string" ? item.title.trim() : "") || `${copy.stage} ${index + 1}`,
        done: false,
        week: Number(item?.week) || index + 1,
      }))
      .filter((item) => item.title.length > 0);

    if (cleaned.length >= requestedCount) return cleaned.slice(0, requestedCount);
    const padded = [...cleaned];
    while (padded.length < requestedCount) {
      padded.push({ id: `ms-${Date.now()}-pad-${padded.length}`, title: `${copy.stage} ${padded.length + 1}`, done: false, week: padded.length + 1 });
    }
    return padded;
  };

  const generateRoadmap = async (goal: DreamGoal) => {
    const requestedCount = parseInt(milestoneCount[goal.id] || "15", 10);
    if (requestedCount < 10 || requestedCount > 75) { toast.error(copy.chooseMilestones); return; }
    setGeneratingRoadmap(goal.id);
    try {
      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: { taskDescription: goal.title, taskCategory: "dream_roadmap", customPrompt: goal.description || "", milestoneCount: requestedCount },
      });
      if (error) throw error;
      let milestones = normalizeMilestones(Array.isArray(data?.milestones) ? data.milestones : [], requestedCount);
      if (milestones.length === 0 && typeof data?.suggestion === "string") {
        milestones = parseRoadmapLines(data.suggestion, requestedCount, copy.stage);
      }
      if (milestones.length === 0) {
        throw new Error("No milestones generated");
      }
      setPendingRoadmap({ goalId: goal.id, milestones });
      toast.success(`${copy.roadmapCreated} ${milestones.length} ${copy.roadmapCheck}`);
    } catch (generationError) {
      console.error("Dream roadmap generation error", generationError);
      toast.error(copy.roadmapError);
    } finally { setGeneratingRoadmap(null); }
  };

  const approveRoadmap = async () => {
    if (!pendingRoadmap) return;
    const { goalId, milestones } = pendingRoadmap;
    const { error } = await supabase.from("dream_goals").update({ milestones: milestones as any, ai_roadmap: { generated: true, count: milestones.length } as any }).eq("id", goalId);
    if (error) { toast.error(copy.saveError); return; }
    setGoals((prev) => prev.map((goal) => (goal.id === goalId ? { ...goal, milestones, ai_roadmap: { generated: true } } : goal)));
    setPendingRoadmap(null);
    toast.success(copy.roadmapApproved);
  };

  const regeneratePendingRoadmap = async () => {
    if (!pendingRoadmap) return;
    const goal = goals.find((item) => item.id === pendingRoadmap.goalId);
    setPendingRoadmap(null);
    if (goal) await generateRoadmap(goal);
  };

  const toggleMilestone = async (goalId: string, milestoneId: string) => {
    const goal = goals.find((item) => item.id === goalId);
    if (!goal) return;
    const updatedMilestones = goal.milestones.map((m) => m.id === milestoneId ? { ...m, done: !m.done } : m);
    const progress = Math.round((updatedMilestones.filter((m) => m.done).length / updatedMilestones.length) * 100);
    await supabase.from("dream_goals").update({ milestones: updatedMilestones as any, progress }).eq("id", goalId);
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, milestones: updatedMilestones, progress } : g)));
  };

  const addMilestoneToCalendar = async (goal: DreamGoal, milestone: DreamMilestone) => {
    if (!user) return;
    const startDate = new Date();
    if (milestone.week) startDate.setDate(startDate.getDate() + (milestone.week - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
    const { error } = await supabase.from("calendar_events").insert({
      user_id: user.id, title: `🎯 ${goal.title}: ${milestone.title}`,
      start_time: startDate.toISOString(), end_time: endDate.toISOString(),
      category: "חלום", source_type: "dream", source_id: goal.id,
    });
    if (error) { toast.error(copy.plannerError); return; }
    toast.success(copy.addedToPlanner);
  };

  const addAllMilestonesToCalendar = async (goal: DreamGoal) => {
    if (!user) return;
    const events = goal.milestones.filter((m) => !m.done).map((m) => {
      const startDate = new Date();
      if (m.week) startDate.setDate(startDate.getDate() + (m.week - 1) * 7);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
      return { user_id: user.id, title: `🎯 ${goal.title}: ${m.title}`, start_time: startDate.toISOString(), end_time: endDate.toISOString(), category: "חלום", source_type: "dream", source_id: goal.id };
    });
    if (events.length === 0) return;
    const { error } = await supabase.from("calendar_events").insert(events);
    if (error) { toast.error(copy.plannerGenericError); return; }
    toast.success(`${events.length} ${copy.allAddedToPlanner}`);
  };

  const sendAiMessage = async (goalId: string, message: string) => {
    const goal = goals.find((item) => item.id === goalId);
    if (!goal) return;

    // Make sure the active goal is set for the hook
    if (activeGoalChatId !== goalId) setActiveGoalChatId(goalId);

    const userMessage = { role: "user", content: message };
    dreamChatHistory.setMessages(prev => [...prev, userMessage]);
    setAiLoading(true);

    try {
      const completedMilestones = goal.milestones.filter((m) => m.done).length;
      const totalMilestones = goal.milestones.length;
      const context = `החלום: ${goal.title}. התקדמות: ${completedMilestones}/${totalMilestones} אבני דרך הושלמו (${goal.progress}%).`;

      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          taskDescription: message,
          conversationHistory: [...dreamChatHistory.messages, userMessage].slice(-20),
          customPrompt: `אתה מאמן אישי להגשמת חלומות. ${context}

בסיס הידע שלך כולל: The 7 Habits (סטיבן קאבי), Think and Grow Rich (נפוליאון היל), The 4-Hour Workweek (טים פריס), Start with Why (סיימון סינק), Grit (אנג'לה דאקוורת').

תן עצות מעשיות וספציפיות. השתמש באימוג'ים. דבר בעברית.

המשתמש שואל: ${message}`,
        },
      });
      if (error) throw error;
      dreamChatHistory.setMessages(prev => [...prev, { role: "assistant", content: data?.suggestion || copy.noAnswer }]);
    } catch {
      dreamChatHistory.setMessages(prev => [...prev, { role: "assistant", content: copy.aiError }]);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">{copy.load}</div>;

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto" dir={dir}>
      <div className="flex items-center gap-3 mb-4">
        <Target className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">{copy.title}</h2>
      </div>

      <Card className="border-primary/20">
        <CardContent className="pt-4 space-y-2">
          <Input placeholder={copy.dreamPrompt} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="text-lg" />
          <Textarea placeholder={copy.dreamDesc} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="min-h-[60px]" />
          <Button onClick={addGoal} className="gap-2"><Plus className="h-4 w-4" />{copy.addDream}</Button>
        </CardContent>
      </Card>

      {pendingRoadmap && (
        <Card className="border-2 border-primary/50 bg-primary/5">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5" />{copy.readyRoadmap} - {pendingRoadmap.milestones.length} {copy.milestones}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {pendingRoadmap.milestones.map((milestone, index) => (
                <div key={milestone.id} className="flex items-center gap-2 p-2 rounded border text-sm">
                  <span className="text-xs font-bold text-primary shrink-0">{index + 1}</span>
                  <span>{milestone.title}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={approveRoadmap} className="flex-1 gap-2"><CheckCircle2 className="h-4 w-4" />{copy.approve}</Button>
              <Button variant="outline" onClick={regeneratePendingRoadmap} className="flex-1 gap-2"><Sparkles className="h-4 w-4" />{copy.regenerate}</Button>
              <Button variant="ghost" onClick={() => setPendingRoadmap(null)}>{copy.cancel}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {goals.map((goal) => (
          <Card key={goal.id} className="overflow-hidden">
            <Collapsible open={expandedGoal === goal.id} onOpenChange={() => {
              setExpandedGoal(expandedGoal === goal.id ? null : goal.id);
              if (expandedGoal !== goal.id) setActiveGoalChatId(goal.id);
            }}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 text-right">
                      <CardTitle className="text-base">{goal.title}</CardTitle>
                      {goal.description && <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={goal.progress >= 100 ? "default" : "secondary"}>{goal.progress}%</Badge>
                      {goal.milestones.length > 0 && <Badge variant="outline" className="text-[10px]">{goal.milestones.filter((m) => m.done).length}/{goal.milestones.length}</Badge>}
                      {expandedGoal === goal.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                  <Progress value={goal.progress} className="h-2 mt-2" />
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {goal.milestones.length === 0 && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{copy.howMany}</span>
                        <Select value={milestoneCount[goal.id] || "15"} onValueChange={(v) => setMilestoneCount((prev) => ({ ...prev, [goal.id]: v }))}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MILESTONE_OPTIONS.map((count) => (<SelectItem key={count} value={String(count)}>{count}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={() => generateRoadmap(goal)} disabled={generatingRoadmap === goal.id} className="gap-2 w-full" variant="outline">
                        <Sparkles className="h-4 w-4" />{generatingRoadmap === goal.id ? copy.generating : copy.generate}
                      </Button>
                    </div>
                  )}

                  {goal.milestones.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />{copy.milestonesTitle} ({goal.milestones.filter((m) => m.done).length}/{goal.milestones.length})</h4>
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => addAllMilestonesToCalendar(goal)}>
                          <Calendar className="h-3 w-3" />{copy.addAllPlanner}
                        </Button>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto space-y-1">
                        {goal.milestones.map((milestone, index) => (
                          <div key={milestone.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${milestone.done ? "bg-muted/60" : "bg-card"}`}>
                            <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{index + 1}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => toggleMilestone(goal.id, milestone.id)}>
                              {milestone.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <div className="h-4 w-4 border-2 rounded-full" />}
                            </Button>
                            <span className={`flex-1 text-sm ${milestone.done ? "line-through text-muted-foreground" : ""}`}>{milestone.title}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => addMilestoneToCalendar(goal, milestone)} title={copy.addToPlanner}>
                              <Calendar className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => generateRoadmap(goal)} disabled={generatingRoadmap === goal.id}>
                        <Sparkles className="h-3 w-3" />{copy.regenerate}
                      </Button>
                    </div>
                  )}

                  {/* AI Coach - using AiChatPanel with DB persistence */}
                  {activeGoalChatId === goal.id && (
                    <AiChatPanel
                      title="מאמן AI"
                      messages={dreamChatHistory.messages}
                      loaded={dreamChatHistory.loaded}
                      aiLoading={aiLoading}
                      archive={dreamChatHistory.archive}
                      onSend={(msg) => sendAiMessage(goal.id, msg)}
                      onClearAndArchive={dreamChatHistory.clearAndArchive}
                      onLoadConversation={dreamChatHistory.loadConversation}
                      placeholder="שאל את המאמן..."
                      emptyText="שאל את המאמן כל שאלה על איך להגשים את החלום..."
                    />
                  )}

                  <div className="flex justify-between pt-2 border-t">
                    <Button
                      size="sm" variant="outline" className="gap-1 text-xs"
                      onClick={async () => {
                        if (!user) return;
                        const { data, error } = await supabase.from("projects").insert({
                          user_id: user.id, title: goal.title,
                          description: goal.description || `חלום שהפך לפרויקט`,
                        }).select().single();
                        if (error) { toast.error("שגיאה ביצירת פרויקט"); return; }
                        if (goal.milestones.length > 0 && data) {
                          const tasks = goal.milestones.filter(m => !m.done).map((m, i) => ({
                            project_id: data.id, user_id: user.id, title: m.title, sort_order: i,
                          }));
                          if (tasks.length > 0) await supabase.from("project_tasks").insert(tasks);
                        }
                        toast.success(`הפרויקט "${goal.title}" נוצר עם ${goal.milestones.filter(m => !m.done).length} משימות! 🚀`);
                      }}
                    >
                      <FolderKanban className="h-3 w-3" />הפוך לפרויקט
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => deleteGoal(goal.id)}>
                      <Trash2 className="h-3 w-3" />מחק
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}

        {goals.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">אין עדיין חלומות</p>
            <p className="text-sm">הוסף חלום חדש והתחל לבנות מפת דרכים להגשמתו</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DreamRoadmapDashboard;
