'use client';

interface DataSourceBadgeProps {
  isLive: boolean;
  generatedAt?: string;
}

export default function DataSourceBadge({ isLive, generatedAt }: DataSourceBadgeProps) {
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (isLive) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-xs">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-green-400 font-medium">
          Live
          {generatedAt && ` · 最后更新: ${formatTime(generatedAt)}`}
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-xs">
      <span className="w-2 h-2 rounded-full bg-yellow-400" />
      <span className="text-yellow-400 font-medium">示例数据 · API 离线</span>
    </div>
  );
}
