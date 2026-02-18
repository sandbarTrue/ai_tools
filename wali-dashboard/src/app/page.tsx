'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/Card';
import StatusDot from '@/components/StatusDot';
import DataSourceBadge from '@/components/DataSourceBadge';
import AgentStatus from '@/components/AgentStatus';
import TaskQueue from '@/components/TaskQueue';
import ModelRanking from '@/components/ModelRanking';
import CostOverview from '@/components/CostOverview';
import { defaultModels, defaultBrainStatus } from '@/data/models';
import { defaultTasks } from '@/data/tasks';
import { fetchStats, StatsData } from '@/lib/api';
import { transformModels, transformBrainStatus, getTopModels } from '@/lib/transform';
import { ModelInfo, BrainStatus } from '@/types';
import ActiveTasksCard from '@/components/ActiveTasksCard';

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function formatCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  if (n >= 1) return '$' + n.toFixed(2);
  if (n > 0) return '$' + n.toFixed(4);
  return '$0';
}

// Vendor groups for homepage model cards
interface HomeVendorGroup {
  id: string;
  name: string;
  color: string;
  labelColor: string;
  modelKeys: string[];
  note?: string;
}

const HOME_VENDOR_GROUPS: HomeVendorGroup[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#a855f7',
    labelColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    modelKeys: [
      'anthropic-oauth-proxy/claude-opus-4-6',
      'anthropic/claude-opus-4-6',
      'anthropic/claude-sonnet-4-5-20250929-thinking',
      'anthropic/claude-opus-4-5',
    ],
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    color: '#f59e0b',
    labelColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    modelKeys: ['claude-code/aggregated', 'claude-code/glm-5', 'claude-code/claude-haiku-4-5-20251001'],
    note: '独立进程',
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    color: '#22c55e',
    labelColor: 'bg-green-500/15 text-green-400 border-green-500/30',
    modelKeys: ['zhipu/glm-4.7', 'zhipu/glm-5'],
  },
  {
    id: 'bytedance',
    name: '字节代理',
    color: '#10b981',
    labelColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    modelKeys: [
      'ai-agent-proxy-responses/gpt-5.2-2025-12-11',
      'ai-agent-proxy-responses/gpt-5.2-codex-2026-01-14',
      'ai-agent-proxy-google/gemini-3-pro-preview-new',
    ],
    note: '内部免费',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    color: '#06b6d4',
    labelColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    modelKeys: ['coco-proxy/coco'],
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    color: '#6366f1',
    labelColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    modelKeys: ['openclaw/delivery-mirror'],
    note: '系统内部',
  },
];

