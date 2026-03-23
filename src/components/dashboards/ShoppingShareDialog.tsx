import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface Collaborator {
  id: string;
  invited_email: string;
  invited_display_name: string | null;
  permission: string;
}

interface ShoppingShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetName: string;
  availableSheets?: string[];
}

const emailSchema = z.string().trim().email("אימייל לא תקין").max(255);

const ShoppingShareDialog = ({ open, onOpenChange, sheetName, availableSheets = [] }: ShoppingShareDialogProps) => {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("edit");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState(sheetName);

  const sheets = useMemo(() => {
    const all = [...new Set(["ראשי", "סופר", ...availableSheets])];
    return all;
  }, [availableSheets]);

  useEffect(() => { setSelectedSheet(sheetName); }, [sheetName]);

  useEffect(() => {
    if (!open || !user) return;
    fetchSheetAndCollaborators();
  }, [open, user, selectedSheet]);

  const ensureSheet = async (name: string): Promise<string | null> => {
    if (!user) return null;
    const { data: existing } = await supabase
      .from("shopping_sheets")
      .select("id")
      .eq("user_id", user.id)
      .eq("sheet_name", name)
      .maybeSingle();
    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from("shopping_sheets")
      .insert({ user_id: user.id, sheet_name: name })
      .select("id")
      .single();
    if (error) {
      const { data: retry } = await supabase
        .from("shopping_sheets")
        .select("id")
        .eq("user_id", user.id)
        .eq("sheet_name", name)
        .maybeSingle();
      return retry?.id || null;
    }
    return created.id;
  };

  const fetchSheetAndCollaborators = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const id = await ensureSheet(selectedSheet);
      if (!id) { setCollaborators([]); setSheetId(null); return; }
      setSheetId(id);

      const { data } = await supabase
        .from("shopping_sheet_collaborators")
        .select("id, invited_email, invited_display_name, permission")
        .eq("sheet_id", id)
        .order("created_at", { ascending: true });
      setCollaborators((data || []) as Collaborator[]);
    } finally {
      setLoading(false);
    }
  };

  const addCollaborator = async () => {
    if (!user || !sheetId) return;
    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) { toast.error("אימייל לא תקין"); return; }
    const email = parsed.data.toLowerCase();
    if (email === (user.email || "").toLowerCase()) { toast.error("לא ניתן לשתף עם עצמך"); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from("shopping_sheet_collaborators").insert({
        sheet_id: sheetId,
        invited_email: email,
        permission,
        invited_by: user.id,
      });
      if (error) {
        if (error.code === "23505") {
          await supabase.from("shopping_sheet_collaborators")
            .update({ permission })
            .eq("sheet_id", sheetId)
            .eq("invited_email", email);
          toast.success("ההרשאה עודכנה");
        } else throw error;
      } else {
        toast.success(`${email} נוסף לרשימה "${selectedSheet}"`);
      }
      setNewEmail("");
      fetchSheetAndCollaborators();
    } catch (e: any) {
      toast.error(e?.message || "שגיאה");
    } finally {
      setSaving(false);
    }
  };

  const removeCollaborator = async (id: string) => {
    await supabase.from("shopping_sheet_collaborators").delete().eq("id", id);
    setCollaborators(prev => prev.filter(c => c.id !== id));
    toast.success("השותף הוסר");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />שיתוף רשימת קניות
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>בחר רשימה לשיתוף</Label>
            <Select value={selectedSheet} onValueChange={setSelectedSheet}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>הוסף שותף לפי אימייל</Label>
            <div className="flex gap-2">
              <Input placeholder="email@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} dir="ltr" className="flex-1" onKeyDown={e => e.key === "Enter" && addCollaborator()} />
              <Select value={permission} onValueChange={(v: "view" | "edit") => setPermission(v)}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">צפייה</SelectItem>
                  <SelectItem value="edit">עריכה</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addCollaborator} size="sm" disabled={saving || !newEmail.trim()}>{saving ? "..." : "הוסף"}</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>שותפים ({collaborators.length})</Label>
            {loading ? <p className="text-sm text-muted-foreground">טוען...</p> :
              collaborators.length === 0 ? <p className="text-sm text-muted-foreground">אין שותפים עדיין</p> :
              <div className="space-y-2 max-h-60 overflow-auto">
                {collaborators.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm truncate">{c.invited_display_name || c.invited_email.split("@")[0]}</div>
                        <div className="text-xs text-muted-foreground truncate" dir="ltr">{c.invited_email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{c.permission === "edit" ? "עריכה" : "צפייה"}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCollaborator(c.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Need Badge import
import { Badge } from "@/components/ui/badge";

export default ShoppingShareDialog;
