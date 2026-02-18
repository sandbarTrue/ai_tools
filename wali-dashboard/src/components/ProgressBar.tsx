interface ProgressBarProps {
  value: number;
  color?: string;
  showLabel?: boolean;
  height?: string;
}

export default function ProgressBar({
  value,
  color = 'bg-blue-500',
  showLabel = true,
  height = 'h-2',
}: ProgressBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} bg-[#21262d] rounded-full overflow-hidden`}>
        <div
          className={`${height} ${color} rounded-full progress-animated transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-[#8b949e] w-10 text-right">{value}%</span>
      )}
    </div>
  );
}
