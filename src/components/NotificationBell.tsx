import { useState, useEffect } from "react";
import { Bell, Check, Clock, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EventInfo {
  id: string;
  title: string;
  source_id?: string | null;
  source_type?: string | null;
  start_time?: string;
  end_time?: string;
  category?: string;
}

interface TaskInfo {
  id: string;
  description: string;
  status?: string;
  task_type?: string;
  source_type?: string;
}

interface Notification {
  id: string;
  notification_type: string;
  channel: string;
  created_at: string;
  event_id: string | null;
  task_id: string | null;
  event_info?: EventInfo;
  task_info?: TaskInfo;
  contact_info?: {
    subject?: string;
    category?: string;
    from?: string;
    status?: string | null;
  };
}

const typeLabels: Record<string, string> = {
  event_5min: "⏰ תזכורת 5 דק׳",
  event_15min: "⏰ תזכורת 15 דק׳",
  event_1hour: "⏰ תזכורת שעה",
  event_completion: "🏁 בדיקת סיום",
  morning_summary: "☀️ סיכום בוקר",
  deadline_reminder: "📆 תזכורת דדליין",
  contact_form: "📨 פנייה חדשה",
};

const NotificationBell = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase.functions.invoke("get-notifications", {
        body: {},
      });

      if (!error && data?.notifications) {
        setNotifications(data.notifications);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
  }, [user]);

  const unseenCount = Math.max(0, notifications.length - lastSeenCount);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setLastSeenCount(notifications.length);
    }
  };

  const handleUpdateStatus = async (taskId: string, status: string, sourceType?: string) => {
    setUpdatingTaskId(taskId);
    try {
      const { data, error } = await supabase.functions.invoke("get-notifications", {
        body: { action: "update-status", task_id: taskId, status, source_type: sourceType },
      });

      if (error) throw error;

      setNotifications(prev => prev.map(n => {
        if (n.task_id === taskId && n.task_info) {
          return { ...n, task_info: { ...n.task_info, status } };
        }
        // Also match by event source_id
        if (n.event_info?.source_id === taskId && n.task_info) {
          return { ...n, task_info: { ...n.task_info, status } };
        }
        return n;
      }));

      toast.success(`המשימה עודכנה ל: ${status}`);
    } catch (error) {
      console.error("Error updating task status:", error);
      toast.error("שגיאה בעדכון המשימה");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const getNotificationTitle = (n: Notification): string => {
    if (n.event_info?.title) return n.event_info.title;
    if (n.task_info?.description) return n.task_info.description;
    if (n.contact_info?.subject) return n.contact_info.subject;
    return "";
  };

  const getCompletionTaskId = (n: Notification): string | null => {
    if (n.task_info?.id) return n.task_info.id;
    if (n.event_info?.source_id) return n.event_info.source_id;
    return null;
  };

  const getCompletionSourceType = (n: Notification): string | undefined => {
    if (n.task_info?.source_type) return n.task_info.source_type;
    const st = n.event_info?.source_type;
    if (st === "recurring_task") return "recurring_task";
    return "task";
  };

  const isCompletionDone = (n: Notification): boolean => {
    return n.task_info?.status === "בוצע";
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unseenCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" dir="rtl" align="end">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold text-sm">התראות אחרונות</h3>
        </div>
        <div className="h-[350px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              אין התראות עדיין
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const title = getNotificationTitle(n);
                const completionTaskId = n.notification_type === "event_completion" ? getCompletionTaskId(n) : null;
                const hasLinkedTask = !!completionTaskId;
                const done = isCompletionDone(n);
                const sourceType = getCompletionSourceType(n);
                const updatingThis = updatingTaskId === completionTaskId;

                return (
                  <div key={n.id} className="p-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {typeLabels[n.notification_type] || n.notification_type}
                      </span>
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        n.channel === "email" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}>
                        {n.channel === "email" ? "📧 מייל" : "🔔 Push"}
                      </span>
                    </div>
                    
                    {title && (
                      <p className="text-xs font-medium mt-1 text-foreground">{title}</p>
                    )}

                    {n.notification_type === "contact_form" && n.contact_info && (
                      <div className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                        <div>מאת: {n.contact_info.from || "אנונימי"}</div>
                        <div>סוג: {n.contact_info.category || "-"}</div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleDateString("he-IL")} {new Date(n.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                    </p>

                    {/* Action buttons for completion notifications with linked task */}
                    {n.notification_type === "event_completion" && hasLinkedTask && !done && (
                      <div className="flex gap-1.5 mt-2">
                        {updatingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:text-green-400 dark:border-green-800"
                              onClick={() => handleUpdateStatus(completionTaskId!, "בוצע", sourceType)}
                            >
                              <Check className="h-3 w-3" /> סיימתי
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800"
                              onClick={() => handleUpdateStatus(completionTaskId!, "בטיפול", sourceType)}
                            >
                              <Clock className="h-3 w-3" /> בטיפול
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleUpdateStatus(completionTaskId!, "טרם החל", sourceType)}
                            >
                              <AlertCircle className="h-3 w-3" /> לא התחלתי
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* Show completed status */}
                    {n.notification_type === "event_completion" && done && (
                      <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="h-3 w-3" /> סומן כבוצע
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
