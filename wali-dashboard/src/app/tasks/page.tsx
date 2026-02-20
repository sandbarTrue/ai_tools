'use client';

import { useState, useEffect } from 'react';
import { fetchStats, StatsData, BusinessTask, ExecutionDetail } from '@/lib/api';

// ========== Helper Functions ==========

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m${s}s`;
}

function formatCost(n: number | null | undefined): string {
  if (!n) return '$0';
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function statusLabel(s: string): { text: string; color: string; bg: string } {
  switch (s) {
    case 'active': return { text: '进行中', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30' };
    case 'done':
    case 'verified':
    case 'notified': return { text: '已完成', color: 'text-[#8b949e]', bg: 'bg-[#21262d] border-[#30363d]' };
    case 'blocked': return { text: '阻塞', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' };
    case 'paused': return { text: '暂停', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' };
    case 'cancelled': return { text: '已终止', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' };
    case 'proposed': return { text: '提案中', color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/30' };
    case 'pending_approval': return { text: '待审批', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30' };
    case 'verifying': return { text: '验收中', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' };
    case 'verify_failed': return { text: '验收失败', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' };
    default: return { text: s, color: 'text-[#8b949e]', bg: 'bg-[#21262d] border-[#30363d]' };
  }
}

function execStatusStyle(s: string): { dot: string; label: string; badge: string; icon: string } {
  switch (s) {
    case 'success':
    case 'completed':
    case 'done':
    case 'verified':
      return { dot: 'bg-green-400', label: '成功', badge: 'bg-green-500/15 text-green-400 border-green-500/30', icon: '✅' };
    case 'failed':
      return { dot: 'bg-red-400', label: '失败', badge: 'bg-red-500/15 text-red-400 border-red-500/30', icon: '❌' };
    case 'running':
      return { dot: 'bg-yellow-400 animate-pulse', label: '运行中', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: '⏳' };
    default:
      return { dot: 'bg-gray-400', label: '待执行', badge: 'bg-[#21262d] text-[#8b949e] border-[#30363d]', icon: '⏸️' };
  }
}

function stepStatusIcon(state: string): string {
  switch (state) {
    case 'completed': return '✅';
    case 'running': return '⏳';
    case 'failed': return '❌';
    default: return '⏸️';
  }
}

// ========== Components ==========

// L3 步骤列表组件
function StepsList({ steps }: { steps: ExecutionDetail['steps'] }) {
  if (!steps || steps.length === 0) return null;

  const completed = steps.filter(s => s.state === 'completed').length;

  return (
    <div className="mt-2 space-y-1">
      <div className="text-[10px] text-[#6e7681] uppercase tracking-wider">
        步骤 {completed}/{steps.length}
      </div>
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-center gap-2 text-[11px] pl-2">
          <span>{stepStatusIcon(step.state)}</span>
          <span className={step.state === 'completed' ? 'text-[#8b949e]' : 'text-white'}>
            {step.name}
          </span>
          {step.files && step.files.length > 0 && (
            <span className="text-[#484f58] truncate" title={step.files.join(', ')}>
              [{step.files[0]}{step.files.length > 1 ? ` +${step.files.length - 1}` : ''}]
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// L2 执行记录卡片组件
function ExecutionCard({ exec, defaultOpen = false }: { exec: ExecutionDetail; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const st = execStatusStyle(exec.status);
  const hasSteps = exec.steps && exec.steps.length > 0;

  return (
    <details open={defaultOpen} className="group">
      <summary
        onClick={(e) => { e.preventDefault(); setOpen(!open); }}
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#161b22] transition-colors list-none [&::-webkit-details-marker]:hidden"
      >
        {/* Executor Icon */}
        <span className="text-lg" title={exec.executor}>{exec.executor_icon}</span>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white font-medium truncate">
            {exec.name}
          </div>
          <div className="text-[10px] text-[#6e7681] mt-0.5 flex items-center gap-2 flex-wrap">
            {exec.model && <span className="text-purple-400">{exec.model}</span>}
            {exec.duration_ms && <span>· {formatDuration(exec.duration_ms)}</span>}
            {exec.cost_usd && exec.cost_usd > 0 && <span className="text-cyan-400">· {formatCost(exec.cost_usd)}</span>}
            {exec.retry_of && <span className="text-orange-400" title={`重试自 ${exec.retry_of}`}>🔄 重试</span>}
          </div>
        </div>

        {/* Verify Result */}
        {exec.verify_result && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
            exec.verify_result.passed === exec.verify_result.total
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            验收: {exec.verify_result.passed}/{exec.verify_result.total} {exec.verify_result.passed === exec.verify_result.total ? '✅' : '❌'}
          </span>
        )}

        {/* Status Badge */}
        <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${st.badge}`}>
          {st.label}
        </span>

        {/* Expand Arrow */}
        {hasSteps && (
          <span className="text-[#484f58] text-xs group-open:rotate-180 transition-transform">
            ▼
          </span>
        )}
      </summary>

      {/* Expanded L3 Steps */}
      {hasSteps && (
        <div className="px-3 pb-3 pt-1 bg-[#0d1117] border-t border-[#21262d]">
          <StepsList steps={exec.steps} />
        </div>
      )}

      {/* Error Info */}
      {exec.status === 'failed' && exec.error && (
        <div className="px-3 pb-3 pt-1 bg-red-500/5 border-t border-red-500/20">
          <div className="text-[10px] text-red-400 font-medium mb-1">错误信息</div>
          <p className="text-[11px] text-red-400">{exec.error}</p>
        </div>
      )}
    </details>
  );
}

