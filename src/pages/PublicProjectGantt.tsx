import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, BarChart3, Loader2, ShieldCheck } from "lucide-react";
import ProjectGantt, {
  type ProjectGanttProject,
  type ProjectGanttTask,
} from "@/components/projects/ProjectGantt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface PublicGanttPayload {
  owner_display_name: string;
  project: ProjectGanttProject;
  tasks: ProjectGanttTask[];
}

const isPayload = (value: unknown): value is PublicGanttPayload => {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<PublicGanttPayload>;
  return Boolean(payload.project?.id && payload.project.title && Array.isArray(payload.tasks));
};

export default function PublicProjectGantt() {
  const { token = "" } = useParams();
  const [payload, setPayload] = useState<PublicGanttPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.rpc("get_public_project_gantt", { p_token: token }).then(({ data, error }) => {
      if (!active) return;
      setPayload(!error && isPayload(data) ? data : null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [token]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50" dir="rtl">
      <Loader2 className="h-9 w-9 animate-spin text-sky-700" />
    </div>;
  }

  if (!payload) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-6" dir="rtl">
      <Card className="max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-600" />
          <h1 className="text-2xl font-black">הקישור אינו פעיל</h1>
          <p className="text-sm text-muted-foreground">בקשו מבעל הפרויקט קישור צפייה חדש.</p>
          <Button asChild variant="outline"><Link to="/">חזרה ל־Tabro</Link></Button>
        </CardContent>
      </Card>
    </main>;
  }

  return <main className="min-h-screen bg-[radial-gradient(circle_at_10%_5%,rgba(14,165,233,.12),transparent_28%),linear-gradient(145deg,#f8fafc,#eef6f8)] p-4 text-slate-900 md:p-8" dir="rtl">
    <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1500px] flex-col gap-5 md:min-h-[calc(100vh-4rem)]">
      <header className="flex flex-col gap-4 rounded-3xl border border-sky-900/10 bg-white/90 p-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-800">
            <BarChart3 className="h-4 w-4" />גאנט ציבורי לקריאה בלבד
          </div>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">{payload.project.title}</h1>
          {payload.project.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{payload.project.description}</p>}
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4" />שותף על ידי {payload.owner_display_name}; אי אפשר לערוך דרך הדף הזה.
          </p>
        </div>
        <Button asChild className="shrink-0 gap-2 bg-sky-800 hover:bg-sky-900">
          <Link to={`/project-request/${token}`}><ArrowLeft className="h-4 w-4" />הצעת משימה לפרויקט</Link>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 rounded-3xl border border-sky-900/10 bg-white/95 p-4 shadow-xl">
        <ProjectGantt project={payload.project} tasks={payload.tasks} readOnly />
      </div>
    </div>
  </main>;
}
