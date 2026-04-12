import { useState, useEffect, useCallback } from "react";
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

const mapDbToEvent = (db: DbCalendarEvent, invitation?: { id: string; status: string } | null): CalendarEvent => ({
  id: db.id,
  userId: db.user_id,
  title: db.title,
  description: db.description || "",
  category: db.category,
  startTime: db.start_time,
  endTime: db.end_time,
  allDay: db.all_day || false,
  color: db.color || getCategoryColor(db.category),
  sourceType: db.source_type,
  sourceId: db.source_id,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
  invitationStatus: invitation ? (invitation.status as "pending" | "accepted" | "declined") : null,
  invitationId: invitation?.id || null,
  isInvited: !!invitation,
});

export function useCalendarEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

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
      const ownEvents = (ownData as unknown as DbCalendarEvent[]).map(e => mapDbToEvent(e));

      // Fetch invitations for this user
      const { data: invitations } = await supabase
        .from("event_invitations")
        .select("id, event_id, status, invitee_email, invitee_user_id")
        .or(`invitee_user_id.eq.${user.id},invitee_email.ilike.${user.email || ''}`);

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
          invitedEvents = (invData as unknown as DbCalendarEvent[]).map(e => {
            const inv = (invitations || []).find(i => i.event_id === e.id);
            return mapDbToEvent(e, inv ? { id: inv.id, status: inv.status } : null);
          });
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

    const channel = supabase
      .channel('calendar-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        () => { fetchEvents(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_invitations' },
        () => { fetchEvents(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchEvents]);

  const addEvent = useCallback(async (event: Partial<CalendarEvent>): Promise<CalendarEvent | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .insert([{
          user_id: user.id,
          title: event.title || "",
          description: event.description || null,
          category: event.category || "משימה",
          start_time: event.startTime,
          end_time: event.endTime,
          all_day: event.allDay || false,
          color: event.color || getCategoryColor(event.category || "משימה"),
          source_type: event.sourceType || "custom",
          source_id: event.sourceId || null,
        }])
        .select()
        .single();

      if (error) throw error;
      const newEvent = mapDbToEvent(data as unknown as DbCalendarEvent);
      setEvents((prev) => [...prev, newEvent]);
      return newEvent;
    } catch (error: any) {
      console.error("Error adding calendar event:", error);
      toast.error("שגיאה בהוספת אירוע");
      return null;
    }
  }, [user]);

  const updateEvent = useCallback(async (eventId: string, updates: Partial<CalendarEvent>) => {
    if (!user) return;

    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description || null;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.allDay !== undefined) dbUpdates.all_day = updates.allDay;
    if (updates.color !== undefined) dbUpdates.color = updates.color;

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
    } catch (error: any) {
      console.error("Error updating calendar event:", error);
      toast.error("שגיאה בעדכון אירוע");
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

  return { events, loading, addEvent, updateEvent, deleteEvent, respondToInvitation, refetch: fetchEvents };
}
