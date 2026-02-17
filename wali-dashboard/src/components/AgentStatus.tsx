'use client';

import { useEffect, useState } from 'react';
import StatusDot from '@/components/StatusDot';
import { StatsData } from '@/lib/api';

export interface ActiveTask {
  id: string;
  task: string;
  executor?: string;
  model?: string;
  status: 'running' | 'stale' | 'completed';
  startedAt: string;
  logTail?: string;
}

interface AgentStatusProps {
  stats: StatsData | null;
  isLive: boolean;
}

function parseTimestamp(ts: string): number {
  const d = new Date(ts);
  if (!isNaN(d.getTime())) return d.getTime();
  const clean = ts.replace(/[+-]\d{2}:\d{2}$/, '');
  return new Date(clean).getTime() - 8 * 3600000;
}

function formatElapsed(startedAt: string, now: number): string {
  const start = parseTimestamp(startedAt);
  const diff = now - start;
  if (diff < 0 || isNaN(diff)) return '刚刚开始';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '不到 1 分钟';
  if (mins < 60) return `${mins} 分钟`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs} 小时 ${remainMins} 分钟` : `${hrs} 小时`;
}

function formatTimeAgo(ts: string, now: number): string {
  const start = parseTimestamp(ts);
  const diff = now - start;
  if (diff < 0 || isNaN(diff)) return '刚刚';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} 小时前`;
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'running':
      return { dot: 'bg-green-400', bar: 'bg-green-500', label: '运行中', pulse: true };
    case 'stale':
      return { dot: 'bg-yellow-400', bar: 'bg-yellow-500', label: '无响应', pulse: false };
    case 'completed':
      return { dot: 'bg-gray-400', bar: 'bg-gray-500', label: '已完成', pulse: false };
    default:
      return { dot: 'bg-gray-400', bar: 'bg-gray-500', label: '待命', pulse: false };
  }
}

export default function AgentStatus({ stats, isLive }: AgentStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const activeTasks: ActiveTask[] = (stats as any)?.active_tasks || [];
  const waliStatus = stats?.wali_status;

  const displayTasks: ActiveTask[] = activeTasks.length > 0
    ? activeTasks
    : waliStatus && waliStatus.status !== 'idle'
      ? [{
          id: 'wali-current',
          task: waliStatus.currentTask,
          executor: waliStatus.executor,
          model: 'Claude Opus 4.6',
          status: waliStatus.status === 'working' ? 'running' : 'stale',
          startedAt: waliStatus.startedAt,
        }]
      : [];

  if (!isLive && displayTasks.length === 0) {
    return null;
  }

  if (displayTasks.length === 0) {
    return (
      <div className="relative border border-gray-700 bg-gray-800/50 rounded-xl overflow-hidden">
        <div className="h-1 bg-gray-500" />
        <div className="p-4 sm:p-6 flex items-center gap-2 text-gray-400">
          <span className="text-lg">🤖</span>
          <span className="font-medium">瓦力待命中</span>
          <span className="relative flex h-3 w-3 shrink-0 ml-1">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-400" />
          </span>
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
              <div className="flex items-start justify-between gap-3 mb-4">
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
                  {task.executor && (
                    <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                      ⚙️ {task.executor}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0">
                  {formatTimeAgo(task.startedAt, now)}更新
                </span>
              </div>
              {task.startedAt && (
                <div className="text-sm text-gray-400 mb-4">
                  ⏱ 已进行 <span className="text-white font-medium">{formatElapsed(task.startedAt, now)}</span>
                  {task.model && (
                    <span className="ml-3 text-purple-300">🧠 {task.model}</span>
                  )}
                </div>
              )}
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
