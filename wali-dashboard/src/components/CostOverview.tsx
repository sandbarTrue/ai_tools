'use client';

import Card from '@/components/Card';
import { ModelInfo } from '@/types';

interface CostOverviewProps {
  models: ModelInfo[];
  isLive: boolean;
}

function formatCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  if (n >= 1) return '$' + n.toFixed(2);
  if (n > 0) return '$' + n.toFixed(4);
  return '$0';
}

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export default function CostOverview({ models, isLive }: CostOverviewProps) {
  // Calculate costs from merged_models
  const totalCostToday = models.reduce((sum, m) => sum + (m._costToday || 0), 0);
  const totalCostWeek = models.reduce((sum, m) => sum + (m._costWeek || 0), 0);
  const totalCostMonth = models.reduce((sum, m) => sum + (m._costMonth || m._cost || 0), 0);

  // Calculate tokens
  const totalTokensToday = models.reduce((sum, m) => sum + m.tokensUsedToday, 0);
  const totalTokensWeek = models.reduce((sum, m) => sum + m.tokensUsedWeek, 0);
  const totalTokensMonth = models.reduce((sum, m) => sum + m.tokensUsedMonth, 0);

  // Calculate calls
  const totalCallsToday = models.reduce((sum, m) => sum + (m._callsToday || 0), 0);
  const totalCallsMonth = models.reduce((sum, m) => sum + (m._callsMonth || m._calls || 0), 0);

  // Daily average (based on month)
  const dailyAvg = totalCostMonth / 30;

  // Projected monthly cost
  const dayOfMonth = new Date().getDate();
  const projected = dayOfMonth > 0 ? (totalCostMonth / dayOfMonth) * 30 : totalCostMonth;

  const costCards = [
    { label: '今日', cost: totalCostToday, tokens: totalTokensToday, calls: totalCallsToday, color: 'text-green-400', bg: 'border-green-500/20' },
    { label: '本周', cost: totalCostWeek, tokens: totalTokensWeek, calls: null, color: 'text-blue-400', bg: 'border-blue-500/20' },
    { label: '本月', cost: totalCostMonth, tokens: totalTokensMonth, calls: totalCallsMonth, color: 'text-purple-400', bg: 'border-purple-500/20' },
  ];

  return (
    <Card hover={false}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">💰 费用统计</h2>
        {isLive && dailyAvg > 0 && (
          <div className="text-xs text-gray-500">
            日均 ~{formatCost(dailyAvg)} · 预计本月 {formatCost(projected)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {costCards.map((card) => (
          <div key={card.label} className={`text-center p-4 bg-[#0d1117] rounded-lg border ${card.bg}`}>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{card.label}</div>
            <div className={`text-3xl font-bold ${card.color}`}>{formatCost(card.cost)}</div>
            {card.calls !== null && card.calls > 0 && (
              <div className="text-xs text-gray-500 mt-2">
                {card.calls.toLocaleString()} 次调用
              </div>
            )}
            <div className="text-xs text-gray-600 mt-1">
              {formatTokens(card.tokens)} tokens
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-600">
        💡 {isLive
          ? '费用数据基于 OpenClaw 会话和 Claude Code hooks 的真实 token 使用量计算'
          : '仅 Claude Opus 4.6 产生费用，其余模型使用免费额度'
        }
      </div>
    </Card>
  );
}
