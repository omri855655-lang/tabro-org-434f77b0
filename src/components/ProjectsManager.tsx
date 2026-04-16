import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Search, FolderKanban, ChevronDown, ChevronLeft, Link2, ExternalLink, CheckCircle2, Circle, Sparkles, Loader2, Flame, Edit2, ArrowDownToLine } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRecycleBin } from '@/hooks/useRecycleBin';
import ProjectMembersPanel from '@/components/ProjectMembersPanel';
import { useCustomBoards } from '@/hooks/useCustomBoards';
import TeamPerformanceDashboard from '@/components/projects/TeamPerformanceDashboard';
import ProjectTaskDialog from '@/components/projects/ProjectTaskDialog';
import { useLanguage } from '@/hooks/useLanguage';

interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string | null;
  target_date: string | null;
  links: string[] | null;
  created_at: string;
  updated_at: string;
}

interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  assigned_email: string | null;
  urgent: boolean;
  status: string | null;
  notes: string | null;
  due_date: string | null;
}

const TASK_STATUSES = ['לא התחיל', 'בטיפול', 'בהמתנה', 'בוצע'] as const;

interface ProjectMember {
  id: string;
  invited_email: string;
  invited_display_name: string | null;
  role: string;
  status: string;
}

interface TaskAssignment {
  id: string;
  project_task_id: string;
  assignee_email: string;
  assignee_name: string | null;
  responsibility: string | null;
}

const MEMBER_DOT_COLORS = ["bg-primary", "bg-accent", "bg-foreground/70", "bg-secondary-foreground/70", "bg-muted-foreground", "bg-destructive"];

