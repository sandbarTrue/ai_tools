'use client';

import { useState, useEffect, useRef } from 'react';
import Card from '@/components/Card';
import StatusDot from '@/components/StatusDot';
import DataSourceBadge from '@/components/DataSourceBadge';
import AgentStatus from '@/components/AgentStatus';
import ModelRanking from '@/components/ModelRanking';
import CostOverview from '@/components/CostOverview';
import { defaultModels, defaultBrainStatus } from '@/data/models';
import { fetchStats, connectSSE, StatsData, WaliExecution } from '@/lib/api';
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
  const [sseFailed, setSseFailed] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    async function load() {
      const data = await fetchStats();
      if (cancelled) return;
      if (data) {
        setStats(data);
        setIsLive(true);
      }
      setLoading(false);
    }

    // 优先尝试 SSE
    const sseToken = 'default'; // 使用默认 token
    cleanup = connectSSE(sseToken, (data) => {
      setStats(data);
      setIsLive(true);
      setLoading(false);
    });

    // SSE 失败时降级到轮询
    setTimeout(() => {
      if (!isLive && !cancelled) {
        setSseFailed(true);
        if (cleanup) cleanup();
        load();
        pollingRef.current = setInterval(load, 30_000);
      }
    }, 3000);

    // 首次加载
    load();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
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

  // 从 wali_status.tasks 获取业务任务
  const waliTasks = stats?.wali_status?.tasks as any;
  const tasksTotal = waliTasks?.total || 0;
  const tasksCompleted = waliTasks?.completed || 0;
  const tasksActive = waliTasks?.active || 0;
  const businessTasks = waliTasks?.tasks || [];

  // 从 wali_status.executions 获取最近执行记录
  // 首页只展示有意义的执行记录：最近成功的 + 最新 1 条（无论状态）
  const allExecs: WaliExecution[] = stats?.wali_status?.executions || [];
  const latestExec = allExecs[0]; // 最新的一条
  const successExecs = allExecs.filter(e => e.status === 'success').slice(0, 4);
  // 合并去重
  const executions: WaliExecution[] = latestExec && latestExec.status !== 'success'
    ? [latestExec, ...successExecs].slice(0, 5)
    : successExecs.slice(0, 5);

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
        <Card>
          <div className="text-[#8b949e] text-xs font-medium uppercase tracking-wider">任务进度</div>
          <div className="text-3xl font-bold text-white mt-2">
            {tasksTotal > 0 ? `${tasksCompleted}/${tasksTotal}` : '—'}
          </div>
          <div className="text-xs text-[#6e7681] mt-1">
            {stats?.wali_status?.currentTask || '无活跃任务'}
          </div>
        </Card>
      </div>

      {/* 任务进度 + 最近执行记录 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 任务进度 */}
        <Card hover={false}>
          <h2 className="text-lg font-semibold text-white mb-4">🎯 当前任务</h2>
          {(() => {
            const activeTasks = businessTasks.filter((t: any) => t.status === 'active');
            if (activeTasks.length === 0) {
              return <div className="text-center py-8 text-[#6e7681] text-sm">暂无活跃任务</div>;
            }
            return (
              <div className="space-y-3">
                {activeTasks.map((task: any, idx: number) => {
                  const execCount = (task.executions || []).length;
                  return (
                    <div key={idx} className="bg-[#161b22] rounded-lg border border-[#21262d] p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{task.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30">进行中</span>
                      </div>
                      {task.goal && <p className="text-[11px] text-[#6e7681] mb-2">{task.goal}</p>}
                      <div className="flex items-center gap-3 text-[10px] text-[#484f58]">
                        {task.source && <span>📎 {task.source}</span>}
                        {execCount > 0 && <span>⚡ {execCount} 次执行</span>}
                      </div>
                    </div>
                  );
                })}
                <div className="text-[10px] text-[#484f58] text-center">
                  共 {tasksTotal} 个任务 · {tasksCompleted} 已完成
                </div>
              </div>
            );
          })()}
        </Card>

        {/* 最近执行记录 */}
        <Card hover={false}>
          <h2 className="text-lg font-semibold text-white mb-4">⚡ 最近执行记录</h2>
          {executions.length > 0 ? (
            <div className="space-y-2">
              {executions.map((exec) => {
                const statusColor = exec.status === 'success' ? 'bg-green-400' :
                                   exec.status === 'failed' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse';
                const durationSec = exec.duration_ms ? Math.round(exec.duration_ms / 1000) : 0;
                const durationStr = durationSec > 60 ? `${Math.floor(durationSec / 60)}分${durationSec % 60}秒` : `${durationSec}秒`;
                return (
                  <div key={exec.id} className="flex items-center gap-3 p-2 bg-[#161b22] rounded-lg border border-[#21262d]">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{exec.task_title || '—'}</div>
                      <div className="text-[10px] text-[#6e7681] mt-0.5 flex items-center gap-2">
                        <span className="text-purple-400">{exec.model}</span>
                        <span>· {durationStr}</span>
                        {exec.cost > 0 && <span className="text-cyan-400">· ${exec.cost.toFixed(2)}</span>}
                      </div>
                      {exec.status === 'failed' && exec.fail_reason && (
                        <div className="text-[10px] text-red-400 mt-0.5 truncate" title={exec.fail_reason}>
                          ❌ {exec.fail_reason}
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${
                      exec.status === 'success' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                      exec.status === 'failed' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                      'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                    }`}>
                      {exec.status === 'success' ? '成功' : exec.status === 'failed' ? '失败' : '运行中'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-[#6e7681] text-sm">
              暂无执行记录
            </div>
          )}
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