// L1 任务卡片组件
function TaskCard({
  task,
  isSelected,
  onClick
}: {
  task: BusinessTask;
  isSelected: boolean;
  onClick: () => void;
}) {
  const st = statusLabel(task.status);
  const execDetails = task.executionDetails || [];
  const totalExecs = execDetails.length;
  const successExecs = execDetails.filter(e => e.status === 'success').length;
  const totalSteps = execDetails.reduce((sum, e) => sum + (e.steps?.length || 0), 0);
  const completedSteps = execDetails.reduce((sum, e) => sum + (e.steps?.filter(s => s.state === 'completed')?.length || 0), 0);

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'bg-[#161b22] border-purple-500/50 ring-1 ring-purple-500/20'
          : 'bg-[#0d1117] border-[#21262d] hover:border-[#30363d]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-medium ${task.status === 'done' || task.status === 'notified' ? 'text-[#8b949e]' : 'text-white'}`}>
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
        {totalExecs > 0 && (
          <span className={successExecs === totalExecs ? 'text-green-400' : (successExecs < totalExecs && successExecs > 0) ? 'text-yellow-400' : ''}>
            ⚡ {totalExecs} 次执行 ({successExecs} 成功 / {totalExecs - successExecs} 失败)
          </span>
        )}
        {totalSteps > 0 && (
          <span>
            📋 {completedSteps}/{totalSteps} 步骤
          </span>
        )}
      </div>
    </div>
  );
}

// 工作流进度条组件
function WorkflowProgressBar({ task }: { task: BusinessTask }) {
  const execDetails = task.executionDetails || [];

  // 计算工作流阶段状态
  const hasProposal = !!task.proposal;
  const hasExecutions = execDetails.length > 0;
  const allSuccess = hasExecutions && execDetails.every(e => e.status === 'success');
  const isDone = task.status === 'done' || task.status === 'notified' || task.status === 'verified';

  const stageConfig = [
    { key: 'proposal', label: '提案', icon: '📝', done: hasProposal },
    { key: 'execution', label: '执行', icon: '🔧', done: allSuccess, inProgress: hasExecutions && !allSuccess },
    { key: 'review', label: '验收', icon: '✅', done: isDone },
  ];

  const getStyle = (done: boolean, inProgress: boolean) => {
    if (done) return { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-400' };
    if (inProgress) return { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-400' };
    return { bg: 'bg-gray-600', border: 'border-gray-600', text: 'text-gray-500' };
  };

  return (
    <div className="flex items-center justify-between py-3">
      {stageConfig.map((stage, idx) => {
        const style = getStyle(stage.done, stage.inProgress || false);
        return (
          <div key={stage.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${style.bg} flex items-center justify-center text-white text-sm`}>
                {stage.icon}
              </div>
              <span className={`text-xs mt-1 ${style.text}`}>{stage.label}</span>
            </div>
            {idx < stageConfig.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${stage.done ? 'bg-green-500' : 'bg-gray-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
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

// ========== Main Page ==========

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
  const tasksResult = waliStatus?.tasks || null;
  const tasks: BusinessTask[] = tasksResult?.tasks || [];

  // Auto-select first active task
  const selectedTask = tasks.find(t => t.id === selectedTaskId) ||
                       tasks.find(t => t.status === 'active') ||
                       tasks[0];

  const execDetails = selectedTask?.executionDetails || [];

  // Stats
  const totalExecs = execDetails.length;
  const successExecs = execDetails.filter(e => e.status === 'success').length;
  const totalCost = execDetails.reduce((sum, e) => sum + (e.cost_usd || 0), 0);
  const totalDuration = execDetails.reduce((sum, e) => sum + (e.duration_ms || 0), 0);
  const cancelledCount = tasks.filter(t => t.status === 'cancelled').length;

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
          {tasksResult ? `${tasksResult.active || 0} 个进行中 · ${tasksResult.completed || 0} 个已完成${cancelledCount > 0 ? ` · ${cancelledCount} 个已终止` : ''} · 共 ${tasksResult.total || tasks.length} 个任务` : '加载中...'}
        </p>
      </div>

      {/* 两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 左栏：L1 任务列表 */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs text-[#8b949e] uppercase tracking-wider mb-3 font-medium">业务任务 (L1)</div>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              isSelected={selectedTask?.id === task.id}
              onClick={() => setSelectedTaskId(task.id)}
            />
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-8 text-[#6e7681] text-sm">暂无任务</div>
          )}
        </div>

        {/* 右栏：选中任务的详情 + L2 执行记录 + L3 步骤 */}
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
                  <WorkflowProgressBar task={selectedTask} />
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

              {/* 提案摘要卡片 */}
              {selectedTask.proposal && (
                <ProposalCard proposal={selectedTask.proposal} />
              )}

              {/* L2 执行记录列表 */}
              <div className="bg-[#0d1117] rounded-xl border border-[#30363d] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#21262d] flex items-center gap-2">
                  <span>⚡</span>
                  <span className="font-semibold text-white text-sm">执行记录 (L2)</span>
                  <span className="text-xs text-[#6e7681]">({execDetails.length})</span>
                </div>
                <div className="divide-y divide-[#21262d]">
                  {execDetails.length > 0 ? (
                    execDetails.map((exec, idx) => (
                      <ExecutionCard key={exec.id} exec={exec} defaultOpen={idx === 0} />
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-[#6e7681] text-sm">
                      暂无执行记录
                    </div>
                  )}
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
