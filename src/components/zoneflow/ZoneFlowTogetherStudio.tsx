import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Clock3, Coffee, Flame, Globe2, Library, LockKeyhole, Medal, Pause, Plane, Play, Plus, RotateCcw, Shuffle, Trophy, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useZoneFlowRewards } from "@/hooks/useZoneFlowRewards";
import { supabase } from "@/integrations/supabase/client";
import { applyBlockingPolicy, getBlockingAuthorization, stopBlockingPolicy } from "@/lib/appBlocking";
import { safeLocalStorage } from "@/lib/safeLocalStorage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FocusRoomInterior, type FocusRoomParticipant } from "./FocusRoomInterior";

type TogetherTab = "rooms" | "competitions" | "progress";
type CompetitionKind = "focus" | "books" | "distractions";
type RoomScene = "library" | "plane" | "cafe" | "office";
type RoomAccess = "public" | "friends";
interface Room { id: string; name: string; topic: string; users: number; country: string; scene: RoomScene; access: RoomAccess; inviteCode?: string; }
interface BookProgress { title: string; pages: number; total: number; }
interface RoomDirectoryRow { id: string; name: string; topic: string; scene: string; access: string; invite_code: string | null; users: number | string; country: string | null; }
interface RoomPresencePayload extends FocusRoomParticipant { onlineAt: string; }

type FocusRoomClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => {
      select: (columns: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> };
      then: PromiseLike<{ data: unknown; error: { message: string } | null }>['then'];
    };
  };
};

const COPY = {
  he: { title: "ZoneFlow Together", subtitle: "ריכוז משותף, תחרויות קטנות והתקדמות עם אנשים מכל העולם.", rooms: "חדרים חיים", competitions: "תחרויות", progress: "ההתקדמות שלי", join: "היכנס לחדר", joined: "אתה בחדר", public: "פתוח לכולם", friends: "חברים", focus: "ריכוז", books: "ספרים", distractions: "צמצום הסחות", people: "משתתפים", minutes: "דקות", pages: "עמודים", addBook: "הוסף ספר", bookName: "שם הספר", bookPages: "עמודים שנקראו היום", update: "עדכן קריאה", recommendation: "המלצת ספר", username: "שם משתמש שיוצג", points: "נקודות", unlock: "זמן פתיחה שנצבר", unlockText: "כל 30 דקות ריכוז מאומתות מזכות ב־10 דקות זמן פתיחה מקומי. חסימה מערכתית דורשת תוסף או אפליקציה.", start: "התחל סשן", create: "צור חדר", roomName: "שם החדר", topic: "מה לומדים?", noBooks: "עדיין לא הוספת ספרים לתחרות.", rank: "מקום", streak: "רצף" },
  en: { title: "ZoneFlow Together", subtitle: "Shared focus, friendly challenges, and progress with people around the world.", rooms: "Live rooms", competitions: "Challenges", progress: "My progress", join: "Join room", joined: "You are in", public: "Open to everyone", friends: "Friends", focus: "Focus", books: "Books", distractions: "Less distraction", people: "participants", minutes: "minutes", pages: "pages", addBook: "Add book", bookName: "Book title", bookPages: "Pages read today", update: "Update reading", recommendation: "Book recommendation", username: "Displayed username", points: "points", unlock: "Unlock time earned", unlockText: "Each verified 30-minute focus block earns 10 minutes of local unlock time. System blocking requires an extension or app.", start: "Start session", create: "Create room", roomName: "Room name", topic: "What are you studying?", noBooks: "You have not added books to the challenge yet.", rank: "Rank", streak: "Streak" },
  es: { title: "ZoneFlow Together", subtitle: "Enfoque compartido, retos amistosos y progreso con personas de todo el mundo.", rooms: "Salas en vivo", competitions: "Retos", progress: "Mi progreso", join: "Entrar", joined: "Estas dentro", public: "Abierto a todos", friends: "Amigos", focus: "Enfoque", books: "Libros", distractions: "Menos distraccion", people: "participantes", minutes: "minutos", pages: "paginas", addBook: "Anadir libro", bookName: "Titulo del libro", bookPages: "Paginas leidas hoy", update: "Actualizar lectura", recommendation: "Recomendacion", username: "Nombre visible", points: "puntos", unlock: "Tiempo ganado", unlockText: "Cada bloque verificado de 30 minutos da 10 minutos de desbloqueo local. El bloqueo del sistema requiere una extension o app.", start: "Iniciar sesion", create: "Crear sala", roomName: "Nombre de sala", topic: "Que estudias?", noBooks: "Aun no has anadido libros.", rank: "Puesto", streak: "Racha" },
  zh: { title: "ZoneFlow Together", subtitle: "与世界各地的人一起专注、挑战并记录进步。", rooms: "实时房间", competitions: "挑战", progress: "我的进度", join: "进入房间", joined: "已加入", public: "对所有人开放", friends: "朋友", focus: "专注", books: "书籍", distractions: "减少干扰", people: "参与者", minutes: "分钟", pages: "页", addBook: "添加书籍", bookName: "书名", bookPages: "今日阅读页数", update: "更新阅读", recommendation: "书籍推荐", username: "显示名称", points: "分", unlock: "获得的解锁时间", unlockText: "每个经过验证的30分钟专注可获得10分钟本地解锁时间。系统屏蔽需要扩展或应用。", start: "开始专注", create: "创建房间", roomName: "房间名称", topic: "你在学习什么？", noBooks: "还没有添加书籍。", rank: "排名", streak: "连续天数" },
  ar: { title: "ZoneFlow Together", subtitle: "تركيز مشترك وتحديات ودية وتقدم مع أشخاص من العالم.", rooms: "الغرف المباشرة", competitions: "التحديات", progress: "تقدمي", join: "دخول الغرفة", joined: "تم الانضمام", public: "مفتوح للجميع", friends: "أصدقاء", focus: "تركيز", books: "كتب", distractions: "تقليل المشتتات", people: "مشاركين", minutes: "دقائق", pages: "صفحات", addBook: "إضافة كتاب", bookName: "عنوان الكتاب", bookPages: "صفحات اليوم", update: "تحديث القراءة", recommendation: "توصية كتاب", username: "الاسم الظاهر", points: "نقاط", unlock: "وقت فتح مكتسب", unlockText: "كل جلسة تركيز موثقة لمدة 30 دقيقة تمنح 10 دقائق فتح محلي. الحظر النظامي يحتاج إلى تطبيق أو إضافة.", start: "بدء جلسة", create: "إنشاء غرفة", roomName: "اسم الغرفة", topic: "ماذا تدرس؟", noBooks: "لم تضف كتبا بعد.", rank: "الترتيب", streak: "تتابع" },
  ru: { title: "ZoneFlow Together", subtitle: "Общий фокус, дружеские челленджи и прогресс с людьми со всего мира.", rooms: "Комнаты в эфире", competitions: "Челленджи", progress: "Мой прогресс", join: "Войти", joined: "Вы участвуете", public: "Открыто для всех", friends: "Друзья", focus: "Фокус", books: "Книги", distractions: "Меньше отвлечений", people: "участников", minutes: "минут", pages: "страниц", addBook: "Добавить книгу", bookName: "Название книги", bookPages: "Страниц прочитано сегодня", update: "Обновить чтение", recommendation: "Рекомендация книги", username: "Отображаемое имя", points: "баллов", unlock: "Заработанное время разблокировки", unlockText: "Каждые подтвержденные 30 минут фокуса дают 10 минут локальной разблокировки. Системная блокировка требует расширения или приложения.", start: "Начать сессию", create: "Создать комнату", roomName: "Название комнаты", topic: "Что вы изучаете?", noBooks: "Книги еще не добавлены.", rank: "Место", streak: "Серия" },
} as const;

