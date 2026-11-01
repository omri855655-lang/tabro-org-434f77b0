import { assert, assertEquals } from "jsr:@std/assert@1";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { buildReport } from "./report.ts";
import { buildBriefingPdf, sanitizePdfText, visualOrder } from "../_shared/briefingPdf.ts";
import { DEFAULT_BRIEFING_EMAIL } from "../_shared/briefingSchedule.ts";
import { makeDailyBriefing } from "../_shared/dailyBriefing.ts";
import { buildBriefingEmail } from "./emailContent.ts";

const USER = "11111111-1111-1111-1111-111111111111";

// Minimal query-builder fake that records every filter and returns canned rows.
function fakeAdmin(rows: Record<string, unknown[]>) {
  const calls: { table: string; filters: string[] }[] = [];
  return {
    calls,
    from(table: string) {
      const call = { table, filters: [] as string[] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      const chain = (name: string) => (...args: unknown[]) => { call.filters.push(`${name}:${args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(",")}`); return builder; };
      for (const name of ["select", "eq", "neq", "gte", "lte", "or", "order", "limit"]) builder[name] = chain(name);
      builder.then = (resolve: (v: unknown) => void) => resolve({ data: rows[table] || [], error: null });
      return builder;
    },
  };
}

Deno.test("every data query is scoped to the requesting user", async () => {
  const admin = fakeAdmin({});
  await buildReport(admin, USER, "morning", new Date("2026-11-01T06:00:00Z"), {}, DEFAULT_BRIEFING_EMAIL);
  assertEquals(admin.calls.map(c => c.table).sort(), ["calendar_events", "email_analyses", "project_tasks", "recurring_task_completions", "recurring_tasks", "tasks"]);
  for (const call of admin.calls) assert(call.filters.includes(`eq:user_id,${USER}`), `${call.table} missing user filter`);
  assert(admin.calls.find(c => c.table === "tasks")!.filters.includes("eq:archived,false"));
  assert(admin.calls.find(c => c.table === "project_tasks")!.filters.includes("eq:completed,false"));
});

Deno.test("afternoon and mail opt-out never read email metadata", async () => {
  const afternoon = fakeAdmin({});
  await buildReport(afternoon, USER, "afternoon", new Date("2026-11-01T14:00:00Z"), {}, DEFAULT_BRIEFING_EMAIL);
  assert(!afternoon.calls.some(c => c.table === "email_analyses"));
  const optedOut = fakeAdmin({});
  await buildReport(optedOut, USER, "morning", new Date("2026-11-01T06:00:00Z"), {}, { ...DEFAULT_BRIEFING_EMAIL, includeMail: false, includePlanner: false });
  assertEquals(optedOut.calls.map(c => c.table).sort(), ["project_tasks", "recurring_task_completions", "recurring_tasks", "tasks"]);
});

Deno.test("report merges tasks, due recurring and open project tasks, excluding completed", async () => {
  const admin = fakeAdmin({
    tasks: [
      { id: "a", description: "Open today", status: "בטיפול", planned_end: "2026-11-01", urgent: false, overdue: false, archived: false, responsible: "Dana", task_type: "work", progress: null, status_notes: "Call before noon" },
      { id: "b", description: "Done", status: "בוצע", planned_end: "2026-11-01", urgent: true, overdue: false, archived: false, responsible: null, task_type: "work" },
    ],
    recurring_tasks: [{ id: "r1", title: "Daily review", description: null, frequency: "daily", day_of_week: null, day_of_month: null, reminder_time: "08:30" }, { id: "r2", title: "Already done", description: null, frequency: "daily", day_of_week: null, day_of_month: null, reminder_time: null }],
    recurring_task_completions: [{ recurring_task_id: "r2" }],
    project_tasks: [{ id: "p1", title: "Project step", status: "לא התחיל", due_date: "2026-10-30", urgent: false, completed: false, assigned_email: "lead@example.com", instructions: "Use template B", notes: null }],
  });
  const report = await buildReport(admin, USER, "morning", new Date("2026-11-01T06:00:00Z"), {}, DEFAULT_BRIEFING_EMAIL);
  const titles = report.items.map(i => i.title);
  assertEquals(titles.sort(), ["Daily review", "Open today", "Project step"]);
  const project = report.items.find(i => i.title === "Project step")!;
  assertEquals(project.who, "lead@example.com");
  assert(project.details.includes("Use template B"));
  assert(project.suggestion.startsWith("הצעה:"));
  assert(report.items.find(i => i.title === "Open today")!.details.includes("Call before noon"));
});

Deno.test("PDF is a real multi-page Hebrew document with an embedded font", async () => {
  const tasks = Array.from({ length: 60 }, (_, i) => ({ id: `t${i}`, description: `משימה ארוכה מספר ${i} עם לקוח ABC ופרטים נוספים שצריכים לעבור לשורה הבאה בדוח המודפס`, status: "בטיפול", planned_end: "2026-11-01", urgent: i % 7 === 0, overdue: false, archived: false, responsible: i % 2 ? "דנה" : null, task_type: "work", progress: "צעד הבא שנשמר" }));
  const report = makeDailyBriefing(tasks, [], [], "morning", new Date("2026-11-01T06:00:00Z"));
  const { bytes, pages } = await buildBriefingPdf({ ...report, generatedAt: new Date("2026-11-01T06:00:00Z") });
  assertEquals(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert(pages >= 3, `expected pagination, got ${pages}`);
  const loaded = await PDFDocument.load(bytes);
  assertEquals(loaded.getPageCount(), pages);
  const raw = new TextDecoder("latin1").decode(bytes);
  assert(raw.includes("/FontFile2"), "font must be embedded");
  assert(raw.includes("LiberationSans"), "Hebrew-capable font must be used");
});

Deno.test("empty briefing still produces a non-blank one-page PDF", async () => {
  const report = makeDailyBriefing([], [], [], "urgent", new Date("2026-11-01T14:00:00Z"));
  const { bytes, pages } = await buildBriefingPdf({ ...report, generatedAt: new Date() });
  assertEquals(pages, 1);
  assert(bytes.length > 5000);
});

Deno.test("bidi reordering keeps Hebrew right-to-left and numbers/latin readable", () => {
  assertEquals(visualOrder("שלום"), "םולש");
  assertEquals(visualOrder("משימה ABC"), "ABC הממישמ");
  assertEquals(visualOrder("(המשך)"), "(ךשמה)");
  assertEquals(sanitizePdfText("שָׁלוֹם 🎉 test"), "שלום test");
});

Deno.test("email HTML escapes user content and labels suggestions", () => {
  const report = makeDailyBriefing([{ id: "x", description: "<script>alert(1)</script>", status: null, planned_end: "2026-11-01", urgent: false, overdue: false, archived: false, responsible: null, task_type: "work" }], [], [], "morning", new Date("2026-11-01T06:00:00Z"));
  const { html, text } = buildBriefingEmail(report, { test: false, pdfAttached: true, unsubscribeUrl: "https://tabro.org/unsubscribe?token=abc" });
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes("הצעה:"));
  assert(html.includes("https://tabro.org/personal"));
  assert(text.includes("הסרה מרשימת התפוצה"));
});
