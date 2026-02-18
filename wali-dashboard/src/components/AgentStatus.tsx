'use client';

import { useEffect, useState } from 'react';
import StatusDot from '@/components/StatusDot';
import { StatsData, WaliStatusData, TaskProgress } from '@/lib/api';

export interface ActiveTask {
  id: string;
  task: string;
  executor?: string;
  model?: string;
  status: 'running' | 'stale' | 'completed' | 'blocked' | 'idle';
  startedAt: string;
  logTail?: string;
}

interface AgentStatusProps {
  stats: StatsData | null;
  isLive: boolean;
}

function parseTimestamp(ts: string): number {
  if (!ts) return 0;
  const d = new Date(ts);
  if (!isNaN(d.getTime())) return d.getTime();
  const clean = ts.replace(/[+-]\d{2}:\d{2}$/, '');
  return new Date(clean).getTime() - 8 * 3600000;
}

function formatElapsed(startedAt: string, now: number): string {
  if (!startedAt) return '—';
  const start = parseTimestamp(startedAt);
  const diff = now - start;
  if (diff < 0 || isNaN(diff) || start === 0) return '刚刚开始';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '不到 1 分钟';
  if (mins < 60) return `${mins} 分钟`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs} 小时 ${remainMins} 分钟` : `${hrs} 小时`;
}

function formatTimeAgo(ts: string, now: number): string {
  if (!ts) return '—';
  const start = parseTimestamp(ts);
  const diff = now - start;
  if (diff < 0 || isNaN(diff) || start === 0) return '刚刚';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} 小时前`;
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'running':
    case 'working':
      return { dot: 'bg-green-400', bar: 'bg-green-500', label: '运行中', pulse: true };
    case 'stale':
      return { dot: 'bg-yellow-400', bar: 'bg-yellow-500', label: '无响应', pulse: false };
    case 'blocked':
    case 'investigating':
      return { dot: 'bg-red-400', bar: 'bg-red-500', label: '卡住', pulse: true };
    case 'completed':
      return { dot: 'bg-gray-400', bar: 'bg-gray-500', label: '已完成', pulse: false };
    case 'idle':
      return { dot: 'bg-blue-400', bar: 'bg-blue-500', label: '空闲', pulse: false };
    default:
      return { dot: 'bg-gray-400', bar: 'bg-gray-500', label: '待命', pulse: false };
  }
}

function getQueueStatusStyle(status: string) {
  switch (status) {
    case '进行中':
      return 'bg-green-500/15 text-green-400 border-green-500/30';
    case '计划中':
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    case '排队中':
    default:
      return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  }
}

// 从 executor 字符串提取模型名称
function extractModel(executor?: string): string {
  if (!executor) return '';
  if (executor.includes('Opus')) return 'Claude Opus 4.6';
  if (executor.includes('GLM-5')) return 'GLM-5';
  if (executor.includes('GLM-4')) return 'GLM-4';
  return '';
}

