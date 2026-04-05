import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useCustomBoards } from "@/hooks/useCustomBoards";
import { useUserPreferences, DEFAULT_TABS } from "@/hooks/useUserPreferences";
import { useSiteAppearance } from "@/hooks/useSiteAppearance";
import { useLayoutPreference, type LayoutMode } from "@/hooks/useLayoutPreference";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Shield, LayoutGrid, Plus, Trash2, X, Eye, EyeOff, Globe, Palette, Moon, Sun, Key, UserX, Bell, PanelLeft, LayoutList, Columns, Smartphone, Menu, Type } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import TelegramSettings from "@/components/TelegramSettings";

const ChangePasswordForm = () => {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    if (newPw.length < 6) { toast.error("סיסמה חייבת להכיל לפחות 6 תווים"); return; }
    if (newPw !== confirmPw) { toast.error("הסיסמאות לא תואמות"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) { toast.error("שגיאה: " + error.message); return; }
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    toast.success("הסיסמה שונתה בהצלחה!");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>סיסמה חדשה</Label>
        <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••" dir="ltr" />
      </div>
      <div className="space-y-1">
        <Label>אימות סיסמה חדשה</Label>
        <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••" dir="ltr" />
      </div>
      <Button onClick={handleChange} disabled={saving || !newPw}>{saving ? "משנה..." : "שנה סיסמה"}</Button>
    </div>
  );
};

