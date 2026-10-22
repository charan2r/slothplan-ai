export type Level = 'low' | 'medium' | 'high'
export interface Draft {
  title: string; notes: string; duration: number; priority: Level; effort: Level;
  deadline: string | null; not_before: string | null;
}
export interface Task extends Draft {
  id: string; status: 'todo' | 'done'; created_at: string; completed_at: string | null;
}
export interface Block {
  kind: 'task' | 'break'; title: string; task_id: string | null; start: string; end: string;
  minutes: number; part?: number; parts?: number; priority?: Level; effort?: Level;
}
export interface Plan {
  date: string; sloth_mode: boolean; blocks: Block[];
  deferred: { task_id: string; title: string; reason: string }[];
  warnings: string[]; work_minutes: number; budget_minutes: number; break_minutes: number;
}
export interface Preferences {
  start_time: string; end_time: string; daily_budget: number; sloth_budget: number;
  focus_minutes: number; break_minutes: number;
}
export interface Health {
  status: string; ai_configured: boolean; model: string; provider: string; fallback_enabled: boolean;
}
export interface Extraction { tasks: Draft[]; source: 'gemma' | 'rules'; message: string; model: string | null }
