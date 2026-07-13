import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookCheck, BookOpen, CheckCircle2, Globe2, Library, Loader2, Search, ShieldCheck, Trophy, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useZoneFlowRewards } from "@/hooks/useZoneFlowRewards";
import { supabase } from "@/integrations/supabase/client";

interface ReadBook { id: string; title: string; author: string | null }
interface LeaderboardEntry { display_name: string; books_completed: number; pages_read: number }
interface Completion { id: string; title: string; author: string | null; page_count: number; completed_on: string; language_code: string }
interface CatalogBook { key: string; title: string; author: string; year?: number; pages?: number; language?: string; coverId?: number; isbn?: string }

type CompetitionClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }> } };
    upsert: (value: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
  };
};

const competitionClient = supabase as unknown as CompetitionClient;

const COPY = {
  he: { back: "חזרה לספרים", title: "אתגר הקריאה של Tabro", subtitle: "קוראים בקצב שלך. משתפים רק מה שבוחרים.", join: "הצטרף לתחרות", joined: "אתה משתתף בתחרות", privacy: "הצטרפות מפרסמת בדירוג רק שם תצוגה, מספר ספרים ועמודים. סיכומים נשארים פרטיים כברירת מחדל.", myStats: "הנתונים שלי", pages: "עמודים", books: "ספרים", rank: "מקום", goal: "יעד עמודים אישי", leaderboard: "טבלת המובילים", report: "סיימתי ספר", chooseRead: "בחר ספר שכבר סימנת כנקרא", catalog: "חיפוש ספרים בעולם", searchPlaceholder: "שם ספר, מחבר או ISBN", search: "חיפוש", all: "כל השפות", hebrew: "ספרים בעברית", useBook: "בחר ספר", noResults: "לא נמצאו תוצאות. אפשר להזין את הספר ידנית.", pageCount: "מספר עמודים", language: "שפת הספר", summary: "סיכום פרטי או המלצה", summaryHint: "מה לקחת מהספר? הסיכום לא יפורסם ללא אישור.", joinRank: "כלול את הספר בדירוג", catalogOpt: "הוסף את פרטי הספר לקטלוג הקהילתי", shareOpt: "פרסם את הסיכום לקהילה", save: "שמור סיום ספר", history: "הספרים שדיווחתי", emptyHistory: "עדיין לא דיווחת על ספר בתחרות.", source: "החיפוש משתמש בקטלוג Open Library. נתונים חסרים אפשר להשלים ידנית.", auth: "צריך להתחבר כדי להשתתף." },
  en: { back: "Back to books", title: "Tabro reading challenge", subtitle: "Read at your pace. Share only what you choose.", join: "Join challenge", joined: "You are participating", privacy: "Joining publishes only your display name, book count, and page count. Reviews stay private by default.", myStats: "My stats", pages: "Pages", books: "Books", rank: "Rank", goal: "Personal page goal", leaderboard: "Leaderboard", report: "I finished a book", chooseRead: "Choose a book already marked read", catalog: "Search the global catalog", searchPlaceholder: "Title, author, or ISBN", search: "Search", all: "All languages", hebrew: "Hebrew books", useBook: "Use book", noResults: "No results. You can enter the book manually.", pageCount: "Page count", language: "Book language", summary: "Private notes or recommendation", summaryHint: "What stayed with you? This is not published without consent.", joinRank: "Count this book in the leaderboard", catalogOpt: "Add book details to the community catalog", shareOpt: "Publish my review to the community", save: "Save finished book", history: "Books I reported", emptyHistory: "You have not reported a book yet.", source: "Search uses the Open Library catalog. Missing details can be completed manually.", auth: "Sign in to participate." },
} as const;

