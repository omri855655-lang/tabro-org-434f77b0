import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Bot, Check, Clock3, Laptop, LockKeyhole, Medal, ShieldCheck, Smartphone, Trophy, Users, Wifi } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/hooks/useLanguage";
import { useZoneFlowRewards } from "@/hooks/useZoneFlowRewards";
import { applyBlockingPolicy, getBlockingAuthorization, getBlockingPlatform, requestBlockingAuthorization, stopBlockingPolicy, temporarilyAllowBlockedItem, type BlockingAuthorization } from "@/lib/appBlocking";
import { safeLocalStorage } from "@/lib/safeLocalStorage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ZoneFlowRewardHistory } from "./ZoneFlowRewardHistory";

type DeviceKind = "computer" | "iphone" | "android";
interface Device { id: string; kind: DeviceKind; name: string; minutes: number; connected: boolean; }
interface BlockedApp { id: string; name: string; minutesSaved: number; }

const COPY = {
  he: { title: "Digital Wellbeing", subtitle: "תמונה רגועה של הזמן שלך, פחות הסחות ויותר בחירה.", devices: "המכשירים שלי", computer: "מחשב", iphone: "iPhone", android: "Android", connected: "מחובר", planned: "חיבור עתידי", screenTime: "זמן מסך היום", add: "הוסף מכשיר", app: "שם אפליקציה או אתר", addBlock: "הוסף לחסימה", blocked: "הסחות שאני מצמצם", focus: "הפעל Focus באתר", stop: "סיים Focus", score: "ניקוד היום", minutes: "דקות", saved: "דקות שנחסכו", challenge: "אתגרים", challengeTitle: "פוקוס ראשון", challengeText: "20 נקודות כשמסיימים סשן ראשון באתר", friends: "חברים", invite: "קוד הצטרפות", invitePlaceholder: "למשל TABRO-2026", join: "הצטרף", noApps: "עדיין אין אפליקציות ברשימה.", limitations: "באתר אפשר למדוד פעילות בתוך Tabro ולנהל רשימת חסימות. חסימה אמיתית של אפליקציות בכל המכשירים תדרוש אפליקציית מובייל והרשאות מערכת.", coach: "התייעץ עם AI על הזמן שלי", active: "Focus פעיל", sample: "הוסף נתוני מכשיר ידנית עד שנחבר אפליקציית מובייל." },
  en: { title: "Digital Wellbeing", subtitle: "A calm picture of your time, fewer distractions, and more choice.", devices: "My devices", computer: "Computer", iphone: "iPhone", android: "Android", connected: "Connected", planned: "Planned connection", screenTime: "Screen time today", add: "Add device", app: "App or website name", addBlock: "Add to block list", blocked: "Distractions I am reducing", focus: "Start Focus on this site", stop: "End Focus", score: "Today's score", minutes: "minutes", saved: "minutes saved", challenge: "Challenges", challengeTitle: "First Focus", challengeText: "20 points for completing your first focus session on this site", friends: "Friends", invite: "Join code", invitePlaceholder: "For example TABRO-2026", join: "Join", noApps: "No apps are on the list yet.", limitations: "The website can measure activity inside Tabro and maintain a block list. Real device-wide blocking requires a mobile app and system permissions.", coach: "Ask AI about my time", active: "Focus active", sample: "Add device data manually until a mobile app is connected." },
  es: { title: "Bienestar digital", subtitle: "Una imagen tranquila de tu tiempo, menos distracciones y mas eleccion.", devices: "Mis dispositivos", computer: "Ordenador", iphone: "iPhone", android: "Android", connected: "Conectado", planned: "Conexion futura", screenTime: "Tiempo de pantalla hoy", add: "Anadir dispositivo", app: "Nombre de app o sitio", addBlock: "Anadir a bloqueados", blocked: "Distracciones que reduzco", focus: "Activar Focus en este sitio", stop: "Terminar Focus", score: "Puntuacion de hoy", minutes: "minutos", saved: "minutos ahorrados", challenge: "Retos", challengeTitle: "Primer Focus", challengeText: "20 puntos por completar tu primera sesion de enfoque en este sitio", friends: "Amigos", invite: "Codigo de acceso", invitePlaceholder: "Por ejemplo TABRO-2026", join: "Unirse", noApps: "Aun no hay apps en la lista.", limitations: "El sitio puede medir actividad dentro de Tabro y mantener una lista. El bloqueo real en dispositivos requiere una app movil y permisos del sistema.", coach: "Consultar al AI sobre mi tiempo", active: "Focus activo", sample: "Anade datos manualmente hasta conectar una app movil." },
  zh: { title: "数字健康", subtitle: "平静了解时间，减少干扰，保留选择。", devices: "我的设备", computer: "电脑", iphone: "iPhone", android: "Android", connected: "已连接", planned: "计划连接", screenTime: "今日屏幕时间", add: "添加设备", app: "应用或网站名称", addBlock: "加入屏蔽列表", blocked: "正在减少的干扰", focus: "在本网站开启专注", stop: "结束专注", score: "今日积分", minutes: "分钟", saved: "节省分钟", challenge: "挑战", challengeTitle: "首次专注", challengeText: "在本网站完成第一次专注可获得20分", friends: "朋友", invite: "加入码", invitePlaceholder: "例如 TABRO-2026", join: "加入", noApps: "列表中还没有应用。", limitations: "网站可以统计Tabro内的活动并维护列表。真正跨设备屏蔽需要移动应用和系统权限。", coach: "向AI咨询我的时间", active: "专注已开启", sample: "连接移动应用前可手动添加设备数据。" },
  ar: { title: "العافية الرقمية", subtitle: "صورة هادئة لوقتك، مشتتات أقل وخيارات أكثر.", devices: "أجهزتي", computer: "حاسوب", iphone: "iPhone", android: "Android", connected: "متصل", planned: "اتصال مخطط", screenTime: "وقت الشاشة اليوم", add: "إضافة جهاز", app: "اسم التطبيق أو الموقع", addBlock: "إضافة إلى الحظر", blocked: "المشتتات التي أقللها", focus: "تشغيل التركيز هنا", stop: "إنهاء التركيز", score: "نقاط اليوم", minutes: "دقائق", saved: "دقائق تم توفيرها", challenge: "تحديات", challengeTitle: "التركيز الأول", challengeText: "20 نقطة عند إنهاء أول جلسة تركيز في الموقع", friends: "أصدقاء", invite: "رمز الانضمام", invitePlaceholder: "مثال TABRO-2026", join: "انضمام", noApps: "لا توجد تطبيقات في القائمة بعد.", limitations: "يمكن للموقع قياس النشاط داخل Tabro وإدارة قائمة. الحظر الحقيقي على كل الأجهزة يحتاج إلى تطبيق هاتف وأذونات النظام.", coach: "استشر AI حول وقتي", active: "التركيز فعال", sample: "أضف بيانات الأجهزة يدويا حتى يتم ربط تطبيق الهاتف." },
  ru: { title: "Цифровое благополучие", subtitle: "Спокойный взгляд на время, меньше отвлечений и больше выбора.", devices: "Мои устройства", computer: "Компьютер", iphone: "iPhone", android: "Android", connected: "Подключено", planned: "Подключение позже", screenTime: "Экранное время сегодня", add: "Добавить устройство", app: "Название приложения или сайта", addBlock: "Добавить в блокировку", blocked: "Отвлечения, которые я сокращаю", focus: "Включить Focus на сайте", stop: "Завершить Focus", score: "Баллы сегодня", minutes: "минут", saved: "сэкономлено минут", challenge: "Челленджи", challengeTitle: "Первый Focus", challengeText: "20 баллов за первую завершенную сессию фокуса на сайте", friends: "Друзья", invite: "Код вступления", invitePlaceholder: "Например TABRO-2026", join: "Вступить", noApps: "В списке пока нет приложений.", limitations: "Сайт может измерять активность внутри Tabro и вести список. Настоящая блокировка на устройствах требует мобильного приложения и системных разрешений.", coach: "Спросить AI о моем времени", active: "Focus включен", sample: "Добавляйте данные вручную до подключения мобильного приложения." },
} as const;

