import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerConversations } from '@/hooks/usePlannerConversations';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Loader2, Sparkles, AlertTriangle, Clock, CheckCircle2, Send, Copy, FileText, History, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { estimateTaskDuration, formatDurationLabel } from '@/lib/planningDurationHeuristics';
import type { Json } from '@/integrations/supabase/types';

interface PlannerTask {
  type: 'task' | 'project_task' | 'course_lesson';
  id: string;
  title: string;
  source: string;
  urgent?: boolean;
  overdue?: boolean;
  scheduled_date?: string;
  duration_minutes?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ProjectTaskRow {
  id: string;
  title: string;
  projects?: { title?: string | null } | null;
}

interface CourseLessonRow {
  id: string;
  title: string;
  scheduled_date?: string | null;
  duration_minutes?: number | null;
  courses?: { title?: string | null } | null;
}

type PlannerMode = 'daily_plan' | 'planning_agent';

type PlanningRange = 'today' | 'tomorrow' | 'week';
type PendingAction = Json;

interface PlanningProfile {
  range: PlanningRange;
  dayType: 'workday' | 'day_off' | 'unknown';
  workStart: string;
  workEnd: string;
  homeWindow: string;
  fixedCommitments: string;
  mustDoTasks: string;
  schedulingIntent: 'suggest' | 'autoschedule';
}

const ACTION_LABELS: Record<string, string> = {
  add_event: 'האירוע נוסף למתכנן',
  multi: 'התכנון נשמר במתכנן',
};

const shouldAutoExecutePlanning = (text: string) => {
  const normalized = text.trim();
  return [
    'תשבץ',
    'תשבץ לי',
    'תכניס למתכנן',
    'תכניס ללוז',
    'תבצע',
    'תכנן ותשבץ',
    'תכנן ותכניס',
    'תיצור אירועים',
    'תשים במתכנן',
  ].some((phrase) => normalized.includes(phrase));
};

const AiDailyPlanner = () => {
  const { user } = useAuth();
  const { 
    conversations, 
    currentConversation, 
    loadTodayConversation,
    loadConversation,
    saveConversation,
    startNewConversation,
    today 
  } = usePlannerConversations();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allTasks, setAllTasks] = useState<PlannerTask[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [plannerMode, setPlannerMode] = useState<PlannerMode>('daily_plan');
  const [planningProfile, setPlanningProfile] = useState<PlanningProfile>({
    range: 'today',
    dayType: 'unknown',
    workStart: '',
    workEnd: '',
    homeWindow: '',
    fixedCommitments: '',
    mustDoTasks: '',
    schedulingIntent: 'suggest',
  });
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load conversation when dialog opens or date changes
  useEffect(() => {
    if (open && currentConversation) {
      setMessages(currentConversation.messages);
      setAllTasks(currentConversation.tasks_snapshot);
    }
  }, [open, currentConversation]);

  const fetchAllOpenTasks = useCallback(async () => {
    if (!user) return [];

    const tasks: PlannerTask[] = [];

    // Fetch regular tasks (both work and personal)
    const { data: regularTasks } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'בוצע')
      .eq('archived', false);

    (regularTasks || []).forEach(task => {
      tasks.push({
        type: 'task',
        id: task.id,
        title: task.description,
        source: task.task_type === 'work' ? 'משימות עבודה' : 'משימות אישיות',
        urgent: task.urgent,
        overdue: task.overdue,
        scheduled_date: task.planned_end,
      });
    });

    // Fetch project tasks
    const { data: projectTasks } = await supabase
      .from('project_tasks')
      .select('*, projects(title)')
      .eq('completed', false)
      .eq('user_id', user.id);

    ((projectTasks as ProjectTaskRow[] | null) || []).forEach(task => {
      tasks.push({
        type: 'project_task',
        id: task.id,
        title: task.title,
        source: `פרויקט: ${task.projects?.title || 'לא ידוע'}`,
      });
    });

    // Fetch course lessons
    const { data: courseLessons } = await supabase
      .from('course_lessons')
      .select('*, courses(title)')
      .eq('completed', false)
      .eq('user_id', user.id);

    ((courseLessons as CourseLessonRow[] | null) || []).forEach(lesson => {
      tasks.push({
        type: 'course_lesson',
        id: lesson.id,
        title: lesson.title,
        source: `קורס: ${lesson.courses?.title || 'לא ידוע'}`,
        scheduled_date: lesson.scheduled_date || undefined,
        duration_minutes: lesson.duration_minutes || undefined,
      });
    });

    return tasks;
  }, [user]);