export function BookCompetitionPage({ readBooks, onBack }: { readBooks: ReadBook[]; onBack: () => void }) {
  const { lang, dir } = useLanguage();
  const { user } = useAuth();
  const { award } = useZoneFlowRewards();
  const copy = COPY[lang as keyof typeof COPY] ?? COPY.en;
  const [joined, setJoined] = useState(false);
  const [goal, setGoal] = useState(1000);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<Completion[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState(0);
  const [languageCode, setLanguageCode] = useState(lang === "he" ? "he" : lang);
  const [summary, setSummary] = useState("");
  const [addToCatalog, setAddToCatalog] = useState(false);
  const [shareSummary, setShareSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogLanguage, setCatalogLanguage] = useState<"all" | "he">("all");
  const [catalogResults, setCatalogResults] = useState<CatalogBook[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearched, setCatalogSearched] = useState(false);

  const loadCompetition = useCallback(async () => {
    if (!user) return;
    const [leaderboardResult, historyResult, profileResult] = await Promise.all([
      competitionClient.rpc("book_competition_leaderboard"),
      competitionClient.from("book_competition_completions").select("id,title,author,page_count,completed_on,language_code").eq("user_id", user.id).order("completed_on", { ascending: false }),
      competitionClient.from("book_competition_profiles").select("joined,page_goal").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (Array.isArray(leaderboardResult.data)) setLeaderboard(leaderboardResult.data as LeaderboardEntry[]);
    if (Array.isArray(historyResult.data)) setHistory(historyResult.data as Completion[]);
    if (Array.isArray(profileResult.data) && profileResult.data[0]) {
      const profile = profileResult.data[0] as { joined?: boolean; page_goal?: number };
      setJoined(Boolean(profile.joined));
      if (profile.page_goal) setGoal(profile.page_goal);
    }
  }, [user]);

  useEffect(() => { void loadCompetition(); }, [loadCompetition]);

  const pagesRead = useMemo(() => history.reduce((sum, item) => sum + Number(item.page_count || 0), 0), [history]);
  const myRank = useMemo(() => {
    if (!user || !joined || history.length === 0) return "-";
    const sortedPages = leaderboard.map((entry) => Number(entry.pages_read || 0));
    const index = sortedPages.findIndex((value) => value <= pagesRead);
    return index < 0 ? leaderboard.length + 1 : index + 1;
  }, [history.length, joined, leaderboard, pagesRead, user]);

  const saveProfile = async (nextJoined = joined) => {
    if (!user) return toast.error(copy.auth);
    const { error } = await competitionClient.from("book_competition_profiles").upsert({ user_id: user.id, joined: nextJoined, page_goal: Math.max(1, goal) }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    setJoined(nextJoined);
    toast.success(nextJoined ? copy.joined : copy.goal);
  };

  const chooseReadBook = (id: string) => {
    setSelectedBookId(id);
    const book = readBooks.find((item) => item.id === id);
    if (!book) return;
    setTitle(book.title); setAuthor(book.author || "");
  };

  const searchCatalog = async () => {
    const query = catalogQuery.trim();
    if (!query) return;
    setCatalogLoading(true); setCatalogSearched(true);
    try {
      const params = new URLSearchParams({ q: catalogLanguage === "he" ? `${query} language:heb` : query, limit: "12", fields: "key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,language" });
      const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
      if (!response.ok) throw new Error(`Open Library ${response.status}`);
      const data = await response.json() as { docs?: Array<Record<string, unknown>> };
      const results = (data.docs || []).map((doc, index) => ({
        key: String(doc.key || `${index}-${doc.title}`), title: String(doc.title || ""),
        author: Array.isArray(doc.author_name) ? String(doc.author_name[0] || "") : "",
        year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : undefined,
        pages: typeof doc.number_of_pages_median === "number" ? doc.number_of_pages_median : undefined,
        language: Array.isArray(doc.language) ? String(doc.language[0] || "") : undefined,
        coverId: typeof doc.cover_i === "number" ? doc.cover_i : undefined,
        isbn: Array.isArray(doc.isbn) ? String(doc.isbn[0] || "") : undefined,
      })).filter((book) => book.title);
      setCatalogResults(results);
    } catch (error) {
      console.error("Open Library search failed", error);
      toast.error("לא הצלחתי לחפש בקטלוג כרגע");
      setCatalogResults([]);
    } finally { setCatalogLoading(false); }
  };

  const selectCatalogBook = (book: CatalogBook) => {
    setTitle(book.title); setAuthor(book.author); setPages(book.pages || 0); setLanguageCode(catalogLanguage === "he" ? "he" : book.language || lang);
    document.getElementById("competition-report")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const completeBook = async () => {
    if (!user) return toast.error(copy.auth);
    if (!title.trim() || pages <= 0) return toast.error("צריך להזין שם ספר ומספר עמודים חיובי");
    setSaving(true);
    const { data, error } = await competitionClient.rpc("record_book_competition_completion", {
      p_title: title.trim(), p_author: author.trim() || null, p_page_count: pages, p_language_code: languageCode,
      p_private_reflection: summary.trim() || null, p_share_reflection: shareSummary,
      p_joins_competition: joined, p_add_to_catalog: addToCatalog,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    const completionId = typeof data === "string" ? data : `${user.id}:${title.trim()}:${new Date().toISOString().slice(0, 10)}`;
    const earned = Math.max(10, Math.min(60, Math.ceil(pages / 10)));
    award(`book:${completionId}`, "book", earned, `${title.trim()} · ${pages} pages`);
    toast.success(`הספר נוסף והרווחת ${earned} דקות פתיחה`);
    setTitle(""); setAuthor(""); setPages(0); setSummary(""); setSelectedBookId(""); setShareSummary(false); setAddToCatalog(false);
    void loadCompetition();
  };

  return (
    <div className="h-full overflow-auto bg-[#f6f3ec] text-slate-950" dir={dir}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <Button variant="ghost" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{copy.back}</Button>
        <header className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl sm:p-9">
          <div className="absolute -end-16 -top-20 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-amber-200"><Trophy className="h-4 w-4" />קהילת הקוראים</div><h1 className="text-3xl font-black sm:text-5xl">{copy.title}</h1><p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">{copy.subtitle}</p></div>
            <div className="max-w-sm rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300"><ShieldCheck className="mb-2 h-5 w-5 text-emerald-300" />{copy.privacy}</div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{copy.myStats}</h2><p className="text-sm text-muted-foreground">{joined ? copy.joined : copy.privacy}</p></div>{!joined && <Button onClick={() => void saveProfile(true)}><Users className="h-4 w-4" />{copy.join}</Button>}</div>
            <div className="mt-5 grid grid-cols-3 gap-3"><Stat icon={BookCheck} value={history.length} label={copy.books} /><Stat icon={BookOpen} value={pagesRead} label={copy.pages} /><Stat icon={Trophy} value={myRank} label={copy.rank} /></div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex items-center justify-between text-sm"><Label>{copy.goal}</Label><span className="font-bold">{pagesRead} / {goal}</span></div><Progress value={Math.min(100, pagesRead / Math.max(1, goal) * 100)} /><div className="mt-3 flex gap-2"><Input type="number" min="1" value={goal} onChange={(event) => setGoal(Math.max(1, Number(event.target.value)))} /><Button variant="outline" onClick={() => void saveProfile()}>עדכן יעד</Button></div></div>
          </div>
          <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-bold"><Trophy className="h-5 w-5 text-amber-500" />{copy.leaderboard}</h2><div className="mt-4 space-y-2">{leaderboard.length === 0 ? <p className="text-sm text-muted-foreground">עדיין אין משתתפים בדירוג.</p> : leaderboard.slice(0, 10).map((entry, index) => <div key={`${entry.display_name}-${index}`} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="w-7 font-black text-amber-600">#{index + 1}</span><span className="flex-1 font-medium">{entry.display_name}</span><span className="text-xs text-slate-500">{entry.books_completed} {copy.books} · {entry.pages_read} {copy.pages}</span></div>)}</div></div>
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end gap-3"><div className="min-w-[220px] flex-1"><Label>{copy.catalog}</Label><Input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchCatalog(); }} placeholder={copy.searchPlaceholder} className="mt-2" /></div><Select value={catalogLanguage} onValueChange={(value: "all" | "he") => setCatalogLanguage(value)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.all}</SelectItem><SelectItem value="he">{copy.hebrew}</SelectItem></SelectContent></Select><Button onClick={() => void searchCatalog()} disabled={catalogLoading}>{catalogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{copy.search}</Button></div><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Globe2 className="h-3.5 w-3.5" />{copy.source}</p>
          {catalogSearched && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{catalogResults.length === 0 && !catalogLoading ? <p className="col-span-full text-sm text-muted-foreground">{copy.noResults}</p> : catalogResults.map((book) => <article key={book.key} className="flex gap-3 rounded-2xl border p-3">{book.coverId ? <img src={`https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`} alt="" className="h-28 w-20 rounded-lg object-cover" loading="lazy" /> : <div className="flex h-28 w-20 items-center justify-center rounded-lg bg-slate-100"><Library className="h-6 w-6 text-slate-400" /></div>}<div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-sm font-bold">{book.title}</h3><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{book.author || "מחבר לא ידוע"}</p><p className="mt-1 text-[11px] text-muted-foreground">{[book.year, book.pages ? `${book.pages} עמ'` : null].filter(Boolean).join(" · ")}</p><Button size="sm" variant="outline" className="mt-3 h-8" onClick={() => selectCatalogBook(book)}>{copy.useBook}</Button></div></article>)}</div>}
        </section>

        <section id="competition-report" className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
          <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-bold"><CheckCircle2 className="h-5 w-5 text-emerald-600" />{copy.report}</h2><div className="mt-5 grid gap-4"><div><Label>{copy.chooseRead}</Label><Select value={selectedBookId} onValueChange={chooseReadBook}><SelectTrigger className="mt-2"><SelectValue placeholder={copy.chooseRead} /></SelectTrigger><SelectContent>{readBooks.map((book) => <SelectItem key={book.id} value={book.id}>{book.title}{book.author ? ` · ${book.author}` : ""}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-3 sm:grid-cols-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="שם הספר" /><Input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="מחבר/ת" /><Input type="number" min="1" value={pages || ""} onChange={(event) => setPages(Math.max(0, Number(event.target.value)))} placeholder={copy.pageCount} /><Input value={languageCode} onChange={(event) => setLanguageCode(event.target.value.slice(0, 10))} placeholder={copy.language} /></div><div><Label>{copy.summary}</Label><Textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder={copy.summaryHint} className="mt-2 min-h-28" /></div><CheckRow checked={joined} disabled label={copy.joinRank} /><CheckRow checked={addToCatalog} onChange={setAddToCatalog} label={copy.catalogOpt} /><CheckRow checked={shareSummary} onChange={setShareSummary} label={copy.shareOpt} /><Button onClick={() => void completeBook()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{copy.save}</Button></div></div>
          <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">{copy.history}</h2><div className="mt-4 space-y-2">{history.length === 0 ? <p className="text-sm text-muted-foreground">{copy.emptyHistory}</p> : history.map((book) => <div key={book.id} className="rounded-2xl bg-slate-50 p-3"><div className="font-semibold">{book.title}</div><div className="mt-1 text-xs text-muted-foreground">{book.author || ""}{book.author ? " · " : ""}{book.page_count} {copy.pages} · {book.completed_on}</div></div>)}</div></div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof BookOpen; value: string | number; label: string }) {
  return <div className="rounded-2xl bg-slate-950 p-4 text-white"><Icon className="mb-3 h-5 w-5 text-amber-300" /><div className="text-2xl font-black">{value}</div><div className="text-xs text-slate-400">{label}</div></div>;
}

function CheckRow({ checked, onChange, label, disabled = false }: { checked: boolean; onChange?: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <label className="flex items-start gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange?.(event.target.checked)} className="mt-1" /><span>{label}</span></label>;
}
