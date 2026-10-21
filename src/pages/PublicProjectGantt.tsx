import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, BarChart3, Loader2, ShieldCheck } from "lucide-react";
import ProjectGantt from "@/components/projects/ProjectGantt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { ganttCopy } from "@/lib/ganttCopy";
import { normalizePublicGantt, validGanttToken, type PublicGanttPayload } from "@/lib/publicGantt";

export default function PublicProjectGantt() {
  const { token = "" } = useParams();
  const { lang, dir, setLang } = useLanguage();
  const copy = ganttCopy[lang];
  const [payload, setPayload] = useState<PublicGanttPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setFailed(false); setPayload(null);
    if (!validGanttToken(token)) { setLoading(false); return; }
    const timeout = setTimeout(() => controller.abort(),15000);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("get_public_project_gantt", { p_token: token }).abortSignal(controller.signal);
        if (error) throw error;
        if (active) {
          const normalized = normalizePublicGantt(data);
          setPayload(normalized); setFailed(data !== null && !normalized);
        }
      } catch { if (active) setFailed(true); }
      finally { clearTimeout(timeout); if (active) setLoading(false); }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [token,attempt]);

  const languagePicker = <select aria-label="Language / שפה" value={lang} onChange={event=>setLang(event.target.value as typeof lang)} className="rounded-xl border bg-white px-3 py-2 text-sm text-slate-900">{Object.entries({he:'עברית',en:'English',es:'Español',zh:'简体中文',ar:'العربية',ru:'Русский'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>;

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50" dir={dir} role="status">
      <span className="sr-only">{copy.loading}</span><Loader2 className="h-9 w-9 animate-spin text-sky-700" />
    </div>;
  }

  if (!payload) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-6" dir={dir}>
      <Card className="max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-600" />
          {languagePicker}
          <h1 className="text-2xl font-black">{failed ? copy.unavailable : copy.inactive}</h1>
          <p className="text-sm text-muted-foreground">{failed ? copy.unavailableHint : copy.inactiveHint}</p>
          {failed && <Button onClick={()=>setAttempt(value=>value+1)}>{copy.retry}</Button>}
          <Button asChild variant="outline"><Link to="/">{copy.home}</Link></Button>
        </CardContent>
      </Card>
    </main>;
  }

  return <main className="min-h-screen bg-[radial-gradient(circle_at_10%_5%,rgba(14,165,233,.12),transparent_28%),linear-gradient(145deg,#f8fafc,#eef6f8)] p-4 text-slate-900 md:p-8" dir={dir}>
    <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1500px] flex-col gap-5 md:min-h-[calc(100vh-4rem)]">
      <header className="flex flex-col gap-4 rounded-3xl border border-sky-900/10 bg-white/90 p-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-800">
            <BarChart3 className="h-4 w-4" />{copy.publicTitle}
          </div>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">{payload.project.title}</h1>
          {payload.project.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{payload.project.description}</p>}
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4" />{copy.sharedBy.replace('{name}',payload.owner_display_name)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{languagePicker}<Button asChild className="shrink-0 gap-2 bg-sky-800 hover:bg-sky-900">
          <Link to="/"><ArrowLeft className="h-4 w-4" />Tabro</Link>
        </Button></div>
      </header>

      {payload.omittedTaskCount>0 && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">{copy.omitted.replace('{count}',String(payload.omittedTaskCount))}</p>}
      <div className="flex min-h-0 min-w-0 flex-1 rounded-3xl border border-sky-900/10 bg-white/95 p-4 shadow-xl">
        <ProjectGantt key={payload.project.id} project={payload.project} tasks={payload.tasks} readOnly audience="public" />
      </div>
    </div>
  </main>;
}
