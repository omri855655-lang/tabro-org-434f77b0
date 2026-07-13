import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Trophy, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COPY = {
  he: { title: "תחרות ספרים", subtitle: "הצטרפות ושיתוף רק לפי הבחירה שלך", open: "פתח תחרות", pages: "עמודים שנקראו", books: "ספרים שהושלמו", update: "עדכן", join: "הצטרף לתחרות", joined: "אתה משתתף", rank: "מקום בדירוג", recommendation: "המלצה לקהילה", details: "פרטי התחרות", private: "הנתונים נשארים פרטיים עד שתבחר לשתף סיכום.", summary: "סיכום הספר שתרצה לשתף", summaryPlaceholder: "מה אהבת, למי תמליץ, ומה לקחת מהספר?", share: "שתף סיכום", shareUnavailable: "השיתוף לא נתמך בדפדפן הזה", close: "סגור", save: "שמור התקדמות" },
  en: { title: "Book challenge", subtitle: "Joining and sharing happen only when you choose", open: "Open challenge", pages: "Pages read", books: "Books completed", update: "Update", join: "Join challenge", joined: "You are participating", rank: "Leaderboard rank", recommendation: "Community recommendation", details: "Challenge details", private: "Your data stays private until you choose to share a summary.", summary: "Book summary you want to share", summaryPlaceholder: "What did you enjoy, who would you recommend it to, and what stayed with you?", share: "Share summary", shareUnavailable: "Sharing is not supported in this browser", close: "Close", save: "Save progress" },
  es: { title: "Reto de libros", subtitle: "Solo participas y compartes cuando quieres", open: "Abrir reto", pages: "Paginas leidas", books: "Libros terminados", update: "Actualizar", join: "Unirse al reto", joined: "Estas participando", rank: "Puesto", recommendation: "Recomendacion de la comunidad", details: "Detalles del reto", private: "Tus datos son privados hasta que elijas compartir un resumen.", summary: "Resumen que quieres compartir", summaryPlaceholder: "Que te gusto, a quien lo recomendarias y que te llevas del libro?", share: "Compartir resumen", shareUnavailable: "Este navegador no admite compartir", close: "Cerrar", save: "Guardar progreso" },
  zh: { title: "阅读挑战", subtitle: "仅在你选择时加入或分享", open: "打开挑战", pages: "已读页数", books: "完成书籍", update: "更新", join: "加入挑战", joined: "你已参加", rank: "排行榜名次", recommendation: "社区推荐", details: "挑战详情", private: "在你选择分享摘要前，数据保持私密。", summary: "想分享的读书摘要", summaryPlaceholder: "你喜欢什么，会推荐给谁，书中留下了什么？", share: "分享摘要", shareUnavailable: "此浏览器不支持分享", close: "关闭", save: "保存进度" },
  ar: { title: "تحدي الكتب", subtitle: "تنضم وتشارك فقط عندما تختار", open: "فتح التحدي", pages: "الصفحات المقروءة", books: "الكتب المكتملة", update: "تحديث", join: "الانضمام للتحدي", joined: "أنت مشارك", rank: "الترتيب", recommendation: "توصية المجتمع", details: "تفاصيل التحدي", private: "تبقى بياناتك خاصة حتى تختار مشاركة ملخص.", summary: "ملخص الكتاب الذي تريد مشاركته", summaryPlaceholder: "ما الذي أعجبك ولمن توصي به وماذا أخذت من الكتاب؟", share: "مشاركة الملخص", shareUnavailable: "المشاركة غير مدعومة في هذا المتصفح", close: "إغلاق", save: "حفظ التقدم" },
  ru: { title: "Книжный челлендж", subtitle: "Участие и публикация только по вашему выбору", open: "Открыть челлендж", pages: "Прочитано страниц", books: "Завершено книг", update: "Обновить", join: "Вступить", joined: "Вы участвуете", rank: "Место", recommendation: "Рекомендация сообщества", details: "Детали челленджа", private: "Данные остаются личными, пока вы не решите поделиться отзывом.", summary: "Отзыв о книге для публикации", summaryPlaceholder: "Что понравилось, кому порекомендуете и что осталось с вами?", share: "Поделиться отзывом", shareUnavailable: "В этом браузере нет функции публикации", close: "Закрыть", save: "Сохранить прогресс" },
} as const;

