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

    // Fetch context data for the user
    const [tasksRes, booksRes, projectsRes, eventsRes, showsRes, coursesRes, shoppingRes] = await Promise.all([
      supabase.from("tasks").select("id, description, status, task_type, category, responsible, planned_end, sheet_name").eq("user_id", userId).eq("archived", false).limit(100),
      supabase.from("books").select("id, title, author, status").eq("user_id", userId).limit(100),
      supabase.from("projects").select("id, title, description, status").eq("user_id", userId).limit(50),
      supabase.from("calendar_events").select("id, title, start_time, end_time, category").eq("user_id", userId).order("start_time", { ascending: false }).limit(50),
      supabase.from("shows").select("id, title, status, type").eq("user_id", userId).limit(50),
      supabase.from("courses").select("id, title, status").eq("user_id", userId).limit(50),
      supabase.from("shopping_items").select("id, title, status, category, sheet_name").eq("user_id", userId).eq("archived", false).limit(100),
    ]);

    // Fetch project tasks for progress
    const projectIds = (projectsRes.data || []).map(p => p.id);
    let projectTasksData: any[] = [];
    if (projectIds.length > 0) {
      const { data } = await supabase.from("project_tasks").select("id, title, completed, project_id, status").eq("user_id", userId).in("project_id", projectIds);
      projectTasksData = data || [];
    }

    const systemPrompt = `אתה Tabro AI - עוזר חכם לניהול משימות, לוחות זמנים ורשימות. אתה מדבר עברית.

יש לך גישה מלאה לנתוני המשתמש ויכולת לבצע פעולות בתוך האפליקציה.

## נתוני המשתמש הנוכחיים:

### משימות (${(tasksRes.data || []).length}):
${(tasksRes.data || []).map(t => `- [${t.task_type}] "${t.description}" | סטטוס: ${t.status} | קטגוריה: ${t.category || '-'} | אחראי: ${t.responsible || '-'} | מועד: ${t.planned_end || '-'}`).join('\n')}

### ספרים (${(booksRes.data || []).length}):
${(booksRes.data || []).map(b => `- "${b.title}" מאת ${b.author || '-'} | סטטוס: ${b.status}`).join('\n')}

### פרויקטים (${(projectsRes.data || []).length}):
${(projectsRes.data || []).map(p => {
  const pTasks = projectTasksData.filter(t => t.project_id === p.id);
  const completed = pTasks.filter(t => t.completed).length;
  const total = pTasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  return `- "${p.title}" | סטטוס: ${p.status} | התקדמות: ${progress}% (${completed}/${total} משימות)`;
}).join('\n')}

### אירועי לוח זמנים (${(eventsRes.data || []).length} אחרונים):
${(eventsRes.data || []).slice(0, 20).map(e => `- "${e.title}" | ${e.start_time} עד ${e.end_time} | קטגוריה: ${e.category}`).join('\n')}

### סדרות/סרטים (${(showsRes.data || []).length}):
${(showsRes.data || []).map(s => `- "${s.title}" | סוג: ${s.type} | סטטוס: ${s.status}`).join('\n')}

### קורסים (${(coursesRes.data || []).length}):
${(coursesRes.data || []).map(c => `- "${c.title}" | סטטוס: ${c.status}`).join('\n')}

### קניות (${(shoppingRes.data || []).length}):
${(shoppingRes.data || []).map(s => `- "${s.title}" | סטטוס: ${s.status} | קטגוריה: ${s.category || '-'} | רשימה: ${s.sheet_name}`).join('\n')}

## פעולות שאתה יכול לבצע:
כשהמשתמש מבקש לבצע פעולה, תחזיר תשובה שכוללת בלוק JSON מיוחד בתוך \`\`\`action ... \`\`\` עם הפעולה המבוקשת.

### הוספת משימה:
\`\`\`action
{"type": "add_task", "task_type": "work|personal", "description": "תיאור המשימה", "category": "קטגוריה", "responsible": "אחראי", "planned_end": "YYYY-MM-DD"}
\`\`\`

### הוספת אירוע ללוח זמנים:
\`\`\`action
{"type": "add_event", "title": "כותרת", "start_time": "ISO datetime", "end_time": "ISO datetime", "category": "קטגוריה"}
\`\`\`

### הוספת ספר:
\`\`\`action
{"type": "add_book", "title": "שם הספר", "author": "מחבר"}
\`\`\`

### הוספת פריט קניות:
\`\`\`action
{"type": "add_shopping", "title": "שם הפריט", "category": "קטגוריה", "sheet_name": "ראשי|סופר"}
\`\`\`

כשהמשתמש שואל שאלה על נתונים קיימים, ענה ישירות מהנתונים שלמעלה.
כשהמשתמש מבקש לבצע פעולה, כלול את בלוק ה-action וגם הסבר טקסטואלי.
תמיד תשיב בעברית. תהיה תמציתי וידידותי.`;

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
        model: "google/gemini-3-flash-preview",
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
        
        if (action.type === "add_task") {
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
          actionResult = error ? { success: false, error: error.message } : { success: true, type: "add_task" };
        }

        if (action.type === "add_event") {
          const { error } = await supabase.from("calendar_events").insert({
            user_id: userId,
            title: action.title,
            start_time: action.start_time,
            end_time: action.end_time,
            category: action.category || "משימה",
            source_type: "custom",
          });
          actionResult = error ? { success: false, error: error.message } : { success: true, type: "add_event" };
        }

        if (action.type === "add_book") {
          const { error } = await supabase.from("books").insert({
            user_id: userId,
            title: action.title,
            author: action.author || null,
            status: "לקרוא",
          });
          actionResult = error ? { success: false, error: error.message } : { success: true, type: "add_book" };
        }

        if (action.type === "add_shopping") {
          const { error } = await supabase.from("shopping_items").insert({
            user_id: userId,
            title: action.title,
            category: action.category || null,
            sheet_name: action.sheet_name || "ראשי",
            is_dream: false,
          });
          actionResult = error ? { success: false, error: error.message } : { success: true, type: "add_shopping" };
        }
      } catch (e) {
        console.error("Action parse error:", e);
      }
    }

    // Clean response text (remove action blocks from displayed message)
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
