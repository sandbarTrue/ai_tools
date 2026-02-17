'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import StatusDot from '@/components/StatusDot';
import { ModelInfo } from '@/types';

interface ModelRankingProps {
  models: ModelInfo[];
  title?: string;
  maxItems?: number;
  showExpand?: boolean;
}

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

export default function ModelRanking({ 
  models, 
  title = '模型排行', 
  maxItems = 10,
  showExpand = true 
}: ModelRankingProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  // Sort by calls
  const sortedModels = [...models]
    .filter(m => (m._calls || 0) > 0 || m.tokensUsedMonth > 0)
    .sort((a, b) => (b._calls || 0) - (a._calls || 0));

  const displayModels = expanded ? sortedModels : sortedModels.slice(0, maxItems);
  const hasMore = sortedModels.length > maxItems;

  // Calculate totals
  const totalCalls = sortedModels.reduce((s, m) => s + (m._calls || 0), 0);
  const totalInputTokens = sortedModels.reduce((s, m) => s + (m._inputTokens || 0), 0);
  const totalOutputTokens = sortedModels.reduce((s, m) => s + (m._outputTokens || 0), 0);
  const totalCost = sortedModels.reduce((s, m) => s + (m._cost || 0), 0);

  if (sortedModels.length === 0) {
    return null;
  }

  return (
    <Card hover={false}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">🏆 {title}</h2>
        <div className="text-xs text-gray-500">{sortedModels.length} 个活跃模型</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-[#21262d]">
              <th className="text-left py-2 px-2 font-medium w-10">#</th>
              <th className="text-left py-2 px-2 font-medium">模型</th>
              <th className="text-right py-2 px-2 font-medium">调用次数</th>
              <th className="text-right py-2 px-2 font-medium">输入</th>
              <th className="text-right py-2 px-2 font-medium">输出</th>
              <th className="text-right py-2 px-2 font-medium">费用</th>
            </tr>
          </thead>
          <tbody>
            {displayModels.map((model, i) => {
              const isExpanded = expandedModel === model.name;
              const hasSubModels = (model as any)._subModels && (model as any)._subModels.length > 0;
              
              return (
                <>
                  <tr 
                    key={model.name} 
                    className={`border-b border-[#21262d]/50 hover:bg-[#161b22] ${hasSubModels ? 'cursor-pointer' : ''}`}
                    onClick={() => hasSubModels && setExpandedModel(isExpanded ? null : model.name)}
                  >
                    <td className="py-2 px-2 text-gray-500 font-mono">{i + 1}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: model.color }} 
                        />
                        <span className="text-white font-medium truncate max-w-[200px]">{model.name}</span>
                        <StatusDot status={model.status} size="sm" />
                        {hasSubModels && (
                          <span className="text-gray-500 text-[10px]">
                            {isExpanded ? '▼' : '▶'} {(model as any)._subModels.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right text-white font-mono">
                      {(model._calls || 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-400 font-mono">
                      {formatTokens(model._inputTokens || 0)}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-400 font-mono">
                      {formatTokens(model._outputTokens || 0)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">
                      <span className={(model._cost || 0) > 0 ? 'text-yellow-400' : 'text-green-400'}>
                        {(model._cost || 0) > 0 ? formatCost(model._cost || 0) : '免费'}
                      </span>
                    </td>
                  </tr>
                  {/* Sub-models (merged models detail) */}
                  {isExpanded && hasSubModels && (model as any)._subModels.map((sub: any, j: number) => (
                    <tr key={`${model.name}-sub-${j}`} className="border-b border-[#21262d]/30 bg-[#0d1117]">
                      <td className="py-1.5 px-2"></td>
                      <td className="py-1.5 px-2 pl-6">
                        <span className="text-gray-500 text-[10px]">└</span>
                        <span className="text-gray-400 ml-1 text-[11px] truncate max-w-[180px]">{sub.name || sub}</span>
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-500 font-mono text-[11px]">
                        {(sub.calls || 0).toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-500 font-mono text-[11px]">
                        {formatTokens(sub.input_tokens || 0)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-500 font-mono text-[11px]">
                        {formatTokens(sub.output_tokens || 0)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-500 font-mono text-[11px]">
                        {(sub.cost || 0) > 0 ? formatCost(sub.cost || 0) : '—'}
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#30363d] font-medium">
              <td className="py-2 px-2" colSpan={2}>
                <span className="text-gray-400">合计 {sortedModels.length} 个模型</span>
              </td>
              <td className="py-2 px-2 text-right text-white font-mono">
                {totalCalls.toLocaleString()}
              </td>
              <td className="py-2 px-2 text-right text-gray-400 font-mono">
                {formatTokens(totalInputTokens)}
              </td>
              <td className="py-2 px-2 text-right text-gray-400 font-mono">
                {formatTokens(totalOutputTokens)}
              </td>
              <td className="py-2 px-2 text-right text-yellow-400 font-mono">
                {formatCost(totalCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {showExpand && hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {expanded ? '收起' : `展开全部 ${sortedModels.length} 个模型`}
        </button>
      )}
    </Card>
  );
}
