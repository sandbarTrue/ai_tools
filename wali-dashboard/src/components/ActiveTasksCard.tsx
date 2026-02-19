'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/Card';
import StatusDot from '@/components/StatusDot';
import { StatsData, ActiveTask } from '@/lib/api';

interface ActiveTasksCardProps {
  stats: StatsData | null;
  isLive: boolean;
}

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

// 格式化操作文本，返回高亮样式的 JSX
function formatActionText(action: string): React.ReactNode {
  if (!action) return null;

  // 如果以 $ 开头（命令），用等宽字体和绿色
  if (action.startsWith('$')) {
    return <span className="font-mono text-green-400">{action}</span>;
  }

  // 如果是文件操作（编辑/写入/读取开头），高亮文件名
  const fileOps = ['编辑', '写入', '读取'];
  for (const op of fileOps) {
    if (action.startsWith(op)) {
      const rest = action.slice(op.length);
      // 尝试提取文件名（通常是引号内的内容或空格后的内容）
      const match = rest.match(/^[\s:"]*([^\s"]+)[\s"]*(.*)$/);
      if (match) {
        const [, filename, suffix] = match;
        return (
          <>
            <span className="text-[#8b949e]">{op}</span>
            <span className="text-blue-400">{filename}</span>
            {suffix && <span className="text-[#8b949e]">{suffix}</span>}
          </>
        );
      }
      return (
        <>
          <span className="text-[#8b949e]">{op}</span>
          <span className="text-blue-400">{rest}</span>
        </>
      );
    }
  }

  // 其他操作保持灰色
  return <span className="text-[#8b949e]">{action}</span>;
}

export default function ActiveTasksCard({ stats, isLive }: ActiveTasksCardProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!isLive || !stats) {
    return null;
  }

  const waliStatus = stats.wali_status;
  const activeTasks: ActiveTask[] = stats.active_tasks || [];
  const recentActions = waliStatus?.recentActions || [];
  const sessions = stats.sessions;

  // 如果没有任何活跃信息，不显示
  if (activeTasks.length === 0 && recentActions.length === 0 && (!sessions || sessions.today === 0)) {
    return null;
  }

  return (
    <Card hover={false}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">🎯 活跃任务快览</h2>
        <span className="text-[11px] text-[#6e7681]">
          {stats.generated_at && `${formatTimeAgo(stats.generated_at, now)}更新`}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Screen 进程 */}
        <div className="bg-[#0d1117] rounded-lg p-3 border border-[#21262d]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">📺</span>
            <span className="text-xs text-[#8b949e] font-medium">Screen 进程</span>
            <span className="ml-auto text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">
              {activeTasks.length} 个
            </span>
          </div>
          {activeTasks.length > 0 ? (
            <div className="space-y-2">
              {activeTasks.slice(0, 3).map((task, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <StatusDot status={task.stale ? 'degraded' : 'healthy'} size="sm" />
                  <span className="text-[#c9d1d9] truncate flex-1">{task.name}</span>
                  <span className="text-[#6e7681] whitespace-nowrap">
                    {task.age_minutes}分钟
                  </span>
                </div>
              ))}
              {activeTasks.length > 3 && (
                <div className="text-[10px] text-[#6e7681] text-center pt-1">
                  +{activeTasks.length - 3} 更多
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-[#6e7681] py-2 text-center">
              无活跃进程
            </div>
          )}
        </div>

        {/* 最近操作时间线 */}
        <div className="bg-[#0d1117] rounded-lg p-3 border border-[#21262d]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">📜</span>
            <span className="text-xs text-[#8b949e] font-medium">最近操作</span>
          </div>
          {recentActions.length > 0 ? (
            <div className="space-y-1.5">
              {recentActions.slice(0, 4).map((action, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="text-[10px] text-[#484f58] font-mono w-10 shrink-0">
                    {action.time}
                  </span>
                  <span className="truncate flex-1">
                    {formatActionText(action.action)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[#6e7681] py-2 text-center">
              暂无记录
            </div>
          )}
        </div>

        {/* 对话统计 */}
        <div className="bg-[#0d1117] rounded-lg p-3 border border-[#21262d]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">📊</span>
            <span className="text-xs text-[#8b949e] font-medium">对话统计</span>
          </div>
          {sessions ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8b949e]">今日对话</span>
                <span className="text-white font-medium text-lg">{sessions.today}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8b949e]">累计对话</span>
                <span className="text-[#c9d1d9]">{sessions.total}</span>
              </div>
              <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden mt-2">
                <div
                  className="h-1.5 bg-gradient-to-r from-green-500 to-cyan-500 rounded-full"
                  style={{ width: sessions.total > 0 ? `${Math.min((sessions.today / sessions.total) * 100, 100)}%` : '0%' }}
                />
              </div>
              <div className="text-[10px] text-[#6e7681] text-center">
                今日占比 {sessions.total > 0 ? ((sessions.today / sessions.total) * 100).toFixed(1) : 0}%
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#6e7681] py-2 text-center">
              暂无数据
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
