import { ModelInfo, BrainStatus } from '@/types';
import { StatsData, ModelStats } from './api';

// Display name mapping from API model keys
const MODEL_DISPLAY: Record<string, { name: string; color: string; priority: number }> = {
  'anthropic-oauth-proxy/claude-opus-4-6': { name: 'Claude Opus 4.6 (OpenClaw)', color: '#a855f7', priority: 1 },
  'anthropic/claude-opus-4-6': { name: 'Claude Opus 4.6 (直连)', color: '#c084fc', priority: 2 },
  'zhipu/glm-4.7': { name: 'GLM-5', color: '#22c55e', priority: 3 },
  'ai-agent-proxy-responses/gpt-5.2-2025-12-11': { name: 'GPT-5.2', color: '#10b981', priority: 4 },
  'ai-agent-proxy-google/gemini-3-pro-preview-new': { name: 'Gemini 3 Pro', color: '#3b82f6', priority: 5 },
  'coco-proxy/coco': { name: 'CoCo (MiniMax)', color: '#06b6d4', priority: 6 },
  'openclaw/delivery-mirror': { name: 'Delivery Mirror', color: '#6366f1', priority: 7 },
  'anthropic/claude-sonnet-4-5-20250929-thinking': { name: 'Claude Sonnet 4.5', color: '#ec4899', priority: 8 },
  'anthropic/claude-opus-4-5': { name: 'Claude Opus 4.5', color: '#f472b6', priority: 9 },
  'ai-agent-proxy-responses/gpt-5.2-codex-2026-01-14': { name: 'GPT-5.2 Codex', color: '#14b8a6', priority: 10 },
};

function getDisplayInfo(key: string) {
  if (MODEL_DISPLAY[key]) return MODEL_DISPLAY[key];
  // Fallback: use the model part of provider/model
  const parts = key.split('/');
  const modelName = parts.length > 1 ? parts[1] : key;
  return { name: modelName, color: '#8b949e', priority: 100 };
}

// 模型 key 标准化映射（合并大小写不同的 key）
const MODEL_KEY_NORMALIZE_MAP: Record<string, string> = {
  'claude-code/GLM-5': 'claude-code/glm-5', // 合并大小写变体
};

// 需要隐藏的模型 key（不是真实模型）
const HIDDEN_MODEL_KEYS = new Set([
  'claude-code/aggregated',
]);

export function transformModels(stats: StatsData): ModelInfo[] {
  // 先对原始数据进行合并
  const mergedData: Record<string, ModelStats> = {};

  for (const [key, data] of Object.entries(stats.models)) {
    // 跳过隐藏的模型
    if (HIDDEN_MODEL_KEYS.has(key)) continue;

    // 标准化 key
    const normalizedKey = MODEL_KEY_NORMALIZE_MAP[key] || key;

    if (mergedData[normalizedKey]) {
      // 合并数据
      const existing = mergedData[normalizedKey];
      existing.calls += data.calls;
      existing.input_tokens += data.input_tokens;
      existing.output_tokens += data.output_tokens;
      existing.cache_read_tokens = (existing.cache_read_tokens || 0) + (data.cache_read_tokens || 0);
      existing.cost += data.cost;
      // 合并时间段数据
      existing.today.calls += data.today.calls;
      existing.today.input_tokens += data.today.input_tokens;
      existing.today.output_tokens += data.today.output_tokens;
      existing.today.cost = (existing.today.cost || 0) + (data.today.cost || 0);
      existing.week.calls += data.week.calls;
      existing.week.input_tokens += data.week.input_tokens;
      existing.week.output_tokens += data.week.output_tokens;
      existing.week.cost = (existing.week.cost || 0) + (data.week.cost || 0);
      existing.month.calls += data.month.calls;
      existing.month.input_tokens += data.month.input_tokens;
      existing.month.output_tokens += data.month.output_tokens;
      existing.month.cost = (existing.month.cost || 0) + (data.month.cost || 0);
    } else {
      mergedData[normalizedKey] = { ...data };
    }
  }

  const models: ModelInfo[] = [];

  for (const [key, data] of Object.entries(mergedData)) {
    const display = getDisplayInfo(key);
    const totalTokens = data.input_tokens + data.output_tokens;
    const todayTokens = data.today.input_tokens + data.today.output_tokens;
    const weekTokens = data.week.input_tokens + data.week.output_tokens;
    const monthTokens = data.month.input_tokens + data.month.output_tokens;

    models.push({
      name: display.name,
      status: 'healthy', // We don't have real health data yet, default healthy
      tokensUsedToday: todayTokens,
      tokensUsedWeek: weekTokens,
      tokensUsedMonth: monthTokens,
      avgResponseTime: 0, // Not tracked yet
      successRate: 100, // Not tracked yet
      color: display.color,
      _apiKey: key,
      _calls: data.calls,
      _callsToday: data.today.calls,
      _callsWeek: data.week.calls,
      _callsMonth: data.month.calls,
      _inputTokens: data.input_tokens,
      _outputTokens: data.output_tokens,
      _cost: data.cost,
      _costToday: data.today.cost || 0,
      _costWeek: data.week.cost || 0,
      _costMonth: data.month.cost || 0,
      _cacheReadTokens: data.cache_read_tokens || 0,
      _priority: display.priority,
    } as ModelInfo & Record<string, unknown>);
  }

  // Sort by priority
  models.sort((a, b) => (a._priority || 100) - (b._priority || 100));

  return models;
}

export function transformBrainStatus(stats: StatsData): BrainStatus {
  const bs = stats.brain_status;
  if (!bs) {
    return {
      primary: 'Unknown',
      backup: 'Unknown',
      switchCount: 0,
      lastSwitch: new Date().toISOString(),
      history: [],
    };
  }

  return {
    primary: bs.currentBrain === 'primary' ? 'Claude Opus 4.6' : 'CoCo (MiniMax)',
    backup: bs.currentBrain === 'primary' ? 'CoCo (MiniMax)' : 'Claude Opus 4.6',
    switchCount: bs.requestCount.primary + bs.requestCount.backup,
    lastSwitch: bs.lastSwitchTime,
    history: [],
  };
}

export function getTopModels(models: ModelInfo[], count: number = 6): ModelInfo[] {
  // Sort by total calls, take top N
  return [...models]
    .filter(m => (m._calls || 0) > 0)
    .sort((a, b) => (b._calls || 0) - (a._calls || 0))
    .slice(0, count);
}