const ROOM_COPY = {
  he: { random: "הצטרף לחדר אקראי", friendCode: "קוד חדר של חברים", joinCode: "הצטרף עם קוד", duration: "משך הסשן", timer: "טיימר משותף", pause: "השהה", resume: "המשך", reset: "אפס", leave: "צא מהחדר", publicRoom: "חדר ציבורי", friendsRoom: "חברים בלבד", scene: "סביבה", library: "ספרייה שקטה", plane: "מטוס פוקוס", cafe: "בית קפה", office: "חלל עבודה", activeRoom: "החדר הפעיל", noRoom: "בחר חדר כדי להתחיל לעבוד יחד", voiceNote: "שמע וקול יופעלו רק לאחר אישור מיקרופון ובחדר שתומך בשיחה." },
  en: { random: "Join a random room", friendCode: "Friends room code", joinCode: "Join with code", duration: "Session length", timer: "Shared timer", pause: "Pause", resume: "Resume", reset: "Reset", leave: "Leave room", publicRoom: "Public room", friendsRoom: "Friends only", scene: "Environment", library: "Quiet library", plane: "Focus plane", cafe: "Cafe", office: "Coworking space", activeRoom: "Active room", noRoom: "Choose a room to start working together", voiceNote: "Audio is enabled only after microphone permission and in voice-enabled rooms." },
  es: { random: "Entrar a una sala al azar", friendCode: "Codigo de amigos", joinCode: "Entrar con codigo", duration: "Duracion", timer: "Temporizador compartido", pause: "Pausa", resume: "Continuar", reset: "Reiniciar", leave: "Salir", publicRoom: "Sala publica", friendsRoom: "Solo amigos", scene: "Ambiente", library: "Biblioteca", plane: "Avion focus", cafe: "Cafe", office: "Coworking", activeRoom: "Sala activa", noRoom: "Elige una sala para trabajar juntos", voiceNote: "El audio requiere permiso de microfono y una sala compatible." },
  zh: { random: "随机加入房间", friendCode: "好友房间代码", joinCode: "使用代码加入", duration: "专注时长", timer: "共享计时器", pause: "暂停", resume: "继续", reset: "重置", leave: "离开房间", publicRoom: "公开房间", friendsRoom: "仅好友", scene: "环境", library: "安静图书馆", plane: "专注航班", cafe: "咖啡馆", office: "共享办公室", activeRoom: "当前房间", noRoom: "选择房间开始共同专注", voiceNote: "音频仅在授权麦克风并进入支持语音的房间后启用。" },
  ar: { random: "انضم إلى غرفة عشوائية", friendCode: "رمز غرفة الأصدقاء", joinCode: "انضم بالرمز", duration: "مدة الجلسة", timer: "مؤقت مشترك", pause: "إيقاف مؤقت", resume: "متابعة", reset: "إعادة", leave: "مغادرة", publicRoom: "غرفة عامة", friendsRoom: "للأصدقاء", scene: "البيئة", library: "مكتبة هادئة", plane: "طائرة التركيز", cafe: "مقهى", office: "مساحة عمل", activeRoom: "الغرفة النشطة", noRoom: "اختر غرفة للبدء معا", voiceNote: "الصوت يتطلب إذن الميكروفون وغرفة تدعم المحادثة." },
  ru: { random: "Случайная комната", friendCode: "Код комнаты друзей", joinCode: "Войти по коду", duration: "Длительность", timer: "Общий таймер", pause: "Пауза", resume: "Продолжить", reset: "Сбросить", leave: "Выйти", publicRoom: "Открытая комната", friendsRoom: "Только друзья", scene: "Обстановка", library: "Тихая библиотека", plane: "Фокус-самолет", cafe: "Кафе", office: "Коворкинг", activeRoom: "Активная комната", noRoom: "Выберите комнату для совместной работы", voiceNote: "Аудио доступно после разрешения микрофона в поддерживаемой комнате." },
} as const;

