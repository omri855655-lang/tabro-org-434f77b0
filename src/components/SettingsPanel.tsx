import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useCustomBoards } from "@/hooks/useCustomBoards";
import { useUserPreferences, DEFAULT_TABS } from "@/hooks/useUserPreferences";
import { useSiteAppearance } from "@/hooks/useSiteAppearance";
import { useLayoutPreference, type LayoutMode } from "@/hooks/useLayoutPreference";
import { useDashboardGroupingAssignments, useDashboardGroupingPreference, type DashboardCategoryKey } from "@/hooks/useDashboardGroupingPreference";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Shield, LayoutGrid, Plus, Trash2, X, Eye, EyeOff, Globe, Palette, Moon, Sun, Key, UserX, Bell, PanelLeft, LayoutList, Columns, Smartphone, Menu, Type, CalendarDays, Recycle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import TelegramSettings from "@/components/TelegramSettings";
import NotificationSettings from "@/components/NotificationSettings";
import RecycleBin from "@/components/RecycleBin";

const ChangePasswordForm = () => {
  const { t } = useLanguage();
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    if (newPw.length < 6) { toast.error(t("passwordMinLength" as any)); return; }
    if (newPw !== confirmPw) { toast.error(t("passwordMismatch" as any)); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) { toast.error(t("error" as any) + ": " + error.message); return; }
    setNewPw(""); setConfirmPw("");
    toast.success(t("passwordChanged" as any));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{t("newPassword" as any)}</Label>
        <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••" dir="ltr" />
      </div>
      <div className="space-y-1">
        <Label>{t("confirmPassword" as any)}</Label>
        <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••" dir="ltr" />
      </div>
      <Button onClick={handleChange} disabled={saving || !newPw}>{saving ? t("changing" as any) : t("changePassword" as any)}</Button>
    </div>
  );
};