const deviceIcons = { computer: Laptop, iphone: Smartphone, android: Smartphone };
const PERMISSION_COPY = {
  he: { title: "הרשאות וגבולות", body: "האישור מאפשר ל־Tabro לשמור הגדרות מיקוד ורשימת הסחות. הוא לא נותן לאתר גישה לאפליקציות, למצלמה, להודעות או לזמן המסך של המכשיר.", grant: "אשר שימוש בתוך Tabro", revoke: "בטל אישור", granted: "אישור Tabro פעיל", native: "לחסימה אמיתית במחשב או בטלפון נדרש תוסף או אפליקציה עם הרשאת מערכת נפרדת." },
  en: { title: "Permissions and limits", body: "This consent lets Tabro save focus settings and your distraction list. It does not give the website access to apps, camera, messages, or device screen time.", grant: "Allow Tabro features", revoke: "Revoke consent", granted: "Tabro consent is active", native: "Real blocking requires a separate extension or native app with system permission." },
  es: { title: "Permisos y limites", body: "Este consentimiento guarda ajustes de enfoque y tu lista de distracciones. No da acceso a apps, camara, mensajes ni tiempo de pantalla.", grant: "Permitir funciones de Tabro", revoke: "Revocar consentimiento", granted: "Consentimiento activo", native: "El bloqueo real requiere una extension o app con permiso del sistema." },
  zh: { title: "权限与边界", body: "此同意允许Tabro保存专注设置和干扰列表，但不会访问应用、相机、消息或屏幕时间。", grant: "允许Tabro功能", revoke: "撤销同意", granted: "同意已启用", native: "真正的设备屏蔽需要扩展或原生应用及系统权限。" },
  ar: { title: "الأذونات والحدود", body: "يسمح هذا الإذن بحفظ إعدادات التركيز وقائمة المشتتات، ولا يمنح الموقع وصولا إلى التطبيقات أو الكاميرا أو الرسائل أو وقت الشاشة.", grant: "السماح بميزات Tabro", revoke: "إلغاء الإذن", granted: "الإذن فعال", native: "الحظر الحقيقي يحتاج إلى إضافة أو تطبيق أصلي بإذن نظام منفصل." },
  ru: { title: "Разрешения и границы", body: "Согласие позволяет сохранять настройки фокуса и список отвлечений. Оно не дает сайту доступа к приложениям, камере, сообщениям или экранному времени.", grant: "Разрешить функции Tabro", revoke: "Отозвать согласие", granted: "Согласие активно", native: "Для настоящей блокировки нужны расширение или нативное приложение с системным разрешением." },
} as const;

