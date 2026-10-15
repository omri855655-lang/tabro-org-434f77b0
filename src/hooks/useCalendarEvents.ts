import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  color: string;
  location?: string;
  meetingUrl?: string;
  recurrenceRule?: "daily" | "weekly" | "monthly" | null;
  recurrenceGroupId?: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
  invitationStatus?: "pending" | "accepted" | "declined" | null;
  invitationId?: string | null;
  isInvited?: boolean;
}

interface DbCalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color: string | null;
  location: string | null;
  meeting_url: string | null;
  recurrence_rule: string | null;
  recurrence_group_id: string | null;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  "משימה": "#3b82f6",
  "פגישה": "#ef4444",
  "הליכה": "#22c55e",
  "אישי": "#a855f7",
  "עבודה": "#f97316",
  "פרויקט": "#06b6d4",
  "לימודים": "#eab308",
  "אחר": "#6b7280",
};

export const getCategoryColor = (category: string): string => {
  return DEFAULT_CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLORS["אחר"];
};

export const CATEGORIES = Object.keys(DEFAULT_CATEGORY_COLORS);

const normalizeEventDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const mapDbToEvent = (db: DbCalendarEvent, invitation?: { id: string; status: string } | null): CalendarEvent | null => {
  const startTime = normalizeEventDate(db.start_time);
  const endTime = normalizeEventDate(db.end_time);
  if (!db.id || !startTime || !endTime || new Date(endTime) <= new Date(startTime)) {
    console.warn("Skipping malformed calendar event", db.id);
    return null;
  }
  const category = db.category || "משימה";
  return {
    id: db.id,
    userId: db.user_id,
    title: String(db.title || "אירוע ללא כותרת"),
    description: db.description || "",
    category,
    startTime,
    endTime,
    allDay: db.all_day || false,
    color: db.color || getCategoryColor(category),
    location: db.location || "",
    meetingUrl: db.meeting_url || "",
    recurrenceRule: db.recurrence_rule as CalendarEvent["recurrenceRule"],
    recurrenceGroupId: db.recurrence_group_id,
    sourceType: db.source_type,
    sourceId: db.source_id,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    invitationStatus: invitation ? (invitation.status as "pending" | "accepted" | "declined") : null,
    invitationId: invitation?.id || null,
    isInvited: !!invitation,
  };
};

const compactEvents = (events: Array<CalendarEvent | null>) => events.filter((event): event is CalendarEvent => Boolean(event));

