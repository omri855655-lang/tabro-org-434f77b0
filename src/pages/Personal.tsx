import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCustomBoards } from "@/hooks/useCustomBoards";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useLanguage } from "@/hooks/useLanguage";
import { useSiteAppearance } from "@/hooks/useSiteAppearance";
import { useLayoutPreference } from "@/hooks/useLayoutPreference";
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
import NutritionDashboard from "@/components/dashboards/NutritionDashboard";
import DreamRoadmapDashboard from "@/components/dashboards/DreamRoadmapDashboard";
import ShoppingDashboard from "@/components/dashboards/ShoppingDashboard";
import PaymentDashboard from "@/components/dashboards/PaymentDashboard";
import ContactForm from "@/components/ContactForm";
import NotesDashboard from "@/components/dashboards/NotesDashboard";
import OnboardingWizard from "@/components/OnboardingWizard";
import SidebarLayout from "@/components/layouts/SidebarLayout";
import CompactLayout from "@/components/layouts/CompactLayout";
import BottomNavLayout from "@/components/layouts/BottomNavLayout";
import HamburgerLayout from "@/components/layouts/HamburgerLayout";
import DashboardCardsLayout from "@/components/layouts/DashboardCardsLayout";
import SplitViewLayout from "@/components/layouts/SplitViewLayout";
import { FileSpreadsheet, Moon, Sun, LogOut, BookOpen, Tv, LayoutDashboard, ListTodo, Briefcase, Download, Headphones, CalendarCheck, FolderKanban, GraduationCap, CalendarDays, Focus, Settings, LayoutGrid, Trophy, ChevronLeft, ChevronRight, Share2, Apple, Target, ShoppingCart, CreditCard, MessageSquare, StickyNote } from "lucide-react";
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

const MAIN_SHEET_NAME = "ראשי";

const ALL_SHEETS_VALUE = "הכל";

const getSharedSheetLabel = (shared: SharedSheet) => {
  const taskTypeLabel = shared.task_type === "work" ? "משימות עבודה" : "משימות אישיות";
  if (shared.sheet_name === ALL_SHEETS_VALUE) {
    return `${shared.owner_display_name} - ${taskTypeLabel} (הכל)`;
  }
  return `${shared.owner_display_name} - ${shared.sheet_name === MAIN_SHEET_NAME ? taskTypeLabel : shared.sheet_name}`;
};

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
  { id: "nutrition", icon: Apple, label: "תזונה ושינה", visibilityKey: "nutrition" },
  { id: "dreams", icon: Target, label: "מפת חלומות", visibilityKey: "dreams" },
  { id: "shopping", icon: ShoppingCart, label: "קניות", visibilityKey: "shopping" },
  { id: "payments", icon: CreditCard, label: "הכנסות והוצאות", visibilityKey: "payments" },
  { id: "notes", icon: StickyNote, label: "פתקים", visibilityKey: "notes" },
  { id: "sharing", icon: Share2, label: "שיתופים" },
  { id: "contact", icon: MessageSquare, label: "contactForm" },
  { id: "settings", icon: Settings, label: "settings" },
];

