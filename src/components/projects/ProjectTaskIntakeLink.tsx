import { useEffect, useState } from "react";
import { PUBLIC_APP_ORIGIN } from "@/lib/publicSite";
import { Check, Copy, Link2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function ProjectTaskIntakeLink({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (!open) setCopied(false); }, [open]);

  const createLink = async () => {
    setOpen(true);
    if (url || loading) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_or_create_project_task_intake_link", { p_project_id: projectId });
    setLoading(false);
    if (error || !data) {
      toast.error("לא הצלחנו ליצור קישור לפרויקט");
      return;
    }
    setUrl(`${PUBLIC_APP_ORIGIN}/project-request/${data}`);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("הקישור הועתק");
  };

  const share = async () => {
    if (!navigator.share) return copy();
    await navigator.share({ title: `הוספת משימה לפרויקט ${projectTitle}`, url });
  };

  return <>
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void createLink()}>
      <Share2 className="h-4 w-4" />קישור להוספת משימה
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>קישור קבוע לפרויקט {projectTitle}</DialogTitle>
          <DialogDescription>כל מי שמקבל את הקישור יכול להציע משימה לפרויקט בלבד. הוא אינו רואה את הפרויקט או את המשימות הקיימות.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />יוצר קישור מאובטח...</div> : url && <div className="space-y-3">
          <Input value={url} readOnly dir="ltr" className="text-left" />
          <div className="flex gap-2">
            <Button onClick={() => void copy()} className="gap-2">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}העתקה</Button>
            <Button variant="outline" onClick={() => void share()} className="gap-2"><Link2 className="h-4 w-4" />שיתוף</Button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
