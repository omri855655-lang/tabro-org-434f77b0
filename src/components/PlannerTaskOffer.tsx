import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { CustomBoard } from "@/hooks/useCustomBoards";
import { createPlannerTask, type PlannerTaskDestination } from "@/lib/plannerTaskCreation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PlannerTaskOffer({ event, userId, boards, onClose, onLinked }: {
  event: CalendarEvent;
  userId: string;
  boards: CustomBoard[];
  onClose: () => void;
  onLinked: () => void;
}) {
  const [destination, setDestination] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    void supabase.from("projects").select("id,title").eq("user_id", userId).order("title").then(({ data }) => {
      if (active && data) setProjects(data);
    });
    return () => { active = false; };
  }, [userId]);

  const save = async () => {
    if (busy.current || !destination) return;
    let target: PlannerTaskDestination;
    if (destination === "personal" || destination === "work") target = { type: destination };
    else if (destination.startsWith("board:")) {
      const board = boards.find(item => item.id === destination.slice(6));
      if (!board) return;
      target = { type: "board", id: board.id, status: board.statuses[0] || "לביצוע" };
    } else {
      const project = projects.find(item => item.id === destination.slice(8));
      if (!project) return;
      target = { type: "project", id: project.id };
    }
    busy.current = true;
    setSaving(true);
    setAttempted(true);
    try {
      const link = await createPlannerTask(supabase, event, userId, target);
      setTaskCreated(true);
      const { data, error } = await supabase.from("calendar_events")
        .update({ source_id: link.sourceId, source_type: link.sourceType })
        .eq("id", event.id).eq("user_id", userId).is("source_id", null).select("id");
      if (error || !data?.length) {
        const existing = await supabase.from("calendar_events").select("source_id,source_type")
          .eq("id", event.id).eq("user_id", userId).maybeSingle();
        if (existing.error || existing.data?.source_id !== link.sourceId || existing.data?.source_type !== link.sourceType) {
          throw error || new Error("Event link not saved");
        }
      }
      toast.success("המשימה נוספה ללוח שבחרת וקושרה לאירוע");
      onLinked();
      onClose();
    } catch {
      toast.error("לא הושלמה הפעולה. האירוע נשאר ביומן; אפשר לנסות שוב בלי ליצור עותק נוסף באותו לוח.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return <Dialog open onOpenChange={open => { if (!open && !busy.current) onClose(); }}>
    <DialogContent dir="rtl">
      <DialogHeader>
        <DialogTitle>להוסיף גם למשימות?</DialogTitle>
        <DialogDescription>האירוע נשמר ביומן. אפשר להוסיף משימה אחת ללוח שלך, או להשאיר אותו ביומן בלבד.</DialogDescription>
      </DialogHeader>
      <p className="font-medium break-words">{event.title}</p>
      <p className="text-sm text-muted-foreground">{format(new Date(event.startTime), "dd/MM/yyyy HH:mm")} · מועד סיום: {format(new Date(event.endTime), "dd/MM/yyyy HH:mm")}</p>
      <Select value={destination} onValueChange={setDestination} disabled={attempted}>
        <SelectTrigger aria-label="לוח יעד למשימה"><SelectValue placeholder="בחר לאיזה לוח להוסיף" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="personal">משימות אישיות</SelectItem>
          <SelectItem value="work">משימות עבודה</SelectItem>
          {boards.map(board => <SelectItem key={board.id} value={`board:${board.id}`}>{board.name}</SelectItem>)}
          {projects.map(project => <SelectItem key={project.id} value={`project:${project.id}`}>פרויקט: {project.title}</SelectItem>)}
        </SelectContent>
      </Select>
      {taskCreated && <p role="status" className="text-sm">המשימה כבר נשמרה בלוח. ניסיון חוזר ישלים רק את הקישור לאירוע.</p>}
      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={saving} onClick={onClose}>{taskCreated ? "סגירה" : "לא עכשיו"}</Button>
        <Button disabled={saving || !destination} onClick={() => void save()}>{saving ? "שומר..." : attempted ? "נסה שוב באותו לוח" : "הוסף משימה"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
