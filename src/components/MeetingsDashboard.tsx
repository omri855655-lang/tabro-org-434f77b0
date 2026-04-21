import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, FileText, Sparkles, Download, Mic, CalendarClock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type MeetingRecord = {
  id: string;
  title: string;
  meetingDate: string;
  attendees: string;
  shortSummary: string;
  transcript: string;
  aiSummary: string;
  updatedAt: string;
};

const STORAGE_KEY = "tabro-meetings-dashboard-v1";

const createMeeting = (): MeetingRecord => ({
  id: crypto.randomUUID(),
  title: "",
  meetingDate: new Date().toISOString().slice(0, 16),
  attendees: "",
  shortSummary: "",
  transcript: "",
  aiSummary: "",
  updatedAt: new Date().toISOString(),
});

const loadMeetings = (): MeetingRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const MeetingsDashboard = () => {
  const [meetings, setMeetings] = useState<MeetingRecord[]>(() => loadMeetings());
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const saveMeetings = (next: MeetingRecord[]) => {
    setMeetings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const sortedMeetings = useMemo(
    () => [...meetings].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [meetings]
  );

  const upsertMeeting = (meeting: MeetingRecord) => {
    const updated = { ...meeting, updatedAt: new Date().toISOString() };
    const next = meetings.some((item) => item.id === updated.id)
      ? meetings.map((item) => (item.id === updated.id ? updated : item))
      : [updated, ...meetings];
    saveMeetings(next);
    setSelectedMeeting(updated);
  };

  const deleteMeeting = (id: string) => {
    saveMeetings(meetings.filter((item) => item.id !== id));
    if (selectedMeeting?.id === id) setSelectedMeeting(null);
  };

  const exportMeetingPdf = (meeting: MeetingRecord) => {
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      toast.error("לא ניתן לפתוח חלון ייצוא כרגע");
      return;
    }

    popup.document.write(`
      <html dir="rtl">
        <head>
          <title>${meeting.title || "פגישה"}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; line-height: 1.6; }
            h1, h2 { margin-bottom: 8px; }
            .meta { color: #555; margin-bottom: 24px; }
            .section { margin-bottom: 24px; }
            pre { white-space: pre-wrap; word-break: break-word; background: #f6f6f6; padding: 12px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <h1>${meeting.title || "פגישה ללא כותרת"}</h1>
          <div class="meta">תאריך: ${meeting.meetingDate || "-"} | משתתפים: ${meeting.attendees || "-"}</div>
          <div class="section"><h2>סיכום שיחה</h2><pre>${meeting.shortSummary || "-"}</pre></div>
          <div class="section"><h2>סיכום AI</h2><pre>${meeting.aiSummary || "-"}</pre></div>
          <div class="section"><h2>תמלול / הקלטה מודבקת</h2><pre>${meeting.transcript || "-"}</pre></div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const generateAiSummary = async () => {
    if (!selectedMeeting?.transcript.trim()) {
      toast.error("צריך קודם להדביק תמלול או סיכום שיחה");
      return;
    }

    setAiLoading(true);
    try {
      const prompt = `סכם את הפגישה בצורה מסודרת. החזר: 1) נקודות עיקריות 2) החלטות 3) משימות המשך 4) סיכונים/חוסרים.\n\nכותרת: ${selectedMeeting.title || "פגישה"}\nמשתתפים: ${selectedMeeting.attendees || "-"}\n\nתמלול/סיכום גולמי:\n${selectedMeeting.transcript}`;
      const { data, error } = await supabase.functions.invoke("tabro-ai-agent", {
        body: { message: prompt, source: "meetings-dashboard" },
      });
      if (error) throw error;

      const aiSummary = data?.reply || data?.response || data?.message || "לא התקבל סיכום מה-AI";
      upsertMeeting({ ...selectedMeeting, aiSummary });
      toast.success("סיכום ה-AI עודכן");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "שגיאה ביצירת סיכום AI");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="rounded-2xl border bg-card/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Mic className="h-3.5 w-3.5" />
              דשבורד אופציונלי לפגישות
            </div>
            <div>
              <h2 className="text-2xl font-bold">פגישות, תמלול, סיכום AI ו‑PDF</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                זהו אזור נפרד למי שרוצה לנהל פגישות בתוך Tabro בלי להעמיס על ברירת המחדל. אפשר לשמור סיכומי שיחה, להדביק תמלול, להפיק סיכום AI ולהוציא קובץ PDF מסודר.
              </p>
            </div>
          </div>
          <Button onClick={() => setSelectedMeeting(createMeeting())} className="gap-2">
            <Plus className="h-4 w-4" />
            פגישה חדשה
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">סה״כ פגישות</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold">{meetings.length}</div>
            <CalendarClock className="h-7 w-7 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">עם סיכום AI</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold">{meetings.filter((m) => m.aiSummary.trim()).length}</div>
            <Sparkles className="h-7 w-7 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">עם תמלול / משתתפים</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold">{meetings.filter((m) => m.transcript.trim() || m.attendees.trim()).length}</div>
            <Users className="h-7 w-7 text-primary" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {sortedMeetings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              עדיין אין פגישות שמורות. אפשר להדליק את הדשבורד הזה מההגדרות ולהתחיל לשמור סיכומי שיחה.
            </CardContent>
          </Card>
        ) : (
          sortedMeetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{meeting.title || "פגישה ללא כותרת"}</div>
                  <div className="text-sm text-muted-foreground">
                    תאריך: {meeting.meetingDate ? new Date(meeting.meetingDate).toLocaleString("he-IL") : "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">משתתפים: {meeting.attendees || "-"}</div>
                  <div className="line-clamp-2 text-sm">{meeting.shortSummary || meeting.aiSummary || "אין עדיין סיכום."}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setSelectedMeeting(meeting)}>
                    <FileText className="h-4 w-4" />
                    פתח
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => exportMeetingPdf(meeting)}>
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => deleteMeeting(meeting.id)}>
                    <Trash2 className="h-4 w-4" />
                    מחק
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!selectedMeeting} onOpenChange={(open) => !open && setSelectedMeeting(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" dir="rtl">
          {selectedMeeting && (
            <>
              <DialogHeader>
                <DialogTitle>פרטי פגישה מלאים</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>כותרת פגישה</Label>
                  <Input value={selectedMeeting.title} onChange={(e) => setSelectedMeeting({ ...selectedMeeting, title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>תאריך ושעה</Label>
                  <Input type="datetime-local" value={selectedMeeting.meetingDate} onChange={(e) => setSelectedMeeting({ ...selectedMeeting, meetingDate: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>משתתפים</Label>
                <Input value={selectedMeeting.attendees} onChange={(e) => setSelectedMeeting({ ...selectedMeeting, attendees: e.target.value })} placeholder="לדוגמה: עומרי, יעל, צוות שיווק" />
              </div>

              <div className="space-y-1">
                <Label>סיכום שיחה קצר</Label>
                <Textarea value={selectedMeeting.shortSummary} onChange={(e) => setSelectedMeeting({ ...selectedMeeting, shortSummary: e.target.value })} className="min-h-[110px]" />
              </div>

              <div className="space-y-1">
                <Label>תמלול / הקלטה מודבקת</Label>
                <Textarea value={selectedMeeting.transcript} onChange={(e) => setSelectedMeeting({ ...selectedMeeting, transcript: e.target.value })} className="min-h-[180px]" placeholder="כאן אפשר להדביק תמלול מלא או הערות גולמיות מהפגישה." />
              </div>

              <div className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold">סיכום AI</div>
                    <div className="text-xs text-muted-foreground">ה‑AI יסכם החלטות, משימות המשך ונקודות חשובות מתוך התמלול.</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" disabled={aiLoading} onClick={generateAiSummary}>
                      <Sparkles className="h-4 w-4" />
                      {aiLoading ? "מייצר..." : "הפק סיכום AI"}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => exportMeetingPdf(selectedMeeting)}>
                      <Download className="h-4 w-4" />
                      ייצוא PDF
                    </Button>
                  </div>
                </div>
                <Textarea value={selectedMeeting.aiSummary} onChange={(e) => setSelectedMeeting({ ...selectedMeeting, aiSummary: e.target.value })} className="min-h-[150px]" placeholder="סיכום ה‑AI יופיע כאן, ואפשר גם לערוך אותו ידנית." />
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="ghost" onClick={() => setSelectedMeeting(null)}>סגור</Button>
                <Button onClick={() => upsertMeeting(selectedMeeting)}>שמור פגישה</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeetingsDashboard;
