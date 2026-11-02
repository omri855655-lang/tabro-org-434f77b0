import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Copy, Download, Link2, RefreshCw, ShieldCheck, Smartphone, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/integrations/supabase/config";
import { buildFeedUrls, FEED_DAYS_AHEAD, FEED_DAYS_BACK, FEED_MAX_EVENTS, type FeedFieldOptions } from "../../supabase/functions/_shared/calendarFeed.ts";
import { appleCalendarCopy, fillCopy } from "@/components/appleCalendarCopy";

interface FeedStatus {
  enabled: boolean;
  options?: FeedFieldOptions;
  createdAt?: string;
  lastFetchedAt?: string | null;
  lastEventCount?: number | null;
  lastSkippedCount?: number | null;
  lastTruncated?: boolean | null;
}
type Action = "status" | "create" | "regenerate" | "update" | "revoke";
const NO_FIELDS: FeedFieldOptions = { include_description: false, include_location: false, include_meeting_url: false };

/** Private, revocable Apple Calendar subscription plus the one-time ICS fallback. */
export default function AppleCalendarGuide({ onExport }: { onExport?: () => void }) {
  const { lang, dir } = useLanguage();
  const c = appleCalendarCopy[lang];
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<FeedStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [fields, setFields] = useState<FeedFieldOptions>(NO_FIELDS);
  // The raw link exists only in memory while this dialog is open; never persisted or logged.
  const [token, setToken] = useState<string | null>(null);
  const dialogGeneration = useRef(0);

  const call = useCallback(async (action: Action, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("calendar-feed-manage", { body: { action, ...extra } });
    if (error || !data || typeof data !== "object" || "error" in data) throw new Error("calendar-feed-manage");
    return data as FeedStatus & { token?: string };
  }, []);

  const load = useCallback(async () => {
    const generation = dialogGeneration.current;
    setLoadFailed(false);
    try {
      const data = await call("status");
      if (generation !== dialogGeneration.current) return;
      setStatus(data);
      setFields(data.options ?? NO_FIELDS);
    } catch { if (generation === dialogGeneration.current) setLoadFailed(true); }
  }, [call]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const handleOpenChange = (next: boolean) => {
    dialogGeneration.current++;
    setOpen(next);
    if (!next) { setToken(null); setConsent(false); setStatus(null); }
  };

  const run = async (action: Action, extra: Record<string, unknown> = {}, success?: string) => {
    const generation = dialogGeneration.current;
    setBusy(true);
    try {
      const data = await call(action, extra);
      // A late response must not restore a private link after closing the dialog.
      if (generation !== dialogGeneration.current) return;
      setStatus(data);
      setFields(data.options ?? NO_FIELDS);
      setToken(data.token ?? null);
      if (action === "revoke") setConsent(false);
      if (success) toast.success(success);
    } catch {
      if (generation === dialogGeneration.current) toast.error(c.actionError);
    } finally { setBusy(false); }
  };

  const urls = token ? buildFeedUrls(SUPABASE_URL, token) : null;
  const copyLink = async () => {
    if (!urls) return;
    try { await navigator.clipboard.writeText(urls.https); toast.success(c.copied); } catch { toast.error(c.copyFailed); }
  };
  const formatDate = (iso?: string | null) => iso ? new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(iso)) : "";
  const optionsChanged = !!status?.options && (Object.keys(NO_FIELDS) as (keyof FeedFieldOptions)[]).some(key => status.options![key] !== fields[key]);

  const fieldToggles = <div className="space-y-2">
    <p className="text-sm">{c.alwaysIncluded}</p>
    {([["include_description", c.optDescription], ["include_location", c.optLocation], ["include_meeting_url", c.optMeeting]] as const).map(([key, label]) =>
      <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
        <Checkbox checked={fields[key]} onCheckedChange={value => setFields(prev => ({ ...prev, [key]: value === true }))} disabled={busy} />
        {label}
      </label>)}
    <p className="text-xs text-muted-foreground">{c.optHint}</p>
  </div>;

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogTrigger asChild><Button variant="outline" size="sm" className="min-h-11 gap-1"><Smartphone className="h-4 w-4" />{c.button}</Button></DialogTrigger>
    <DialogContent dir={dir} className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />{c.title}</DialogTitle><DialogDescription>{c.intro}</DialogDescription></DialogHeader>

      <section className="space-y-3 rounded-lg border p-3">
        <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />{c.subTitle}</h3>
        <p className="text-sm leading-relaxed">{c.subIntro}</p>
        <p className="text-sm text-muted-foreground">{fillCopy(c.feedScope, { back: FEED_DAYS_BACK, ahead: FEED_DAYS_AHEAD, max: FEED_MAX_EVENTS })}</p>
        <ul className="list-disc space-y-1 ps-5 text-sm leading-relaxed">{c.privacy.map(line => <li key={line}>{line}</li>)}</ul>

        {loadFailed && <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">{c.loadError}<Button variant="outline" size="sm" onClick={() => void load()}>{c.retry}</Button></div>}
        {!loadFailed && !status && <p className="text-sm text-muted-foreground">{c.working}</p>}

        {status && !status.enabled && <div className="space-y-3">
          {fieldToggles}
          <label className="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-sm">
            <Checkbox className="mt-0.5" checked={consent} onCheckedChange={value => setConsent(value === true)} disabled={busy} />
            {c.consent}
          </label>
          <Button className="min-h-11 w-full gap-2" disabled={!consent || busy} onClick={() => void run("create", { consent: true, options: fields })}>
            <Link2 className="h-4 w-4" />{busy ? c.working : c.create}
          </Button>
        </div>}

        {status?.enabled && <div className="space-y-3">
          {urls ? <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
            <p className="text-sm font-medium">{c.linkReady}</p>
            <input readOnly dir="ltr" value={urls.https} onFocus={event => event.currentTarget.select()} aria-label={c.copy} className="w-full rounded-md border bg-background px-2 py-2 font-mono text-xs" />
            <div className="flex flex-wrap gap-2">
              <Button asChild className="min-h-11 gap-2"><a href={urls.webcal} rel="noreferrer"><CalendarDays className="h-4 w-4" />{c.subscribe}</a></Button>
              <Button variant="outline" className="min-h-11 gap-2" onClick={() => void copyLink()}><Copy className="h-4 w-4" />{c.copy}</Button>
            </div>
          </div> : <p className="text-sm">{c.activeNoLink}</p>}

          <div className="space-y-1 text-sm text-muted-foreground">
            {status.createdAt && <p>{fillCopy(c.createdAt, { date: formatDate(status.createdAt) })}</p>}
            <p>{status.lastFetchedAt ? fillCopy(c.lastFetch, { date: formatDate(status.lastFetchedAt) }) : c.never}</p>
            {status.lastFetchedAt && status.lastEventCount != null && <p>{fillCopy(c.lastCount, { count: status.lastEventCount })}</p>}
            {!!status.lastSkippedCount && <p>{fillCopy(c.skipped, { count: status.lastSkippedCount })}</p>}
            {status.lastTruncated && <p className="text-destructive">{c.truncated}</p>}
            <p className="text-xs">{c.statusNote}</p>
          </div>

          {fieldToggles}
          {optionsChanged && <Button variant="secondary" className="min-h-11" disabled={busy} onClick={() => void run("update", { options: fields }, c.optionsSaved)}>{c.saveOptions}</Button>}

          <div className="flex flex-wrap gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" className="min-h-11 gap-2" disabled={busy}><RefreshCw className="h-4 w-4" />{c.regenerate}</Button></AlertDialogTrigger>
              <AlertDialogContent dir={dir}>
                <AlertDialogHeader><AlertDialogTitle>{c.regenerateTitle}</AlertDialogTitle><AlertDialogDescription>{c.regenerateBody}</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>{c.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => void run("regenerate", { consent: true, confirm: true, options: fields })}>{c.regenerateConfirm}</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" className="min-h-11 gap-2 text-destructive" disabled={busy}><Unlink className="h-4 w-4" />{c.revoke}</Button></AlertDialogTrigger>
              <AlertDialogContent dir={dir}>
                <AlertDialogHeader><AlertDialogTitle>{c.revokeTitle}</AlertDialogTitle><AlertDialogDescription>{c.revokeBody}</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>{c.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => void run("revoke", { confirm: true })}>{c.revokeConfirm}</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">{c.setupTitle}</h3>
        <ol className="list-decimal space-y-2 ps-5 text-sm leading-relaxed">{c.setupSteps.map(step => <li key={step}>{step}</li>)}</ol>
      </section>

      {onExport && <section className="space-y-2 rounded-lg border p-3">
        <h3 className="font-semibold">{c.fallbackTitle}</h3>
        <p className="text-sm text-muted-foreground">{c.scope}</p>
        <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">{c.warning}</p>
        <Button variant="outline" onClick={onExport} className="min-h-11 gap-2"><Download className="h-4 w-4" />{c.download}</Button>
      </section>}

      <p className="text-xs leading-relaxed text-muted-foreground">{c.note}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a href="https://support.apple.com/en-us/102301" target="_blank" rel="noreferrer" className="text-primary underline">{c.subscribeHelp}</a>
        <a href="https://support.apple.com/en-us/118610" target="_blank" rel="noreferrer" className="text-primary underline">{c.help}</a>
      </div>
    </DialogContent>
  </Dialog>;
}