const BLOCKER_COPY = {
  he: { systemTitle: "חיבור חסימה מערכתית", platform: "פלטפורמה", permission: "הרשאת חסימה", granted: "מאושר", denied: "נדחה", install: "נדרש רכיב Tabro למכשיר", unavailable: "לא זמין", request: "בדוק ובקש הרשאה", localOnly: "Focus מקומי הופעל. חסימת אפליקציות תתחיל לאחר התקנת רכיב המכשיר.", policyStarted: "מדיניות החסימה הופעלה במכשיר", policyStopped: "מדיניות החסימה הופסקה" },
  en: { systemTitle: "System blocking connection", platform: "Platform", permission: "Blocking permission", granted: "Granted", denied: "Denied", install: "Tabro device component required", unavailable: "Unavailable", request: "Check and request permission", localOnly: "Local Focus started. App blocking will start after installing the device component.", policyStarted: "Blocking policy started on this device", policyStopped: "Blocking policy stopped" },
  es: { systemTitle: "Conexion de bloqueo", platform: "Plataforma", permission: "Permiso", granted: "Concedido", denied: "Denegado", install: "Se requiere el componente Tabro", unavailable: "No disponible", request: "Comprobar permiso", localOnly: "Focus local iniciado. El bloqueo requiere el componente del dispositivo.", policyStarted: "Bloqueo iniciado", policyStopped: "Bloqueo detenido" },
  zh: { systemTitle: "系统屏蔽连接", platform: "平台", permission: "屏蔽权限", granted: "已授权", denied: "已拒绝", install: "需要安装 Tabro 设备组件", unavailable: "不可用", request: "检查并请求权限", localOnly: "已开启本地专注。安装设备组件后才能屏蔽应用。", policyStarted: "设备屏蔽已开启", policyStopped: "设备屏蔽已停止" },
  ar: { systemTitle: "اتصال الحظر بالنظام", platform: "المنصة", permission: "إذن الحظر", granted: "ممنوح", denied: "مرفوض", install: "مطلوب مكون Tabro للجهاز", unavailable: "غير متاح", request: "فحص وطلب الإذن", localOnly: "تم تشغيل التركيز المحلي. حظر التطبيقات يحتاج إلى مكون الجهاز.", policyStarted: "تم تشغيل الحظر", policyStopped: "تم إيقاف الحظر" },
  ru: { systemTitle: "Системная блокировка", platform: "Платформа", permission: "Разрешение", granted: "Разрешено", denied: "Отклонено", install: "Нужен компонент Tabro", unavailable: "Недоступно", request: "Проверить разрешение", localOnly: "Локальный Focus запущен. Для блокировки приложений нужен компонент устройства.", policyStarted: "Блокировка запущена", policyStopped: "Блокировка остановлена" },
} as const;

