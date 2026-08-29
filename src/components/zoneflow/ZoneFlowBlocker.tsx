import { useEffect, useMemo, useState } from "react";
import { AppWindow, Ban, CheckCircle2, Globe2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeLocalStorage } from "@/lib/safeLocalStorage";

const normalizeDomain = (value: string) => {
  const candidate = value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(candidate) ? candidate : "";
};

export function ZoneFlowBlocker() {
  const [domains, setDomains] = useState<string[]>(() => safeLocalStorage.getJSON("zoneflow-block-domains", ["instagram.com", "facebook.com", "youtube.com"]));
  const [draft, setDraft] = useState("");
  const [focusActive, setFocusActive] = useState(false);
  const [extensionConnected, setExtensionConnected] = useState(false);

  useEffect(() => safeLocalStorage.setJSON("zoneflow-block-domains", domains), [domains]);
  useEffect(() => {
    const onFocusState = (event: Event) => setFocusActive(Boolean((event as CustomEvent).detail?.active));
    const onExtension = (event: Event) => setExtensionConnected(Boolean((event as CustomEvent).detail?.connected));
    window.addEventListener("zoneflow-focus-state", onFocusState);
    window.addEventListener("zoneflow-blocker-extension", onExtension);
    window.dispatchEvent(new CustomEvent("zoneflow-blocklist-updated", { detail: { domains } }));
    return () => {
      window.removeEventListener("zoneflow-focus-state", onFocusState);
      window.removeEventListener("zoneflow-blocker-extension", onExtension);
    };
  }, [domains]);

  const status = useMemo(() => {
    if (!extensionConnected) return { label: "רשימה מוכנה, נדרשת הרחבה לחסימה מלאה", color: "text-amber-700 bg-amber-50 border-amber-200" };
    if (focusActive) return { label: "החסימה פעילה עד סיום הסשן", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    return { label: "הרחבה מחוברת וממתינה לסשן", color: "text-sky-700 bg-sky-50 border-sky-200" };
  }, [extensionConnected, focusActive]);

  const addDomain = () => {
    const domain = normalizeDomain(draft);
    if (!domain || domains.includes(domain)) return;
    setDomains((current) => [...current, domain]);
    setDraft("");
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_18px_55px_rgba(31,45,61,.08)] dark:border-white/10 dark:bg-white/[0.04] dark:text-white" dir="rtl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] text-rose-600"><ShieldCheck className="h-4 w-4" />ZONEFLOW BLOCK</div>
          <h3 className="mt-2 text-xl font-semibold">רשימת חסימה שמופעלת עם הטיימר</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-white/55">Tabro מסנכרנת את הרשימה ומצב הסשן. חסימה אמיתית של אתר בטאב אחר אינה אפשרית מדף אינטרנט רגיל ודורשת הרחבת דפדפן מותקנת.</p>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${status.color}`}>{status.label}</div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_.72fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/10">
          <div className="flex gap-2">
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDomain(); } }} placeholder="למשל: tiktok.com" className="bg-white dark:bg-white/5" />
            <Button onClick={addDomain} disabled={!normalizeDomain(draft)}><Plus className="ms-1 h-4 w-4" />הוסף</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {domains.map((domain) => <span key={domain} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"><Globe2 className="h-3.5 w-3.5 text-slate-400" />{domain}<button type="button" onClick={() => setDomains((current) => current.filter((item) => item !== domain))} className="text-slate-400 hover:text-rose-600" aria-label={`הסר ${domain}`}><Trash2 className="h-3.5 w-3.5" /></button></span>)}
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 p-4 text-sm dark:border-white/10">
          <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /><span>הרשימה נשמרת במכשיר ומופעלת אוטומטית יחד עם סשן ריכוז.</span></div>
          <div className="flex items-start gap-2"><AppWindow className="mt-0.5 h-4 w-4 text-sky-600" /><span>לכמה דפדפנים ומכשירים נדרש חשבון מסונכרן והרחבה בכל דפדפן.</span></div>
          <div className="flex items-start gap-2"><Ban className="mt-0.5 h-4 w-4 text-rose-600" /><span>אפליקציות מערכת דורשות אפליקציית Desktop נפרדת; אתר Tabro לבדו אינו יכול לסגור אותן.</span></div>
        </div>
      </div>
    </section>
  );
}