const SettingsPanel = () => {
  const { user, signOut } = useAuth();
  const navTo = useNavigate();
  const { toggleTab, isTabVisible } = useUserPreferences();
  const { lang, setLang, t, dir } = useLanguage();
  const { themeId, mode, themes, setThemeId, setMode, fontId, fonts, setFontId, customColors, setCustomColor, resetCustomColors, showHebrewDate, setShowHebrewDate } = useSiteAppearance();
  const { layout, setLayout } = useLayoutPreference();
  const { groupingMode, setGroupingMode } = useDashboardGroupingPreference();
  const { assignments: groupingAssignments, setAssignment, resetAssignments } = useDashboardGroupingAssignments();
  const [pinEnabled, setPinEnabled] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [changingPin, setChangingPin] = useState(false);
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { boards, addBoard, deleteBoard, updateBoard } = useCustomBoards();
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardStatuses, setNewBoardStatuses] = useState(() => (lang === "en" ? "To Do,In Progress,Done" : "לביצוע,בתהליך,הושלם"));
  const [newBoardDashboard, setNewBoardDashboard] = useState(false);
  const [boardTemplate, setBoardTemplate] = useState("custom");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);

  const isEnglish = lang === "en";
  const groupingCopy = isEnglish
    ? {
        title: "Dashboard Navigation",
        desc: "Choose whether dashboards appear as one flat row or organized into expandable categories.",
        flat: "Flat Tabs",
        flatDesc: "Current single-row dashboard tabs",
        grouped: "Grouped Categories",
        groupedDesc: "Expandable dashboard sections by topic",
        assignmentTitle: "Dashboard Categories",
        assignmentDesc: "Choose which category each dashboard belongs to when grouped navigation is enabled.",
        reset: "Reset categories",
      }
    : {
        title: "ניווט דשבורדים",
        desc: "בחר אם הדשבורדים יוצגו בשורה אחת כמו היום או מחולקים לקטגוריות נפתחות.",
        flat: "לשוניות רגילות",
        flatDesc: "השורה הרגילה של כל הדשבורדים",
        grouped: "קטגוריות נפתחות",
        groupedDesc: "קבוצות דשבורדים לפי נושא",
        assignmentTitle: "שיוך דשבורדים לקטגוריות",
        assignmentDesc: "בחר לאיזו קטגוריה כל דשבורד שייך כשהניווט הקטגוריאלי פעיל.",
        reset: "איפוס קטגוריות",
      };

  const categoryLabels: Record<DashboardCategoryKey, string> = isEnglish
    ? {
        focus: "Focus & Planning",
        media: "Library & Learning",
        life: "Life & Wellness",
        money: "Money & Shopping",
        admin: "Admin & Custom",
      }
    : {
        focus: "פוקוס ותכנון",
        media: "ספרייה ולמידה",
        life: "חיים ובריאות",
        money: "כסף וקניות",
        admin: "ניהול והתאמה",
      };

  const categoryTabIds = [
    "dashboard",
    "tasks",
    "work",
    "books",
    "shows",
    "podcasts",
    "routine",
    "projects",
    "courses",
    "planner",
    "zoneflow",
    "challenges",
    "nutrition",
    "dreams",
    "shopping",
    "payments",
    "notes",
    "email",
    "sharing",
    "contact",
    "settings",
  ];

  const getDefaultBoardStatuses = (template: string) => {
    if (isEnglish) {
      if (template === "tasks") return "Not Started,In Progress,Done";
      if (template === "todo") return "To Do,Done";
      if (template === "shopping") return "To Buy,Purchased";
      if (template === "tracking") return "Planned,Active,Completed";
      if (template === "learning-reading") return "To Read,Learning,Completed";
      if (template === "kanban") return "To Do,In Progress,Review,Done";
      return "To Do,In Progress,Done";
    }

    if (template === "tasks") return "טרם החל,בטיפול,בוצע";
    if (template === "todo") return "לביצוע,הושלם";
    if (template === "shopping") return "לקנות,נקנה";
    if (template === "tracking") return "לצפות,צופה,נצפה";
    if (template === "learning-reading") return "לקריאה,בלמידה,הושלם";
    if (template === "kanban") return "לביצוע,בתהליך,בבדיקה,הושלם";
    return "לביצוע,בתהליך,הושלם";
  };

  const getTabLabel = (tabId: string) => {
    const keyMap: Record<string, string> = {
      dashboard: "dashboard",
      tasks: "personalTasks",
      work: "workTasks",
      books: "books",
      shows: "shows",
      podcasts: "podcasts",
      routine: "dailyRoutine",
      projects: "projects",
      courses: "courses",
      planner: "planner",
      zoneflow: "zoneflow",
      nutrition: "nutrition",
      dreams: "dreams",
      shopping: "shopping",
      payments: "payments",
      settings: "settings",
    };

    return t((keyMap[tabId] || tabId) as any);
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("pin_code, pin_enabled, first_name, last_name")
          .eq("user_id", user.id)
          .single();
        if (!cancelled && data) {
          setPinEnabled(data.pin_enabled);
          setHasPin(!!data.pin_code);
          setFirstName(data.first_name || "");
          setLastName(data.last_name || "");
          setNameLoaded(true);
        }
      } catch (e) {
        console.error("Settings profile fetch error:", e);
      }
      if (!cancelled) setLoading(false);
    };
    fetchProfile();
    const timer = setTimeout(() => { if (!cancelled) setLoading(false); }, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [user]);

  const togglePin = async (enabled: boolean) => {
    if (!user) return;
    if (enabled && !hasPin) {
      setChangingPin(true);
      setPinEnabled(true);
      return;
    }
    const { error } = await supabase.from("profiles").update({ pin_enabled: enabled }).eq("user_id", user.id);
    if (error) { toast.error(t("settingsError" as any)); return; }
    setPinEnabled(enabled);
    toast.success(enabled ? t("pinActivated" as any) : t("pinDeactivated" as any));
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const updated = [...newPin];
    updated[index] = digit;
    setNewPin(updated);
    if (digit && index < 3) inputRefs.current[index + 1]?.focus();
    if (digit && index === 3) {
      const fullPin = updated.join("");
      if (fullPin.length === 4) saveNewPin(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !newPin[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const saveNewPin = async (pinCode: string) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ pin_code: pinCode, pin_enabled: true }).eq("user_id", user.id);
    if (error) { toast.error(t("settingsError" as any)); return; }
    setHasPin(true);
    setPinEnabled(true);
    setChangingPin(false);
    setNewPin(["", "", "", ""]);
    toast.success(t("pinUpdated" as any));
  };

  const handleAddBoard = async () => {
    if (!newBoardName.trim()) { toast.error(t("enterName" as any)); return; }
    const statuses = newBoardStatuses.split(",").map(s => s.trim()).filter(Boolean);
    if (statuses.length === 0) { toast.error(t("enterStatus" as any)); return; }
    try {
      await addBoard(newBoardName.trim(), statuses, newBoardDashboard);
      setShowAddBoard(false);
      setNewBoardName("");
      setNewBoardStatuses(getDefaultBoardStatuses("custom"));
      setNewBoardDashboard(false);
      toast.success(t("dashboardAdded" as any));
    } catch {
      toast.error(t("dashboardCreateError" as any));
    }
  };

  const handleDeleteBoard = async (id: string, name: string) => {
    if (!confirm(t("deleteConfirmBoard" as any).replace("{name}", name))) return;
    try {
      await deleteBoard(id);
      toast.success(t("deletedSuccessfully" as any));
    } catch {
      toast.error(t("deleteError2" as any));
    }
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">{t("loading" as any)}</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir={dir}>
      {/* Profile Name Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />{t("personalDetails" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("personalDetailsDesc" as any)}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("firstName" as any)}</Label>
              <Input
                placeholder={t("firstName" as any)}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={async () => {
                  if (!user || !nameLoaded) return;
                  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || null;
                  await supabase.from("profiles").update({ first_name: firstName.trim() || null, display_name: displayName }).eq("user_id", user.id);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("lastName" as any)}</Label>
              <Input
                placeholder={t("lastName" as any)}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={async () => {
                  if (!user || !nameLoaded) return;
                  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || null;
                  await supabase.from("profiles").update({ last_name: lastName.trim() || null, display_name: displayName }).eq("user_id", user.id);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />{t("designAndColors" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("designDesc" as any)}</p>
          <div className="space-y-2">
            <Label>{t("colorScheme" as any)}</Label>
            <Select value={themeId} onValueChange={setThemeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.name} — {theme.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("displayMode" as any)}</Label>
            <div className="flex gap-2">
              <Button type="button" variant={mode === "light" ? "default" : "outline"} className="gap-2" onClick={() => setMode("light")}>
                <Sun className="h-4 w-4" />{t("light" as any)}
              </Button>
              <Button type="button" variant={mode === "dark" ? "default" : "outline"} className="gap-2" onClick={() => setMode("dark")}>
                <Moon className="h-4 w-4" />{t("dark" as any)}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Font Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Type className="h-5 w-5" />{t("font" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("fontDesc" as any)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {fonts.map((font) => (
              <button
                key={font.id}
                onClick={() => setFontId(font.id)}
                className={`p-3 rounded-lg border text-center transition-colors ${fontId === font.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-foreground"}`}
                style={{ fontFamily: font.family }}
              >
                <div className="text-sm font-medium">{font.name}</div>
                <div className="text-xs text-muted-foreground mt-1" style={{ fontFamily: font.family }}>אבגד Abc 123</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Layout Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />{t("interfaceLayout" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("layoutDesc" as any)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {([
              { id: "tabs" as LayoutMode, label: t("layoutTabs" as any), desc: t("layoutTabsDesc" as any), icon: LayoutList },
              { id: "sidebar" as LayoutMode, label: t("layoutSidebar" as any), desc: t("layoutSidebarDesc" as any), icon: PanelLeft },
              { id: "compact" as LayoutMode, label: t("layoutCompact" as any), desc: t("layoutCompactDesc" as any), icon: Columns },
              { id: "bottom-nav" as LayoutMode, label: t("layoutBottomNav" as any), desc: t("layoutBottomNavDesc" as any), icon: Smartphone },
              { id: "hamburger" as LayoutMode, label: t("layoutHamburger" as any), desc: t("layoutHamburgerDesc" as any), icon: Menu },
              { id: "dashboard-cards" as LayoutMode, label: t("layoutCards" as any), desc: t("layoutCardsDesc" as any), icon: LayoutGrid },
              { id: "split-view" as LayoutMode, label: t("layoutSplitView" as any), desc: t("layoutSplitViewDesc" as any), icon: PanelLeft },
            ]).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setLayout(opt.id)}
                  className={`p-3 rounded-lg border text-center transition-colors ${layout === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-foreground"}`}
                >
                  <Icon className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PanelLeft className="h-5 w-5" />{groupingCopy.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{groupingCopy.desc}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "flat" as const, label: groupingCopy.flat, desc: groupingCopy.flatDesc, icon: LayoutList },
              { id: "grouped" as const, label: groupingCopy.grouped, desc: groupingCopy.groupedDesc, icon: PanelLeft },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setGroupingMode(opt.id)}
                  className={`p-3 rounded-lg border text-center transition-colors ${groupingMode === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-foreground"}`}
                >
                  <Icon className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />{groupingCopy.assignmentTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{groupingCopy.assignmentDesc}</p>
            <Button variant="outline" size="sm" onClick={resetAssignments} className="shrink-0 text-xs">
              {groupingCopy.reset}
            </Button>
          </div>
          <div className="space-y-2">
            {categoryTabIds.map((tabId) => (
              <div key={tabId} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-2">
                <span className="text-sm font-medium">{getTabLabel(tabId)}</span>
                <Select
                  value={groupingAssignments[tabId] || ""}
                  onValueChange={(value) => setAssignment(tabId, value as DashboardCategoryKey)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={isEnglish ? "Choose category" : "בחר קטגוריה"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(categoryLabels) as Array<[DashboardCategoryKey, string]>).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Colors Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />{t("customColorsTitle" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("customColorsDesc" as any)}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("primaryColor" as any)}</Label>
              <input type="color" value={customColors.primary || "#3b82f6"} onChange={(e) => setCustomColor("primary", e.target.value)} className="w-full h-9 rounded-md border border-input cursor-pointer" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("backgroundColor" as any)}</Label>
              <input type="color" value={customColors.background || "#f8f9fc"} onChange={(e) => setCustomColor("background", e.target.value)} className="w-full h-9 rounded-md border border-input cursor-pointer" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("cardColor" as any)}</Label>
              <input type="color" value={customColors.card || "#ffffff"} onChange={(e) => setCustomColor("card", e.target.value)} className="w-full h-9 rounded-md border border-input cursor-pointer" />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetCustomColors} className="text-xs">{t("resetToDefault" as any)}</Button>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />{t("security" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">{t("pinCode" as any)}</Label>
              <p className="text-sm text-muted-foreground">{t("pinDescription" as any)}</p>
            </div>
            <Switch checked={pinEnabled} onCheckedChange={togglePin} />
          </div>
          {pinEnabled && (
            <div className="space-y-3 pt-2 border-t">
              {!changingPin ? (
                <Button variant="outline" size="sm" onClick={() => { setChangingPin(true); setNewPin(["","","",""]); setTimeout(() => inputRefs.current[0]?.focus(), 100); }} className="gap-2">
                  <Lock className="h-4 w-4" />{hasPin ? t("changePin" as any) : t("setPin" as any)}
                </Button>
              ) : (
                <div className="space-y-3">
                  <Label>{t("enterNewCode" as any)}</Label>
                  <div className="flex gap-3" dir="ltr">
                    {newPin.map((digit, i) => (
                      <Input key={i} ref={(el) => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handlePinChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} className="w-12 h-12 text-center text-xl font-bold" autoComplete="off" />
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setChangingPin(false); setNewPin(["","","",""]); }}>{t("cancel" as any)}</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />{t("changePasswordTitle" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {/* Delete Account Card */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><UserX className="h-5 w-5" />{t("deleteAccount" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("deleteAccountDesc" as any)}</p>
          <Button
            variant="destructive"
            onClick={async () => {
              if (!confirm(t("deleteConfirmFirst" as any))) return;
              if (!confirm(t("deleteConfirmFinal" as any))) return;
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { toast.error(t("loginRequired" as any)); return; }
                const { error } = await supabase.functions.invoke('delete-account-confirm', {
                  headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (error) throw error;
                toast.success(t("deleteEmailSent" as any));
              } catch {
                toast.error(t("deleteRequestError" as any));
              }
            }}
          >
            {t("deleteMyAccount" as any)}
          </Button>
          <p className="text-xs text-muted-foreground">{t("deleteEmailSentShort" as any)}</p>
        </CardContent>
      </Card>

      {/* Custom Boards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />{t("customListsDashboards" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("customListsDesc" as any)}</p>
          {boards.length > 0 && (
            <div className="space-y-2">
              {boards.map((board) => (
                <div key={board.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      defaultValue={board.name}
                      className="h-8 text-sm font-medium max-w-[200px]"
                      onBlur={(e) => {
                        const newName = e.target.value.trim();
                        if (newName && newName !== board.name) {
                          updateBoard(board.id, { name: newName });
                          toast.success(t("nameChanged" as any));
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                    <span className="text-xs text-muted-foreground">({board.statuses.join(", ")})</span>
                    {board.show_in_dashboard && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{t("displayedInDashboardBadge" as any)}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateBoard(board.id, { show_in_dashboard: !board.show_in_dashboard })}>
                      {board.show_in_dashboard ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteBoard(board.id, board.name)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showAddBoard ? (
            <div className="space-y-3 p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t("newDashboard" as any)}</Label>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowAddBoard(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2">
                <Label>{t("chooseTemplate" as any)}</Label>
                <Select value={boardTemplate} onValueChange={(v) => {
                  setBoardTemplate(v);
                   if (v === "tasks") { setNewBoardStatuses(getDefaultBoardStatuses(v)); setNewBoardDashboard(true); }
                   else if (v === "todo") { setNewBoardStatuses(getDefaultBoardStatuses(v)); setNewBoardDashboard(true); }
                   else if (v === "shopping") { setNewBoardStatuses(getDefaultBoardStatuses(v)); setNewBoardDashboard(false); }
                   else if (v === "tracking") { setNewBoardStatuses(getDefaultBoardStatuses(v)); setNewBoardDashboard(false); }
                   else if (v === "learning-reading") { setNewBoardStatuses(getDefaultBoardStatuses(v)); setNewBoardDashboard(false); }
                   else if (v === "kanban") { setNewBoardStatuses(getDefaultBoardStatuses(v)); setNewBoardDashboard(true); }
                   else { setNewBoardStatuses(getDefaultBoardStatuses(v)); setNewBoardDashboard(false); }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tasks">{t("templateTasks" as any)}</SelectItem>
                    <SelectItem value="todo">{t("templateTodo" as any)}</SelectItem>
                    <SelectItem value="shopping">{t("templateShopping" as any)}</SelectItem>
                    <SelectItem value="tracking">{t("templateTracking" as any)}</SelectItem>
                    <SelectItem value="learning-reading">{t("templateLearning" as any)}</SelectItem>
                    <SelectItem value="kanban">{t("templateKanban" as any)}</SelectItem>
                    <SelectItem value="custom">{t("templateCustom" as any)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("dashboardName" as any)}</Label>
                <Input placeholder={t("dashboardNamePlaceholder" as any)} value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("statuses" as any)}</Label>
                <Input placeholder="To Do, In Progress, Done" value={newBoardStatuses} onChange={(e) => setNewBoardStatuses(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t("statusesDesc" as any)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newBoardDashboard} onCheckedChange={setNewBoardDashboard} />
                <Label>{t("showInMainDashboard" as any)}</Label>
              </div>
              <Button onClick={handleAddBoard} className="w-full gap-2"><Plus className="h-4 w-4" />{t("createCategory" as any)}</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddBoard(true)} className="w-full gap-2"><Plus className="h-4 w-4" />{t("addListDashboard" as any)}</Button>
          )}
        </CardContent>
      </Card>

      {/* Tab Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />{t("tabVisibility" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("tabVisibilityDesc" as any)}</p>
          <div className="space-y-2">
            {DEFAULT_TABS.filter(tab => tab.removable).map((tab) => (
              <div key={tab.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                <span className="text-sm font-medium">{getTabLabel(tab.id)}</span>
                <div className="flex items-center gap-2">
                  {isTabVisible(tab.id) ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  <Switch checked={isTabVisible(tab.id)} onCheckedChange={() => toggleTab(tab.id)} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />{t("notifications" as any)}</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationSettings />
        </CardContent>
      </Card>

      <TelegramSettings />

      {/* Hebrew Date */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />{t("hebrewDate" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("hebrewDateDesc" as any)}</p>
          <div className="flex items-center justify-between">
            <Label>{t("showHebrewDate" as any)}</Label>
            <Switch checked={showHebrewDate} onCheckedChange={setShowHebrewDate} />
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />{t("languageTitle" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("languageChoose" as any)}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant={lang === "he" ? "default" : "outline"} onClick={() => setLang("he")} className="flex-1 min-w-[80px]">עברית</Button>
            <Button variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")} className="flex-1 min-w-[80px]">English</Button>
            <Button variant={lang === "es" ? "default" : "outline"} onClick={() => setLang("es" as any)} className="flex-1 min-w-[80px]">Español</Button>
            <Button variant={lang === "zh" ? "default" : "outline"} onClick={() => setLang("zh" as any)} className="flex-1 min-w-[80px]">中文</Button>
            <Button variant={lang === "ar" ? "default" : "outline"} onClick={() => setLang("ar" as any)} className="flex-1 min-w-[80px]">العربية</Button>
            <Button variant={lang === "ru" ? "default" : "outline"} onClick={() => setLang("ru" as any)} className="flex-1 min-w-[80px]">Русский</Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Hidden ZoneFlow Videos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />{t("resetHiddenVideos" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("resetHiddenVideosDesc" as any)}</p>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem("zoneflow-hidden-yt");
              toast.success(dir === "rtl" ? "סרטונים מוסתרים אופסו" : "Hidden videos reset");
            }}
          >
            {t("resetHiddenVideos" as any)}
          </Button>
        </CardContent>
      </Card>

      <RecycleBin />

      {/* Restart Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />{t("restartGuide" as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("restartGuideDesc" as any)}</p>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem("onboarding-completed");
              localStorage.removeItem("onboarding_completed");
              toast.success(dir === "rtl" ? "המדריך יופעל בכניסה הבאה לאזור האישי" : "Guide will restart on next visit to personal area");
              window.location.reload();
            }}
          >
            {t("restartGuide" as any)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPanel;
