import { parseLocalDate } from './projectGantt.ts';

export const validGanttToken = (token: string) => /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(token);
export interface PublicGanttPayload {
  owner_display_name: string;
  project: { id: string; title: string; description: string | null; target_date: string | null };
  tasks: Array<{id:string;title:string;completed:boolean;urgent:boolean;status:string|null;due_date:string|null;sort_order:number}>;
  omittedTaskCount: number;
}
const record = (value: unknown): Record<string,unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : null;
export function normalizePublicGantt(value: unknown): PublicGanttPayload | null {
  const root = record(value), project = record(root?.project);
  if (!root || !project || typeof project.id !== 'string' || !project.id.trim() || typeof project.title !== 'string' || !project.title.trim() || !Array.isArray(root.tasks)) return null;
  const date = (value: unknown) => typeof value === 'string' && parseLocalDate(value) ? value : null;
  const seen = new Set<string>();
  const tasks: PublicGanttPayload['tasks'] = [];
  for (const input of root.tasks) {
    const row = record(input);
    if (!row || typeof row.id !== 'string' || !row.id.trim() || seen.has(row.id) || typeof row.title !== 'string') continue;
    seen.add(row.id);
    tasks.push({id:row.id,title:row.title,completed:row.completed === true,urgent:row.urgent === true,status:typeof row.status === 'string' ? row.status : null,due_date:date(row.due_date),sort_order:typeof row.sort_order === 'number' && Number.isFinite(row.sort_order) ? row.sort_order : tasks.length});
  }
  return {
    owner_display_name: typeof root.owner_display_name === 'string' && root.owner_display_name.trim() ? root.owner_display_name : 'Tabro',
    project:{id:project.id,title:project.title,description:typeof project.description === 'string' ? project.description : null,target_date:date(project.target_date)},
    tasks,omittedTaskCount:root.tasks.length-tasks.length,
  };
}
