'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/Card';
import { defaultSubscriptions } from '@/data/subscriptions';
import { fetchStats, StatsData } from '@/lib/api';
import { Subscription } from '@/types';

const statusStyles: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '付费', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  free: { label: '免费', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
  'self-hosted': { label: '自部署', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
};

function DataBadge({ live, time }: { live: boolean; time?: string }) {
  const t = time ? new Date(time).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${live ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
      {live ? '🟢' : '🟡'} {live ? `实时数据 · ${t}` : '示例数据 · API 离线'}
    </span>
  );
}

// Group subscriptions by provider
interface ProviderGroup {
  name: string;
  icon: string;
  subscriptions: Subscription[];
}

function getProviderGroups(): ProviderGroup[] {
  const groupMap: Record<string, { icon: string; subs: Subscription[] }> = {};
  const providerOrder = ['Anthropic', '智谱AI', 'OpenAI', 'MiniMax', 'Vercel', 'Spaceship', 'GitHub', 'OpenClaw'];

  defaultSubscriptions.forEach(sub => {
    if (!groupMap[sub.provider]) {
      groupMap[sub.provider] = { icon: sub.icon, subs: [] };
    }
    groupMap[sub.provider].subs.push(sub);
  });

  // Sort by predefined order, unknown providers at end
  const groups: ProviderGroup[] = [];
  providerOrder.forEach(p => {
    if (groupMap[p]) {
      groups.push({ name: p, icon: groupMap[p].icon, subscriptions: groupMap[p].subs });
      delete groupMap[p];
    }
  });
  // Remaining
  Object.entries(groupMap).forEach(([name, data]) => {
    groups.push({ name, icon: data.icon, subscriptions: data.subs });
  });
  return groups;
}

function ClaudeMaxCard({ stats }: { stats: StatsData }) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="text-3xl shrink-0">🧠</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-white">Claude Max 20x</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-orange-500/10 border-orange-500/30 text-orange-400">
              {stats.claude_max?.plan || 'Max 20x'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-green-500/10 border-green-500/30 text-green-400">
              🟢 实时
            </span>
          </div>
          <div className="text-xs text-[#8b949e] mb-3">
            Anthropic · {stats.claude_max?.price || '$200/mo'} · 主备双脑切换
          </div>

          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <div>
              <span className="text-[#6e7681]">当前大脑</span>
              <div className={`mt-0.5 font-medium ${stats.brain_status?.currentBrain === 'primary' ? 'text-green-400' : 'text-yellow-400'}`}>
                {stats.brain_status?.currentBrain === 'primary' ? '🟢 Claude (主)' : '🟡 MiniMax (备)'}
              </div>
            </div>
            <div>
              <span className="text-[#6e7681]">累计额外费用</span>
              <div className="text-orange-400 mt-0.5 font-medium">
                ${stats.claude_max?.total_cost?.toFixed(2) || '0'}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#21262d] space-y-3">
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-[#6e7681]">⏱️ 5小时窗口用量</span>
                <span className="text-[#8b949e]">
                  {stats.claude_max?.window_usage?.calls || 0} 次调用 · ${(stats.claude_max?.window_usage?.cost || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex gap-4 text-[10px] text-[#6e7681]">
                <span>📥 {((stats.claude_max?.window_usage?.input_tokens || 0) / 1000).toFixed(0)}K in</span>
                <span>📤 {((stats.claude_max?.window_usage?.output_tokens || 0) / 1000).toFixed(0)}K out</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-[#6e7681]">📅 今日调用</span>
                <span className="text-[#8b949e]">
                  {Object.entries(stats.models)
                    .filter(([k]) => k.includes('claude') || k.includes('anthropic'))
                    .reduce((a, [, m]) => a + (m.today?.calls || 0), 0).toLocaleString()} 次
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-[#6e7681]">📞 总调用 / 会话</span>
                <span className="text-[#8b949e]">
                  {Object.entries(stats.models)
                    .filter(([k]) => k.includes('claude') || k.includes('anthropic'))
                    .reduce((a, [, m]) => a + m.calls, 0).toLocaleString()} 次 · {stats.sessions?.total || 0} 会话
                </span>
              </div>
            </div>

            {stats.brain_status && (
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#6e7681]">🔄 主/备请求</span>
                  <span className="text-[#8b949e]">
                    {stats.brain_status.requestCount?.primary || 0} / {stats.brain_status.requestCount?.backup || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ZhipuQuotaCard({ data }: { data: StatsData }) {
  const zq = data.zhipu_quota;
  if (!zq) return null;

  const timeLimit = zq.limits?.find(l => l.type === 'TIME_LIMIT');
  const tokenLimit = zq.limits?.find(l => l.type === 'TOKENS_LIMIT');
  const sub = zq.subscription;

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="text-3xl shrink-0">🤖</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-white">GLM Coding Pro</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-purple-500/10 border-purple-500/30 text-purple-400">
              {zq.level?.toUpperCase() || 'Pro'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-green-500/10 border-green-500/30 text-green-400">
              🟢 实时
            </span>
          </div>
          <div className="text-xs text-[#8b949e] mb-3">
            {sub ? `${sub.productName} · ¥${sub.actualPrice}/${sub.billingCycle === 'quarterly' ? '季' : '月'}` : '智谱 AI 开放平台'}
          </div>

          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <div>
              <span className="text-[#6e7681]">套餐状态</span>
              <div className="text-green-400 mt-0.5 font-medium">{sub?.status === 'VALID' ? '✅ 有效' : sub?.status || '未知'}</div>
            </div>
            <div>
              <span className="text-[#6e7681]">下次续费</span>
              <div className="text-[#8b949e] mt-0.5">{sub?.nextRenewTime || 'N/A'}</div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#21262d] space-y-3">
            {timeLimit && (
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-[#6e7681]">🕐 月调用次数</span>
                  <span className="text-[#8b949e]">{timeLimit.currentValue}/{timeLimit.usage} ({timeLimit.percentage}%)</span>
                </div>
                <div className="w-full h-2 bg-[#21262d] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all bg-purple-500"
                    style={{ width: `${Math.min(100, timeLimit.percentage)}%` }}
                  />
                </div>
                {timeLimit.usageDetails && timeLimit.usageDetails.length > 0 && (
                  <div className="flex gap-3 mt-1">
                    {timeLimit.usageDetails.filter(d => d.usage > 0).map(d => (
                      <span key={d.modelCode} className="text-[10px] text-[#6e7681]">
                        {d.modelCode}: {d.usage}次
                      </span>
                    ))}
                  </div>
                )}
                {timeLimit.nextResetTime && (
                  <div className="text-[10px] text-[#6e7681] mt-0.5">
                    重置: {new Date(timeLimit.nextResetTime).toLocaleDateString('zh-CN')}
                  </div>
                )}
              </div>
            )}
            {tokenLimit && (
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-[#6e7681]">📊 Token 额度</span>
                  <span className="text-[#8b949e]">{tokenLimit.percentage}% · {tokenLimit.number}M tokens</span>
                </div>
                <div className="w-full h-2 bg-[#21262d] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all bg-blue-500"
                    style={{ width: `${Math.min(100, tokenLimit.percentage)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SubscriptionCard({ sub }: { sub: Subscription }) {
  const style = statusStyles[sub.status];
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="text-3xl shrink-0">{sub.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-white">{sub.name}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${style.bg} ${style.color}`}>
              {style.label}
            </span>
          </div>
          <div className="text-xs text-[#8b949e] mb-3">{sub.provider}</div>

          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <div>
              <span className="text-[#6e7681]">认证方式</span>
              <div className="text-[#8b949e] mt-0.5">{sub.authMethod}</div>
            </div>
            <div>
              <span className="text-[#6e7681]">费用</span>
              <div className={`mt-0.5 font-medium ${sub.status === 'active' ? 'text-orange-400' : 'text-green-400'}`}>
                {sub.cost}
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-[#6e7681]">用途</span>
              <div className="text-white mt-0.5">{sub.purpose}</div>
            </div>
          </div>

          {sub.quotas && sub.quotas.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#21262d] space-y-2">
              {sub.quotas.map((q, qi) => (
                <div key={qi}>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-[#6e7681]">{q.name}</span>
                    <span className="text-[#8b949e]">{q.used}%{q.total ? ` · ${q.total}` : ''}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, q.used)}%`,
                        backgroundColor: q.used >= 80 ? '#ef4444' : q.used >= 50 ? '#f59e0b' : (q.color || '#8b949e'),
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-[#6e7681] mt-0.5">重置: {q.resetTime}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function SubscriptionsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats().then(data => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  const paidCount = defaultSubscriptions.filter(s => s.status === 'active').length;
  const freeCount = defaultSubscriptions.filter(s => s.status === 'free').length;

  const zhipuMonthlyCost = stats?.zhipu_quota?.subscription?.actualPrice
    ? Math.round(stats.zhipu_quota.subscription.actualPrice / 3)
    : 0;
  const totalMonthlyCost = 5 + zhipuMonthlyCost;

  const providerGroups = getProviderGroups();

  // Provider-specific colors
  const providerColors: Record<string, string> = {
    'Anthropic': 'border-l-purple-500',
    '智谱AI': 'border-l-green-500',
    'OpenAI': 'border-l-emerald-500',
    'MiniMax': 'border-l-blue-500',
    'Vercel': 'border-l-white',
    'Spaceship': 'border-l-orange-500',
    'GitHub': 'border-l-gray-400',
    'OpenClaw': 'border-l-red-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">💳 订阅服务</h1>
          <p className="text-sm text-[#8b949e] mt-1">
            共 {defaultSubscriptions.length} 项服务 · {paidCount} 项付费 · {freeCount} 项免费
          </p>
        </div>
        {!loading && <DataBadge live={!!stats} time={stats?.generated_at} />}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider">月度总支出</div>
          <div className="text-3xl font-bold text-orange-400 mt-2">
            {stats?.zhipu_quota ? `~¥${totalMonthlyCost}` : '~$5'}
          </div>
          <div className="text-xs text-[#6e7681] mt-1">
            {stats?.zhipu_quota ? `Spaceship $5 + 智谱 ¥${zhipuMonthlyCost}/月` : 'Spaceship 主机'}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider">API 费用 (累计)</div>
          <div className="text-3xl font-bold text-purple-400 mt-2">
            {stats ? `$${Object.values(stats.models).reduce((a, m) => a + m.cost, 0).toFixed(0)}` : '按量'}
          </div>
          <div className="text-xs text-[#6e7681] mt-1">Claude Opus 4.6 按量计费</div>
        </Card>
        <Card>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider">供应商数量</div>
          <div className="text-3xl font-bold text-green-400 mt-2">{providerGroups.length}</div>
          <div className="text-xs text-[#6e7681] mt-1">{freeCount} 项使用免费额度 🎉</div>
        </Card>
      </div>

      {/* Provider Groups */}
      {providerGroups.map(group => {
        const borderColor = providerColors[group.name] || 'border-l-gray-500';
        const isAnthropic = group.name === 'Anthropic';
        const isZhipu = group.name === '智谱AI';

        return (
          <div key={group.name} className={`border-l-4 ${borderColor} pl-4`}>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>{group.icon}</span>
              <span>{group.name}</span>
              <span className="text-xs text-[#6e7681] font-normal">
                ({group.subscriptions.length} 项服务)
              </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Anthropic: show Claude Max real data first */}
              {isAnthropic && stats?.claude_max && (
                <ClaudeMaxCard stats={stats} />
              )}

              {/* Zhipu: show GLM Coding Pro real data first */}
              {isZhipu && stats?.zhipu_quota && (
                <ZhipuQuotaCard data={stats} />
              )}

              {/* Regular subscription cards */}
              {group.subscriptions.map(sub => (
                <SubscriptionCard key={sub.id} sub={sub} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
