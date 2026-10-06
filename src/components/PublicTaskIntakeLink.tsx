import { useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PublicTaskIntakeLinkProps {
  taskType: "personal" | "work";
  sheetName: string;
}

const PublicTaskIntakeLink = ({ taskType, sheetName }: PublicTaskIntakeLinkProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl("");
    setOpen(false);
  }, [sheetName, taskType]);

  const loadLink = async () => {
    setOpen(true);
    if (url) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_or_create_task_intake_link", {
      p_task_type: taskType,
      p_sheet_name: sheetName,
    });
    setLoading(false);
    if (error || !data) {
      toast.error("לא הצלחנו ליצור קישור להוספת משימה");
      setOpen(false);
      return;
    }
    setUrl(`${window.location.origin}/task-request/${data}`);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("הקישור הועתק");
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => void loadLink()} className="gap-1 shrink-0">
        <Link2 className="h-4 w-4" />
        <span className="hidden md:inline">קישור להוספת משימה</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>קישור קבוע לקבלת משימות</DialogTitle>
            <DialogDescription>
              מי שיקבל את הקישור יוכל לשלוח משימה חדשה ללוח „{sheetName}“. המשימות הקיימות שלך אינן חשופות.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" /> מכין קישור...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2" dir="ltr">
                <Input value={url} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => void copyLink()} aria-label="העתקת קישור">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" asChild aria-label="פתיחת קישור">
                  <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              </div>
              <Button className="w-full" onClick={() => void copyLink()}>
                <Copy className="me-2 h-4 w-4" /> העתק קישור לשליחה
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PublicTaskIntakeLink;
