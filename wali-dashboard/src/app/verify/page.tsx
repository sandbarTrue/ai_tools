'use client';

import { useState, useEffect } from 'react';
import { fetchStats, StatsData, VerifyReport } from '@/lib/api';

// Simple markdown renderer (basic subset)
function renderMarkdown(content: string): string {
  return content
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-white mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-4 mb-2">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    // Code inline
    .replace(/`([^`]+)`/g, '<code class="bg-[#21262d] px-1 py-0.5 rounded text-cyan-400 text-[11px]">$1</code>')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-[#8b949e]">$1</li>')
    // Checkboxes
    .replace(/\[x\]/g, '<span class="text-green-400">✅</span>')
    .replace(/\[ \]/g, '<span class="text-gray-500">⬜</span>')
    // Line breaks
    .replace(/\n/g, '<br/>');
}

function resultBadge(result: string): { text: string; className: string } {
  switch (result) {
    case 'PASS':
      return { text: '通过', className: 'bg-green-500/15 text-green-400 border-green-500/30' };
    case 'FAIL':
      return { text: '失败', className: 'bg-red-500/15 text-red-400 border-red-500/30' };
    default:
      return { text: '未知', className: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
  }
}

export default function VerifyPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<VerifyReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchStats();
      if (cancelled) return;
      if (data) setStats(data);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const verifyReports: VerifyReport[] = stats?.wali_status?.verify_reports || [];

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8b949e] text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">📋 验收报告</h1>
        <p className="text-sm text-[#8b949e] mt-1">
          共 {verifyReports.length} 份报告
        </p>
      </div>

      {/* Report List */}
      {verifyReports.length === 0 ? (
        <div className="bg-[#0d1117] rounded-xl border border-[#30363d] p-8 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-[#8b949e]">暂无验收报告</p>
          <p className="text-[#6e7681] text-xs mt-1">任务完成后会自动生成验收报告</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Report List */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs text-[#8b949e] uppercase tracking-wider mb-3 font-medium">报告列表</div>
            {verifyReports.map((report, idx) => {
              const badge = resultBadge(report.result);
              const isSelected = selectedReport?.file === report.file;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedReport(report)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#161b22] border-purple-500/50 ring-1 ring-purple-500/20'
                      : 'bg-[#0d1117] border-[#21262d] hover:border-[#30363d]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white font-medium truncate flex-1">
                      {report.task_id || '未知任务'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.className}`}>
                      {badge.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#6e7681]">
                    {report.exec_id && <span>执行: {report.exec_id}</span>}
                    {report.created_at && (
                      <span>· {new Date(report.created_at).toLocaleString('zh-CN')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Report Detail */}
          <div className="lg:col-span-8">
            {selectedReport ? (
              <div className="bg-[#0d1117] rounded-xl border border-[#30363d] overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-[#21262d] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>📄</span>
                    <span className="font-semibold text-white text-sm">{selectedReport.task_id || '验收报告'}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${resultBadge(selectedReport.result).className}`}>
                    {resultBadge(selectedReport.result).text}
                  </span>
                </div>

                {/* Meta */}
                <div className="px-4 py-2 bg-[#161b22] border-b border-[#21262d] text-[11px] text-[#6e7681] flex items-center gap-4">
                  {selectedReport.exec_id && (
                    <span>执行ID: <span className="text-white">{selectedReport.exec_id}</span></span>
                  )}
                  {selectedReport.created_at && (
                    <span>生成时间: <span className="text-white">{new Date(selectedReport.created_at).toLocaleString('zh-CN')}</span></span>
                  )}
                  <span>文件: <span className="text-cyan-400">{selectedReport.file}</span></span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div
                    className="text-[12px] text-[#8b949e] leading-relaxed prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedReport.content) }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-[#0d1117] rounded-xl border border-[#30363d] text-[#6e7681] text-sm">
                ← 选择一个报告查看详情
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-[#0d1117] rounded-lg border border-[#21262d] p-4">
        <div className="text-xs text-[#8b949e] font-medium mb-2">📋 验收报告说明</div>
        <div className="space-y-1 text-[11px] text-[#6e7681]">
          <p>• 验收报告在每个任务的执行完成后自动生成</p>
          <p>• 报告包含：执行步骤、检查结果、变更文件列表</p>
          <p>• 报告格式：Markdown，存储在 verify-reports/ 目录</p>
        </div>
      </div>
    </div>
  );
}
