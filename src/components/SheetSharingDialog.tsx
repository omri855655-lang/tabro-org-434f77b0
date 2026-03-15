import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Trash2, Mail, Shield } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface Collaborator {
  id: string;
  invited_email: string;
  invited_display_name: string | null;
  invited_username: string | null;
  permission: string;
  created_at: string;
}

interface SheetSharingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetName: string;
  taskType: string;
}

const emailSchema = z.string().trim().email("אימייל לא תקין").max(255);

const SheetSharingDialog = ({ open, onOpenChange, sheetName, taskType }: SheetSharingDialogProps) => {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [loading, setLoading] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchSheetAndCollaborators();
    }
  }, [open, user, sheetName]);

  const fetchSheetAndCollaborators = async () => {
    if (!user) return;
    setLoading(true);

    // Get the sheet ID
    const { data: sheetData, error: sheetError } = await supabase
      .from("task_sheets")
      .select("id")
      .eq("sheet_name", sheetName)
      .eq("task_type", taskType)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sheetError || !sheetData) {
      setCollaborators([]);
      setLoading(false);
      return;
    }

    setSheetId(sheetData.id);

    // Get collaborators
    const { data: collabData, error: collabError } = await supabase
      .from("task_sheet_collaborators")
      .select("id, invited_email, invited_display_name, invited_username, permission, created_at")
      .eq("sheet_id", sheetData.id)
      .order("created_at", { ascending: true });

    if (collabError) {
      setLoading(false);
      toast.error("שגיאה בטעינת שותפים");
      return;
    }

    setCollaborators((collabData || []) as Collaborator[]);
    setLoading(false);
  };

  const addCollaborator = async () => {
    if (!user || !sheetId) return;

    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "אימייל לא תקין");
      return;
    }

    if (parsed.data === user.email) {
      toast.error("לא ניתן לשתף עם עצמך");
      return;
    }

    if (collaborators.some(c => c.invited_email === parsed.data)) {
      toast.error("המשתמש כבר משותף");
      return;
    }

    const { error } = await supabase.from("task_sheet_collaborators").insert({
      sheet_id: sheetId,
      invited_email: parsed.data,
      permission,
      invited_by: user.id,
    });

    if (error) {
      toast.error("שגיאה בהוספת שותף");
      console.error(error);
      return;
    }

    toast.success(`${parsed.data} נוסף כשותף`);
    setNewEmail("");
    fetchSheetAndCollaborators();
  };

  const updatePermission = async (id: string, newPermission: string) => {
    const { error } = await supabase
      .from("task_sheet_collaborators")
      .update({ permission: newPermission })
      .eq("id", id);

    if (error) {
      toast.error("שגיאה בעדכון הרשאה");
      return;
    }

    setCollaborators(prev =>
      prev.map(c => (c.id === id ? { ...c, permission: newPermission } : c))
    );
  };

  const removeCollaborator = async (id: string) => {
    const { error } = await supabase
      .from("task_sheet_collaborators")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("שגיאה בהסרת שותף");
      return;
    }

    setCollaborators(prev => prev.filter(c => c.id !== id));
    toast.success("השותף הוסר");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            שיתוף גליון: {sheetName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add collaborator */}
          <div className="space-y-2">
            <Label>הוסף שותף לפי אימייל</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                dir="ltr"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && addCollaborator()}
              />
              <Select value={permission} onValueChange={(v: "view" | "edit") => setPermission(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">צפייה</SelectItem>
                  <SelectItem value="edit">עריכה</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addCollaborator} size="sm">
                הוסף
              </Button>
            </div>
          </div>

          {/* Collaborators list */}
          <div className="space-y-2">
            <Label>שותפים ({collaborators.length})</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">טוען...</p>
            ) : collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין שותפים עדיין</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto">
                {collaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate" dir="ltr">
                        {collab.invited_email}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Select
                        value={collab.permission}
                        onValueChange={(v) => updatePermission(collab.id, v)}
                      >
                        <SelectTrigger className="h-7 w-20 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">צפייה</SelectItem>
                          <SelectItem value="edit">עריכה</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeCollaborator(collab.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SheetSharingDialog;
