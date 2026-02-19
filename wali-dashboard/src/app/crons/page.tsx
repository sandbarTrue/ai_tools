'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/Card';
import StatusDot from '@/components/StatusDot';
import { CronJob } from '@/types';

function formatDuration(seconds: number): string {
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatSchedule(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length < 5) return cron;
  const [min, hour, dom, mon, dow] = parts;

  if (dom === '*' && mon === '*' && dow === '*') {
    if (min.startsWith('*/')) return `每${min.slice(2)}分钟`;
    return `每天 ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }
  return cron;
}

export default function CronsPage() {
  const [crons, setCrons] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCrons = async () => {
      try {
        const response = await fetch('/api/crons');
        if (!response.ok) {
          throw new Error('Failed to fetch cron data');
        }
        const data = await response.json();
        setCrons(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchCrons();
    const interval = setInterval(fetchCrons, 30000); // 30 second refresh

    return () => clearInterval(interval);
  }, []);

  const enabledCount = crons.filter((c) => c.enabled).length;
  const failedCount = crons.filter((c) => c.consecutiveFailures > 0).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cron 任务</h1>
          <p className="text-sm text-[#8b949e] mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cron 任务</h1>
          <p className="text-sm text-red-400 mt-1">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cron 任务</h1>
        <p className="text-sm text-[#8b949e] mt-1">
          共 {crons.length} 个任务 · {enabledCount} 个启用 ·{' '}
          {failedCount > 0 && <span className="text-red-400">{failedCount} 个异常</span>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider">总任务</div>
          <div className="text-2xl font-bold text-white mt-1">{crons.length}</div>
        </Card>
        <Card>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider">已启用</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{enabledCount}</div>
        </Card>
        <Card>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider">已禁用</div>
          <div className="text-2xl font-bold text-gray-400 mt-1">{crons.length - enabledCount}</div>
        </Card>
        <Card>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider">异常</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{failedCount}</div>
        </Card>
      </div>

      {/* Cron List */}
      <div className="space-y-3">
        {crons.map((cron) => (
          <Card key={cron.id} className={`${!cron.enabled ? 'opacity-60' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Left: Status + Name */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <StatusDot
                  status={!cron.enabled ? 'disabled' : cron.consecutiveFailures > 0 ? 'failed' : 'active'}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{cron.name}</h3>
                    {!cron.enabled && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/30 shrink-0">
                        已禁用
                      </span>
                    )}
                    {cron.consecutiveFailures > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30 shrink-0">
                        连续{cron.consecutiveFailures}次失败
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#6e7681] mt-0.5 flex items-center gap-3">
                    <span className="font-mono bg-[#21262d] px-1.5 py-0.5 rounded">{cron.schedule}</span>
                    <span>{formatSchedule(cron.schedule)}</span>
                    {cron.note && <span className="text-[#8b949e] italic">({cron.note})</span>}
                  </div>
                </div>
              </div>

              {/* Right: Stats */}
              <div className="flex items-center gap-6 sm:gap-8 text-xs shrink-0 pl-8 sm:pl-0">
                <div>
                  <div className="text-[#6e7681] mb-0.5">上次运行</div>
                  <div className="text-[#8b949e]">
                    {cron.lastRun
                      ? new Date(cron.lastRun).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[#6e7681] mb-0.5">状态</div>
                  <div
                    className={
                      cron.lastStatus === 'success'
                        ? 'text-green-400'
                        : cron.lastStatus === 'failed'
                          ? 'text-red-400'
                          : cron.lastStatus === 'timeout'
                            ? 'text-yellow-400'
                            : 'text-[#8b949e]'
                    }
                  >
                    {cron.lastStatus === 'success'
                      ? '✓ 成功'
                      : cron.lastStatus === 'failed'
                        ? '✕ 失败'
                        : cron.lastStatus === 'timeout'
                          ? '⏱ 超时'
                          : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[#6e7681] mb-0.5">耗时</div>
                  <div className="text-[#8b949e]">{cron.lastDuration ? formatDuration(cron.lastDuration) : '-'}</div>
                </div>
                <div>
                  <div className="text-[#6e7681] mb-0.5">下次运行</div>
                  <div className="text-[#8b949e]">
                    {cron.nextRun !== '-'
                      ? new Date(cron.nextRun).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
