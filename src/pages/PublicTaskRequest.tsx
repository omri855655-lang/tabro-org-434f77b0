import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardList, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface IntakeMeta {
  owner_display_name: string;
  task_type: string;
  sheet_name: string;
}

const emptyForm = {
  requesterName: "",
  requesterEmail: "",
  requesterPhone: "",
  description: "",
  category: "",
  responsible: "",
  details: "",
  progress: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  plannedEnd: "",
  urgent: false,
  companyWebsite: "",
};

const PublicTaskRequest = () => {
  const { token = "" } = useParams();
  const [meta, setMeta] = useState<IntakeMeta | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    supabase.rpc("get_public_task_intake", { p_token: token }).then(({ data, error }) => {
      if (!active) return;
      const row = data?.[0] as IntakeMeta | undefined;
      setMeta(row || null);
      setInvalid(Boolean(error || !row));
      setLoading(false);
    });
    return () => { active = false; };
  }, [token]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    const { error } = await supabase.rpc("submit_public_task_intake", {
      p_token: token,
      p_requester_name: form.requesterName,
      p_requester_email: form.requesterEmail,
      p_requester_phone: form.requesterPhone || null,
      p_description: form.description,
      p_category: form.category || null,
      p_responsible: form.responsible || null,
      p_details: form.details || null,
      p_progress: form.progress || null,
      p_contact_name: form.contactName || null,
      p_contact_email: form.contactEmail || null,
      p_contact_phone: form.contactPhone || null,
      p_planned_end: form.plannedEnd || null,
      p_urgent: form.urgent,
      p_company_website: form.companyWebsite || null,
    });
    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message.includes("Too many submissions")
        ? "נשלחו יותר מדי בקשות בזמן קצר. נסו שוב בעוד כמה דקות."
        : "לא הצלחנו לשלוח את המשימה. בדקו את הפרטים ונסו שוב.");
      return;
    }
    setSubmitted(true);
    setForm(emptyForm);
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#f6f2e8]" dir="rtl"><Loader2 className="h-8 w-8 animate-spin text-[#0d5c55]" /></div>;
  }

  if (invalid || !meta) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f2e8] p-6" dir="rtl">
        <Card className="max-w-md border-0 bg-white/90 shadow-xl">
          <CardContent className="space-y-4 p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-[#b54733]" />
            <h1 className="text-2xl font-black text-[#173f3b]">הקישור אינו פעיל</h1>
            <p className="text-sm text-muted-foreground">ייתכן שהקישור הוחלף או הושבת. בקשו מבעל הלוח קישור חדש.</p>
            <Button asChild variant="outline"><Link to="/">חזרה ל־Tabro</Link></Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const boardLabel = meta.task_type === "work" ? "משימות עבודה" : "משימות אישיות";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f2e8] px-4 py-8 text-[#173f3b] md:py-14" dir="rtl">
      <div className="pointer-events-none absolute -right-24 top-20 h-80 w-80 rounded-full bg-[#e2b657]/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-28 bottom-0 h-96 w-96 rounded-full bg-[#4a9188]/20 blur-3xl" />
      <div className="relative mx-auto max-w-5xl">
        <header className="mb-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0d5c55]/15 bg-white/70 px-3 py-1 text-xs font-bold text-[#0d5c55]">
              <ClipboardList className="h-3.5 w-3.5" /> בקשת משימה מאובטחת
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
              יש משהו שצריך לקרות?<br /><span className="text-[#b66b32]">כתבו אותו ברור.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#48635f]">
              הבקשה תיכנס ישירות אל {meta.owner_display_name}, ללוח {boardLabel} ולגיליון „{meta.sheet_name}“.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/65 p-4 shadow-sm backdrop-blur">
            <UserRound className="h-9 w-9 rounded-full bg-[#0d5c55] p-2 text-white" />
            <div><p className="text-xs text-[#6a7d79]">נשלח אל</p><p className="font-extrabold">{meta.owner_display_name}</p></div>
          </div>
        </header>

        {submitted ? (
          <Card className="overflow-hidden border-0 bg-[#0d5c55] text-white shadow-2xl">
            <CardContent className="space-y-5 p-10 text-center md:p-16">
              <CheckCircle2 className="mx-auto h-16 w-16 text-[#f1c66f]" />
              <h2 className="text-3xl font-black">המשימה נשלחה ונוספה ללוח</h2>
              <p className="mx-auto max-w-xl text-white/75">הפרטים ופרטי הקשר נשמרו עם המשימה, כדי שיהיה ברור מה צריך לעשות ולמי לפנות.</p>
              <Button className="bg-[#f1c66f] text-[#173f3b] hover:bg-[#f7d58d]" onClick={() => setSubmitted(false)}>שליחת משימה נוספת</Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <Card className="border-0 bg-white/90 shadow-xl backdrop-blur">
              <CardContent className="space-y-5 p-6 md:p-8">
                <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#b66b32]">המשימה</p><h2 className="mt-1 text-2xl font-black">מה צריך לעשות?</h2></div>
                <div className="space-y-2"><Label htmlFor="description">תיאור קצר *</Label><Input id="description" required maxLength={500} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="לדוגמה: לתאם פגישה עם הספק" /></div>
                <div className="space-y-2"><Label htmlFor="details">כל הפרטים וההקשר</Label><Textarea id="details" maxLength={5000} rows={6} value={form.details} onChange={(e) => update("details", e.target.value)} placeholder="מה הרקע, מה בדיוק נדרש, קישורים או מידע שחשוב לדעת..." /></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="category">קטגוריה</Label><Input id="category" maxLength={120} value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="כספים, לקוחות, בית..." /></div>
                  <div className="space-y-2"><Label htmlFor="responsible">למי מיועדת המשימה?</Label><Input id="responsible" maxLength={120} value={form.responsible} onChange={(e) => update("responsible", e.target.value)} placeholder="שם אדם או צוות" /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="progress">מה כבר נעשה / תוצאה רצויה</Label><Textarea id="progress" maxLength={2000} rows={3} value={form.progress} onChange={(e) => update("progress", e.target.value)} /></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="plannedEnd">תאריך יעד</Label><Input id="plannedEnd" type="date" value={form.plannedEnd} onChange={(e) => update("plannedEnd", e.target.value)} /></div>
                  <label className="flex items-center gap-3 self-end rounded-xl border bg-[#f9f6ee] p-3 text-sm font-semibold"><Checkbox checked={form.urgent} onCheckedChange={(checked) => update("urgent", checked === true)} /> המשימה דחופה</label>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card className="border-0 bg-[#173f3b] text-white shadow-xl">
                <CardContent className="space-y-4 p-6">
                  <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#f1c66f]">מי מוסיף?</p><h2 className="mt-1 text-xl font-black">הפרטים שלך</h2></div>
                  <div className="space-y-2"><Label htmlFor="requesterName">שם מלא *</Label><Input id="requesterName" required maxLength={120} className="border-white/15 bg-white/10 text-white placeholder:text-white/45" value={form.requesterName} onChange={(e) => update("requesterName", e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="requesterEmail">אימייל *</Label><Input id="requesterEmail" type="email" required maxLength={254} dir="ltr" className="border-white/15 bg-white/10 text-left text-white placeholder:text-white/45" value={form.requesterEmail} onChange={(e) => update("requesterEmail", e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="requesterPhone">טלפון</Label><Input id="requesterPhone" type="tel" maxLength={60} dir="ltr" className="border-white/15 bg-white/10 text-left text-white placeholder:text-white/45" value={form.requesterPhone} onChange={(e) => update("requesterPhone", e.target.value)} /></div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white/90 shadow-xl">
                <CardContent className="space-y-4 p-6">
                  <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#0d5c55]">איש קשר</p><h2 className="mt-1 text-xl font-black">למי צריך לפנות?</h2></div>
                  <Input maxLength={120} value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="שם איש הקשר" />
                  <Input type="email" maxLength={254} dir="ltr" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} placeholder="contact@example.com" />
                  <Input type="tel" maxLength={60} dir="ltr" value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} placeholder="טלפון" />
                </CardContent>
              </Card>

              <div className="absolute -left-[9999px]" aria-hidden="true"><Label htmlFor="companyWebsite">Website</Label><Input id="companyWebsite" tabIndex={-1} autoComplete="off" value={form.companyWebsite} onChange={(e) => update("companyWebsite", e.target.value)} /></div>
              {errorMessage && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{errorMessage}</p>}
              <Button type="submit" size="lg" disabled={submitting} className="h-14 w-full bg-[#b66b32] text-base font-black text-white hover:bg-[#995725]">
                {submitting ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <ArrowLeft className="me-2 h-5 w-5" />} שליחת המשימה
              </Button>
              <p className="flex items-center justify-center gap-2 text-center text-xs text-[#60736f]"><ShieldCheck className="h-4 w-4" /> הקישור מאפשר רק הוספה. הוא אינו מציג משימות או מידע פרטי מהלוח.</p>
              <p className="text-center text-xs text-muted-foreground"><Link className="underline" to="/privacy">מדיניות פרטיות</Link> · מופעל באמצעות Tabro</p>
            </div>
          </form>
        )}
      </div>
    </main>
  );
};

export default PublicTaskRequest;
