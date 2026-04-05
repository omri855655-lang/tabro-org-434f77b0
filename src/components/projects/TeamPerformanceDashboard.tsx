import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProjectTask {
  id: string;
  completed: boolean;
  urgent: boolean;
  status: string | null;
  assigned_email: string | null;
}

interface TaskAssignment {
  id: string;
  project_task_id: string;
  assignee_email: string;
  assignee_name: string | null;
}

interface ProjectMember {
  id: string;
  invited_email: string;
  invited_display_name: string | null;
}

const MEMBER_DOT_COLORS = ["bg-primary", "bg-accent", "bg-foreground/70", "bg-secondary-foreground/70", "bg-muted-foreground", "bg-destructive"];

interface TeamPerformanceDashboardProps {
  tasks: ProjectTask[];
  members: ProjectMember[];
  taskAssignments: Record<string, TaskAssignment[]>;
  ownerEmail?: string;
}

const TeamPerformanceDashboard = ({ tasks, members, taskAssignments, ownerEmail }: TeamPerformanceDashboardProps) => {
  if (members.length === 0 && !ownerEmail) return null;

  // Build member stats
  const allEmails = new Set<string>();
  members.forEach(m => allEmails.add(m.invited_email));
  if (ownerEmail) allEmails.add(ownerEmail);

  const memberStats = Array.from(allEmails).map(email => {
    const member = members.find(m => m.invited_email === email);
    const displayName = member?.invited_display_name || email.split("@")[0];

    // Find tasks assigned to this member
    const assignedTasks = tasks.filter(task => {
      const primaryMatch = task.assigned_email === email;
      const assignmentMatch = (taskAssignments[task.id] || []).some(a => a.assignee_email === email);
      return primaryMatch || assignmentMatch;
    });

    const total = assignedTasks.length;
    const completed = assignedTasks.filter(t => t.completed).length;
    const inProgress = assignedTasks.filter(t => !t.completed && t.status === "בתהליך").length;
    const urgent = assignedTasks.filter(t => t.urgent && !t.completed).length;
    const open = total - completed - inProgress;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { email, displayName, total, completed, inProgress, urgent, open, pct };
  }).filter(s => s.total > 0).sort((a, b) => b.pct - a.pct);

  if (memberStats.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardContent className="py-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">📊 דשבורד ביצועי צוות</h3>
        <div className="space-y-3">
          {memberStats.map((stat, idx) => (
            <div key={stat.email} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("w-3 h-3 rounded-full", MEMBER_DOT_COLORS[idx % MEMBER_DOT_COLORS.length])} />
                  <span className="font-medium text-sm">{stat.displayName}</span>
                </div>
                <Badge variant={stat.pct >= 80 ? "default" : stat.pct >= 50 ? "secondary" : "outline"} className="text-xs">
                  {stat.pct}%
                </Badge>
              </div>
              <Progress value={stat.pct} className="h-2.5" />
              <div className="flex gap-3 text-[11px] flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  בוצע: {stat.completed}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  בטיפול: {stat.inProgress}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  פתוח: {stat.open}
                </span>
                {stat.urgent > 0 && (
                  <span className="flex items-center gap-1 text-destructive font-medium">
                    🔥 דחוף: {stat.urgent}
                  </span>
                )}
                <span className="text-muted-foreground">סה״כ: {stat.total}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamPerformanceDashboard;
