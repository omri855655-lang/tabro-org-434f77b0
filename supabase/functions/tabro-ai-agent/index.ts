import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, conversationHistory, userId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch ALL context data for the user
    const [tasksRes, booksRes, projectsRes, eventsRes, showsRes, coursesRes, shoppingRes, podcastsRes, boardsRes, boardItemsRes, dreamGoalsRes] = await Promise.all([
      supabase.from("tasks").select("id, description, status, task_type, category, responsible, planned_end, sheet_name, urgent, overdue").eq("user_id", userId).eq("archived", false).limit(200),
      supabase.from("books").select("id, title, author, status, notes").eq("user_id", userId).limit(200),
      supabase.from("projects").select("id, title, description, status, target_date").eq("user_id", userId).limit(50),
      supabase.from("calendar_events").select("id, title, start_time, end_time, category, description").eq("user_id", userId).order("start_time", { ascending: false }).limit(100),
      supabase.from("shows").select("id, title, status, type, current_season, current_episode").eq("user_id", userId).limit(100),
      supabase.from("courses").select("id, title, status, notes").eq("user_id", userId).limit(50),
      supabase.from("shopping_items").select("id, title, status, category, sheet_name, quantity, price, is_dream").eq("user_id", userId).eq("archived", false).limit(200),
      supabase.from("podcasts").select("id, title, host, status").eq("user_id", userId).limit(100),
      supabase.from("custom_boards").select("id, name, statuses").eq("user_id", userId).limit(50),
      supabase.from("custom_board_items").select("id, title, status, category, board_id, sheet_name").eq("user_id", userId).eq("archived", false).limit(200),
      supabase.from("dream_goals").select("id, title, description, status, progress, target_date").eq("user_id", userId).eq("archived", false).limit(50),
    ]);

    // Fetch project tasks for progress
    const projectIds = (projectsRes.data || []).map(p => p.id);
    let projectTasksData: any[] = [];
    if (projectIds.length > 0) {
      const { data } = await supabase.from("project_tasks").select("id, title, completed, project_id, status").eq("user_id", userId).in("project_id", projectIds);
      projectTasksData = data || [];
    }

    // Fetch course lessons
    const courseIds = (coursesRes.data || []).map(c => c.id);
    let courseLessonsData: any[] = [];
    if (courseIds.length > 0) {
      const { data } = await supabase.from("course_lessons").select("id, title, completed, course_id").eq("user_id", userId).in("course_id", courseIds);
      courseLessonsData = data || [];
    }

    const boardsMap: Record<string, string> = {};
    (boardsRes.data || []).forEach((b: any) => { boardsMap[b.id] = b.name; });

    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `אתה Tabro AI - עוזר חכם עם שליטה מלאה באפליקציה. אתה מדבר עברית.

## נתוני המשתמש הנוכחיים:

### משימות עבודה (${(tasksRes.data || []).filter(t => t.task_type === 'work').length}):
${(tasksRes.data || []).filter(t => t.task_type === 'work').map(t => `- [ID:${t.id}] "${t.description}" | סטטוס: ${t.status} | קטגוריה: ${t.category || '-'} | אחראי: ${t.responsible || '-'} | מועד: ${t.planned_end || '-'}${t.urgent ? ' 🔥דחוף' : ''}${t.overdue ? ' ⚠️באיחור' : ''}`).join('\n')}

### משימות אישיות (${(tasksRes.data || []).filter(t => t.task_type === 'personal').length}):
${(tasksRes.data || []).filter(t => t.task_type === 'personal').map(t => `- [ID:${t.id}] "${t.description}" | סטטוס: ${t.status} | קטגוריה: ${t.category || '-'} | מועד: ${t.planned_end || '-'}`).join('\n')}

### ספרים (${(booksRes.data || []).length}):
${(booksRes.data || []).map(b => `- [ID:${b.id}] "${b.title}" מאת ${b.author || '-'} | סטטוס: ${b.status}`).join('\n')}

### פרויקטים (${(projectsRes.data || []).length}):
${(projectsRes.data || []).map(p => {
  const pTasks = projectTasksData.filter(t => t.project_id === p.id);
  const completed = pTasks.filter(t => t.completed).length;
  const total = pTasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  return `- [ID:${p.id}] "${p.title}" | סטטוס: ${p.status} | התקדמות: ${progress}% (${completed}/${total})
  משימות: ${pTasks.map(t => `[ID:${t.id}] "${t.title}" ${t.completed ? '✅' : '⬜'}`).join(', ')}`;
}).join('\n')}

### אירועי לוח זמנים (${(eventsRes.data || []).length}):
${(eventsRes.data || []).slice(0, 30).map(e => `- [ID:${e.id}] "${e.title}" | ${e.start_time} עד ${e.end_time} | קטגוריה: ${e.category}`).join('\n')}

### סדרות/סרטים (${(showsRes.data || []).length}):
${(showsRes.data || []).map(s => `- [ID:${s.id}] "${s.title}" | סוג: ${s.type} | סטטוס: ${s.status}${s.current_season ? ` | עונה ${s.current_season}` : ''}${s.current_episode ? ` פרק ${s.current_episode}` : ''}`).join('\n')}

### קורסים (${(coursesRes.data || []).length}):
${(coursesRes.data || []).map(c => {
  const lessons = courseLessonsData.filter(l => l.course_id === c.id);
  const done = lessons.filter(l => l.completed).length;
  return `- [ID:${c.id}] "${c.title}" | סטטוס: ${c.status} | שיעורים: ${done}/${lessons.length}`;
}).join('\n')}

### קניות (${(shoppingRes.data || []).length}):
${(shoppingRes.data || []).map(s => `- [ID:${s.id}] "${s.title}" | סטטוס: ${s.status} | קטגוריה: ${s.category || '-'} | רשימה: ${s.sheet_name}${s.is_dream ? ' ⭐חלום' : ''}`).join('\n')}

### פודקאסטים (${(podcastsRes.data || []).length}):
${(podcastsRes.data || []).map(p => `- [ID:${p.id}] "${p.title}"${p.host ? ` - ${p.host}` : ''} | סטטוס: ${p.status}`).join('\n')}

### רשימות מותאמות (${(boardsRes.data || []).length}):
${(boardsRes.data || []).map(b => {
  const items = (boardItemsRes.data || []).filter((i: any) => i.board_id === b.id);
  return `- רשימה "${b.name}" [ID:${b.id}]: ${items.map((i: any) => `"${i.title}" (${i.status})`).join(', ') || 'ריקה'}`;
}).join('\n')}

### חלומות ומטרות (${(dreamGoalsRes.data || []).length}):
${(dreamGoalsRes.data || []).map(d => `- [ID:${d.id}] "${d.title}" | סטטוס: ${d.status} | התקדמות: ${d.progress}%`).join('\n')}

התאריך היום: ${today}

## פעולות שאתה יכול לבצע:
כשהמשתמש מבקש פעולה, החזר בלוק JSON בתוך \`\`\`action ... \`\`\` עם הפעולה.

### הוספת משימה:
\`\`\`action
{"type": "add_task", "task_type": "work|personal", "description": "תיאור", "category": "קטגוריה", "responsible": "אחראי", "planned_end": "YYYY-MM-DD"}
\`\`\`

### עדכון סטטוס משימה (סיום/עדכון):
\`\`\`action
{"type": "update_task", "task_id": "UUID", "status": "בוצע|בתהליך|לא התחיל", "urgent": true/false}
\`\`\`

### הוספת אירוע ללוח זמנים:
\`\`\`action
{"type": "add_event", "title": "כותרת", "start_time": "ISO datetime", "end_time": "ISO datetime", "category": "קטגוריה"}
\`\`\`

### עדכון/מחיקת אירוע:
\`\`\`action
{"type": "update_event", "event_id": "UUID", "title": "כותרת", "start_time": "ISO", "end_time": "ISO"}
\`\`\`
\`\`\`action
{"type": "delete_event", "event_id": "UUID"}
\`\`\`

### הוספת ספר:
\`\`\`action
{"type": "add_book", "title": "שם הספר", "author": "מחבר", "status": "לקרוא|קורא|נקרא"}
\`\`\`

### עדכון סטטוס ספר:
\`\`\`action
{"type": "update_book", "book_id": "UUID", "status": "לקרוא|קורא|נקרא"}
\`\`\`

### הוספת פריט קניות:
\`\`\`action
{"type": "add_shopping", "title": "שם הפריט", "category": "קטגוריה", "sheet_name": "ראשי|סופר", "is_dream": false}
\`\`\`

### סימון פריט קניות (נקנה/לקנות):
\`\`\`action
{"type": "update_shopping", "item_id": "UUID", "status": "נקנה|לקנות"}
\`\`\`

### עדכון סטטוס פרויקט:
\`\`\`action
{"type": "update_project", "project_id": "UUID", "status": "פעיל|בהמתנה|הושלם"}
\`\`\`

### סימון משימת פרויקט:
\`\`\`action
{"type": "toggle_project_task", "task_id": "UUID", "completed": true}
\`\`\`

### הוספת משימה לפרויקט:
\`\`\`action
{"type": "add_project_task", "project_id": "UUID", "title": "כותרת"}
\`\`\`

### עדכון סטטוס סדרה/סרט:
\`\`\`action
{"type": "update_show", "show_id": "UUID", "status": "בצפייה|נצפה|לצפות", "current_season": 1, "current_episode": 5}
\`\`\`

### הוספת פריט לרשימה מותאמת:
\`\`\`action
{"type": "add_board_item", "board_id": "UUID", "title": "כותרת", "category": "קטגוריה"}
\`\`\`

### עדכון סטטוס קורס:
\`\`\`action
{"type": "update_course", "course_id": "UUID", "status": "בתכנון|פעיל|הושלם"}
\`\`\`

### פעולות מרובות:
\`\`\`action
{"type": "multi", "actions": [{"type": "...", ...}, {"type": "...", ...}]}
\`\`\`

## כללים:
- כשהמשתמש אומר "סיימתי" או "עשיתי" - עדכן את הסטטוס ל"בוצע"
- כשהמשתמש אומר "קניתי את X" - סמן ברשימת קניות כ"נקנה"
- חפש תמיד את הפריט הנכון לפי שם (חיפוש חלקי)
- כשנשאלת שאלה על מידע - ענה מהנתונים שלמעלה, אל תמציא
- תמיד השב בעברית. תהיה תמציתי וידידותי
- כשמבקשים להוסיף אירוע עם תאריך יחסי (כמו "מחר", "ב-26 לחודש") - חשב מהתאריך של היום
- אם המשתמש מבקש לראות את הלו"ז - הצג את האירועים הקרובים מהנתונים`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "payment_required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiResult = await response.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || "לא הצלחתי לענות";

    // Parse actions from the response
    const actionMatch = aiContent.match(/```action\s*\n?([\s\S]*?)\n?\s*```/);
    let actionResult = null;

    if (actionMatch) {
      try {
        const action = JSON.parse(actionMatch[1]);
        actionResult = await executeAction(supabase, userId, action);
      } catch (e) {
        console.error("Action parse error:", e);
        actionResult = { success: false, error: "שגיאה בפענוח הפעולה" };
      }
    }

    // Clean response text
    const cleanContent = aiContent.replace(/```action[\s\S]*?```/g, "").trim();

    return new Response(JSON.stringify({
      response: cleanContent,
      action: actionResult,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tabro-ai-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function executeAction(supabase: any, userId: string, action: any): Promise<any> {
  if (action.type === "multi" && Array.isArray(action.actions)) {
    const results = [];
    for (const a of action.actions) {
      results.push(await executeAction(supabase, userId, a));
    }
    return { success: results.every(r => r.success), type: "multi", results };
  }

  try {
    switch (action.type) {
      case "add_task": {
        const { error } = await supabase.from("tasks").insert({
          user_id: userId,
          description: action.description,
          task_type: action.task_type || "personal",
          category: action.category || null,
          responsible: action.responsible || null,
          planned_end: action.planned_end || null,
          status: "לא התחיל",
          sheet_name: String(new Date().getFullYear()),
        });
        return error ? { success: false, error: error.message } : { success: true, type: "add_task" };
      }

      case "update_task": {
        const updates: any = {};
        if (action.status) updates.status = action.status;
        if (action.urgent !== undefined) updates.urgent = action.urgent;
        if (action.responsible) updates.responsible = action.responsible;
        if (action.category) updates.category = action.category;
        if (action.planned_end) updates.planned_end = action.planned_end;
        const { error } = await supabase.from("tasks").update(updates).eq("id", action.task_id).eq("user_id", userId);
        return error ? { success: false, error: error.message } : { success: true, type: "update_task" };
      }

      case "add_event": {
        const { error } = await supabase.from("calendar_events").insert({
          user_id: userId,
          title: action.title,
          start_time: action.start_time,
          end_time: action.end_time,
          category: action.category || "משימה",
          source_type: "custom",
        });
        return error ? { success: false, error: error.message } : { success: true, type: "add_event" };
      }

      case "update_event": {
        const updates: any = {};
        if (action.title) updates.title = action.title;
        if (action.start_time) updates.start_time = action.start_time;
        if (action.end_time) updates.end_time = action.end_time;
        if (action.category) updates.category = action.category;
        const { error } = await supabase.from("calendar_events").update(updates).eq("id", action.event_id).eq("user_id", userId);
        return error ? { success: false, error: error.message } : { success: true, type: "update_event" };
      }

      case "delete_event": {
        const { error } = await supabase.from("calendar_events").delete().eq("id", action.event_id).eq("user_id", userId);
        return error ? { success: false, error: error.message } : { success: true, type: "delete_event" };
      }

      case "add_book": {
        const { error } = await supabase.from("books").insert({
          user_id: userId,
          title: action.title,
          author: action.author || null,
          status: action.status || "לקרוא",
        });
        return error ? { success: false, error: error.message } : { success: true, type: "add_book" };
      }

      case "update_book": {
        const updates: any = {};
        if (action.status) updates.status = action.status;
        const { error } = await supabase.from("books").update(updates).eq("id", action.book_id).eq("user_id", userId);
        return error ? { success: false, error: error.message } : { success: true, type: "update_book" };
      }

      case "add_shopping": {
        const { error } = await supabase.from("shopping_items").insert({
          user_id: userId,
          title: action.title,
          category: action.category || null,
          sheet_name: action.sheet_name || "ראשי",
          is_dream: action.is_dream || false,
        });
        return error ? { success: false, error: error.message } : { success: true, type: "add_shopping" };
      }

      case "update_shopping": {
        const { error } = await supabase.from("shopping_items").update({ status: action.status }).eq("id", action.item_id).eq("user_id", userId);
        return error ? { success: false, error: error.message } : { success: true, type: "update_shopping" };
      }

      case "update_project": {
        const { error } = await supabase.from("projects").update({ status: action.status }).eq("id", action.project_id).eq("user_id", userId);
        return error ? { success: false, error: error.message } : { success: true, type: "update_project" };
      }

      case "toggle_project_task": {
        const { error } = await supabase.from("project_tasks").update({ completed: action.completed }).eq("id", action.task_id).eq("user_id", userId);
        return error ? { success: false, error: error.message } : { success: true, type: "toggle_project_task" };
      }

      case "add_project_task": {
        const { error } = await supabase.from("project_tasks").insert({
          user_id: userId,
          project_id: action.project_id,
          title: action.title,
          sort_order: 0,
        });
        return error ? { success: false, error: error.message } : { success: true, type: "add_project_task" };
      }

      case "update_show": {
        const updates: any = {};
        if (action.status) updates.status = action.status;
        if (action.current_season) updates.current_season = action.current_season;
        if (action.current_episode) updates.current_episode = action.current_episode;
        const { error } = await supabase.from("shows").update(updates).eq("id", action.show_id).eq("user_id", userId);
        return error ? { success: false, error: error.message } : { success: true, type: "update_show" };
      }

      case "add_board_item": {
        const { error } = await supabase.from("custom_board_items").insert({
          user_id: userId,
          board_id: action.board_id,
          title: action.title,
          category: action.category || null,
          status: "לביצוע",
        });
        return error ? { success: false, error: error.message } : { success: true, type: "add_board_item" };
      }

      case "update_course": {
        const { error } = await supabase.from("courses").update({ status: action.status }).eq("id", action.course_id).eq("user_id", userId);
        return error ? { success: false, error: error.message } : { success: true, type: "update_course" };
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (e: any) {
    console.error("Action execution error:", e);
    return { success: false, error: e.message };
  }
}
