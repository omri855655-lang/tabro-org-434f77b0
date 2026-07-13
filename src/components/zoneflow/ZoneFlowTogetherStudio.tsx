import { useMemo, useState } from "react";
import { BookOpen, Clock3, Flame, Globe2, LockKeyhole, Medal, Play, Plus, Trophy, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/hooks/useLanguage";
import { safeLocalStorage } from "@/lib/safeLocalStorage";
import { cn } from "@/lib/utils";

type TogetherTab = "rooms" | "competitions" | "progress";
type CompetitionKind = "focus" | "books" | "distractions";
interface Room { id: string; name: string; topic: string; users: number; country: string; }
interface BookProgress { title: string; pages: number; total: number; }

const COPY = {
  he: { title: "ZoneFlow Together", subtitle: "ריכוז משותף, תחרויות קטנות והתקדמות עם אנשים מכל העולם.", rooms: "חדרים חיים", competitions: "תחרויות", progress: "ההתקדמות שלי", join: "היכנס לחדר", joined: "אתה בחדר", public: "פתוח לכולם", friends: "חברים", focus: "ריכוז", books: "ספרים", distractions: "צמצום הסחות", people: "משתתפים", minutes: "דקות", pages: "עמודים", addBook: "הוסף ספר", bookName: "שם הספר", bookPages: "עמודים שנקראו היום", update: "עדכן קריאה", recommendation: "המלצת ספר", username: "שם משתמש שיוצג", points: "נקודות", unlock: "זמן פתיחה שנצבר", unlockText: "כל 30 דקות ריכוז מאומתות מזכות ב־10 דקות זמן פתיחה מקומי. חסימה מערכתית דורשת תוסף או אפליקציה.", start: "התחל סשן", create: "צור חדר", roomName: "שם החדר", topic: "מה לומדים?", noBooks: "עדיין לא הוספת ספרים לתחרות.", rank: "מקום", streak: "רצף" },
  en: { title: "ZoneFlow Together", subtitle: "Shared focus, friendly challenges, and progress with people around the world.", rooms: "Live rooms", competitions: "Challenges", progress: "My progress", join: "Join room", joined: "You are in", public: "Open to everyone", friends: "Friends", focus: "Focus", books: "Books", distractions: "Less distraction", people: "participants", minutes: "minutes", pages: "pages", addBook: "Add book", bookName: "Book title", bookPages: "Pages read today", update: "Update reading", recommendation: "Book recommendation", username: "Displayed username", points: "points", unlock: "Unlock time earned", unlockText: "Each verified 30-minute focus block earns 10 minutes of local unlock time. System blocking requires an extension or app.", start: "Start session", create: "Create room", roomName: "Room name", topic: "What are you studying?", noBooks: "You have not added books to the challenge yet.", rank: "Rank", streak: "Streak" },
  es: { title: "ZoneFlow Together", subtitle: "Enfoque compartido, retos amistosos y progreso con personas de todo el mundo.", rooms: "Salas en vivo", competitions: "Retos", progress: "Mi progreso", join: "Entrar", joined: "Estas dentro", public: "Abierto a todos", friends: "Amigos", focus: "Enfoque", books: "Libros", distractions: "Menos distraccion", people: "participantes", minutes: "minutos", pages: "paginas", addBook: "Anadir libro", bookName: "Titulo del libro", bookPages: "Paginas leidas hoy", update: "Actualizar lectura", recommendation: "Recomendacion", username: "Nombre visible", points: "puntos", unlock: "Tiempo ganado", unlockText: "Cada bloque verificado de 30 minutos da 10 minutos de desbloqueo local. El bloqueo del sistema requiere una extension o app.", start: "Iniciar sesion", create: "Crear sala", roomName: "Nombre de sala", topic: "Que estudias?", noBooks: "Aun no has anadido libros.", rank: "Puesto", streak: "Racha" },
  zh: { title: "ZoneFlow Together", subtitle: "与世界各地的人一起专注、挑战并记录进步。", rooms: "实时房间", competitions: "挑战", progress: "我的进度", join: "进入房间", joined: "已加入", public: "对所有人开放", friends: "朋友", focus: "专注", books: "书籍", distractions: "减少干扰", people: "参与者", minutes: "分钟", pages: "页", addBook: "添加书籍", bookName: "书名", bookPages: "今日阅读页数", update: "更新阅读", recommendation: "书籍推荐", username: "显示名称", points: "分", unlock: "获得的解锁时间", unlockText: "每个经过验证的30分钟专注可获得10分钟本地解锁时间。系统屏蔽需要扩展或应用。", start: "开始专注", create: "创建房间", roomName: "房间名称", topic: "你在学习什么？", noBooks: "还没有添加书籍。", rank: "排名", streak: "连续天数" },
  ar: { title: "ZoneFlow Together", subtitle: "تركيز مشترك وتحديات ودية وتقدم مع أشخاص من العالم.", rooms: "الغرف المباشرة", competitions: "التحديات", progress: "تقدمي", join: "دخول الغرفة", joined: "تم الانضمام", public: "مفتوح للجميع", friends: "أصدقاء", focus: "تركيز", books: "كتب", distractions: "تقليل المشتتات", people: "مشاركين", minutes: "دقائق", pages: "صفحات", addBook: "إضافة كتاب", bookName: "عنوان الكتاب", bookPages: "صفحات اليوم", update: "تحديث القراءة", recommendation: "توصية كتاب", username: "الاسم الظاهر", points: "نقاط", unlock: "وقت فتح مكتسب", unlockText: "كل جلسة تركيز موثقة لمدة 30 دقيقة تمنح 10 دقائق فتح محلي. الحظر النظامي يحتاج إلى تطبيق أو إضافة.", start: "بدء جلسة", create: "إنشاء غرفة", roomName: "اسم الغرفة", topic: "ماذا تدرس؟", noBooks: "لم تضف كتبا بعد.", rank: "الترتيب", streak: "تتابع" },
  ru: { title: "ZoneFlow Together", subtitle: "Общий фокус, дружеские челленджи и прогресс с людьми со всего мира.", rooms: "Комнаты в эфире", competitions: "Челленджи", progress: "Мой прогресс", join: "Войти", joined: "Вы участвуете", public: "Открыто для всех", friends: "Друзья", focus: "Фокус", books: "Книги", distractions: "Меньше отвлечений", people: "участников", minutes: "минут", pages: "страниц", addBook: "Добавить книгу", bookName: "Название книги", bookPages: "Страниц прочитано сегодня", update: "Обновить чтение", recommendation: "Рекомендация книги", username: "Отображаемое имя", points: "баллов", unlock: "Заработанное время разблокировки", unlockText: "Каждые подтвержденные 30 минут фокуса дают 10 минут локальной разблокировки. Системная блокировка требует расширения или приложения.", start: "Начать сессию", create: "Создать комнату", roomName: "Название комнаты", topic: "Что вы изучаете?", noBooks: "Книги еще не добавлены.", rank: "Место", streak: "Серия" },
} as const;

const COMPETITIONS: { id: CompetitionKind; icon: typeof Trophy; title: string; detail: string; value: string }[] = [
  { id: "focus", icon: Clock3, title: "מרתון ריכוז", detail: "השבוע מודדים דקות ריכוז מאומתות", value: "1,284 דק׳" },
  { id: "books", icon: BookOpen, title: "אתגר הספרים", detail: "עמודים וספרים שנקראו החודש", value: "12,450 עמ׳" },
  { id: "distractions", icon: LockKeyhole, title: "פחות הסחות", detail: "זמן שנחסך מהסחות ברשימה", value: "684 שעות" },
];

const INITIAL_ROOMS: Room[] = [
  { id: "library", name: "National Library", topic: "Reading quietly", users: 721, country: "Global" },
  { id: "focus-plane", name: "Focus Plane", topic: "Deep work", users: 604, country: "Global" },
  { id: "hebrew-study", name: "לומדים ביחד", topic: "עברית / קריאה", users: 83, country: "Israel" },
];

export function ZoneFlowTogetherStudio({ isLight }: { isLight: boolean }) {
  const { lang, dir } = useLanguage();
  const copy = COPY[lang] ?? COPY.en;
  const [tab, setTab] = useState<TogetherTab>("rooms");
  const [rooms, setRooms] = useState<Room[]>(() => safeLocalStorage.getJSON("zoneflow-together-rooms", INITIAL_ROOMS));
  const [joinedRooms, setJoinedRooms] = useState<string[]>(() => safeLocalStorage.getJSON("zoneflow-together-joined", []));
  const [books, setBooks] = useState<BookProgress[]>(() => safeLocalStorage.getJSON("zoneflow-together-books", []));
  const [username, setUsername] = useState(() => safeLocalStorage.getString("zoneflow-together-username", "Tabro learner"));
  const [bookName, setBookName] = useState("");
  const [bookPages, setBookPages] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomTopic, setRoomTopic] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(90);
  const [focusActive, setFocusActive] = useState(false);

  const totalPages = books.reduce((sum, book) => sum + book.pages, 0);
  const points = focusMinutes + totalPages * 2 + books.length * 25;
  const unlockMinutes = Math.floor(focusMinutes / 30) * 10;
  const panel = isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/5";
  const muted = isLight ? "text-slate-500" : "text-white/60";
  const competitionCards = useMemo(() => COMPETITIONS.map((item) => ({ ...item, icon: item.icon })), []);

  const persistRooms = (next: Room[]) => { setRooms(next); safeLocalStorage.setJSON("zoneflow-together-rooms", next); };
  const joinRoom = (room: Room) => {
    if (joinedRooms.includes(room.id)) return;
    const next = [...joinedRooms, room.id];
    setJoinedRooms(next);
    safeLocalStorage.setJSON("zoneflow-together-joined", next);
  };
  const addBook = () => {
    const title = bookName.trim();
    const pages = Number(bookPages);
    if (!title || !Number.isFinite(pages) || pages < 1) return;
    const next = [{ title, pages, total: Math.max(pages, 300) }, ...books];
    setBooks(next); safeLocalStorage.setJSON("zoneflow-together-books", next); setBookName(""); setBookPages("");
  };
  const createRoom = () => {
    if (!roomName.trim()) return;
    const room: Room = { id: `${Date.now()}`, name: roomName.trim(), topic: roomTopic.trim() || copy.focus, users: 1, country: "Private" };
    persistRooms([room, ...rooms]); joinRoom(room); setRoomName(""); setRoomTopic("");
  };

  return <div className="space-y-4" dir={dir}>
    <Card className={cn("overflow-hidden border", panel)}>
      <CardContent className="bg-gradient-to-br from-[#13234d] via-[#3b35ae] to-[#0ea5a6] p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs"><Globe2 className="h-3.5 w-3.5" /> ZoneFlow Together</div><h2 className="mt-3 text-2xl font-bold">{copy.title}</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-white/80">{copy.subtitle}</p></div><div className="rounded-3xl bg-white/15 p-4 text-center"><div className="text-xs text-white/70">{copy.points}</div><div className="text-4xl font-bold">{points}</div></div></div>
        <div className="mt-5 flex flex-wrap gap-3"><div className="rounded-2xl bg-white/12 px-4 py-3"><div className="text-xs text-white/70">{copy.username}</div><Input value={username} onChange={(event) => { setUsername(event.target.value); safeLocalStorage.setString("zoneflow-together-username", event.target.value); }} className="mt-1 h-8 border-white/20 bg-white/10 text-white placeholder:text-white/50" /></div><div className="rounded-2xl bg-white/12 px-4 py-3"><div className="text-xs text-white/70">{copy.unlock}</div><div className="mt-1 text-xl font-bold">{unlockMinutes} {copy.minutes}</div></div></div>
      </CardContent>
    </Card>

    <Tabs value={tab} onValueChange={(value) => setTab(value as TogetherTab)}><TabsList className="grid h-auto w-full grid-cols-3"><TabsTrigger value="rooms">{copy.rooms}</TabsTrigger><TabsTrigger value="competitions">{copy.competitions}</TabsTrigger><TabsTrigger value="progress">{copy.progress}</TabsTrigger></TabsList></Tabs>

    {tab === "rooms" && <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]"><Card className={cn("border", panel)}><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-cyan-600" />{copy.rooms}</CardTitle></CardHeader><CardContent className="space-y-3">{rooms.map((room) => <div key={room.id} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-4", panel)}><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15"><Globe2 className="h-5 w-5 text-cyan-600" /></div><div className="min-w-[180px] flex-1"><div className="font-semibold">{room.name}</div><div className={cn("text-sm", muted)}>{room.topic} · {room.country}</div><div className={cn("mt-1 text-xs", muted)}>{room.users} {copy.people} · {copy.public}</div></div><Button onClick={() => joinRoom(room)} variant={joinedRooms.includes(room.id) ? "outline" : "default"}>{joinedRooms.includes(room.id) ? copy.joined : copy.join}</Button></div>)}</CardContent></Card><Card className={cn("border", panel)}><CardHeader><CardTitle>{copy.create}</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder={copy.roomName} /><Input value={roomTopic} onChange={(event) => setRoomTopic(event.target.value)} placeholder={copy.topic} /><Button className="w-full" onClick={createRoom}><Plus className="h-4 w-4" /> {copy.create}</Button></CardContent></Card></div>}

    {tab === "competitions" && <div className="grid gap-4 xl:grid-cols-3">{competitionCards.map((competition) => { const Icon = competition.icon; return <Card key={competition.id} className={cn("border", panel)}><CardHeader><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-amber-500" />{competition.title}</CardTitle></CardHeader><CardContent><p className={cn("text-sm leading-6", muted)}>{competition.detail}</p><div className="mt-5 text-2xl font-bold">{competition.value}</div><div className={cn("mt-1 text-xs", muted)}>{competition.id === "books" ? "הדירוג מופיע בדשבורד הספרים לאחר הצטרפות מפורשת." : "דירוג ציבורי יוצג רק לאחר חיבור נתוני המשתתפים."}</div><Progress value={competition.id === "books" ? Math.min(100, totalPages / 5) : competition.id === "focus" ? Math.min(100, focusMinutes / 3) : Math.min(100, unlockMinutes)} className="mt-4 h-2" /></CardContent></Card> })}</div>}

    {tab === "progress" && <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"><Card className={cn("border", panel)}><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-rose-500" />{copy.books}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><Input value={bookName} onChange={(event) => setBookName(event.target.value)} placeholder={copy.bookName} /><Input value={bookPages} onChange={(event) => setBookPages(event.target.value)} type="number" min="1" placeholder={copy.bookPages} className="sm:max-w-[180px]" /><Button onClick={addBook}><Plus className="h-4 w-4" />{copy.addBook}</Button></div>{books.length === 0 ? <p className={cn("rounded-2xl border border-dashed p-5 text-center text-sm", muted)}>{copy.noBooks}</p> : books.map((book) => <div key={book.title} className={cn("rounded-2xl border p-3", panel)}><div className="flex justify-between gap-3"><span className="font-semibold">{book.title}</span><span className={cn("text-sm", muted)}>{book.pages} {copy.pages}</span></div><Progress value={Math.min(100, (book.pages / book.total) * 100)} className="mt-2 h-2" /></div>)}<div className={cn("text-sm", muted)}>{copy.recommendation}: {books.length ? "The next chapter" : "The book club will suggest one after you join."}</div></CardContent></Card><Card className={cn("border", panel)}><CardHeader><CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500" />{copy.focus}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="text-3xl font-bold">{focusMinutes} {copy.minutes}</div><Input type="number" min="0" value={focusMinutes} onChange={(event) => setFocusMinutes(Math.max(0, Number(event.target.value)))} /><Button className="w-full" variant={focusActive ? "destructive" : "default"} onClick={() => setFocusActive((value) => !value)}>{focusActive ? copy.joined : copy.start}</Button><div className={cn("rounded-2xl bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100", muted)}><Medal className="mr-1 inline h-4 w-4" />{copy.unlockText}</div></CardContent></Card></div>}
  </div>;
}
