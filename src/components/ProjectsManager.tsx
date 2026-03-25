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
import { Plus, Trash2, Search, FolderKanban, ChevronDown, ChevronLeft, Link2, ExternalLink, CheckCircle2, Circle, Sparkles, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ProjectMembersPanel from '@/components/ProjectMembersPanel';

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
}

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const ProjectsManager = () => {
  const { user } = useAuth();
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
  const [aiMilestones, setAiMilestones] = useState<Record<string, { title: string; done: boolean }[]>>({});

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
          tasksByProject[task.project_id].push(task);
        });
        setProjectTasks(tasksByProject);
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
    const { error } = await supabase.from('projects').delete().eq('id', id);

    if (error) {
      toast.error('שגיאה במחיקת הפרויקט');
      return;
    }

    toast.success('הפרויקט נמחק');
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const addProjectTask = async (projectId: string) => {
    const title = newTaskTitle[projectId]?.trim();
    if (!title) return;

    const currentTasks = projectTasks[projectId] || [];
    const maxOrder = currentTasks.length > 0 ? Math.max(...currentTasks.map(t => t.sort_order)) : 0;

    const { data, error } = await supabase.from('project_tasks').insert({
      project_id: projectId,
      user_id: user?.id,
      title,
      sort_order: maxOrder + 1,
    }).select().single();

    if (error) {
      toast.error('שגיאה בהוספת משימה');
      return;
    }

    setProjectTasks(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), data]
    }));
    setNewTaskTitle(prev => ({ ...prev, [projectId]: '' }));
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
      const milestones = lines.slice(0, 10).map((title: string) => ({ title, done: false }));
      setAiMilestones(prev => ({ ...prev, [project.id]: milestones }));
      toast.success(`נוצרו ${milestones.length} אבני דרך`);
    } catch {
      toast.error('שגיאה ביצירת אבני דרך');
    } finally {
      setAiMilestonesLoading(null);
    }
  };

  const toggleAiMilestone = (projectId: string, index: number) => {
    setAiMilestones(prev => ({
      ...prev,
      [projectId]: prev[projectId].map((m, i) => i === index ? { ...m, done: !m.done } : m),
    }));
  };

  const toggleExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">טוען פרויקטים...</div>;
  }

  const activeCount = projects.filter(p => p.status === 'פעיל').length;
  const completedCount = projects.filter(p => p.status === 'הושלם').length;
  const onHoldCount = projects.filter(p => p.status === 'בהמתנה').length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden" dir="rtl">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-3 gap-4 mb-4 flex-shrink-0">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{activeCount}</div>
          <div className="text-sm text-muted-foreground">פעילים</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          <div className="text-sm text-muted-foreground">הושלמו</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{onHoldCount}</div>
          <div className="text-sm text-muted-foreground">בהמתנה</div>
        </div>
      </div>

      {/* Header with count */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <FolderKanban className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">הפרויקטים שלי</h2>
        <span className="text-sm text-muted-foreground">({projects.length} פרויקטים)</span>
      </div>

      {/* Add new project */}
      <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
        <Input
          placeholder="שם הפרויקט"
          value={newProject.title}
          onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
          className="flex-1 min-w-[200px] text-right"
          dir="rtl"
        />
        <Input
          placeholder="תיאור (אופציונלי)"
          value={newProject.description}
          onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
          className="flex-1 min-w-[200px] text-right"
          dir="rtl"
        />
        <Button onClick={addProject}>
          <Plus className="h-4 w-4 ml-1" />
          הוסף פרויקט
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 flex-shrink-0">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חפש פרויקט..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10 text-right"
          dir="rtl"
        />
      </div>

      {/* Projects list with scroll */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          {filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm ? 'לא נמצאו תוצאות' : 'אין פרויקטים עדיין'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredProjects.map((project) => {
                const tasks = projectTasks[project.id] || [];
                const completedTasks = tasks.filter(t => t.completed).length;
                const isExpanded = expandedProjects.has(project.id);

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
                                ({completedTasks}/{tasks.length} משימות)
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
                                {new URL(link).hostname}
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

                      <div className="flex gap-4 mt-2 mr-11 text-xs text-muted-foreground">
                        <span>נוצר: {formatDateTime(project.created_at)}</span>
                        <span>עודכן: {formatDateTime(project.updated_at)}</span>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="bg-muted/30 p-4 mr-11 border-t border-border">
                        {/* Add task input */}
                        <div className="flex gap-2 mb-3">
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

                        {/* Tasks list */}
                        {tasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground">אין משימות עדיין</p>
                        ) : (
                          <div className="space-y-2">
                            {tasks.map((task) => (
                              <div
                                key={task.id}
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded bg-background",
                                  task.completed && "opacity-60"
                                )}
                              >
                                <button onClick={() => toggleTaskCompletion(task)}>
                                  {task.completed ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </button>
                                <span className={cn("flex-1", task.completed && "line-through")}>
                                  {task.title}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteProjectTask(task)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

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
    </div>
  );
};

export default ProjectsManager;
