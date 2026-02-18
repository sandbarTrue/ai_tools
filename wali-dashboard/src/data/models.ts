import { ModelInfo, BrainStatus, SchedulingRule } from '@/types';

export const defaultModels: ModelInfo[] = [
  {
    name: 'Claude Opus 4.6',
    status: 'healthy',
    tokensUsedToday: 128500,
    tokensUsedWeek: 856200,
    tokensUsedMonth: 3245000,
    avgResponseTime: 2800,
    successRate: 99.2,
    color: '#a855f7',
    quotas: [
      {
        name: '每5小时使用额度',
        used: 1,
        resetTime: '16:54',
        resetLabel: '每5小时',
        color: '#a855f7',
      },
      {
        name: 'MCP 每月额度',
        used: 5,
        resetTime: '2026-03-08 22:52',
        resetLabel: '每月',
        color: '#a855f7',
      },
      {
        name: 'Weekly All Models',
        used: 1,
        resetTime: 'Tue 11:00 AM',
        resetLabel: '每周',
        color: '#a855f7',
      },
      {
        name: 'Current Session',
        used: 6,
        resetTime: '3h 56min',
        resetLabel: '当前会话',
        color: '#a855f7',
      },
    ],
    recentLogs: [
      { timestamp: '2026-02-17T11:30:00Z', model: 'Opus', tokens: 4200, latency: 2650, success: true, task: '搞钱看板构建' },
      { timestamp: '2026-02-17T11:15:00Z', model: 'Opus', tokens: 3800, latency: 3100, success: true, task: '每日商业报告' },
      { timestamp: '2026-02-17T10:45:00Z', model: 'Opus', tokens: 5600, latency: 2900, success: true, task: 'PainRadar分析' },
      { timestamp: '2026-02-17T10:20:00Z', model: 'Opus', tokens: 2100, latency: 1800, success: true, task: 'lark-manager' },
      { timestamp: '2026-02-17T09:50:00Z', model: 'Opus', tokens: 6800, latency: 4200, success: false, task: '支付模块调试' },
    ],
  },
  {
    name: 'MiniMax M2.5',
    status: 'healthy',
    tokensUsedToday: 0,
    tokensUsedWeek: 12400,
    tokensUsedMonth: 45600,
    avgResponseTime: 1500,
    successRate: 97.5,
    color: '#3b82f6',
    quotas: [
      {
        name: 'API 免费额度',
        used: 2,
        total: '¥100/月',
        resetTime: '2026-03-01',
        resetLabel: '每月',
        color: '#3b82f6',
      },
    ],
    recentLogs: [
      { timestamp: '2026-02-16T22:00:00Z', model: 'MiniMax', tokens: 1200, latency: 1400, success: true, task: '备用测试' },
    ],
  },
  {
    name: 'GLM-5',
    status: 'healthy',
    tokensUsedToday: 45200,
    tokensUsedWeek: 312800,
    tokensUsedMonth: 1120000,
    avgResponseTime: 1200,
    successRate: 96.8,
    color: '#22c55e',
    quotas: [
      {
        name: 'API 免费额度',
        used: 8,
        total: '2500万 tokens/月',
        resetTime: '2026-03-01',
        resetLabel: '每月',
        color: '#22c55e',
      },
    ],
    recentLogs: [
      { timestamp: '2026-02-17T11:25:00Z', model: 'GLM-5', tokens: 3200, latency: 1100, success: true, task: '编码任务' },
      { timestamp: '2026-02-17T11:10:00Z', model: 'GLM-5', tokens: 2800, latency: 1350, success: true, task: '飞书表格调试' },
      { timestamp: '2026-02-17T10:55:00Z', model: 'GLM-5', tokens: 4500, latency: 980, success: true, task: 'skill开发' },
      { timestamp: '2026-02-17T10:30:00Z', model: 'GLM-5', tokens: 1800, latency: 1500, success: false, task: '画板skill' },
      { timestamp: '2026-02-17T10:00:00Z', model: 'GLM-5', tokens: 3600, latency: 1200, success: true, task: '痛点挖掘' },
      { timestamp: '2026-02-17T09:30:00Z', model: 'GLM-5', tokens: 2200, latency: 1400, success: true, task: '青云路写作' },
    ],
  },
  {
    name: 'GLM-4-Flash',
    status: 'healthy',
    tokensUsedToday: 22800,
    tokensUsedWeek: 156400,
    tokensUsedMonth: 680000,
    avgResponseTime: 600,
    successRate: 98.1,
    color: '#06b6d4',
    quotas: [
      {
        name: 'API 免费额度',
        used: 3,
        total: '5000万 tokens/月',
        resetTime: '2026-03-01',
        resetLabel: '每月',
        color: '#06b6d4',
      },
    ],
    recentLogs: [
      { timestamp: '2026-02-17T09:05:00Z', model: 'GLM-4-Flash', tokens: 8500, latency: 580, success: true, task: 'PainRadar扫描' },
      { timestamp: '2026-02-17T09:02:00Z', model: 'GLM-4-Flash', tokens: 6200, latency: 620, success: true, task: 'PainRadar分析' },
    ],
  },
];

export const schedulingRules: SchedulingRule[] = [
  {
    priority: 1,
    model: 'Claude Code + GLM-5',
    condition: '编码任务（bug修复、功能开发、重构）',
    action: '优先分配 Claude Code -p 模式 + GLM-5 模型（免费、9-30秒完成）',
  },
  {
    priority: 2,
    model: 'OpenSpec-bg + GLM-5',
    condition: '超大编码项目（多文件、多任务、>100行改动）',
    action: 'screen 持久会话 + tasks.md 驱动循环执行',
  },
  {
    priority: 3,
    model: 'GLM-5 子agent',
    condition: '非多模态任务（文档生成、数据分析、文件读取）',
    action: 'OpenClaw sessions_spawn，免费轻量级',
  },
  {
    priority: 4,
    model: 'Claude Opus 4.6',
    condition: '复杂决策、浏览器操作、多模态、对话交互',
    action: '保留给高价值任务（$200/月额度）',
  },
  {
    priority: 5,
    model: 'MiniMax M2.5',
    condition: 'Claude Opus 429 限流时',
    action: '自动切换备用大脑（5分钟冷却恢复）',
  },
];

export const defaultBrainStatus: BrainStatus = {
  primary: 'Claude Opus 4.6',
  backup: 'MiniMax M2.5',
  switchCount: 7,
  lastSwitch: '2025-02-15T14:30:00Z',
  history: [
    { timestamp: '2025-02-15T14:30:00Z', from: 'MiniMax M2.5', to: 'Claude Opus 4.6', reason: 'Opus恢复可用' },
    { timestamp: '2025-02-15T08:20:00Z', from: 'Claude Opus 4.6', to: 'MiniMax M2.5', reason: 'Opus API 超时' },
    { timestamp: '2025-02-12T16:45:00Z', from: 'MiniMax M2.5', to: 'Claude Opus 4.6', reason: 'Opus恢复可用' },
    { timestamp: '2025-02-12T10:15:00Z', from: 'Claude Opus 4.6', to: 'MiniMax M2.5', reason: 'Opus 限流' },
    { timestamp: '2025-02-08T20:00:00Z', from: 'GLM-5', to: 'Claude Opus 4.6', reason: '切换回主力' },
    { timestamp: '2025-02-08T14:30:00Z', from: 'Claude Opus 4.6', to: 'GLM-5', reason: '测试GLM-5作为主脑' },
    { timestamp: '2025-02-01T00:00:00Z', from: '-', to: 'Claude Opus 4.6', reason: '系统初始化' },
  ],
};
