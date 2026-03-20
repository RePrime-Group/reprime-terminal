'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { STAGE_LABELS, STAGE_DURATIONS, STAGE_ORDER } from '@/lib/pipeline/stage-templates';
import type { PipelineStage } from '@/lib/pipeline/stage-templates';
import {
  buildTasksFromTemplate,
  buildDDFolders,
  calculateStageProgress,
  getBlockingGates,
  getNextStage,
  formatTaskDate,
  isTaskOverdue,
} from '@/lib/pipeline/pipeline-utils';
import type {
  DealTask,
  DealStage,
  DealMessage,
  TaskAttachment,
} from '@/lib/pipeline/pipeline-utils';

/* ───────────── Types ───────────── */

interface PipelineViewProps {
  dealId: string;
  dealName: string;
  locale: string;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface DDFolder {
  id: string;
  deal_id: string;
  name: string;
  icon: string;
  display_order: number;
}

interface CurrentUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

/* ───────────── Helpers ───────────── */

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatBytes(bytes: string | number | null): string {
  if (!bytes) return '';
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(b) || b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/* ───────────── Component ───────────── */

export default function PipelineView({ dealId, dealName, locale }: PipelineViewProps) {
  const supabase = createClient();

  /* ── State ── */
  const [stages, setStages] = useState<DealStage[]>([]);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [messages, setMessages] = useState<(DealMessage & { user_name?: string })[]>([]);
  const [ddFolders, setDDFolders] = useState<DDFolder[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [selectedStage, setSelectedStage] = useState<PipelineStage>('post_loi');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [reassignTaskId, setReassignTaskId] = useState<string | null>(null);

  const [taskAttachments, setTaskAttachments] = useState<Record<string, TaskAttachment[]>>({});
  const [newTaskName, setNewTaskName] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [msgInput, setMsgInput] = useState('');

  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ── Data fetching ── */

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [
      { data: stagesData },
      { data: tasksData },
      { data: messagesData },
      { data: foldersData },
      { data: membersData },
    ] = await Promise.all([
      supabase
        .from('terminal_deal_stages')
        .select('*')
        .eq('deal_id', dealId),
      supabase
        .from('terminal_deal_tasks')
        .select('*')
        .eq('deal_id', dealId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('terminal_deal_messages')
        .select('*, terminal_users(full_name)')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true }),
      supabase
        .from('terminal_dd_folders')
        .select('*')
        .eq('deal_id', dealId),
      supabase
        .from('terminal_users')
        .select('id, full_name, email, role')
        .in('role', ['owner', 'employee']),
    ]);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from('terminal_users')
        .select('id, full_name, email, role')
        .eq('id', user.id)
        .single();
      if (userData) setCurrentUser(userData);
    }

    setStages(stagesData ?? []);
    setTasks(tasksData ?? []);
    setMessages(
      (messagesData ?? []).map((m: any) => ({
        ...m,
        user_name: m.terminal_users?.full_name ?? 'Unknown',
      }))
    );
    setDDFolders(foldersData ?? []);
    setTeamMembers(membersData ?? []);

    // Set selected stage to current
    if (stagesData && stagesData.length > 0) {
      const current = stagesData.find((s: DealStage) => s.is_current);
      if (current) setSelectedStage(current.stage as PipelineStage);
    }

    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch attachments when a task is expanded
  useEffect(() => {
    if (!expandedTaskId) return;
    if (taskAttachments[expandedTaskId]) return;
    (async () => {
      const { data } = await supabase
        .from('terminal_task_attachments')
        .select('*')
        .eq('task_id', expandedTaskId);
      setTaskAttachments((prev) => ({
        ...prev,
        [expandedTaskId]: data ?? [],
      }));
    })();
  }, [expandedTaskId]);

  /* ── Derived ── */

  const currentStageRecord = stages.find((s) => s.is_current);
  const stageTasks = tasks.filter((t) => t.stage === selectedStage);
  const stageProgress = calculateStageProgress(stageTasks);
  const isOwner = currentUser?.role === 'owner';

  function getStageStatus(stage: PipelineStage): 'current' | 'completed' | 'future' {
    const record = stages.find((s) => s.stage === stage);
    if (!record) return 'future';
    if (record.is_current) return 'current';
    if (record.completed_at) return 'completed';
    return 'future';
  }

  function getMemberName(id: string | null): string | null {
    if (!id) return null;
    const m = teamMembers.find((t) => t.id === id);
    return m?.full_name ?? m?.email ?? null;
  }

  /* ── Actions ── */

  async function initializePipeline() {
    if (initializing) return;
    setInitializing(true);

    const now = new Date();

    // Create stage record
    await supabase.from('terminal_deal_stages').insert({
      deal_id: dealId,
      stage: 'post_loi',
      started_at: now.toISOString(),
      is_current: true,
    });

    // Build assignee map from team members
    const assigneeMap: Record<string, string | null> = {};
    teamMembers.forEach((m) => {
      if (m.full_name) assigneeMap[m.full_name] = m.id;
    });

    // Create tasks
    const taskRecords = buildTasksFromTemplate(dealId, 'post_loi', now, assigneeMap);
    await supabase.from('terminal_deal_tasks').insert(taskRecords);

    // Create DD folders if none exist
    if (ddFolders.length === 0) {
      const folderRecords = buildDDFolders(dealId);
      await supabase.from('terminal_dd_folders').insert(folderRecords);
    }

    setInitializing(false);
    await fetchData();
  }

  async function updateTaskStatus(taskId: string, status: 'completed' | 'in_progress' | 'pending') {
    const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = currentUser?.id ?? null;
    } else {
      updates.completed_at = null;
      updates.completed_by = null;
    }

    await supabase.from('terminal_deal_tasks').update(updates).eq('id', taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
    setMenuTaskId(null);
  }

  async function reassignTask(taskId: string, assigneeId: string | null) {
    await supabase
      .from('terminal_deal_tasks')
      .update({ assignee_id: assigneeId, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assignee_id: assigneeId } : t))
    );
    setReassignTaskId(null);
    setMenuTaskId(null);
  }

  async function saveTaskNotes(taskId: string, notes: string) {
    await supabase
      .from('terminal_deal_tasks')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, notes } : t))
    );
  }

  async function addTask() {
    if (!newTaskName.trim()) return;
    const maxSort = stageTasks.length > 0 ? Math.max(...stageTasks.map((t) => t.sort_order)) + 1 : 0;
    const { data } = await supabase
      .from('terminal_deal_tasks')
      .insert({
        deal_id: dealId,
        stage: selectedStage,
        name: newTaskName.trim(),
        status: 'pending',
        sort_order: maxSort,
        is_gate: false,
        is_milestone: false,
        due_type: 'after_stage',
        due_days: null,
        due_date: null,
        assignee_id: null,
        completed_at: null,
        completed_by: null,
        notes: null,
      })
      .select()
      .single();
    if (data) {
      setTasks((prev) => [...prev, data]);
    }
    setNewTaskName('');
    setShowAddTask(false);
  }

  async function handleAdvanceStage() {
    if (!currentStageRecord) return;
    const currentStageTasks = tasks.filter((t) => t.stage === currentStageRecord.stage);
    const gates = getBlockingGates(currentStageTasks);
    if (gates.length > 0) {
      setAdvanceError(
        `Cannot advance: ${gates.length} gate task(s) incomplete:\n${gates.map((g) => `- ${g.name}`).join('\n')}`
      );
      setShowAdvanceModal(false);
      return;
    }
    setAdvanceError(null);
    setShowAdvanceModal(true);
  }

  async function confirmAdvance() {
    if (!currentStageRecord) return;
    const nextStage = getNextStage(currentStageRecord.stage as PipelineStage);
    if (!nextStage) return;

    const now = new Date();

    // Mark current stage complete
    await supabase
      .from('terminal_deal_stages')
      .update({ completed_at: now.toISOString(), is_current: false })
      .eq('id', currentStageRecord.id);

    // Create next stage
    await supabase.from('terminal_deal_stages').insert({
      deal_id: dealId,
      stage: nextStage,
      started_at: now.toISOString(),
      is_current: true,
    });

    // Build assignee map
    const assigneeMap: Record<string, string | null> = {};
    teamMembers.forEach((m) => {
      if (m.full_name) assigneeMap[m.full_name] = m.id;
    });

    // Create tasks for next stage
    const taskRecords = buildTasksFromTemplate(dealId, nextStage, now, assigneeMap);
    await supabase.from('terminal_deal_tasks').insert(taskRecords);

    setShowAdvanceModal(false);
    setSelectedStage(nextStage);
    await fetchData();
  }

  async function sendMessage() {
    if (!msgInput.trim() || !currentUser) return;
    const { data } = await supabase
      .from('terminal_deal_messages')
      .insert({
        deal_id: dealId,
        user_id: currentUser.id,
        message: msgInput.trim(),
      })
      .select()
      .single();
    if (data) {
      setMessages((prev) => [
        ...prev,
        { ...data, user_name: currentUser.full_name ?? 'You' },
      ]);
    }
    setMsgInput('');
  }

  async function handleFileUpload(taskId: string, file: File) {
    setUploading(true);
    const path = `pipeline/${dealId}/${taskId}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('terminal-dd-documents')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      setUploading(false);
      return;
    }

    const { data } = await supabase
      .from('terminal_task_attachments')
      .insert({
        task_id: taskId,
        deal_id: dealId,
        name: file.name,
        file_size: String(file.size),
        file_type: file.type || null,
        storage_path: path,
        uploaded_by: currentUser?.id ?? null,
        show_to_investors: false,
        investor_folder_id: null,
        is_verified: false,
      })
      .select()
      .single();

    if (data) {
      setTaskAttachments((prev) => ({
        ...prev,
        [taskId]: [...(prev[taskId] ?? []), data],
      }));
    }
    setUploading(false);
  }

  async function toggleTransparency(attachment: TaskAttachment, value: boolean) {
    await supabase
      .from('terminal_task_attachments')
      .update({ show_to_investors: value, investor_folder_id: value ? attachment.investor_folder_id : null })
      .eq('id', attachment.id);
    setTaskAttachments((prev) => ({
      ...prev,
      [attachment.task_id]: (prev[attachment.task_id] ?? []).map((a) =>
        a.id === attachment.id ? { ...a, show_to_investors: value } : a
      ),
    }));
  }

  async function setAttachmentFolder(attachment: TaskAttachment, folderId: string | null) {
    await supabase
      .from('terminal_task_attachments')
      .update({ investor_folder_id: folderId })
      .eq('id', attachment.id);
    setTaskAttachments((prev) => ({
      ...prev,
      [attachment.task_id]: (prev[attachment.task_id] ?? []).map((a) =>
        a.id === attachment.id ? { ...a, investor_folder_id: folderId } : a
      ),
    }));
  }

  /* ── Loading ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-3 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── No pipeline yet ── */

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl border border-[#EEF0F4] rp-card-shadow">
        <div className="text-[48px] mb-4 opacity-40">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-[15px] text-[#6B7280] mb-6">No pipeline has been created for this deal yet.</p>
        <button
          onClick={initializePipeline}
          disabled={initializing}
          className="bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] font-semibold px-8 py-3 rounded-lg shadow-[0_2px_8px_rgba(188,156,69,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(188,156,69,0.25)] transition-all disabled:opacity-50"
        >
          {initializing ? 'Initializing...' : 'Initialize Pipeline'}
        </button>
      </div>
    );
  }

  /* ── Main Layout ── */

  return (
    <div className="flex gap-5 h-[calc(100vh-180px)] font-[family-name:var(--font-poppins)]">
      {/* ════════ LEFT PANEL — Tasks ════════ */}
      <div className="w-[65%] flex flex-col min-h-0">
        {/* Stage Navigation Bar */}
        <div className="bg-white rounded-xl border border-[#EEF0F4] rp-card-shadow mb-4 overflow-hidden">
          <div className="flex items-stretch">
            {STAGE_ORDER.map((stage, idx) => {
              const status = getStageStatus(stage);
              let bgClass = 'bg-[#F7F8FA] text-[#9CA3AF]';
              let borderClass = '';
              if (status === 'current') {
                bgClass = 'bg-[#0E3470] text-white';
                borderClass = 'border-b-2 border-[#BC9C45]';
              } else if (status === 'completed') {
                bgClass = 'bg-[#ECFDF5] text-[#0B8A4D]';
              }

              return (
                <div key={stage} className="flex items-stretch flex-1">
                  <button
                    onClick={() => setSelectedStage(stage)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-3.5 text-[11px] uppercase tracking-[0.08em] font-semibold transition-colors ${bgClass} ${borderClass} ${selectedStage === stage ? 'ring-1 ring-inset ring-[#BC9C45]/30' : ''}`}
                  >
                    {status === 'completed' && (
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className="shrink-0">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span>{STAGE_LABELS[stage]}</span>
                    <span className="opacity-60 text-[9px]">({STAGE_DURATIONS[stage]})</span>
                  </button>
                  {idx < STAGE_ORDER.length - 1 && (
                    <div className="flex items-center px-0.5 bg-[#F7F8FA]">
                      <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
                        <path d="M2 2L10 10L2 18" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="h-[6px] bg-[#F1F5F9]">
            <div
              className="h-full bg-gradient-to-r from-[#0B8A4D] to-[#009080] transition-all duration-500"
              style={{ width: `${stageProgress}%` }}
            />
          </div>
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold text-[#0E3470]">
            {STAGE_LABELS[selectedStage]} Tasks
            <span className="ml-2 text-[12px] font-normal text-[#9CA3AF]">
              {stageTasks.filter((t) => t.status === 'completed').length}/{stageTasks.length} completed
            </span>
          </h2>
          {isOwner && currentStageRecord && currentStageRecord.stage === selectedStage && !currentStageRecord.completed_at && (
            <button
              onClick={handleAdvanceStage}
              className="bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] font-semibold px-5 py-2 rounded-lg text-[12px] shadow-[0_2px_8px_rgba(188,156,69,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(188,156,69,0.25)] transition-all"
            >
              Advance to Next Stage
            </button>
          )}
        </div>

        {/* Advance error */}
        {advanceError && (
          <div className="mb-3 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[12px] text-[#DC2626] whitespace-pre-line">
            {advanceError}
            <button onClick={() => setAdvanceError(null)} className="ml-3 underline">Dismiss</button>
          </div>
        )}

        {/* Task table */}
        <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-[#EEF0F4] rp-card-shadow">
          {/* Table header */}
          <div className="grid grid-cols-[40px_1fr_150px_120px_48px] gap-2 px-4 py-2.5 border-b border-[#EEF0F4] bg-[#FAFBFC] sticky top-0 z-10">
            <span className="text-[9px] uppercase tracking-[0.1em] font-semibold text-[#9CA3AF]">St.</span>
            <span className="text-[9px] uppercase tracking-[0.1em] font-semibold text-[#9CA3AF]">Task Name</span>
            <span className="text-[9px] uppercase tracking-[0.1em] font-semibold text-[#9CA3AF]">Assignee</span>
            <span className="text-[9px] uppercase tracking-[0.1em] font-semibold text-[#9CA3AF]">Due Date</span>
            <span className="text-[9px] uppercase tracking-[0.1em] font-semibold text-[#9CA3AF]"></span>
          </div>

          {/* Task rows */}
          {stageTasks.map((task) => {
            const overdue = isTaskOverdue(task);
            const expanded = expandedTaskId === task.id;
            const assigneeName = getMemberName(task.assignee_id);
            const attachments = taskAttachments[task.id] ?? [];

            return (
              <div key={task.id} className="border-b border-[#EEF0F4] last:border-b-0">
                {/* Row */}
                <div
                  className={`grid grid-cols-[40px_1fr_150px_120px_48px] gap-2 px-4 py-2.5 items-center cursor-pointer hover:bg-[#FAFBFC] transition-colors ${expanded ? 'bg-[#F7F8FA]' : ''}`}
                  onClick={() => setExpandedTaskId(expanded ? null : task.id)}
                >
                  {/* Status icon */}
                  <div className="flex items-center justify-center">
                    {task.status === 'completed' ? (
                      <span className="text-[16px]" title="Completed">
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="#0B8A4D"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                      </span>
                    ) : overdue ? (
                      <span className="w-[18px] h-[18px] rounded-full bg-[#DC2626] flex items-center justify-center" title="Overdue">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="white"><circle cx="5" cy="5" r="3"/></svg>
                      </span>
                    ) : task.status === 'in_progress' ? (
                      <span className="w-[18px] h-[18px] rounded-full bg-[#F59E0B] flex items-center justify-center" title="In Progress">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="white"><circle cx="5" cy="5" r="3"/></svg>
                      </span>
                    ) : (
                      <span className="w-[18px] h-[18px] rounded-full border-2 border-[#D1D5DB]" title="Pending" />
                    )}
                  </div>

                  {/* Task name */}
                  <div className="min-w-0">
                    <span className={`text-[13px] ${task.is_gate || task.is_milestone ? 'font-bold' : 'font-medium'} ${overdue ? 'text-[#DC2626]' : 'text-[#1F2937]'}`}>
                      {task.is_gate && <span className="text-[#BC9C45] mr-1" title="Gate Task">&#9733;&#9733;</span>}
                      {task.is_milestone && !task.is_gate && <span className="text-[#BC9C45] mr-1" title="Milestone">&#9733;</span>}
                      {task.name}
                    </span>
                  </div>

                  {/* Assignee */}
                  <div className="flex items-center gap-2 min-w-0">
                    {assigneeName ? (
                      <>
                        <div className="w-[28px] h-[28px] rounded-full bg-[#0E3470] text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                          {getInitials(assigneeName)}
                        </div>
                        <span className="text-[12px] text-[#4B5563] truncate">{assigneeName}</span>
                      </>
                    ) : (
                      <span className="text-[12px] text-[#9CA3AF]">Unassigned</span>
                    )}
                  </div>

                  {/* Due date */}
                  <span className={`text-[12px] ${overdue ? 'text-[#DC2626] font-semibold' : 'text-[#6B7280]'}`}>
                    {formatTaskDate(task.due_date)}
                  </span>

                  {/* Actions menu */}
                  <div className="relative flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuTaskId(menuTaskId === task.id ? null : task.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#EEF0F4] transition-colors text-[#9CA3AF]"
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>

                    {menuTaskId === task.id && (
                      <div className="absolute right-0 top-8 z-30 bg-white rounded-lg border border-[#EEF0F4] shadow-lg py-1 w-44">
                        <button
                          onClick={() => { updateTaskStatus(task.id, 'completed'); }}
                          className="w-full text-left px-3 py-2 text-[12px] text-[#1F2937] hover:bg-[#F7F8FA]"
                        >
                          Mark Complete
                        </button>
                        <button
                          onClick={() => { updateTaskStatus(task.id, 'in_progress'); }}
                          className="w-full text-left px-3 py-2 text-[12px] text-[#1F2937] hover:bg-[#F7F8FA]"
                        >
                          Mark In Progress
                        </button>
                        <button
                          onClick={() => { setReassignTaskId(task.id); setMenuTaskId(null); }}
                          className="w-full text-left px-3 py-2 text-[12px] text-[#1F2937] hover:bg-[#F7F8FA]"
                        >
                          Reassign
                        </button>
                        <button
                          onClick={() => { setExpandedTaskId(task.id); setMenuTaskId(null); }}
                          className="w-full text-left px-3 py-2 text-[12px] text-[#1F2937] hover:bg-[#F7F8FA]"
                        >
                          Add Note
                        </button>
                      </div>
                    )}

                    {/* Reassign dropdown */}
                    {reassignTaskId === task.id && (
                      <div className="absolute right-0 top-8 z-30 bg-white rounded-lg border border-[#EEF0F4] shadow-lg py-1 w-52">
                        <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.1em] text-[#9CA3AF] font-semibold">Assign To</div>
                        <button
                          onClick={() => reassignTask(task.id, null)}
                          className="w-full text-left px-3 py-2 text-[12px] text-[#9CA3AF] hover:bg-[#F7F8FA]"
                        >
                          Unassign
                        </button>
                        {teamMembers.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => reassignTask(task.id, m.id)}
                            className="w-full text-left px-3 py-2 text-[12px] text-[#1F2937] hover:bg-[#F7F8FA] flex items-center gap-2"
                          >
                            <div className="w-5 h-5 rounded-full bg-[#0E3470] text-white flex items-center justify-center text-[8px] font-semibold">
                              {getInitials(m.full_name)}
                            </div>
                            {m.full_name ?? m.email}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded row */}
                {expanded && (
                  <div className="px-4 pb-4 bg-[#FAFBFC] border-t border-[#EEF0F4]" onClick={(e) => e.stopPropagation()}>
                    <div className="pt-3 space-y-4">
                      {/* Notes */}
                      <div>
                        <label className="text-[9px] uppercase tracking-[0.1em] font-semibold text-[#9CA3AF] block mb-1">Notes</label>
                        <textarea
                          defaultValue={task.notes ?? ''}
                          onBlur={(e) => saveTaskNotes(task.id, e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-[#EEF0F4] rounded-lg text-[13px] text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 focus:border-[#BC9C45] resize-none"
                          placeholder="Add notes..."
                        />
                      </div>

                      {/* Mark Complete button */}
                      {task.status !== 'completed' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'completed')}
                          className="bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] font-semibold px-5 py-2 rounded-lg text-[12px] shadow-[0_2px_8px_rgba(188,156,69,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(188,156,69,0.25)] transition-all"
                        >
                          Mark Complete
                        </button>
                      )}

                      {/* Attachments */}
                      <div>
                        <label className="text-[9px] uppercase tracking-[0.1em] font-semibold text-[#9CA3AF] block mb-2">Attachments</label>

                        {attachments.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {attachments.map((att) => (
                              <div key={att.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-[#EEF0F4]">
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="#9CA3AF"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-medium text-[#1F2937] truncate">{att.name}</p>
                                  <p className="text-[10px] text-[#9CA3AF]">
                                    {formatBytes(att.file_size)}
                                    {att.file_type ? ` \u00b7 ${att.file_type}` : ''}
                                    {' \u00b7 '}
                                    {formatTaskDate(att.created_at)}
                                  </p>
                                </div>

                                {/* Transparency toggle */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <span className="text-[10px] text-[#6B7280]">Show to investors</span>
                                    <button
                                      onClick={() => toggleTransparency(att, !att.show_to_investors)}
                                      className={`relative w-8 h-[18px] rounded-full transition-colors ${att.show_to_investors ? 'bg-[#0B8A4D]' : 'bg-[#D1D5DB]'}`}
                                    >
                                      <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${att.show_to_investors ? 'left-[16px]' : 'left-[2px]'}`} />
                                    </button>
                                  </label>

                                  {att.show_to_investors && (
                                    <select
                                      value={att.investor_folder_id ?? ''}
                                      onChange={(e) => setAttachmentFolder(att, e.target.value || null)}
                                      className="text-[10px] border border-[#EEF0F4] rounded px-1.5 py-1 bg-white text-[#4B5563] focus:outline-none focus:ring-1 focus:ring-[#BC9C45]/30"
                                    >
                                      <option value="">Select folder...</option>
                                      {ddFolders.map((f) => (
                                        <option key={f.id} value={f.id}>
                                          {f.icon} {f.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload button */}
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-[#CBD5E1] rounded-lg text-[11px] text-[#6B7280] cursor-pointer hover:border-[#BC9C45] hover:text-[#BC9C45] transition-colors">
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
                          {uploading ? 'Uploading...' : 'Upload File'}
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(task.id, file);
                              e.target.value = '';
                            }}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {stageTasks.length === 0 && (
            <div className="flex items-center justify-center h-32 text-[13px] text-[#9CA3AF]">
              No tasks for this stage yet.
            </div>
          )}

          {/* Add task */}
          <div className="px-4 py-3 border-t border-[#EEF0F4]">
            {showAddTask ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setShowAddTask(false); }}
                  placeholder="Task name..."
                  autoFocus
                  className="flex-1 px-3 py-2 border border-[#EEF0F4] rounded-lg text-[13px] text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 focus:border-[#BC9C45]"
                />
                <button
                  onClick={addTask}
                  className="bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] font-semibold px-4 py-2 rounded-lg text-[12px]"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddTask(false); setNewTaskName(''); }}
                  className="text-[#9CA3AF] hover:text-[#6B7280] text-[12px] px-2 py-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddTask(true)}
                className="text-[12px] text-[#6B7280] hover:text-[#BC9C45] transition-colors flex items-center gap-1"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Task
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ════════ RIGHT PANEL — Messages ════════ */}
      <div className="w-[35%] flex flex-col min-h-0 bg-white rounded-xl border border-[#EEF0F4] rp-card-shadow">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#EEF0F4]">
          <h3 className="text-[13px] font-bold text-[#0E3470] uppercase tracking-[0.06em]">Deal Messages</h3>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-32 text-[12px] text-[#9CA3AF]">
              No messages yet. Start the conversation.
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2">
              <div className="w-[24px] h-[24px] rounded-full bg-[#0E3470] text-white flex items-center justify-center text-[9px] font-semibold shrink-0 mt-0.5">
                {getInitials(msg.user_name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-bold text-[#0E3470]">{msg.user_name ?? 'Unknown'}</span>
                  <span className="text-[10px] text-[#9CA3AF]">{formatTimestamp(msg.created_at)}</span>
                </div>
                <p className="text-[13px] text-[#4B5563] mt-0.5 break-words">{msg.message}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-[#EEF0F4]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-[#EEF0F4] rounded-lg text-[13px] text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 focus:border-[#BC9C45]"
            />
            <button
              onClick={sendMessage}
              disabled={!msgInput.trim()}
              className="bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] font-semibold px-4 py-2 rounded-lg text-[12px] disabled:opacity-40 shadow-[0_2px_8px_rgba(188,156,69,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(188,156,69,0.25)] transition-all"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* ════════ Advance Stage Confirmation Modal ════════ */}
      {showAdvanceModal && currentStageRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdvanceModal(false)}>
          <div className="bg-white rounded-2xl border border-[#EEF0F4] shadow-2xl p-6 w-[420px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-bold text-[#0E3470] mb-2">Advance Pipeline Stage</h3>
            <p className="text-[13px] text-[#6B7280] mb-4">
              Mark <strong>{STAGE_LABELS[currentStageRecord.stage as PipelineStage]}</strong> as completed and advance to{' '}
              <strong>{STAGE_LABELS[getNextStage(currentStageRecord.stage as PipelineStage) ?? 'post_closing']}</strong>?
            </p>
            <p className="text-[11px] text-[#9CA3AF] mb-5">
              This will create all tasks for the next stage. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="px-4 py-2 rounded-lg text-[12px] text-[#6B7280] border border-[#EEF0F4] hover:bg-[#F7F8FA] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAdvance}
                className="bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] font-semibold px-5 py-2 rounded-lg text-[12px] shadow-[0_2px_8px_rgba(188,156,69,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(188,156,69,0.25)] transition-all"
              >
                Confirm Advance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close any open menus on outside click */}
      {(menuTaskId || reassignTaskId) && (
        <div className="fixed inset-0 z-20" onClick={() => { setMenuTaskId(null); setReassignTaskId(null); }} />
      )}
    </div>
  );
}