const SettingsPanel = () => {
  const { user, signOut } = useAuth();
  const navTo = useNavigate();
  const { toggleTab, isTabVisible } = useUserPreferences();
  const { lang, setLang } = useLanguage();
  const { themeId, mode, themes, setThemeId, setMode, fontId, fonts, setFontId, customColors, setCustomColor, resetCustomColors, showHebrewDate, setShowHebrewDate } = useSiteAppearance();
  const { layout, setLayout } = useLayoutPreference();
  const [pinEnabled, setPinEnabled] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [changingPin, setChangingPin] = useState(false);
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Custom boards
  const { boards, addBoard, deleteBoard, updateBoard } = useCustomBoards();
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardStatuses, setNewBoardStatuses] = useState("לביצוע,בתהליך,הושלם");
  const [newBoardDashboard, setNewBoardDashboard] = useState(false);
  const [boardTemplate, setBoardTemplate] = useState("custom");

  // Profile name fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);

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
    // Safety timeout in case fetch hangs
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
    if (error) { toast.error("שגיאה בעדכון ההגדרות"); return; }
    setPinEnabled(enabled);
    toast.success(enabled ? "קוד גישה הופעל" : "קוד גישה בוטל");
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
    if (error) { toast.error("שגיאה בשמירת הקוד"); return; }
    setHasPin(true);
    setPinEnabled(true);
    setChangingPin(false);
    setNewPin(["", "", "", ""]);
    toast.success("קוד הגישה עודכן בהצלחה!");
  };

  const handleAddBoard = async () => {
    if (!newBoardName.trim()) { toast.error("יש להזין שם"); return; }
    const statuses = newBoardStatuses.split(",").map(s => s.trim()).filter(Boolean);
    if (statuses.length === 0) { toast.error("יש להזין לפחות סטטוס אחד"); return; }
    try {
      await addBoard(newBoardName.trim(), statuses, newBoardDashboard);
      setShowAddBoard(false);
      setNewBoardName("");
      setNewBoardStatuses("לביצוע,בתהליך,הושלם");
      setNewBoardDashboard(false);
      toast.success("הדשבורד נוסף בהצלחה!");
    } catch {
      toast.error("שגיאה ביצירת דשבורד");
    }
  };

  const handleDeleteBoard = async (id: string, name: string) => {
    if (!confirm(`למחוק את "${name}"? כל הפריטים בו יימחקו.`)) return;
    try {
      await deleteBoard(id);
      toast.success("נמחק בהצלחה");
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      {/* Profile Name Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />פרטים אישיים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">השם שלך יוצג בגליונות משותפים כדי שאחרים ידעו מי הוסיף או עדכן משימות.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>שם פרטי</Label>
              <Input
                placeholder="שם פרטי"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={async () => {
                  if (!user || !nameLoaded) return;
                  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || null;
                  await supabase.from("profiles").update({ first_name: firstName.trim() || null, display_name: displayName }).eq("user_id", user.id);
                }}
                dir="rtl"
              />
            </div>
            <div className="space-y-1">
              <Label>שם משפחה</Label>
              <Input
                placeholder="שם משפחה"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={async () => {
                  if (!user || !nameLoaded) return;
                  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || null;
                  await supabase.from("profiles").update({ last_name: lastName.trim() || null, display_name: displayName }).eq("user_id", user.id);
                }}
                dir="rtl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />עיצוב וצבעים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">אפשר לבחור ערכת צבעים לכל האתר ולעבור בין מראה בהיר וכהה — כמו ב-Deeply, אבל לכל המערכת.</p>
          <div className="space-y-2">
            <Label>ערכת צבעים</Label>
            <Select value={themeId} onValueChange={setThemeId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
            <Label>מצב תצוגה</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "light" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setMode("light")}
              >
                <Sun className="h-4 w-4" />
                בהיר
              </Button>
              <Button
                type="button"
                variant={mode === "dark" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setMode("dark")}
              >
                <Moon className="h-4 w-4" />
                כהה
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Font Card - SEPARATE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Type className="h-5 w-5" />גופן</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">בחר את הגופן שמתאים לך. השינוי חל על כל האתר.</p>
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

      {/* Layout Card - SEPARATE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />מבנה ממשק</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">בחר את סגנון הניווט שהכי נוח לך. השינוי מיידי.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {([
              { id: "tabs" as LayoutMode, label: "לשוניות", desc: "סרגל עליון קלאסי", icon: LayoutList },
              { id: "sidebar" as LayoutMode, label: "סרגל צד", desc: "תפריט צד מתקפל", icon: PanelLeft },
              { id: "compact" as LayoutMode, label: "קומפקטי", desc: "תפריטים נפתחים", icon: Columns },
              { id: "bottom-nav" as LayoutMode, label: "סרגל תחתון", desc: "ניווט מסך קטן", icon: Smartphone },
              { id: "hamburger" as LayoutMode, label: "המבורגר", desc: "תפריט נפתח", icon: Menu },
              { id: "dashboard-cards" as LayoutMode, label: "כרטיסיות", desc: "דשבורד ראשי", icon: LayoutGrid },
              { id: "split-view" as LayoutMode, label: "פאנל כפול", desc: "ניווט + תוכן", icon: PanelLeft },
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

      {/* Custom Colors Card - SEPARATE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />התאמת צבעים אישית</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">שנה צבעים ספציפיים לעיצוב הנוכחי. השינויים נשמרים אוטומטית.</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">צבע ראשי</Label>
              <input
                type="color"
                value={customColors.primary || "#3b82f6"}
                onChange={(e) => setCustomColor("primary", e.target.value)}
                className="w-full h-9 rounded-md border border-input cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">צבע רקע</Label>
              <input
                type="color"
                value={customColors.background || "#f8f9fc"}
                onChange={(e) => setCustomColor("background", e.target.value)}
                className="w-full h-9 rounded-md border border-input cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">צבע כרטיס</Label>
              <input
                type="color"
                value={customColors.card || "#ffffff"}
                onChange={(e) => setCustomColor("card", e.target.value)}
                className="w-full h-9 rounded-md border border-input cursor-pointer"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetCustomColors} className="text-xs">
            איפוס לברירת מחדל
          </Button>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />אבטחה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">קוד גישה (PIN)</Label>
              <p className="text-sm text-muted-foreground">דרוש קוד 4 ספרות בכל כניסה לאתר</p>
            </div>
            <Switch checked={pinEnabled} onCheckedChange={togglePin} />
          </div>
          {pinEnabled && (
            <div className="space-y-3 pt-2 border-t">
              {!changingPin ? (
                <Button variant="outline" size="sm" onClick={() => { setChangingPin(true); setNewPin(["","","",""]); setTimeout(() => inputRefs.current[0]?.focus(), 100); }} className="gap-2">
                  <Lock className="h-4 w-4" />{hasPin ? "שנה קוד גישה" : "הגדר קוד גישה"}
                </Button>
              ) : (
                <div className="space-y-3">
                  <Label>הזן קוד חדש:</Label>
                  <div className="flex gap-3" dir="ltr">
                    {newPin.map((digit, i) => (
                      <Input key={i} ref={(el) => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handlePinChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} className="w-12 h-12 text-center text-xl font-bold" autoComplete="off" />
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setChangingPin(false); setNewPin(["","","",""]); }}>ביטול</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />שינוי סיסמה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {/* Delete Account Card */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><UserX className="h-5 w-5" />מחיקת חשבון</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">מחיקת החשבון תסיר את כל הנתונים שלך לצמיתות. פעולה זו אינה ניתנת לביטול.</p>
          <Button
            variant="destructive"
            onClick={async () => {
              if (!confirm("⚠️ פעולה זו תמחק את כל הנתונים שלך לצמיתות. לא ניתן לבטל פעולה זו.\n\nהאם להמשיך?")) return;
              if (!confirm("אישור אחרון - האם אתה בטוח שברצונך למחוק את החשבון? תישלח הודעת אימייל לאישור סופי.")) return;
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { toast.error("יש להתחבר מחדש"); return; }
                const { error } = await supabase.functions.invoke('delete-account-confirm', {
                  headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (error) throw error;
                toast.success("נשלח אימייל אישור מחיקה לכתובת המייל שלך. לחץ על הקישור באימייל כדי לאשר.");
              } catch {
                toast.error("שגיאה בשליחת בקשת מחיקה");
              }
            }}
          >
            מחק את החשבון שלי
          </Button>
          <p className="text-xs text-muted-foreground">לאחר לחיצה, תישלח הודעת אימייל עם קישור אישור. רק לאחר לחיצה על הקישור החשבון יימחק.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />רשימות ודשבורדים מותאמים אישית</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">צור קטגוריות רשימות ודשבורדים מותאמים לעקוב אחר כל דבר שתרצה (למידה, כושר, מתכונים ועוד). הן יופיעו כלשוניות בסרגל העליון.</p>

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
                          toast.success(`שם שונה ל"${newName}"`);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                    <span className="text-xs text-muted-foreground">({board.statuses.join(", ")})</span>
                    {board.show_in_dashboard && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">מוצג בדשבורד</span>
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
                <Label className="text-base font-semibold">דשבורד חדש</Label>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowAddBoard(false)}><X className="h-4 w-4" /></Button>
              </div>

              <div className="space-y-2">
                <Label>בחר תבנית</Label>
                <Select value={boardTemplate} onValueChange={(v) => {
                  setBoardTemplate(v);
                  if (v === "tasks") { setNewBoardStatuses("טרם החל,בטיפול,בוצע"); setNewBoardDashboard(true); }
                  else if (v === "todo") { setNewBoardStatuses("לביצוע,הושלם"); setNewBoardDashboard(true); }
                  else if (v === "shopping") { setNewBoardStatuses("לקנות,נקנה"); setNewBoardDashboard(false); }
                  else if (v === "tracking") { setNewBoardStatuses("לצפות,צופה,נצפה"); setNewBoardDashboard(false); }
                  else if (v === "learning-reading") { setNewBoardStatuses("לקריאה,בלמידה,הושלם"); setNewBoardDashboard(false); }
                  else if (v === "kanban") { setNewBoardStatuses("לביצוע,בתהליך,בבדיקה,הושלם"); setNewBoardDashboard(true); }
                  else { setNewBoardStatuses("לביצוע,בתהליך,הושלם"); setNewBoardDashboard(false); }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tasks">רשימת משימות (כולל דשבורד)</SelectItem>
                    <SelectItem value="todo">רשימת To-Do</SelectItem>
                    <SelectItem value="shopping">רשימת קניות</SelectItem>
                    <SelectItem value="tracking">קטגוריית רשימות</SelectItem>
                    <SelectItem value="learning-reading">רשימת למידה/קריאה</SelectItem>
                    <SelectItem value="kanban">קנבן</SelectItem>
                    <SelectItem value="custom">מותאם אישית</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>שם הדשבורד</Label>
                <Input placeholder='לדוגמה: "לימודים", "כושר", "מתכונים"' value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>סטטוסים (מופרדים בפסיק)</Label>
                <Input placeholder="לביצוע,בתהליך,הושלם" value={newBoardStatuses} onChange={(e) => setNewBoardStatuses(e.target.value)} dir="rtl" />
                <p className="text-xs text-muted-foreground">הסטטוסים שיופיעו בתפריט הבחירה של כל פריט</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newBoardDashboard} onCheckedChange={setNewBoardDashboard} />
                <Label>הצג סיכום בדשבורד הראשי</Label>
              </div>
              <Button onClick={handleAddBoard} className="w-full gap-2"><Plus className="h-4 w-4" />צור קטגוריה</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddBoard(true)} className="w-full gap-2"><Plus className="h-4 w-4" />הוסף קטגוריית רשימות/דשבורד חדש</Button>
          )}
        </CardContent>
      </Card>

      {/* Tab Visibility Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />הצגת לשוניות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">בחר אילו לשוניות יוצגו בסרגל העליון. לשוניות מוסתרות לא יופיעו אבל הנתונים שלהן נשמרים.</p>
          <div className="space-y-2">
            {DEFAULT_TABS.filter(t => t.removable).map((tab) => (
              <div key={tab.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                <span className="text-sm font-medium">{tab.name}</span>
                <div className="flex items-center gap-2">
                  {isTabVisible(tab.id) ? (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Switch
                    checked={isTabVisible(tab.id)}
                    onCheckedChange={() => toggleTab(tab.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />התראות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">בחר אילו התראות תרצה לקבל. שינויים נשמרים מיידית.</p>
          {[
            { key: "email", label: "התראות במייל", desc: "תזכורות, עדכוני משימות ואירועים" },
            { key: "push", label: "התראות Push", desc: "התראות בזמן אמת בדפדפן/מכשיר" },
            { key: "telegram", label: "התראות טלגרם", desc: "סיכום יומי ותזכורות בטלגרם" },
          ].map(n => {
            const storageKey = `notification-${n.key}-enabled`;
            const isEnabled = localStorage.getItem(storageKey) !== "false";
            return (
              <div key={n.key} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">{n.label}</Label>
                  <p className="text-xs text-muted-foreground">{n.desc}</p>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => {
                    localStorage.setItem(storageKey, String(checked));
                    toast.success(checked ? `${n.label} הופעלו` : `${n.label} בוטלו`);
                  }}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Telegram Card */}
      <TelegramSettings />

      {/* Language Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />שפה / Language</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">בחר את שפת הממשק / Choose interface language</p>
          <div className="flex flex-wrap gap-2">
            <Button variant={lang === "he" ? "default" : "outline"} onClick={() => setLang("he")} className="flex-1 min-w-[80px]">עברית</Button>
            <Button variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")} className="flex-1 min-w-[80px]">English</Button>
            <Button variant={lang === "es" ? "default" : "outline"} onClick={() => setLang("es" as any)} className="flex-1 min-w-[80px]">Español</Button>
            <Button variant={lang === "zh" ? "default" : "outline"} onClick={() => setLang("zh" as any)} className="flex-1 min-w-[80px]">中文</Button>
            <Button variant={lang === "ar" ? "default" : "outline"} onClick={() => setLang("ar" as any)} className="flex-1 min-w-[80px]">العربية</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPanel;
