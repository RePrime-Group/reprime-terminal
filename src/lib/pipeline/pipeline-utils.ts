import type { PipelineStage, TaskTemplate, TaskStatus } from './stage-templates';
import { STAGE_TEMPLATES, STAGE_ORDER, DEFAULT_DD_FOLDERS } from './stage-templates';

export interface DealStage {
  id: string;
  deal_id: string;
  stage: PipelineStage;
  started_at: string | null;
  completed_at: string | null;
  is_current: boolean;
  created_at: string;
}

export interface DealTask {
  id: string;
  deal_id: string;
  stage: PipelineStage;
  name: string;
  assignee_id: string | null;
  due_days: number | null;
  due_date: string | null;
  due_type: string;
  is_gate: boolean;
  is_milestone: boolean;
  status: TaskStatus;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  deal_id: string;
  name: string;
  file_size: string | null;
  file_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  show_to_investors: boolean;
  investor_folder_id: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface DealMessage {
  id: string;
  deal_id: string;
  user_id: string;
  message: string;
  created_at: string;
  // Joined field
  user_name?: string;
}

/** Calculate due date from stage start + days offset */
export function calculateDueDate(stageStartDate: Date, dueDays: number): string {
  const d = new Date(stageStartDate);
  d.setDate(d.getDate() + dueDays);
  return d.toISOString();
}

/** Build task insert records from a stage template */
export function buildTasksFromTemplate(
  dealId: string,
  stage: PipelineStage,
  stageStartDate: Date,
  assigneeMap: Record<string, string | null> = {}
): Omit<DealTask, 'id' | 'created_at' | 'updated_at'>[] {
  const templates = STAGE_TEMPLATES[stage];
  return templates.map((t, idx) => ({
    deal_id: dealId,
    stage,
    name: t.name,
    assignee_id: t.defaultAssignee ? (assigneeMap[t.defaultAssignee] ?? null) : null,
    due_days: t.dueDays,
    due_date: t.dueType === 'on_stage'
      ? stageStartDate.toISOString()
      : calculateDueDate(stageStartDate, t.dueDays),
    due_type: t.dueType ?? 'after_stage',
    is_gate: t.isGate ?? false,
    is_milestone: t.isMilestone ?? false,
    status: 'pending' as TaskStatus,
    completed_at: null,
    completed_by: null,
    sort_order: idx,
    notes: null,
  }));
}

/** Build DD folder insert records for a deal */
export function buildDDFolders(dealId: string) {
  return DEFAULT_DD_FOLDERS.map((f, idx) => ({
    deal_id: dealId,
    name: f.name,
    icon: f.icon,
    display_order: idx,
  }));
}

/** Get the next stage in the pipeline */
export function getNextStage(current: PipelineStage): PipelineStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

/** Calculate stage progress percentage */
export function calculateStageProgress(tasks: DealTask[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter(t => t.status === 'completed').length;
  return Math.round((completed / tasks.length) * 100);
}

/** Get uncompleted gate tasks (block stage advancement) */
export function getBlockingGates(tasks: DealTask[]): DealTask[] {
  return tasks.filter(t => t.is_gate && t.status !== 'completed');
}

/** Check if a task is overdue */
export function isTaskOverdue(task: DealTask): boolean {
  if (task.status === 'completed') return false;
  if (!task.due_date) return false;
  return new Date(task.due_date) < new Date();
}

/** Format a date for display */
export function formatTaskDate(isoStr: string | null): string {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
