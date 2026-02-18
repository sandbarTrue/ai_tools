export type ModelName = 'Opus' | 'MiniMax' | 'GLM-5' | 'GLM-4-Flash' | '手动';

export type Priority = '高' | '中' | '低';

export type TaskStatus = 'done' | 'in-progress' | 'planned' | 'blocked';

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  planner: string;
  executor: string;
  planTokens?: number;
  execTokens?: number;
  tokenSource?: 'estimated' | 'session-log' | 'claude-hooks';
  viaClaudeCode: boolean;
  viaOpenSpec: boolean;
  openspecChange?: string;
  openspecTasks?: string;
  openspecProposal?: string;
  model: string;
  tools: string[];
  description?: string;
  subtasks?: SubTask[];
  createdAt: string;
  completedAt?: string;
  archived?: boolean;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  type: 'custom' | 'builtin';
  status: 'active' | 'disabled';
  path: string;
}

export interface QuotaInfo {
  name: string;
  used: number; // percentage 0-100
  total?: string; // display string
  resetTime: string;
  resetLabel: string; // e.g. "每5小时" or "每月"
  color?: string;
}

export interface SchedulingRule {
  priority: number;
  model: string;
  condition: string;
  action: string;
}

export interface ModelInfo {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  tokensUsedToday: number;
  tokensUsedWeek: number;
  tokensUsedMonth: number;
  avgResponseTime: number;
  successRate: number;
  color: string;
  recentLogs?: RequestLog[];
  quotas?: QuotaInfo[];
  // Extended fields from live API
  _apiKey?: string;
  _calls?: number;
  _callsToday?: number;
  _callsWeek?: number;
  _callsMonth?: number;
  _inputTokens?: number;
  _outputTokens?: number;
  _cost?: number;
  _costToday?: number;
  _costWeek?: number;
  _costMonth?: number;
  _cacheReadTokens?: number;
  _priority?: number;
}

export interface RequestLog {
  timestamp: string;
  model: string;
  tokens: number;
  latency: number;
  success: boolean;
  task: string;
}

export interface BrainStatus {
  primary: string;
  backup: string;
  switchCount: number;
  lastSwitch: string;
  history: BrainSwitchEvent[];
}

export interface BrainSwitchEvent {
  timestamp: string;
  from: string;
  to: string;
  reason: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun: string | null;
  lastStatus: 'success' | 'failed' | 'timeout' | null;
  lastDuration: number | null;
  consecutiveFailures: number;
  nextRun: string;
  note?: string;
}

export interface Subscription {
  id: string;
  name: string;
  provider: string;
  authMethod: string;
  purpose: string;
  cost: string;
  status: 'active' | 'free' | 'self-hosted';
  icon: string;
  quotas?: QuotaInfo[];
}
