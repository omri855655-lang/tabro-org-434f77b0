import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCustomBoards } from "@/hooks/useCustomBoards";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useLanguage } from "@/hooks/useLanguage";
import TaskSpreadsheetDb from "@/components/TaskSpreadsheetDb";
import BooksManager from "@/components/BooksManager";
import ShowsManager from "@/components/ShowsManager";
import PodcastsManager from "@/components/PodcastsManager";
import ProjectsManager from "@/components/ProjectsManager";
import CoursesManager from "@/components/CoursesManager";
import Dashboard from "@/components/Dashboard";
import DailyRoutine from "@/components/DailyRoutine";
import AiDailyPlanner from "@/components/AiDailyPlanner";
import PersonalPlanner from "@/components/PersonalPlanner";
import DeeplyDashboard from "@/components/deeply/DeeplyDashboard";
import { FloatingMusicMini } from "@/components/deeply/FloatingMusicMini";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import NotificationBell from "@/components/NotificationBell";
import SettingsPanel from "@/components/SettingsPanel";
import CustomBoardManager from "@/components/CustomBoardManager";
import ChallengesManager from "@/components/ChallengesManager";
import SharingManagement from "@/components/SharingManagement";
import { FileSpreadsheet, Moon, Sun, LogOut, BookOpen, Tv, LayoutDashboard, ListTodo, Briefcase, Download, Headphones, CalendarCheck, FolderKanban, GraduationCap, CalendarDays, Focus, Settings, LayoutGrid, Trophy, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface SharedSheet {
  sheet_id: string;
  sheet_name: string;
  owner_id: string;
  owner_email: string;
  owner_display_name: string;
  permission: string;
  task_type: string;
}

interface TabDef {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  visibilityKey?: string;
}

const STATIC_TABS: TabDef[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "dashboard" },
  { id: "tasks", icon: ListTodo, label: "personalTasks", visibilityKey: "tasks" },
  { id: "work", icon: Briefcase, label: "workTasks", visibilityKey: "work" },
  { id: "books", icon: BookOpen, label: "books", visibilityKey: "books" },
  { id: "shows", icon: Tv, label: "shows", visibilityKey: "shows" },
  { id: "podcasts", icon: Headphones, label: "podcasts", visibilityKey: "podcasts" },
  { id: "routine", icon: CalendarCheck, label: "dailyRoutine", visibilityKey: "routine" },
  { id: "projects", icon: FolderKanban, label: "projects", visibilityKey: "projects" },
  { id: "courses", icon: GraduationCap, label: "courses", visibilityKey: "courses" },
  { id: "planner", icon: CalendarDays, label: "planner", visibilityKey: "planner" },
  { id: "deeply", icon: Focus, label: "deeply", visibilityKey: "deeply" },
  { id: "challenges", icon: Trophy, label: "challenges" },
  { id: "sharing", icon: Share2, label: "שיתופים" },
  { id: "settings", icon: Settings, label: "settings" },
];

