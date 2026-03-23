import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Trash2, Mail, Crown, UserCheck, Eye, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface ProjectMember {
  id: string;
  invited_email: string;
  invited_display_name: string | null;
  invited_username: string | null;
  role: string;
  job_title: string | null;
  status: string;
  created_at: string;
}

interface ProjectMembersPanelProps {
  projectId: string;
  isOwner: boolean;
}

const emailSchema = z.string().trim().email("אימייל לא תקין").max(255);

const roleLabels: Record<string, string> = {
  manager: "מנהל",
  member: "חבר צוות",
  viewer: "צופה",
};

const roleIcons: Record<string, typeof Crown> = {
  manager: Crown,
  member: UserCheck,
  viewer: Eye,
};

const ProjectMembersPanel = ({ projectId, isOwner }: ProjectMembersPanelProps) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<string>("member");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("project_members")
      .select("id, invited_email, invited_display_name, invited_username, role, job_title, status, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
    }
    setMembers(data || []);
    setLoading(false);
  };

  const addMember = async () => {
    if (!user) return;

    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "אימייל לא תקין");
      return;
    }

    const normalizedEmail = parsed.data.toLowerCase();

    if (normalizedEmail === (user.email || "").toLowerCase()) {
      toast.error("לא ניתן להוסיף את עצמך");
      return;
    }

    const basePayload = {
      project_id: projectId,
      invited_email: normalizedEmail,
      role: newRole,
      job_title: newJobTitle.trim() || null,
      invited_by: user.id,
    };

    const { error } = await supabase.from("project_members").insert(basePayload);

    if (error) {
      if (error.code === "23505") {
        const { data: updatedRow, error: updateError } = await supabase
          .from("project_members")
          .update({
            role: newRole,
            job_title: newJobTitle.trim() || null,
            invited_by: user.id,
          })
          .eq("project_id", projectId)
          .eq("invited_email", normalizedEmail)
          .select("id")
          .maybeSingle();

        if (updateError || !updatedRow) {
          toast.error(updateError?.message || "שגיאה בעדכון חבר צוות קיים");
          console.error(updateError || error);
          return;
        }
      } else {
        toast.error(error.message || "שגיאה בהוספת חבר צוות");
        console.error(error);
        return;
      }
    }

    const { data: savedRow, error: verifyError } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("invited_email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verifyError || !savedRow) {
      toast.error(verifyError?.message || "השורה לא חזרה אחרי השמירה");
      return;
    }

    toast.success(
      members.some((m) => m.invited_email.toLowerCase() === normalizedEmail)
        ? `${normalizedEmail} עודכן בפרויקט`
        : `${normalizedEmail} נוסף לפרויקט`
    );
    setNewEmail("");
    setNewJobTitle("");
    fetchMembers();
  };

  const updateMemberRole = async (id: string, role: string) => {
    const { error } = await supabase
      .from("project_members")
      .update({ role })
      .eq("id", id);

    if (error) {
      toast.error("שגיאה בעדכון תפקיד");
      return;
    }

    setMembers(prev => prev.map(m => (m.id === id ? { ...m, role } : m)));
  };

  const updateJobTitle = async (id: string, job_title: string) => {
    const { error } = await supabase
      .from("project_members")
      .update({ job_title: job_title || null })
      .eq("id", id);

    if (error) {
      toast.error("שגיאה בעדכון");
      return;
    }

    setMembers(prev => prev.map(m => (m.id === id ? { ...m, job_title } : m)));
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("שגיאה בהסרת חבר צוות");
      return;
    }

    setMembers(prev => prev.filter(m => m.id !== id));
    toast.success("חבר הצוות הוסר");
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground p-2">טוען...</p>;
  }

  return (
    <div className="space-y-3 border-t pt-3 mt-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <Label className="font-semibold">חברי צוות ({members.length})</Label>
      </div>

      {/* Add member form - only for owner */}
      {isOwner && (
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex gap-2">
            <Input
              placeholder="email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              dir="ltr"
              className="flex-1"
            />
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">מנהל</SelectItem>
                <SelectItem value="member">חבר צוות</SelectItem>
                <SelectItem value="viewer">צופה</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="תפקיד (לדוגמה: מפתח, מעצב)"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              className="flex-1"
            />
            <Button onClick={addMember} size="sm">
              הוסף
            </Button>
          </div>
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין חברי צוות</p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const RoleIcon = roleIcons[member.role] || UserCheck;
            return (
              <div
                key={member.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <RoleIcon className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {member.invited_display_name || member.invited_username || member.invited_email.split("@")[0]}
                      </span>
                    <span className="text-sm truncate block" dir="ltr">
                      {member.invited_email}
                    </span>
                    {member.job_title && (
                      <span className="text-xs text-muted-foreground">{member.job_title}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {roleLabels[member.role] || member.role}
                  </span>
                  {isOwner && (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(v) => updateMemberRole(member.id, v)}
                      >
                        <SelectTrigger className="h-7 w-20 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">מנהל</SelectItem>
                          <SelectItem value="member">חבר צוות</SelectItem>
                          <SelectItem value="viewer">צופה</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeMember(member.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectMembersPanel;
