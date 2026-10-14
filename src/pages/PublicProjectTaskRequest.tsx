import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, FolderKanban, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProjectMeta { owner_display_name: string; project_title: string; project_description: string | null }
const emptyForm = { name: "", email: "", phone: "", title: "", details: "", responsible: "", dueDate: "", urgent: false, companyWebsite: "" };

export default function PublicProjectTaskRequest() {
  const { token = "" } = useParams();
  const [meta, setMeta] = useState<ProjectMeta | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    supabase.rpc("get_public_project_task_intake", { p_token: token }).then(({ data, error }) => {
      if (!active) return;
      setMeta(error ? null : data?.[0] || null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [token]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    const { data: taskId, error } = await supabase.rpc("submit_public_project_task", {
      p_token: token,
      p_requester_name: form.name,
      p_requester_email: form.email,
      p_requester_phone: form.phone || null,
      p_title: form.title,
      p_details: form.details || null,
      p_responsible: form.responsible || null,
      p_due_date: form.dueDate || null,
      p_urgent: form.urgent,
      p_company_website: form.companyWebsite || null,
    });
    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message?.includes("Too many submissions") ? "נשלחו יותר מדי בקשות בזמן קצר. נסו שוב בעוד כמה דקות." : "לא הצלחנו להוסיף את המשימה. בדקו את הפרטים ונסו שוב.");
      return;
    }
    setSubmitted(true);
    setForm(emptyForm);
    if (taskId) void supabase.functions.invoke("notify-public-task-submission", { body: { token, taskId, kind: "project" } });
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#eef4ef]" dir="rtl"><Loader2 className="h-8 w-8 animate-spin text-emerald-800" /></div>;
  if (!meta) return <main className="grid min-h-screen place-items-center bg-[#eef4ef] p-6" dir="rtl"><Card className="max-w-md"><CardContent className="space-y-4 p-8 text-center"><AlertCircle className="mx-auto h-12 w-12 text-rose-600" /><h1 className="text-2xl font-black">הקישור אינו פעיל</h1><p className="text-sm text-muted-foreground">בקשו מבעל הפרויקט קישור חדש.</p><Button asChild variant="outline"><Link to="/">חזרה ל־Tabro</Link></Button></CardContent></Card></main>;

  return <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_85%_10%,rgba(16,185,129,.18),transparent_28%),linear-gradient(145deg,#eef4ef,#f7f0e4)] px-4 py-10 text-slate-900" dir="rtl">
    <div className="relative mx-auto max-w-4xl">
      <header className="mb-8"><div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/75 px-3 py-1 text-xs font-bold text-emerald-800"><FolderKanban className="h-4 w-4" />בקשת משימה לפרויקט</div><h1 className="mt-4 text-4xl font-black md:text-6xl">{meta.project_title}</h1>{meta.project_description && <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{meta.project_description}</p>}<p className="mt-3 text-sm text-slate-500">המשימה תיכנס רק לפרויקט הזה אצל {meta.owner_display_name}.</p></header>
      {submitted ? <Card className="border-0 bg-emerald-900 text-white shadow-2xl"><CardContent className="space-y-5 p-12 text-center"><CheckCircle2 className="mx-auto h-16 w-16 text-amber-300" /><h2 className="text-3xl font-black">המשימה נוספה לפרויקט</h2><p className="text-white/75">בעל הפרויקט קיבל התראה עם פרטי המשימה והשולח.</p><Button className="bg-amber-300 text-emerald-950 hover:bg-amber-200" onClick={() => setSubmitted(false)}>הוספת משימה נוספת</Button></CardContent></Card> :
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-[1.2fr_.8fr]">
        <Card className="border-0 bg-white/90 shadow-xl"><CardContent className="space-y-5 p-6 md:p-8"><div><p className="text-xs font-bold tracking-[.18em] text-emerald-700">המשימה</p><h2 className="mt-1 text-2xl font-black">מה צריך לעשות?</h2></div><div className="space-y-2"><Label htmlFor="title">כותרת *</Label><Input id="title" required maxLength={500} value={form.title} onChange={(e) => update("title", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="details">פרטים והקשר</Label><Textarea id="details" rows={7} maxLength={5000} value={form.details} onChange={(e) => update("details", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="responsible">למי צריך לפנות / מי מתאים לטפל?</Label><Input id="responsible" maxLength={120} value={form.responsible} onChange={(e) => update("responsible", e.target.value)} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="dueDate">תאריך יעד</Label><Input id="dueDate" type="date" value={form.dueDate} onChange={(e) => update("dueDate", e.target.value)} /></div><label className="flex items-center gap-3 self-end rounded-xl border bg-slate-50 p-3 text-sm font-semibold"><Checkbox checked={form.urgent} onCheckedChange={(value) => update("urgent", value === true)} />דחוף</label></div></CardContent></Card>
        <div className="space-y-5"><Card className="border-0 bg-slate-900 text-white shadow-xl"><CardContent className="space-y-4 p-6"><h2 className="text-xl font-black">מי מוסיף?</h2><div className="space-y-2"><Label htmlFor="name">שם מלא *</Label><Input id="name" required maxLength={120} className="border-white/15 bg-white/10 text-white" value={form.name} onChange={(e) => update("name", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="email">אימייל *</Label><Input id="email" type="email" required maxLength={254} dir="ltr" className="border-white/15 bg-white/10 text-left text-white" value={form.email} onChange={(e) => update("email", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="phone">טלפון</Label><Input id="phone" type="tel" maxLength={60} dir="ltr" className="border-white/15 bg-white/10 text-left text-white" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div></CardContent></Card><div className="absolute -left-[9999px]" aria-hidden="true"><Input tabIndex={-1} autoComplete="off" value={form.companyWebsite} onChange={(e) => update("companyWebsite", e.target.value)} /></div>{errorMessage && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{errorMessage}</p>}<Button type="submit" size="lg" disabled={submitting} className="h-14 w-full bg-emerald-800 text-base font-black hover:bg-emerald-900">{submitting ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <ArrowLeft className="me-2 h-5 w-5" />}הוספה לפרויקט</Button><p className="flex items-center justify-center gap-2 text-center text-xs text-slate-600"><ShieldCheck className="h-4 w-4" />הקישור מאפשר רק הוספה ואינו חושף את הפרויקט.</p></div>
      </form>}
    </div>
  </main>;
}
