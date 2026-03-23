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
import { Plus, Trash2, Target, Sparkles, MessageCircle, ChevronDown, ChevronUp, MapPin, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DreamGoal {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  progress: number;
  milestones: { id: string; title: string; done: boolean; week?: number }[];
  ai_roadmap: any;
  notes: string | null;
  category: string | null;
  archived: boolean;
  created_at: string;
}

const DreamRoadmapDashboard = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<DreamGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [aiChat, setAiChat] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [generatingRoadmap, setGeneratingRoadmap] = useState<string | null>(null);
  const [milestoneCount, setMilestoneCount] = useState<Record<string, string>>({});
  const [pendingRoadmap, setPendingRoadmap] = useState<{ goalId: string; milestones: any[] } | null>(null);

  const [goalChats, setGoalChats] = useState<Record<string, { role: string; content: string }[]>>(() => {
    try {
      const raw = localStorage.getItem("dashboard-chat-dreams-goals");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem("dashboard-chat-dreams-goals", JSON.stringify(goalChats));
  }, [goalChats]);

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("dream_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false });
    setGoals((data as any[])?.map(g => ({ ...g, milestones: Array.isArray(g.milestones) ? g.milestones : [] })) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const addGoal = async () => {
    if (!user || !newTitle.trim()) return;
    const { error } = await supabase.from("dream_goals").insert({
      user_id: user.id,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
    });
    if (error) { toast.error("שגיאה"); return; }
    setNewTitle(""); setNewDescription("");
    toast.success("חלום חדש נוסף! 🌟");
    fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    await supabase.from("dream_goals").delete().eq("id", id);
    setGoals(prev => prev.filter(g => g.id !== id));
    toast.success("נמחק");
  };

  const generateRoadmap = async (goal: DreamGoal) => {
    const count = parseInt(milestoneCount[goal.id] || "15");
    if (count < 10 || count > 100) {
      toast.error("בחר מספר בין 10 ל-100");
      return;
    }
    setGeneratingRoadmap(goal.id);
    try {
      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          taskDescription: goal.title,
          customPrompt: `אתה מאמן להגשמת חלומות. המשתמש רוצה להגשים את החלום: "${goal.title}". ${goal.description ? `תיאור: ${goal.description}` : ""}
          
צור מפת דרכים מפורטת עם בדיוק ${count} אבני דרך. כל אבן דרך צריכה להיות צעד מעשי וברור.
עבור חלומות פשוטים תן צעדים מפורטים יותר, עבור חלומות מורכבים תן צעדים גדולים יותר.

חשוב מאוד: החזר תשובה שמכילה JSON בפורמט הזה בתוך הטקסט:
{ "milestones": [{ "week": 1, "title": "כותרת הצעד", "description": "תיאור מה לעשות" }, ...] }

חובה ליצור בדיוק ${count} אבני דרך. חובה לכלול את ה-JSON בתשובה.`,
        },
      });
      if (error) throw error;
      
      const suggestion = data?.suggestion || "";
      let milestones: any[] = [];
      
      // Try to extract JSON
      const jsonMatch = suggestion.match(/\{[\s\S]*?"milestones"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          milestones = (parsed.milestones || []).map((m: any, i: number) => ({
            id: `ms-${Date.now()}-${i}`,
            title: m.title || `שלב ${i + 1}`,
            done: false,
            week: m.week || i + 1,
          }));
        } catch { /* fallback below */ }
      }
      
      // Fallback: parse lines
      if (milestones.length === 0 && suggestion.length > 10) {
        const lines = suggestion.split('\n').filter((l: string) => l.trim().length > 5 && (l.includes('שבוע') || l.match(/^\d/) || l.includes('-') || l.includes('•')));
        milestones = lines.slice(0, count).map((line: string, i: number) => ({
          id: `ms-${Date.now()}-${i}`,
          title: line.replace(/^[\s\-•\d\.\)]+/, '').trim().slice(0, 100),
          done: false,
          week: i + 1,
        }));
      }

      if (milestones.length === 0) {
        milestones = [{ id: `ms-${Date.now()}`, title: suggestion.slice(0, 200), done: false, week: 1 }];
      }

      // Show preview for approval
      setPendingRoadmap({ goalId: goal.id, milestones });
      toast.success(`נוצרו ${milestones.length} אבני דרך - בדוק ואשר ✅`);
    } catch (err) {
      console.error("Roadmap generation error:", err);
      toast.error("שגיאה ביצירת מפת דרכים");
    }
    setGeneratingRoadmap(null);
  };

  const approveRoadmap = async () => {
    if (!pendingRoadmap) return;
    const { goalId, milestones } = pendingRoadmap;
    const { error } = await supabase.from("dream_goals").update({
      milestones: milestones as any,
      ai_roadmap: { generated: true, count: milestones.length } as any,
    }).eq("id", goalId);
    if (error) { toast.error("שגיאה בשמירה"); return; }
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, milestones, ai_roadmap: { generated: true } } : g));
    setPendingRoadmap(null);
    toast.success("מפת הדרכים אושרה! 🎯");
  };

  const toggleMilestone = async (goalId: string, msId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const updated = goal.milestones.map(m => m.id === msId ? { ...m, done: !m.done } : m);
    const progress = Math.round((updated.filter(m => m.done).length / updated.length) * 100);
    await supabase.from("dream_goals").update({ milestones: updated as any, progress }).eq("id", goalId);
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, milestones: updated, progress } : g));
  };

  const addMilestoneToCalendar = async (goal: DreamGoal, ms: { id: string; title: string; week?: number }) => {
    if (!user) return;
    const startDate = new Date();
    if (ms.week) startDate.setDate(startDate.getDate() + (ms.week - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    const { error } = await supabase.from("calendar_events").insert({
      user_id: user.id,
      title: `🎯 ${goal.title}: ${ms.title}`,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      category: "חלום",
      source_type: "dream",
      source_id: goal.id,
    });
    if (error) { toast.error("שגיאה בהוספה ללוז"); return; }
    toast.success("נוסף למתכנן הלוז! 📅");
  };

  const addAllMilestonesToCalendar = async (goal: DreamGoal) => {
    if (!user) return;
    const events = goal.milestones.filter(m => !m.done).map((ms) => {
      const startDate = new Date();
      if (ms.week) startDate.setDate(startDate.getDate() + (ms.week - 1) * 7);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
      return {
        user_id: user.id,
        title: `🎯 ${goal.title}: ${ms.title}`,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        category: "חלום",
        source_type: "dream",
        source_id: goal.id,
      };
    });
    if (events.length === 0) return;
    const { error } = await supabase.from("calendar_events").insert(events);
    if (error) { toast.error("שגיאה"); return; }
    toast.success(`${events.length} אבני דרך נוספו ללוז! 📅`);
  };

  const sendAiMessage = async (goalId: string) => {
    if (!aiChat.trim()) return;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const msgs = goalChats[goalId] || [];
    const userMsg = { role: "user", content: aiChat };
    setGoalChats(prev => ({ ...prev, [goalId]: [...(prev[goalId] || []), userMsg] }));
    setAiChat("");
    setAiLoading(true);

    try {
      const completedMs = goal.milestones.filter(m => m.done).length;
      const totalMs = goal.milestones.length;
      const context = `החלום: ${goal.title}. התקדמות: ${completedMs}/${totalMs} אבני דרך הושלמו (${goal.progress}%).`;

      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          taskDescription: aiChat,
          customPrompt: `אתה מאמן אישי להגשמת חלומות. ${context}

בסיס הידע שלך כולל: The 7 Habits (סטיבן קאבי), Think and Grow Rich (נפוליאון היל), The 4-Hour Workweek (טים פריס), Start with Why (סיימון סינק), Grit (אנג'לה דאקוורת').

תן עצות מעשיות וספציפיות. השתמש באימוג'ים. דבר בעברית.

המשתמש שואל: ${aiChat}`,
        },
      });
      if (error) throw error;
      setGoalChats(prev => ({ ...prev, [goalId]: [...(prev[goalId] || []), { role: "assistant", content: data?.suggestion || "אין תשובה" }] }));
    } catch {
      setGoalChats(prev => ({ ...prev, [goalId]: [...(prev[goalId] || []), { role: "assistant", content: "שגיאה" }] }));
    }
    setAiLoading(false);
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <Target className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">מפת חלומות</h2>
      </div>

      {/* Add new dream */}
      <Card className="border-primary/20">
        <CardContent className="pt-4 space-y-2">
          <Input placeholder="מה החלום שלך? (לדוגמה: להקים פודקאסט, לפתוח עסק...)" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="text-lg" />
          <Textarea placeholder="תאר את החלום בכמה מילים (אופציונלי)..." value={newDescription} onChange={e => setNewDescription(e.target.value)} className="min-h-[60px]" />
          <Button onClick={addGoal} className="gap-2"><Plus className="h-4 w-4" />הוסף חלום</Button>
        </CardContent>
      </Card>

      {/* Pending roadmap approval */}
      {pendingRoadmap && (
        <Card className="border-2 border-primary/50 bg-primary/5">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              מפת דרכים מוכנה - {pendingRoadmap.milestones.length} אבני דרך
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {pendingRoadmap.milestones.map((ms, i) => (
                <div key={ms.id} className="flex items-center gap-2 p-2 rounded border text-sm">
                  <span className="text-xs font-bold text-primary shrink-0">{i + 1}</span>
                  <span>{ms.title}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={approveRoadmap} className="flex-1 gap-2">
                <CheckCircle2 className="h-4 w-4" />מרוצה! אשר ושמור
              </Button>
              <Button variant="outline" onClick={() => {
                setPendingRoadmap(null);
                const goalId = pendingRoadmap.goalId;
                generateRoadmap(goals.find(g => g.id === goalId)!);
              }} className="flex-1 gap-2">
                <Sparkles className="h-4 w-4" />צור מחדש
              </Button>
              <Button variant="ghost" onClick={() => setPendingRoadmap(null)}>ביטול</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals list */}
      <div className="space-y-4">
        {goals.map(goal => (
          <Card key={goal.id} className="overflow-hidden">
            <Collapsible open={expandedGoal === goal.id} onOpenChange={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}>
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
                      {goal.milestones.length > 0 && <Badge variant="outline" className="text-[10px]">{goal.milestones.filter(m => m.done).length}/{goal.milestones.length}</Badge>}
                      {expandedGoal === goal.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                  <Progress value={goal.progress} className="h-2 mt-2" />
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {/* Generate roadmap */}
                  {goal.milestones.length === 0 && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">כמה אבני דרך?</span>
                        <Select value={milestoneCount[goal.id] || "15"} onValueChange={v => setMilestoneCount(prev => ({ ...prev, [goal.id]: v }))}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="15">15</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="30">30</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="75">75</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={() => generateRoadmap(goal)} disabled={generatingRoadmap === goal.id} className="gap-2 w-full" variant="outline">
                        <Sparkles className="h-4 w-4" />
                        {generatingRoadmap === goal.id ? "יוצר מפת דרכים..." : "צור מפת דרכים עם AI 🗺️"}
                      </Button>
                    </div>
                  )}

                  {/* Milestones */}
                  {goal.milestones.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />אבני דרך ({goal.milestones.filter(m => m.done).length}/{goal.milestones.length})</h4>
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => addAllMilestonesToCalendar(goal)}>
                          <Calendar className="h-3 w-3" />הוסף הכל ללוז
                        </Button>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto space-y-1">
                        {goal.milestones.map((ms, i) => (
                          <div key={ms.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${ms.done ? "bg-green-50 dark:bg-green-950/20" : "bg-card"}`}>
                            <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => toggleMilestone(goal.id, ms.id)}>
                              {ms.done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 border-2 rounded-full" />}
                            </Button>
                            <span className={`flex-1 text-sm ${ms.done ? "line-through text-muted-foreground" : ""}`}>{ms.title}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => addMilestoneToCalendar(goal, ms)} title="הוסף ללוז">
                              <Calendar className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => generateRoadmap(goal)} disabled={generatingRoadmap === goal.id}>
                          <Sparkles className="h-3 w-3" />צור מחדש
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* AI Coach chat */}
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold flex items-center gap-2"><MessageCircle className="h-4 w-4" />מאמן AI</h4>
                      {(goalChats[goal.id] || []).length > 0 && (
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setGoalChats(prev => ({ ...prev, [goal.id]: [] }))}>נקה</Button>
                      )}
                    </div>
                    <div className="border rounded-lg p-2 min-h-[100px] max-h-[200px] overflow-y-auto space-y-2">
                      {(goalChats[goal.id] || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">שאל את המאמן כל שאלה על איך להגשים את החלום...</p>}
                      {(goalChats[goal.id] || []).map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="שאל את המאמן..." value={aiChat} onChange={e => setAiChat(e.target.value)} onKeyDown={e => e.key === "Enter" && sendAiMessage(goal.id)} className="text-sm" />
                      <Button size="sm" onClick={() => sendAiMessage(goal.id)} disabled={aiLoading}><MessageCircle className="h-3 w-3" /></Button>
                    </div>
                  </div>

                  {/* Delete */}
                  <div className="flex justify-end pt-2 border-t">
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