const formatDateTime = (dateStr: string, locale: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

const getTaskPriorityScore = (task: ProjectTask) => {
  if (task.completed) return 3;
  if (task.urgent) return 0;
  if (task.status === 'בתהליך') return 1;
  return 2;
};

const ProjectsManager = () => {
  const { lang, dir } = useLanguage();
  const { user } = useAuth();
  const { softDelete } = useRecycleBin();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTasks, setProjectTasks] = useState<Record<string, ProjectTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({});
  const [addLinkDialogOpen, setAddLinkDialogOpen] = useState<string | null>(null);
  const [newLink, setNewLink] = useState('');
  const [aiMilestonesLoading, setAiMilestonesLoading] = useState<string | null>(null);
  const [aiMilestones, setAiMilestones] = useState<Record<string, { id?: string; title: string; done: boolean; description?: string | null }[]>>({});
  // Task dialog
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectMembers, setProjectMembers] = useState<Record<string, ProjectMember[]>>({});
  const [newTaskAssignee, setNewTaskAssignee] = useState<Record<string, string>>({});
  const [newTaskNotes, setNewTaskNotes] = useState<Record<string, string>>({});
  const [newTaskPushToWork, setNewTaskPushToWork] = useState<Record<string, string | boolean>>({});
  const { boards: customBoardsList } = useCustomBoards();
  const [taskAssignments, setTaskAssignments] = useState<Record<string, TaskAssignment[]>>({});
  const [assignDialogTask, setAssignDialogTask] = useState<string | null>(null);
  const [assignDialogProject, setAssignDialogProject] = useState<string | null>(null);
  const [assignMember, setAssignMember] = useState('');
  const [assignResponsibility, setAssignResponsibility] = useState('');
  // Multi-assignee on new task creation
  const [newTaskPreAssignees, setNewTaskPreAssignees] = useState<Record<string, { memberId: string; responsibility: string }[]>>({});
  const isHebrew = lang === 'he';
  const locale = ({ he: 'he-IL', en: 'en-US', es: 'es-ES', zh: 'zh-CN', ar: 'ar-SA', ru: 'ru-RU' } as const)[lang];
  const copy = isHebrew ? {
    loadError: 'שגיאה בטעינת הפרויקטים',
    enterTitle: 'נא להזין שם פרויקט',
    addError: 'שגיאה בהוספת הפרויקט',
    addSuccess: 'הפרויקט נוסף בהצלחה',
    updateStatusError: 'שגיאה בעדכון הסטטוס',
    updateTargetError: 'שגיאה בעדכון תאריך היעד',
    recycleSuccess: 'הפרויקט הועבר לסל המחזור',
    addTaskError: 'שגיאה בהוספת משימה',
    assignError: 'שגיאה בהקצאה',
    assignSuccess: 'אחראי נוסף למשימה',
    updateTaskError: 'שגיאה בעדכון משימה',
    deleteTaskError: 'שגיאה במחיקת משימה',
    addLinkError: 'שגיאה בהוספת קישור',
    linkAdded: 'הקישור נוסף',
    deleteLinkError: 'שגיאה במחיקת קישור',
    milestonesSaved: 'אבני דרך נוצרו ונשמרו',
    milestonesError: 'שגיאה ביצירת אבני דרך',
    milestoneDeleted: 'אבן דרך נמחקה',
    milestoneAddedTask: 'נוספה כמשימה',
    noPendingMilestones: 'אין אבני דרך לא מושלמות',
    genericError: 'שגיאה',
    tasksAdded: 'נוספו משימות',
    chooseTeamMember: 'בחר חבר צוות קודם',
    loading: 'טוען פרויקטים...',
    active: 'פעילים',
    completed: 'הושלמו',
    onHold: 'בהמתנה',
    title: 'הפרויקטים שלי',
    projectsCount: 'פרויקטים',
    titlePlaceholder: 'שם הפרויקט',
    descriptionPlaceholder: 'תיאור (אופציונלי)',
    add: 'הוסף',
    addProject: 'הוסף פרויקט',
    search: 'חפש פרויקט...',
    noResults: 'לא נמצאו תוצאות',
    empty: 'אין פרויקטים עדיין',
    tasks: 'משימות',
    addLink: 'הוסף קישור',
    enterUrl: 'הכנס URL...',
    progressCompleted: 'הושלם',
    tasksRemaining: 'משימות נותרו',
    aiMilestones: 'אבני דרך AI',
    regenerate: 'צור מחדש',
    recommendedMilestones: 'אבני דרך מומלצות:',
    addAllAsTasks: 'הוסף הכל כמשימות',
    addAsTask: 'הוסף כמשימה',
    delete: 'מחק',
    created: 'נוצר',
    updated: 'עודכן',
    newTask: 'משימה חדשה...',
    assignTeamMember: 'הקצה לחבר צוות',
    noAssignment: 'ללא הקצאה',
    responsibilityPlaceholder: 'תפקיד/חלק במשימה...',
    addToDashboard: 'הוסף גם לדשבורד...',
    noDashboardSync: 'ללא סנכרון לדשבורד',
    workTasks: 'משימות עבודה',
    personalTasks: 'משימות אישיות',
    addAnotherOwner: 'הוסף אחראי נוסף',
    noTasksYet: 'אין משימות עדיין',
    target: 'יעד',
    groupedByOwner: 'חלוקה לפי אחראי',
    urgent: 'דחוף',
    responsibility: 'אחריות',
    done: 'הושלם',
    open: 'פתוח',
    addAssigneeToTask: 'הוסף אחראי למשימה',
    chooseTeamMemberShort: 'בחר חבר צוות',
    responsibilityOptional: 'תפקיד/אחריות (אופציונלי)...',
    addAssignee: 'הוסף אחראי',
  } : {
    loadError: 'Error loading projects',
    enterTitle: 'Please enter a project name',
    addError: 'Error adding project',
    addSuccess: 'Project added successfully',
    updateStatusError: 'Error updating status',
    updateTargetError: 'Error updating target date',
    recycleSuccess: 'Project moved to recycle bin',
    addTaskError: 'Error adding task',
    assignError: 'Assignment error',
    assignSuccess: 'Assignee added to task',
    updateTaskError: 'Error updating task',
    deleteTaskError: 'Error deleting task',
    addLinkError: 'Error adding link',
    linkAdded: 'Link added',
    deleteLinkError: 'Error deleting link',
    milestonesSaved: 'Milestones created and saved',
    milestonesError: 'Error generating milestones',
    milestoneDeleted: 'Milestone deleted',
    milestoneAddedTask: 'Added as task',
    noPendingMilestones: 'No incomplete milestones',
    genericError: 'Error',
    tasksAdded: 'Tasks added',
    chooseTeamMember: 'Choose a team member first',
    loading: 'Loading projects...',
    active: 'Active',
    completed: 'Completed',
    onHold: 'On hold',
    title: 'My Projects',
    projectsCount: 'projects',
    titlePlaceholder: 'Project name',
    descriptionPlaceholder: 'Description (optional)',
    add: 'Add',
    addProject: 'Add project',
    search: 'Search projects...',
    noResults: 'No results found',
    empty: 'No projects yet',
    tasks: 'tasks',
    addLink: 'Add link',
    enterUrl: 'Enter URL...',
    progressCompleted: 'completed',
    tasksRemaining: 'tasks remaining',
    aiMilestones: 'AI milestones',
    regenerate: 'Regenerate',
    recommendedMilestones: 'Suggested milestones:',
    addAllAsTasks: 'Add all as tasks',
    addAsTask: 'Add as task',
    delete: 'Delete',
    created: 'Created',
    updated: 'Updated',
    newTask: 'New task...',
    assignTeamMember: 'Assign team member',
    noAssignment: 'No assignment',
    responsibilityPlaceholder: 'Role/part in task...',
    addToDashboard: 'Also add to dashboard...',
    noDashboardSync: 'No dashboard sync',
    workTasks: 'Work tasks',
    personalTasks: 'Personal tasks',
    addAnotherOwner: 'Add another assignee',
    noTasksYet: 'No tasks yet',
    target: 'Target',
    groupedByOwner: 'Grouped by assignee',
    urgent: 'Urgent',
    responsibility: 'Responsibility',
    done: 'Done',
    open: 'Open',
    addAssigneeToTask: 'Add assignee to task',
    chooseTeamMemberShort: 'Choose team member',
    responsibilityOptional: 'Role/responsibility (optional)...',
    addAssignee: 'Add assignee',
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(copy.loadError);
      console.error(error);
    } else {
      setProjects(data || []);
      // Fetch tasks for all projects
      const projectIds = (data || []).map(p => p.id);
      if (projectIds.length > 0) {
        const { data: tasksData } = await supabase
          .from('project_tasks')
          .select('*')
          .in('project_id', projectIds)
          .order('sort_order', { ascending: true });
        
        const tasksByProject: Record<string, ProjectTask[]> = {};
        (tasksData || []).forEach(task => {
          if (!tasksByProject[task.project_id]) {
            tasksByProject[task.project_id] = [];
          }
          tasksByProject[task.project_id].push({
            ...task,
            urgent: task.urgent ?? false,
            completed: task.completed ?? false,
            sort_order: task.sort_order ?? 0,
            assigned_to: task.assigned_to ?? null,
            assigned_email: task.assigned_email ?? null,
            status: task.status ?? null,
            notes: task.notes ?? null,
            due_date: (task as any).due_date ?? null,
          });
        });
        setProjectTasks(tasksByProject);

        // Fetch members for all projects
        const { data: membersData } = await supabase
          .from('project_members')
          .select('id, project_id, invited_email, invited_display_name, role, status')
          .in('project_id', projectIds)
          .eq('status', 'approved');

        const membersByProject: Record<string, ProjectMember[]> = {};
        (membersData || []).forEach((m: any) => {
          if (!membersByProject[m.project_id]) membersByProject[m.project_id] = [];
          membersByProject[m.project_id].push(m);
        });
        setProjectMembers(membersByProject);

        // Fetch task assignments
        const allTaskIds = Object.values(tasksByProject).flat().map(t => t.id);
        if (allTaskIds.length > 0) {
          const { data: assignData } = await supabase
            .from('project_task_assignments')
            .select('id, project_task_id, assignee_email, assignee_name, responsibility')
            .in('project_task_id', allTaskIds);
          const byTask: Record<string, TaskAssignment[]> = {};
          (assignData || []).forEach((a: any) => {
            if (!byTask[a.project_task_id]) byTask[a.project_task_id] = [];
            byTask[a.project_task_id].push(a);
          });
          setTaskAssignments(byTask);
        }
      }
    }
    setLoading(false);
  };

  const addProject = async () => {
    if (!newProject.title.trim()) {
      toast.error(copy.enterTitle);
      return;
    }

    const { error } = await supabase.from('projects').insert({
      user_id: user?.id,
      title: newProject.title,
      description: newProject.description || null,
      status: 'פעיל',
    });

    if (error) {
      toast.error(copy.addError);
      console.error(error);
    } else {
      toast.success(copy.addSuccess);
      setNewProject({ title: '', description: '' });
      fetchProjects();
    }
  };

  const updateProjectStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error(copy.updateStatusError);
      return;
    }

    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  const updateProjectTargetDate = async (id: string, target_date: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ target_date: target_date || null })
      .eq('id', id);

    if (error) {
      toast.error(copy.updateTargetError);
      return;
    }

    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, target_date } : p)));
  };

  const deleteProject = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    const success = await softDelete('projects', id, project);
    if (success) {
      toast.success(copy.recycleSuccess);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const addProjectTask = async (projectId: string) => {
    const title = newTaskTitle[projectId]?.trim();
    if (!title) return;

    const currentTasks = projectTasks[projectId] || [];
    const maxOrder = currentTasks.length > 0 ? Math.max(...currentTasks.map(t => t.sort_order)) : 0;

    const assigneeMemberId = newTaskAssignee[projectId] || null;
    const allAssignable = getAssignableMembers(projectId);
    const assigneeMember = assigneeMemberId ? allAssignable.find(m => m.id === assigneeMemberId) : null;
    const assigneeName = assigneeMember?.displayName === 'אני (בעל הפרויקט)' ? (user?.email?.split('@')[0] || 'אני') : (assigneeMember?.displayName || null);
    const assigneeEmail = assigneeMember?.email || null;
    const taskNotes = newTaskNotes[projectId]?.trim() || null;

    const { data, error } = await supabase.from('project_tasks').insert({
      project_id: projectId,
      user_id: user?.id,
      title,
      sort_order: maxOrder + 1,
      assigned_to: (assigneeMemberId && assigneeMemberId !== '__self__') ? assigneeMemberId : null,
      assigned_email: assigneeEmail,
      notes: taskNotes,
    }).select().single();

    if (error) {
      toast.error(copy.addTaskError);
      return;
    }

    // Create pre-assignees
    const preAssignees = newTaskPreAssignees[projectId] || [];
    if (preAssignees.length > 0 && data) {
      const allAssignableForPre = getAssignableMembers(projectId);
      const assignInserts = preAssignees.map(pa => {
        const member = allAssignableForPre.find(m => m.id === pa.memberId);
        return {
          project_task_id: data.id,
          project_id: projectId,
          user_id: user?.id!,
          assignee_email: member?.email || '',
          assignee_name: member?.displayName === 'אני (בעל הפרויקט)' ? (user?.email?.split('@')[0] || 'אני') : (member?.displayName || ''),
          responsibility: pa.responsibility || null,
        };
      });
      const { data: newAssignments } = await supabase.from('project_task_assignments').insert(assignInserts).select();
      if (newAssignments) {
        setTaskAssignments(prev => ({
          ...prev,
          [data.id]: [...(prev[data.id] || []), ...(newAssignments as TaskAssignment[])],
        }));
      }
    }

    // Also push to selected dashboard if chosen
    const pushTarget = newTaskPushToWork[projectId];
    if (pushTarget && typeof pushTarget === 'string' && pushTarget !== '__none__') {
      const project = projects.find(p => p.id === projectId);
      if (pushTarget.startsWith('board:')) {
        const boardId = pushTarget.replace('board:', '');
        await supabase.from('custom_board_items').insert({
          user_id: user?.id,
          board_id: boardId,
          title: `${project?.title || 'פרויקט'}: ${title}`,
          category: 'פרויקט',
          status: 'לביצוע',
          sheet_name: 'ראשי',
        });
      } else {
        await supabase.from('tasks').insert({
          user_id: user?.id,
          description: `${project?.title || 'פרויקט'}: ${title}`,
          task_type: pushTarget as 'work' | 'personal',
          status: 'לא התחיל',
          category: 'פרויקט',
          responsible: assigneeName || null,
          status_notes: taskNotes || null,
          sheet_name: String(new Date().getFullYear()),
        });
      }
    }

    // Notify team members
    try {
      await supabase.functions.invoke('notify-shared-task', {
        body: {
          ownerUserId: user?.id,
          taskDescription: title,
          creatorName: user?.email?.split('@')[0] || 'משתמש',
          sheetName: projects.find(p => p.id === projectId)?.title || 'פרויקט',
          projectId,
          notifyAllMembers: true,
        },
      });
    } catch {}

    setProjectTasks(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), data as ProjectTask]
    }));
    setNewTaskTitle(prev => ({ ...prev, [projectId]: '' }));
    setNewTaskAssignee(prev => ({ ...prev, [projectId]: '' }));
    setNewTaskNotes(prev => ({ ...prev, [projectId]: '' }));
    setNewTaskPushToWork(prev => ({ ...prev, [projectId]: '__none__' }));
    setNewTaskPreAssignees(prev => ({ ...prev, [projectId]: [] }));
  };

  // Build full assignable list including project owner
  const getAssignableMembers = (projectId: string): { id: string; email: string; displayName: string }[] => {
    const project = projects.find(p => p.id === projectId);
    const members = (projectMembers[projectId] || []).map(m => ({
      id: m.id,
      email: m.invited_email,
      displayName: m.invited_display_name || m.invited_email,
    }));
    // Add self (owner) if not already in members
    if (project && user && !members.some(m => m.email === user.email)) {
      members.unshift({
        id: '__self__',
        email: user.email || '',
        displayName: 'אני (בעל הפרויקט)',
      });
    }
    return members;
  };

  const addTaskAssignment = async (taskId: string, projectId: string) => {
    if (!assignMember || !user) return;
    const allMembers = getAssignableMembers(projectId);
    const member = allMembers.find(m => m.id === assignMember);
    if (!member) return;
    const { data, error } = await supabase.from('project_task_assignments').insert({
      project_task_id: taskId,
      project_id: projectId,
      user_id: user.id,
      assignee_email: member.email,
      assignee_name: member.displayName === 'אני (בעל הפרויקט)' ? (user.email?.split('@')[0] || 'אני') : member.displayName,
      responsibility: assignResponsibility.trim() || null,
    }).select().single();
    if (error) { toast.error(copy.assignError); return; }
    setTaskAssignments(prev => ({
      ...prev,
      [taskId]: [...(prev[taskId] || []), data as TaskAssignment],
    }));
    setAssignMember('');
    setAssignResponsibility('');
    setAssignDialogTask(null);
    toast.success(copy.assignSuccess);
  };

  const removeTaskAssignment = async (assignmentId: string, taskId: string) => {
    await supabase.from('project_task_assignments').delete().eq('id', assignmentId);
    setTaskAssignments(prev => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter(a => a.id !== assignmentId),
    }));
  };

  const toggleTaskCompletion = async (task: ProjectTask) => {
    const { error } = await supabase
      .from('project_tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id);

    if (error) {
      toast.error(copy.updateTaskError);
      return;
    }

    setProjectTasks(prev => ({
      ...prev,
      [task.project_id]: prev[task.project_id].map(t =>
        t.id === task.id ? { ...t, completed: !t.completed } : t
      )
    }));
  };

  const deleteProjectTask = async (task: ProjectTask) => {
    const { error } = await supabase.from('project_tasks').delete().eq('id', task.id);

    if (error) {
      toast.error(copy.deleteTaskError);
      return;
    }

    setProjectTasks(prev => ({
      ...prev,
      [task.project_id]: prev[task.project_id].filter(t => t.id !== task.id)
    }));
  };

  const addLink = async (projectId: string) => {
    if (!newLink.trim()) return;

    const project = projects.find(p => p.id === projectId);
    const currentLinks = project?.links || [];
    const updatedLinks = [...currentLinks, newLink];

    const { error } = await supabase
      .from('projects')
      .update({ links: updatedLinks })
      .eq('id', projectId);

    if (error) {
      toast.error(copy.addLinkError);
      return;
    }

    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, links: updatedLinks } : p
    ));
    setNewLink('');
    setAddLinkDialogOpen(null);
    toast.success(copy.linkAdded);
  };

  const removeLink = async (projectId: string, linkIndex: number) => {
    const project = projects.find(p => p.id === projectId);
    const currentLinks = project?.links || [];
    const updatedLinks = currentLinks.filter((_, i) => i !== linkIndex);

    const { error } = await supabase
      .from('projects')
      .update({ links: updatedLinks })
      .eq('id', projectId);

    if (error) {
      toast.error(copy.deleteLinkError);
      return;
    }

    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, links: updatedLinks } : p
    ));
  };

  const generateAiMilestones = async (project: Project) => {
    setAiMilestonesLoading(project.id);
    try {
      const { data, error } = await supabase.functions.invoke('task-ai-helper', {
        body: {
          taskDescription: project.title,
          taskCategory: 'project_milestones',
          customPrompt: `צור רשימת אבני דרך (milestones) לפרויקט "${project.title}". ${project.description ? `תיאור: ${project.description}` : ''} החזר רשימה של עד 10 אבני דרך מסודרות מ-0% ל-100% השלמה. כל אבן דרך צריכה להיות קצרה וספציפית.`,
        },
      });
      if (error) throw error;
      const text = data?.suggestion || '';
      const lines = text.split('\n').map((l: string) => l.replace(/^\s*[-*•\d\.\)\-]+\s*/, '').trim()).filter((l: string) => l.length > 2);
      const milestones = lines.slice(0, 10).map((title: string, idx: number) => ({ title, done: false, description: null }));
      
      // Save to DB
      const inserts = milestones.map((m: any, idx: number) => ({
        project_id: project.id,
        user_id: user?.id!,
        title: m.title,
        sort_order: idx,
        status: 'pending',
      }));
      
      // Delete old milestones first
      await supabase.from('project_milestones').delete().eq('project_id', project.id).eq('user_id', user?.id!);
      const { data: savedMs } = await supabase.from('project_milestones').insert(inserts).select();
      
      const saved = (savedMs || []).map((m: any) => ({ id: m.id, title: m.title, done: m.status === 'done', description: m.description }));
      setAiMilestones(prev => ({ ...prev, [project.id]: saved }));
      toast.success(`${saved.length} ${copy.milestonesSaved}`);
    } catch {
      toast.error(copy.milestonesError);
    } finally {
      setAiMilestonesLoading(null);
    }
  };

  // Load milestones from DB when expanding
  const loadMilestones = async (projectId: string) => {
    if (aiMilestones[projectId]) return;
    const { data } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    if (data && data.length > 0) {
      setAiMilestones(prev => ({
        ...prev,
        [projectId]: data.map((m: any) => ({ id: m.id, title: m.title, done: m.status === 'done', description: m.description })),
      }));
    }
  };

  const toggleAiMilestone = async (projectId: string, index: number) => {
    const ms = aiMilestones[projectId];
    if (!ms) return;
    const milestone = ms[index];
    const newDone = !milestone.done;
    setAiMilestones(prev => ({
      ...prev,
      [projectId]: prev[projectId].map((m, i) => i === index ? { ...m, done: newDone } : m),
    }));
    if (milestone.id) {
      await supabase.from('project_milestones').update({ status: newDone ? 'done' : 'pending' }).eq('id', milestone.id);
    }
  };

  const deleteMilestone = async (projectId: string, index: number) => {
    const ms = aiMilestones[projectId];
    if (!ms) return;
    const milestone = ms[index];
    if (milestone.id) {
      await supabase.from('project_milestones').delete().eq('id', milestone.id);
    }
    setAiMilestones(prev => ({
      ...prev,
      [projectId]: prev[projectId].filter((_, i) => i !== index),
    }));
    toast.success(copy.milestoneDeleted);
  };

  const convertMilestoneToTask = async (projectId: string, index: number) => {
    const ms = aiMilestones[projectId];
    if (!ms || !user) return;
    const milestone = ms[index];
    const currentTasks = projectTasks[projectId] || [];
    const maxOrder = currentTasks.length > 0 ? Math.max(...currentTasks.map(t => t.sort_order)) : 0;
    
    const { data, error } = await supabase.from('project_tasks').insert({
      project_id: projectId,
      user_id: user.id,
      title: milestone.title,
      description: milestone.description || null,
      sort_order: maxOrder + 1,
    }).select().single();
    
    if (error) { toast.error(copy.addTaskError); return; }
    
    setProjectTasks(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), data as ProjectTask],
    }));
    toast.success(`"${milestone.title}" ${copy.milestoneAddedTask}`);
  };

  const convertAllMilestonesToTasks = async (projectId: string) => {
    const ms = aiMilestones[projectId];
    if (!ms || !user) return;
    const currentTasks = projectTasks[projectId] || [];
    const maxOrder = currentTasks.length > 0 ? Math.max(...currentTasks.map(t => t.sort_order)) : 0;
    
    const inserts = ms.filter(m => !m.done).map((m, idx) => ({
      project_id: projectId,
      user_id: user.id,
      title: m.title,
      description: m.description || null,
      sort_order: maxOrder + idx + 1,
    }));
    
    if (inserts.length === 0) { toast.info(copy.noPendingMilestones); return; }
    
    const { data, error } = await supabase.from('project_tasks').insert(inserts).select();
    if (error) { toast.error(copy.genericError); return; }
    
    setProjectTasks(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), ...(data as ProjectTask[])],
    }));
    toast.success(`${copy.tasksAdded}: ${inserts.length}`);
  };

  const handleTaskUpdate = (taskId: string, updates: Record<string, any>) => {
    setProjectTasks(prev => {
      const newTasks = { ...prev };
      for (const projId of Object.keys(newTasks)) {
        newTasks[projId] = newTasks[projId].map(t => t.id === taskId ? { ...t, ...updates } : t);
      }
      return newTasks;
    });
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : prev);
    }
  };

  const toggleExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
        loadMilestones(projectId);
      }
      return newSet;
    });
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <div className="p-8 text-center text-muted-foreground">{copy.loading}</div>;

  const activeCount = projects.filter(p => p.status === 'פעיל').length;
  const completedCount = projects.filter(p => p.status === 'הושלם').length;
  const onHoldCount = projects.filter(p => p.status === 'בהמתנה').length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden" dir={dir}>
      {/* Stats Dashboard */}
      <div className="grid grid-cols-3 gap-4 mb-4 flex-shrink-0">
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-primary">{activeCount}</div>
          <div className="text-sm text-muted-foreground">{copy.active}</div>
        </div>
        <div className="bg-accent/15 border border-accent/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-accent-foreground">{completedCount}</div>
          <div className="text-sm text-muted-foreground">{copy.completed}</div>
        </div>
        <div className="bg-muted border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{onHoldCount}</div>
          <div className="text-sm text-muted-foreground">{copy.onHold}</div>
        </div>
      </div>

      {/* Header with count */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <FolderKanban className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">{copy.title}</h2>
        <span className="text-sm text-muted-foreground">({projects.length} {copy.projectsCount})</span>
      </div>

      {/* Add new project */}
      <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
        <Input
          placeholder={copy.titlePlaceholder}
          value={newProject.title}
          onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
          className={`flex-1 min-w-[200px] ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
          dir={dir}
        />
        <Input
          placeholder={copy.descriptionPlaceholder}
          value={newProject.description}
          onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
          className={`flex-1 min-w-[200px] ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
          dir={dir}
        />
        <Button onClick={addProject}>
          <Plus className="h-4 w-4 ml-1" />
          {copy.addProject}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 flex-shrink-0">
        <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
        <Input
          placeholder={copy.search}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={dir === 'rtl' ? 'pr-10 text-right' : 'pl-10 text-left'}
          dir={dir}
        />
      </div>

      {/* Projects list with scroll */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          {filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm ? copy.noResults : copy.empty}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredProjects.map((project) => {
                const tasks = [...(projectTasks[project.id] || [])].sort((a, b) => {
                  const priorityDiff = getTaskPriorityScore(a) - getTaskPriorityScore(b);
                  if (priorityDiff !== 0) return priorityDiff;
                  return (a.sort_order ?? 0) - (b.sort_order ?? 0);
                });
                const completedTasks = tasks.filter(t => t.completed).length;
                const isExpanded = expandedProjects.has(project.id);
                const groupedTasks = getAssignableMembers(project.id).map((member) => {
                  const items = tasks.filter((task) => {
                    const primaryMatch = task.assigned_email === member.email;
                    const assignmentMatch = (taskAssignments[task.id] || []).some(a => a.assignee_email === member.email);
                    return primaryMatch || assignmentMatch;
                  });
                  return {
                    ...member,
                    items,
                  };
                }).filter(group => group.items.length > 0);

                return (
                  <Collapsible key={project.id} open={isExpanded} onOpenChange={() => toggleExpanded(project.id)}>
                    <div className="p-4 bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{project.title}</h3>
                            {tasks.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({completedTasks}/{tasks.length} {copy.tasks})
                              </span>
                            )}
                          </div>
                          {project.description && (
                            <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                          )}
                        </div>
                        <Select
                          value={project.status || 'פעיל'}
                          onValueChange={(value) => updateProjectStatus(project.id, value)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="פעיל">פעיל</SelectItem>
                            <SelectItem value="בהמתנה">בהמתנה</SelectItem>
                            <SelectItem value="הושלם">הושלם</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="date"
                          value={project.target_date || ''}
                          onChange={(e) => updateProjectTargetDate(project.id, e.target.value)}
                          className="w-[150px]"
                        />
                        <Dialog open={addLinkDialogOpen === project.id} onOpenChange={(open) => setAddLinkDialogOpen(open ? project.id : null)}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent dir={dir}>
                            <DialogHeader>
                              <DialogTitle>{copy.addLink}</DialogTitle>
                            </DialogHeader>
                            <Input
                              placeholder={copy.enterUrl}
                              value={newLink}
                              onChange={(e) => setNewLink(e.target.value)}
                              dir="ltr"
                            />
                            <DialogFooter>
                              <Button onClick={() => addLink(project.id)}>{copy.add}</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteProject(project.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Links */}
                      {project.links && project.links.length > 0 && (
                        <div className="flex gap-2 mt-2 mr-11 flex-wrap">
                          {project.links.map((link, index) => (
                            <div key={index} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                              <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />
                                {(() => { try { return new URL(link).hostname; } catch { return link.slice(0, 30); } })()}
                              </a>
                              <button
                                onClick={() => removeLink(project.id, index)}
                                className="text-muted-foreground hover:text-destructive ml-1"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Progress Bar */}
                      {tasks.length > 0 && (
                        <div className="mt-3 mr-11 space-y-1">
                          <Progress value={tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0} className="h-2" />
                          <p className="text-[10px] text-muted-foreground">
                            {Math.round((completedTasks / tasks.length) * 100)}% {copy.progressCompleted} — {tasks.length - completedTasks} {copy.tasksRemaining}
                          </p>
                        </div>
                      )}

                      {/* AI Milestones Button */}
                      <div className="mt-2 mr-11">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          disabled={aiMilestonesLoading === project.id}
                          onClick={(e) => { e.stopPropagation(); generateAiMilestones(project); }}
                        >
                          {aiMilestonesLoading === project.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          {aiMilestones[project.id] ? copy.regenerate : copy.aiMilestones}
                        </Button>
                      </div>

                      {/* AI Milestones List */}
                      {aiMilestones[project.id] && aiMilestones[project.id].length > 0 && (
                        <div className="mt-2 mr-11 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground">{copy.recommendedMilestones}</p>
                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 gap-0.5" onClick={() => convertAllMilestonesToTasks(project.id)}>
                              <ArrowDownToLine className="h-3 w-3" />{copy.addAllAsTasks}
                            </Button>
                          </div>
                          {aiMilestones[project.id].map((ms, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs group">
                              <button onClick={() => toggleAiMilestone(project.id, idx)}>
                                {ms.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                              </button>
                              <span className={cn("flex-1", ms.done && 'line-through text-muted-foreground')}>{ms.title}</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => convertMilestoneToTask(project.id, idx)} title={copy.addAsTask}>
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteMilestone(project.id, idx)} title={copy.delete}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <Progress
                            value={(aiMilestones[project.id].filter(m => m.done).length / aiMilestones[project.id].length) * 100}
                            className="h-1.5 mt-1"
                          />
                        </div>
                      )}

                      <div className="flex gap-4 mt-2 mr-11 text-xs text-muted-foreground">
                        <span>{copy.created}: {formatDateTime(project.created_at, locale)}</span>
                        <span>{copy.updated}: {formatDateTime(project.updated_at, locale)}</span>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="bg-muted/30 p-4 mr-11 border-t border-border">
                        {/* Add task input */}
                        <div className="space-y-2 mb-3">
                          <div className="flex gap-2">
                            <Input
                              placeholder={copy.newTask}
                              value={newTaskTitle[project.id] || ''}
                              onChange={(e) => setNewTaskTitle(prev => ({ ...prev, [project.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && addProjectTask(project.id)}
                              className={`flex-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                              dir={dir}
                            />
                            <Button size="sm" onClick={() => addProjectTask(project.id)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-2 items-center flex-wrap">
                            <Select
                              value={newTaskAssignee[project.id] || '__none__'}
                              onValueChange={(v) => setNewTaskAssignee(prev => ({ ...prev, [project.id]: v === '__none__' ? '' : v }))}
                            >
                              <SelectTrigger className="w-[160px] h-8 text-xs">
                                <SelectValue placeholder={copy.assignTeamMember} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{copy.noAssignment}</SelectItem>
                                {getAssignableMembers(project.id).map(m => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder={copy.responsibilityPlaceholder}
                              value={newTaskNotes[project.id] || ''}
                              onChange={(e) => setNewTaskNotes(prev => ({ ...prev, [project.id]: e.target.value }))}
                              className="w-[200px] h-8 text-xs"
                              dir={dir}
                            />
                            <Select
                              value={newTaskPushToWork[project.id] ? String(newTaskPushToWork[project.id]) : '__none__'}
                              onValueChange={(v) => setNewTaskPushToWork(prev => ({ ...prev, [project.id]: v === '__none__' ? false : v as any }))}
                            >
                              <SelectTrigger className="w-[180px] h-8 text-xs">
                                <SelectValue placeholder={copy.addToDashboard} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{copy.noDashboardSync}</SelectItem>
                                <SelectItem value="work">{copy.workTasks}</SelectItem>
                                <SelectItem value="personal">{copy.personalTasks}</SelectItem>
                                {customBoardsList.map(b => (
                                  <SelectItem key={b.id} value={`board:${b.id}`}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {/* Pre-assignees for new task */}
                          {(newTaskPreAssignees[project.id] || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(newTaskPreAssignees[project.id] || []).map((pa, idx) => {
                                const member = getAssignableMembers(project.id).find(m => m.id === pa.memberId);
                                return (
                                  <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground flex items-center gap-0.5">
                                    {member?.displayName || pa.memberId}
                                    {pa.responsibility && <span className="text-muted-foreground">({pa.responsibility})</span>}
                                    <button onClick={() => setNewTaskPreAssignees(prev => ({
                                      ...prev,
                                      [project.id]: (prev[project.id] || []).filter((_, i) => i !== idx),
                                    }))} className="hover:text-destructive ml-0.5">×</button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-6 px-2 mt-1"
                            onClick={() => {
                              const assigneeId = newTaskAssignee[project.id];
                              if (!assigneeId) { toast.error(copy.chooseTeamMember); return; }
                              const responsibility = newTaskNotes[project.id]?.trim() || '';
                              setNewTaskPreAssignees(prev => ({
                                ...prev,
                                [project.id]: [...(prev[project.id] || []), { memberId: assigneeId, responsibility }],
                              }));
                              setNewTaskAssignee(prev => ({ ...prev, [project.id]: '' }));
                              setNewTaskNotes(prev => ({ ...prev, [project.id]: '' }));
                            }}
                          >
                            + {copy.addAnotherOwner}
                          </Button>
                        </div>

                        {/* Tasks list */}
                        {tasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{copy.noTasksYet}</p>
                        ) : (
                          <div className="space-y-2">
                            {tasks.map((task) => (
                              <div
                                key={task.id}
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded bg-background cursor-pointer hover:bg-accent/30 transition-colors",
                                  task.completed && "opacity-60",
                                  task.urgent && !task.completed && "bg-destructive/10 border border-destructive/30"
                                )}
                                onClick={() => { setSelectedTask(task); setTaskDialogOpen(true); }}
                              >
                                <button onClick={() => toggleTaskCompletion(task)}>
                                  {task.completed ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </button>
                                <button
                                  onClick={async () => {
                                    const newUrgent = !task.urgent;
                                    await supabase.from('project_tasks').update({ urgent: newUrgent }).eq('id', task.id);
                                    setProjectTasks(prev => ({
                                      ...prev,
                                      [task.project_id]: prev[task.project_id].map(t =>
                                        t.id === task.id ? { ...t, urgent: newUrgent } : t
                                      )
                                    }));
                                  }}
                                  title="סמן כדחוף"
                                >
                                    <Flame className={cn("h-4 w-4", task.urgent ? "text-destructive fill-destructive" : "text-muted-foreground/40")} />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <span className={cn("block", task.completed && "line-through")}>
                                    {task.title}
                                  </span>
                                  {task.notes && (
                                    <span className="text-[10px] text-muted-foreground block">{task.notes}</span>
                                  )}
                                  {task.due_date && (
                                    <span className="text-[10px] text-muted-foreground block">
                                      {copy.target}: {new Date(task.due_date).toLocaleDateString(locale)}
                                    </span>
                                  )}
                                  {/* Multi-assignee chips with colored dots */}
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {task.assigned_email && (() => {
                                      const memberName = (projectMembers[project.id] || []).find(m => m.invited_email === task.assigned_email)?.invited_display_name || task.assigned_email;
                                      const colorIdx = (projectMembers[project.id] || []).findIndex(m => m.invited_email === task.assigned_email);
                                      return (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                                           <span className={cn("w-2 h-2 rounded-full shrink-0", MEMBER_DOT_COLORS[colorIdx % MEMBER_DOT_COLORS.length])} />
                                          {memberName}
                                           {task.notes && <span className="text-muted-foreground">— {task.notes}</span>}
                                        </span>
                                      );
                                    })()}
                                    {(taskAssignments[task.id] || []).map((a, aIdx) => {
                                      const memberIdx = (projectMembers[project.id] || []).findIndex(m => m.invited_email === a.assignee_email);
                                      return (
                                        <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent-foreground flex items-center gap-1">
                                           <span className={cn("w-2 h-2 rounded-full shrink-0", MEMBER_DOT_COLORS[(memberIdx >= 0 ? memberIdx : aIdx + 1) % MEMBER_DOT_COLORS.length])} />
                                          {a.assignee_name || a.assignee_email}
                                          {a.responsibility && <span className="text-muted-foreground">— {a.responsibility}</span>}
                                          <button onClick={() => removeTaskAssignment(a.id, task.id)} className="hover:text-destructive ml-0.5">×</button>
                                        </span>
                                      );
                                    })}
                                    <button
                                      className="text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted"
                                      onClick={() => { setAssignDialogTask(task.id); setAssignDialogProject(project.id); }}
                                    >
                                      + אחראי
                                    </button>
                                  </div>
                                </div>
                                <Select
                                  value={task.status || 'לא התחיל'}
                                  onValueChange={async (value) => {
                                    const completed = value === 'בוצע';
                                    await supabase.from('project_tasks').update({ status: value, completed }).eq('id', task.id);
                                    setProjectTasks(prev => ({
                                      ...prev,
                                      [task.project_id]: prev[task.project_id].map(t =>
                                        t.id === task.id ? { ...t, status: value, completed } : t
                                      )
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="w-[100px] h-7 text-[10px] shrink-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TASK_STATUSES.map(s => (
                                      <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="date"
                                  value={task.due_date || ''}
                                  onChange={async (e) => {
                                    const due_date = e.target.value || null;
                                    await supabase.from('project_tasks').update({ due_date } as any).eq('id', task.id);
                                    setProjectTasks(prev => ({
                                      ...prev,
                                      [task.project_id]: prev[task.project_id].map(t =>
                                        t.id === task.id ? { ...t, due_date } : t
                                      )
                                    }));
                                  }}
                                  className="w-[120px] h-7 text-[10px] shrink-0"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                  onClick={() => deleteProjectTask(task)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {groupedTasks.length > 0 && (
                          <div className="mt-4 space-y-2 rounded-lg border bg-background/70 p-3">
                            <p className="text-xs font-semibold text-muted-foreground">{copy.groupedByOwner}</p>
                            {groupedTasks.map((group, index) => (
                              <div key={group.id} className="rounded-lg border bg-card p-2">
                                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                                  <span className={cn("h-2.5 w-2.5 rounded-full", MEMBER_DOT_COLORS[index % MEMBER_DOT_COLORS.length])} />
                                  <span>{group.displayName}</span>
                                  <span className="text-xs text-muted-foreground">({group.items.length} משימות)</span>
                                </div>
                                <div className="space-y-1">
                                  {group.items.map(task => {
                                    const directResponsibility = task.assigned_email === group.email ? task.notes : null;
                                    const extraResponsibilities = (taskAssignments[task.id] || [])
                                      .filter(a => a.assignee_email === group.email)
                                      .map(a => a.responsibility)
                                      .filter(Boolean)
                                      .join(' • ');

                                    return (
                                      <div key={`${group.id}-${task.id}`} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className={cn(task.completed && 'line-through text-muted-foreground')}>{task.title}</span>
                                            {task.urgent && <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">{copy.urgent}</span>}
                                          </div>
                                          {(directResponsibility || extraResponsibilities) && (
                                            <div className="mt-1 text-muted-foreground">
                                              {copy.responsibility}: {directResponsibility || extraResponsibilities}
                                            </div>
                                          )}
                                        </div>
                                        <span className="shrink-0 text-[10px] text-muted-foreground">{task.completed ? copy.done : (task.status || copy.open)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Team Performance Dashboard */}
                        <TeamPerformanceDashboard
                          tasks={tasks}
                          members={projectMembers[project.id] || []}
                          taskAssignments={taskAssignments}
                          ownerEmail={user?.email || undefined}
                        />

                        {/* Project Members */}
                        <ProjectMembersPanel projectId={project.id} isOwner={project.user_id === user?.id} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Multi-assign dialog */}
      <Dialog open={!!assignDialogTask} onOpenChange={(open) => { if (!open) setAssignDialogTask(null); }}>
        <DialogContent dir={dir}>
          <DialogHeader>
            <DialogTitle>{copy.addAssigneeToTask}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={assignMember} onValueChange={setAssignMember}>
              <SelectTrigger><SelectValue placeholder={copy.chooseTeamMemberShort} /></SelectTrigger>
              <SelectContent>
                {getAssignableMembers(assignDialogProject || '').map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={copy.responsibilityOptional}
              value={assignResponsibility}
              onChange={e => setAssignResponsibility(e.target.value)}
              dir={dir}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => assignDialogTask && assignDialogProject && addTaskAssignment(assignDialogTask, assignDialogProject)} disabled={!assignMember}>
              {copy.addAssignee}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Task Dialog */}
      <ProjectTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={selectedTask}
        members={(selectedTask ? projectMembers[selectedTask.project_id] : []) || []}
        onUpdate={handleTaskUpdate}
      />
    </div>
  );
};

export default ProjectsManager;
