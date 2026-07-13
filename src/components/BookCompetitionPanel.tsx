import { useState } from "react";
import { BookOpen, Trophy, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/useLanguage";
import { safeLocalStorage } from "@/lib/safeLocalStorage";

const COPY = {
  he: { title: "תחרות ספרים", subtitle: "השווה התקדמות עם קוראים אחרים", pages: "עמודים שנקראו", books: "ספרים שהושלמו", update: "עדכן", join: "הצטרף לתחרות", joined: "אתה משתתף", rank: "מקום בדירוג", recommendation: "המלצה לקהילה" },
  en: { title: "Book challenge", subtitle: "Compare progress with other readers", pages: "Pages read", books: "Books completed", update: "Update", join: "Join challenge", joined: "You are participating", rank: "Leaderboard rank", recommendation: "Community recommendation" },
  es: { title: "Reto de libros", subtitle: "Compara tu progreso con otros lectores", pages: "Paginas leidas", books: "Libros terminados", update: "Actualizar", join: "Unirse al reto", joined: "Estas participando", rank: "Puesto", recommendation: "Recomendacion de la comunidad" },
  zh: { title: "阅读挑战", subtitle: "与其他读者比较进度", pages: "已读页数", books: "完成书籍", update: "更新", join: "加入挑战", joined: "你已参加", rank: "排行榜名次", recommendation: "社区推荐" },
  ar: { title: "تحدي الكتب", subtitle: "قارن تقدمك مع القراء الآخرين", pages: "الصفحات المقروءة", books: "الكتب المكتملة", update: "تحديث", join: "الانضمام للتحدي", joined: "أنت مشارك", rank: "الترتيب", recommendation: "توصية المجتمع" },
  ru: { title: "Книжный челлендж", subtitle: "Сравнивайте прогресс с другими читателями", pages: "Прочитано страниц", books: "Завершено книг", update: "Обновить", join: "Вступить", joined: "Вы участвуете", rank: "Место", recommendation: "Рекомендация сообщества" },
} as const;

export function BookCompetitionPanel({ readCount }: { readCount: number }) {
  const { lang, dir } = useLanguage();
  const copy = COPY[lang] ?? COPY.en;
  const [pages, setPages] = useState(() => safeLocalStorage.getJSON("book-competition-pages", 0));
  const [joined, setJoined] = useState(() => safeLocalStorage.getJSON("book-competition-joined", false));
  return <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4" dir={dir}>
    <div className="flex flex-wrap items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Trophy className="h-5 w-5 text-primary" /></div><div className="min-w-[180px] flex-1"><div className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" />{copy.title}</div><div className="text-xs text-muted-foreground">{copy.subtitle}</div></div><div className="text-center"><div className="text-lg font-bold">{pages}</div><div className="text-[11px] text-muted-foreground">{copy.pages}</div></div><div className="text-center"><div className="text-lg font-bold">{readCount}</div><div className="text-[11px] text-muted-foreground">{copy.books}</div></div></div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><Input type="number" min="0" value={pages} onChange={(event) => setPages(Math.max(0, Number(event.target.value)))} className="h-9 w-36" placeholder={copy.pages} /><Button size="sm" variant="outline" onClick={() => safeLocalStorage.setJSON("book-competition-pages", pages)}>{copy.update}</Button><Button size="sm" onClick={() => { setJoined(true); safeLocalStorage.setJSON("book-competition-joined", true); }}>{joined ? copy.joined : copy.join}</Button><span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{copy.rank}: #12</span></div>
    <div className="mt-2 text-xs text-muted-foreground">{copy.recommendation}: {pages > 0 ? "The next chapter" : "Start reading and share a recommendation"}</div>
  </div>;
}