  const buildTaskSummary = useCallback((tasks: PlannerTask[]) => {
    return tasks.map(t => {
      let info = `- ${t.title} (${t.source})`;
      if (t.urgent) info += ' [דחוף!]';
      if (t.overdue) info += ' [באיחור!]';
      if (t.scheduled_date) info += ` [תאריך יעד: ${t.scheduled_date}]`;
      const estimatedDuration = t.duration_minutes
        ? { minutes: t.duration_minutes, reason: 'משך קיים במערכת' }
        : estimateTaskDuration(t.title, t.source);
      info += ` [הערכת זמן: ${formatDurationLabel(estimatedDuration.minutes)} - ${estimatedDuration.reason}]`;
      return info;
    }).join('\n');
  }, []);

  const getCurrentTime = useCallback(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }, []);

  const getRangeLabel = (range: PlanningRange) => {
    switch (range) {
      case 'today':
        return 'היום';
      case 'tomorrow':
        return 'מחר';
      case 'week':
        return 'השבוע הקרוב';
      default:
        return 'היום';
    }
  };

  const buildPlanningContext = (tasks: PlannerTask[]) => {
    const taskSummary = buildTaskSummary(tasks);

    return `טווח התכנון: ${getRangeLabel(planningProfile.range)}
סוג יום: ${planningProfile.dayType === 'workday' ? 'יום עבודה' : planningProfile.dayType === 'day_off' ? 'יום חופשי' : 'לא ידוע עדיין'}
שעות עבודה: ${planningProfile.workStart && planningProfile.workEnd ? `${planningProfile.workStart}-${planningProfile.workEnd}` : 'לא נמסרו'}
זמן בבית / חלון מתאים למשימות בית: ${planningProfile.homeWindow || 'לא נמסר'}
אילוצים קבועים / אימונים / פגישות: ${planningProfile.fixedCommitments || 'לא נמסרו'}
משימות שחייבות להיכנס: ${planningProfile.mustDoTasks || 'לא נמסרו'}
בקשת שיבוץ: ${planningProfile.schedulingIntent === 'autoschedule' ? 'אם יש מספיק מידע והמשתמש מבקש, אפשר לשבץ אוטומטית במתכנן.' : 'תן קודם הצעה, בלי ליצור אירועים בפועל.'}

רשימת המשימות הפתוחות:
${taskSummary || '- אין כרגע משימות פתוחות'}`;
  };

  const generateDailyPlan = useCallback(async () => {
    setLoading(true);
    setMessages([]);

    try {
      const tasks = await fetchAllOpenTasks();
      setAllTasks(tasks);

      if (tasks.length === 0) {
        const emptyMsg: ChatMessage[] = [{ role: 'assistant', content: '🎉 אין משימות פתוחות! אתה מעודכן לגמרי.' }];
        setMessages(emptyMsg);
        await saveConversation(emptyMsg, []);
        return;
      }

      const taskSummary = buildTaskSummary(tasks);
      const currentTime = getCurrentTime();

      const { data, error } = await supabase.functions.invoke('task-ai-helper', {
        body: {
          taskDescription: taskSummary,
          taskCategory: 'daily_planning',
          startTime: currentTime,
          conversationHistory: []
        }
      });

      if (error) throw error;

      const newMessages: ChatMessage[] = [{ role: 'assistant', content: data.suggestion }];
      setMessages(newMessages);
      await saveConversation(newMessages, tasks);
    } catch (error) {
      console.error(error);
      toast.error('שגיאה ביצירת הלו"ז');
    } finally {
      setLoading(false);
    }
  }, [buildTaskSummary, fetchAllOpenTasks, getCurrentTime, saveConversation]);

  const sendPlanningAgentMessage = async (overrideMessage?: string) => {
    if (!user || loading) return;

    const initialPrompt = overrideMessage?.trim() || userInput.trim() || `תכנן לי את ${getRangeLabel(planningProfile.range)} לפי המשימות, הדחיפות והאילוצים שלי. אם חסר מידע - תשאל אותי שאלות קצרות וברורות.`;
    const tasks = allTasks.length > 0 ? allTasks : await fetchAllOpenTasks();
    if (allTasks.length === 0) {
      setAllTasks(tasks);
    }
    setPendingAction(null);
    const executeImmediately = planningProfile.schedulingIntent === 'autoschedule' || shouldAutoExecutePlanning(initialPrompt);

    const userMessage = `${initialPrompt}

הקשר תכנון:
${buildPlanningContext(tasks)}

${planningProfile.schedulingIntent === 'autoschedule'
  ? 'אם יש לך מספיק מידע, ובאמת ברור איך לשבץ, מותר גם להכניס את זה למתכנן בפועל.'
  : 'אל תיצור אירועים עדיין. תן קודם תכנית, שאלות חסרות, והמלצה על הסדר.'}`;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: initialPrompt }];
    setMessages(nextMessages);
    setUserInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('tabro-ai-agent', {
        body: {
          message: userMessage,
          conversationHistory: nextMessages.slice(-10).map((message) => ({
            role: message.role,
            content: message.content,
          })),
          userId: user.id,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          assistantMode: 'planning_agent',
          dryRunActions: !executeImmediately,
          plannerContext: {
            ...planningProfile,
            rangeLabel: getRangeLabel(planningProfile.range),
            taskCount: tasks.length,
          },
        },
      });

      if (error) throw error;

      const assistantMessage = data?.response || 'לא התקבלה תשובה מסוכן התכנון';
      const updatedMessages: ChatMessage[] = [...nextMessages, { role: 'assistant', content: assistantMessage }];
      setMessages(updatedMessages);
      await saveConversation(updatedMessages, tasks);

      if (data?.pendingAction) {
        setPendingAction(data.pendingAction as PendingAction);
        toast.success('התוכנית מוכנה. אפשר לאשר שיבוץ למתכנן.');
      }

      if (data?.action?.success) {
        toast.success(ACTION_LABELS[data.action.type] || 'בוצע בהצלחה');
      }
    } catch (error) {
      console.error(error);
      toast.error('שגיאה בהפעלת סוכן התכנון');
    } finally {
      setLoading(false);
    }
  };

  const confirmPendingSchedule = async () => {
    if (!user || !pendingAction || loading) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('tabro-ai-agent', {
        body: {
          userId: user.id,
          prebuiltAction: pendingAction,
          assistantMode: 'planning_agent',
        },
      });

      if (error) throw error;

      const confirmationText = data?.response || 'השיבוץ הוכנס למתכנן.';
      const updatedMessages: ChatMessage[] = [...messages, { role: 'assistant', content: confirmationText }];
      setMessages(updatedMessages);
      await saveConversation(updatedMessages, allTasks);
      setPendingAction(null);

      if (data?.action?.success) {
        toast.success(ACTION_LABELS[data.action.type] || 'השיבוץ נשמר במתכנן');
      }
    } catch (error) {
      console.error(error);
      toast.error('שגיאה באישור השיבוץ למתכנן');
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async () => {
    if (plannerMode === 'planning_agent') {
      await sendPlanningAgentMessage();
      return;
    }

    if (!userInput.trim() || loading) return;

    const userMessage = userInput.trim();
    setUserInput('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const taskSummary = buildTaskSummary(allTasks);

      const { data, error } = await supabase.functions.invoke('task-ai-helper', {
        body: {
          taskDescription: `המשתמש ביקש תיקונים ללו"ז.

רשימת המשימות הפתוחות:
${taskSummary}

בקשת המשתמש: ${userMessage}

חשוב מאוד:
- אם המשתמש נותן שעה (למשל "14:00" או "19 בערב") - התחל מאותה שעה בדיוק!
- עדכן את הלו"ז בפורמט טבלת Markdown מסודרת
- אם מבקש להוסיף פעילות - הוסף אותה בזמן מתאים
- אם מבקש להסיר משימות - הסר אותן
- בסוף הוסף המלצות ותובנות`,
          taskCategory: 'daily_planning_feedback',
          conversationHistory: messages
        }
      });

      if (error) throw error;

      const updatedMessages: ChatMessage[] = [...newMessages, { role: 'assistant', content: data.suggestion }];
      setMessages(updatedMessages);
      await saveConversation(updatedMessages, allTasks);
    } catch (error) {
      console.error(error);
      toast.error('שגיאה בעדכון הלו"ז');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFeedback();
    }
  };

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    if (date === 'new') {
      startNewConversation();
      setMessages([]);
      setAllTasks([]);
      setUserInput('');
      setSelectedDate(today);
    } else {
      await loadConversation(date);
    }
  };

  const initializeDialog = useCallback(async (mode: PlannerMode) => {
    setPlannerMode(mode);
    setOpen(true);
    setPendingAction(null);

    const tasks = await fetchAllOpenTasks();
    setAllTasks(tasks);
    const todayConv = await loadTodayConversation();
    if (todayConv) {
      setMessages(todayConv.messages);
      setAllTasks(todayConv.tasks_snapshot);
      setSelectedDate(today);
    } else if (mode === 'daily_plan') {
      generateDailyPlan();
    } else {
      setMessages([]);
      setSelectedDate(today);
    }
  }, [fetchAllOpenTasks, generateDailyPlan, loadTodayConversation, today]);

  useEffect(() => {
    const handleOpenPlannerAgent = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode?: PlannerMode }>;
      const requestedMode = customEvent.detail?.mode || 'planning_agent';
      void initializeDialog(requestedMode);
    };

    window.addEventListener('tabro:open-planning-agent', handleOpenPlannerAgent as EventListener);
    return () => {
      window.removeEventListener('tabro:open-planning-agent', handleOpenPlannerAgent as EventListener);
    };
  }, [initializeDialog]);

  const handleDialogOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      await initializeDialog(plannerMode);
    }
  };

  const urgentCount = allTasks.filter(t => t.urgent).length;
  const overdueCount = allTasks.filter(t => t.overdue).length;

  const copyToClipboard = () => {
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
    if (lastAssistantMessage) {
      navigator.clipboard.writeText(lastAssistantMessage.content);
      toast.success('הלו"ז הועתק! אפשר להדביק בוורד');
    }
  };

  const exportToWord = () => {
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
    if (!lastAssistantMessage) return;

    const content = lastAssistantMessage.content;
    
    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; direction: rtl; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #333; padding: 8px 12px; text-align: right; }
    th { background-color: #f0f0f0; font-weight: bold; }
    h1 { text-align: center; }
  </style>
</head>
<body>
  <h1>לו"ז יומי - ${new Date().toLocaleDateString('he-IL')}</h1>
  <pre style="white-space: pre-wrap; font-family: Arial;">${content}</pre>
</body>
</html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `לוז-יומי-${new Date().toLocaleDateString('he-IL')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('הקובץ הורד! אפשר לפתוח בוורד');
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (dateStr === today) return 'היום';
    return format(date, 'd בMMMM yyyy', { locale: he });
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpen}>
      <DialogTrigger asChild>
        <Button
          className="fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
        >
          <CalendarClock className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {plannerMode === 'planning_agent' ? 'סוכן תכנון ולוז' : 'תכנון יומי חכם'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={plannerMode} onValueChange={(value: PlannerMode) => setPlannerMode(value)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="בחר מצב תכנון" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily_plan">תכנון יומי מהיר</SelectItem>
              <SelectItem value="planning_agent">סוכן תכנון חכם</SelectItem>
            </SelectContent>
          </Select>

          {plannerMode === 'planning_agent' && (
            <div className="text-xs text-muted-foreground">
              שואל על אילוצים, מעריך זמנים, ויכול גם לשבץ למתכנן
            </div>
          )}
        </div>

        {/* History selector */}
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedDate} onValueChange={handleDateChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="בחר תאריך" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  שיחה חדשה
                </span>
              </SelectItem>
              {conversations.map(conv => (
                <SelectItem key={conv.id} value={conv.conversation_date}>
                  {formatDateLabel(conv.conversation_date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {plannerMode === 'planning_agent' && (
          <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-2">
            <Select
              value={planningProfile.range}
              onValueChange={(value: PlanningRange) => setPlanningProfile((prev) => ({ ...prev, range: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="טווח תכנון" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">לתכנן את היום</SelectItem>
                <SelectItem value="tomorrow">לתכנן את מחר</SelectItem>
                <SelectItem value="week">לתכנן שבוע קדימה</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={planningProfile.dayType}
              onValueChange={(value: PlanningProfile['dayType']) => setPlanningProfile((prev) => ({ ...prev, dayType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="יום עבודה או חופשי?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">עדיין לא החלטתי</SelectItem>
                <SelectItem value="workday">יום עבודה</SelectItem>
                <SelectItem value="day_off">יום חופשי</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={planningProfile.workStart}
              onChange={(event) => setPlanningProfile((prev) => ({ ...prev, workStart: event.target.value }))}
              placeholder="שעת התחלת עבודה, למשל 09:00"
            />
            <Input
              value={planningProfile.workEnd}
              onChange={(event) => setPlanningProfile((prev) => ({ ...prev, workEnd: event.target.value }))}
              placeholder="שעת סיום עבודה, למשל 17:30"
            />
            <Input
              value={planningProfile.homeWindow}
              onChange={(event) => setPlanningProfile((prev) => ({ ...prev, homeWindow: event.target.value }))}
              placeholder="מתי אתה בבית? למשל 18:30-23:00"
            />
            <Input
              value={planningProfile.fixedCommitments}
              onChange={(event) => setPlanningProfile((prev) => ({ ...prev, fixedCommitments: event.target.value }))}
              placeholder="אילוצים קבועים, אימון, פגישות, נסיעות"
            />
            <Input
              value={planningProfile.mustDoTasks}
              onChange={(event) => setPlanningProfile((prev) => ({ ...prev, mustDoTasks: event.target.value }))}
              placeholder="מה חייב להיכנס? למשל ביטוח, מיילים, קניות"
              className="md:col-span-2"
            />
            <Select
              value={planningProfile.schedulingIntent}
              onValueChange={(value: PlanningProfile['schedulingIntent']) => setPlanningProfile((prev) => ({ ...prev, schedulingIntent: value }))}
            >
              <SelectTrigger className="md:col-span-2">
                <SelectValue placeholder="מה לעשות עם התוכנית?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suggest">רק להציע תוכנית</SelectItem>
                <SelectItem value="autoschedule">גם לשבץ למתכנן אם יש מספיק מידע</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Stats */}
        {allTasks.length > 0 && (
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span>{allTasks.length} משימות פתוחות</span>
            </div>
            {urgentCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{urgentCount} דחופות</span>
              </div>
            )}
            {overdueCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <Clock className="h-4 w-4" />
                <span>{overdueCount} באיחור</span>
              </div>
            )}
          </div>
        )}

        {/* Chat Messages */}
        <ScrollArea className="flex-1 max-h-[50vh] pr-2">
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary/10 mr-8'
                    : 'bg-muted/50 ml-0'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center justify-center py-4 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">מעבד...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        {(messages.length > 0 || plannerMode === 'planning_agent') && (
          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={plannerMode === 'planning_agent'
                ? "כתוב מה תרצה לתכנן... למשל: תכנן לי את מחר ותשבץ למתכנן"
                : "בקש תיקונים... (למשל: 'התחל מ-14:00', 'הוסף נקיון הבית', 'בלי משימות עבודה')"}
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={sendFeedback}
              disabled={plannerMode === 'planning_agent' ? loading : loading || !userInput.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-2 pt-2 flex-wrap">
          {plannerMode === 'daily_plan' ? (
            <Button variant="outline" onClick={generateDailyPlan} disabled={loading} size="sm">
              <Sparkles className="h-4 w-4 ml-1" />
              צור לו"ז חדש
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => void sendPlanningAgentMessage()}
                disabled={loading}
                size="sm"
              >
                <Sparkles className="h-4 w-4 ml-1" />
                תכנן לי את {getRangeLabel(planningProfile.range)}
              </Button>
              <Button
                variant="outline"
                onClick={() => void sendPlanningAgentMessage('בדוק לי אילו מיילים צריכים מענה, כמה זמן ייקח לטפל בהם, ואיך נכון לשלב אותם בתכנון.')}
                disabled={loading}
                size="sm"
              >
                <History className="h-4 w-4 ml-1" />
                מיילים שדורשים מענה
              </Button>
            </>
          )}
          {messages.some(m => m.role === 'assistant') && (
            <>
              {plannerMode === 'planning_agent' && pendingAction && (
                <>
                  <Button variant="default" onClick={confirmPendingSchedule} size="sm" disabled={loading}>
                    <Sparkles className="h-4 w-4 ml-1" />
                    אשר ושבץ למתכנן
                  </Button>
                  <Button variant="outline" onClick={() => setPendingAction(null)} size="sm" disabled={loading}>
                    בטל שיבוץ מוכן
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={copyToClipboard} size="sm">
                <Copy className="h-4 w-4 ml-1" />
                העתק
              </Button>
              <Button variant="outline" onClick={exportToWord} size="sm">
                <FileText className="h-4 w-4 ml-1" />
                הורד לוורד
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AiDailyPlanner;
