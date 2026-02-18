'use client';

import { useState, useEffect } from 'react';
import ModelTag from '@/components/ModelTag';
import StatusDot from '@/components/StatusDot';
import { Task, TaskStatus } from '@/types';
import { defaultTasks } from '@/data/tasks';
import { fetchStats, StatsData, ActiveTask, ClaudeCodeData } from '@/lib/api';

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toString();
}

const columns: { key: TaskStatus; label: string; emoji: string; color: string }[] = [
  { key: 'in-progress', label: '进行中', emoji: '🔄', color: 'border-t-blue-500' },
  { key: 'planned', label: '计划中', emoji: '📋', color: 'border-t-yellow-500' },
  { key: 'blocked', label: '阻塞', emoji: '🚫', color: 'border-t-red-500' },
];

const priorityColors: Record<string, string> = {
  '高': 'text-red-400 bg-red-500/10 border-red-500/30',
  '中': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  '低': 'text-gray-400 bg-gray-500/10 border-gray-500/30',
};

const toolIcons: Record<string, string> = {
  browser: '🌐',
  exec: '⚡',
  write: '✏️',
  ssh: '🔒',
  vercel: '▲',
  git: '🔀',
  feishu_doc: '📄',
  feishu: '💬',
  feishu_api: '🔗',
  image: '🖼️',
  mysql: '🗃️',
  web_search: '🔍',
  cron: '⏰',
};