export default function AgentStatus({ stats, isLive }: AgentStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const waliStatus = stats?.wali_status;
  const activeTasks: ActiveTask[] = (stats as any)?.active_tasks || [];

  // 从 wali_status 构建当前任务显示
  const displayTasks: ActiveTask[] = activeTasks.length > 0
    ? activeTasks
    : waliStatus && waliStatus.status !== 'idle'
      ? [{
          id: 'wali-current',
          task: waliStatus.currentTask || '未知任务',
          executor: waliStatus.executor,
          model: extractModel(waliStatus.executor),
          status: waliStatus.status === 'working' ? 'running' :
                  waliStatus.status === 'investigating' ? 'blocked' :
                  waliStatus.status === 'blocked' ? 'blocked' : 'stale',
          startedAt: waliStatus.startedAt,
        }]
      : [];

  // 获取队列和最近操作（带空值保护）
  const queue = (waliStatus?.queue || []) as Array<{ task: string; executor?: string; planned?: string; status?: string }>;
  const recentActions = waliStatus?.recentActions || [];
  const lastUpdate = waliStatus?.lastUpdate;

  // 获取任务进度（从 wali_status.taskProgress 或 stats.task_progress）
  const taskProgress: TaskProgress | undefined = (waliStatus as any)?.taskProgress || (stats as any)?.task_progress;

  if (!isLive && displayTasks.length === 0) {
    return null;
  }

  if (displayTasks.length === 0) {
    return (
      <div className="relative border border-gray-700 bg-gray-800/50 rounded-xl overflow-hidden">
        <div className="h-1 bg-blue-500" />
        <div className="p-4 sm:p-6 flex items-center gap-2 text-gray-400">
          <span className="text-lg">🤖</span>
          <span className="font-medium">瓦力待命中</span>
          <span className="relative flex h-3 w-3 shrink-0 ml-1">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400" />
          </span>
          {lastUpdate && (
            <span className="text-[11px] text-gray-500 ml-auto">
              {formatTimeAgo(lastUpdate, now)}更新
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayTasks.map((task, idx) => {
        const style = getStatusStyle(task.status);
        return (
          <div key={task.id || idx} className="relative border border-gray-700 bg-gray-800/50 rounded-xl overflow-hidden">
            <div className={`h-1 ${style.bar}`} />
            <div className="p-4 sm:p-6">
              {/* 任务标题行 */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-lg sm:text-xl">🤖</span>
                  <h2 className="text-base sm:text-lg font-bold text-white truncate">
                    {task.task}
                  </h2>
                  <span className="relative flex h-3 w-3 shrink-0">
                    {style.pulse && (
                      <span className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${style.dot} opacity-75`} />
                    )}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${style.dot}`} />
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded-full">
                    {style.label}
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0">
                  {formatTimeAgo(lastUpdate || task.startedAt, now)}更新
                </span>
              </div>

              {/* 执行者和模型标签 */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {task.executor && (
                  <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                    ⚙️ {task.executor}
                  </span>
                )}
                {task.model && (
                  <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    🧠 {task.model}
                  </span>
                )}
              </div>

              {/* 已运行时间 */}
              {task.startedAt && (
                <div className="text-sm text-gray-400 mb-4">
                  ⏱ 已进行 <span className="text-white font-medium">{formatElapsed(task.startedAt, now)}</span>
                </div>
              )}

              {/* 待办队列 + 任务进度 */}
              <div className="mb-4 flex flex-col sm:flex-row gap-4">
                {/* 待办队列 */}
                {queue.length > 0 && (
                  <div className="flex-1">
                    <h3 className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                      📋 待办队列 ({queue.length})
                    </h3>
                    <div className="space-y-2">
                      {queue.slice(0, 3).map((item, qIdx) => (
                        <div key={qIdx} className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg border border-gray-700/50">
                          <span className="text-[11px] text-gray-400 truncate flex-1">
                            {item.task}
                          </span>
                          {item.executor && (
                            <span className="text-[10px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">
                              {item.executor}
                            </span>
                          )}
                          {item.status && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getQueueStatusStyle(item.status)}`}>
                              {item.status}
                            </span>
                          )}
                        </div>
                      ))}
                      {queue.length > 3 && (
                        <div className="text-[10px] text-gray-500 text-center">
                          +{queue.length - 3} 更多
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 任务进度 */}
                {taskProgress && (
                  <div className={queue.length > 0 ? 'sm:w-48 shrink-0' : 'flex-1'}>
                    <h3 className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                      📊 任务进度
                    </h3>
                    <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">总进度</span>
                        <span className="text-sm font-bold text-green-400">{taskProgress.percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-2 bg-gradient-to-r from-green-500 to-cyan-500 rounded-full transition-all duration-700"
                          style={{ width: `${taskProgress.percentage}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-gray-400 text-center">
                        已完成 <span className="text-white font-medium">{taskProgress.completed}</span> / {taskProgress.total}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 最近操作 */}
              {recentActions.length > 0 && (
                <div>
                  <h3 className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                    📜 最近操作
                  </h3>
                  <div className="space-y-1.5">
                    {recentActions.map((action, aIdx) => (
                      <div key={aIdx} className="flex items-center gap-2 text-xs">
                        <span className="text-[10px] text-gray-500 font-mono w-10 shrink-0">
                          {action.time}
                        </span>
                        <span className="text-gray-300 truncate flex-1">
                          {action.action}
                        </span>
                        {action.executor && (
                          <span className="text-[10px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded shrink-0">
                            {action.executor}
                          </span>
                        )}
                        {action.tokens && (
                          <span className="text-[10px] text-cyan-300 shrink-0">
                            {action.tokens}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 日志尾部 */}
              {task.logTail && (
                <div className="mt-3 p-3 bg-[#0d1117] rounded-lg border border-[#21262d]">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">最近日志</div>
                  <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap overflow-hidden max-h-20">
                    {task.logTail}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
