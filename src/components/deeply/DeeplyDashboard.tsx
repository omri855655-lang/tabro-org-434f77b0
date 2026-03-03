import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, RotateCcw, Timer, Map, Plus, Trash2, BookOpen, ChevronDown, ChevronUp, Flame, CalendarClock, Music, StopCircle, MessageCircle, ExternalLink } from "lucide-react";
import { AUDIO_PRESETS, CATEGORIES, GUIDES, MOTIVATION_TIPS, type AudioPreset } from "./audioPresets";
import { useAudioEngine } from "./useAudioEngine";
import { unlockAudioContext } from "./iosAudioUnlock";
import { startSilentAudio } from "./iosSilentAudio";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DeeplyMusicPlayer } from "./DeeplyMusicPlayer";
import { useDailyStopwatch } from "@/hooks/useDailyStopwatch";

// Background themes
const BG_THEMES = [
  // Dark themes
  { id: "dark", name: "חשוך", bg: "bg-[#0a0a0f]", text: "text-[#e8e8ed]", isLight: false, cardBg: "bg-white/5", cardBorder: "border-white/5", mutedText: "text-[#e8e8ed]/40", subtleText: "text-[#e8e8ed]/60", inputBg: "bg-white/5", inputBorder: "border-white/10", hoverBg: "hover:bg-white/10", ringColor: "ring-white/30", activeBg: "bg-white/10" },
  { id: "bottle-green", name: "ירוק בקבוק", bg: "bg-[#0a2818]", text: "text-[#d0f0d8]", isLight: false, cardBg: "bg-white/5", cardBorder: "border-white/5", mutedText: "text-[#d0f0d8]/40", subtleText: "text-[#d0f0d8]/60", inputBg: "bg-white/5", inputBorder: "border-white/10", hoverBg: "hover:bg-white/10", ringColor: "ring-white/30", activeBg: "bg-white/10" },
  { id: "mint-green", name: "ירוק מנטה", bg: "bg-[#0d2b2a]", text: "text-[#b8f0e8]", isLight: false, cardBg: "bg-white/5", cardBorder: "border-white/5", mutedText: "text-[#b8f0e8]/40", subtleText: "text-[#b8f0e8]/60", inputBg: "bg-white/5", inputBorder: "border-white/10", hoverBg: "hover:bg-white/10", ringColor: "ring-white/30", activeBg: "bg-white/10" },
  { id: "deep-blue", name: "כחול עמוק", bg: "bg-[#0a1628]", text: "text-[#c8d8f0]", isLight: false, cardBg: "bg-white/5", cardBorder: "border-white/5", mutedText: "text-[#c8d8f0]/40", subtleText: "text-[#c8d8f0]/60", inputBg: "bg-white/5", inputBorder: "border-white/10", hoverBg: "hover:bg-white/10", ringColor: "ring-white/30", activeBg: "bg-white/10" },
  { id: "ocean-teal", name: "אוקיינוס", bg: "bg-[#0a1f2e]", text: "text-[#a8dce8]", isLight: false, cardBg: "bg-white/5", cardBorder: "border-white/5", mutedText: "text-[#a8dce8]/40", subtleText: "text-[#a8dce8]/60", inputBg: "bg-white/5", inputBorder: "border-white/10", hoverBg: "hover:bg-white/10", ringColor: "ring-white/30", activeBg: "bg-white/10" },
  { id: "warm-brown", name: "חום חם", bg: "bg-[#1a1410]", text: "text-[#e8ddd0]", isLight: false, cardBg: "bg-white/5", cardBorder: "border-white/5", mutedText: "text-[#e8ddd0]/40", subtleText: "text-[#e8ddd0]/60", inputBg: "bg-white/5", inputBorder: "border-white/10", hoverBg: "hover:bg-white/10", ringColor: "ring-white/30", activeBg: "bg-white/10" },
  { id: "midnight-purple", name: "סגול לילה", bg: "bg-[#140a20]", text: "text-[#d8c8f0]", isLight: false, cardBg: "bg-white/5", cardBorder: "border-white/5", mutedText: "text-[#d8c8f0]/40", subtleText: "text-[#d8c8f0]/60", inputBg: "bg-white/5", inputBorder: "border-white/10", hoverBg: "hover:bg-white/10", ringColor: "ring-white/30", activeBg: "bg-white/10" },
  { id: "charcoal", name: "פחם", bg: "bg-[#1a1a1a]", text: "text-[#d4d4d4]", isLight: false, cardBg: "bg-white/5", cardBorder: "border-white/5", mutedText: "text-[#d4d4d4]/40", subtleText: "text-[#d4d4d4]/60", inputBg: "bg-white/5", inputBorder: "border-white/10", hoverBg: "hover:bg-white/10", ringColor: "ring-white/30", activeBg: "bg-white/10" },
  // Light themes
  { id: "light-cream", name: "קרם בהיר", bg: "bg-[#faf8f5]", text: "text-[#2a2520]", isLight: true, cardBg: "bg-white", cardBorder: "border-[#e8e0d8]", mutedText: "text-[#2a2520]/50", subtleText: "text-[#2a2520]/70", inputBg: "bg-[#f0ece8]", inputBorder: "border-[#d8d0c8]", hoverBg: "hover:bg-[#f0ece8]", ringColor: "ring-[#2a2520]/20", activeBg: "bg-[#e8e0d8]" },
  { id: "light-sky", name: "שמיים", bg: "bg-[#f0f6ff]", text: "text-[#1a2a40]", isLight: true, cardBg: "bg-white", cardBorder: "border-[#d0e0f0]", mutedText: "text-[#1a2a40]/50", subtleText: "text-[#1a2a40]/70", inputBg: "bg-[#e8f0fa]", inputBorder: "border-[#c8d8e8]", hoverBg: "hover:bg-[#e0ecf8]", ringColor: "ring-[#1a2a40]/20", activeBg: "bg-[#d0e0f0]" },
  { id: "light-mint", name: "מנטה בהיר", bg: "bg-[#f0faf5]", text: "text-[#1a3028]", isLight: true, cardBg: "bg-white", cardBorder: "border-[#c8e8d8]", mutedText: "text-[#1a3028]/50", subtleText: "text-[#1a3028]/70", inputBg: "bg-[#e8f5f0]", inputBorder: "border-[#b8d8c8]", hoverBg: "hover:bg-[#e0f0e8]", ringColor: "ring-[#1a3028]/20", activeBg: "bg-[#c8e8d8]" },
  { id: "light-lavender", name: "לבנדר", bg: "bg-[#f5f0ff]", text: "text-[#28203a]", isLight: true, cardBg: "bg-white", cardBorder: "border-[#d8c8f0]", mutedText: "text-[#28203a]/50", subtleText: "text-[#28203a]/70", inputBg: "bg-[#efe8fa]", inputBorder: "border-[#d0c0e8]", hoverBg: "hover:bg-[#e8e0f5]", ringColor: "ring-[#28203a]/20", activeBg: "bg-[#d8c8f0]" },
  { id: "light-peach", name: "אפרסק", bg: "bg-[#fff8f0]", text: "text-[#3a2820]", isLight: true, cardBg: "bg-white", cardBorder: "border-[#f0d8c0]", mutedText: "text-[#3a2820]/50", subtleText: "text-[#3a2820]/70", inputBg: "bg-[#faf0e8]", inputBorder: "border-[#e8d0b8]", hoverBg: "hover:bg-[#f5ece0]", ringColor: "ring-[#3a2820]/20", activeBg: "bg-[#f0d8c0]" },
  { id: "light-white", name: "לבן נקי", bg: "bg-white", text: "text-[#1a1a2e]", isLight: true, cardBg: "bg-[#f8f8fc]", cardBorder: "border-[#e0e0e8]", mutedText: "text-[#1a1a2e]/50", subtleText: "text-[#1a1a2e]/70", inputBg: "bg-[#f0f0f5]", inputBorder: "border-[#d8d8e0]", hoverBg: "hover:bg-[#f0f0f5]", ringColor: "ring-[#1a1a2e]/20", activeBg: "bg-[#e0e0e8]" },
];