export default function Dashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchStats();
      if (cancelled) return;
      if (data) {
        setStats(data);
        setIsLive(true);
      }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Transform data
  const models: ModelInfo[] = isLive && stats ? transformModels(stats) : defaultModels;
  const topModels = isLive && stats ? getTopModels(models, 6) : defaultModels;
  const brainStatus: BrainStatus = isLive && stats ? transformBrainStatus(stats) : defaultBrainStatus;

  // Get merged models from stats (if available)
  const mergedModels: ModelInfo[] = isLive && stats && (stats as any).merged_models
    ? (stats as any).merged_models.map((m: any) => ({
        name: m.displayName || m.name || m.id,
        status: 'healthy' as const,
        tokensUsedToday: (m.today?.input_tokens || 0) + (m.today?.output_tokens || 0),
        tokensUsedWeek: (m.week?.input_tokens || 0) + (m.week?.output_tokens || 0),
        tokensUsedMonth: (m.month?.input_tokens || 0) + (m.month?.output_tokens || 0),
        avgResponseTime: 0,
        successRate: 100,
        color: m.color || '#6366f1',
        _apiKey: m.name,
        _calls: m.calls || 0,
        _callsToday: m.today?.calls || 0,
        _callsWeek: m.week?.calls || 0,
        _callsMonth: m.month?.calls || 0,
        _inputTokens: m.input_tokens || 0,
        _outputTokens: m.output_tokens || 0,
        _cost: m.cost || 0,
        _costToday: m.today?.cost || 0,
        _costWeek: m.week?.cost || 0,
        _costMonth: m.month?.cost || 0,
        _subModels: m.subModels || [],
      }))
    : topModels;

  // Calculate costs
  const totalCostToday = isLive
    ? mergedModels.reduce((sum, m) => sum + (m._costToday || 0), 0)
    : 0;
  const totalCostWeek = isLive
    ? mergedModels.reduce((sum, m) => sum + (m._costWeek || 0), 0)
    : 0;
  const totalCostMonth = isLive
    ? mergedModels.reduce((sum, m) => sum + (m._costMonth || 0), 0)
    : 0;

  const totalCallsToday = isLive
    ? mergedModels.reduce((sum, m) => sum + (m._callsToday || 0), 0)
    : 0;
  const totalCallsMonth = isLive
    ? mergedModels.reduce((sum, m) => sum + (m._callsMonth || 0), 0)
    : 0;

  // Task stats
  const tasksTotal = defaultTasks.length;
  const tasksInProgress = defaultTasks.filter(t => t.status === 'in-progress').length;
  const tasksDone = defaultTasks.filter(t => t.status === 'done').length;
  const tasksPlanned = defaultTasks.filter(t => t.status === 'planned').length;
  const tasksBlocked = defaultTasks.filter(t => t.status === 'blocked').length;

  // Model task distribution
  const modelTaskMap: Record<string, number> = {};
  defaultTasks.forEach(t => {
    const taskModels = t.model.split(/[+,]/).map(m => m.trim());
    taskModels.forEach(m => {
      const key = m || '未分配';
      modelTaskMap[key] = (modelTaskMap[key] || 0) + 1;
    });
  });
  const modelTaskEntries = Object.entries(modelTaskMap).sort((a, b) => b[1] - a[1]);

  const allHealthy = topModels.every(m => m.status === 'healthy');
  const anyDown = topModels.some(m => m.status === 'down');
  const healthStatus = anyDown ? 'down' : allHealthy ? 'healthy' : 'degraded';
  const healthLabel = anyDown ? '异常' : allHealthy ? '正常' : '部分降级';
  const healthColor = anyDown ? 'text-red-400' : allHealthy ? 'text-green-400' : 'text-yellow-400';

  // Group models by vendor for the cards section
  function getGroupModels(group: HomeVendorGroup): ModelInfo[] {
    return group.modelKeys
      .map(key => models.find(m => m._apiKey === key))
      .filter((m): m is ModelInfo => m !== null && m !== undefined && ((m._calls || 0) > 0 || m.tokensUsedMonth > 0));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8b949e] text-sm">加载数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Agent Status - using new component */}
      <AgentStatus stats={stats} isLive={isLive} />

      {/* Active Tasks Card - 活跃任务快览 */}
      <ActiveTasksCard stats={stats} isLive={isLive} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">总览仪表盘</h1>
          <p className="text-sm text-[#8b949e] mt-1">实时监控 AI Agent 运营状态</p>
        </div>
        <div className="flex items-center gap-3">
          <DataSourceBadge isLive={isLive} generatedAt={stats?.generated_at} />
          <StatusDot status={healthStatus} size="md" />
          <span className={`text-sm font-medium ${healthColor}`}>
            系统{healthLabel}
          </span>
        </div>
      </div>

      {/* Stats Overview - 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Task Stats Card */}
        <Card>
          <div className="text-[#8b949e] text-xs font-medium uppercase tracking-wider">任务统计</div>
          <div className="text-3xl font-bold text-white mt-2">{tasksTotal}</div>
          <div className="text-xs text-[#6e7681] mt-1">
            ✅ {tasksDone} 完成 · 🔄 {tasksInProgress} 进行中 · 📋 {tasksPlanned} 计划{tasksBlocked > 0 ? ` · 🚫 ${tasksBlocked} 阻塞` : ''}
          </div>
        </Card>
        <Card>
          <div className="text-[#8b949e] text-xs font-medium uppercase tracking-wider">
            {isLive ? '今日调用' : '活跃模型'}
          </div>
          <div className="text-3xl font-bold text-white mt-2">
            {isLive ? totalCallsToday.toLocaleString() : topModels.length}
          </div>
          <div className="text-xs text-[#6e7681] mt-1">
            {isLive ? `本月 ${totalCallsMonth.toLocaleString()} 次` : `主: ${brainStatus.primary.split(' ')[0]}`}
          </div>
        </Card>
        <Card>
          <div className="text-[#8b949e] text-xs font-medium uppercase tracking-wider">今日费用</div>
          <div className="text-3xl font-bold text-white mt-2">{formatCost(totalCostToday)}</div>
          <div className="text-xs text-[#6e7681] mt-1">
            本周 {formatCost(totalCostWeek)} · 本月 {formatCost(totalCostMonth)}
          </div>
        </Card>
        <Card>
          <div className="text-[#8b949e] text-xs font-medium uppercase tracking-wider">模型状态</div>
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {topModels.slice(0, 4).map(m => (
              <div key={m.name} className="flex items-center gap-1 mr-3">
                <StatusDot status={m.status} />
                <span className="text-xs text-[#8b949e]">{m.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
          <div className={`text-xs mt-2 ${healthColor}`}>全部{healthLabel}</div>
        </Card>
      </div>

      {/* Task Queue - using new component */}
      <TaskQueue tasks={defaultTasks} maxItems={6} />

      {/* Task Progress + Model Task Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Task Progress */}
        <Card hover={false}>
          <h2 className="text-lg font-semibold text-white mb-4">📋 任务进度</h2>
          <div className="space-y-3">
            {[
              { label: '已完成', count: tasksDone, total: tasksTotal, color: 'bg-green-500', textColor: 'text-green-400' },
              { label: '进行中', count: tasksInProgress, total: tasksTotal, color: 'bg-blue-500', textColor: 'text-blue-400' },
              { label: '计划中', count: tasksPlanned, total: tasksTotal, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8b949e]">{item.label}</span>
                  <span className={`font-medium ${item.textColor}`}>{item.count} / {item.total}</span>
                </div>
                <div className="h-2 bg-[#21262d] rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${item.color}`}
                    style={{ width: `${(item.count / item.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[#21262d] text-xs text-[#6e7681]">
            完成率: <span className="text-green-400 font-medium">{((tasksDone / tasksTotal) * 100).toFixed(0)}%</span>
          </div>
          {/* Recent completed tasks */}
          <div className="mt-3 pt-3 border-t border-[#21262d]">
            <h3 className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">近期已完成</h3>
            <div className="space-y-1.5">
              {defaultTasks
                .filter(t => t.status === 'done')
                .slice(0, 5)
                .map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-400 truncate flex-1">✅ {t.title}</span>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap font-mono">
                      {t.planTokens || t.execTokens
                        ? `~${formatTokens((t.planTokens || 0) + (t.execTokens || 0))}`
                        : '—'
                      }
                    </span>
                  </div>
                ))}
            </div>
            {tasksDone > 5 && (
              <a href="/tasks" className="text-[10px] text-purple-400 hover:underline mt-1 block">
                查看全部 {tasksDone} 个 →
              </a>
            )}
          </div>
        </Card>

        {/* Model Task Distribution */}
        <Card hover={false}>
          <h2 className="text-lg font-semibold text-white mb-4">🤖 模型任务分布</h2>
          <div className="space-y-2">
            {modelTaskEntries.map(([model, count]) => {
              const pct = (count / tasksTotal) * 100;
              const colorMap: Record<string, string> = {
                'Claude Opus 4.6': 'bg-purple-500',
                'GLM-5': 'bg-green-500',
                'GLM-4-Flash': 'bg-cyan-500',
                '待定': 'bg-gray-500',
              };
              const barColor = Object.entries(colorMap).find(([k]) => model.includes(k))?.[1] || 'bg-blue-500';
              return (
                <div key={model}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#8b949e] truncate max-w-[60%]">{model}</span>
                    <span className="text-white font-medium">{count} 个任务</span>
                  </div>
                  <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Brain Status */}
      <Card hover={false}>
        <h2 className="text-lg font-semibold text-white mb-4">🧠 大脑状态</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="text-xs text-[#8b949e] uppercase tracking-wider">当前主脑</div>
            <div className="flex items-center gap-2">
              <StatusDot status="healthy" size="md" />
              <span className="text-white font-medium">{brainStatus.primary}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-[#8b949e] uppercase tracking-wider">备用大脑</div>
            <div className="flex items-center gap-2">
              <StatusDot status="healthy" size="md" />
              <span className="text-white font-medium">{brainStatus.backup}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-[#8b949e] uppercase tracking-wider">
              {isLive ? '总请求数' : '切换统计'}
            </div>
            <div className="text-white">
              共 <span className="text-2xl font-bold">{brainStatus.switchCount}</span> {isLive ? '次请求' : '次'}
              {isLive && stats?.brain_status?.lastSwitchTime && (
                <span className="text-xs text-[#6e7681] ml-2">
                  最后切换: {new Date(stats.brain_status.lastSwitchTime).toLocaleDateString('zh-CN')}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Model Ranking - using new component */}
      <ModelRanking models={mergedModels} title="模型用量排行" maxItems={6} />

      {/* Cost Overview - using new component */}
      <CostOverview models={mergedModels} isLive={isLive} />
    </div>
  );
}