const Personal = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sharedSheets, setSharedSheets] = useState<SharedSheet[]>([]);
  const [tabOrder, setTabOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("tab-order");
    return saved ? JSON.parse(saved) : [];
  });
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const { boards: customBoards, updateBoard, reorderBoards } = useCustomBoards();
  const { isTabVisible } = useUserPreferences();
  const { t, dir } = useLanguage();

  // Fetch shared sheets (where someone shared with me)
  const fetchSharedSheets = useCallback(async () => {
    if (!user) {
      setSharedSheets([]);
      return;
    }

    try {
      const normalizedEmail = (user.email || "").trim().toLowerCase();
      const { data, error } = await supabase
        .from("task_sheet_collaborators")
        .select("sheet_id, permission")
        .or(`user_id.eq.${user.id},invited_email.eq.${normalizedEmail}`);

      if (error) throw error;
      if (!data || data.length === 0) {
        setSharedSheets([]);
        return;
      }

      const uniqueSheetIds = [...new Set(data.map((d) => d.sheet_id))];
      const { data: sheets, error: sheetsError } = await supabase
        .from("task_sheets")
        .select("id, sheet_name, user_id, task_type")
        .in("id", uniqueSheetIds);

      if (sheetsError) throw sheetsError;

      const ownerIds = [...new Set((sheets || []).filter(s => s.user_id !== user.id).map(s => s.user_id))];
      
      // Fetch owner profiles
      let ownerProfiles: Record<string, { display_name: string | null; email: string }> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", ownerIds);
        
        for (const p of profiles || []) {
          ownerProfiles[p.user_id] = { 
            display_name: p.display_name || p.username || null, 
            email: p.username || "" 
          };
        }
      }

      const sharedResults: SharedSheet[] = [];
      for (const sheet of sheets || []) {
        if (sheet.user_id === user.id) continue;

        const collab = data.find((d) => d.sheet_id === sheet.id);
        const ownerInfo = ownerProfiles[sheet.user_id];
        sharedResults.push({
          sheet_id: sheet.id,
          sheet_name: sheet.sheet_name,
          owner_id: sheet.user_id,
          owner_email: ownerInfo?.email || sheet.user_id.slice(0, 8),
          owner_display_name: ownerInfo?.display_name || ownerInfo?.email || sheet.user_id.slice(0, 8),
          permission: collab?.permission || "view",
          task_type: sheet.task_type,
        });
      }

      setSharedSheets(sharedResults);
    } catch (error) {
      console.error("Error fetching shared sheets:", error);
      setSharedSheets([]);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchSharedSheets();
  }, [user, loading, navigate, fetchSharedSheets]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`shared-sheets-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_sheet_collaborators" },
        () => fetchSharedSheets()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_sheets" },
        () => fetchSharedSheets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSharedSheets]);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success(t("signedOutSuccess"));
    navigate("/");
  };

  // Compute ordered tabs based on saved order
  const orderedTabs = useMemo(() => {
    if (tabOrder.length === 0) return STATIC_TABS;
    const ordered: TabDef[] = [];
    for (const id of tabOrder) {
      const tab = STATIC_TABS.find((t) => t.id === id);
      if (tab) ordered.push(tab);
    }
    // Add any new tabs not in saved order
    for (const tab of STATIC_TABS) {
      if (!ordered.find((t) => t.id === tab.id)) ordered.push(tab);
    }
    return ordered;
  }, [tabOrder]);

  const moveTabInOrder = useCallback((tabId: string, direction: "left" | "right") => {
    const currentIds = orderedTabs.map((t) => t.id);
    const fromIdx = currentIds.indexOf(tabId);
    if (fromIdx === -1) return;

    const step = dir === "rtl"
      ? (direction === "left" ? 1 : -1)
      : (direction === "left" ? -1 : 1);
    const toIdx = fromIdx + step;

    if (toIdx < 0 || toIdx >= currentIds.length) return;

    const newOrder = [...currentIds];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);

    setTabOrder(newOrder);
    localStorage.setItem("tab-order", JSON.stringify(newOrder));
  }, [orderedTabs, dir]);

  const activeTabIndex = orderedTabs.findIndex((tab) => tab.id === activeTab);
  const activeCustomBoardId = activeTab.startsWith("board-") ? activeTab.replace("board-", "") : null;
  const activeCustomBoardIndex = activeCustomBoardId
    ? customBoards.findIndex((board) => board.id === activeCustomBoardId)
    : -1;

  const moveActiveTab = useCallback(async (direction: "left" | "right") => {
    if (activeCustomBoardIndex >= 0) {
      const step = dir === "rtl"
        ? (direction === "left" ? 1 : -1)
        : (direction === "left" ? -1 : 1);
      const toIdx = activeCustomBoardIndex + step;
      if (toIdx < 0 || toIdx >= customBoards.length) return;

      const nextBoards = [...customBoards];
      const [movedBoard] = nextBoards.splice(activeCustomBoardIndex, 1);
      nextBoards.splice(toIdx, 0, movedBoard);

      try {
        await reorderBoards(nextBoards.map((board) => board.id));
      } catch (error) {
        console.error("Error reordering custom boards:", error);
        toast.error("שגיאה בהזזת הרשימה");
      }
      return;
    }

    if (activeTabIndex >= 0) {
      moveTabInOrder(activeTab, direction);
    }
  }, [activeCustomBoardIndex, activeTabIndex, customBoards, reorderBoards, dir, moveTabInOrder, activeTab]);

  const canMoveActiveLeft = activeTabIndex >= 0
    ? (dir === "rtl" ? activeTabIndex < orderedTabs.length - 1 : activeTabIndex > 0)
    : activeCustomBoardIndex >= 0
      ? (dir === "rtl" ? activeCustomBoardIndex < customBoards.length - 1 : activeCustomBoardIndex > 0)
      : false;

  const canMoveActiveRight = activeTabIndex >= 0
    ? (dir === "rtl" ? activeTabIndex > 0 : activeTabIndex < orderedTabs.length - 1)
    : activeCustomBoardIndex >= 0
      ? (dir === "rtl" ? activeCustomBoardIndex > 0 : activeCustomBoardIndex < customBoards.length - 1)
      : false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`flex flex-col h-screen bg-background`} dir={dir}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shadow-sm">
        <FileSpreadsheet className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">{t("personalArea")}</h1>
        <div className={`${dir === "rtl" ? "mr-auto" : "ml-auto"} flex items-center gap-2`}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/install")}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{t("installApp")}</span>
          </Button>
          <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
          <NotificationBell />
          <PushNotificationToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            title="התנתק"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border bg-card px-4 py-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="overflow-x-auto scrollbar-thin flex-1">
              <TabsList className="h-12 bg-transparent w-max min-w-full">
                {orderedTabs.map((tab) => {
                  if (tab.visibilityKey && !isTabVisible(tab.visibilityKey)) return null;
                  const Icon = tab.icon;
                  const label = t(tab.label as any);
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="gap-2 cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={(e) => {
                        setDraggedTab(tab.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!draggedTab || draggedTab === tab.id) return;
                        const currentIds = orderedTabs.map((t) => t.id);
                        const fromIdx = currentIds.indexOf(draggedTab);
                        const toIdx = currentIds.indexOf(tab.id);
                        if (fromIdx === -1 || toIdx === -1) return;
                        const newOrder = [...currentIds];
                        newOrder.splice(fromIdx, 1);
                        newOrder.splice(toIdx, 0, draggedTab);
                        setTabOrder(newOrder);
                        localStorage.setItem("tab-order", JSON.stringify(newOrder));
                        setDraggedTab(null);
                      }}
                      onDragEnd={() => setDraggedTab(null)}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </TabsTrigger>
                  );
                })}
                {sharedSheets.map((shared) => (
                  <TabsTrigger key={`shared-${shared.sheet_id}`} value={`shared-${shared.sheet_id}`} className="gap-2">
                    {shared.task_type === "work" ? <Briefcase className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
                    <span className="max-w-[160px] truncate">
                      {shared.sheet_name} · {shared.owner_display_name}
                    </span>
                  </TabsTrigger>
                ))}
                {customBoards.map((board) => (
                  <TabsTrigger key={`board-${board.id}`} value={`board-${board.id}`} className="gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    {board.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {activeTabIndex >= 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveTabInOrder(activeTab, "left")}
                  disabled={!canMoveActiveLeft}
                  title="הזז שמאלה"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveTabInOrder(activeTab, "right")}
                  disabled={!canMoveActiveRight}
                  title="הזז ימינה"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <TabsContent value="dashboard" className="flex-1 min-h-0 overflow-auto m-0 p-0">
          <Dashboard />
        </TabsContent>

        <TabsContent value="tasks" className="flex-1 min-h-0 overflow-hidden m-0 p-0">
          <TaskSpreadsheetDb
            title="משימות אישיות"
            taskType="personal"
            showYearSelector={true}
          />
        </TabsContent>

        <TabsContent value="work" className="flex-1 min-h-0 overflow-hidden m-0 p-0">
          <TaskSpreadsheetDb
            title="משימות עבודה"
            taskType="work"
            showYearSelector={true}
          />
        </TabsContent>

        {sharedSheets.map((shared) => (
          <TabsContent key={`shared-${shared.sheet_id}`} value={`shared-${shared.sheet_id}`} className="flex-1 min-h-0 overflow-hidden m-0 p-0">
            <TaskSpreadsheetDb
              title={`${shared.task_type === "work" ? "משימות עבודה" : "משימות אישיות"} - ${shared.sheet_name}`}
              taskType={shared.task_type as "work" | "personal"}
              readOnly={shared.permission === "view"}
              showYearSelector={false}
              fixedSheetName={shared.sheet_name}
              fixedSheetOwnerId={shared.owner_id}
              ownerDisplayName={shared.owner_display_name}
            />
          </TabsContent>
        ))}

        <TabsContent value="books" className="flex-1 min-h-0 overflow-hidden m-0 p-0">
          <BooksManager />
        </TabsContent>

        <TabsContent value="shows" className="flex-1 min-h-0 overflow-hidden m-0 p-0">
          <ShowsManager />
        </TabsContent>

        <TabsContent value="podcasts" className="flex-1 min-h-0 overflow-hidden m-0 p-0">
          <PodcastsManager />
        </TabsContent>

        <TabsContent value="routine" className="flex-1 min-h-0 overflow-auto m-0 p-0">
          <DailyRoutine />
        </TabsContent>

        <TabsContent value="projects" className="flex-1 min-h-0 overflow-hidden m-0 p-0">
          <ProjectsManager />
        </TabsContent>

        <TabsContent value="planner" className="flex-1 min-h-0 overflow-hidden m-0 p-0">
          <PersonalPlanner />
        </TabsContent>

        <TabsContent value="courses" className="flex-1 min-h-0 overflow-hidden m-0 p-0">
          <CoursesManager />
        </TabsContent>

        <TabsContent value="deeply" forceMount className="flex-1 min-h-0 overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
          <DeeplyDashboard />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 min-h-0 overflow-auto m-0 p-0">
          <SettingsPanel />
        </TabsContent>

        <TabsContent value="challenges" className="flex-1 min-h-0 overflow-auto m-0 p-0">
          <ChallengesManager />
        </TabsContent>

        <TabsContent value="sharing" className="flex-1 min-h-0 overflow-auto m-0 p-0">
          <SharingManagement />
        </TabsContent>

        {customBoards.map((board) => (
          <TabsContent key={`board-${board.id}`} value={`board-${board.id}`} className="flex-1 min-h-0 overflow-auto m-0 p-0">
            <CustomBoardManager
              boardId={board.id}
              boardName={board.name}
              statuses={board.statuses}
              theme={board.theme}
              onThemeChange={(newTheme) => updateBoard(board.id, { theme: newTheme } as any)}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Floating mini music player */}
      <FloatingMusicMini
        visible={activeTab !== "deeply"}
        onGoToDeeply={() => setActiveTab("deeply")}
      />

      {/* AI Daily Planner floating button */}
      <AiDailyPlanner />
    </div>
  );
};

export default Personal;
