'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/Card';
import StatusDot from '@/components/StatusDot';
import DataSourceBadge from '@/components/DataSourceBadge';
import ModelRanking from '@/components/ModelRanking';
import { defaultModels, defaultBrainStatus, schedulingRules } from '@/data/models';
import { fetchStats, StatsData } from '@/lib/api';
import { transformModels, transformBrainStatus } from '@/lib/transform';
import { ModelInfo, BrainStatus } from '@/types';

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

// Vendor group definitions
interface VendorGroup {
  id: string;
  name: string;
  label: string;
  color: string;
  labelColor: string;
  modelKeys: string[];
  note?: string;
  subscriptionKey?: 'claude_max' | 'zhipu_quota';
}

const VENDOR_GROUPS: VendorGroup[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    label: 'Anthropic',
    color: '#a855f7',
    labelColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    modelKeys: [
      'anthropic-oauth-proxy/claude-opus-4-6',
      'anthropic/claude-opus-4-6',
      'anthropic/claude-sonnet-4-5-20250929-thinking',
      'anthropic/claude-opus-4-5',
    ],
    subscriptionKey: 'claude_max',
  },
  {
    id: 'claude-code',
    name: 'Claude Code (独立进程)',
    label: 'Claude Code',
    color: '#f59e0b',
    labelColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    modelKeys: [
      'claude-code/aggregated',
      'claude-code/glm-5',
      'claude-code/claude-haiku-4-5-20251001',
    ],
    note: '独立运行，不走 OpenClaw',
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    label: '智谱',
    color: '#22c55e',
    labelColor: 'bg-green-500/15 text-green-400 border-green-500/30',
    modelKeys: ['zhipu/glm-4.7', 'zhipu/glm-5'],
    subscriptionKey: 'zhipu_quota',
  },
  {
    id: 'bytedance',
    name: '字节跳动 AI 代理',
    label: '内部服务',
    color: '#10b981',
    labelColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    modelKeys: [
      'ai-agent-proxy-responses/gpt-5.2-2025-12-11',
      'ai-agent-proxy-responses/gpt-5.2-codex-2026-01-14',
      'ai-agent-proxy-google/gemini-3-pro-preview-new',
    ],
    note: '字节内部免费服务',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    label: '备用',
    color: '#06b6d4',
    labelColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    modelKeys: ['coco-proxy/coco'],
  },
  {
    id: 'openclaw',
    name: 'OpenClaw 内部',
    label: '系统',
    color: '#6366f1',
    labelColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    modelKeys: ['openclaw/delivery-mirror'],
    note: '系统内部调用',
  },
];