const UNLOCK_COPY = {
  he: { wallet: "ארנק דקות פתיחה", onePoint: "נקודה אחת = דקת פתיחה אחת", earned: "הנקודות מתקבלות מסיום חדר ריכוז, יום במסלול או ספר.", unlock: "פתח זמנית", choose: "כמה דקות?", insufficient: "אין מספיק נקודות", native: "פתיחה של אפליקציה דורשת עדכון של רכיב Tabro במכשיר והרשאת מערכת.", opened: "האפליקציה נפתחה זמנית" },
  en: { wallet: "Unlock-minute wallet", onePoint: "One point = one unlock minute", earned: "Earn points by completing a focus room, journey day, or book.", unlock: "Unlock temporarily", choose: "How many minutes?", insufficient: "Not enough points", native: "App unlock requires the Tabro device component and system permission.", opened: "Temporarily unlocked" },
  es: { wallet: "Cartera de minutos", onePoint: "Un punto = un minuto", earned: "Gana puntos al completar una sala, un dia o un libro.", unlock: "Abrir temporalmente", choose: "Cuantos minutos?", insufficient: "No hay puntos suficientes", native: "Se requiere el componente Tabro y permiso del sistema.", opened: "Desbloqueado temporalmente" },
  zh: { wallet: "解锁分钟钱包", onePoint: "1积分 = 1分钟", earned: "完成专注房间、训练日或书籍可获得积分。", unlock: "临时解锁", choose: "多少分钟？", insufficient: "积分不足", native: "应用解锁需要Tabro设备组件和系统权限。", opened: "已临时解锁" },
  ar: { wallet: "محفظة دقائق الفتح", onePoint: "نقطة واحدة = دقيقة", earned: "اكسب النقاط من غرفة تركيز أو يوم تدريب أو كتاب.", unlock: "فتح مؤقت", choose: "كم دقيقة؟", insufficient: "النقاط غير كافية", native: "يتطلب فتح التطبيق مكون Tabro وإذن النظام.", opened: "تم الفتح مؤقتا" },
  ru: { wallet: "Кошелек минут", onePoint: "Один балл = одна минута", earned: "Баллы начисляются за фокус-комнаты, дни маршрута и книги.", unlock: "Открыть временно", choose: "Сколько минут?", insufficient: "Недостаточно баллов", native: "Для разблокировки нужен компонент Tabro и системное разрешение.", opened: "Временно разблокировано" },
} as const;

