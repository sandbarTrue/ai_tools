const API_BASE = 'https://junaitools.com/wali-api';

export interface ZhipuQuotaData {
  level: string;
  limits: Array<{
    type: string;
    unit: number;
    number: number;
    usage?: number;
    currentValue?: number;
    remaining?: number;
    percentage: number;
    nextResetTime?: number;
    usageDetails?: Array<{ modelCode: string; usage: number }>;
  }>;
  subscription: {
    productName: string;
    status: string;
    actualPrice: number;
    billingCycle: string;
    valid: string;
    nextRenewTime: string;
    autoRenew: number;
  } | null;
}

export interface ClaudeQuotaData {
  plan: string;
  usage_percent: number;
  reset_time: string;
}

export interface ClaudeMaxData {
  plan: string;
  price: string;
  window_hours: number;
  window_usage: {
    calls: number;
    input_tokens: number;
    output_tokens: number;
    cost: number;
  };
  total_cost: number;
}

export interface SessionsData {
  total: number;
  today: number;
}

export interface WaliQueueItem {
  task: string;
  executor?: string;
  planned?: string;
}

export interface WaliStatusData {
  currentTask: string;
  status: 'working' | 'investigating' | 'idle' | 'deploying' | 'blocked';
  startedAt: string;
  executor?: string;
  queue: Array<string | WaliQueueItem>;
  lastUpdate: string;
  recentActions: Array<{ time: string; action: string; executor?: string; tokens?: string }>;
  tasks?: WaliTasksData;
  executions?: WaliExecution[];
}

export interface WaliTasksData {
  total: number;
  completed: number;
  phases: WaliPhase[];
}

export interface WaliPhase {
  name: string;
  tasks: WaliTaskItem[];
}

export interface WaliTaskItem {
  id: string;
  title: string;
  done: boolean;
}

export interface WaliExecution {
  id: string;
  type: 'openspec' | 'direct';
  model: string;
  status: 'success' | 'failed' | 'running';
  cost: number;
  duration_ms: number;
  started_at: string;
  finished_at: string | null;
  task_title: string;
  task_id?: string | null; // ID of the business task this execution belongs to
  matched_task?: string | null; // ID of the matched task (set after association)
  proposal?: string;
  tasks?: string[];
  fail_reason?: string | null;
}

export interface ActiveTask {
  name: string;
  status: 'running' | 'stale' | 'completed';
  age_minutes: number;
  last_output_minutes: number;
  stale: boolean;
}

export interface StatsData {
  generated_at: string;
  models: Record<string, ModelStats>;
  brain_status: BrainStatusData | null;
  claude_code: ClaudeCodeData;
  zhipu_quota: ZhipuQuotaData | null;
  claude_quota: ClaudeQuotaData | null;
  claude_max: ClaudeMaxData | null;
  sessions: SessionsData | null;
  wali_status?: WaliStatusData | null;
  active_tasks?: ActiveTask[];
  live_sessions?: LiveSession[];
  task_progress?: TaskProgress;
  openspec_history?: OpenSpecHistory[];
}

export interface OpenSpecHistory {
  change: string;
  completed: number;
  total: number;
  duration?: string;
  cost?: string;
  status: 'success' | 'failed' | 'in_progress';
  tasks?: OpenSpecTask[];
}

export interface OpenSpecTask {
  title: string;
  done: boolean;
}

export interface LiveSession {
  id: string;
  kind: 'main' | 'group' | 'subagent';
  label: string;
  model?: string;
  executor?: string;
  lastActiveMinutes: number;
  lastAction?: string;
  tokens?: number;
  status: 'active' | 'recent' | 'idle';
}

export interface TaskProgress {
  total: number;
  completed: number;
  percentage: number;
  phases: TaskPhase[];
}

export interface TaskPhase {
  name: string;
  tasks: number;
  done: number;
}

export interface ModelStats {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cost: number;
  today: TimePeriodStats;
  week: TimePeriodStats;
  month: TimePeriodStats;
}

export interface TimePeriodStats {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost?: number;
}

export interface BrainStatusData {
  currentBrain: string;
  primaryRateLimitedAt: string | null;
  backupRateLimitedAt: string | null;
  lastSwitchTime: string;
  requestCount: { primary: number; backup: number };
  errorCount: { primary: number; backup: number };
  cooldownMs: number;
}

export interface ClaudeCodeData {
  sessions: Array<{
    id: string;
    cwd: string;
    started: string;
    ended: string | null;
    tools: number;
    failures: number;
  }>;
  tool_usage: Record<string, number>;
  total_events: number;
}

export async function fetchStats(): Promise<StatsData | null> {
  try {
    // 添加 cache-bust 参数防止浏览器缓存
    const cacheBust = `?t=${Date.now()}`;
    const res = await fetch(`${API_BASE}/stats.json${cacheBust}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * SSE 实时连接
 * 优先使用 SSE 推送，失败时降级到轮询
 */
export function connectSSE(token: string, onData: (data: StatsData) => void): () => void {
  const es = new EventSource(`https://junaitools.com/ws/?sse=1&token=${token}`);

  es.addEventListener('stats_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      onData(data);
    } catch {
      // 解析失败，忽略
    }
  });

  es.onerror = () => {
    // SSE 连接失败，关闭连接（调用方应降级到轮询）
    es.close();
  };

  return () => es.close();
}