export function useCalendarEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch own events
      const { data: ownData, error: ownError } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: true });

      if (ownError) throw ownError;
      const ownEvents = compactEvents((ownData as unknown as DbCalendarEvent[]).map(e => mapDbToEvent(e)));

      // Fetch invitations for this user — use separate queries for reliable filtering
      let allInvitations: any[] = [];
      
      // By user_id
      const { data: invByUserId } = await supabase
        .from("event_invitations")
        .select("id, event_id, status, invitee_email, invitee_user_id")
        .eq("invitee_user_id", user.id);
      if (invByUserId) allInvitations.push(...invByUserId);
      
      // By email (if user has email and not already covered)
      if (user.email) {
        const { data: invByEmail } = await supabase
          .from("event_invitations")
          .select("id, event_id, status, invitee_email, invitee_user_id")
          .ilike("invitee_email", user.email);
        if (invByEmail) {
          const existingIds = new Set(allInvitations.map(i => i.id));
          for (const inv of invByEmail) {
            if (!existingIds.has(inv.id)) allInvitations.push(inv);
          }
        }
      }
      const invitations = allInvitations;

      // Fetch invited events (RLS now allows this)
      const invitedEventIds = (invitations || [])
        .filter(inv => inv.status !== "declined")
        .map(inv => inv.event_id)
        .filter(id => !ownEvents.some(e => e.id === id));

      let invitedEvents: CalendarEvent[] = [];
      if (invitedEventIds.length > 0) {
        const { data: invData } = await supabase
          .from("calendar_events")
          .select("*")
          .in("id", invitedEventIds);

        if (invData) {
          invitedEvents = compactEvents((invData as unknown as DbCalendarEvent[]).map(e => {
            const inv = (invitations || []).find(i => i.event_id === e.id);
            return mapDbToEvent(e, inv ? { id: inv.id, status: inv.status } : null);
          }));
        }
      }

      setEvents([...ownEvents, ...invitedEvents]);
    } catch (error: any) {
      console.error("Error fetching calendar events:", error);
      toast.error("שגיאה בטעינת אירועי לוח שנה");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime subscription for immediate updates
  useEffect(() => {
    if (!user) return;

    const scheduleRefresh = () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;
        void fetchEvents();
      }, 180);
    };

    const channel = supabase
      .channel(`calendar-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_invitations' },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user, fetchEvents]);

  const addEvent = useCallback(async (event: Partial<CalendarEvent>): Promise<CalendarEvent | null> => {
    if (!user) return null;
    const startTime = normalizeEventDate(event.startTime);
    const endTime = normalizeEventDate(event.endTime);
    if (!startTime || !endTime || new Date(endTime) <= new Date(startTime)) {
      toast.error("זמן האירוע אינו תקין");
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .insert([{
          user_id: user.id,
          title: event.title || "",
          description: event.description || null,
          category: event.category || "משימה",
          start_time: startTime,
          end_time: endTime,
          all_day: event.allDay || false,
          color: event.color || getCategoryColor(event.category || "משימה"),
          location: event.location || null,
          meeting_url: event.meetingUrl || null,
          recurrence_rule: event.recurrenceRule || null,
          recurrence_group_id: event.recurrenceGroupId || null,
          source_type: event.sourceType || "custom",
          source_id: event.sourceId || null,
        }])
        .select()
        .single();

      if (error) throw error;
      const newEvent = mapDbToEvent(data as unknown as DbCalendarEvent);
      if (!newEvent) throw new Error("Saved event returned invalid dates");
      setEvents((prev) => [...prev.filter((existing) => existing.id !== newEvent.id), newEvent]);
      return newEvent;
    } catch (error: any) {
      console.error("Error adding calendar event:", error);
      toast.error("שגיאה בהוספת אירוע");
      return null;
    }
  }, [user]);

  const addEventSeries = useCallback(async (
    event: Partial<CalendarEvent>,
    recurrenceRule: "daily" | "weekly" | "monthly",
    occurrenceCount: number,
  ): Promise<CalendarEvent | null> => {
    if (!user) return null;
    const startTime = normalizeEventDate(event.startTime);
    const endTime = normalizeEventDate(event.endTime);
    if (!startTime || !endTime || new Date(endTime) <= new Date(startTime)) {
      toast.error("זמן האירוע אינו תקין");
      return null;
    }

    const groupId = crypto.randomUUID();
    const initialStart = new Date(startTime);
    const duration = new Date(endTime).getTime() - initialStart.getTime();
    const rows = Array.from({ length: Math.max(1, occurrenceCount) }, (_, index) => {
      const occurrenceStart = new Date(initialStart);
      if (recurrenceRule === "daily") occurrenceStart.setDate(occurrenceStart.getDate() + index);
      if (recurrenceRule === "weekly") occurrenceStart.setDate(occurrenceStart.getDate() + (index * 7));
      if (recurrenceRule === "monthly") occurrenceStart.setMonth(occurrenceStart.getMonth() + index);
      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
      return {
        user_id: user.id,
        title: event.title || "",
        description: event.description || null,
        category: event.category || "משימה",
        start_time: occurrenceStart.toISOString(),
        end_time: occurrenceEnd.toISOString(),
        all_day: event.allDay || false,
        color: event.color || getCategoryColor(event.category || "משימה"),
        location: event.location || null,
        meeting_url: event.meetingUrl || null,
        recurrence_rule: recurrenceRule,
        recurrence_group_id: groupId,
        source_type: event.sourceType || "custom",
        source_id: event.sourceId || null,
      };
    });

    try {
      const { data, error } = await supabase.from("calendar_events").insert(rows).select();
      if (error) throw error;
      const savedEvents = compactEvents((data as unknown as DbCalendarEvent[]).map((row) => mapDbToEvent(row)));
      setEvents((previous) => [
        ...previous.filter((existing) => !savedEvents.some((saved) => saved.id === existing.id)),
        ...savedEvents,
      ]);
      return savedEvents[0] || null;
    } catch (error) {
      console.error("Error adding recurring calendar events:", error);
      toast.error("שגיאה ביצירת סדרת האירועים");
      return null;
    }
  }, [user]);

  const updateEvent = useCallback(async (eventId: string, updates: Partial<CalendarEvent>) => {
    if (!user) return false;

    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description || null;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.startTime !== undefined) {
      const normalized = normalizeEventDate(updates.startTime);
      if (!normalized) return false;
      dbUpdates.start_time = normalized;
      updates = { ...updates, startTime: normalized };
    }
    if (updates.endTime !== undefined) {
      const normalized = normalizeEventDate(updates.endTime);
      if (!normalized) return false;
      dbUpdates.end_time = normalized;
      updates = { ...updates, endTime: normalized };
    }
    if (updates.allDay !== undefined) dbUpdates.all_day = updates.allDay;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.location !== undefined) dbUpdates.location = updates.location || null;
    if (updates.meetingUrl !== undefined) dbUpdates.meeting_url = updates.meetingUrl || null;

    try {
      const { error } = await supabase
        .from("calendar_events")
        .update(dbUpdates)
        .eq("id", eventId)
        .eq("user_id", user.id);

      if (error) throw error;
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, ...updates } : e))
      );
      return true;
    } catch (error: any) {
      console.error("Error updating calendar event:", error);
      toast.error("שגיאה בעדכון אירוע");
      return false;
    }
  }, [user]);

  const deleteEvent = useCallback(async (eventId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId)
        .eq("user_id", user.id);

      if (error) throw error;
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (error: any) {
      console.error("Error deleting calendar event:", error);
      toast.error("שגיאה במחיקת אירוע");
    }
  }, [user]);

  const respondToInvitation = useCallback(async (invitationId: string, response: "accepted" | "declined") => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("event_invitations")
        .update({ status: response, responded_at: new Date().toISOString() })
        .eq("id", invitationId);

      if (error) throw error;

      // Update local state
      setEvents(prev => prev.map(e =>
        e.invitationId === invitationId
          ? { ...e, invitationStatus: response }
          : e
      ).filter(e => !(e.invitationId === invitationId && response === "declined")));

      toast.success(response === "accepted" ? "✅ ההזמנה אושרה" : "❌ ההזמנה נדחתה");
    } catch (error: any) {
      console.error("Error responding to invitation:", error);
      toast.error("שגיאה בעדכון הזמנה");
    }
  }, [user]);

  return { events, loading, addEvent, addEventSeries, updateEvent, deleteEvent, respondToInvitation, refetch: fetchEvents };
}
