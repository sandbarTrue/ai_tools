'use client';

import { useState, useEffect } from 'react';
import ModelTag from '@/components/ModelTag';
import { fetchStats, StatsData, WaliExecution } from '@/lib/api';

// 业务任务类型
interface BusinessTask {
  id: string;
  title: string;
  status: string; // active | done | blocked | paused
  source: string;
  goal: string;
  executions: string[]; // execution ids
  proposal?: string; // task-level proposal from proposals/ directory
  manualExecs?: { title: string; done: boolean; tool: string; note: string }[];
  createdAt?: string;
}

interface TasksResult {
  total: number;
  completed: number;
  active: number;
  tasks: BusinessTask[];
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 60000) return `${Math.round(ms / 1000)}秒`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}分${s}秒`;
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return '$0';
}

function statusLabel(s: string): { text: string; color: string; bg: string } {
  switch (s) {
    case 'active': return { text: '进行中', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30' };
    case 'done': return { text: '已完成', color: 'text-[#8b949e]', bg: 'bg-[#21262d] border-[#30363d]' };
    case 'blocked': return { text: '阻塞', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' };
    case 'paused': return { text: '暂停', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' };
    default: return { text: s, color: 'text-[#8b949e]', bg: 'bg-[#21262d] border-[#30363d]' };
  }
}

function execStatusStyle(s: string): { dot: string; label: string; badge: string } {
  switch (s) {
    case 'success': return { dot: 'bg-green-400', label: '成功', badge: 'bg-green-500/15 text-green-400 border-green-500/30' };
    case 'failed': return { dot: 'bg-red-400', label: '失败', badge: 'bg-red-500/15 text-red-400 border-red-500/30' };
    case 'running': return { dot: 'bg-yellow-400 animate-pulse', label: '运行中', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' };
    default: return { dot: 'bg-gray-400', label: '未知', badge: 'bg-[#21262d] text-[#8b949e] border-[#30363d]' };
  }
}

// 工作流阶段状态
type WorkflowStageStatus = 'completed' | 'in_progress' | 'not_started';

interface WorkflowStages {
  proposal: WorkflowStageStatus;
  execution: WorkflowStageStatus;
  review: WorkflowStageStatus;
}

// 计算工作流阶段状态
function getWorkflowStages(task: BusinessTask, execs: WaliExecution[]): WorkflowStages {
  // 执行: 有任何 execution → 进行中; 全部 success → 已完成
  let execution: WorkflowStageStatus = 'not_started';
  if (execs.length > 0) {
    const allSuccess = execs.every(e => e.status === 'success');
    execution = allSuccess ? 'completed' : 'in_progress';
  }

  // 验收: task.status === 'done' → 已完成
  const review: WorkflowStageStatus = task.status === 'done' ? 'completed' : 'not_started';

  // 提案: task.proposal 存在 OR execution 有 proposal → 已完成
  const hasTaskProposal = !!task.proposal;
  const hasExecProposal = execs.some(e => (e as any).proposal);
  const proposal: WorkflowStageStatus = (hasTaskProposal || hasExecProposal || execution === 'completed' || review === 'completed')
    ? 'completed'
    : 'not_started';

  return { proposal, execution, review };
}

// 工作流进度条组件
function WorkflowProgressBar({ stages }: { stages: WorkflowStages }) {
  const stageConfig = [
    { key: 'proposal', label: '提案', icon: '📝' },
    { key: 'execution', label: '执行', icon: '🔧' },
    { key: 'review', label: '验收', icon: '✅' },
  ] as const;

  const getStyle = (status: WorkflowStageStatus) => {
    switch (status) {
      case 'completed': return { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-400', label: '已完成' };
      case 'in_progress': return { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-400', label: '进行中' };
      default: return { bg: 'bg-gray-600', border: 'border-gray-600', text: 'text-gray-500', label: '未开始' };
    }
  };

  return (
    <div className="flex items-center justify-between py-3">
      {stageConfig.map((stage, idx) => {
        const status = stages[stage.key];
        const style = getStyle(status);
        return (
          <div key={stage.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${style.bg} flex items-center justify-center text-white text-sm`}>
                {stage.icon}
              </div>
              <span className={`text-xs mt-1 ${style.text}`}>{stage.label}</span>
              <span className="text-[10px] text-[#6e7681]">{style.label}</span>
            </div>
            {idx < stageConfig.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${stages[stage.key] === 'completed' ? 'bg-green-500' : 'bg-gray-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// 验证提案内容与任务标题是否相关
function isProposalRelevant(proposal: string, taskTitle: string): boolean {
  if (!proposal || !taskTitle) return false;

  // 提取任务标题中的关键词（过滤停用词）
  const stopWords = new Set(['的', '与', '和', '及', '或', '在', '对', '为', '了', '中', '以', '及', '到', '从', '将', '被', '把', '让', '给', '向', '等', '、', '，', '。', '+']);

  // 从任务标题提取关键词（保留中文字符、英文单词、数字）
  const taskKeywords = taskTitle
    .split(/[\s+/\\\-_:]+/)
    .filter(word => word.length >= 2 && !stopWords.has(word))
    .flatMap(word => {
      // 中文按2-4字拆分
      if (/[\u4e00-\u9fa5]/.test(word)) {
        const result: string[] = [];
        for (let i = 0; i < word.length - 1; i++) {
          result.push(word.slice(i, i + 2));
          if (i < word.length - 2) result.push(word.slice(i, i + 3));
        }
        return result;
      }
      return [word.toLowerCase()];
    });

  if (taskKeywords.length === 0) return true; // 无法提取关键词时默认显示

  // 检查提案中是否包含任务关键词
  const proposalLower = proposal.toLowerCase();
  const matchCount = taskKeywords.filter(kw => proposalLower.includes(kw.toLowerCase())).length;

  // 至少匹配20%的关键词
  return matchCount >= Math.max(1, taskKeywords.length * 0.2);
}

// 提案摘要卡片组件
function ProposalCard({ proposal }: { proposal: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = proposal.split('\n');
  const preview = lines.slice(0, 2).join('\n');
  const needsExpand = lines.length > 2 || proposal.length > 100;

  return (
    <div className="bg-[#161b22] rounded-lg border border-cyan-500/20 overflow-hidden">
      <div className="px-3 py-2 border-b border-[#21262d] flex items-center justify-between">
        <span className="text-xs text-cyan-400 font-medium">📄 提案摘要</span>
        {needsExpand && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
          >
            {expanded ? '收起 ▲' : '展开 ▼'}
          </button>
        )}
      </div>
      <div className="p-3">
        <pre className="text-[11px] text-[#8b949e] whitespace-pre-wrap font-sans leading-relaxed">
          {expanded ? proposal : preview}
        </pre>
      </div>
    </div>
  );
}

// 分派优先级卡片
function DispatchPriorityCard() {
  return (
    <div className="bg-[#0d1117] rounded-lg border border-[#21262d] p-3 mt-4">
      <div className="text-xs text-[#8b949e] font-medium mb-2">🔀 分派优先级</div>
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-mono">1.</span>
          <span className="text-white">Claude Code + GLM-5</span>
          <span className="text-[#6e7681]">(编码)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-mono">2.</span>
          <span className="text-white">GLM-5 子agent</span>
          <span className="text-[#6e7681]">(文本)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-orange-400 font-mono">3.</span>
          <span className="text-white">MiniMax-M2.5 子agent</span>
          <span className="text-[#6e7681]">(备选)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-mono">4.</span>
          <span className="text-white">Opus 4.6</span>
          <span className="text-[#6e7681]">(兜底，需报备)</span>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchStats();
      if (cancelled) return;
      if (data) setStats(data);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const waliStatus = stats?.wali_status as any;
  const tasksResult: TasksResult | null = waliStatus?.tasks || null;
  const allExecutions: WaliExecution[] = waliStatus?.executions || [];
  const tasks = tasksResult?.tasks || [];

  // Auto-select first active task
  const selectedTask = tasks.find(t => t.id === selectedTaskId) || tasks.find(t => t.status === 'active') || tasks[0];
  const taskExecs = selectedTask
    ? selectedTask.executions.map(eid => allExecutions.find(e => e.id === eid)).filter((e): e is WaliExecution => !!e)
    : [];

  // Manual executions from TASK.md
  const manualExecs = selectedTask?.manualExecs || [];

  // Stats
  const totalExecs = taskExecs.length + manualExecs.length;
  const successExecs = taskExecs.filter(e => e.status === 'success').length + manualExecs.filter(e => e.done).length;
  const totalCost = taskExecs.reduce((sum, e) => sum + (e.cost || 0), 0);
  const totalDuration = taskExecs.reduce((sum, e) => sum + (e.duration_ms || 0), 0);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8b949e] text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">📋 任务看板</h1>
        <p className="text-sm text-[#8b949e] mt-1">
          {tasksResult ? `${tasksResult.active} 个进行中 · ${tasksResult.completed} 个已完成 · 共 ${tasksResult.total} 个任务` : '加载中...'}
        </p>
      </div>

      {/* 两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 左栏：业务任务列表 */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs text-[#8b949e] uppercase tracking-wider mb-3 font-medium">业务任务</div>
          {tasks.map(task => {
            const st = statusLabel(task.status);
            const isSelected = selectedTask?.id === task.id;
            const execCount = task.executions.length;
            const manualCount = (task.manualExecs || []).length;
            const manualDone = (task.manualExecs || []).filter((m: any) => m.done).length;
            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#161b22] border-purple-500/50 ring-1 ring-purple-500/20'
                    : 'bg-[#0d1117] border-[#21262d] hover:border-[#30363d]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${task.status === 'done' ? 'text-[#8b949e]' : 'text-white'}`}>
                    {task.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${st.bg} ${st.color}`}>
                    {st.text}
                  </span>
                </div>
                {task.goal && (
                  <p className="text-[11px] text-[#6e7681] mt-1 line-clamp-1">{task.goal}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-[#484f58]">
                  {task.source && <span>📎 {task.source}</span>}
                  {manualCount > 0 && <span>📋 {manualDone}/{manualCount} 子任务</span>}
                  {execCount > 0 && <span>⚡ {execCount} 次执行</span>}
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <div className="text-center py-8 text-[#6e7681] text-sm">暂无任务</div>
          )}
        </div>

        {/* 右栏：选中任务的详情 + Execution 列表 */}
        <div className="lg:col-span-8">
          {selectedTask ? (
            <div className="space-y-4">
              {/* 任务摘要 */}
              <div className="bg-[#0d1117] rounded-xl border border-[#30363d] p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-white">{selectedTask.title}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded border ${statusLabel(selectedTask.status).bg} ${statusLabel(selectedTask.status).color}`}>
                    {statusLabel(selectedTask.status).text}
                  </span>
                </div>
                {selectedTask.goal && (
                  <p className="text-sm text-[#8b949e] mb-3">{selectedTask.goal}</p>
                )}

                {/* 工作流进度条 */}
                <div className="bg-[#161b22] rounded-lg p-3 mb-3">
                  <div className="text-[10px] text-[#6e7681] uppercase tracking-wider mb-2">工作流</div>
                  <WorkflowProgressBar stages={getWorkflowStages(selectedTask, taskExecs)} />
                </div>

                {/* 汇总统计 */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-[#161b22] rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-white">{totalExecs}</div>
                    <div className="text-[10px] text-[#6e7681]">执行次数</div>
                  </div>
                  <div className="bg-[#161b22] rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-green-400">{successExecs}</div>
                    <div className="text-[10px] text-[#6e7681]">成功</div>
                  </div>
                  <div className="bg-[#161b22] rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-purple-400">{formatCost(totalCost)}</div>
                    <div className="text-[10px] text-[#6e7681]">总费用</div>
                  </div>
                  <div className="bg-[#161b22] rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-cyan-400">{formatDuration(totalDuration)}</div>
                    <div className="text-[10px] text-[#6e7681]">总耗时</div>
                  </div>
                </div>
              </div>

              {/* 提案摘要卡片 - 在执行记录上方 */}
              {(() => {
                // 优先从 task.proposal 读（proposals/ 目录，task_id 关联）
                const taskProposal = selectedTask.proposal;
                console.log('[DEBUG] selectedTask.proposal:', !!taskProposal, 'keys:', Object.keys(selectedTask));
                if (taskProposal) {
                  return <ProposalCard proposal={taskProposal} />;
                }
                // 回退：从关联 execution 的 proposal 读
                const matchedExec = taskExecs.find(e => (e as any).matched_task === selectedTask.id && (e as any).proposal);
                const firstProposalExec = matchedExec || taskExecs.find(e => (e as any).proposal);
                const proposalText = firstProposalExec && (firstProposalExec as any).proposal;
                const isRelevant = proposalText && (
                  (firstProposalExec && (firstProposalExec as any).matched_task === selectedTask.id) ||
                  isProposalRelevant(proposalText, selectedTask.title)
                );
                return isRelevant ? (
                  <ProposalCard proposal={proposalText} />
                ) : null;
              })()}

              {/* Execution 列表 */}
              <div className="bg-[#0d1117] rounded-xl border border-[#30363d] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#21262d] flex items-center gap-2">
                  <span>⚡</span>
                  <span className="font-semibold text-white text-sm">执行记录</span>
                  <span className="text-xs text-[#6e7681]">({taskExecs.length + manualExecs.length})</span>
                </div>
                <div className="divide-y divide-[#21262d]">
                  {/* 手动执行记录（来自 TASK.md） */}
                  {manualExecs.length > 0 && manualExecs.map((me, idx) => (
                    <div key={`manual-${idx}`} className="flex items-center gap-3 px-4 py-3">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${me.done ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white font-medium">{me.title}</div>
                        <div className="text-[10px] text-[#6e7681] mt-0.5 flex items-center gap-2">
                          {me.tool && <span className="text-cyan-400">🔧 {me.tool}</span>}
                          {me.note && <><span>·</span><span>{me.note}</span></>}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${
                        me.done ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                      }`}>
                        {me.done ? '完成' : '进行中'}
                      </span>
                    </div>
                  ))}
                  {/* Claude Code / OpenSpec 执行记录 */}
                  {taskExecs.length > 0 ? taskExecs.map(exec => {
                    const st = execStatusStyle(exec.status);
                    return (
                      <details key={exec.id} className="group">
                        <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#161b22] transition-colors list-none [&::-webkit-details-marker]:hidden">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white font-medium truncate">
                              {exec.task_title || '(无标题)'}
                            </div>
                            <div className="text-[10px] text-[#6e7681] mt-0.5 flex items-center gap-2 flex-wrap">
                              <span className="text-purple-400">{exec.model}</span>
                              <span>·</span>
                              <span>{formatDuration(exec.duration_ms)}</span>
                              {exec.cost > 0 && <><span>·</span><span className="text-cyan-400">{formatCost(exec.cost)}</span></>}
                              {(exec as any).project && <><span>·</span><span className="text-[#484f58]">📁 {(exec as any).project}</span></>}
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${st.badge}`}>
                            {st.label}
                          </span>
                          <span className="text-[#484f58] text-xs group-open:rotate-180 transition-transform">▼</span>
                        </summary>

                        {/* 展开详情 */}
                        <div className="px-4 pb-3 space-y-3 bg-[#0d1117]">
                          {/* 执行信息 */}
                          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-[#21262d]">
                            <div>
                              <span className="text-[#6e7681]">执行工具</span>
                              <div className="text-cyan-400 mt-0.5 font-medium">
                                {(exec as any).tool || (exec.type === 'openspec' ? 'OpenSpec + Claude Code' : 'Claude Code')}
                              </div>
                            </div>
                            <div>
                              <span className="text-[#6e7681]">模型</span>
                              <div className="text-purple-400 mt-0.5 font-medium">{exec.model}</div>
                            </div>
                            <div>
                              <span className="text-[#6e7681]">开始</span>
                              <div className="text-[#8b949e] mt-0.5">
                                {exec.started_at ? new Date(exec.started_at).toLocaleString('zh-CN') : '—'}
                              </div>
                            </div>
                            <div>
                              <span className="text-[#6e7681]">结束</span>
                              <div className="text-[#8b949e] mt-0.5">
                                {exec.finished_at ? new Date(exec.finished_at).toLocaleString('zh-CN') : '—'}
                              </div>
                            </div>
                          </div>

                          {/* OpenSpec 提案 */}
                          {exec.proposal && (
                            <div className="bg-[#161b22] rounded-lg p-3 border border-cyan-500/20">
                              <div className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider mb-1">📄 提案</div>
                              <pre className="text-[11px] text-[#8b949e] whitespace-pre-wrap font-sans leading-relaxed">
                                {exec.proposal}
                              </pre>
                            </div>
                          )}

                          {/* 子任务（openspec tasks.md） */}
                          {exec.tasks && exec.tasks.length > 0 && (
                            <div>
                              <div className="text-[10px] text-[#6e7681] uppercase tracking-wider mb-1.5">
                                📝 子任务 ({exec.tasks.filter((t: any) => typeof t === 'object' ? t.done : true).length}/{exec.tasks.length})
                              </div>
                              <div className="space-y-1">
                                {exec.tasks.map((task: any, idx: number) => {
                                  const title = typeof task === 'object' ? task.title : task;
                                  const done = typeof task === 'object' ? task.done : true;
                                  return (
                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                      <span className={done ? 'text-green-400' : 'text-yellow-400'}>{done ? '☑' : '☐'}</span>
                                      <span className={done ? 'text-[#8b949e]' : 'text-white'}>{title}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 失败原因 */}
                          {exec.status === 'failed' && exec.fail_reason && (
                            <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30">
                              <div className="text-[10px] text-red-400 font-medium mb-1">❌ 失败原因</div>
                              <p className="text-[11px] text-red-400">{exec.fail_reason}</p>
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  }) : manualExecs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[#6e7681] text-sm">
                      暂无执行记录
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-[#6e7681] text-sm">
              ← 选择一个任务查看详情
            </div>
          )}
        </div>
      </div>

      {/* 分派优先级说明 */}
      <DispatchPriorityCard />
    </div>
  );
}