function BarChart({ data, maxVal, color }: { data: { label: string; value: number }[]; maxVal: number; color: string }) {
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => {
        const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-[#8b949e]">{formatTokens(d.value)}</span>
            <div className="w-full bg-[#21262d] rounded-t relative flex-1 flex items-end">
              <div
                className="w-full rounded-t transition-all duration-700"
                style={{ height: `${Math.max(4, pct)}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-[10px] text-[#6e7681] truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ModelsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const models: ModelInfo[] = isLive && stats ? transformModels(stats) : defaultModels;
  const activeModels = models.filter(m => (m._calls || m.tokensUsedMonth) > 0);

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
        _apiKey: m.displayName || m.name || m.id,
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
    : activeModels;

  // Group models by vendor
  function getModelsForGroup(group: VendorGroup): ModelInfo[] {
    return group.modelKeys
      .map(key => {
        const byKey = models.find(m => m._apiKey === key);
        if (byKey) return byKey;
        return null;
      })
      .filter((m): m is ModelInfo => m !== null && (m._calls || m.tokensUsedMonth) > 0);
  }

  // Render subscription card for Claude Max
  function renderClaudeMaxCard() {
    if (!stats?.claude_max) return null;
    const cm = stats.claude_max;
    return (
      <div className="bg-[#0d1117] rounded-lg p-4 border border-purple-500/20 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-purple-400 text-sm font-semibold">💎 {cm.plan}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
              {cm.price}
            </span>
          </div>
          <span className="text-xs text-[#6e7681]">{cm.window_hours}h 窗口</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[#6e7681]">窗口调用</span>
            <div className="text-white font-bold mt-0.5">{cm.window_usage.calls.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-[#6e7681]">输入 Tokens</span>
            <div className="text-white font-bold mt-0.5">{formatTokens(cm.window_usage.input_tokens)}</div>
          </div>
          <div>
            <span className="text-[#6e7681]">输出 Tokens</span>
            <div className="text-white font-bold mt-0.5">{formatTokens(cm.window_usage.output_tokens)}</div>
          </div>
          <div>
            <span className="text-[#6e7681]">窗口费用</span>
            <div className="text-orange-400 font-bold mt-0.5">{formatCost(cm.window_usage.cost)}</div>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[#21262d] flex justify-between text-xs">
          <span className="text-[#6e7681]">累计总费用</span>
          <span className="text-orange-400 font-medium">{formatCost(cm.total_cost)}</span>
        </div>
      </div>
    );
  }

  // Render subscription card for Zhipu quota
  function renderZhipuQuotaCard() {
    if (!stats?.zhipu_quota) return null;
    const zq = stats.zhipu_quota;
    const sub = zq.subscription;
    return (
      <div className="bg-[#0d1117] rounded-lg p-4 border border-green-500/20 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm font-semibold">🟢 {sub ? sub.productName : 'GLM Coding Pro'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
              {sub ? `¥${sub.actualPrice}/${sub.billingCycle === 'quarter' ? '季' : sub.billingCycle}` : '¥270/季'}
            </span>
          </div>
          {sub && (
            <span className={`text-xs ${sub.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
              {sub.status === 'active' ? '✅ 有效' : sub.status}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {zq.limits.map((limit, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#8b949e]">{limit.type}</span>
                <span className={`font-medium ${limit.percentage > 80 ? 'text-red-400' : limit.percentage > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {limit.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, limit.percentage)}%`,
                    backgroundColor: limit.percentage > 80 ? '#ef4444' : limit.percentage > 50 ? '#f59e0b' : '#22c55e',
                  }}
                />
              </div>
              {limit.usage !== undefined && (
                <div className="text-[10px] text-[#6e7681] mt-0.5">
                  已用: {limit.usage.toLocaleString()} / {limit.number.toLocaleString()} {limit.unit === 1 ? '' : `(每${limit.unit})`}
                </div>
              )}
            </div>
          ))}
        </div>
        {sub && (
          <div className="mt-2 pt-2 border-t border-[#21262d] text-xs text-[#6e7681]">
            有效期至 {sub.valid} · {sub.autoRenew ? '自动续费' : '手动续费'}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8b949e] text-sm">加载模型数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🧠 模型监控</h1>
          <p className="text-sm text-[#8b949e] mt-1">
            {isLive
              ? `${activeModels.length} 个活跃模型 · ${VENDOR_GROUPS.length} 个供应商 · 基于 OpenClaw 会话数据`
              : '订阅套餐用量 · 智能调度策略 · Token 消耗追踪'
            }
          </p>
        </div>
        <DataSourceBadge isLive={isLive} generatedAt={stats?.generated_at} />
      </div>

      {/* === Merged Model Ranking (using component) === */}
      {isLive && mergedModels.length > 0 && (
        <ModelRanking models={mergedModels} title="合并后模型排行" maxItems={10} />
      )}

      {/* === Vendor-Grouped Models (using raw_models) === */}
      {isLive && (
        <div className="space-y-6">
          {VENDOR_GROUPS.map(group => {
            const groupModels = getModelsForGroup(group);
            const hasSubscription = (group.subscriptionKey === 'claude_max' && stats?.claude_max) ||
                                     (group.subscriptionKey === 'zhipu_quota' && stats?.zhipu_quota);
            if (groupModels.length === 0 && !hasSubscription) return null;

            return (
              <Card key={group.id} hover={false}>
                {/* Group header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-1 h-8 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">{group.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${group.labelColor}`}>
                        {group.label}
                      </span>
                    </div>
                    {group.note && (
                      <p className="text-xs text-[#6e7681] mt-0.5">{group.note}</p>
                    )}
                  </div>
                </div>

                {/* Subscription card */}
                {group.subscriptionKey === 'claude_max' && renderClaudeMaxCard()}
                {group.subscriptionKey === 'zhipu_quota' && renderZhipuQuotaCard()}

                {/* Models table */}
                {groupModels.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[#6e7681] border-b border-[#21262d]">
                          <th className="text-left py-2 px-3 font-medium">模型</th>
                          <th className="text-right py-2 px-3 font-medium">总调用</th>
                          <th className="text-right py-2 px-3 font-medium">输入 Tokens</th>
                          <th className="text-right py-2 px-3 font-medium">输出 Tokens</th>
                          <th className="text-right py-2 px-3 font-medium">今日</th>
                          <th className="text-right py-2 px-3 font-medium">本周</th>
                          <th className="text-right py-2 px-3 font-medium">费用</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupModels.map(model => (
                          <tr key={model.name} className="border-b border-[#161b22] hover:bg-[#161b22]">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: model.color }} />
                                <span className="text-white font-medium">{model.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right text-white font-bold">
                              {(model._calls || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right text-[#8b949e]">
                              {formatTokens(model._inputTokens || 0)}
                            </td>
                            <td className="py-3 px-3 text-right text-[#8b949e]">
                              {formatTokens(model._outputTokens || 0)}
                            </td>
                            <td className="py-3 px-3 text-right text-[#8b949e]">
                              {(model._callsToday || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right text-[#8b949e]">
                              {(model._callsWeek || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className={(model._cost || 0) > 0 ? 'text-orange-400 font-medium' : 'text-green-400'}>
                                {(model._cost || 0) > 0 ? formatCost(model._cost || 0) : '免费'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {groupModels.length > 1 && (
                        <tfoot>
                          <tr className="border-t border-[#30363d]">
                            <td className="py-2 px-3 text-[#8b949e] font-medium">小计</td>
                            <td className="py-2 px-3 text-right text-white font-medium">
                              {groupModels.reduce((s, m) => s + (m._calls || 0), 0).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-[#8b949e]">
                              {formatTokens(groupModels.reduce((s, m) => s + (m._inputTokens || 0), 0))}
                            </td>
                            <td className="py-2 px-3 text-right text-[#8b949e]">
                              {formatTokens(groupModels.reduce((s, m) => s + (m._outputTokens || 0), 0))}
                            </td>
                            <td className="py-2 px-3 text-right text-[#8b949e]">
                              {groupModels.reduce((s, m) => s + (m._callsToday || 0), 0).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-[#8b949e]">
                              {groupModels.reduce((s, m) => s + (m._callsWeek || 0), 0).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-orange-400 font-medium">
                              {formatCost(groupModels.reduce((s, m) => s + (m._cost || 0), 0))}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Grand Total */}
          <Card hover={false}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">📊 全局汇总</h2>
              <div className="text-xs text-[#6e7681]">{activeModels.length} 个活跃模型</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="bg-[#0d1117] rounded-lg p-3 border border-[#21262d]">
                <div className="text-xs text-[#6e7681]">总调用</div>
                <div className="text-xl font-bold text-white mt-1">
                  {activeModels.reduce((s, m) => s + (m._calls || 0), 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-[#0d1117] rounded-lg p-3 border border-[#21262d]">
                <div className="text-xs text-[#6e7681]">输入 Tokens</div>
                <div className="text-xl font-bold text-white mt-1">
                  {formatTokens(activeModels.reduce((s, m) => s + (m._inputTokens || 0), 0))}
                </div>
              </div>
              <div className="bg-[#0d1117] rounded-lg p-3 border border-[#21262d]">
                <div className="text-xs text-[#6e7681]">输出 Tokens</div>
                <div className="text-xl font-bold text-white mt-1">
                  {formatTokens(activeModels.reduce((s, m) => s + (m._outputTokens || 0), 0))}
                </div>
              </div>
              <div className="bg-[#0d1117] rounded-lg p-3 border border-[#21262d]">
                <div className="text-xs text-[#6e7681]">总费用</div>
                <div className="text-xl font-bold text-orange-400 mt-1">
                  {formatCost(activeModels.reduce((s, m) => s + (m._cost || 0), 0))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* === Subscription Quota Usage (only in mock mode) === */}
      {!isLive && (
        <Card hover={false}>
          <h2 className="text-lg font-semibold text-white mb-2">📊 订阅套餐用量</h2>
          <p className="text-xs text-[#8b949e] mb-6">实时监控各模型配额，避免超限</p>

          {defaultModels.map(model => (
            model.quotas && model.quotas.length > 0 && (
              <div key={model.name} className="mb-6 last:mb-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: model.color }} />
                  <h3 className="text-sm font-semibold text-white">{model.name}</h3>
                  <StatusDot status={model.status} size="sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {model.quotas.map((q, i) => (
                    <div key={i} className="bg-[#0d1117] rounded-lg p-4 border border-[#21262d]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{q.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#21262d] text-[#8b949e]">{q.resetLabel}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold" style={{ color: q.used >= 80 ? '#ef4444' : q.used >= 50 ? '#f59e0b' : model.color }}>{q.used}%</span>
                        <span className="text-sm text-[#8b949e]">已使用</span>
                        {q.total && <span className="text-xs text-[#6e7681] ml-auto">总量: {q.total}</span>}
                      </div>
                      <div className="w-full h-2.5 bg-[#21262d] rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, q.used)}%`, backgroundColor: q.used >= 80 ? '#ef4444' : q.used >= 50 ? '#f59e0b' : model.color }}
                        />
                      </div>
                      <div className="text-xs text-[#6e7681]">重置时间: {q.resetTime}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </Card>
      )}

      {/* === Smart Scheduling Strategy === */}
      <Card hover={false}>
        <h2 className="text-lg font-semibold text-white mb-2">⚡ 智能调度策略</h2>
        <p className="text-xs text-[#8b949e] mb-4">优先用满免费额度，保留 Opus 用于高价值任务</p>

        <div className="bg-[#0d1117] rounded-lg border border-[#21262d] p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-400 text-lg">🎯</span>
            <span className="text-sm font-semibold text-white">核心原则</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
              <div className="text-green-400 font-bold mb-1">1️⃣ 优先 GLM</div>
              <div className="text-[#8b949e]">编码/文档/分析任务全部走 GLM，免费额度大</div>
            </div>
            <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
              <div className="text-cyan-400 font-bold mb-1">2️⃣ 备用 CoCo</div>
              <div className="text-[#8b949e]">Opus 限流时自动切换 CoCo (MiniMax) 备用</div>
            </div>
            <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
              <div className="text-purple-400 font-bold mb-1">3️⃣ Opus 做主力</div>
              <div className="text-[#8b949e]">复杂对话、浏览器操作、关键决策用 Opus</div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6e7681] border-b border-[#21262d]">
                <th className="text-left py-2 px-3 font-medium w-16">优先级</th>
                <th className="text-left py-2 px-3 font-medium">模型</th>
                <th className="text-left py-2 px-3 font-medium">适用场景</th>
                <th className="text-left py-2 px-3 font-medium">调度规则</th>
              </tr>
            </thead>
            <tbody>
              {schedulingRules.map((rule, i) => (
                <tr key={i} className="border-b border-[#161b22] hover:bg-[#161b22]">
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      rule.priority === 1 ? 'bg-green-500/20 text-green-400' :
                      rule.priority === 2 ? 'bg-cyan-500/20 text-cyan-400' :
                      rule.priority === 3 ? 'bg-blue-500/20 text-blue-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {rule.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      rule.model === 'GLM-5' ? 'bg-green-500/20 text-green-400' :
                      rule.model === 'GLM-4-Flash' ? 'bg-cyan-500/20 text-cyan-400' :
                      rule.model === 'MiniMax M2.5' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {rule.model}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#8b949e]">{rule.condition}</td>
                  <td className="py-3 px-3 text-white">{rule.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Token Consumption Chart */}
      <Card hover={false}>
        <h2 className="text-lg font-semibold text-white mb-6">📈 Token 消耗趋势</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {activeModels.slice(0, 6).map(model => {
            const chartData = [
              { label: '今日', value: model.tokensUsedToday },
              { label: '本周', value: model.tokensUsedWeek },
              { label: '本月', value: model.tokensUsedMonth },
            ];
            const maxVal = Math.max(...chartData.map(d => d.value), 1);
            return (
              <div key={model.name} className="bg-[#0d1117] rounded-lg p-4 border border-[#21262d]">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: model.color }} />
                  {model.name}
                </h3>
                <BarChart data={chartData} maxVal={maxVal} color={model.color} />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
