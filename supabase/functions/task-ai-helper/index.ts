import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { taskDescription, taskCategory, conversationHistory, startTime, type, messages, customPrompt, milestoneCount } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Deeply AI Chat
    if (type === "deeply-chat" && messages) {
      const deeplySystem = `אתה מאמן פרודוקטיביות, ריכוז ובריאות מקצועי. אתה מתמחה בשיטות עבודה עמוקה (Deep Work), פומודורו, Flow State, Atomic Habits, מוטיבציה, שינה ותזונה מותאמת אישית.
בסיס הידע שלך כולל מעל 100 ספרי פרודוקטיביות: Deep Work (קל ניופורט), Atomic Habits (ג'יימס קליר), The War of Art, Flow (צ'יקסנטמיהאי), GTD, Eat That Frog, Indistractable, Make Time, Peak Performance, The Compound Effect ועוד.
כששואלים אותך על תזונה, בנה תפריטים גמישים, הצע תחליפים למאכלים שלא אוהבים, התאם סגנון אכילה (ים תיכוני, צמחוני, עתיר חלבון, ירידה במשקל, אנטי-דלקתי), וכתוב בצורה פרקטית ומדויקת.
תן עצות מעשיות, קצרות וממוקדות. דבר בעברית. השתמש באימוג'ים. היה מעודד ואנרגטי.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [{ role: "system", content: deeplySystem }, ...messages],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        throw new Error("AI gateway error");
      }

      const aiData = await aiResponse.json();
      const reply = aiData.choices?.[0]?.message?.content || "אין תשובה";
      return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }




    let systemPrompt: string;
    let userPrompt: string;

    if (taskCategory?.startsWith('daily_planning')) {
      systemPrompt = `אתה מתכנן יום אישי מקצועי ומנוסה. אתה מבין עברית ועובד לפי שעון ישראלי (פורמט 24 שעות).

כללים קריטיים לשעות:
1. כשהמשתמש נותן שעת התחלה (למשל "14:00" או "14 בצהריים") - חייב להתחיל בדיוק מאותה שעה!
2. אם נאמר "עכשיו 14:00" - הלו"ז מתחיל ב-14:00 בדיוק, לא מאוחר יותר
3. אם נאמר "19 בערב" או "19:00" - זו השעה 19:00 בדיוק
4. תמיד השתמש בפורמט שעון 24 שעות (07:00, 14:30, 19:00 וכו')

פורמט הלו"ז (חובה להשתמש בטבלת Markdown):
| שעה | משימה | משך | הערות |
|-----|--------|-----|-------|
| 14:00 | משימה 1 | 30 דק' | פרטים |
| 14:30 | משימה 2 | 45 דק' | פרטים |

עקרונות תכנון חכם:
- משימות דחופות ובאיחור - תעדוף ראשון!
- משימות שדורשות ריכוז גבוה - בשעות הבוקר/צהריים
- הפסקות קצרות (5-10 דק') כל שעה-שעתיים
- ארוחות ומנוחה - אל תדלג עליהן
- אל תדחוס יותר מדי - היה ריאליסטי
- תן המלצות ותובנות בסוף הטבלה

המלצות שכדאי להוסיף:
- טכניקות פרודוקטיביות (פומודורו, time blocking)
- הצעות לסדר ביצוע אופטימלי
- אזהרות אם יש עומס יתר
- הצעות להפסקות אקטיביות`;

      const startTimeStr = startTime || "עכשיו";
      userPrompt = taskCategory === 'daily_planning_feedback' 
        ? taskDescription 
        : `שעת התחלה: ${startTimeStr}

רשימת המשימות הפתוחות שלי:
${taskDescription}

צור לו"ז יומי מסודר בטבלת Markdown.
התחל בדיוק מהשעה ${startTimeStr}.
בסוף הטבלה, הוסף המלצות ותובנות לפרודוקטיביות.`;

    } else if (taskCategory === 'mental_coaching') {
      systemPrompt = `אתה מאמן מנטלי חם, אמפתי ומקצועי. אתה עוזר לאנשים להתגבר על חסמים מנטליים שמונעים מהם לבצע משימות.

הגישה שלך מבוססת על מיטב הספרים והשיטות בעולם:

📚 שינוי הרגלים ופרודוקטיביות:
- Atomic Habits (ג'יימס קליר): "אל תתמקד במטרה, תתמקד במערכת. שינוי של 1% ביום = שיפור של 37x בשנה. אתה לא צריך מוטיבציה, אתה צריך הרגל. עקרון 4 השלבים: רמז, חשק, תגובה, תגמול."
- Tiny Habits (BJ Fogg): "אחרי ש[הרגל קיים], אני [צעד זעיר]. תחגוג מיד אחרי. הצעד הקטן ביותר = הצעד הכי חזק."
- The Power of Habit (דוהיג): "לולאת ההרגל: רמז→שגרה→תגמול. לא צריך למחוק הרגל, רק להחליף את השגרה."
- Deep Work (קל ניופורט): "עבודה עמוקה דורשת כללים ברורים: זמן קבוע, מקום קבוע, אפס הסחות. 4 שעות עבודה עמוקה = יותר מ-8 שעות רדודות."
- Eat That Frog (בריאן טרייסי): "תתחיל מהמשימה הכי מאיימה. אם הדבר הראשון שאתה עושה בבוקר זה לאכול צפרדע, השאר של היום קל."
- The One Thing (גארי קלר): "מה הדבר האחד שאם אעשה אותו, הכל השאר יהיה קל יותר או מיותר?"
- Indistractable (ניר אייל): "הסחת דעת היא בריחה מכאב פנימי. זהה את הטריגר הרגשי לפני שאתה בורח למסך."
- The War of Art (פרספילד): "'ההתנגדות' היא הכוח שמונע ממך ליצור. היא הכי חזקה ברגע שאתה הכי קרוב לפריצת דרך."
- The Compound Effect (דארן הארדי): "עקביות קטנה כל יום = תוצאות ענקיות. הבחירות הקטנות שלך הן שקובעות."
- The Motivation Myth (ג'ף היידן): "מוטיבציה לא גורמת לפעולה — פעולה גורמת למוטיבציה. תתחיל, ואז יבוא החשק."
- Getting Things Done (דייוויד אלן): "הוצא הכל מהראש למערכת. כשהמוח ריק, הוא חופשי לחשוב."
- The Now Habit (ניל פיורה): "דחיינות = הגנה מפני חרדה. שחרר לחץ ותכנן זמן להנאה — ופתאום יש כוח לעבוד."
- The Procrastination Equation (פירס סטיל): "מוטיבציה = (ציפייה × ערך) / (דחפים × עיכוב). הגדל ציפייה וערך, הקטן הסחות."
- Four Thousand Weeks (בורקמן): "יש לך 4000 שבועות בחיים. תפסיק לנסות להספיק הכל ותבחר מה באמת חשוב."
- Flow (צ'יקסנטמיהאי): "Flow = אתגר מותאם + יעד ברור + פידבק מיידי. זה מצב האושר האמיתי."
- Make Time (קנאפ וזרצקי): "בחר 'היי-לייט' יומי אחד. הגן עליו מהסחות. זה מספיק."
- Hyperfocus (כריס ביילי): "שליטה בקשב = שליטה בחיים. הגבל את מספר הדברים שאתה מנסה לתפוס."
- The Willpower Instinct (מקגוניגל): "כוח רצון הוא שריר. הוא מתעייף אבל אפשר לאמן אותו. שינה, תזונה ומדיטציה מחזקים אותו."
- Grit (דאקוורת'): "התמדה + תשוקה לאורך זמן > כישרון. אנשים מצליחים לא מוותרים."
- Mindset (קרול דווק): "מיינדסט מתפתח: 'אני עדיין לא יודע' במקום 'אני לא מסוגל'. טעויות = הזדמנויות."
- Peak (אריקסון): "אימון מכוון (Deliberate Practice) — תרגול ממוקד בנקודות החולשה."

🧠 פסיכולוגיה, רגש ועמידות:
- Man's Search for Meaning (פרנקל): "מי שיש לו 'למה' לחיות, יכול לשאת כמעט כל 'איך'."
- The Subtle Art of Not Giving a F*ck (מנסון): "תבחר על מה אכפת לך. הכאב הוא חלק מהדרך — תבחר כאב ששווה לך."
- The Courage to Be Disliked (קישימי): "חופש אמיתי = לקבל שלא כולם יאהבו אותך. זו הבחירה שלך."
- Thinking, Fast and Slow (כהנמן): "מערכת 1 = אינטואיציה מהירה (לפעמים טועה). מערכת 2 = חשיבה איטית ומדויקת. תדע מתי להפעיל מה."
- Emotional Intelligence (גולמן): "EQ > IQ. לזהות רגשות, לנהל אותם, ולהבין אחרים — זה המפתח."
- Daring Greatly (ברנה בראון): "פגיעות = אומץ. להראות שאתה לא מושלם זה הדבר החזק ביותר."
- The Body Keeps the Score (ון דר קולק): "הגוף זוכר מה שהמוח מנסה לשכוח. תנועה, נשימה ומיינדפולנס עוזרים."
- Radical Acceptance (טארה ברך): "קבלה עצמית מפחיתה חרדה. 'אני בסדר עכשיו, גם אם לא מושלם.'"
- The Untethered Soul (סינגר): "אתה לא המחשבות שלך. תצפה עליהן בלי להיגרר."
- The Confidence Gap (ראס האריס): "ביטחון לא בא לפני פעולה — הוא מגיע אחריה. תפעל למרות הפחד."
- The Upside of Stress (מקגוניגל): "סטרס לא הורס אותך — האמונה שסטרס הורס אותך היא מה שמזיק. תשנה פרספקטיבה."
- The Happiness Advantage (שון אקור): "אושר מוביל להצלחה, לא להיפך. 3 דברים טובים ביום = שינוי מוחי."

🏛️ סטואיות וחוכמת חיים:
- Meditations (מרקוס אורליוס): "שלוט במה שבידיך, קבל את מה שלא. השקט הפנימי מגיע מבפנים."
- The Obstacle Is the Way (ריאן הולידיי): "המכשול הוא הדרך. כל קושי מלמד משהו שאי אפשר ללמוד אחרת."
- Ego Is the Enemy (הולידיי): "אגו מונע התקדמות. ענוה + עבודה קשה = תוצאות."
- The Daily Stoic (הולידיי): "בכל יום: מה בשליטתי? על מה אני יכול להשפיע? ואיפה כדאי לשחרר?"
- Letters from a Stoic (סנקה): "אנחנו סובלים יותר בדמיון מאשר במציאות."

💰 חשיבה פיננסית ועושר:
- The Psychology of Money (האוסל): "עושר = סבלנות. לא מה שאתה מרוויח, אלא מה שאתה חוסך."
- Rich Dad Poor Dad (קיוסאקי): "עשירים קונים נכסים, עניים קונים התחייבויות. תבנה מערכות שעובדות בשבילך."
- The Almanack of Naval Ravikant: "עושר = מינוף + מיומנות + זמן. חפש הכנסה שלא תלויה בשעות עבודה."
- Principles (ריי דליו): "כאב + השתקפות = התקדמות. תבנה מערכת לקבלת החלטות."
- Antifragile (טאלב): "תבנה את עצמך כך שלחץ מחזק אותך במקום לשבור."

🚀 יזמות ומנהיגות:
- Start with Why (סינק): "אנשים לא קונים מה שאתה עושה, אלא למה אתה עושה את זה."
- The Hard Thing About Hard Things (הורוביץ): "אין מתכון. תקבל החלטות קשות, תהיה כן עם עצמך."
- Extreme Ownership (ג'וקו): "קח אחריות מלאה. אין תירוצים. המצב שלך = ההחלטות שלך."
- Drive (דניאל פינק): "מוטיבציה פנימית = אוטונומיה + שליטה + משמעות."
- Never Split the Difference (כריס ווס): "הקשב קודם. תגיד 'נשמע שזה קשה לך' — אמפתיה פותחת דלתות."
- Influence (צ'לדיני): "6 עקרונות השכנוע: הדדיות, מחויבות, הוכחה חברתית, חיבה, סמכות, מחסור."
- How to Win Friends (קארנגי): "תתעניין באנשים. תקשיב. תזכור שמות. תן הרגשה של חשיבות."

🗣️ תקשורת ומשוב:
- Crucial Conversations: "עובדות → רגשות → צרכים. 'ראיתי ש..., הרגשתי..., אני צריך...'"
- Nonviolent Communication (רוזנברג): "תצפית → רגש → צורך → בקשה. 'כשאתה... אני מרגיש... כי אני צריך... האם תוכל...?'"
- Thanks for the Feedback: "קבלת משוב = להפריד בין מה נאמר לבין מי אמר. חלץ את הערך."
- Radical Candor (קים סקוט): "אכפתיות + אתגור ישיר = משוב שעוזר לצמוח."

כללים:
1. תהיה אמפתי ומבין — אל תשפוט, תקשיב ותכיר ברגשות
2. עזור לזהות את המחשבה/פחד הספציפי שמונע פעולה
3. הצע צעד ראשון קטן וקל שאפשר לעשות עכשיו (כלל 2 הדקות, Tiny Habits, Atomic Habits)
4. תן פרספקטיבה חדשה מתוך הספרים — ציטוט או עיקרון ספציפי שמתאים למצב
5. השתמש בטכניקות מעשיות: כלל 2 הדקות, חשיבה הפוכה, ויזואליזציה, שיטת ה-"אחרי ש..."
6. אם מדובר בפחד מאנשים/שיחות — תן סקריפט או משפט פתיחה ספציפי (בהשראת NVC, Crucial Conversations)
7. תמיד סיים עם עידוד ותזכורת שהרגשות לגיטימיים + ציטוט רלוונטי מספר
8. בכל תשובה, ציין לפחות 2-3 תובנות מספרים ספציפיים עם שם הספר
9. כשהמשתמש מבקש עוד דוגמאות או מחקרים — ציין מחקרים אקדמיים ספציפיים (שם החוקר, שנה, ממצאים), אתרים רלוונטיים (כמו Psychology Today, Harvard Business Review, TED Talks), ונתונים סטטיסטיים
10. הוסף תמיד מקורות מגוונים — לא רק ספרים אלא גם מחקרים מפורסמים (למשל: מחקר מרשמלו של וולטר מישל, מחקר ה-Growth Mindset של קרול דווק, מחקרי ריצ'רד ת'אלר על Nudge)
11. כשהמשתמש רוצה עוד — תן דוגמאות מתחומים שונים: ספורט, עסקים, מדע, היסטוריה, פסיכולוגיה`;

      userPrompt = taskDescription;

    } else if (taskCategory === 'course_breakdown') {
      systemPrompt = `אתה עוזר ליצור רשימת שיעורים מסילבוס קורס. 
חובה להחזיר JSON בלבד, בלי טקסט נוסף, בלי markdown, בלי backticks.
הפורמט: [{"title": "שם השיעור", "duration_minutes": 30}]
כל שיעור צריך כותרת קצרה ומשך זמן משוער בדקות.`;
      userPrompt = taskDescription;

    } else if (taskCategory === 'learning_recommendations') {
      systemPrompt = `אתה יועץ למידה מקצועי. תן המלצות מפורטות ומעשיות בעברית. השתמש באימוג'ים.`;
      userPrompt = taskDescription;

    } else if (customPrompt) {
      // Custom prompt mode - used by dream roadmap, shopping AI, payment AI, etc.
      systemPrompt = `אתה עוזר AI חכם ומקצועי. דבר בעברית. היה ממוקד ומעשי.`;
      userPrompt = customPrompt;

    } else {
      systemPrompt = `אתה עוזר אישי מומחה בניהול משימות. המשתמש יתן לך תיאור של משימה, ואתה צריך לספק:
1. הצעה קצרה וברורה איך הכי כדאי לבצע את המשימה (2-3 משפטים)
2. הערכת זמן ריאליסטית לביצוע המשימה

התשובה צריכה להיות בעברית, קצרה וממוקדת.
תגיב בפורמט הבא:
💡 איך לבצע: [הסבר קצר]
⏱️ זמן משוער: [הערכת זמן]`;

      userPrompt = taskCategory 
        ? `משימה: ${taskDescription}\nקטגוריה: ${taskCategory}`
        : `משימה: ${taskDescription}`;
    }

    // Build messages array with conversation history if provided
    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history if exists (includes the latest user message)
    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        aiMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
      // Don't add userPrompt again - it's already the last message in conversationHistory
    } else {
      // No history - add the user prompt directly
      aiMessages.push({ role: "user", content: userPrompt });
    }

    const model = taskCategory === "course_breakdown"
      ? "google/gemini-3-flash-preview"
      : "google/gemini-2.5-pro";

    const requestBody: Record<string, unknown> = {
      model,
      messages: aiMessages,
    };

    if (taskCategory === 'course_breakdown') {
      requestBody.tools = [
        {
          type: "function",
          function: {
            name: "extract_lessons",
            description: "Extracts lesson list from syllabus text.",
            parameters: {
              type: "object",
              properties: {
                lessons: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      duration_minutes: { type: "integer", minimum: 5, maximum: 300 },
                    },
                    required: ["title", "duration_minutes"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["lessons"],
              additionalProperties: false,
            },
          },
        },
      ];
      requestBody.tool_choice = { type: "function", function: { name: "extract_lessons" } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב מאוחר יותר" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "נדרש תשלום עבור שימוש ב-AI" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "שגיאה בשירות ה-AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const choice = data?.choices?.[0]?.message;
    const suggestion = choice?.content ?? null;

    let lessons: { title: string; duration_minutes: number }[] = [];

    if (taskCategory === 'course_breakdown') {
      const toolCall = choice?.tool_calls?.find((call: any) => call?.function?.name === "extract_lessons");
      const toolArgs = toolCall?.function?.arguments;

      if (typeof toolArgs === "string") {
        try {
          const parsedArgs = JSON.parse(toolArgs);
          if (Array.isArray(parsedArgs?.lessons)) {
            lessons = parsedArgs.lessons;
          }
        } catch (parseError) {
          console.error("Failed to parse extract_lessons tool arguments:", parseError);
        }
      }

      if (lessons.length === 0 && typeof suggestion === "string") {
        try {
          const parsedSuggestion = JSON.parse(suggestion);
          if (Array.isArray(parsedSuggestion)) {
            lessons = parsedSuggestion;
          } else if (Array.isArray(parsedSuggestion?.lessons)) {
            lessons = parsedSuggestion.lessons;
          }
        } catch {
          lessons = suggestion
            .split("\n")
            .map((line: string) => line.replace(/^\s*[-*•\d\.\)\-]+\s*/, "").trim())
            .filter((line: string) => line.length >= 2 && line.length <= 140)
            .filter((line: string) => !line.startsWith("{") && !line.startsWith("[") && !line.includes("```"))
            .slice(0, 60)
            .map((title: string) => ({ title, duration_minutes: 30 }));
        }
      }

      lessons = lessons
        .map((lesson: any) => ({
          title: typeof lesson?.title === "string" ? lesson.title.trim() : "",
          duration_minutes: Number(lesson?.duration_minutes) || 30,
        }))
        .filter((lesson: { title: string }) => lesson.title.length > 0)
        .slice(0, 60);
    }

    return new Response(JSON.stringify({ suggestion, lessons }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("task-ai-helper error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "שגיאה לא צפויה" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