// Timer presets
const TIMER_PRESETS = [
  { id: "pomodoro", name: "Pomodoro", work: 25, break: 5 },
  { id: "sprint", name: "Sprint", work: 50, break: 10 },
];

// Roadmap steps
const ROADMAP_STEPS = [
  { id: 1, title: "ניקוי רעשים", items: ["כבה התראות בטלפון", "סגור טאבים מיותרים", "הפעל 'נא לא להפריע'", "נקה שולחן עבודה"] },
  { id: 2, title: "סידור המוח", items: ["רשום את כל המשימות", "הפרד עבודה עמוקה מרדודה", "תעדף לפי חשיבות", "הגדר 3 משימות ליום", "בחר משימה להתחלה"] },
  { id: 3, title: "טריגר פוקוס", items: ["הפעל תדרים", "הגדר טיימר", "לחץ Start"] },
  { id: 4, title: "שימור אנרגיה", items: ["הפסקה בין סשנים", "עקוב אחרי סשנים", "לא יותר מ-4 רצופים", "סיכום יומי"] },
];

interface Task {
  id: string;
  text: string;
  done: boolean;
}

interface SessionLog {
  id: string;
  type: string;
  duration: number;
  frequency: string;
  timestamp: Date;
}

interface CalendarTask {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  category: string;
}

const COLOR_MAP: Record<string, string> = {
  violet: "from-violet-500 to-violet-700",
  cyan: "from-cyan-500 to-cyan-700",
  emerald: "from-emerald-500 to-emerald-700",
  amber: "from-amber-500 to-amber-700",
  rose: "from-rose-500 to-rose-700",
};

const ACTIVE_COLOR_MAP: Record<string, string> = {
  violet: "bg-violet-500/20 border-violet-500/30",
  cyan: "bg-cyan-500/20 border-cyan-500/30",
  emerald: "bg-emerald-500/20 border-emerald-500/30",
  amber: "bg-amber-500/20 border-amber-500/30",
  rose: "bg-rose-500/20 border-rose-500/30",
};