export function ZoneFlowWellbeingStudio({ isLight, onOpenCoach }: { isLight: boolean; onOpenCoach: () => void }) {
  const { lang, dir } = useLanguage();
  const copy = COPY[lang] ?? COPY.en;
  const permissionCopy = PERMISSION_COPY[lang] ?? PERMISSION_COPY.en;
  const blockerCopy = BLOCKER_COPY[lang] ?? BLOCKER_COPY.en;
  const unlockCopy = UNLOCK_COPY[lang] ?? UNLOCK_COPY.en;
  const { balance, award, spend, events } = useZoneFlowRewards();
  const [devices, setDevices] = useState<Device[]>(() => safeLocalStorage.getJSON("zoneflow-wellbeing-devices", [
    { id: "computer", kind: "computer", name: copy.computer, minutes: 0, connected: true },
    { id: "iphone", kind: "iphone", name: copy.iphone, minutes: 0, connected: false },
    { id: "android", kind: "android", name: copy.android, minutes: 0, connected: false },
  ]));
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>(() => safeLocalStorage.getJSON("zoneflow-wellbeing-blocked", []));
  const [appName, setAppName] = useState("");
  const [focusActive, setFocusActive] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [consentGranted, setConsentGranted] = useState(() => safeLocalStorage.getJSON("zoneflow-wellbeing-consent", false));
  const [blockingAuthorization, setBlockingAuthorization] = useState<BlockingAuthorization>("unavailable");
  const [unlockMinutes, setUnlockMinutes] = useState(5);
  const focusStartedAt = useRef<number | null>(null);
  const blockingPlatform = getBlockingPlatform();

  useEffect(() => safeLocalStorage.setJSON("zoneflow-wellbeing-devices", devices), [devices]);
  useEffect(() => safeLocalStorage.setJSON("zoneflow-wellbeing-blocked", blockedApps), [blockedApps]);
  useEffect(() => safeLocalStorage.setJSON("zoneflow-wellbeing-consent", consentGranted), [consentGranted]);
  useEffect(() => { void getBlockingAuthorization().then(setBlockingAuthorization); }, []);

  const totalMinutes = devices.reduce((sum, device) => sum + device.minutes, 0);
  const savedMinutes = blockedApps.reduce((sum, app) => sum + app.minutesSaved, 0);
  const score = Math.min(100, Math.round((savedMinutes * 2) + (focusActive ? 20 : 0)));
  const panel = isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/5";
  const muted = isLight ? "text-slate-500" : "text-white/60";
  const deviceLabel = (kind: DeviceKind) => kind === "computer" ? copy.computer : kind === "iphone" ? copy.iphone : copy.android;

  const addBlockedApp = () => {
    const name = appName.trim();
    if (!name) return;
    setBlockedApps((items) => [{ id: `${Date.now()}-${name}`, name, minutesSaved: 0 }, ...items]);
    setAppName("");
  };

  const addDevice = () => {
    const id = `device-${Date.now()}`;
    setDevices((items) => [...items, { id, kind: "computer", name: copy.computer, minutes: 0, connected: false }]);
  };

  const updateMinutes = (id: string, value: number) => {
    setDevices((items) => items.map((device) => device.id === id ? { ...device, minutes: Math.max(0, value) } : device));
  };

  const requestSystemPermission = async () => {
    const status = await requestBlockingAuthorization();
    setBlockingAuthorization(status);
    if (status === "needs-install") toast.info(blockerCopy.install);
  };

  const toggleFocusPolicy = async () => {
    if (focusActive) {
      setFocusActive(false);
      const startedAt = focusStartedAt.current;
      focusStartedAt.current = null;
      if (startedAt) {
        const elapsedMinutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60_000));
        if (elapsedMinutes >= 1) {
          const earned = Math.max(1, Math.round(elapsedMinutes / 3));
          const eventId = `focus:wellbeing:${new Date(startedAt).toISOString()}`;
          if (award(eventId, "focus", earned, `Digital Wellbeing · ${elapsedMinutes} min`)) {
            toast.success(`הרווחת ${earned} דקות פתיחה`);
          }
          if (blockedApps.length > 0) {
            const perItem = elapsedMinutes / blockedApps.length;
            setBlockedApps((items) => items.map((item) => ({ ...item, minutesSaved: Math.round((item.minutesSaved + perItem) * 10) / 10 })));
          }
        }
      }
      if (blockingAuthorization === "granted") {
        try { await stopBlockingPolicy(); toast.success(blockerCopy.policyStopped); } catch { /* Local focus still stops safely. */ }
      }
      return;
    }

    setFocusActive(true);
    focusStartedAt.current = Date.now();
    if (blockingAuthorization !== "granted") {
      toast.info(blockerCopy.localOnly);
      return;
    }

    try {
      await applyBlockingPolicy({
        appIds: blockedApps.filter((item) => !item.name.includes(".")).map((item) => item.name),
        websiteHosts: blockedApps.filter((item) => item.name.includes(".")).map((item) => item.name),
      });
      toast.success(blockerCopy.policyStarted);
    } catch {
      toast.error(blockerCopy.install);
    }
  };

  const authorizationLabel = blockingAuthorization === "granted" ? blockerCopy.granted : blockingAuthorization === "denied" ? blockerCopy.denied : blockingAuthorization === "needs-install" ? blockerCopy.install : blockerCopy.unavailable;

  const unlockItem = async (app: BlockedApp) => {
    if (balance < unlockMinutes) return toast.error(unlockCopy.insufficient);
    if (blockingAuthorization !== "granted") return toast.info(unlockCopy.native);
    try {
      await temporarilyAllowBlockedItem(app.name.includes(".")
        ? { websiteHost: app.name, minutes: unlockMinutes }
        : { appId: app.name, minutes: unlockMinutes });
      const id = `unlock:${app.id}:${Date.now()}`;
      if (spend(id, unlockMinutes, `${app.name} · ${unlockMinutes} min`)) toast.success(unlockCopy.opened);
    } catch { toast.error(unlockCopy.native); }
  };

  return (
    <div className="space-y-4" dir={dir}>
      <Card className={cn("overflow-hidden border", panel)}>
        <CardContent className="bg-gradient-to-br from-[#102e61] via-[#1f5fa7] to-[#38b4b0] p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs"><Wifi className="h-3.5 w-3.5" /> ZoneFlow Wellbeing</div>
              <h2 className="mt-3 text-2xl font-bold">{copy.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-white/80">{copy.subtitle}</p>
            </div>
            <div className="rounded-3xl bg-white/12 p-4 text-center"><div className="text-xs text-white/70">{copy.score}</div><div className="text-4xl font-bold">{score}</div></div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/12 p-3"><div className="text-xs text-white/70">{copy.screenTime}</div><div className="mt-1 text-2xl font-bold">{totalMinutes} {copy.minutes}</div></div>
            <div className="rounded-2xl bg-white/12 p-3"><div className="text-xs text-white/70">{copy.saved}</div><div className="mt-1 text-2xl font-bold">{savedMinutes}</div></div>
            <div className="rounded-2xl bg-white/12 p-3"><div className="text-xs text-white/70">{copy.blocked}</div><div className="mt-1 text-2xl font-bold">{blockedApps.length}</div></div>
          </div>
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border", panel)}>
        <CardContent className="grid gap-4 bg-gradient-to-r from-amber-50 to-orange-50 p-5 text-slate-950 sm:grid-cols-[auto_1fr_auto] sm:items-center dark:from-amber-500/10 dark:to-orange-500/10 dark:text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400 text-2xl font-black text-slate-950">{balance}</div>
          <div><h3 className="text-lg font-black">{unlockCopy.wallet}</h3><p className="text-sm text-slate-600 dark:text-white/65">{unlockCopy.onePoint}. {unlockCopy.earned}</p><p className="mt-1 text-xs text-slate-500 dark:text-white/50">{events.filter((event) => event.points > 0).length} פעולות מזכות נשמרו</p></div>
          <div className="flex items-center gap-2"><span className="text-xs">{unlockCopy.choose}</span><Input type="number" min="1" max="120" value={unlockMinutes} onChange={(event) => setUnlockMinutes(Math.max(1, Math.min(120, Number(event.target.value) || 1)))} className="w-20 bg-white dark:bg-black/20" /></div>
        </CardContent>
      </Card>

      <ZoneFlowRewardHistory limit={20} className={panel} />

      <Card className={cn("border", panel)}>
        <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><ShieldCheck className="h-5 w-5 text-emerald-600" />{permissionCopy.title}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className={cn("text-sm leading-7", muted)}>{permissionCopy.body}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={consentGranted ? "outline" : "default"} onClick={() => setConsentGranted((value) => !value)}>
              <LockKeyhole className="h-4 w-4" /> {consentGranted ? permissionCopy.revoke : permissionCopy.grant}
            </Button>
            {consentGranted && <span className="text-sm text-emerald-600"><Check className="mr-1 inline h-4 w-4" />{permissionCopy.granted}</span>}
          </div>
          <div className={cn("grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center", panel)}>
            <div><div className={cn("text-xs", muted)}>{blockerCopy.platform}</div><div className="font-semibold">{blockingPlatform === "ios" ? "iPhone / iPad" : blockingPlatform === "android" ? "Android" : "Web / Desktop"}</div></div>
            <div><div className={cn("text-xs", muted)}>{blockerCopy.permission}</div><div className={cn("font-semibold", blockingAuthorization === "granted" ? "text-emerald-600" : "text-amber-600")}>{authorizationLabel}</div></div>
            <Button variant="outline" onClick={requestSystemPermission}>{blockerCopy.request}</Button>
          </div>
          <p className={cn("text-xs leading-6", muted)}>{permissionCopy.native}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className={cn("border", panel)}>
          <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-xl"><Smartphone className="h-5 w-5 text-cyan-600" />{copy.devices}</CardTitle><Button variant="outline" size="sm" onClick={addDevice}>{copy.add}</Button></CardHeader>
          <CardContent className="space-y-3">
            <p className={cn("text-xs leading-6", muted)}>{copy.sample}</p>
            {devices.map((device) => {
              const Icon = deviceIcons[device.kind];
              return <div key={device.id} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-3", panel)}>
                <Icon className="h-5 w-5 text-cyan-600" />
                <div className="min-w-[120px] flex-1"><div className="font-semibold">{device.name || deviceLabel(device.kind)}</div><div className={cn("text-xs", muted)}>{device.connected ? copy.connected : copy.planned}</div></div>
                <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-cyan-600" /><Input aria-label={`${copy.screenTime}: ${device.name}`} type="number" min="0" value={device.minutes} onChange={(event) => updateMinutes(device.id, Number(event.target.value))} className="h-8 w-20" /><span className="text-xs">{copy.minutes}</span></div>
              </div>;
            })}
          </CardContent>
        </Card>

        <Card className={cn("border", panel)}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Ban className="h-5 w-5 text-rose-500" />{copy.blocked}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2"><Input value={appName} onChange={(event) => setAppName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addBlockedApp()} placeholder={copy.app} /><Button onClick={addBlockedApp}>{copy.addBlock}</Button></div>
            {blockedApps.length === 0 ? <p className={cn("rounded-2xl border border-dashed p-5 text-center text-sm", muted)}>{copy.noApps}</p> : blockedApps.map((app) => <div key={app.id} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-3", panel)}><Ban className="h-4 w-4 text-rose-500" /><span className="min-w-[120px] flex-1 font-medium">{app.name}</span><span className={cn("text-xs", muted)}>{app.minutesSaved} {copy.saved}</span><Button size="sm" variant="outline" disabled={balance < unlockMinutes} onClick={() => void unlockItem(app)}><Clock3 className="h-4 w-4" />{unlockCopy.unlock} · {unlockMinutes}</Button></div>)}
            <Button className="w-full rounded-full" disabled={!consentGranted} onClick={() => void toggleFocusPolicy()} variant={focusActive ? "destructive" : "default"}>{focusActive ? copy.stop : copy.focus}</Button>
            {focusActive && <div className="rounded-2xl bg-emerald-50 p-3 text-center text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">{copy.active}</div>}
            <p className={cn("text-xs leading-6", muted)}>{copy.limitations}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className={cn("border", panel)}><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Trophy className="h-5 w-5 text-amber-500" />{copy.challenge}</CardTitle></CardHeader><CardContent><div className="flex items-center gap-3"><Medal className="h-10 w-10 text-amber-500" /><div className="flex-1"><div className="font-semibold">{copy.challengeTitle}</div><div className={cn("text-sm", muted)}>{copy.challengeText}</div><Progress value={focusActive ? 60 : 0} className="mt-2 h-2" /></div></div></CardContent></Card>
        <Card className={cn("border", panel)}><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Users className="h-5 w-5 text-indigo-500" />{copy.friends}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder={copy.invitePlaceholder} /><Button onClick={() => setJoined(Boolean(inviteCode.trim()))}>{copy.join}</Button></div>{joined && <div className="rounded-2xl bg-indigo-50 p-3 text-sm text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200"><Check className="mr-1 inline h-4 w-4" /> {copy.invite}: {inviteCode}</div>}</CardContent></Card>
      </div>

      <Button variant="outline" className="w-full rounded-full" onClick={onOpenCoach}><Bot className="h-4 w-4" /> {copy.coach}</Button>
    </div>
  );
}
