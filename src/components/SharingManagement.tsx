import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Trash2, Mail, Clock, Search, Filter, ArrowUpDown, Share2, History, FolderKanban, FileSpreadsheet } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface CollabRecord {
  id: string;
  sheet_id: string;
  sheet_name: string;
  task_type: string;
  invited_email: string;
  invited_display_name: string | null;
  invited_username: string | null;
  permission: string;
  created_at: string;
}

interface SharedWithMeRecord {
  sheet_id: string;
  sheet_name: string;
  task_type: string;
  owner_display_name: string;
  owner_username: string;
  permission: string;
  created_at: string;
}

interface SharedProjectRecord {
  project_id: string;
  project_title: string;
  role: string;
  invited_by_name: string;
  created_at: string;
}

interface ActivityRecord {
  id: string;
  action: string;
  target_email: string | null;
  target_display_name: string | null;
  sheet_name: string | null;
  task_type: string | null;
  details: string | null;
  created_at: string;
  user_id: string;
}

const ACTION_LABELS: Record<string, string> = {
  added_collaborator: "הוסף שותף",
  removed_collaborator: "הוסר שותף",
  updated_permission: "עודכנה הרשאה",
};

const SharingManagement = () => {
  const { user } = useAuth();
  const [collabs, setCollabs] = useState<CollabRecord[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedWithMeRecord[]>([]);
  const [sharedProjects, setSharedProjects] = useState<SharedProjectRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "sheet">("date");

  const fetchAllCollaborators = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get all sheets owned by user
    const { data: sheets } = await supabase
      .from("task_sheets")
      .select("id, sheet_name, task_type")
      .eq("user_id", user.id);

    if (!sheets || sheets.length === 0) {
      setCollabs([]);
      setLoading(false);
      return;
    }

    const sheetIds = sheets.map(s => s.id);
    const sheetMap = Object.fromEntries(sheets.map(s => [s.id, s]));

    // Get all collaborators for these sheets
    const { data: collabData } = await supabase
      .from("task_sheet_collaborators")
      .select("id, sheet_id, invited_email, invited_display_name, invited_username, permission, created_at")
      .in("sheet_id", sheetIds)
      .order("created_at", { ascending: false });

    const mapped: CollabRecord[] = (collabData || []).map(c => ({
      ...c,
      sheet_name: sheetMap[c.sheet_id]?.sheet_name || "?",
      task_type: sheetMap[c.sheet_id]?.task_type || "?",
    }));

    setCollabs(mapped);
    setLoading(false);
  }, [user]);

  const fetchSharedWithMe = useCallback(async () => {
    if (!user) return;

    const normalizedEmail = (user.email || "").trim().toLowerCase();

    // Get collaborator entries for me
    const [byUser, byEmail] = await Promise.all([
      supabase.from("task_sheet_collaborators").select("sheet_id, permission, created_at").eq("user_id", user.id),
      normalizedEmail ? supabase.from("task_sheet_collaborators").select("sheet_id, permission, created_at").eq("invited_email", normalizedEmail) : Promise.resolve({ data: [], error: null } as any),
    ]);

    const merged = [...(byUser.data || []), ...(byEmail.data || [])];
    const unique = Array.from(new Map(merged.map(r => [r.sheet_id, r])).values());

    if (unique.length === 0) {
      setSharedWithMe([]);
      return;
    }

    const sheetIds = unique.map(u => u.sheet_id);
    const { data: sheets } = await supabase.from("task_sheets").select("id, sheet_name, user_id, task_type").in("id", sheetIds);

    const ownerIds = [...new Set((sheets || []).filter(s => s.user_id !== user.id).map(s => s.user_id))];
    const sheetNames = [...new Set((sheets || []).map((s) => s.sheet_name))];
    const taskTypes = [...new Set((sheets || []).map((s) => s.task_type))];
    let ownerProfiles: Record<string, { display_name: string; username: string }> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, username, first_name, last_name").in("user_id", ownerIds);
      for (const p of profiles || []) {
        const name = p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || "משתמש";
        ownerProfiles[p.user_id] = { display_name: name, username: p.username || "" };
      }
    }

    const ownerNamesBySheetKey: Record<string, string> = {};
    if (ownerIds.length > 0 && sheetNames.length > 0 && taskTypes.length > 0) {
      const { data: taskNameRows } = await supabase
        .from("tasks")
        .select("user_id, task_type, sheet_name, creator_user_id, creator_name, creator_email")
        .in("user_id", ownerIds)
        .in("sheet_name", sheetNames)
        .in("task_type", taskTypes)
        .order("created_at", { ascending: true });

      for (const row of taskNameRows || []) {
        if (row.creator_user_id !== row.user_id) continue;
        const key = `${row.user_id}:${row.task_type}:${row.sheet_name || ""}`;
        if (!ownerNamesBySheetKey[key]) {
          ownerNamesBySheetKey[key] = row.creator_name || row.creator_email || "";
        }
      }
    }

    const results: SharedWithMeRecord[] = [];
    for (const sheet of sheets || []) {
      if (sheet.user_id === user.id) continue;
      const collab = unique.find(u => u.sheet_id === sheet.id);
      const owner = ownerProfiles[sheet.user_id];
      const ownerLabel = ownerNamesBySheetKey[`${sheet.user_id}:${sheet.task_type}:${sheet.sheet_name}`] || owner?.display_name || "משתמש";
      results.push({
        sheet_id: sheet.id,
        sheet_name: sheet.sheet_name,
        task_type: sheet.task_type,
        owner_display_name: ownerLabel,
        owner_username: owner?.username || "",
        permission: collab?.permission || "view",
        created_at: collab?.created_at || "",
      });
    }

    setSharedWithMe(results);
  }, [user]);

  const fetchSharedProjects = useCallback(async () => {
    if (!user) return;

    const normalizedEmail = (user.email || "").trim().toLowerCase();

    // Get project memberships
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id, role, invited_by, created_at")
      .or(`user_id.eq.${user.id},invited_email.eq.${normalizedEmail}`);

    if (!memberships || memberships.length === 0) {
      setSharedProjects([]);
      return;
    }

    const projectIds = [...new Set(memberships.map(m => m.project_id))];
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, user_id")
      .in("id", projectIds);

    // Only show projects NOT owned by me
    const sharedProjs = (projects || []).filter(p => p.user_id !== user.id);

    const inviterIds = [...new Set(memberships.filter(m => m.invited_by !== user.id).map(m => m.invited_by))];
    let inviterProfiles: Record<string, string> = {};
    if (inviterIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, username, first_name, last_name").in("user_id", inviterIds);
      for (const p of profiles || []) {
        inviterProfiles[p.user_id] = p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || "משתמש";
      }
    }

    const results: SharedProjectRecord[] = sharedProjs.map(proj => {
      const membership = memberships.find(m => m.project_id === proj.id);
      return {
        project_id: proj.id,
        project_title: proj.title,
        role: membership?.role || "member",
        invited_by_name: inviterProfiles[membership?.invited_by || ""] || "משתמש",
        created_at: membership?.created_at || "",
      };
    });

    setSharedProjects(results);
  }, [user]);

  const fetchActivities = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("sharing_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    setActivities((data || []) as ActivityRecord[]);
  }, [user]);

  useEffect(() => {
    fetchAllCollaborators();
    fetchSharedWithMe();
    fetchSharedProjects();
    fetchActivities();
  }, [fetchAllCollaborators, fetchSharedWithMe, fetchSharedProjects, fetchActivities]);

  const removeCollaborator = async (id: string) => {
    const collab = collabs.find(c => c.id === id);
    const { error } = await supabase
      .from("task_sheet_collaborators")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("שגיאה בהסרת שותף");
      return;
    }

    if (collab && user) {
      await supabase.from("sharing_activity_log").insert({
        user_id: user.id,
        action: "removed_collaborator",
        target_email: collab.invited_email,
        sheet_name: collab.sheet_name,
        task_type: collab.task_type,
        details: `הוסר: ${collab.invited_email} מ-${collab.sheet_name}`,
      });
    }

    setCollabs(prev => prev.filter(c => c.id !== id));
    toast.success("השותף הוסר");
    fetchActivities();
  };

  const updatePermission = async (id: string, newPerm: string) => {
    const { error } = await supabase
      .from("task_sheet_collaborators")
      .update({ permission: newPerm })
      .eq("id", id);

    if (error) {
      toast.error("שגיאה בעדכון הרשאה");
      return;
    }

    const collab = collabs.find(c => c.id === id);
    if (collab && user) {
      await supabase.from("sharing_activity_log").insert({
        user_id: user.id,
        action: "updated_permission",
        target_email: collab.invited_email,
        sheet_name: collab.sheet_name,
        task_type: collab.task_type,
        details: `הרשאה עודכנה ל-${newPerm}: ${collab.invited_email} ב-${collab.sheet_name}`,
      });
    }

    setCollabs(prev => prev.map(c => c.id === id ? { ...c, permission: newPerm } : c));
    toast.success("ההרשאה עודכנה");
    fetchActivities();
  };

  // Filter and sort collaborators
  const filteredCollabs = collabs
    .filter(c => {
      if (filterType !== "all" && c.task_type !== filterType) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          c.invited_email.toLowerCase().includes(term) ||
          (c.invited_display_name || "").toLowerCase().includes(term) ||
          c.sheet_name.toLowerCase().includes(term)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return (a.invited_display_name || a.invited_email).localeCompare(b.invited_display_name || b.invited_email);
      if (sortBy === "sheet") return a.sheet_name.localeCompare(b.sheet_name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Group by person
  const groupedByPerson = filteredCollabs.reduce((acc, c) => {
    const key = c.invited_email;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<string, CollabRecord[]>);

  const ROLE_LABELS: Record<string, string> = {
    manager: "מנהל",
    member: "חבר",
    viewer: "צופה",
  };

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3">
        <Share2 className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">ניהול שיתופים</h2>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Users className="h-4 w-4" />
            שיתפתי
          </TabsTrigger>
          <TabsTrigger value="shared-with-me" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            שותף איתי
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <History className="h-4 w-4" />
            לוג פעילות
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חפש לפי שם, אימייל או גליון..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36">
                <Filter className="h-4 w-4 ml-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="work">עבודה</SelectItem>
                <SelectItem value="personal">אישי</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-36">
                <ArrowUpDown className="h-4 w-4 ml-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">לפי תאריך</SelectItem>
                <SelectItem value="name">לפי שם</SelectItem>
                <SelectItem value="sheet">לפי גליון</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center py-8">טוען...</p>
          ) : Object.keys(groupedByPerson).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>אין שיתופים פעילים</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByPerson).map(([email, records]) => (
                <div key={email} className="border border-border rounded-lg bg-card overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border-b border-border">
                    <Mail className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {records[0].invited_display_name || email.split("@")[0]}
                      </div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        @{records[0].invited_username || email.split("@")[0]} · {email}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {records.length} גליונות
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {records.map((rec) => (
                      <div key={rec.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="flex items-center gap-2 text-sm min-w-0">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rec.task_type === "work" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}>
                            {rec.task_type === "work" ? "עבודה" : "אישי"}
                          </span>
                          <span className="truncate">{rec.sheet_name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Select
                            value={rec.permission}
                            onValueChange={(v) => updatePermission(rec.id, v)}
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
                            onClick={() => removeCollaborator(rec.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shared-with-me" className="space-y-6">
          {/* Sheets shared with me */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              גליונות ששותפו איתי
            </h3>
            {sharedWithMe.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">אין גליונות ששותפו איתך</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sharedWithMe.map((s) => (
                  <div key={s.sheet_id} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.task_type === "work" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}>
                        {s.task_type === "work" ? "עבודה" : "אישי"}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{s.sheet_name}</div>
                        <div className="text-xs text-muted-foreground">
                          משותף מ: {s.owner_display_name}
                          {s.owner_username && <span dir="ltr"> @{s.owner_username}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.permission === "edit" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {s.permission === "edit" ? "עריכה" : "צפייה"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Projects shared with me */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              פרויקטים משותפים
            </h3>
            {sharedProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderKanban className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">אין פרויקטים משותפים</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sharedProjects.map((p) => (
                  <div key={p.project_id} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.project_title}</div>
                      <div className="text-xs text-muted-foreground">
                        שותף ע״י: {p.invited_by_name}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {ROLE_LABELS[p.role] || p.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>אין פעילות שיתוף עדיין</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                    act.action === "added_collaborator" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                    act.action === "removed_collaborator" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {act.action === "removed_collaborator" ? <Trash2 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {ACTION_LABELS[act.action] || act.action}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {act.target_email && <span dir="ltr">{act.target_email}</span>}
                      {act.sheet_name && <span> · גליון: {act.sheet_name}</span>}
                      {act.task_type && <span> ({act.task_type === "work" ? "עבודה" : "אישי"})</span>}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                    {format(new Date(act.created_at), "dd/MM HH:mm", { locale: he })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SharingManagement;