const DeeplyDashboard = () => {
  const { activePresetId, isPlaying, isRendering, toggle } = useAudioEngine();
  const { user } = useAuth();
  const { stopwatchTime, isStopwatchRunning, toggleStopwatch, resetStopwatch } = useDailyStopwatch();

  // Sound category
  const [activeCategory, setActiveCategory] = useState<string>("focus");

  // Background theme
  const [bgTheme, setBgTheme] = useState(() => {
    const saved = localStorage.getItem("deeply-bg-theme");
    return saved || "dark";
  });

  // Timer
  const [timerPreset, setTimerPreset] = useState(TIMER_PRESETS[0]);
  const [timeLeft, setTimeLeft] = useState(TIMER_PRESETS[0].work * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Stopwatch now handled by useDailyStopwatch hook

  // AI Chat
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiMessages, setAiMessages] = useState<{role: "user" | "assistant"; content: string}[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Tasks
  const [workMode, setWorkMode] = useState<"deep" | "shallow">("deep");
  const [deepTasks, setDeepTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem("deeply-deep-tasks");
    return saved ? JSON.parse(saved) : [];
  });
  const [shallowTasks, setShallowTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem("deeply-shallow-tasks");
    return saved ? JSON.parse(saved) : [];
  });
  const [newTask, setNewTask] = useState("");

  // Roadmap
  const [roadmapChecks, setRoadmapChecks] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("deeply-roadmap");
    return saved ? JSON.parse(saved) : {};
  });
  const [activeRoadmapStep, setActiveRoadmapStep] = useState<number | null>(null);

  // Guides & Motivation
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
  const [expandedMotivation, setExpandedMotivation] = useState<string | null>(null);
  const [activeYouTube, setActiveYouTube] = useState<string | null>(null);
  const [activeYtCat, setActiveYtCat] = useState("yt-classical");

  // Sessions
  const [sessions, setSessions] = useState<SessionLog[]>(() => {
    const saved = localStorage.getItem("deeply-sessions");
    return saved ? JSON.parse(saved) : [];
  });

  // Calendar tasks for today
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [selectedCalendarTask, setSelectedCalendarTask] = useState<CalendarTask | null>(null);

  // Fetch today's calendar events
  useEffect(() => {
    if (!user) return;
    const fetchTodayEvents = async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
      
      const { data } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, end_time, category")
        .eq("user_id", user.id)
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay)
        .order("start_time");
      
      if (data) setCalendarTasks(data);
    };
    fetchTodayEvents();
  }, [user]);

  // Persist
  useEffect(() => { localStorage.setItem("deeply-deep-tasks", JSON.stringify(deepTasks)); }, [deepTasks]);
  useEffect(() => { localStorage.setItem("deeply-shallow-tasks", JSON.stringify(shallowTasks)); }, [shallowTasks]);
  useEffect(() => { localStorage.setItem("deeply-roadmap", JSON.stringify(roadmapChecks)); }, [roadmapChecks]);
  useEffect(() => { localStorage.setItem("deeply-sessions", JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem("deeply-bg-theme", bgTheme); }, [bgTheme]);

  // Play completion sound
  const playCompletionSound = () => {
    try {
      const ctx = unlockAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.3;
      
      // Play a pleasant chime sequence
      osc.frequency.value = 523.25; // C5
      osc.type = "sine";
      osc.start();
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.4); // G5
      gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.5);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      osc.stop(ctx.currentTime + 1.2);
    } catch {}
  };

  // Timer logic
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    } else if (isTimerRunning && timeLeft === 0) {
      playCompletionSound();
      if (!isBreak) {
        const log: SessionLog = {
          id: Date.now().toString(),
          type: timerPreset.id,
          duration: timerPreset.work,
          frequency: activePresetId || "none",
          timestamp: new Date(),
        };
        setSessions(prev => [log, ...prev]);
        setIsBreak(true);
        setTimeLeft(timerPreset.break * 60);
      } else {
        setIsBreak(false);
        setTimeLeft(timerPreset.work * 60);
        setIsTimerRunning(false);
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isTimerRunning, timeLeft, isBreak, timerPreset, activePresetId]);

  // Stopwatch logic now handled by useDailyStopwatch hook

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleYouTubeToggle = (videoId: string) => {
    // Keep iOS media session alive before opening YouTube iframe
    unlockAudioContext();
    startSilentAudio();

    setActiveYouTube(activeYouTube === videoId ? null : videoId);
    setTimeout(() => {
      const el = document.getElementById("yt-player-container");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  // AI Chat
  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: "user" as const, content: aiInput.trim() };
    const newMessages = [...aiMessages, userMsg];
    setAiMessages(newMessages);
    setAiInput("");
    setAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: { type: "deeply-chat", messages: newMessages },
      });
      if (error) throw error;
      const reply = data?.reply || data?.suggestion || "אין תשובה";
      setAiMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error("AI chat error:", e);
      setAiMessages(prev => [...prev, { role: "assistant", content: "שגיאה בחיבור ל-AI. נסה שוב." }]);
    } finally {
      setAiLoading(false);
    }
  };

  const formatHour = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const currentTasks = workMode === "deep" ? deepTasks : shallowTasks;
  const setCurrentTasks = workMode === "deep" ? setDeepTasks : setShallowTasks;

  const addTask = () => {
    if (!newTask.trim()) return;
    setCurrentTasks(prev => [...prev, { id: Date.now().toString(), text: newTask.trim(), done: false }]);
    setNewTask("");
  };

  const startPomodoroForTask = (task: CalendarTask) => {
    setSelectedCalendarTask(task);
    setTimerPreset(TIMER_PRESETS[0]); // Pomodoro
    setTimeLeft(TIMER_PRESETS[0].work * 60);
    setIsTimerRunning(false);
    setIsBreak(false);
    // Suggest a classical preset for focus
    if (!isPlaying) {
      const studyPreset = AUDIO_PRESETS.find(p => p.id === "satie-gymnopedie") || AUDIO_PRESETS.find(p => p.category === "study");
      if (studyPreset) toggle(studyPreset);
    }
  };

  const today = new Date().toDateString();
  const todaySessions = sessions.filter(s => new Date(s.timestamp).toDateString() === today);
  const todayMinutes = todaySessions.reduce((acc, s) => acc + s.duration, 0);
  const todayCompleted = currentTasks.filter(t => t.done).length;

  const filteredPresets = AUDIO_PRESETS.filter(p => p.category === activeCategory);
  const activeCat = CATEGORIES.find(c => c.id === activeCategory);

  // Find upcoming task (next one that hasn't passed)
  const now = new Date();
  const upcomingTask = calendarTasks.find(t => new Date(t.start_time) >= now) || calendarTasks[calendarTasks.length - 1];
  const currentTheme = BG_THEMES.find(t => t.id === bgTheme) || BG_THEMES[0];
  const isLight = currentTheme.isLight;
  const themeCard = currentTheme.cardBg + " " + currentTheme.cardBorder;
  const themeMuted = currentTheme.mutedText;
  const themeSubtle = currentTheme.subtleText;
  const themeInput = currentTheme.inputBg + " " + currentTheme.inputBorder;

  return (
    <div className={`h-full ${currentTheme.bg} ${currentTheme.text} overflow-auto ${isLight ? "deeply-light" : ""}`} dir="rtl">
      <div className="max-w-7xl mx-auto p-4 space-y-4">

        {/* Background selector + AI Chat button */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs ${themeMuted}`}>רקע:</span>
          <div className="flex gap-1 flex-wrap">
            <span className={`text-[10px] ${themeMuted} self-center ml-1`}>🌙</span>
            {BG_THEMES.filter(t => !t.isLight).map(theme => (
              <button
                key={theme.id}
                onClick={() => setBgTheme(theme.id)}
                className={`px-2.5 py-1 rounded-full text-xs transition-all ${bgTheme === theme.id ? `ring-2 ${currentTheme.ringColor} ${currentTheme.activeBg}` : `${currentTheme.inputBg} ${currentTheme.hoverBg}`}`}
              >
                {theme.name}
              </button>
            ))}
            <span className={`text-[10px] ${themeMuted} self-center ml-2 mr-1`}>☀️</span>
            {BG_THEMES.filter(t => t.isLight).map(theme => (
              <button
                key={theme.id}
                onClick={() => setBgTheme(theme.id)}
                className={`px-2.5 py-1 rounded-full text-xs transition-all ${bgTheme === theme.id ? `ring-2 ${currentTheme.ringColor} ${currentTheme.activeBg}` : `${currentTheme.inputBg} ${currentTheme.hoverBg}`}`}
              >
                {theme.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAiChat(!showAiChat)}
            className={`mr-auto px-3 py-1.5 rounded-full text-xs ${isLight ? "bg-violet-100 text-violet-700 hover:bg-violet-200" : "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"} flex items-center gap-1.5 transition-all`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            AI מאמן
          </button>
        </div>

        {/* AI Chat panel */}
        {showAiChat && (
          <Card className={`${isLight ? "bg-violet-50 border-violet-200" : "bg-white/5 border-violet-500/20"}`}>
            <CardContent className="p-4 space-y-3">
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {aiMessages.length === 0 && (
                  <p className="text-center text-sm opacity-40 py-4">שאל אותי על ריכוז, מוטיבציה, שיטות עבודה עמוקה, או כל דבר שקשור לפרודוקטיביות 🧠</p>
                )}
                {aiMessages.map((msg, i) => (
                  <div key={i} className={`text-sm rounded-xl p-3 ${msg.role === "user" ? "bg-violet-500/15 mr-8" : "bg-white/5 ml-8"}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
                {aiLoading && <div className="text-xs opacity-40 animate-pulse text-center">חושב...</div>}
              </div>
              <div className="flex gap-2">
                <input
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendAiMessage()}
                  placeholder="שאל על ריכוז, מוטיבציה, שיטות..."
                  className={`flex-1 px-3 py-2 rounded-lg ${themeInput} border text-sm placeholder:opacity-30 focus:outline-none focus:ring-1 focus:ring-violet-500/50`}
                />
                <Button size="icon" variant="ghost" onClick={sendAiMessage} disabled={aiLoading} className="text-violet-400">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming calendar task banner */}
        {upcomingTask && (
          <Card className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border-violet-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <CalendarClock className="h-8 w-8 text-violet-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${themeSubtle}`}>המשימה הבאה מהלו״ז שלך:</p>
                <p className="text-lg font-bold truncate">{upcomingTask.title}</p>
                <p className="text-xs text-violet-300">{formatHour(upcomingTask.start_time)} — {formatHour(upcomingTask.end_time)}</p>
              </div>
              <Button
                onClick={() => startPomodoroForTask(upcomingTask)}
                className="bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/30 flex-shrink-0"
                variant="ghost"
              >
                <Play className="h-4 w-4 ml-1" />
                התחל פומודורו
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Selected task notification */}
        {selectedCalendarTask && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
            <span className="text-emerald-400 text-sm">🎯 עובד על:</span>
            <span className="text-sm font-medium text-[#e8e8ed]">{selectedCalendarTask.title}</span>
            <button onClick={() => setSelectedCalendarTask(null)} className="mr-auto text-xs text-[#e8e8ed]/30 hover:text-[#e8e8ed]/60">✕</button>
          </div>
        )}

        {/* Top row: Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className={`${themeCard} border`}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${isLight ? "text-violet-600" : "text-violet-300"}`}>{todayMinutes}</p>
              <p className={`text-xs ${themeMuted}`}>דקות עבודה</p>
            </CardContent>
          </Card>
          <Card className={`${themeCard} border`}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${isLight ? "text-cyan-600" : "text-cyan-300"}`}>{todaySessions.length}</p>
              <p className={`text-xs ${themeMuted}`}>סשנים</p>
            </CardContent>
          </Card>
          <Card className={`${themeCard} border`}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${isLight ? "text-emerald-600" : "text-emerald-300"}`}>{todayCompleted}</p>
              <p className={`text-xs ${themeMuted}`}>משימות</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's calendar tasks */}
        {calendarTasks.length > 0 && (
          <Card className="bg-white/5 border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-[#e8e8ed]">
                <CalendarClock className="h-4 w-4 text-violet-400" />
                משימות היום מהלו״ז
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {calendarTasks.map(task => {
                  const isPast = new Date(task.end_time) < now;
                  const isActive = selectedCalendarTask?.id === task.id;
                  return (
                    <button
                      key={task.id}
                      onClick={() => startPomodoroForTask(task)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right ${
                        isActive ? "bg-violet-500/15 border border-violet-500/30" 
                        : isPast ? "bg-white/3 opacity-50" 
                        : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs font-mono text-[#e8e8ed]/50 w-12">{formatHour(task.start_time)}</span>
                      <span className={`text-sm flex-1 ${isPast ? "line-through text-[#e8e8ed]/30" : "text-[#e8e8ed]/80"}`}>{task.title}</span>
                      {!isPast && (
                        <span className="text-xs text-violet-400 opacity-0 group-hover:opacity-100">🍅 פומודורו</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sound Player with categories */}
        <Card className="bg-white/5 border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-[#e8e8ed]">
              🎧 נגן תדרים וצלילים
              {activePresetId && isPlaying && (
                <span className="text-xs text-violet-400 animate-pulse mr-auto">● מנגן</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Category tabs */}
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                    activeCategory === cat.id
                      ? `${ACTIVE_COLOR_MAP[cat.color]} border`
                      : "bg-white/5 text-[#e8e8ed]/50 hover:bg-white/10"
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>

            {/* Presets grid */}
            <div className="grid sm:grid-cols-2 gap-2">
              {filteredPresets.map(preset => {
                const isActive = activePresetId === preset.id && isPlaying;
                const isLoading = activePresetId === preset.id && isRendering;
                const catColor = activeCat?.color || "violet";
                return (
                  <button
                    key={preset.id}
                    onClick={() => toggle(preset)}
                    disabled={isRendering}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all text-right ${
                      isActive
                        ? `${ACTIVE_COLOR_MAP[catColor]} border`
                        : isLoading
                        ? "bg-white/5 border border-white/20 animate-pulse"
                        : "bg-white/5 border border-transparent hover:bg-white/10"
                    } ${isRendering ? "opacity-70 cursor-wait" : ""}`}
                  >
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${COLOR_MAP[catColor]} flex items-center justify-center flex-shrink-0`}>
                      {isLoading ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : isActive ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#e8e8ed] truncate">{preset.name}</p>
                      <p className="text-xs text-[#e8e8ed]/40 truncate">
                        {isLoading ? "מרנדר אודיו..." : preset.nameHe}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active preset description */}
            {activePresetId && isPlaying && (
              <div className="text-xs text-[#e8e8ed]/50 bg-white/5 rounded-lg p-2 flex items-start gap-2">
                <span>ℹ️</span>
                <span>{AUDIO_PRESETS.find(p => p.id === activePresetId)?.desc}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* YouTube Music by Category */}
        <Card className="bg-white/5 border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-[#e8e8ed]">
              <Music className="h-4 w-4 text-rose-400" />
              🎧 מוזיקה לפי סגנון — YouTube
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const ytCategories = [
                {
                  id: "yt-classical",
                  label: "🎹 קלאסית",
                  color: "rose",
                  videos: [
                    { id: "Hlp6aawXVoY", title: "מוזיקה קלאסית לריכוז ולימודים", desc: "מיקס של בטהובן, מוצארט, באך, שופן" },
                    { id: "0UN_HbOTTcI", title: "פסנתר קלאסי — 3 שעות", desc: "שופן, ליסט, דביוסי — שקט ורגיש" },
                    { id: "jgpJVI3tDbY", title: "בטהובן — סונטת אור הירח", desc: "Moonlight Sonata — רגיעה עמוקה" },
                    { id: "lbblMw6k1cU", title: "דביוסי — Clair de Lune", desc: "חלומי ורגיש — מושלם למדיטציה" },
                  ],
                },
                {
                  id: "yt-brown-noise",
                  label: "🔇 Brown Noise",
                  color: "emerald",
                  videos: [
                    { id: "RqzGzwTY-6w", title: "Brown Noise — 10 שעות", desc: "רעש חום עמוק לחסימת הסחות דעת" },
                    { id: "GSaJXDsb3E8", title: "Deep Brown Noise — שינה וריכוז", desc: "רעש חום כהה לשינה ולימודים" },
                    { id: "Q6MemVxEquk", title: "Brown Noise — מסונן ורך", desc: "גרסה עדינה יותר לעבודה ארוכה" },
                    { id: "wa7rHRDJl5g", title: "Brown Noise + גשם", desc: "שילוב רעש חום עם צלילי גשם" },
                  ],
                },
                {
                  id: "yt-lofi",
                  label: "🎶 Lo-Fi",
                  color: "amber",
                  videos: [
                    { id: "W5FI97ovWog", title: "Lo-Fi Hip Hop — רדיו חי", desc: "ביטים להרגעה ולימודים — 24/7" },
                    { id: "sF80I-TQiW0", title: "Lo-Fi Chill — 3 שעות", desc: "מיקס לו-פיי ארוך לסשנים" },
                    { id: "n61ULEU7CO0", title: "Lo-Fi Rain — גשם ומוזיקה", desc: "לו-פיי עם צלילי גשם רגועים" },
                    { id: "iicfmXFALM8", title: "Lo-Fi Study Beats", desc: "ביטים חמים ללימודים ועבודה" },
                  ],
                },
                {
                  id: "yt-night",
                  label: "🌙 לילה",
                  color: "cyan",
                  videos: [
                    { id: "n9Y2Eb4BaSg", title: "Dark Ambient — עבודה לילית", desc: "צלילים חשוכים ועמוקים ללילה" },
                    { id: "L18ywLlvWOw", title: "Night Coding Music", desc: "מוזיקה לקידוד וכתיבה בלילה" },
                    { id: "S_MOd40zlYU", title: "Midnight Lo-Fi", desc: "ביטים שקטים לשעות הקטנות" },
                    { id: "bP9gMpl1gyQ", title: "Dark Piano — 3 שעות", desc: "פסנתר חשוך לאווירת לילה" },
                  ],
                },
                {
                  id: "yt-morning",
                  label: "🌅 בוקר",
                  color: "amber",
                  videos: [
                    { id: "HOEUiXYdcBY", title: "Morning Energy — מוזיקה לבוקר", desc: "מוזיקה מרוממת להתחלת יום" },
                    { id: "GkqhHEAy1zw", title: "Uplifting Morning Piano", desc: "פסנתר בהיר ומעורר השראה" },
                    { id: "1ZYbU82GVz4", title: "Morning Motivation", desc: "מוזיקה אופטימית לאנרגיה" },
                    { id: "oCrwzN6eb4Q", title: "Sunrise Ambient", desc: "אמביינט רגוע לזריחה" },
                  ],
                },
                {
                  id: "yt-electric",
                  label: "⚡ Electric",
                  color: "violet",
                  videos: [
                    { id: "5_4KRUx2iKY", title: "Synthwave — Coding Music", desc: "סינתווייב אלקטרוני לקידוד" },
                    { id: "4xDzrJKXOOY", title: "Cyberpunk Music Mix", desc: "מוזיקה עתידנית לעבודה אינטנסיבית" },
                    { id: "wOMwO5T3yT4", title: "Retrowave Focus", desc: "רטרו-ווייב לריכוז וזרימה" },
                    { id: "UedTcufyrHc", title: "Electronic Focus", desc: "מוזיקה אלקטרונית לפוקוס עמוק" },
                  ],
                },
                {
                  id: "yt-battle",
                  label: "🔥 קרב",
                  color: "rose",
                  videos: [
                    { id: "Enn0rGJDmVk", title: "Epic Battle Music", desc: "מוזיקה אפית לדדליינים ולחץ" },
                    { id: "nKhN1t_7PEY", title: "Powerful Orchestral", desc: "תזמורת עוצמתית — אנרגיה מקסימלית" },
                    { id: "hBMc9s8oDWE", title: "Aggressive Workout Music", desc: "מוזיקה אגרסיבית למצב קרב" },
                    { id: "vbYMHBclJYo", title: "Dark Intense Music", desc: "אנרגיה חשוכה — להתגבר על כל מכשול" },
                  ],
                },
              ];

              const activeCatData = ytCategories.find(c => c.id === activeYtCat);
              const catColorMap: Record<string, string> = {
                rose: "bg-rose-500/20 border-rose-500/30",
                emerald: "bg-emerald-500/20 border-emerald-500/30",
                amber: "bg-amber-500/20 border-amber-500/30",
                cyan: "bg-cyan-500/20 border-cyan-500/30",
                violet: "bg-violet-500/20 border-violet-500/30",
              };
              const catGradMap: Record<string, string> = {
                rose: "from-rose-500 to-rose-700",
                emerald: "from-emerald-500 to-emerald-700",
                amber: "from-amber-500 to-amber-700",
                cyan: "from-cyan-500 to-cyan-700",
                violet: "from-violet-500 to-violet-700",
              };

              return (
                <>
                  <div className="flex gap-1.5 flex-wrap">
                    {ytCategories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveYtCat(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                          activeYtCat === cat.id
                            ? `${catColorMap[cat.color]} border`
                            : "bg-white/5 text-[#e8e8ed]/50 hover:bg-white/10"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {activeCatData && (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {activeCatData.videos.map(v => (
                        <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-right ${
                            activeYouTube === v.id
                              ? `${catColorMap[activeCatData.color]} border`
                              : "bg-white/5 border border-transparent hover:bg-white/10"
                          }`}>
                          <button
                            onClick={() => handleYouTubeToggle(v.id)}
                            className={`w-9 h-9 rounded-lg bg-gradient-to-br ${catGradMap[activeCatData.color]} flex items-center justify-center flex-shrink-0`}
                          >
                            {activeYouTube === v.id ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
                          </button>
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleYouTubeToggle(v.id)}>
                            <p className="text-sm font-medium text-[#e8e8ed] truncate">{v.title}</p>
                            <p className="text-xs text-[#e8e8ed]/40 truncate">{v.desc}</p>
                          </div>
                          <a
                            href={`https://www.youtube.com/watch?v=${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#e8e8ed]/30 hover:text-[#e8e8ed]/70 transition-colors flex-shrink-0"
                            title="פתח ב-YouTube (עובד ברקע עם Premium)"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            {activeYouTube && (
              <div id="yt-player-container" className="rounded-xl overflow-hidden border border-white/10">
                <iframe
                  width="100%"
                  height="315"
                  src={`https://www.youtube.com/embed/${activeYouTube}?autoplay=1`}
                  title="Music Player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Study With Me */}
        <Card className="bg-white/5 border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-[#e8e8ed]">
              📚 Study With Me — לומדים ביחד
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-[#e8e8ed]/50">סרטוני Study With Me ליצירת אווירת לימודים וחיבור. לחץ לנגן 🎧</p>
            {(() => {
              const studyVideos = [
                { id: "z-j6jsLtgjs", title: "Study With Me — 4 שעות עם שקיעה 🌊", desc: "אווירת חוף רגועה עם Lo-Fi" },
                { id: "T-ruhOIvTXE", title: "Study With Me — 2 שעות פסנתר (Pomodoro 50/10)", desc: "פסנתר רגוע עם טיימר מובנה" },
                { id: "q6Ox94EgXn0", title: "Study With Me — כתיבה שקטה (Pomodoro 25/5) ✍️", desc: "צלילי לימוד אמיתיים עם הפסקות" },
                { id: "bBEo3sdzf8w", title: "Study With Me — 5 שעות לתחילת 2025 📚", desc: "פסנתר רגוע — Pomodoro 50/10" },
                { id: "-NPrh21ym74", title: "Study With Me — 4 שעות יום חורפי 🌧️", desc: "אח ומוזיקה רגועה בהפסקות" },
                { id: "zyE92Ufl9G4", title: "Study With Me — 7 שעות מרתון 🎄", desc: "סשן ארוך עם Pomodoro 50/10" },
              ];
              return (
                <div className="grid sm:grid-cols-2 gap-2">
                  {studyVideos.map(v => (
                    <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-right ${
                        activeYouTube === v.id
                          ? "bg-amber-500/20 border border-amber-500/30"
                          : "bg-white/5 border border-transparent hover:bg-white/10"
                      }`}>
                      <button onClick={() => handleYouTubeToggle(v.id)} className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center flex-shrink-0">
                        {activeYouTube === v.id ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
                      </button>
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleYouTubeToggle(v.id)}>
                        <p className="text-sm font-medium text-[#e8e8ed] truncate">{v.title}</p>
                        <p className="text-xs text-[#e8e8ed]/40 truncate">{v.desc}</p>
                      </div>
                      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#e8e8ed]/30 hover:text-[#e8e8ed]/70 transition-colors flex-shrink-0" title="פתח ב-YouTube">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Read With Me */}
        <Card className="bg-white/5 border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-[#e8e8ed]">
              📖 Read With Me — קוראים ביחד
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-[#e8e8ed]/50">סרטוני Read With Me לאווירת קריאה רגועה ושקטה. לחץ לנגן 🎧</p>
            {(() => {
              const readVideos = [
                { id: "81Nwr9HKS7w", title: "Read With Me — קריאה שקטה 📚", desc: "אווירה רגועה עם מוזיקת רקע עדינה" },
                { id: "6pZUaAah_z8", title: "Read With Me — 30 דקות קריאה (ללא דיבור) ☕", desc: "סשן קריאה קצר ונעים" },
                { id: "7B8D4578uWg", title: "Read With Me — 20 דקות עם מוזיקה 🧸", desc: "קריאה רגועה בזמן אמת" },
                { id: "Eg3kVcfs5SE", title: "אווירת חורף — אח, שלג ותה ☕🔥", desc: "צלילי אח ושלג לקריאה ולימודים" },
                { id: "CdVH0Ff0zWI", title: "פינת קריאה ביום גשום 🌧️", desc: "גשם רך ואח — ללא פרסומות" },
                { id: "rIHYNwXWP80", title: "בקתה עם גשם ואח — 8 שעות 🏕️", desc: "רעמים ואח לקריאה ארוכה" },
              ];
              return (
                <div className="grid sm:grid-cols-2 gap-2">
                  {readVideos.map(v => (
                    <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-right ${
                        activeYouTube === v.id
                          ? "bg-emerald-500/20 border border-emerald-500/30"
                          : "bg-white/5 border border-transparent hover:bg-white/10"
                      }`}>
                      <button onClick={() => handleYouTubeToggle(v.id)} className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0">
                        {activeYouTube === v.id ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
                      </button>
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleYouTubeToggle(v.id)}>
                        <p className="text-sm font-medium text-[#e8e8ed] truncate">{v.title}</p>
                        <p className="text-xs text-[#e8e8ed]/40 truncate">{v.desc}</p>
                      </div>
                      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#e8e8ed]/30 hover:text-[#e8e8ed]/70 transition-colors flex-shrink-0" title="פתח ב-YouTube">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Personal Music Player — background playback */}
        <DeeplyMusicPlayer
          themeCard={themeCard}
          themeMuted={themeMuted}
          themeSubtle={themeSubtle}
          themeInput={themeInput}
        />

        {/* Main grid: Timer + Stopwatch + Tasks + Roadmap */}
        <div className="grid lg:grid-cols-4 gap-4">
          {/* Pomodoro Timer */}
          <Card className="bg-white/5 border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Timer className="h-4 w-4 text-cyan-400" />
                טיימר פומודורו
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                {TIMER_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setTimerPreset(p); setTimeLeft(p.work * 60); setIsTimerRunning(false); setIsBreak(false); }}
                    className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                      timerPreset.id === p.id ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-white/5 opacity-60"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="text-center">
                <div className="text-5xl font-mono font-bold mb-1 tabular-nums text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                  {formatTime(timeLeft)}
                </div>
                <p className="text-xs opacity-60 mb-4">
                  {isBreak ? "🟢 הפסקה" : timerPreset.id === "pomodoro" ? "🍅 סשן עבודה" : "🏃 ספרינט"}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className={`rounded-full px-6 ${isTimerRunning ? "bg-red-500/20 text-red-300 hover:bg-red-500/30" : "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"}`}
                    variant="ghost"
                  >
                    {isTimerRunning ? <><Pause className="h-4 w-4 ml-1" /> עצור</> : <><Play className="h-4 w-4 ml-1" /> התחל</>}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setIsTimerRunning(false); setIsBreak(false); setTimeLeft(timerPreset.work * 60); }}
                    className="opacity-40 hover:opacity-100"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stopwatch */}
          <Card className="bg-white/5 border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <StopCircle className="h-4 w-4 text-emerald-400" />
                סטופר יומי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-5xl font-mono font-bold mb-1 tabular-nums text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                  {formatTime(stopwatchTime)}
                </div>
                <p className="text-xs opacity-60 mb-4">
                  {isStopwatchRunning ? "⏱️ רץ... (מסונכרן בין מכשירים)" : stopwatchTime > 0 ? "⏸️ מושהה — ימשיך מכאן" : "לחץ התחל — מתאפס בחצות"}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={toggleStopwatch}
                    className={`rounded-full px-6 ${isStopwatchRunning ? "bg-red-500/20 text-red-300 hover:bg-red-500/30" : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"}`}
                    variant="ghost"
                  >
                    {isStopwatchRunning ? <><Pause className="h-4 w-4 ml-1" /> עצור</> : <><Play className="h-4 w-4 ml-1" /> התחל</>}
                  </Button>
                   <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const totalSeconds = resetStopwatch();
                      // Log stopwatch session if time > 60 seconds
                      if (totalSeconds > 60) {
                        const log: SessionLog = {
                          id: Date.now().toString(),
                          type: "stopwatch",
                          duration: Math.round(totalSeconds / 60),
                          frequency: activePresetId || "none",
                          timestamp: new Date(),
                        };
                        setSessions(prev => [log, ...prev]);
                      }
                    }}
                    className="opacity-40 hover:opacity-100"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card className="bg-white/5 border-white/5">
            <CardHeader className="pb-3">
              <Tabs value={workMode} onValueChange={(v) => setWorkMode(v as "deep" | "shallow")}>
                <TabsList className="bg-white/5 w-full">
                  <TabsTrigger value="deep" className="flex-1 data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">עבודה עמוקה</TabsTrigger>
                  <TabsTrigger value="shallow" className="flex-1 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">עבודה רדודה</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTask()}
                  placeholder="משימה חדשה..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-[#e8e8ed] placeholder:text-[#e8e8ed]/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
                <Button size="icon" variant="ghost" onClick={addTask} className="text-violet-400 hover:text-violet-300">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {currentTasks.length === 0 && (
                  <p className="text-center text-[#e8e8ed]/20 text-sm py-8">אין משימות עדיין</p>
                )}
                {currentTasks.map(task => (
                  <div key={task.id} className={`flex items-center gap-3 p-3 rounded-lg transition-all ${task.done ? "bg-emerald-500/5" : "bg-white/5"}`}>
                    <Checkbox
                      checked={task.done}
                      onCheckedChange={() => setCurrentTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))}
                      className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    <span className={`flex-1 text-sm ${task.done ? "line-through text-[#e8e8ed]/30" : "text-[#e8e8ed]/80"}`}>
                      {task.text}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentTasks(prev => prev.filter(t => t.id !== task.id))} className="h-7 w-7 text-[#e8e8ed]/20 hover:text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Roadmap */}
          <Card className="bg-white/5 border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-[#e8e8ed]">
                <Map className="h-4 w-4 text-amber-400" />
                Roadmap — 4 שלבים
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ROADMAP_STEPS.map(step => (
                <div key={step.id}>
                  <button
                    onClick={() => setActiveRoadmapStep(activeRoadmapStep === step.id ? null : step.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right ${
                      activeRoadmapStep === step.id ? "bg-amber-500/10 border border-amber-500/20" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {step.id}
                    </div>
                    <span className="text-sm font-medium text-[#e8e8ed]">{step.title}</span>
                    <span className="mr-auto text-xs text-[#e8e8ed]/30">
                      {step.items.filter((_, i) => roadmapChecks[`${step.id}-${i}`]).length}/{step.items.length}
                    </span>
                  </button>
                  {activeRoadmapStep === step.id && (
                    <div className="mt-2 pr-10 space-y-1 pb-2">
                      {step.items.map((item, i) => {
                        const key = `${step.id}-${i}`;
                        return (
                          <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                            <Checkbox
                              checked={!!roadmapChecks[key]}
                              onCheckedChange={() => setRoadmapChecks(prev => ({ ...prev, [key]: !prev[key] }))}
                              className="border-white/20 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                            />
                            <span className={`text-sm ${roadmapChecks[key] ? "line-through text-[#e8e8ed]/30" : "text-[#e8e8ed]/70"}`}>
                              {item}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Motivation section */}
        <Card className="bg-white/5 border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-[#e8e8ed]">
              <Flame className="h-4 w-4 text-orange-400" />
              מוטיבציה ומניעים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {MOTIVATION_TIPS.map(tip => (
                <div key={tip.id}>
                  <button
                    onClick={() => setExpandedMotivation(expandedMotivation === tip.id ? null : tip.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right ${
                      expandedMotivation === tip.id ? "bg-orange-500/10 border border-orange-500/20" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-lg">{tip.icon}</span>
                    <span className="text-sm font-medium text-[#e8e8ed] flex-1">{tip.title}</span>
                    {expandedMotivation === tip.id ? <ChevronUp className="h-3 w-3 text-[#e8e8ed]/30" /> : <ChevronDown className="h-3 w-3 text-[#e8e8ed]/30" />}
                  </button>
                  {expandedMotivation === tip.id && (
                    <div className="p-3 pr-10 text-sm text-[#e8e8ed]/60 leading-relaxed">
                      {tip.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Guides section */}
        <Card className="bg-white/5 border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-[#e8e8ed]">
              <BookOpen className="h-4 w-4 text-rose-400" />
              מדריכים קצרים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {GUIDES.map(guide => (
              <div key={guide.id}>
                <button
                  onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-right"
                >
                  <span className="text-lg">{guide.icon}</span>
                  <span className="text-sm font-medium text-[#e8e8ed] flex-1">{guide.title}</span>
                  {expandedGuide === guide.id ? <ChevronUp className="h-4 w-4 text-[#e8e8ed]/30" /> : <ChevronDown className="h-4 w-4 text-[#e8e8ed]/30" />}
                </button>
                {expandedGuide === guide.id && (
                  <div className="p-3 pr-12 text-sm text-[#e8e8ed]/60 leading-relaxed">
                    {guide.content}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default DeeplyDashboard;
