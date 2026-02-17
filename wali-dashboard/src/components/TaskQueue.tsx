'use client';

import Card from '@/components/Card';
import { Task, TaskStatus } from '@/types';

interface TaskQueueProps {
  tasks: Task[];
  showBlockedOnly?: boolean;
  maxItems?: number;
}

const STATUS_STYLES: Record<TaskStatus, { color: string; label: string; bg: string }> = {
  'in-progress': { color: 'text-blue-400', label: '进行中', bg: 'bg-blue-500/10 border-blue-500/20' },
  'planned': { color: 'text-yellow-400', label: '计划中', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  'blocked': { color: 'text-red-400', label: '阻塞', bg: 'bg-red-500/10 border-red-500/20' },
  'done': { color: 'text-green-400', label: '已完成', bg: 'bg-green-500/10 border-green-500/20' },
};

const PRIORITY_STYLES: Record<string, { color: string; label: string }> = {
  '高': { color: 'text-red-400', label: '🔴' },
  '中': { color: 'text-yellow-400', label: '🟡' },
  '低': { color: 'text-gray-400', label: '🟢' },
};

export default function TaskQueue({ tasks, showBlockedOnly = false, maxItems = 10 }: TaskQueueProps) {
  // Filter and sort tasks
  const filteredTasks = tasks
    .filter(t => t.status !== 'done' && !t.archived)
    .filter(t => !showBlockedOnly || t.status === 'blocked')
    .sort((a, b) => {
      // Sort by status priority: in-progress > blocked > planned
      const statusOrder: Record<TaskStatus, number> = {
        'in-progress': 0,
        'blocked': 1,
        'planned': 2,
        'done': 3,
      };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      // Then by priority
      const priorityOrder: Record<string, number> = { '高': 0, '中': 1, '低': 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, maxItems);

  const blockedCount = tasks.filter(t => t.status === 'blocked' && !t.archived).length;
  const inProgressCount = tasks.filter(t => t.status === 'in-progress' && !t.archived).length;
  const plannedCount = tasks.filter(t => t.status === 'planned' && !t.archived).length;

  if (filteredTasks.length === 0) {
    return (
      <Card hover={false}>
        <h2 className="text-lg font-semibold text-white mb-4">📋 任务队列</h2>
        <div className="text-center py-8 text-gray-500">
          <span className="text-3xl">✅</span>
          <p className="mt-2">所有任务已完成，暂无待办</p>
        </div>
      </Card>
    );
  }

  return (
    <Card hover={false}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">📋 任务队列</h2>
        <div className="flex items-center gap-2 text-xs">
          {inProgressCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {inProgressCount} 进行中
            </span>
          )}
          {blockedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              {blockedCount} 阻塞
            </span>
          )}
          {plannedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              {plannedCount} 计划
            </span>
          )}
        </div>
      </div>

      <ol className="space-y-2">
        {filteredTasks.map((task, i) => {
          const statusStyle = STATUS_STYLES[task.status];
          const priorityStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES['中'];
          
          return (
            <li key={task.id} className={`flex items-start gap-2 text-sm p-2 rounded-lg ${task.status === 'blocked' ? 'bg-red-500/5 border border-red-500/10' : ''}`}>
              <span className="text-gray-500 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`${task.status === 'blocked' ? 'text-red-300' : 'text-gray-300'} truncate`}>
                    {task.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusStyle.bg}`}>
                    {statusStyle.label}
                  </span>
                  <span className="text-[10px]" title={task.priority}>
                    {priorityStyle.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {task.executor && (
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                      👤 {task.executor}
                    </span>
                  )}
                  {task.model && (
                    <span className="text-[10px] text-gray-500">
                      🧠 {task.model}
                    </span>
                  )}
                  {task.openspecChange && (
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                      OpenSpec: {task.openspecChange}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {blockedCount > 0 && (
        <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
          <div className="text-xs text-red-400 flex items-center gap-2">
            <span>⚠️</span>
            <span>有 {blockedCount} 个任务被阻塞，需要关注</span>
          </div>
        </div>
      )}
    </Card>
  );
}