function formatTimeAgo(ts: string, now: number): string {
  if (!ts) return '—';
  const start = new Date(ts).getTime();
  if (isNaN(start)) return '—';
  const diff = now - start;
  if (diff < 0) return '刚刚';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} 小时前`;
}

function getSessionTypeLabel(cwd: string): { label: string; color: string } {
  if (cwd.includes('subagent') || cwd.includes('agent')) {
    return { label: 'subagent', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
  }
  if (cwd.includes('group')) {
    return { label: 'group', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
  }
  return { label: 'main', color: 'bg-green-500/15 text-green-400 border-green-500/30' };
}

export default function TasksPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [showArchived, setShowArchived] = useState(false);
  const [activeTab, setActiveTab] = useState<'realtime' | 'history'>('realtime');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchStats();
      if (cancelled) return;
      if (data) {
        setStats(data);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const activeTasks = defaultTasks.filter(t => t.status !== 'done');
  const archivedTasks = defaultTasks.filter(t => t.status === 'done');

  const tasksTotal = defaultTasks.length;
  const tasksDone = archivedTasks.length;
  const tasksInProgress = defaultTasks.filter(t => t.status === 'in-progress').length;
  const tasksPlanned = defaultTasks.filter(t => t.status === 'planned').length;
  const tasksBlocked = defaultTasks.filter(t => t.status === 'blocked').length;

  const totalPlanTokens = defaultTasks.reduce((s, t) => s + (t.planTokens || 0), 0);
  const totalExecTokens = defaultTasks.reduce((s, t) => s + (t.execTokens || 0), 0);

  // 从 stats 获取实时数据
  const screenTasks: ActiveTask[] = stats?.active_tasks || [];
  const waliQueue = stats?.wali_status?.queue || [];
  const claudeCode = stats?.claude_code;
  const sessions = claudeCode?.sessions || [];

  const renderTaskCard = (task: Task) => {
    const isExpanded = expandedId === task.id;
    return (
      <div
        key={task.id}
        onClick={() => toggleExpand(task.id)}
        className={`
          bg-[#161b22] border rounded-lg p-4 cursor-pointer transition-all duration-200
          ${isExpanded ? 'border-purple-500/50 ring-1 ring-purple-500/20' : 'border-[#30363d] hover:border-[#484f58]'}
        `}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-medium text-white leading-snug flex-1">
            {task.title}
          </h3>
          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded border ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
        </div>

        {/* Planner / Executor */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded" title="规划者">
            🧠 {task.planner}
          </span>
          <span className="text-[#484f58] text-xs">→</span>
          <span className="text-xs text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded" title="执行者">
            ⚙️ {task.executor}
          </span>
        </div>

        {/* Tags: Claude Code / OpenSpec */}
        <div className="flex flex-wrap gap-1 mb-2">
          {task.viaClaudeCode && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/30">
              🏷️ Claude Code
            </span>
          )}
          {task.viaOpenSpec && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              🏷️ OpenSpec
            </span>
          )}
          {task.tools.slice(0, 3).map(tool => (
            <span key={tool} className="text-[10px] px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] border border-[#30363d]">
              {toolIcons[tool] || '🔧'} {tool}
            </span>
          ))}
          {task.tools.length > 3 && (
            <span className="text-[10px] text-[#6e7681]">+{task.tools.length - 3}</span>
          )}
        </div>

        {/* Token consumption + Date */}
        <div className="flex items-center justify-between text-xs text-[#6e7681]">
          <div className="flex items-center gap-2">
            {(task.planTokens || task.execTokens) ? (
              <span className="text-[10px] text-[#484f58]">
                规划 ~{formatTokens(task.planTokens || 0)} / 执行 ~{formatTokens(task.execTokens || 0)}
                {task.tokenSource !== 'session-log' && (
                  <span className="ml-1 text-yellow-600">(预估)</span>
                )}
              </span>
            ) : null}
          </div>
          <span className="text-[#484f58]">{isExpanded ? '▲' : '▼'}</span>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-[#21262d] space-y-3">
            {task.description && (
              <div>
                <div className="text-xs text-[#6e7681] mb-1">📝 描述</div>
                <p className="text-xs text-[#8b949e] leading-relaxed">{task.description}</p>
              </div>
            )}

            {task.subtasks && task.subtasks.length > 0 && (
              <div>
                <div className="text-xs text-[#6e7681] mb-1">📋 子任务 ({task.subtasks.filter(s => s.done).length}/{task.subtasks.length})</div>
                <div className="space-y-1">
                  {task.subtasks.map(st => (
                    <div key={st.id} className="flex items-center gap-2 text-xs">
                      <span className={st.done ? 'text-green-400' : 'text-[#484f58]'}>
                        {st.done ? '☑' : '☐'}
                      </span>
                      <span className={st.done ? 'text-[#8b949e] line-through' : 'text-white'}>
                        {st.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#6e7681]">规划者</span>
                <div className="text-white mt-0.5">{task.planner}</div>
              </div>
              <div>
                <span className="text-[#6e7681]">执行者</span>
                <div className="text-white mt-0.5">{task.executor}</div>
              </div>
              <div>
                <span className="text-[#6e7681]">使用模型</span>
                <div className="text-white mt-0.5">{task.model}</div>
              </div>
              <div>
                <span className="text-[#6e7681]">创建时间</span>
                <div className="text-white mt-0.5">{new Date(task.createdAt).toLocaleDateString('zh-CN')}</div>
              </div>
              {task.completedAt && (
                <div>
                  <span className="text-[#6e7681]">完成时间</span>
                  <div className="text-green-400 mt-0.5">{new Date(task.completedAt).toLocaleDateString('zh-CN')}</div>
                </div>
              )}
              {(task.planTokens || task.execTokens) ? (
                <div>
                  <span className="text-[#6e7681]">Token 消耗 {task.tokenSource !== 'session-log' && <span className="text-yellow-600 text-[10px]">(预估)</span>}</span>
                  <div className="text-white mt-0.5">
                    规划 {formatTokens(task.planTokens || 0)} + 执行 {formatTokens(task.execTokens || 0)}
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <span className="text-xs text-[#6e7681]">执行方式</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {task.viaClaudeCode && (
                  <span className="text-xs px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/30">
                    ✅ Claude Code
                  </span>
                )}
                {task.viaOpenSpec && (
                  <span className="text-xs px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    ✅ OpenSpec-bg
                  </span>
                )}
                {!task.viaClaudeCode && !task.viaOpenSpec && (
                  <span className="text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/30">
                    直接执行 (瓦力/Opus)
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs text-[#6e7681]">工具列表</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {task.tools.map(tool => (
                  <span key={tool} className="text-xs px-2 py-1 rounded-md bg-[#0d1117] text-[#8b949e] border border-[#30363d]">
                    {toolIcons[tool] || '🔧'} {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* OpenSpec Section */}
            {task.viaOpenSpec && (task.openspecProposal || task.openspecTasks) && (
              <div className="col-span-full border-t border-[#21262d] pt-3 mt-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-cyan-400">📦 OpenSpec</span>
                  {task.openspecChange && (
                    <span className="text-[10px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded font-mono">
                      change: {task.openspecChange}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {task.openspecProposal && (
                    <div className="bg-[#0d1117] rounded-lg p-3 border border-cyan-500/20">
                      <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">📄 Proposal</span>
                      <pre className="text-[11px] text-gray-400 mt-1.5 whitespace-pre-wrap font-sans leading-relaxed">{task.openspecProposal}</pre>
                    </div>
                  )}
                  {task.openspecTasks && (
                    <div className="bg-[#0d1117] rounded-lg p-3 border border-green-500/20">
                      <span className="text-[10px] text-green-400 font-medium uppercase tracking-wider">✅ Tasks.md</span>
                      <pre className="text-[11px] text-gray-400 mt-1.5 whitespace-pre-wrap font-sans leading-relaxed">{task.openspecTasks}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 实时 tab 内容
  const renderRealtimeContent = () => (
    <div className="space-y-6">
      {/* Screen 进程 */}
      <div className="bg-[#0d1117] rounded-xl border border-[#30363d] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#21262d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>📺</span>
            <span className="font-semibold text-white text-sm">Screen 进程</span>
            <span className="bg-green-500/15 text-green-400 text-xs font-medium px-2 py-0.5 rounded-full">
              {screenTasks.length} 个
            </span>
          </div>
        </div>
        <div className="p-4">
          {screenTasks.length > 0 ? (
            <div className="space-y-3">
              {screenTasks.map((task, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-[#161b22] rounded-lg border border-[#21262d]">
                  <StatusDot status={task.stale ? 'degraded' : 'healthy'} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{task.name}</div>
                    <div className="text-xs text-[#6e7681] mt-0.5">
                      运行 {task.age_minutes} 分钟 · 最后输出 {task.last_output_minutes} 分钟前
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    task.stale
                      ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                      : 'bg-green-500/15 text-green-400 border border-green-500/30'
                  }`}>
                    {task.stale ? '无响应' : '运行中'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[#6e7681] text-sm">
              暂无活跃的 Screen 进程
            </div>
          )}
        </div>
      </div>

      {/* Claude Code Session 历史 */}
      {claudeCode && (
        <div className="bg-[#0d1117] rounded-xl border border-[#30363d] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#21262d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>💻</span>
              <span className="font-semibold text-white text-sm">Claude Code Session</span>
              <span className="bg-purple-500/15 text-purple-400 text-xs font-medium px-2 py-0.5 rounded-full">
                {sessions.length} 个
              </span>
            </div>
            <span className="text-xs text-[#6e7681]">
              共 {claudeCode.total_events} 事件
            </span>
          </div>
          <div className="p-4">
            {sessions.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {sessions.slice(0, 10).map((session, idx) => {
                  const sessionType = getSessionTypeLabel(session.cwd);
                  return (
                    <div key={session.id || idx} className="flex items-center gap-3 p-3 bg-[#161b22] rounded-lg border border-[#21262d]">
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${sessionType.color}`}>
                        {sessionType.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#8b949e] truncate font-mono" title={session.cwd}>
                          {session.cwd.split('/').slice(-2).join('/')}
                        </div>
                        <div className="text-[10px] text-[#6e7681] mt-0.5">
                          {session.started && formatTimeAgo(session.started, now)} · {session.tools} 工具
                          {session.failures > 0 && <span className="text-red-400 ml-1">· {session.failures} 失败</span>}
                        </div>
                      </div>
                      <StatusDot status={session.ended ? 'healthy' : 'healthy'} size="sm" />
                    </div>
                  );
                })}
                {sessions.length > 10 && (
                  <div className="text-[10px] text-[#6e7681] text-center py-2">
                    还有 {sessions.length - 10} 个更早的 session
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-[#6e7681] text-sm">
                暂无 Session 记录
              </div>
            )}
          </div>
        </div>
      )}

      {/* 待办队列 */}
      <div className="bg-[#0d1117] rounded-xl border border-[#30363d] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#21262d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>📋</span>
            <span className="font-semibold text-white text-sm">待办队列</span>
            <span className="bg-yellow-500/15 text-yellow-400 text-xs font-medium px-2 py-0.5 rounded-full">
              {waliQueue.length} 项
            </span>
          </div>
        </div>
        <div className="p-4">
          {waliQueue.length > 0 ? (
            <div className="space-y-2">
              {waliQueue.map((item, idx) => {
                const taskStr = typeof item === 'string' ? item : item.task;
                const executor = typeof item === 'object' ? item.executor : undefined;
                const planned = typeof item === 'object' ? item.planned : undefined;
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-[#161b22] rounded-lg border border-[#21262d]">
                    <StatusDot status="degraded" size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#c9d1d9] truncate">{taskStr}</div>
                      <div className="text-[10px] text-[#6e7681] mt-0.5 flex gap-2">
                        {executor && <span className="text-purple-400">👤 {executor}</span>}
                        {planned && <span>📅 {planned}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-[#6e7681] text-sm">
              队列为空
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">📋 任务看板</h1>
          <p className="text-sm text-[#8b949e] mt-1">
            共 {tasksTotal} 个任务 · ✅ {tasksDone} 完成 · 🔄 {tasksInProgress} 进行中 · 📋 {tasksPlanned} 计划
            {tasksBlocked > 0 ? ` · 🚫 ${tasksBlocked} 阻塞` : ''}
          </p>
          <p className="text-xs text-[#6e7681] mt-0.5">
            总 Token: 规划 ~{formatTokens(totalPlanTokens)} / 执行 ~{formatTokens(totalExecTokens)} <span className="text-yellow-600">(预估值，真实消耗见模型监控页)</span>
          </p>
        </div>
        <div className="flex gap-2 self-start">
          {/* Tab 切换 */}
          <button
            onClick={() => setActiveTab('realtime')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === 'realtime'
                ? 'bg-green-500/20 border-green-500/50 text-green-400'
                : 'bg-[#21262d] border-[#30363d] text-[#8b949e] hover:text-white'
            }`}
          >
            实时
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === 'history'
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                : 'bg-[#21262d] border-[#30363d] text-[#8b949e] hover:text-white'
            }`}
          >
            历史
          </button>
        </div>
      </div>

      {activeTab === 'realtime' ? (
        renderRealtimeContent()
      ) : (
        <>
          {viewMode === 'board' ? (
            <>
              {/* Active Tasks Board */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {columns.map(col => {
                  const columnTasks = activeTasks.filter(t => t.status === col.key);
                  return (
                    <div
                      key={col.key}
                      className={`bg-[#0d1117] rounded-xl border-t-4 ${col.color} border border-[#30363d] min-h-[300px]`}
                    >
                      <div className="px-4 py-3 border-b border-[#21262d] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{col.emoji}</span>
                          <span className="font-semibold text-white text-sm">{col.label}</span>
                        </div>
                        <span className="bg-[#21262d] text-[#8b949e] text-xs font-medium px-2 py-0.5 rounded-full">
                          {columnTasks.length}
                        </span>
                      </div>
                      <div className="p-3 space-y-3">
                        {columnTasks.map(task => renderTaskCard(task))}
                        {columnTasks.length === 0 && (
                          <div className="text-center py-8 text-[#6e7681] text-sm">
                            暂无任务
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Archived (Done) Tasks - Collapsible */}
              <div className="bg-[#0d1117] rounded-xl border border-[#30363d]">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="w-full px-4 py-3 flex items-center justify-between border-b border-[#21262d] hover:bg-[#161b22] transition-colors rounded-t-xl"
                >
                  <div className="flex items-center gap-2">
                    <span>✅</span>
                    <span className="font-semibold text-white text-sm">已完成 (归档)</span>
                    <span className="bg-[#21262d] text-[#8b949e] text-xs font-medium px-2 py-0.5 rounded-full">
                      {archivedTasks.length}
                    </span>
                  </div>
                  <span className="text-[#484f58] text-sm">{showArchived ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {showArchived && (
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {archivedTasks.map(task => renderTaskCard(task))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* List View */
            <div className="bg-[#0d1117] rounded-xl border border-[#30363d] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#6e7681] border-b border-[#21262d]">
                      <th className="text-left py-3 px-4 font-medium">任务</th>
                      <th className="text-left py-3 px-4 font-medium">状态</th>
                      <th className="text-left py-3 px-4 font-medium">规划者</th>
                      <th className="text-left py-3 px-4 font-medium">执行者</th>
                      <th className="text-left py-3 px-4 font-medium">方式</th>
                      <th className="text-right py-3 px-4 font-medium">Token</th>
                      <th className="text-left py-3 px-4 font-medium">日期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTasks.map(task => {
                      const statusMap: Record<string, { label: string; color: string }> = {
                        done: { label: '✅ 完成', color: 'text-green-400' },
                        'in-progress': { label: '🔄 进行中', color: 'text-blue-400' },
                        planned: { label: '📋 计划', color: 'text-yellow-400' },
                        blocked: { label: '🚫 阻塞', color: 'text-red-400' },
                      };
                      const st = statusMap[task.status];
                      return (
                        <tr
                          key={task.id}
                          onClick={() => toggleExpand(task.id)}
                          className="border-b border-[#161b22] hover:bg-[#161b22] cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="text-white font-medium">{task.title}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={st.color}>{st.label}</span>
                          </td>
                          <td className="py-3 px-4 text-[#8b949e]">{task.planner}</td>
                          <td className="py-3 px-4 text-[#8b949e]">{task.executor}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              {task.viaClaudeCode && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/10 text-green-400">CC</span>
                              )}
                              {task.viaOpenSpec && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-400">OS</span>
                              )}
                              {!task.viaClaudeCode && !task.viaOpenSpec && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400">直接</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-[#6e7681]">
                            {(task.planTokens || task.execTokens)
                              ? `${formatTokens(task.planTokens || 0)}/${formatTokens(task.execTokens || 0)}`
                              : '-'}
                          </td>
                          <td className="py-3 px-4 text-[#6e7681]">
                            {new Date(task.createdAt).toLocaleDateString('zh-CN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Expanded detail */}
              {expandedId && activeTasks.find(t => t.id === expandedId) && (
                <div className="border-t border-[#30363d] p-4 bg-[#161b22]">
                  {(() => {
                    const task = activeTasks.find(t => t.id === expandedId);
                    if (!task) return null;
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold text-white">{task.title}</h3>
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}
                            className="text-xs text-[#8b949e] hover:text-white bg-[#21262d] border border-[#30363d] px-2 py-1 rounded"
                          >
                            ✕ 关闭
                          </button>
                        </div>
                        {task.description && (
                          <p className="text-sm text-[#8b949e] leading-relaxed">{task.description}</p>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[#6e7681]">规划者</span>
                            <div className="text-white mt-0.5">{task.planner}</div>
                          </div>
                          <div>
                            <span className="text-[#6e7681]">执行者</span>
                            <div className="text-white mt-0.5">{task.executor}</div>
                          </div>
                          <div>
                            <span className="text-[#6e7681]">模型</span>
                            <div className="text-white mt-0.5">{task.model}</div>
                          </div>
                          <div>
                            <span className="text-[#6e7681]">Token</span>
                            <div className="text-white mt-0.5">
                              {formatTokens(task.planTokens || 0)}/{formatTokens(task.execTokens || 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Archived section in list view */}
              <div className="border-t border-[#30363d]">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#161b22] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>✅</span>
                    <span className="text-sm text-white font-medium">已完成归档</span>
                    <span className="bg-[#21262d] text-[#8b949e] text-xs px-2 py-0.5 rounded-full">{archivedTasks.length}</span>
                  </div>
                  <span className="text-[#484f58] text-sm">{showArchived ? '▲' : '▼'}</span>
                </button>
                {showArchived && (
                  <table className="w-full text-xs">
                    <tbody>
                      {archivedTasks.map(task => (
                        <tr
                          key={task.id}
                          onClick={() => toggleExpand(task.id)}
                          className="border-b border-[#161b22] hover:bg-[#161b22] cursor-pointer transition-colors opacity-70"
                        >
                          <td className="py-3 px-4">
                            <span className="text-white font-medium">{task.title}</span>
                          </td>
                          <td className="py-3 px-4 text-green-400">✅ 完成</td>
                          <td className="py-3 px-4 text-[#8b949e]">{task.planner}</td>
                          <td className="py-3 px-4 text-[#8b949e]">{task.executor}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              {task.viaClaudeCode && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/10 text-green-400">CC</span>
                              )}
                              {!task.viaClaudeCode && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400">直接</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-[#6e7681]">
                            {formatTokens(task.planTokens || 0)}/{formatTokens(task.execTokens || 0)}
                          </td>
                          <td className="py-3 px-4 text-[#6e7681]">
                            {task.completedAt ? new Date(task.completedAt).toLocaleDateString('zh-CN') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* View mode toggle for history tab */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setViewMode('board')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                viewMode === 'board'
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                  : 'bg-[#21262d] border-[#30363d] text-[#8b949e] hover:text-white'
              }`}
            >
              看板
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                viewMode === 'list'
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                  : 'bg-[#21262d] border-[#30363d] text-[#8b949e] hover:text-white'
              }`}
            >
              列表
            </button>
          </div>
        </>
      )}
    </div>
  );
}
