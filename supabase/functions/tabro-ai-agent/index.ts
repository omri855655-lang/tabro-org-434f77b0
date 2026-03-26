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
      supabase.from("calendar_events").select("id, title, start_time, end_time, category, description, color").eq("user_id", userId).order("start_time", { ascending: false }).limit(100),
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
      const { data } = await supabase.from("project_tasks").select("id, title, completed, project_id, status, assigned_email").eq("user_id", userId).in("project_id", projectIds);
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

    // IMPORTANT: Use Israel timezone for correct local time
    const israelNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const today = `${israelNow.getFullYear()}-${String(israelNow.getMonth() + 1).padStart(2, '0')}-${String(israelNow.getDate()).padStart(2, '0')}`;
    const currentTime = `${israelNow.getHours().toString().padStart(2, '0')}:${israelNow.getMinutes().toString().padStart(2, '0')}`;

    // Calculate Israel timezone offset for ISO dates
    const israelOffset = "+03:00"; // Israel Standard Time (adjust if DST matters)
    // More accurate: detect if currently in DST
    const jan = new Date(israelNow.getFullYear(), 0, 1);
    const jul = new Date(israelNow.getFullYear(), 6, 1);
    const janOffset = new Date(jan.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getTimezoneOffset();
    const julOffset = new Date(jul.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getTimezoneOffset();
    const isDST = israelNow.getTimezoneOffset && janOffset !== julOffset;
    // Israel: UTC+2 in winter, UTC+3 in summer (DST)
    const tzOffset = isDST ? "+03:00" : "+02:00";

    const systemPrompt = `אתה Tabro AI - עוזר חכם עם שליטה מלאה באפליקציה. אתה מדבר עברית.

## נתוני המשתמש הנוכחיים:

### משימות עבודה (${(tasksRes.data || []).filter(t => t.task_type === 'work').length}):
${(tasksRes.data || []).filter(t => t.task_type === 'work').map(t => `- [ID:${t.id}] "${t.description}" | סטטוס: ${t.status} | קטגוריה: ${t.category || '-'} | אחראי: ${t.responsible || '-'} | מועד: ${t.planned_end || '-'}${t.urgent ? ' 🔥דחוף' : ''}${t.overdue ? ' ⚠️באיחור' : ''} | גליון: ${t.sheet_name || '-'}`).join('\n')}

### משימות אישיות (${(tasksRes.data || []).filter(t => t.task_type === 'personal').length}):
${(tasksRes.data || []).filter(t => t.task_type === 'personal').map(t => `- [ID:${t.id}] "${t.description}" | סטטוס: ${t.status} | קטגוריה: ${t.category || '-'} | מועד: ${t.planned_end || '-'} | גליון: ${t.sheet_name || '-'}`).join('\n')}

### ספרים (${(booksRes.data || []).length}):
${(booksRes.data || []).map(b => `- [ID:${b.id}] "${b.title}" מאת ${b.author || '-'} | סטטוס: ${b.status}`).join('\n')}

### פרויקטים (${(projectsRes.data || []).length}):
${(projectsRes.data || []).map(p => {
  const pTasks = projectTasksData.filter(t => t.project_id === p.id);
  const completed = pTasks.filter(t => t.completed).length;
  const total = pTasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  return `- [ID:${p.id}] "${p.title}" | סטטוס: ${p.status} | התקדמות: ${progress}% (${completed}/${total})
  משימות: ${pTasks.map(t => `[ID:${t.id}] "${t.title}" ${t.completed ? '✅' : '⬜'}${t.assigned_email ? ` (${t.assigned_email})` : ''}`).join(', ')}`;
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
  // Group by sheet_name
  const sheets = [...new Set(items.map((i: any) => i.sheet_name || 'ראשי'))];
  const sheetsStr = sheets.map(s => {
    const sheetItems = items.filter((i: any) => (i.sheet_name || 'ראשי') === s);
    return `גליון "${s}": ${sheetItems.map((i: any) => '"' + i.title + '" (' + i.status + ')' + (i.category ? ' [' + i.category + ']' : '')).join(', ')}`;
  }).join(' | ');
  return '- רשימה "' + b.name + '" [ID:' + b.id + ']: ' + (sheetsStr || 'ריקה');
}).join('\n')}

### חלומות ומטרות (${(dreamGoalsRes.data || []).length}):
${(dreamGoalsRes.data || []).map(d => `- [ID:${d.id}] "${d.title}" | סטטוס: ${d.status} | התקדמות: ${d.progress}%`).join('\n')}

התאריך היום: ${today}
השעה עכשיו (שעון ישראל): ${currentTime}
אזור הזמן: Asia/Jerusalem (${tzOffset})

## הוראות פעולה - חשוב מאוד!
כשהמשתמש מבקש פעולה (הוספה, עדכון, מחיקה), אתה חייב להחזיר בלוק JSON של הפעולה.
הבלוק חייב להתחיל ב-\`\`\`action ולהסתיים ב-\`\`\`.
בתוכו JSON תקין בלבד - בלי הערות, בלי טקסט נוסף.

### דוגמאות לפעולות:

הוספת משימה:
\`\`\`action
{"type":"add_task","task_type":"work","description":"לסיים דוח","category":"עבודה","sheet_name":"2026"}
\`\`\`

הוספת משימה אישית:
\`\`\`action
{"type":"add_task","task_type":"personal","description":"לקנות אוכל","category":"אישי","sheet_name":"2026"}
\`\`\`

עדכון סטטוס משימה:
\`\`\`action
{"type":"update_task","task_id":"UUID","status":"בוצע"}
\`\`\`

הוספת אירוע למתכנן לוז:
חשוב מאוד! השעות חייבות להיות בשעון ישראל (${tzOffset}).
אם המשתמש אומר "ב-17:00" - שים 17:00 בשעון ישראל.
\`\`\`action
{"type":"add_event","title":"פגישה","start_time":"${today}T14:00:00${tzOffset}","end_time":"${today}T15:00:00${tzOffset}","category":"עבודה","color":"#f97316"}
\`\`\`

עדכון/מחיקת אירוע:
\`\`\`action
{"type":"update_event","event_id":"UUID","title":"כותרת","start_time":"ISO","end_time":"ISO"}
\`\`\`
\`\`\`action
{"type":"delete_event","event_id":"UUID"}
\`\`\`

הוספת ספר:
\`\`\`action
{"type":"add_book","title":"שם","author":"מחבר","status":"לקרוא"}
\`\`\`

עדכון סטטוס ספר:
\`\`\`action
{"type":"update_book","book_id":"UUID","status":"קורא"}
\`\`\`

פריט קניות:
\`\`\`action
{"type":"add_shopping","title":"חלב","category":"מוצרי חלב","sheet_name":"סופר"}
\`\`\`

סימון פריט קניות:
\`\`\`action
{"type":"update_shopping","item_id":"UUID","status":"נקנה"}
\`\`\`

עדכון פרויקט:
\`\`\`action
{"type":"update_project","project_id":"UUID","status":"הושלם"}
\`\`\`

סימון משימת פרויקט:
\`\`\`action
{"type":"toggle_project_task","task_id":"UUID","completed":true}
\`\`\`

הוספת משימה לפרויקט:
\`\`\`action
{"type":"add_project_task","project_id":"UUID","title":"כותרת"}
\`\`\`

עדכון סדרה:
\`\`\`action
{"type":"update_show","show_id":"UUID","status":"בצפייה","current_season":1,"current_episode":5}
\`\`\`

הוספת פריט לרשימה מותאמת:
אם המשתמש מבקש להוסיף פריט לרשימה מותאמת תחת גליון מסוים, השתמש ב-sheet_name.
\`\`\`action
{"type":"add_board_item","board_id":"UUID","title":"כותרת","category":"קטגוריה","sheet_name":"ראשי"}
\`\`\`

עדכון קורס:
\`\`\`action
{"type":"update_course","course_id":"UUID","status":"פעיל"}
\`\`\`

פעולות מרובות (כמה פעולות ביחד):
\`\`\`action
{"type":"multi","actions":[{"type":"add_task","task_type":"personal","description":"לקנות אוכל","sheet_name":"2026"},{"type":"add_event","title":"קניות","start_time":"${today}T15:00:00${tzOffset}","end_time":"${today}T16:00:00${tzOffset}","category":"אישי","color":"#a855f7"}]}
\`\`\`

## כללים חשובים:
1. כשהמשתמש מבקש לעשות פעולה - תמיד תכלול בלוק action תקין!
2. כשהמשתמש אומר "סיימתי" או "עשיתי" - עדכן סטטוס ל"בוצע"
3. כשמבקשים להוסיף משימה - תמיד תציין task_type (work/personal) ו-sheet_name (שנה נוכחית)
4. כשמבקשים להוסיף אירוע למתכנן לוז - חשב את התאריך הנכון מהתאריך של היום. **חשוב מאוד**: תמיד הוסף ${tzOffset} בסוף השעה כדי שהאירוע יופיע בשעון ישראל!
5. כשמבקשים משימה + אירוע ביחד - השתמש ב-multi action
6. כשהמשתמש אומר "קניתי" - סמן כ"נקנה"
7. חפש תמיד את הפריט הנכון לפי שם (חיפוש חלקי)
8. תמיד השב בעברית. תהיה תמציתי וידידותי
9. כשמבקשים לראות מידע - ענה מהנתונים שלמעלה, אל תמציא
10. אל תוסיף הערות או טקסט בתוך בלוק ה-JSON - רק JSON נקי
11. כשמבקשים להוסיף לרשימה מותאמת, הרשימות המותאמות מכילות גליונות (sheet_name). ברירת מחדל: "ראשי". אם המשתמש מציין גליון ספציפי - השתמש בו.
12. המשימות שאתה מוסיף יסומנו כ"נוסף ע"י Tabro AI" - זה קורה אוטומטית.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message },
    ];

    // Use tool calling for more reliable action extraction
    const tools = [
      {
        type: "function",
        function: {
          name: "execute_action",
          description: "Execute an action in the app (add task, update task, add event, etc.)",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "object",
                description: "The action to execute",
                properties: {
                  type: { type: "string", enum: ["add_task", "update_task", "add_event", "update_event", "delete_event", "add_book", "update_book", "add_shopping", "update_shopping", "update_project", "toggle_project_task", "add_project_task", "update_show", "add_board_item", "update_course", "multi"] },
                  task_type: { type: "string", enum: ["work", "personal"] },
                  description: { type: "string" },
                  category: { type: "string" },
                  responsible: { type: "string" },
                  planned_end: { type: "string" },
                  sheet_name: { type: "string" },
                  urgent: { type: "boolean" },
                  task_id: { type: "string" },
                  status: { type: "string" },
                  title: { type: "string" },
                  start_time: { type: "string" },
                  end_time: { type: "string" },
                  color: { type: "string" },
                  event_id: { type: "string" },
                  book_id: { type: "string" },
                  author: { type: "string" },
                  item_id: { type: "string" },
                  project_id: { type: "string" },
                  completed: { type: "boolean" },
                  show_id: { type: "string" },
                  current_season: { type: "number" },
                  current_episode: { type: "number" },
                  board_id: { type: "string" },
                  course_id: { type: "string" },
                  is_dream: { type: "boolean" },
                  actions: { type: "array", items: { type: "object" } },
                },
                required: ["type"]
              }
            },
            required: ["action"]
          }
        }
      }
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
        tools,
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
    const choice = aiResult.choices?.[0];
    const aiMessage = choice?.message;
    const aiContent = aiMessage?.content || "";

    let actionResult = null;

    // Check for tool calls first (more reliable)
    if (aiMessage?.tool_calls && aiMessage.tool_calls.length > 0) {
      for (const toolCall of aiMessage.tool_calls) {
        if (toolCall.function?.name === "execute_action") {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const action = args.action;
            console.log("Executing tool call action:", JSON.stringify(action));
            actionResult = await executeAction(supabase, userId, action);
            console.log("Action result:", JSON.stringify(actionResult));
          } catch (e) {
            console.error("Tool call parse error:", e);
          }
        }
      }
    }

    // Fallback: also check for ```action blocks in content
    if (!actionResult) {
      const actionMatch = aiContent.match(/```action\s*\n?([\s\S]*?)\n?\s*```/);
      if (actionMatch) {
        try {
          const action = JSON.parse(actionMatch[1].trim());
          console.log("Executing inline action:", JSON.stringify(action));
          actionResult = await executeAction(supabase, userId, action);
          console.log("Action result:", JSON.stringify(actionResult));
        } catch (e) {
          console.error("Action parse error:", e);
          actionResult = { success: false, error: "שגיאה בפענוח הפעולה" };
        }
      }
    }

    // Clean response text
    const cleanContent = aiContent.replace(/```action[\s\S]*?```/g, "").trim();

    // Build response text
    let responseText = cleanContent;
    if (!responseText && actionResult?.success) {
      responseText = "בוצע! ✅";
    } else if (!responseText) {
      responseText = "לא הצלחתי לענות";
    }

    return new Response(JSON.stringify({
      response: responseText,
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
          description: action.description || action.title,
          task_type: action.task_type || "personal",
          category: action.category || null,
          responsible: action.responsible || null,
          planned_end: action.planned_end || null,
          urgent: action.urgent || false,
          status: action.status || "לא התחיל",
          sheet_name: action.sheet_name || String(new Date().getFullYear()),
          creator_name: "Tabro AI",
          creator_username: "tabro-ai",
          creator_email: "ai@tabro.app",
          last_editor_name: "Tabro AI",
          last_editor_username: "tabro-ai",
          last_editor_email: "ai@tabro.app",
        });
        if (error) console.error("add_task error:", error);
        return error ? { success: false, error: error.message } : { success: true, type: "add_task" };
      }

      case "update_task": {
        const updates: any = {
          last_editor_name: "Tabro AI",
          last_editor_username: "tabro-ai",
          last_editor_email: "ai@tabro.app",
        };
        if (action.status) updates.status = action.status;
        if (action.urgent !== undefined) updates.urgent = action.urgent;
        if (action.responsible) updates.responsible = action.responsible;
        if (action.category) updates.category = action.category;
        if (action.planned_end) updates.planned_end = action.planned_end;
        if (action.description) updates.description = action.description;
        const { error } = await supabase.from("tasks").update(updates).eq("id", action.task_id).eq("user_id", userId);
        if (error) console.error("update_task error:", error);
        return error ? { success: false, error: error.message } : { success: true, type: "update_task" };
      }

      case "add_event": {
        const { error } = await supabase.from("calendar_events").insert({
          user_id: userId,
          title: action.title,
          start_time: action.start_time,
          end_time: action.end_time,
          category: action.category || "משימה",
          color: action.color || null,
          source_type: "ai",
          description: "נוסף ע\"י Tabro AI",
        });
        if (error) console.error("add_event error:", error);
        return error ? { success: false, error: error.message } : { success: true, type: "add_event" };
      }

      case "update_event": {
        const updates: any = {};
        if (action.title) updates.title = action.title;
        if (action.start_time) updates.start_time = action.start_time;
        if (action.end_time) updates.end_time = action.end_time;
        if (action.category) updates.category = action.category;
        if (action.color) updates.color = action.color;
        const { error } = await supabase.from("calendar_events").update(updates).eq("id", action.event_id).eq("user_id", userId);
        if (error) console.error("update_event error:", error);
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
        if (error) console.error("add_book error:", error);
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
          quantity: action.quantity || null,
        });
        if (error) console.error("add_shopping error:", error);
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
        if (error) console.error("add_project_task error:", error);
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
          sheet_name: action.sheet_name || "ראשי",
          status: action.status || "לביצוע",
        });
        if (error) console.error("add_board_item error:", error);
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
