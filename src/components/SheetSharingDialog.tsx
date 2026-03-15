import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Trash2, Mail } from "lucide-react";
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
  availableSheets?: string[];
}

const emailSchema = z.string().trim().email("אימייל לא תקין").max(255);
const MAIN_SHEET_NAME = "ראשי";

const SheetSharingDialog = ({ open, onOpenChange, sheetName, taskType, availableSheets = [] }: SheetSharingDialogProps) => {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [shareToAllSheets, setShareToAllSheets] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [selectedShareSheet, setSelectedShareSheet] = useState<string>(sheetName || MAIN_SHEET_NAME);

  const selectableSheets = useMemo(() => {
    const normalized = [MAIN_SHEET_NAME, ...availableSheets, sheetName]
      .map((s) => (s || "").trim())
      .filter(Boolean);

    return [...new Set(normalized)].sort((a, b) => {
      if (a === MAIN_SHEET_NAME && b !== MAIN_SHEET_NAME) return -1;
      if (b === MAIN_SHEET_NAME && a !== MAIN_SHEET_NAME) return 1;
      const aNum = Number(a);
      const bNum = Number(b);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
      if (!Number.isNaN(aNum)) return -1;
      if (!Number.isNaN(bNum)) return 1;
      return a.localeCompare(b, "he");
    });
  }, [availableSheets, sheetName]);

  useEffect(() => {
    setSelectedShareSheet((sheetName || MAIN_SHEET_NAME).trim() || MAIN_SHEET_NAME);
  }, [sheetName]);

  useEffect(() => {
    if (!open || !user) return;
    if (!selectableSheets.includes(selectedShareSheet)) {
      setSelectedShareSheet(selectableSheets[0] || MAIN_SHEET_NAME);
      return;
    }
    fetchSheetAndCollaborators();
  }, [open, user, selectedShareSheet, selectableSheets]);

  const ensureSheet = async (name: string): Promise<string | null> => {
    if (!user) return null;
    // First try to find existing
    const { data: existing } = await supabase
      .from("task_sheets")
      .select("id")
      .eq("user_id", user.id)
      .eq("task_type", taskType)
      .eq("sheet_name", name)
      .maybeSingle();

    if (existing) return existing.id;

    // Create new
    const { data: created, error } = await supabase
      .from("task_sheets")
      .insert({ user_id: user.id, task_type: taskType, sheet_name: name })
      .select("id")
      .single();

    if (error) {
      // Might be race condition, try select again
      const { data: retry } = await supabase
        .from("task_sheets")
        .select("id")
        .eq("user_id", user.id)
        .eq("task_type", taskType)
        .eq("sheet_name", name)
        .maybeSingle();
      return retry?.id || null;
    }
    return created.id;
  };

  const fetchSheetAndCollaborators = async () => {
    if (!user) return;
    setLoading(true);

    const id = await ensureSheet(selectedShareSheet);
    if (!id) {
      setCollaborators([]);
      setSheetId(null);
      setLoading(false);
      toast.error("שגיאה בפתיחת גליון לשיתוף");
      return;
    }

    setSheetId(id);

    const { data: collabData, error: collabError } = await supabase
      .from("task_sheet_collaborators")
      .select("id, invited_email, invited_display_name, invited_username, permission, created_at")
      .eq("sheet_id", id)
      .order("created_at", { ascending: true });

    if (collabError) {
      setLoading(false);
      toast.error("שגיאה בטעינת שותפים");
      return;
    }

    setCollaborators((collabData || []) as Collaborator[]);
    setLoading(false);
  };

  const logActivity = async (action: string, targetEmail: string, sheetNames: string[]) => {
    if (!user) return;
    try {
      await supabase.from("sharing_activity_log").insert(
        sheetNames.map((sn) => ({
          user_id: user.id,
          action,
          target_email: targetEmail,
          sheet_name: sn,
          task_type: taskType,
          details: `${action}: ${targetEmail} → ${sn}`,
        }))
      );
    } catch {}
  };

  const addCollaborator = async () => {
    if (!user) return;

    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "אימייל לא תקין");
      return;
    }

    const normalizedEmail = parsed.data.toLowerCase();

    if (normalizedEmail === (user.email || "").toLowerCase()) {
      toast.error("לא ניתן לשתף עם עצמך");
      return;
    }

    setSaving(true);

    try {
      let targetSheets: Array<{ id: string; name: string }> = [];

      if (shareToAllSheets) {
        const allNames = [...new Set([MAIN_SHEET_NAME, ...selectableSheets])];
        for (const name of allNames) {
          const id = await ensureSheet(name);
          if (id) targetSheets.push({ id, name });
        }
        if (targetSheets.length === 0) {
          throw new Error("לא נמצאו גליונות לשיתוף");
        }
      } else {
        if (!sheetId) {
          throw new Error("הגליון שנבחר לא זמין לשיתוף");
        }
        targetSheets = [{ id: sheetId, name: selectedShareSheet }];
      }

      // Write via secured backend function and verify persistence
      let successCount = 0;
      const failedSheets: string[] = [];

      for (const sheet of targetSheets) {
        const { error: rpcError } = await supabase.rpc(
          "share_sheet_with_email" as any,
          {
            _sheet_id: sheet.id,
            _invited_email: normalizedEmail,
            _permission: permission,
          } as any
        );

        if (rpcError) {
          console.error("share_sheet_with_email error:", rpcError);
          failedSheets.push(sheet.name);
          continue;
        }

        successCount++;
      }

      const { data: persistedRows, error: verifyError } = await supabase
        .from("task_sheet_collaborators")
        .select("id, sheet_id")
        .in("sheet_id", targetSheets.map((s) => s.id))
        .eq("invited_email", normalizedEmail)
        .eq("invited_by", user.id);

      if (verifyError) {
        throw new Error("נכשלה בדיקת שמירה אחרי השיתוף");
      }

      const persistedCount = persistedRows?.length || 0;
      if (persistedCount === 0) {
        const failed = failedSheets.length > 0 ? ` (${failedSheets.join(", ")})` : "";
        throw new Error(`השיתוף לא נשמר בבסיס הנתונים${failed}`);
      }

      successCount = Math.min(successCount, persistedCount);

      if (successCount === 0) {
        throw new Error("לא הצלחנו להוסיף שותף לאף גליון");
      }

      await logActivity("added_collaborator", normalizedEmail, targetSheets.map(s => s.name));
      await fetchSheetAndCollaborators();

      toast.success(
        shareToAllSheets
          ? `${normalizedEmail} נוסף לשיתוף ב-${successCount} גליונות`
          : `${normalizedEmail} נוסף לגליון "${selectedShareSheet}"`
      );
      setNewEmail("");
    } catch (error: any) {
      console.error("addCollaborator error:", error);
      toast.error(error?.message || "שגיאה בהוספת שותף");
    } finally {
      setSaving(false);
    }
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

    setCollaborators((prev) =>
      prev.map((c) => (c.id === id ? { ...c, permission: newPermission } : c))
    );
  };

  const removeCollaborator = async (id: string) => {
    const collab = collaborators.find(c => c.id === id);
    const { error } = await supabase
      .from("task_sheet_collaborators")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("שגיאה בהסרת שותף");
      return;
    }

    if (collab) {
      await logActivity("removed_collaborator", collab.invited_email, [selectedShareSheet]);
    }

    setCollaborators((prev) => prev.filter((c) => c.id !== id));
    toast.success("השותף הוסר");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            שיתוף גליון
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>בחר גליון לשיתוף</Label>
            <Select value={selectedShareSheet} onValueChange={setSelectedShareSheet}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableSheets.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <Checkbox
              id="share-all-sheets"
              checked={shareToAllSheets}
              onCheckedChange={(checked) => setShareToAllSheets(!!checked)}
            />
            <Label htmlFor="share-all-sheets" className="text-sm cursor-pointer">
              שתף לכל הגליונות (כולל ראשי)
            </Label>
          </div>

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
              <Button onClick={addCollaborator} size="sm" disabled={saving || !newEmail.trim()}>
                {saving ? "שומר..." : "הוסף"}
              </Button>
            </div>
          </div>

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
                      <div className="min-w-0 leading-tight">
                        <div className="text-sm truncate">
                          {collab.invited_display_name || collab.invited_email.split("@")[0]}
                        </div>
                        <div className="text-xs text-muted-foreground truncate" dir="ltr">
                          @{collab.invited_username || collab.invited_email.split("@")[0]} · {collab.invited_email}
                        </div>
                      </div>
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
