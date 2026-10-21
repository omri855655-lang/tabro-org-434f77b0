import { useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/useLanguage";
import { ganttCopy } from "@/lib/ganttCopy";
import { validGanttToken } from "@/lib/publicGantt";

interface ProjectGanttShareLinkProps {
  projectId: string;
  projectTitle: string;
}
const createViewingLink = async (projectId:string,signal:AbortSignal) => {
  const {data,error}=await supabase.rpc('get_or_create_project_gantt_link',{p_project_id:projectId}).abortSignal(signal);
  if(error || typeof data!=='string' || !validGanttToken(data))throw error || new Error('Invalid viewing token');
  return data;
};
const disableViewingLink = async (projectId:string,signal:AbortSignal) => {
  const {error}=await supabase.rpc('disable_project_gantt_link',{p_project_id:projectId}).abortSignal(signal);
  if(error)throw error;
};

export default function ProjectGanttShareLink({ projectId, projectTitle }: ProjectGanttShareLinkProps) {
  return <GanttSharePanel key={projectId} projectId={projectId} projectTitle={projectTitle} />;
}
export function GanttSharePanel({ projectId, projectTitle, createLinkRequest=createViewingLink, disableLinkRequest=disableViewingLink }: ProjectGanttShareLinkProps & {createLinkRequest?:typeof createViewingLink;disableLinkRequest?:typeof disableViewingLink}) {
  const { lang, dir } = useLanguage();
  const copy = ganttCopy[lang];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [disabling,setDisabling] = useState(false);
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  const pending = useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const createLink = async () => {
    setOpen(true);
    if (url || pending.current) return;
    pending.current=true;setLoading(true);
    const controller=new AbortController();request.current=controller;
    const timer=setTimeout(()=>controller.abort(),15000);
    try {
      const data = await createLinkRequest(projectId,controller.signal);
      if(!validGanttToken(data))throw new Error('Invalid viewing token');
      if(alive.current)setUrl(`${window.location.origin}/project-gantt/${data}`);
    } catch {if(alive.current)toast.error(copy.createError);}
    finally {clearTimeout(timer);pending.current=false;if(alive.current)setLoading(false);}
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url);setCopied(true);toast.success(copy.copied); }
    catch {toast.error(copy.copyError);}
  };

  const share = async () => {
    if (!navigator.share) return copyLink();
    try { await navigator.share({ title: `${copy.gantt} · ${projectTitle}`, url }); }
    catch (error) {if(!(error instanceof DOMException && error.name==='AbortError'))await copyLink();}
  };
  const disable = async () => {
    if(pending.current)return;
    pending.current=true;setDisabling(true);
    const controller=new AbortController();request.current=controller;
    const timer=setTimeout(()=>controller.abort(),15000);
    try {
      await disableLinkRequest(projectId,controller.signal);
      if(alive.current){setUrl('');setOpen(false);toast.success(copy.disabled);}
    } catch {if(alive.current)toast.error(copy.disableError);}
    finally {clearTimeout(timer);pending.current=false;if(alive.current)setDisabling(false);}
  };

  return <>
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
      <Eye className="h-4 w-4" />{copy.viewLink}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir={dir}>
        <DialogHeader className="text-start">
          <DialogTitle>{copy.shareTitle}: {projectTitle}</DialogTitle>
          <DialogDescription>
            {copy.shareHint}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />{copy.creating}
          </div>
        ) : url ? (
          <div className="space-y-3">
            <Input aria-label={copy.linkLabel} value={url} readOnly dir="ltr" className="text-left" />
            <div className="flex flex-wrap gap-2">
              <Button disabled={disabling} onClick={() => void copyLink()} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copy.copy}
              </Button>
              <Button disabled={disabling} variant="outline" onClick={() => void share()} className="gap-2">
                <Link2 className="h-4 w-4" />{copy.share}
              </Button>
              <Button disabled={disabling} variant="ghost" onClick={()=>void disable()}>{disabling ? copy.disabling : copy.disable}</Button>
            </div>
          </div>
        ) : <Button onClick={()=>void createLink()}>{copy.createLink}</Button>}
      </DialogContent>
    </Dialog>
  </>;
}
