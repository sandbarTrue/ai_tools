'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatsData } from '@/lib/api';

interface AgentStatusProps {
  stats: StatsData | null;
  isLive: boolean;
}

function formatTimeAgo(ts: string, now: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  const diff = now - d.getTime();
  if (diff < 60000) return '刚刚';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分钟前`;
  return `${Math.floor(mins / 60)} 小时前`;
}

export default function AgentStatus({ stats, isLive }: AgentStatusProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!isLive || !stats) return null;

  const ws = stats.wali_status as any;
  const tasks = ws?.tasks?.tasks || [];
  const activeTasks = tasks.filter((t: any) => t.status === 'active');
  const status = ws?.status || 'idle';
  const isWorking = status === 'working';

  if (activeTasks.length === 0) {
    return (
      <div className="relative border border-[#30363d] bg-[#161b22] rounded-xl overflow-hidden">
        <div className="h-1 bg-blue-500" />
        <div className="p-4 flex items-center gap-2 text-[#8b949e]">
          <span className="text-lg">🤖</span>
          <span className="font-medium">瓦力待命中</span>
          <span className="w-3 h-3 rounded-full bg-blue-400 ml-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeTasks.map((task: any, idx: number) => {
        const execCount = (task.executions || []).length;
        const manualCount = (task.manualExecs || []).length;
        const totalExecs = execCount + manualCount;
        const doneManual = (task.manualExecs || []).filter((e: any) => e.done).length;

        return (
          <div key={idx} className="relative border border-[#30363d] bg-[#161b22] rounded-xl overflow-hidden">
            <div className={`h-1 ${isWorking ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <div className="p-4 sm:p-5">
              {/* 任务标题 */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">🎯</span>
                  <h2 className="text-base sm:text-lg font-bold text-white">{task.title}</h2>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    isWorking
                      ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                      : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {isWorking ? '执行中' : '进行中'}
                  </span>
                </div>
                <span className="text-[11px] text-[#6e7681] whitespace-nowrap">
                  {stats.generated_at && `${formatTimeAgo(stats.generated_at, now)}更新`}
                </span>
              </div>

              {/* 目标 */}
              {task.goal && (
                <p className="text-xs text-[#8b949e] mb-3 ml-8">{task.goal}</p>
              )}

              {/* 执行统计 */}
              <div className="flex items-center gap-4 ml-8 text-xs">
                {task.source && (
                  <span className="text-[#6e7681]">📎 {task.source}</span>
                )}
                {totalExecs > 0 && (
                  <span className="text-[#6e7681]">⚡ {totalExecs} 次执行</span>
                )}
                {manualCount > 0 && (
                  <span className="text-[#6e7681]">✅ {doneManual}/{manualCount} 完成</span>
                )}
                <Link
                  href="/tasks/"
                  className="text-blue-400 hover:text-blue-300 text-[11px] ml-auto"
                >
                  查看详情 →
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
