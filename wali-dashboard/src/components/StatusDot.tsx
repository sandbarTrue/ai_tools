interface StatusDotProps {
  status: 'healthy' | 'degraded' | 'down' | 'success' | 'failed' | 'timeout' | 'active' | 'disabled' | null;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export default function StatusDot({ status, pulse = true, size = 'sm' }: StatusDotProps) {
  const colorMap: Record<string, string> = {
    healthy: 'bg-green-500',
    success: 'bg-green-500',
    active: 'bg-green-500',
    degraded: 'bg-yellow-500',
    timeout: 'bg-yellow-500',
    down: 'bg-red-500',
    failed: 'bg-red-500',
    disabled: 'bg-gray-500',
  };

  const color = status ? colorMap[status] || 'bg-gray-500' : 'bg-gray-500';
  const sizeClass = size === 'md' ? 'w-3 h-3' : 'w-2 h-2';

  return (
    <span
      className={`inline-block rounded-full ${sizeClass} ${color} ${pulse && status !== 'disabled' ? 'status-dot-pulse' : ''}`}
    />
  );
}