export function BookCompetitionPanel({ readCount }: { readCount: number }) {
  const { lang, dir } = useLanguage();
  const { user } = useAuth();
  const copy = COPY[lang] ?? COPY.en;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState(0);
  const [languageCode, setLanguageCode] = useState(lang || "he");
  const [summary, setSummary] = useState("");
  const [joinCompetition, setJoinCompetition] = useState(false);
  const [addToCatalog, setAddToCatalog] = useState(false);
  const [shareSummary, setShareSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Array<{ display_name: string; books_completed: number; pages_read: number }>>([]);

  const fetchLeaderboard = async () => {
    const client = supabase as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
    const { data, error } = await client.rpc("book_competition_leaderboard");
    if (!error && Array.isArray(data)) setLeaderboard(data as Array<{ display_name: string; books_completed: number; pages_read: number }>);
  };

  useEffect(() => {
    if (open && user) void fetchLeaderboard();
  }, [open, user]);

  const completeBook = async () => {
    if (!user) return toast.error("צריך להתחבר כדי להשתתף בתחרות");
    if (!title.trim() || pages <= 0) return toast.error("צריך להזין שם ספר ומספר עמודים חיובי");

    setSaving(true);
    const client = supabase as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
    const { error } = await client.rpc("record_book_competition_completion", {
      p_title: title.trim(), p_author: author.trim() || null, p_page_count: pages,
      p_language_code: languageCode, p_private_reflection: summary.trim() || null,
      p_share_reflection: shareSummary, p_joins_competition: joinCompetition, p_add_to_catalog: addToCatalog,
    });
    setSaving(false);
    if (error) return toast.error("לא הצלחתי לשמור את סיום הספר: " + error.message);
    toast.success("סיום הספר נשמר");
    setTitle(""); setAuthor(""); setPages(0); setSummary("");
    void fetchLeaderboard();
  };

  return <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4" dir={dir}>
    <div className="flex flex-wrap items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Trophy className="h-5 w-5 text-primary" /></div><div className="min-w-[180px] flex-1"><div className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" />{copy.title}</div><div className="text-xs text-muted-foreground">{copy.subtitle}</div></div><Button size="sm" onClick={() => setOpen(true)}>{copy.open}</Button></div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir={dir} className="max-w-lg">
        <DialogHeader><DialogTitle>{copy.details}</DialogTitle><DialogDescription>{copy.private}</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted p-3 text-center"><div className="text-xl font-bold">{leaderboard.reduce((sum, entry) => sum + Number(entry.pages_read || 0), 0)}</div><div className="text-xs text-muted-foreground">{copy.pages} בקהילה</div></div><div className="rounded-xl bg-muted p-3 text-center"><div className="text-xl font-bold">{readCount}</div><div className="text-xs text-muted-foreground">{copy.books} ברשימה שלך</div></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.title} /><Input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="מחבר/ת (אופציונלי)" /><Input type="number" min="1" value={pages || ""} onChange={(event) => setPages(Math.max(0, Number(event.target.value)))} placeholder={copy.pages} /><Input value={languageCode} onChange={(event) => setLanguageCode(event.target.value.slice(0, 10))} placeholder="שפת הספר, למשל he / en" /></div>
          <div className="grid gap-2"><Label htmlFor="book-competition-summary">{copy.summary}</Label><Textarea id="book-competition-summary" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder={copy.summaryPlaceholder} className="min-h-28" /></div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={joinCompetition} onChange={(event) => setJoinCompetition(event.target.checked)} className="mt-1" />הצטרף לדירוג עם שם התצוגה, מספר הספרים והעמודים בלבד.</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={addToCatalog} onChange={(event) => setAddToCatalog(event.target.checked)} className="mt-1" />הוסף את פרטי הספר לקטלוג המשותף, כדי שאחרים יוכלו למצוא אותו.</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={shareSummary} onChange={(event) => setShareSummary(event.target.checked)} className="mt-1" />אני מסכים לפרסם את הסיכום לקהילה. ללא סימון הוא נשאר פרטי.</label>
          <div className="rounded-xl border bg-muted/40 p-3 text-sm"><div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" />{copy.rank}</div>{leaderboard.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">עדיין אין משתתפים, או שהמיגרציה עדיין לא הופעלה.</p> : <div className="mt-2 space-y-1">{leaderboard.slice(0, 5).map((entry, index) => <div key={`${entry.display_name}-${index}`} className="flex justify-between gap-3 text-xs"><span>{index + 1}. {entry.display_name}</span><span>{entry.books_completed} ספרים · {entry.pages_read} עמודים</span></div>)}</div>}</div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{copy.close}</Button><Button disabled={saving} onClick={completeBook}><CheckCircle2 className="h-4 w-4" />{saving ? "שומר..." : "סיימתי ספר"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