const Personal = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
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
  const { isDark, toggleMode } = useSiteAppearance();
  const { layout } = useLayoutPreference();

  // Fetch shared sheets (where someone shared with me)
  const fetchSharedSheets = useCallback(async () => {
    if (!user) {
      setSharedSheets([]);
      return;
    }

    try {
      const normalizedEmail = (user.email || "").trim().toLowerCase();

      const byUserPromise = supabase
        .from("task_sheet_collaborators")
        .select("sheet_id, permission")
        .eq("user_id", user.id);

      const byEmailPromise = normalizedEmail
        ? supabase
            .from("task_sheet_collaborators")
            .select("sheet_id, permission")
            .eq("invited_email", normalizedEmail)
        : Promise.resolve({ data: [], error: null } as any);

      const [byUserRes, byEmailRes] = await Promise.all([byUserPromise, byEmailPromise]);

      if (byUserRes.error) throw byUserRes.error;
      if (byEmailRes.error) throw byEmailRes.error;

      const mergedCollabs = [...(byUserRes.data || []), ...(byEmailRes.data || [])];
      const data = Array.from(new Map(mergedCollabs.map((row) => [row.sheet_id, row])).values());

      if (data.length === 0) {
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
      const sheetNames = [...new Set((sheets || []).map((s) => s.sheet_name))];
      const taskTypes = [...new Set((sheets || []).map((s) => s.task_type))];
      
      // Fetch owner profiles
      let ownerProfiles: Record<string, { display_name: string | null; email: string }> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, first_name, last_name")
          .in("user_id", ownerIds);
        
        for (const p of profiles || []) {
          const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
          const name = fullName || p.display_name || p.username;
          ownerProfiles[p.user_id] = { 
            display_name: name || null, 
            email: p.username || "" 
          };
        }
      }

      const sharedResults: SharedSheet[] = [];
      for (const sheet of sheets || []) {
        if (sheet.user_id === user.id) continue;

        const collab = data.find((d) => d.sheet_id === sheet.id);
        const ownerInfo = ownerProfiles[sheet.user_id];
        const ownerLabel = ownerInfo?.display_name || ownerInfo?.email || "משתמש";
        sharedResults.push({
          sheet_id: sheet.id,
          sheet_name: sheet.sheet_name,
          owner_id: sheet.user_id,
          owner_email: ownerInfo?.email || "משתמש",
          owner_display_name: ownerLabel,
          permission: collab?.permission || "view",
          task_type: sheet.task_type,
        });
      }

      // If "הכל" is shared from an owner, hide individual sheets from same owner+type
      const allKeys = new Set(
        sharedResults
          .filter(s => s.sheet_name === ALL_SHEETS_VALUE)
          .map(s => `${s.owner_id}:${s.task_type}`)
      );
      const dedupedResults = sharedResults.filter(s => {
        if (s.sheet_name === ALL_SHEETS_VALUE) return true;
        return !allKeys.has(`${s.owner_id}:${s.task_type}`);
      });

      setSharedSheets(dedupedResults);
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

  const handleSignOut = async () => {
    await signOut();
    toast.success(t("signedOutSuccess"));
    navigate("/");
  };

  // Build a unified list of ALL tab IDs (static + shared + custom boards)
  const allTabIds = useMemo(() => {
    // Start with ordered static tabs
    let staticIds: string[];
    if (tabOrder.length === 0) {
      staticIds = STATIC_TABS.map(t => t.id);
    } else {
      const ordered: string[] = [];
      for (const id of tabOrder) {
        if (STATIC_TABS.find(t => t.id === id)) ordered.push(id);
      }
      for (const tab of STATIC_TABS) {
        if (!ordered.includes(tab.id)) ordered.push(tab.id);
      }
      staticIds = ordered;
    }

    // Build full list including shared + custom boards from tabOrder
    const sharedIds = sharedSheets.map(s => `shared-${s.sheet_id}`);
    const boardIds = customBoards.map(b => `board-${b.id}`);
    const dynamicIds = [...sharedIds, ...boardIds];

    // If tabOrder contains dynamic IDs, respect their positions
    if (tabOrder.length > 0) {
      const result: string[] = [];
      for (const id of tabOrder) {
        if (STATIC_TABS.find(t => t.id === id)) result.push(id);
        else if (dynamicIds.includes(id)) result.push(id);
        // skip IDs that no longer exist
      }
      // Add any new dynamic tabs not in saved order
      for (const id of dynamicIds) {
        if (!result.includes(id)) result.push(id);
      }
      // Add any new static tabs not in saved order
      for (const id of staticIds) {
        if (!result.includes(id)) result.push(id);
      }
      return result;
    }

    return [...staticIds, ...dynamicIds];
  }, [tabOrder, sharedSheets, customBoards]);

  // Compute orderedTabs for static tabs rendering only
  const orderedTabs = useMemo(() => {
    return allTabIds
      .map(id => STATIC_TABS.find(t => t.id === id))
      .filter((t): t is TabDef => !!t);
  }, [allTabIds]);

  // Check if a tab ID is currently visible
  const isTabIdVisible = useCallback((tabId: string) => {
    const staticTab = STATIC_TABS.find(t => t.id === tabId);
    if (staticTab) {
      return !staticTab.visibilityKey || isTabVisible(staticTab.visibilityKey);
    }
    return true; // shared sheets and custom boards are always visible
  }, [isTabVisible]);

  const moveActiveTab = useCallback((direction: "left" | "right") => {
    const fromIdx = allTabIds.indexOf(activeTab);
    if (fromIdx === -1) return;

    const step = dir === "rtl"
      ? (direction === "left" ? 1 : -1)
      : (direction === "left" ? -1 : 1);

    let toIdx = fromIdx + step;
    while (toIdx >= 0 && toIdx < allTabIds.length) {
      if (isTabIdVisible(allTabIds[toIdx])) break;
      toIdx += step;
    }

    if (toIdx < 0 || toIdx >= allTabIds.length) return;

    const newOrder = [...allTabIds];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);

    setTabOrder(newOrder);
    localStorage.setItem("tab-order", JSON.stringify(newOrder));
  }, [allTabIds, activeTab, dir, isTabIdVisible]);

  const canMoveActive = useCallback((direction: "left" | "right") => {
    const fromIdx = allTabIds.indexOf(activeTab);
    if (fromIdx === -1) return false;

    const step = dir === "rtl"
      ? (direction === "left" ? 1 : -1)
      : (direction === "left" ? -1 : 1);

    let idx = fromIdx + step;
    while (idx >= 0 && idx < allTabIds.length) {
      if (isTabIdVisible(allTabIds[idx])) return true;
      idx += step;
    }
    return false;
  }, [allTabIds, activeTab, dir, isTabIdVisible]);

  const canMoveActiveLeft = canMoveActive("left");
  const canMoveActiveRight = canMoveActive("right");

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

  const showOnboarding = !localStorage.getItem("tabro_onboarded");

  // Build flat tab items for sidebar/compact layouts
  const flatTabItems = useMemo(() => {
    const items: { id: string; icon: React.ComponentType<{ className?: string }>; label: string }[] = [];
    for (const tabId of allTabIds) {
      const staticTab = STATIC_TABS.find(t => t.id === tabId);
      if (staticTab) {
        if (staticTab.visibilityKey && !isTabVisible(staticTab.visibilityKey)) continue;
        items.push({ id: staticTab.id, icon: staticTab.icon, label: t(staticTab.label as any) });
        continue;
      }
      if (tabId.startsWith("shared-")) {
        const sheetId = tabId.replace("shared-", "");
        const shared = sharedSheets.find(s => s.sheet_id === sheetId);
        if (!shared) continue;
        items.push({
          id: tabId,
          icon: shared.task_type === "work" ? Briefcase : ListTodo,
          label: getSharedSheetLabel(shared),
        });
        continue;
      }
      if (tabId.startsWith("board-")) {
        const boardId = tabId.replace("board-", "");
        const board = customBoards.find(b => b.id === boardId);
        if (!board) continue;
        items.push({ id: tabId, icon: LayoutGrid, label: board.name });
      }
    }
    return items;
  }, [allTabIds, isTabVisible, sharedSheets, customBoards, t]);

  // Render the active content
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard": return <Dashboard />;
      case "tasks": return <TaskSpreadsheetDb title="משימות אישיות" taskType="personal" showYearSelector />;
      case "work": return <TaskSpreadsheetDb title="משימות עבודה" taskType="work" showYearSelector />;
      case "books": return <BooksManager />;
      case "shows": return <ShowsManager />;
      case "podcasts": return <PodcastsManager />;
      case "routine": return <DailyRoutine />;
      case "projects": return <ProjectsManager />;
      case "planner": return <PersonalPlanner />;
      case "courses": return <CoursesManager />;
      case "deeply": return <DeeplyDashboard />;
      case "settings": return <SettingsPanel />;
      case "challenges": return <ChallengesManager />;
      case "nutrition": return <NutritionDashboard />;
      case "dreams": return <DreamRoadmapDashboard />;
      case "shopping": return <ShoppingDashboard />;
      case "payments": return <PaymentDashboard />;
      case "notes": return <NotesDashboard />;
      case "sharing": return <SharingManagement />;
      case "contact": return <ContactForm />;
      default:
        if (activeTab.startsWith("shared-")) {
          const sheetId = activeTab.replace("shared-", "");
          const shared = sharedSheets.find(s => s.sheet_id === sheetId);
          if (!shared) return null;
          return (
            <TaskSpreadsheetDb
              title={getSharedSheetLabel(shared)}
              taskType={shared.task_type as "work" | "personal"}
              readOnly={shared.permission === "view"}
              showYearSelector={false}
              fixedSheetName={shared.sheet_name === ALL_SHEETS_VALUE ? null : shared.sheet_name}
              fixedSheetOwnerId={shared.owner_id}
              ownerDisplayName={shared.owner_display_name}
            />
          );
        }
        if (activeTab.startsWith("board-")) {
          const boardId = activeTab.replace("board-", "");
          const board = customBoards.find(b => b.id === boardId);
          if (!board) return null;
          return (
            <CustomBoardManager
              boardId={board.id}
              boardName={board.name}
              statuses={board.statuses}
              theme={board.theme}
              onThemeChange={(newTheme) => updateBoard(board.id, { theme: newTheme } as any)}
            />
          );
        }
        return null;
    }
  };

  // Header right-side controls
  const headerControls = (
    <div className={`${dir === "rtl" ? "mr-auto" : "ml-auto"} flex items-center gap-2`}>
      <Button variant="outline" size="sm" onClick={() => navigate("/install")} className="gap-2">
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{t("installApp")}</span>
      </Button>
      <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
      <NotificationBell />
      <PushNotificationToggle />
      <Button variant="ghost" size="icon" onClick={toggleMode}>
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={handleSignOut} title="התנתק">
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  );

  const headerLeft = (
    <>
      <span className="text-2xl font-black text-primary tracking-tight">T</span>
      <h1 className="text-xl font-bold text-foreground">{t("personalArea")}</h1>
    </>
  );

  // ---------- SIDEBAR LAYOUT ----------
  if (layout === "sidebar") {
    return (
      <>
        {showOnboarding && <OnboardingWizard onComplete={() => window.location.reload()} />}
        <SidebarLayout
          tabs={flatTabItems}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          dir={dir}
          header={<>{headerLeft}{headerControls}</>}
        >
          <div className="min-h-full pb-8">{renderContent()}</div>
        </SidebarLayout>
        <FloatingMusicMini visible={activeTab !== 'deeply'} onGoToDeeply={() => setActiveTab('deeply')} />
        <AiDailyPlanner />
      </>
    );
  }

  // ---------- COMPACT LAYOUT ----------
  if (layout === "compact") {
    return (
      <>
        {showOnboarding && <OnboardingWizard onComplete={() => window.location.reload()} />}
        <CompactLayout tabs={flatTabItems} activeTab={activeTab} onTabChange={setActiveTab} dir={dir} header={<>{headerLeft}{headerControls}</>}>
          <div className="min-h-full pb-8">{renderContent()}</div>
        </CompactLayout>
        <FloatingMusicMini visible={activeTab !== 'deeply'} onGoToDeeply={() => setActiveTab('deeply')} />
        <AiDailyPlanner />
      </>
    );
  }

  // ---------- BOTTOM NAV LAYOUT ----------
  if (layout === "bottom-nav") {
    return (
      <>
        {showOnboarding && <OnboardingWizard onComplete={() => window.location.reload()} />}
        <BottomNavLayout tabs={flatTabItems} activeTab={activeTab} onTabChange={setActiveTab} dir={dir} header={<>{headerLeft}{headerControls}</>}>
          <div className="min-h-full pb-20">{renderContent()}</div>
        </BottomNavLayout>
        <FloatingMusicMini visible={activeTab !== 'deeply'} onGoToDeeply={() => setActiveTab('deeply')} />
        <AiDailyPlanner />
      </>
    );
  }

  // ---------- HAMBURGER LAYOUT ----------
  if (layout === "hamburger") {
    return (
      <>
        {showOnboarding && <OnboardingWizard onComplete={() => window.location.reload()} />}
        <HamburgerLayout tabs={flatTabItems} activeTab={activeTab} onTabChange={setActiveTab} dir={dir} header={<>{headerControls}</>}>
          <div className="min-h-full pb-8">{renderContent()}</div>
        </HamburgerLayout>
        <FloatingMusicMini visible={activeTab !== 'deeply'} onGoToDeeply={() => setActiveTab('deeply')} />
        <AiDailyPlanner />
      </>
    );
  }

  // ---------- DASHBOARD CARDS LAYOUT ----------
  if (layout === "dashboard-cards") {
    return (
      <>
        {showOnboarding && <OnboardingWizard onComplete={() => window.location.reload()} />}
        <DashboardCardsLayout tabs={flatTabItems} activeTab={activeTab} onTabChange={setActiveTab} dir={dir} header={<>{headerLeft}{headerControls}</>}>
          <div className="min-h-full pb-8">{renderContent()}</div>
        </DashboardCardsLayout>
        <FloatingMusicMini visible={activeTab !== 'deeply'} onGoToDeeply={() => setActiveTab('deeply')} />
        <AiDailyPlanner />
      </>
    );
  }

  // ---------- SPLIT VIEW LAYOUT ----------
  if (layout === "split-view") {
    return (
      <>
        {showOnboarding && <OnboardingWizard onComplete={() => window.location.reload()} />}
        <SplitViewLayout tabs={flatTabItems} activeTab={activeTab} onTabChange={setActiveTab} dir={dir} header={<>{headerLeft}{headerControls}</>}>
          <div className="h-full">{renderContent()}</div>
        </SplitViewLayout>
        <FloatingMusicMini visible={activeTab !== 'deeply'} onGoToDeeply={() => setActiveTab('deeply')} />
        <AiDailyPlanner />
      </>
    );
  }

  // ---------- DEFAULT TABS LAYOUT ----------
  return (
    <>
    {showOnboarding && (
      <OnboardingWizard onComplete={() => window.location.reload()} />
    )}
    <div className={`flex flex-col h-screen bg-background`} dir={dir}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shadow-sm">
        {headerLeft}
        {headerControls}
      </header>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border bg-card px-4 py-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="overflow-x-auto scrollbar-thin flex-1">
              <TabsList className="h-12 bg-transparent w-max min-w-full">
                {allTabIds.map((tabId) => {
                  // Static tab
                  const staticTab = STATIC_TABS.find(t => t.id === tabId);
                  if (staticTab) {
                    if (staticTab.visibilityKey && !isTabVisible(staticTab.visibilityKey)) return null;
                    const Icon = staticTab.icon;
                    const label = t(staticTab.label as any);
                    return (
                      <TabsTrigger
                        key={staticTab.id}
                        value={staticTab.id}
                        className="gap-2 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => {
                          setDraggedTab(staticTab.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!draggedTab || draggedTab === staticTab.id) return;
                          const fromIdx = allTabIds.indexOf(draggedTab);
                          const toIdx = allTabIds.indexOf(staticTab.id);
                          if (fromIdx === -1 || toIdx === -1) return;
                          const newOrder = [...allTabIds];
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
                  }

                  // Shared sheet tab
                  if (tabId.startsWith("shared-")) {
                    const sheetId = tabId.replace("shared-", "");
                    const shared = sharedSheets.find(s => s.sheet_id === sheetId);
                    if (!shared) return null;
                    return (
                      <TabsTrigger key={tabId} value={tabId} className="gap-2 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => { setDraggedTab(tabId); e.dataTransfer.effectAllowed = "move"; }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!draggedTab || draggedTab === tabId) return;
                          const fromIdx = allTabIds.indexOf(draggedTab);
                          const toIdx = allTabIds.indexOf(tabId);
                          if (fromIdx === -1 || toIdx === -1) return;
                          const newOrder = [...allTabIds];
                          newOrder.splice(fromIdx, 1);
                          newOrder.splice(toIdx, 0, draggedTab);
                          setTabOrder(newOrder);
                          localStorage.setItem("tab-order", JSON.stringify(newOrder));
                          setDraggedTab(null);
                        }}
                        onDragEnd={() => setDraggedTab(null)}
                      >
                        {shared.task_type === "work" ? <Briefcase className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
                        <span className="max-w-[220px] truncate">
                          {getSharedSheetLabel(shared)}
                        </span>
                      </TabsTrigger>
                    );
                  }

                  // Custom board tab
                  if (tabId.startsWith("board-")) {
                    const boardId = tabId.replace("board-", "");
                    const board = customBoards.find(b => b.id === boardId);
                    if (!board) return null;
                    return (
                      <TabsTrigger key={tabId} value={tabId} className="gap-2 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => { setDraggedTab(tabId); e.dataTransfer.effectAllowed = "move"; }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!draggedTab || draggedTab === tabId) return;
                          const fromIdx = allTabIds.indexOf(draggedTab);
                          const toIdx = allTabIds.indexOf(tabId);
                          if (fromIdx === -1 || toIdx === -1) return;
                          const newOrder = [...allTabIds];
                          newOrder.splice(fromIdx, 1);
                          newOrder.splice(toIdx, 0, draggedTab);
                          setTabOrder(newOrder);
                          localStorage.setItem("tab-order", JSON.stringify(newOrder));
                          setDraggedTab(null);
                        }}
                        onDragEnd={() => setDraggedTab(null)}
                      >
                        <LayoutGrid className="h-4 w-4" />
                        {board.name}
                      </TabsTrigger>
                    );
                  }

                  return null;
                })}
              </TabsList>
            </div>

            {allTabIds.includes(activeTab) && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveActiveTab("left")}
                  disabled={!canMoveActiveLeft}
                  title="הזז שמאלה"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveActiveTab("right")}
                  disabled={!canMoveActiveRight}
                  title="הזז ימינה"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tab content - rendered via activeTab matching */}
        <div className="flex-1 min-h-0 overflow-auto m-0 p-0">
          {renderContent()}
        </div>
      </Tabs>

      <FloatingMusicMini visible={activeTab !== 'deeply'} onGoToDeeply={() => setActiveTab('deeply')} />
      <AiDailyPlanner />
    </div>
    </>
  );
};

export default Personal;