const COMPETITIONS: { id: CompetitionKind; icon: typeof Trophy; title: string; detail: string; value: string }[] = [
  { id: "focus", icon: Clock3, title: "מרתון ריכוז", detail: "השבוע מודדים דקות ריכוז מאומתות", value: "1,284 דק׳" },
  { id: "books", icon: BookOpen, title: "אתגר הספרים", detail: "עמודים וספרים שנקראו החודש", value: "12,450 עמ׳" },
  { id: "distractions", icon: LockKeyhole, title: "פחות הסחות", detail: "זמן שנחסך מהסחות ברשימה", value: "684 שעות" },
];

const INITIAL_ROOMS: Room[] = [
  { id: "library", name: "Tabro Library", topic: "Reading quietly", users: 0, country: "Global", scene: "library", access: "public" },
  { id: "reading-club", name: "Reading Hall", topic: "Books and long-form reading", users: 0, country: "Global", scene: "library", access: "public" },
  { id: "focus-plane", name: "Focus Flight", topic: "Deep work", users: 0, country: "Global", scene: "plane", access: "public" },
  { id: "exam-flight", name: "Exam Flight", topic: "Quiet exam preparation", users: 0, country: "Global", scene: "plane", access: "public" },
  { id: "hebrew-study", name: "לומדים ביחד", topic: "עברית / קריאה", users: 0, country: "Israel", scene: "cafe", access: "public" },
  { id: "study-cafe", name: "Study Cafe", topic: "Light study and planning", users: 0, country: "Global", scene: "cafe", access: "public" },
  { id: "cowork", name: "Tabro Cowork", topic: "Work sprint", users: 0, country: "Global", scene: "office", access: "public" },
  { id: "body-double", name: "Silent Body Double", topic: "Camera-optional accountability", users: 0, country: "Global", scene: "office", access: "public" },
];

const SCENE_ICONS = { library: Library, plane: Plane, cafe: Coffee, office: Users };

const getStoredRooms = (): Room[] => {
  const stored = safeLocalStorage.getJSON<unknown>("zoneflow-together-rooms", INITIAL_ROOMS);
  if (!Array.isArray(stored)) return INITIAL_ROOMS;
  const rooms = stored.filter((room): room is Partial<Room> & Pick<Room, "id" | "name"> => Boolean(room) && typeof room === "object" && typeof (room as Room).id === "string" && typeof (room as Room).name === "string")
    .map((room) => ({
      id: room.id,
      name: room.name,
      topic: typeof room.topic === "string" ? room.topic : "Focus",
      users: typeof room.users === "number" && Number.isFinite(room.users) ? Math.max(0, room.users) : 0,
      country: typeof room.country === "string" ? room.country : "Global",
      scene: room.scene === "plane" || room.scene === "cafe" || room.scene === "office" ? room.scene : "library",
      access: room.access === "friends" ? "friends" : "public",
      inviteCode: typeof room.inviteCode === "string" ? room.inviteCode : undefined,
    }));
  if (!rooms.length) return INITIAL_ROOMS;
  const merged = new Map(INITIAL_ROOMS.map((room) => [room.id, room]));
  rooms.forEach((room) => merged.set(room.id, room));
  return Array.from(merged.values());
};

