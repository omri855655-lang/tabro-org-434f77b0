import { BookOpen, ChevronLeft, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

const COPY = {
  he: { title: "תחרות הספרים של Tabro", subtitle: "דף נפרד עם דירוג, יעדים, הספרים שקראת וקטלוג עולמי", open: "לכל פרטי התחרות" },
  en: { title: "Tabro reading challenge", subtitle: "A dedicated page for rankings, goals, your finished books, and a global catalog", open: "Open challenge" },
  es: { title: "Reto de lectura Tabro", subtitle: "Una pagina propia con clasificacion, objetivos, tus libros y catalogo global", open: "Abrir reto" },
  zh: { title: "Tabro 阅读挑战", subtitle: "独立页面，包含排名、目标、已读书籍和全球目录", open: "打开挑战" },
  ar: { title: "تحدي القراءة من Tabro", subtitle: "صفحة مستقلة للترتيب والأهداف وكتبك والفهرس العالمي", open: "فتح التحدي" },
  ru: { title: "Книжный челлендж Tabro", subtitle: "Отдельная страница с рейтингом, целями, вашими книгами и мировым каталогом", open: "Открыть" },
} as const;

export function BookCompetitionPanel({ onOpen }: { onOpen: () => void }) {
  const { lang, dir } = useLanguage();
  const copy = COPY[lang] ?? COPY.en;

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-50 via-white to-cyan-50 p-4 shadow-sm" dir={dir}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-amber-300 shadow-sm">
          <Trophy className="h-6 w-6" />
        </div>
        <div className="min-w-[190px] flex-1">
          <div className="flex items-center gap-2 font-bold text-slate-900"><BookOpen className="h-4 w-4" />{copy.title}</div>
          <p className="mt-1 text-xs text-slate-600">{copy.subtitle}</p>
        </div>
        <Button onClick={onOpen} className="gap-2 bg-slate-950 text-white hover:bg-slate-800">
          {copy.open}<ChevronLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
        </Button>
      </div>
    </section>
  );
}
