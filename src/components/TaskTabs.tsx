import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListTodo, Archive, CheckCircle } from "lucide-react";
import { Task } from "@/hooks/useTasks";
import { useLanguage } from "@/hooks/useLanguage";

interface TaskTabsProps {
  tasks: Task[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: (filteredTasks: Task[], viewMode: "active" | "archive" | "completed") => React.ReactNode;
}

const TaskTabs = ({ tasks, activeTab, onTabChange, children }: TaskTabsProps) => {
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  // Active tasks: not archived
  const activeTasks = tasks.filter(t => !t.archived);
  
  // Archived tasks
  const archivedTasks = tasks.filter(t => t.archived);
  
  // Completed tasks (all completed, regardless of archive status)
  const completedTasks = tasks.filter(t => t.status === "בוצע");

  const activeCount = activeTasks.length;
  const archivedCount = archivedTasks.length;
  const completedCount = completedTasks.length;
  const copy = isHebrew ? {
    active: "משימות פעילות",
    completed: "בוצעו",
    archive: "ארכיון",
  } : {
    active: "Active tasks",
    completed: "Completed",
    archive: "Archive",
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full" dir={dir}>
      <div className="border-b border-border bg-card/50 px-4 flex-shrink-0">
        <TabsList className="h-10 bg-transparent justify-start">
          <TabsTrigger value="active" className="gap-2">
            <ListTodo className="h-4 w-4" />
            {copy.active}
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{activeCount}</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {copy.completed}
            <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">{completedCount}</span>
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2">
            <Archive className="h-4 w-4" />
            {copy.archive}
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{archivedCount}</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="active" className="flex-1 overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
        <div className="h-full overflow-auto">
          {children(activeTasks, "active")}
        </div>
      </TabsContent>

      <TabsContent value="completed" className="flex-1 overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
        <div className="h-full overflow-auto">
          {children(completedTasks, "completed")}
        </div>
      </TabsContent>

      <TabsContent value="archive" className="flex-1 overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
        <div className="h-full overflow-auto">
          {children(archivedTasks, "archive")}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default TaskTabs;