const formatTimer = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const makeInviteCode = () => `TABRO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

export function ZoneFlowTogetherStudio({ isLight }: { isLight: boolean }) {
  const { lang, dir } = useLanguage();
  const { user } = useAuth();
  const { balance, award } = useZoneFlowRewards();
  const copy = COPY[lang] ?? COPY.en;
  const roomCopy = ROOM_COPY[lang] ?? ROOM_COPY.en;
  const [tab, setTab] = useState<TogetherTab>("rooms");
  const [rooms, setRooms] = useState<Room[]>(getStoredRooms);
  const [joinedRooms, setJoinedRooms] = useState<string[]>(() => safeLocalStorage.getJSON("zoneflow-together-joined", []));
  const [books, setBooks] = useState<BookProgress[]>(() => safeLocalStorage.getJSON("zoneflow-together-books", []));
  const [username, setUsername] = useState(() => safeLocalStorage.getString("zoneflow-together-username", "Tabro learner"));
  const [bookName, setBookName] = useState("");
  const [bookPages, setBookPages] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomTopic, setRoomTopic] = useState("");
  const [roomScene, setRoomScene] = useState<RoomScene>("library");
  const [roomAccess, setRoomAccess] = useState<RoomAccess>("public");
  const [friendCode, setFriendCode] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState(() => safeLocalStorage.getString("zoneflow-together-active-room", ""));
  const [pendingRoom, setPendingRoom] = useState<Room | null>(null);
  const [sessionGoal, setSessionGoal] = useState("");
  const [sessionDuration, setSessionDuration] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [focusMinutes, setFocusMinutes] = useState(90);
  const [focusActive, setFocusActive] = useState(false);
  const [liveRoomsAvailable, setLiveRoomsAvailable] = useState(false);
  const [roomParticipants, setRoomParticipants] = useState<FocusRoomParticipant[]>([]);
  const [myPosition, setMyPosition] = useState(() => safeLocalStorage.getJSON("zoneflow-together-avatar-position", { x: 50, y: 62 }));
  const sessionStartedAt = useRef<string | null>(null);
  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;

  const fetchLiveRooms = useCallback(async () => {
    if (!user) return;
    const client = supabase as unknown as FocusRoomClient;
    const { data, error } = await client.rpc("zoneflow_focus_room_directory");
    if (error || !Array.isArray(data)) {
      setLiveRoomsAvailable(false);
      return;
    }
    const liveRooms = (data as RoomDirectoryRow[]).map((room): Room => ({
      id: room.id,
      name: room.name,
      topic: room.topic,
      users: Math.max(0, Number(room.users) || 0),
      country: room.country || "Global",
      scene: room.scene === "plane" || room.scene === "cafe" || room.scene === "office" ? room.scene : "library",
      access: room.access === "friends" ? "friends" : "public",
      inviteCode: room.invite_code || undefined,
    }));
    setLiveRoomsAvailable(true);
    setRooms(liveRooms.length ? liveRooms : INITIAL_ROOMS);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchLiveRooms();
    const channel = supabase
      .channel(`zoneflow-focus-presence-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "zoneflow_focus_room_members" }, () => void fetchLiveRooms())
      .subscribe();
    const heartbeat = window.setInterval(() => void fetchLiveRooms(), 60_000);
    return () => {
      window.clearInterval(heartbeat);
      void supabase.removeChannel(channel);
    };
  }, [fetchLiveRooms, user]);

  useEffect(() => {
    if (!selectedRoom) {
      setRoomParticipants([]);
      return;
    }
    const localParticipant: FocusRoomParticipant = {
      userId: user?.id || "local-user",
      displayName: username.trim() || "Tabro learner",
      x: myPosition.x,
      y: myPosition.y,
      status: focusActive ? "focusing" : "setting-up",
      color: "bg-cyan-300",
      isMe: true,
    };
    if (!user || !isUuid(selectedRoom.id)) {
      setRoomParticipants([localParticipant]);
      return;
    }

    const channel = supabase.channel(`zoneflow-room-${selectedRoom.id}`, { config: { presence: { key: user.id } } });
    roomChannelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<RoomPresencePayload>();
        const people = Object.values(state).flat().map((participant) => ({
          userId: participant.userId,
          displayName: participant.displayName,
          x: Number.isFinite(participant.x) ? participant.x : 50,
          y: Number.isFinite(participant.y) ? participant.y : 62,
          status: participant.status || "setting-up",
          color: participant.color || "bg-sky-300",
          isMe: participant.userId === user.id,
        } satisfies FocusRoomParticipant));
        setRoomParticipants(people);
      })
      .on("broadcast", { event: "avatar_move" }, ({ payload }) => {
        const moved = payload as RoomPresencePayload;
        if (!moved?.userId || moved.userId === user.id) return;
        setRoomParticipants((people) => people.map((person) => person.userId === moved.userId ? { ...person, x: moved.x, y: moved.y, status: moved.status } : person));
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await channel.track({ ...localParticipant, onlineAt: new Date().toISOString() } satisfies RoomPresencePayload);
      });

    return () => {
      roomChannelRef.current = null;
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
    // Position and focus status are updated through the lightweight effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom?.id, user?.id, username]);

  useEffect(() => {
    if (!selectedRoom) return;
    const participant: RoomPresencePayload = {
      userId: user?.id || "local-user",
      displayName: username.trim() || "Tabro learner",
      x: myPosition.x,
      y: myPosition.y,
      status: focusActive ? "focusing" : "setting-up",
      color: "bg-cyan-300",
      isMe: true,
      onlineAt: new Date().toISOString(),
    };
    setRoomParticipants((people) => {
      const withoutMe = people.filter((person) => person.userId !== participant.userId);
      return [...withoutMe, participant];
    });
    if (roomChannelRef.current) void roomChannelRef.current.track(participant);
  }, [focusActive, myPosition, selectedRoom, user?.id, username]);

  const recordCompletedSession = useCallback(async () => {
    if (!sessionStartedAt.current) return;
    const startedAt = sessionStartedAt.current;
    sessionStartedAt.current = null;
    let rewardEventId = startedAt;
    if (user) {
      const client = supabase as unknown as FocusRoomClient;
      const { data, error } = await client.from("zoneflow_focus_sessions").insert({
        user_id: user.id,
        room_id: selectedRoom && isUuid(selectedRoom.id) ? selectedRoom.id : null,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_seconds: sessionDuration * 60,
        completed: true,
      }).select("id").single();
      if (error || !data) {
        toast.error(error?.message || "הסשן הסתיים אך לא נשמר. לא ניתנו נקודות כפולות.");
        return;
      }
      rewardEventId = data.id;
    }
    const earned = Math.max(1, Math.round(sessionDuration / 3));
    if (award(`focus:together:${rewardEventId}`, "focus", earned, `${selectedRoom?.name || "Focus room"} · ${sessionDuration} min`)) {
      toast.success(`הרווחת ${earned} דקות פתיחה`);
    }
    try { await stopBlockingPolicy(); } catch { /* Web sessions have no native policy to stop. */ }
  }, [award, selectedRoom, sessionDuration, user]);

  useEffect(() => {
    if (!focusActive) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds > 1) return seconds - 1;
        setFocusActive(false);
        setFocusMinutes((minutes) => minutes + sessionDuration);
        void recordCompletedSession();
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [focusActive, recordCompletedSession, sessionDuration]);

  useEffect(() => {
    safeLocalStorage.setString("zoneflow-together-active-room", selectedRoomId);
  }, [selectedRoomId]);

  const totalPages = books.reduce((sum, book) => sum + book.pages, 0);
  const points = balance;
  const unlockMinutes = balance;
  const panel = isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/5";
  const muted = isLight ? "text-slate-500" : "text-white/60";
  const competitionCards = useMemo(() => COMPETITIONS.map((item) => ({ ...item, icon: item.icon })), []);

  const persistRooms = (next: Room[]) => { setRooms(next); safeLocalStorage.setJSON("zoneflow-together-rooms", next); };
  const requestJoinRoom = (room: Room) => {
    setPendingRoom(room);
    setSessionGoal(room.topic === "Focus" ? "" : room.topic);
  };
  const joinRoom = async (room: Room, inviteCode?: string) => {
    if (user && isUuid(room.id)) {
      const client = supabase as unknown as FocusRoomClient;
      const { error } = await client.rpc("join_zoneflow_focus_room", {
        p_room_id: room.id,
        p_display_name: username.trim() || "Tabro member",
        p_invite_code: inviteCode || room.inviteCode || null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      void fetchLiveRooms();
    }
    setSelectedRoomId(room.id);
    setPendingRoom(null);
    setRemainingSeconds(sessionDuration * 60);
    if (!joinedRooms.includes(room.id)) {
      const next = [...joinedRooms, room.id];
      setJoinedRooms(next);
      safeLocalStorage.setJSON("zoneflow-together-joined", next);
    }
  };
  const addBook = () => {
    const title = bookName.trim();
    const pages = Number(bookPages);
    if (!title || !Number.isFinite(pages) || pages < 1) return;
    const next = [{ title, pages, total: Math.max(pages, 300) }, ...books];
    setBooks(next); safeLocalStorage.setJSON("zoneflow-together-books", next); setBookName(""); setBookPages("");
  };
  const createRoom = async () => {
    if (!roomName.trim()) return;
    const inviteCode = roomAccess === "friends" ? makeInviteCode() : undefined;
    if (user && liveRoomsAvailable) {
      const client = supabase as unknown as FocusRoomClient;
      const { data, error } = await client.from("zoneflow_focus_rooms").insert({
        owner_id: user.id,
        name: roomName.trim(),
        topic: roomTopic.trim() || copy.focus,
        scene: roomScene,
        access: roomAccess,
        invite_code: inviteCode || null,
      }).select("id").single();
      if (error || !data) {
        toast.error(error?.message || "Could not create the room");
        return;
      }
      const room: Room = { id: data.id, name: roomName.trim(), topic: roomTopic.trim() || copy.focus, users: 1, country: "Global", scene: roomScene, access: roomAccess, inviteCode };
      await joinRoom(room, inviteCode);
      setRoomName(""); setRoomTopic("");
      return;
    }
    const room: Room = {
      id: `${Date.now()}`,
      name: roomName.trim(),
      topic: roomTopic.trim() || copy.focus,
      users: 1,
      country: roomAccess === "friends" ? "Private" : "Global",
      scene: roomScene,
      access: roomAccess,
      inviteCode,
    };
    persistRooms([room, ...rooms]); void joinRoom(room); setRoomName(""); setRoomTopic("");
    toast.info("החדר נשמר במכשיר. חדרים חיים יופעלו לאחר התקנת עדכון מסד הנתונים.");
  };

  const joinRandomRoom = () => {
    const publicRooms = rooms.filter((room) => room.access === "public");
    if (!publicRooms.length) return;
    requestJoinRoom(publicRooms[Math.floor(Math.random() * publicRooms.length)]);
  };

  const joinByCode = async () => {
    const normalized = friendCode.trim().toUpperCase();
    if (!normalized) return;
    if (user && liveRoomsAvailable) {
      const client = supabase as unknown as FocusRoomClient;
      const { data, error } = await client.rpc("join_zoneflow_focus_room_by_code", { p_invite_code: normalized, p_display_name: username.trim() || "Tabro member" });
      if (error || typeof data !== "string") {
        toast.error(error?.message || "Room code not found");
        return;
      }
      await fetchLiveRooms();
      setSelectedRoomId(data);
      setFriendCode("");
      return;
    }
    const room = rooms.find((item) => item.inviteCode?.toUpperCase() === normalized);
    if (room) void joinRoom(room, normalized);
  };

  const startTimer = async () => {
    if (!selectedRoom) return;
    if (remainingSeconds === 0) setRemainingSeconds(sessionDuration * 60);
    if (!sessionStartedAt.current) sessionStartedAt.current = new Date().toISOString();
    setFocusActive(true);
    if (await getBlockingAuthorization() === "granted") {
      const blockedApps = safeLocalStorage.getJSON<Array<{ name?: string }>>("zoneflow-wellbeing-blocked", []);
      try {
        await applyBlockingPolicy({
          appIds: blockedApps.flatMap((item) => item.name && !item.name.includes(".") ? [item.name] : []),
          websiteHosts: blockedApps.flatMap((item) => item.name?.includes(".") ? [item.name] : []),
          endsAt: new Date(Date.now() + remainingSeconds * 1000).toISOString(),
        });
        toast.success("החסימה הופעלה למשך חדר הריכוז");
      } catch { toast.info("הטיימר התחיל. חסימה מלאה דורשת את רכיב Tabro במכשיר."); }
    }
  };

  const resetTimer = () => {
    setFocusActive(false);
    sessionStartedAt.current = null;
    setRemainingSeconds(sessionDuration * 60);
    void stopBlockingPolicy().catch(() => undefined);
  };

  const moveAvatar = (position: { x: number; y: number }) => {
    setMyPosition(position);
    safeLocalStorage.setJSON("zoneflow-together-avatar-position", position);
    const channel = roomChannelRef.current;
    if (!channel || !user) return;
    void channel.send({
      type: "broadcast",
      event: "avatar_move",
      payload: {
        userId: user.id,
        displayName: username.trim() || "Tabro learner",
        ...position,
        status: focusActive ? "focusing" : "setting-up",
        color: "bg-cyan-300",
        onlineAt: new Date().toISOString(),
      } satisfies RoomPresencePayload,
    });
  };

  const leaveRoom = () => {
    setFocusActive(false);
    sessionStartedAt.current = null;
    setSelectedRoomId("");
    setRoomParticipants([]);
    setRemainingSeconds(sessionDuration * 60);
    void stopBlockingPolicy().catch(() => undefined);
  };

  return <div className="space-y-4" dir={dir}>
    <Card className={cn("overflow-hidden border", panel)}>
      <CardContent className="bg-gradient-to-br from-[#13234d] via-[#3b35ae] to-[#0ea5a6] p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs"><Globe2 className="h-3.5 w-3.5" /> ZoneFlow Together</div><h2 className="mt-3 text-2xl font-bold">{copy.title}</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-white/80">{copy.subtitle}</p></div><div className="rounded-3xl bg-white/15 p-4 text-center"><div className="text-xs text-white/70">{copy.points}</div><div className="text-4xl font-bold">{points}</div></div></div>
        <div className="mt-5 flex flex-wrap gap-3"><div className="rounded-2xl bg-white/12 px-4 py-3"><div className="text-xs text-white/70">{copy.username}</div><Input value={username} onChange={(event) => { setUsername(event.target.value); safeLocalStorage.setString("zoneflow-together-username", event.target.value); }} className="mt-1 h-8 border-white/20 bg-white/10 text-white placeholder:text-white/50" /></div><div className="rounded-2xl bg-white/12 px-4 py-3"><div className="text-xs text-white/70">{copy.unlock}</div><div className="mt-1 text-xl font-bold">{unlockMinutes} {copy.minutes}</div></div></div>
      </CardContent>
    </Card>

    <Tabs value={tab} onValueChange={(value) => setTab(value as TogetherTab)}><TabsList className="grid h-auto w-full grid-cols-3"><TabsTrigger value="rooms">{copy.rooms}</TabsTrigger><TabsTrigger value="competitions">{copy.competitions}</TabsTrigger><TabsTrigger value="progress">{copy.progress}</TabsTrigger></TabsList></Tabs>

    {tab === "rooms" && (
      <div className="space-y-4">
        {selectedRoom ? <FocusRoomInterior scene={selectedRoom.scene} name={selectedRoom.name} topic={sessionGoal || selectedRoom.topic} participants={roomParticipants} timer={formatTimer(remainingSeconds)} active={focusActive} onToggle={focusActive ? () => setFocusActive(false) : () => void startTimer()} onReset={resetTimer} onLeave={leaveRoom} onMove={moveAvatar} /> : pendingRoom ? (
          <Card className={cn("overflow-hidden border", panel)}>
            <CardContent className="grid gap-6 bg-gradient-to-br from-cyan-500/10 via-transparent to-amber-500/10 p-6 md:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-[2rem] bg-gradient-to-br from-[#172554] to-[#0f766e] p-6 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">לובי לפני כניסה</div>
                <h3 className="mt-3 text-2xl font-black">{pendingRoom.name}</h3>
                <p className="mt-2 text-sm text-white/70">{pendingRoom.topic}</p>
                <div className="mt-6 flex items-center gap-2 text-sm"><Users className="h-4 w-4" />{pendingRoom.users} מחוברים</div>
                <div className="mt-2 text-xs text-white/60">הכניסה שקטה. המיקרופון כבוי כברירת מחדל.</div>
              </div>
              <div className="space-y-4">
                <div><div className="mb-2 text-sm font-semibold">כמה זמן תרצה להתרכז?</div><div className="grid grid-cols-4 gap-2">{[25, 50, 75, 90].map((minutes) => <Button key={minutes} type="button" variant={sessionDuration === minutes ? "default" : "outline"} onClick={() => { setSessionDuration(minutes); setRemainingSeconds(minutes * 60); }}>{minutes}</Button>)}</div></div>
                <div><label className="mb-2 block text-sm font-semibold" htmlFor="zoneflow-session-goal">מה המטרה שלך בסשן?</label><Input id="zoneflow-session-goal" value={sessionGoal} onChange={(event) => setSessionGoal(event.target.value)} placeholder="למשל: לסיים פרק, ללמוד למבחן או לעבוד על מצגת" /></div>
                <div className="flex items-center gap-2"><Input aria-label="משך מותאם בדקות" type="number" min="5" max="180" value={sessionDuration} onChange={(event) => { const minutes = Math.min(180, Math.max(5, Number(event.target.value) || 25)); setSessionDuration(minutes); setRemainingSeconds(minutes * 60); }} /><span className={cn("whitespace-nowrap text-xs", muted)}>דקות</span></div>
                <div className="flex gap-2"><Button className="flex-1" onClick={() => void joinRoom(pendingRoom)}>היכנס בשקט</Button><Button variant="outline" onClick={() => setPendingRoom(null)}>ביטול</Button></div>
              </div>
            </CardContent>
          </Card>
        ) : <Card className={cn("border border-dashed", panel)}><CardContent className="p-8 text-center"><Clock3 className="mx-auto h-9 w-9 text-cyan-600" /><h3 className="mt-3 text-lg font-bold">{roomCopy.noRoom}</h3><p className={cn("mt-2 text-sm", muted)}>בחר ספרייה, טיסה, בית קפה או חלל עבודה מהרשימה למטה.</p></CardContent></Card>}

        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
          <Card className={cn("border", panel)}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-cyan-600" />{copy.rooms}</CardTitle>
              <Button variant="outline" size="sm" onClick={joinRandomRoom}><Shuffle className="h-4 w-4" />{roomCopy.random}</Button>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {rooms.map((room) => {
                const SceneIcon = SCENE_ICONS[room.scene];
                return <div key={room.id} className={cn("rounded-3xl border p-4", selectedRoomId === room.id && "border-cyan-500 bg-cyan-500/5", panel)}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15"><SceneIcon className="h-6 w-6 text-cyan-600" /></div>
                    <div className="min-w-0 flex-1"><div className="font-semibold">{room.name}</div><div className={cn("text-sm", muted)}>{room.topic}</div><div className={cn("mt-1 flex flex-wrap items-center gap-2 text-xs", muted)}><span>{room.access === "friends" ? roomCopy.friendsRoom : roomCopy.publicRoom}</span><span>·</span><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{room.users} {copy.people}</span></div></div>
                  </div>
                  <Button className="mt-4 w-full" onClick={() => requestJoinRoom(room)} variant={selectedRoomId === room.id ? "outline" : "default"}>{selectedRoomId === room.id ? copy.joined : copy.join}</Button>
                </div>;
              })}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className={cn("border", panel)}>
              <CardHeader><CardTitle>{copy.create}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder={copy.roomName} />
                <Input value={roomTopic} onChange={(event) => setRoomTopic(event.target.value)} placeholder={copy.topic} />
                <div className="grid grid-cols-2 gap-2">
                  <select value={roomScene} onChange={(event) => setRoomScene(event.target.value as RoomScene)} className="h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="library">{roomCopy.library}</option><option value="plane">{roomCopy.plane}</option><option value="cafe">{roomCopy.cafe}</option><option value="office">{roomCopy.office}</option>
                  </select>
                  <select value={roomAccess} onChange={(event) => setRoomAccess(event.target.value as RoomAccess)} className="h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="public">{roomCopy.publicRoom}</option><option value="friends">{roomCopy.friendsRoom}</option>
                  </select>
                </div>
                <div className="flex items-center gap-2"><Input type="number" min="5" max="180" value={sessionDuration} onChange={(event) => { const minutes = Math.min(180, Math.max(5, Number(event.target.value) || 25)); setSessionDuration(minutes); setRemainingSeconds(minutes * 60); }} /><span className={cn("whitespace-nowrap text-xs", muted)}>{roomCopy.duration}</span></div>
                <Button className="w-full" onClick={() => void createRoom()}><Plus className="h-4 w-4" /> {copy.create}</Button>
              </CardContent>
            </Card>
            <Card className={cn("border", panel)}><CardContent className="space-y-3 p-4"><Input value={friendCode} onChange={(event) => setFriendCode(event.target.value)} placeholder={roomCopy.friendCode} /><Button className="w-full" variant="outline" onClick={() => void joinByCode()}>{roomCopy.joinCode}</Button><p className={cn("text-xs leading-5", muted)}>{roomCopy.voiceNote}</p></CardContent></Card>
          </div>
        </div>
      </div>
    )}

    {tab === "competitions" && <div className="grid gap-4 xl:grid-cols-3">{competitionCards.map((competition) => { const Icon = competition.icon; return <Card key={competition.id} className={cn("border", panel)}><CardHeader><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-amber-500" />{competition.title}</CardTitle></CardHeader><CardContent><p className={cn("text-sm leading-6", muted)}>{competition.detail}</p><div className="mt-5 text-2xl font-bold">{competition.value}</div><div className={cn("mt-1 text-xs", muted)}>{competition.id === "books" ? "הדירוג מופיע בדשבורד הספרים לאחר הצטרפות מפורשת." : "דירוג ציבורי יוצג רק לאחר חיבור נתוני המשתתפים."}</div><Progress value={competition.id === "books" ? Math.min(100, totalPages / 5) : competition.id === "focus" ? Math.min(100, focusMinutes / 3) : Math.min(100, unlockMinutes)} className="mt-4 h-2" /></CardContent></Card> })}</div>}

    {tab === "progress" && <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"><Card className={cn("border", panel)}><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-rose-500" />{copy.books}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><Input value={bookName} onChange={(event) => setBookName(event.target.value)} placeholder={copy.bookName} /><Input value={bookPages} onChange={(event) => setBookPages(event.target.value)} type="number" min="1" placeholder={copy.bookPages} className="sm:max-w-[180px]" /><Button onClick={addBook}><Plus className="h-4 w-4" />{copy.addBook}</Button></div>{books.length === 0 ? <p className={cn("rounded-2xl border border-dashed p-5 text-center text-sm", muted)}>{copy.noBooks}</p> : books.map((book) => <div key={book.title} className={cn("rounded-2xl border p-3", panel)}><div className="flex justify-between gap-3"><span className="font-semibold">{book.title}</span><span className={cn("text-sm", muted)}>{book.pages} {copy.pages}</span></div><Progress value={Math.min(100, (book.pages / book.total) * 100)} className="mt-2 h-2" /></div>)}<div className={cn("text-sm", muted)}>{copy.recommendation}: {books.length ? "The next chapter" : "The book club will suggest one after you join."}</div></CardContent></Card><Card className={cn("border", panel)}><CardHeader><CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500" />{copy.focus}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="text-3xl font-bold">{focusMinutes} {copy.minutes}</div><Input type="number" min="0" value={focusMinutes} onChange={(event) => setFocusMinutes(Math.max(0, Number(event.target.value)))} /><Button className="w-full" variant={focusActive ? "destructive" : "default"} onClick={() => setFocusActive((value) => !value)}>{focusActive ? copy.joined : copy.start}</Button><div className={cn("rounded-2xl bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100", muted)}><Medal className="mr-1 inline h-4 w-4" />{copy.unlockText}</div></CardContent></Card></div>}
  </div>;
}
