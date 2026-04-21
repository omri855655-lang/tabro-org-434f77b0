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

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const getTaskPriorityScore = (task: ProjectTask) => {
  if (task.completed) return 3;
  if (task.urgent) return 0;
  if (task.status === 'בתהליך') return 1;
  return 2;
};

const getProjectStatusTone = (status: string | null) => {
  switch (status) {
    case 'הושלם':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    case 'בהמתנה':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    default:
      return 'bg-primary/10 text-primary border-primary/20';
  }
};

const getProjectHealthLabel = (project: Project, tasks: ProjectTask[]) => {
  if (!tasks.length) return { label: 'התחלה חדשה', tone: 'bg-slate-500/10 text-slate-700 border-slate-500/20' };
  const completedTasks = tasks.filter(t => t.completed).length;
  const urgentOpen = tasks.filter(t => t.urgent && !t.completed).length;
  const overdue = tasks.filter(t => t.due_date && !t.completed && new Date(t.due_date) < new Date()).length;

  if (completedTasks === tasks.length) {
    return { label: 'סגור יפה', tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' };
  }
  if (urgentOpen > 0 || overdue > 0) {
    return { label: 'דורש תשומת לב', tone: 'bg-rose-500/10 text-rose-700 border-rose-500/20' };
  }
  if (completedTasks >= Math.ceil(tasks.length * 0.6)) {
    return { label: 'בשליטה טובה', tone: 'bg-sky-500/10 text-sky-700 border-sky-500/20' };
  }
  return { label: 'בתנועה', tone: 'bg-violet-500/10 text-violet-700 border-violet-500/20' };
};

const ProjectsManager = () => {
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'פעיל' | 'בהמתנה' | 'הושלם'>('all');
  // Multi-assignee on new task creation
  const [newTaskPreAssignees, setNewTaskPreAssignees] = useState<Record<string, { memberId: string; responsibility: string }[]>>({});

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
      toast.error('שגיאה בטעינת הפרויקטים');
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
      toast.error('נא להזין שם פרויקט');
      return;
    }

    const { error } = await supabase.from('projects').insert({
      user_id: user?.id,
      title: newProject.title,
      description: newProject.description || null,
      status: 'פעיל',
    });

    if (error) {
      toast.error('שגיאה בהוספת הפרויקט');
      console.error(error);
    } else {
      toast.success('הפרויקט נוסף בהצלחה');
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
      toast.error('שגיאה בעדכון הסטטוס');
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
      toast.error('שגיאה בעדכון תאריך היעד');
      return;
    }

    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, target_date } : p)));
  };

  const deleteProject = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    const success = await softDelete('projects', id, project);
    if (success) {
      toast.success('הפרויקט הועבר לסל המחזור');
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
      toast.error('שגיאה בהוספת משימה');
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
    if (error) { toast.error('שגיאה בהקצאה'); return; }
    setTaskAssignments(prev => ({
      ...prev,
      [taskId]: [...(prev[taskId] || []), data as TaskAssignment],
    }));
    setAssignMember('');
    setAssignResponsibility('');
    setAssignDialogTask(null);
    toast.success('אחראי נוסף למשימה');
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
      toast.error('שגיאה בעדכון משימה');
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
      toast.error('שגיאה במחיקת משימה');
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
      toast.error('שגיאה בהוספת קישור');
      return;
    }

    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, links: updatedLinks } : p
    ));
    setNewLink('');
    setAddLinkDialogOpen(null);
    toast.success('הקישור נוסף');
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
      toast.error('שגיאה במחיקת קישור');
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
      toast.success(`נוצרו ${saved.length} אבני דרך ונשמרו`);
    } catch {
      toast.error('שגיאה ביצירת אבני דרך');
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
    toast.success('אבן דרך נמחקה');
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
    
    if (error) { toast.error('שגיאה בהוספת משימה'); return; }
    
    setProjectTasks(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), data as ProjectTask],
    }));
    toast.success(`"${milestone.title}" נוספה כמשימה`);
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
    
    if (inserts.length === 0) { toast.info('אין אבני דרך לא מושלמות'); return; }
    
    const { data, error } = await supabase.from('project_tasks').insert(inserts).select();
    if (error) { toast.error('שגיאה'); return; }
    
    setProjectTasks(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), ...(data as ProjectTask[])],
    }));
    toast.success(`נוספו ${inserts.length} משימות`);
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

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || (project.status || 'פעיל') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">טוען פרויקטים...</div>;
  }

  const activeCount = projects.filter(p => p.status === 'פעיל').length;
  const completedCount = projects.filter(p => p.status === 'הושלם').length;
  const onHoldCount = projects.filter(p => p.status === 'בהמתנה').length;
  const totalTasks = Object.values(projectTasks).flat().length;
  const urgentTasks = Object.values(projectTasks).flat().filter(task => task.urgent && !task.completed).length;
  const overdueTasks = Object.values(projectTasks).flat().filter(task => task.due_date && !task.completed && new Date(task.due_date) < new Date()).length;

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden bg-gradient-to-b from-background via-background to-muted/20" dir="rtl">
      <div className="rounded-2xl border bg-card/80 p-5 shadow-sm flex-shrink-0">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
              <FolderKanban className="h-3.5 w-3.5" />
              מרחב פרויקטים חכם
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">ניהול פרויקטים ברור, צוותי, ומדויק</h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                כאן אתה רואה מהר מה מתקדם, מה נתקע, מה דחוף, ומי אחראי על כל חלק. השדרוג במסך הזה נועד לתת לך מבט ניהולי אמיתי בלי לאבד את הפעולות שכבר עבדו.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">סה״כ פרויקטים</div>
              <div className="mt-1 text-2xl font-semibold">{projects.length}</div>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">סה״כ משימות</div>
              <div className="mt-1 text-2xl font-semibold">{totalTasks}</div>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">דחופות פתוחות</div>
              <div className="mt-1 text-2xl font-semibold text-rose-600">{urgentTasks}</div>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">באיחור</div>
              <div className="mt-1 text-2xl font-semibold text-amber-600">{overdueTasks}</div>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
            <div className="text-2xl font-bold text-primary">{activeCount}</div>
            <div className="text-sm text-muted-foreground">פעילים</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="text-2xl font-bold text-emerald-700">{completedCount}</div>
            <div className="text-sm text-muted-foreground">הושלמו</div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="text-2xl font-bold text-amber-700">{onHoldCount}</div>
            <div className="text-sm text-muted-foreground">בהמתנה</div>
          </div>
          <div className="rounded-xl border bg-muted/70 p-4">
            <div className="text-2xl font-bold text-foreground">{filteredProjects.length}</div>
            <div className="text-sm text-muted-foreground">מוצגים כרגע</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] flex-shrink-0">
        <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">מרכז שליטה מהיר</div>
              <div className="text-xs text-muted-foreground">חיפוש, סינון ומעבר מהיר לפרויקטים שצריך לראות עכשיו</div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חפש לפי שם פרויקט או תיאור..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 text-right"
                dir="rtl"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'פעיל' | 'בהמתנה' | 'הושלם') => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="סנן לפי סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="פעיל">פעיל</SelectItem>
                <SelectItem value="בהמתנה">בהמתנה</SelectItem>
                <SelectItem value="הושלם">הושלם</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border bg-background px-3 py-1 text-muted-foreground">תוצאות: {filteredProjects.length}</span>
            <span className="rounded-full border bg-background px-3 py-1 text-muted-foreground">פעילים: {activeCount}</span>
            <span className="rounded-full border bg-background px-3 py-1 text-muted-foreground">באיחור: {overdueTasks}</span>
            <span className="rounded-full border bg-background px-3 py-1 text-muted-foreground">דחופות: {urgentTasks}</span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">הקם פרויקט חדש</div>
              <div className="text-xs text-muted-foreground">שם ברור, תיאור קצר, ומשם אפשר להתחיל להאציל משימות וצוות</div>
            </div>
          </div>
          <div className="space-y-3">
            <Input
              placeholder="שם הפרויקט"
              value={newProject.title}
              onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
              className="text-right"
              dir="rtl"
            />
            <Textarea
              placeholder="מה המטרה של הפרויקט, מה נחשב הצלחה, ומה חשוב לזכור?"
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              className="min-h-[84px] text-right"
              dir="rtl"
            />
            <Button onClick={addProject} className="w-full">
              <Plus className="ml-1 h-4 w-4" />
              הוסף פרויקט
            </Button>
          </div>
        </div>
      </div>

      {/* Projects list with scroll */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border bg-card/70 shadow-sm">
        <div className="h-full overflow-auto">
          {filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm ? 'לא נמצאו תוצאות' : 'אין פרויקטים עדיין'}
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
                const urgentOpenTasks = tasks.filter(t => t.urgent && !t.completed).length;
                const overdueProjectTasks = tasks.filter(t => t.due_date && !t.completed && new Date(t.due_date) < new Date()).length;
                const health = getProjectHealthLabel(project, tasks);
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
                    <div className="border-b border-border/70 p-4 transition-colors hover:bg-accent/20">
                      <div className="flex items-start gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="mt-1 h-8 w-8 shrink-0 rounded-full">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold">{project.title}</h3>
                                <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", getProjectStatusTone(project.status))}>
                                  {project.status || 'פעיל'}
                                </span>
                                <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", health.tone)}>
                                  {health.label}
                                </span>
                                {urgentOpenTasks > 0 && (
                                  <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                                    {urgentOpenTasks} דחופות
                                  </span>
                                )}
                                {overdueProjectTasks > 0 && (
                                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                                    {overdueProjectTasks} באיחור
                                  </span>
                                )}
                              </div>
                              {project.description && (
                                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{project.description}</p>
                              )}
                            </div>

                            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[360px]">
                              <div className="rounded-xl border bg-background px-3 py-2">
                                <div className="text-[11px] text-muted-foreground">התקדמות משימות</div>
                                <div className="mt-1 text-sm font-semibold">{tasks.length ? `${completedTasks}/${tasks.length}` : 'עדיין אין'}</div>
                              </div>
                              <div className="rounded-xl border bg-background px-3 py-2">
                                <div className="text-[11px] text-muted-foreground">יעד</div>
                                <div className="mt-1 text-sm font-semibold">{project.target_date ? new Date(project.target_date).toLocaleDateString('he-IL') : 'לא הוגדר'}</div>
                              </div>
                              <div className="rounded-xl border bg-background px-3 py-2">
                                <div className="text-[11px] text-muted-foreground">עודכן לאחרונה</div>
                                <div className="mt-1 text-sm font-semibold">{formatDateTime(project.updated_at)}</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 rounded-2xl border bg-background/80 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Select
                                value={project.status || 'פעיל'}
                                onValueChange={(value) => updateProjectStatus(project.id, value)}
                              >
                                <SelectTrigger className="w-[130px]">
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
                                className="w-[160px]"
                              />
                              <Dialog open={addLinkDialogOpen === project.id} onOpenChange={(open) => setAddLinkDialogOpen(open ? project.id : null)}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="gap-1.5">
                                    <Link2 className="h-4 w-4" />
                                    הוסף קישור
                                  </Button>
                                </DialogTrigger>
                                <DialogContent dir="rtl">
                                  <DialogHeader>
                                    <DialogTitle>הוסף קישור</DialogTitle>
                                  </DialogHeader>
                                  <Input
                                    placeholder="הכנס URL..."
                                    value={newLink}
                                    onChange={(e) => setNewLink(e.target.value)}
                                    dir="ltr"
                                  />
                                  <DialogFooter>
                                    <Button onClick={() => addLink(project.id)}>הוסף</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteProject(project.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="ml-1 h-4 w-4" />
                                מחק
                              </Button>
                            </div>

                            {project.links && project.links.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {project.links.map((link, index) => (
                                  <div key={index} className="flex items-center gap-1 rounded-full border bg-muted/60 px-2.5 py-1 text-xs">
                                    <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                                      <ExternalLink className="h-3 w-3" />
                                      {(() => { try { return new URL(link).hostname; } catch { return link.slice(0, 30); } })()}
                                    </a>
                                    <button
                                      onClick={() => removeLink(project.id, index)}
                                      className="ml-1 text-muted-foreground hover:text-destructive"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {tasks.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>התקדמות כללית</span>
                                  <span>{Math.round((completedTasks / tasks.length) * 100)}%</span>
                                </div>
                                <Progress value={tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0} className="h-2.5" />
                                <p className="text-[11px] text-muted-foreground">
                                  {tasks.length - completedTasks} משימות פתוחות, {completedTasks} הושלמו
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* AI Milestones Button */}
                      <div className="mr-11 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          disabled={aiMilestonesLoading === project.id}
                          onClick={(e) => { e.stopPropagation(); generateAiMilestones(project); }}
                        >
                          {aiMilestonesLoading === project.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          {aiMilestones[project.id] ? 'צור מחדש' : 'אבני דרך AI'}
                        </Button>
                      </div>

                      {/* AI Milestones List */}
                      {aiMilestones[project.id] && aiMilestones[project.id].length > 0 && (
                        <div className="mt-2 mr-11 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground">אבני דרך מומלצות:</p>
                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 gap-0.5" onClick={() => convertAllMilestonesToTasks(project.id)}>
                              <ArrowDownToLine className="h-3 w-3" />הוסף הכל כמשימות
                            </Button>
                          </div>
                          {aiMilestones[project.id].map((ms, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs group">
                              <button onClick={() => toggleAiMilestone(project.id, idx)}>
                                {ms.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                              </button>
                              <span className={cn("flex-1", ms.done && 'line-through text-muted-foreground')}>{ms.title}</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => convertMilestoneToTask(project.id, idx)} title="הוסף כמשימה">
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteMilestone(project.id, idx)} title="מחק">
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

                      <div className="mr-11 mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>נוצר: {formatDateTime(project.created_at)}</span>
                        <span>עודכן: {formatDateTime(project.updated_at)}</span>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="bg-muted/30 p-4 mr-11 border-t border-border">
                        {/* Add task input */}
                        <div className="space-y-2 mb-3">
                          <div className="flex gap-2">
                            <Input
                              placeholder="משימה חדשה..."
                              value={newTaskTitle[project.id] || ''}
                              onChange={(e) => setNewTaskTitle(prev => ({ ...prev, [project.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && addProjectTask(project.id)}
                              className="flex-1 text-right"
                              dir="rtl"
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
                                <SelectValue placeholder="הקצה לחבר צוות" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">ללא הקצאה</SelectItem>
                                {getAssignableMembers(project.id).map(m => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="תפקיד/חלק במשימה..."
                              value={newTaskNotes[project.id] || ''}
                              onChange={(e) => setNewTaskNotes(prev => ({ ...prev, [project.id]: e.target.value }))}
                              className="w-[200px] h-8 text-xs"
                              dir="rtl"
                            />
                            <Select
                              value={newTaskPushToWork[project.id] ? String(newTaskPushToWork[project.id]) : '__none__'}
                              onValueChange={(v) => setNewTaskPushToWork(prev => ({ ...prev, [project.id]: v === '__none__' ? false : v as any }))}
                            >
                              <SelectTrigger className="w-[180px] h-8 text-xs">
                                <SelectValue placeholder="הוסף גם לדשבורד..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">ללא סנכרון לדשבורד</SelectItem>
                                <SelectItem value="work">משימות עבודה</SelectItem>
                                <SelectItem value="personal">משימות אישיות</SelectItem>
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
                              if (!assigneeId) { toast.error('בחר חבר צוות קודם'); return; }
                              const responsibility = newTaskNotes[project.id]?.trim() || '';
                              setNewTaskPreAssignees(prev => ({
                                ...prev,
                                [project.id]: [...(prev[project.id] || []), { memberId: assigneeId, responsibility }],
                              }));
                              setNewTaskAssignee(prev => ({ ...prev, [project.id]: '' }));
                              setNewTaskNotes(prev => ({ ...prev, [project.id]: '' }));
                            }}
                          >
                            + הוסף אחראי נוסף
                          </Button>
                        </div>

                        {/* Tasks list */}
                        {tasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground">אין משימות עדיין</p>
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
                                      יעד: {new Date(task.due_date).toLocaleDateString('he-IL')}
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
                            <p className="text-xs font-semibold text-muted-foreground">חלוקה לפי אחראי</p>
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
                                            {task.urgent && <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">דחוף</span>}
                                          </div>
                                          {(directResponsibility || extraResponsibilities) && (
                                            <div className="mt-1 text-muted-foreground">
                                              אחריות: {directResponsibility || extraResponsibilities}
                                            </div>
                                          )}
                                        </div>
                                        <span className="shrink-0 text-[10px] text-muted-foreground">{task.completed ? 'הושלם' : (task.status || 'פתוח')}</span>
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
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>הוסף אחראי למשימה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={assignMember} onValueChange={setAssignMember}>
              <SelectTrigger><SelectValue placeholder="בחר חבר צוות" /></SelectTrigger>
              <SelectContent>
                {getAssignableMembers(assignDialogProject || '').map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="תפקיד/אחריות (אופציונלי)..."
              value={assignResponsibility}
              onChange={e => setAssignResponsibility(e.target.value)}
              dir="rtl"
            />
          </div>
          <DialogFooter>
            <Button onClick={() => assignDialogTask && assignDialogProject && addTaskAssignment(assignDialogTask, assignDialogProject)} disabled={!assignMember}>
              הוסף אחראי
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
