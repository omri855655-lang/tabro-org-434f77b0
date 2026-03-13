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
import { FileSpreadsheet, Moon, Sun, LogOut, BookOpen, Tv, LayoutDashboard, ListTodo, Briefcase, Download, Headphones, CalendarCheck, FolderKanban, GraduationCap, CalendarDays, Focus, Settings, LayoutGrid, Trophy, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface SharedSheet {
  sheet_id: string;
  sheet_name: string;
  owner_email: string;
  permission: string;
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
  const { boards: customBoards, updateBoard } = useCustomBoards();
  const { isTabVisible } = useUserPreferences();
  const { t, dir } = useLanguage();

  // Fetch shared work sheets (where someone shared with me)
  const fetchSharedSheets = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("task_sheet_collaborators")
        .select("sheet_id, permission, invited_email")
        .or(`user_id.eq.${user.id},invited_email.eq.${user.email}`);

      if (error) throw error;
      if (!data || data.length === 0) return;

      // Get the sheet details and owner emails
      const sheetIds = data.map(d => d.sheet_id);
      const { data: sheets, error: sheetsError } = await supabase
        .from("task_sheets")
        .select("id, sheet_name, user_id")
        .in("id", sheetIds);

      if (sheetsError) throw sheetsError;

      // Get owner emails from profiles or just use user_id for now
      const ownerIds = [...new Set(sheets?.map(s => s.user_id).filter(id => id !== user.id) || [])];
      
      // We'll show sheets that are NOT owned by the current user
      const sharedResults: SharedSheet[] = [];
      for (const sheet of sheets || []) {
        if (sheet.user_id === user.id) continue; // Skip own sheets
        const collab = data.find(d => d.sheet_id === sheet.id);
        // Get owner email
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", sheet.user_id)
          .single();
        
        sharedResults.push({
          sheet_id: sheet.id,
          sheet_name: sheet.sheet_name,
          owner_email: ownerProfile?.display_name || sheet.user_id.slice(0, 8),
          permission: collab?.permission || "view",
        });
      }
      setSharedSheets(sharedResults);
    } catch (error) {
      console.error("Error fetching shared sheets:", error);
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
      const tab = STATIC_TABS.find(t => t.id === id);
      if (tab) ordered.push(tab);
    }
    // Add any new tabs not in saved order
    for (const tab of STATIC_TABS) {
      if (!ordered.find(t => t.id === tab.id)) ordered.push(tab);
    }
    return ordered;
  }, [tabOrder]);

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
        <div className="border-b border-border bg-card px-4 flex-shrink-0 overflow-x-auto scrollbar-thin">
          <TabsList className="h-12 bg-transparent w-max min-w-full">
            {orderedTabs.map((tab) => {
              if (tab.visibilityKey && !isTabVisible(tab.visibilityKey)) return null;
              const Icon = tab.icon;
              const label = tab.label === "deeply" ? "Deeply" 
                : tab.label === "challenges" ? (dir === "rtl" ? "אתגרים" : "Challenges")
                : t(tab.label as any);
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
                    const currentIds = orderedTabs.map(t => t.id);
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
                <Briefcase className="h-4 w-4" />
                <span className="max-w-[120px] truncate">עבודה ({shared.owner_email})</span>
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
              title={`משימות עבודה (${shared.owner_email})`}
              taskType="work"
              readOnly={shared.permission === "view"}
              showYearSelector={false}
              fixedSheetName={shared.sheet_name}
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
