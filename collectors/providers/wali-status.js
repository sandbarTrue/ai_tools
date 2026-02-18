/**
 * Wali Status Provider
 *
 * Automatically infers Wali's working status from runtime data:
 * - OpenClaw session activity (JSONL files)
 * - Screen processes (openspec-bg / direct tasks)
 * - Today's todo list from memory files
 *
 * Replaces the static /tmp/wali-status.json approach.
 *
 * @module collectors/providers/wali-status
 */

// Node.js 内置模块
const fs = require('fs');           // 文件系统操作
const path = require('path');       // 路径处理工具
const { execSync } = require('child_process');  // 同步执行 shell 命令

// UTC+8 时区偏移量（毫秒），用于将 UTC 时间转换为中国标准时间
const UTC8_OFFSET = 8 * 60 * 60 * 1000;

/**
 * Format a timestamp to HH:MM in UTC+8
 * 将时间戳格式化为 UTC+8 时区的 HH:MM 格式
 * @param {number} ts - 时间戳（毫秒）
 * @returns {string} 格式化后的时间字符串，如 "14:30"
 */
function formatTimeUTC8(ts) {
  const d = new Date(ts + UTC8_OFFSET);
  return d.toISOString().slice(11, 16);
}

/**
 * Get ISO string in UTC+8
 * 获取 UTC+8 时区的 ISO 格式时间字符串
 * @param {number} ts - 时间戳（毫秒），可选，默认为当前时间
 * @returns {string} ISO 格式时间字符串，如 "2024-02-18T14:30:00.000+08:00"
 */
function isoUTC8(ts) {
  const d = new Date(ts || Date.now());
  const offset = d.getTime() + UTC8_OFFSET;
  return new Date(offset).toISOString().replace('Z', '+08:00');
}

/**
 * Infer executor name from provider/model string
 * 根据 provider 和 model 字符串推断执行者名称
 * @param {string} provider - AI 服务提供商标识
 * @param {string} model - 模型名称
 * @returns {string} 推断出的执行者名称，如 "瓦力(Opus)"、"GLM-5"、"MiniMax" 等
 */
function inferExecutor(provider, model) {
  const key = `${provider}/${model}`.toLowerCase();
  // 根据模型特征匹配对应的执行者名称
  if (key.includes('opus') || key.includes('anthropic-oauth-proxy')) return '瓦力(Opus)';
  if (key.includes('glm')) return 'GLM-5';
  if (key.includes('minimax') || key.includes('coco')) return 'MiniMax';
  if (key.includes('claude-code')) return 'Claude Code';
  if (key.includes('haiku')) return 'Claude Haiku';
  return model || provider || '未知';
}

/**
 * Extract action description from a message object
 * 从消息对象中提取操作描述，用于生成可读的动作摘要
 * @param {Object} msg - 消息对象，包含 content 字段
 * @returns {string|null} 操作描述字符串，如 "执行命令"、"写入文件" 等
 */
function extractAction(msg) {
  if (!msg || !msg.content) return null;

  const content = msg.content;

  // Handle array content (tool calls)
  // 处理数组类型的 content，通常包含工具调用
  if (Array.isArray(content)) {
    for (const block of content) {
      // 检查是否为工具调用类型
      if (block.type === 'toolCall' || block.type === 'tool_use') {
        const name = block.name || block.toolName || '';
        const args = block.arguments || block.input || {};
        // 根据工具名称生成人类可读的操作描述，尽可能包含具体内容
        if (name === 'exec') {
          const cmd = (args.command || '').split('\n')[0].slice(0, 80);
          // 翻译常见命令为人话
          if (cmd.includes('next build')) return '构建前端项目';
          if (cmd.includes('tar ') && cmd.includes('scp ')) return '打包部署到服务器';
          if (cmd.includes('scp ')) return '上传文件到服务器';
          if (cmd.includes('node index.js') && cmd.includes('collectors')) return '运行数据采集器';
          if (cmd.includes('screen -ls')) return '检查后台任务';
          if (cmd.includes('curl ')) return '测试 API 接口';
          if (cmd.includes('grep ') || cmd.includes('cat ') || cmd.includes('sed ')) return '查看代码/日志';
          if (cmd.includes('ls /tmp/task-done')) return '检查任务完成状态';
          if (cmd.includes('npm ') || cmd.includes('npx ')) return '执行 Node.js 工具';
          return cmd ? `$ ${cmd}` : '执行命令';
        }
        if (name === 'write') {
          const fp = (args.path || args.file_path || '').split('/').pop();
          return fp ? `写入 ${fp}` : '写入文件';
        }
        if (name === 'edit') {
          const fp = (args.path || args.file_path || '').split('/').pop();
          return fp ? `编辑 ${fp}` : '编辑文件';
        }
        if (name === 'read') {
          const fp = (args.path || args.file_path || '').split('/').pop();
          return fp ? `读取 ${fp}` : '读取文件';
        }
        if (name === 'web_search') return `搜索: ${(args.query || '').slice(0, 30)}`;
        if (name === 'web_fetch') return `抓取: ${(args.url || '').slice(0, 40)}`;
        if (name === 'browser') return `浏览器: ${args.action || ''}`;
        if (name === 'sessions_spawn') {
          const task = (args.task || '').slice(0, 40);
          return task ? `派发: ${task}` : '派发子任务';
        }
        if (name === 'sessions_send') return `消息→session`;
        if (name === 'message') {
          const msg = (args.message || '').slice(0, 30);
          return msg ? `发送: ${msg}` : '发送消息';
        }
        if (name === 'feishu_doc') return `飞书文档: ${args.action || ''}`;
        if (name.startsWith('feishu_')) return `飞书: ${name.replace('feishu_', '')}`;
        if (name === 'memory_search') return `搜索记忆: ${(args.query || '').slice(0, 20)}`;
        if (name === 'cron') return `定时任务: ${args.action || ''}`;
        if (name === 'session_status') return `查看状态`;
        return `${name}`;
      }
    }
    return null;
  }

  return null;
}

/**
 * Read last N bytes of a file efficiently
 * 高效读取文件的最后 N 字节，避免读取整个大文件
 * @param {string} filePath - 文件路径
 * @param {number} bytes - 要读取的字节数
 * @returns {string} 文件内容字符串，失败时返回空字符串
 */
function readLastBytes(filePath, bytes) {
  try {
    const stat = fs.statSync(filePath);
    const size = stat.size;
    // 如果文件大小小于请求的字节数，直接读取整个文件
    if (size <= bytes) {
      return fs.readFileSync(filePath, 'utf8');
    }
    // 使用文件描述符定位读取，只读取文件末尾部分
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(bytes);
    fs.readSync(fd, buffer, 0, bytes, size - bytes);
    fs.closeSync(fd);
    return buffer.toString('utf8');
  } catch (e) {
    return '';
  }
}

/**
 * Parse JSONL lines from text, skipping malformed ones
 * 解析 JSONL 格式的文本，自动跳过格式错误的行
 * @param {string} text - JSONL 格式的文本内容
 * @returns {Array} 解析后的对象数组
 */
function parseJsonlLines(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const entries = [];
  for (const line of lines) {
    try {
      // Skip partial first line (from byte seek)
      // 跳过由于字节定位导致的不完整首行
      const parsed = JSON.parse(line);
      entries.push(parsed);
    } catch (e) {
      // Skip malformed line (likely truncated from seek)
      // 跳过格式错误的行（可能是被截断的行）
    }
  }
  return entries;
}

/**
 * Get active screen sessions matching prefixes
 * 获取匹配指定前缀的活动 screen 会话列表
 * @param {Array<string>} prefixes - screen 会话名称前缀数组，如 ['openspec-', 'direct-']
 * @returns {Array<Object>} 活动的 screen 会话数组，每个对象包含 name 和 status 字段
 */
function getActiveScreenSessions(prefixes) {
  try {
    // 执行 screen -ls 命令获取所有会话
    const output = execSync('screen -ls 2>/dev/null || true', { encoding: 'utf8', timeout: 5000 });
    const sessions = [];
    const lines = output.split('\n');
    // 遍历输出行，匹配指定前缀的会话
    for (const line of lines) {
      for (const prefix of prefixes) {
        // 匹配格式：12345.prefix-name
        const match = line.match(new RegExp(`\\d+\\.(${prefix}\\S+)`));
        if (match) {
          const detached = line.includes('Detached');
          sessions.push({
            name: match[1],
            status: detached ? 'Detached' : 'Attached',
          });
        }
      }
    }
    return sessions;
  } catch (e) {
    return [];
  }
}

/**
 * Parse TASK.md for business task list
 * 从 TASK.md 解析业务任务清单
 *
 * 新格式：
 * ## [活跃] 看板 v4 重构
 * - 来源: 搞钱大王 02-18
 * - 目标: 重构搞钱看板
 *
 * ## [完成] 备婚手册 v4
 * - 来源: 搞钱大王 02-15
 * - 目标: ...
 *
 * @param {string} taskMdPath - TASK.md 文件路径
 * @returns {Object} 业务任务列表
 */
function parseTaskTree(taskMdPath) {
  if (!fs.existsSync(taskMdPath)) return null;

  try {
    const content = fs.readFileSync(taskMdPath, 'utf8');
    const lines = content.split('\n');

    const tasks = [];
    let currentTask = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Match task headers: "## [活跃] 看板 v4 重构" or "## [完成] 备婚手册"
      const taskMatch = trimmed.match(/^##\s+\[(.+?)\]\s+(.+)$/);
      if (taskMatch) {
        if (currentTask) tasks.push(currentTask);
        const statusRaw = taskMatch[1].trim();
        const title = taskMatch[2].replace(/[✅🔄⏳❌]/g, '').trim();
        // Normalize status
        let status = 'active';
        if (statusRaw === '完成' || statusRaw === 'done') status = 'done';
        else if (statusRaw === '阻塞' || statusRaw === 'blocked') status = 'blocked';
        else if (statusRaw === '暂停' || statusRaw === 'paused') status = 'paused';

        // Generate an ID from title
        const id = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-').toLowerCase().slice(0, 30);

        currentTask = { id, title, status, source: '', goal: '', meta: {} };
        continue;
      }

      // Match "### 执行记录" header
      if (trimmed === '### 执行记录' && currentTask) {
        currentTask._inExecSection = true;
        continue;
      }

      // Another ### or ## ends the exec section
      if (trimmed.startsWith('## ') || (trimmed.startsWith('### ') && trimmed !== '### 执行记录')) {
        if (currentTask) currentTask._inExecSection = false;
      }

      // Parse manual execution records: "- [x] 描述 | 工具: xxx | 备注"
      if (currentTask && currentTask._inExecSection && trimmed.match(/^-\s*\[([xX ])\]/)) {
        const execMatch = trimmed.match(/^-\s*\[([xX ])\]\s+(.+)$/);
        if (execMatch) {
          const done = execMatch[1].toLowerCase() === 'x';
          const parts = execMatch[2].split('|').map(s => s.trim());
          const title = parts[0];
          let tool = '';
          let note = '';
          for (const p of parts.slice(1)) {
            if (p.startsWith('工具:') || p.startsWith('工具：')) tool = p.replace(/^工具[:：]\s*/, '');
            else note = p;
          }
          if (!currentTask.manualExecs) currentTask.manualExecs = [];
          currentTask.manualExecs.push({ title, done, tool, note });
        }
        continue;
      }

      // Parse metadata lines: "- 来源: xxx" or "- 目标: xxx"
      if (currentTask && !currentTask._inExecSection && trimmed.startsWith('- ')) {
        const metaMatch = trimmed.match(/^-\s+(.+?)[:：]\s+(.+)$/);
        if (metaMatch) {
          const key = metaMatch[1].trim();
          const val = metaMatch[2].trim();
          if (key === '来源') currentTask.source = val;
          else if (key === '目标') currentTask.goal = val;
          else currentTask.meta[key] = val;
        }
      }
    }
    if (currentTask) tasks.push(currentTask);

    // Clean up temp fields
    for (const t of tasks) { delete t._inExecSection; }

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const active = tasks.filter(t => t.status === 'active').length;

    return { total, completed, active, tasks };
  } catch (e) {
    console.error(`[wali-status] Error parsing TASK.md: ${e.message}`);
    return null;
  }
}

/**
 * Main provider - 主状态提供者模块
 * 用于收集和聚合 Wali 的当前工作状态
 */
const waliStatusProvider = {
  name: 'wali-status',

  /**
   * Collect Wali's current working status
   * 收集 Wali 的当前工作状态
   *
   * 该方法执行以下步骤：
   * 1. 扫描 session 文件获取最近的 AI 活动记录
   * 2. 检查 screen 后台进程状态
   * 3. 判断当前是工作状态还是空闲状态
   * 4. 构建当前任务描述
   * 5. 汇总最近 5 条操作记录
   * 6. 解析今日待办队列
   * 7. 组装并返回最终状态对象
   *
   * @param {Object} config - 收集器配置对象
   * @param {Object} config.paths - 路径配置
   * @param {string} config.paths.sessionsDir - session 文件所在目录
   * @param {Object} config.screenTasks - screen 任务配置
   * @param {Array<string>} config.screenTasks.prefixes - screen 会话前缀数组
   * @returns {Promise<Object>} Wali 状态对象，包含 currentTask、status、executor、queue 等字段
   */
  async collectWaliStatus(config) {
    const sessionsDir = config.paths.sessionsDir;
    const memoryDir = path.join('/root/.openclaw/workspace/memory');
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;

    // ========== 1. 扫描 session 文件获取最近的活动记录 ==========
    // Scan session files for recent activity
    let allRecentMessages = [];   // 存储最近 10 分钟内的所有 AI 消息
    let latestAssistantTs = 0;    // 最新的 AI 助手消息时间戳
    let latestMessage = null;     // 最新的 AI 助手消息对象

    try {
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));

      for (const file of files) {
        const filePath = path.join(sessionsDir, file);

        // Read last 8KB for efficiency (covers ~20 recent messages)
        // 高效读取：只读取文件最后 8KB，约覆盖最近 20 条消息
        const tail = readLastBytes(filePath, 8192);
        const entries = parseJsonlLines(tail);

        for (const entry of entries) {
          if (entry.type === 'message' && entry.message) {
            const msg = entry.message;
            const ts = msg.timestamp || entry.timestamp;
            if (!ts) continue;

            const tsNum = new Date(ts).getTime();

            if (msg.role === 'assistant' && tsNum > latestAssistantTs) {
              latestAssistantTs = tsNum;
              latestMessage = msg;
            }

            if (msg.role === 'assistant' && tsNum > tenMinutesAgo) {
              const action = extractAction(msg);
              if (action) {
                allRecentMessages.push({
                  time: formatTimeUTC8(tsNum),
                  action,
                  executor: inferExecutor(msg.provider, msg.model),
                  ts: tsNum,
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.error(`[wali-status] Error scanning sessions: ${e.message}`);
    }

    // ========== 2. 检查 screen 后台进程 ==========
    // Check screen processes
    const screenPrefixes = (config.screenTasks && config.screenTasks.prefixes) || ['openspec-', 'direct-'];
    const activeScreens = getActiveScreenSessions(screenPrefixes);

    for (const screen of activeScreens) {
      allRecentMessages.push({
        time: formatTimeUTC8(now),
        action: `Claude Code 后台任务: ${screen.name}`,
        executor: 'Claude Code(GLM-5)',
        ts: now,
      });
    }

    // ========== 3. 判断当前工作状态 ==========
    // Determine status - 10 分钟内有 AI 活动或有 screen 后台任务即为工作中
    const hasRecentActivity = latestAssistantTs > tenMinutesAgo;
    const hasActiveScreens = activeScreens.length > 0;
    const isWorking = hasRecentActivity || hasActiveScreens;

    // ========== 4. 构建当前任务描述 ==========
    // Build currentTask - 从 TASK.md 的 # 标题行读取
    let currentTask = '待命中';
    const taskMdFile = path.join('/root/.openclaw/workspace', 'TASK.md');
    if (fs.existsSync(taskMdFile)) {
      try {
        const taskContent = fs.readFileSync(taskMdFile, 'utf8');
        // 读取第一行 # 标题
        const titleMatch = taskContent.match(/^#\s+(?:TASK\.md\s*[-—]\s*)?(.+)/m);
        if (titleMatch) {
          currentTask = titleMatch[1].trim();
        }
      } catch {}
    }
    if (currentTask === '待命中' && isWorking) {
      // fallback: 从最近消息中找
      for (const msg of allRecentMessages) {
        const a = msg.action;
        if (a && !a.includes('HEARTBEAT') && !a.includes('NO_REPLY') && a !== '待命中') {
          currentTask = a;
          break;
        }
      }
    }
    if (hasActiveScreens) {
      const screenInfo = `Claude Code: ${activeScreens.map(s => s.name).join(', ')}`;
      if (currentTask === '待命中') {
        currentTask = screenInfo;
      } else {
        currentTask = `${currentTask} | ${screenInfo}`;
      }
    }

    // ========== 5. 构建最近操作列表（去重 + 取最近 8 条） ==========
    allRecentMessages.sort((a, b) => b.ts - a.ts);
    // 去重：同一分钟内相同 action 前缀的只保留最新一条
    const seen = new Set();
    const deduped = [];
    for (const msg of allRecentMessages) {
      // 用 time + action前20字 作为去重 key
      const key = `${msg.time}|${msg.action.slice(0, 20)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(msg);
      }
    }
    const recentActions = deduped.slice(0, 8).map(({ time, action, executor }) => ({
      time,
      action,
      executor,
    }));

    // ========== 6. Parse TASK.md for task tree (replaces old queue logic) ==========
    const taskMdPath = path.join('/root/.openclaw/workspace', 'TASK.md');
    const tasks = parseTaskTree(taskMdPath);

    // ========== 7. Collect execution history ==========
    const executions = collectOpenspecHistory('/tmp/openspec-bg-logs');

    // ========== 8. 匹配 Task → Execution 关联 ==========
    // 将 execution 关联到业务任务上
    // 匹配规则：task_title 关键词 OR project 名称
    const TASK_PROJECT_MAP = {
      '看板': ['wali-dashboard', 'dashboard'],
      'painradar': ['painradar-backend', 'painradar'],
      '备婚': ['wedding-planner', 'wedding'],
      'openspec': ['openspec-bg', 'openspec'],
      '飞书': ['feishu', 'lark'],
      '搬迁': ['migration', 'export', 'import'],
      '数据管道': ['collector', 'stats-pusher', 'push'],
    };
    if (tasks && tasks.tasks && executions.length > 0) {
      for (const task of tasks.tasks) {
        const taskTitle = task.title.toLowerCase();
        // 提取关键词：按空格分词 + 中文双字切片
        const words = taskTitle
          .replace(/[v\d.]+/g, '')
          .split(/[\s,，、]+/)
          .filter(w => w.length >= 2);
        // 对中文词再拆成 2 字子串（如 "搬迁系统" → ["搬迁", "系统"]）
        const keywords = [];
        for (const w of words) {
          if (/[\u4e00-\u9fff]/.test(w) && w.length > 2) {
            for (let i = 0; i <= w.length - 2; i += 2) {
              keywords.push(w.slice(i, i + 2));
            }
          } else {
            keywords.push(w);
          }
        };

        // 找到 task 关联的 project 名
        const relatedProjects = [];
        for (const [kw, projs] of Object.entries(TASK_PROJECT_MAP)) {
          if (taskTitle.includes(kw)) relatedProjects.push(...projs);
        }

        task.executions = [];
        for (const exec of executions) {
          // 每个 execution 只归属一个任务（先到先得）
          if (exec.matched_task) continue;

          const execTitle = (exec.task_title || '').toLowerCase();
          const execProject = (exec.project || '').toLowerCase();

          // 匹配 1: execution 标题包含任务关键词
          const titleMatch = execTitle && keywords.some(kw => execTitle.includes(kw));
          // 匹配 2: execution 的 project 路径匹配
          const projectMatch = execProject && relatedProjects.some(p => execProject.includes(p));

          if (titleMatch || projectMatch) {
            task.executions.push(exec.id);
            exec.matched_task = task.title;
          }
        }
      }
    }

    // ========== 9. 组装输出对象 ==========
    return {
      currentTask,
      status: isWorking ? 'working' : 'idle',
      startedAt: latestAssistantTs > 0 ? isoUTC8(latestAssistantTs) : isoUTC8(now),
      executor: latestMessage ? inferExecutor(latestMessage.provider, latestMessage.model) : '瓦力(Opus)',
      lastUpdate: isoUTC8(now),
      recentActions,
      tasks,
      executions,
    };
  },
};

module.exports = waliStatusProvider;

/**
 * Extract task title from prompt file content
 * 从 prompt 文件内容中提取任务标题
 * @param {string} content - prompt 文件内容
 * @returns {string} 任务标题
 */
function extractTaskTitleFromPrompt(content) {
  if (!content) return '';
  const lines = content.split('\n');

  // First, try to find a markdown header (# Phase X: Title or # Task Title)
  for (const line of lines) {
    const trimmed = line.trim();
    // Match "# Phase 1: WebSocket 基础设施" or "# Task Title"
    const headerMatch = trimmed.match(/^#\s+(Phase\s+\d+[:：]\s*.+|.+任务.+)/);
    if (headerMatch) {
      return headerMatch[1].trim().slice(0, 100);
    }
  }

  // Second, look for "Task:" or "任务:" line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Task:') || trimmed.startsWith('任务:')) {
      const taskText = trimmed.replace(/^(Task|任务)[:：]\s*/, '').trim();
      // Skip if it's a file reference
      if (!taskText.startsWith('(see /') && taskText.length > 5) {
        return taskText.slice(0, 100);
      }
    }
  }

  // Third, look for first meaningful non-empty line after intro text
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip common intro lines
    if (trimmed === '' ||
        trimmed.startsWith('你是一个') ||
        trimmed.startsWith('请完成以下任务') ||
        trimmed.startsWith('===') ||
        trimmed.startsWith('## ') ||
        trimmed.startsWith('**')) {
      continue;
    }
    // Skip short lines that are likely not task titles
    if (trimmed.length < 10) continue;
    // Found a potential task description
    return trimmed.slice(0, 100);
  }

  return '';
}

/**
 * Read proposal.md content from openspec changes directory
 * 从 openspec changes 目录读取 proposal.md 内容
 * @param {string} changeName - change 名称
 * @returns {string} proposal 内容
 */
// Search paths for openspec changes
const OPENSPEC_SEARCH_PATHS = [
  '/root/.openclaw/workspace/openspec/changes',
  '/home/zhoujun.sandbar/workspace/wali-dashboard/openspec/changes',
];

function readProposalMd(changeName) {
  for (const base of OPENSPEC_SEARCH_PATHS) {
    const proposalPath = path.join(base, changeName, 'proposal.md');
    if (fs.existsSync(proposalPath)) {
      try {
        return fs.readFileSync(proposalPath, 'utf8').slice(0, 800).trim();
      } catch (e) {}
    }
  }
  return null;
}

/**
 * Read tasks.md and extract checkbox list
 * 从 tasks.md 读取并提取 checkbox 列表
 * @param {string} changeName - change 名称
 * @returns {Array<string>} 任务列表
 */
function readTasksMd(changeName) {
  let content = null;
  for (const base of OPENSPEC_SEARCH_PATHS) {
    const tasksPath = path.join(base, changeName, 'tasks.md');
    if (fs.existsSync(tasksPath)) {
      try { content = fs.readFileSync(tasksPath, 'utf8'); break; } catch(e) {}
    }
  }
  if (!content) return [];
  try {
    const lines = content.split('\n');
    const tasks = [];
    for (const line of lines) {
      const match = line.match(/^-\s*\[([xX\s])\]\s*(.+)/);
      if (match) {
        tasks.push({
          title: match[2].trim(),
          done: match[1].toLowerCase() === 'x'
        });
      }
    }
    return tasks;
  } catch (e) {
    return [];
  }
}

/**
 * Collect execution history from openspec-bg logs with unified structure
 * 从 openspec-bg 日志收集执行历史，使用统一的数据结构
 * @param {string} logsDir - 日志目录路径
 * @returns {Array<Object>} 执行历史数组
 */
function collectOpenspecHistory(logsDir) {
  const executions = [];
  if (!fs.existsSync(logsDir)) return executions;

  try {
    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));

    for (const file of files) {
      const fp = path.join(logsDir, file);
      const stat = fs.statSync(fp);
      // Only process logs from last 7 days
      if (Date.now() - stat.mtimeMs > 7 * 24 * 60 * 60 * 1000) continue;

      try {
        const content = fs.readFileSync(fp, 'utf8');

        // Extract session info from header
        const sessionMatch = content.match(/Session:\s*(\S+)/);
        const projectMatch = content.match(/Project:\s*(\S+)/);
        const modelMatch = content.match(/Model:\s*(\S+)/);
        const typeMatch = file.startsWith('openspec-') ? 'openspec' : 'direct';

        // Extract result JSON with full data
        // Match the full result JSON line (entire line containing "type":"result")
        const resultLine = content.split('\n').find(l => l.includes('"type":"result"'));
        let resultJsonMatch = null;
        if (resultLine) {
          try { resultJsonMatch = [resultLine]; JSON.parse(resultLine); } catch(e) { resultJsonMatch = null; }
        }
        const costMatch = content.match(/"total_cost_usd":([\d.]+)/);
        const durationMatch = content.match(/"duration_ms":(\d+)/);
        const turnsMatch = content.match(/"num_turns":(\d+)/);

        // Extract completion status
        const exitMatch = content.match(/exit code:\s*(\d+)/);
        const exitCode = exitMatch ? parseInt(exitMatch[1]) : null;

        // Extract start/end time from header
        const timeMatch = content.match(/Time:\s+(.+)/);
        const startTimeMatch = content.match(/Session:\s*\S+[\s\S]*?Time:\s+(.+)/);

        // Determine status
        let status = 'running';
        if (exitCode === 0) status = 'success';
        else if (exitCode !== null) status = 'failed';
        // If no exit code but log is old and no active screen, mark as failed
        // Note: execution.fail_reason will be set after execution object is created

        // Calculate timestamps
        const finishedAt = new Date(stat.mtimeMs);
        const durationMs = durationMatch ? parseInt(durationMatch[1]) : 0;
        const startedAt = new Date(finishedAt.getTime() - durationMs);

        // Build unified execution record
        const projectPath = projectMatch ? projectMatch[1] : '';
        const projectName = projectPath ? path.basename(projectPath) : '';
        const execution = {
          id: sessionMatch ? sessionMatch[1] : file.replace('.log', ''),
          type: typeMatch,
          model: modelMatch ? modelMatch[1].toUpperCase() : 'Unknown',
          status: status,
          cost: costMatch ? parseFloat(costMatch[1]) : 0,
          duration_ms: durationMs,
          started_at: isoUTC8(startedAt.getTime()),
          finished_at: isoUTC8(finishedAt.getTime()),
          task_title: '',
          project: projectName, // e.g. "wali-dashboard", "painradar-backend"
          tool: typeMatch === 'openspec' ? 'OpenSpec + Claude Code' : 'Claude Code', // 执行工具
          completed: null,
          total: null,
          fail_reason: null,
          proposal: null,
          tasks: []
        };

        // Extract task title: prefer prompt file content, fallback to header
        const promptFile = path.join(logsDir, file.replace('.log', '-prompt.txt'));
        let promptContent = '';
        if (fs.existsSync(promptFile)) {
          try {
            promptContent = fs.readFileSync(promptFile, 'utf8');
            const titleLine = promptContent.split('\n').find(l => l.trim().startsWith('# '));
            if (titleLine) {
              execution.task_title = titleLine.replace(/^#\s*/, '').trim().slice(0, 100);
            } else {
              execution.task_title = extractTaskTitleFromPrompt(promptContent);
            }
          } catch (e) {}
        }
        // Fallback: header Task: line (skip "(see ...)" references)
        if (!execution.task_title) {
          const taskLineMatch = content.match(/Task:\s+(.+?)(?:\n|$)/);
          if (taskLineMatch && !taskLineMatch[1].includes('(see ')) {
            execution.task_title = taskLineMatch[1].trim().slice(0, 100);
          }
        }

        // Read proposal.md and tasks.md from OpenSpec changes directory
        // Only for openspec type — direct type uses prompt/result extraction
        if (typeMatch === 'openspec' && sessionMatch) {
          const changeName = sessionMatch[1].replace(/^openspec-/, '').replace(/-\d+$/, '');
          execution.proposal = readProposalMd(changeName);
          execution.tasks = readTasksMd(changeName);
        }

        // Only OpenSpec executions get proposal/tasks from files
        // Direct executions: no subtasks by design (must use OpenSpec flow)

        // (prompt file already read above for task_title)

        // Extract result info for fail_reason
        if (status === 'failed' && resultJsonMatch) {
          try {
            const resultJson = JSON.parse(resultJsonMatch[0]);
            if (resultJson.is_error) {
              execution.fail_reason = resultJson.result ? resultJson.result.slice(0, 200) : 'Unknown error';
            }
          } catch (e) {}
        }

        // If status is still running but no active screen and log is old, mark as failed
        if (status === 'running') {
          const sessionId = sessionMatch ? sessionMatch[1] : '';
          const hasScreen = getActiveScreenSessions(['openspec-', 'direct-']).some(s => s.name === sessionId);
          if (!hasScreen && Date.now() - stat.mtimeMs > 60000) {
            execution.status = 'failed';
            execution.fail_reason = 'Process disappeared without exit code';
          }
        }

        // Extract task completion info from result
        if (resultJsonMatch) {
          try {
            // Look for completed/total in result text
            const progressMatch = content.match(/(\d+)\/(\d+)\s*(?:tasks?|items?|完成)/i);
            if (progressMatch) {
              execution.completed = parseInt(progressMatch[1]);
              execution.total = parseInt(progressMatch[2]);
            }
          } catch (e) {}
        }

        executions.push(execution);
      } catch (e) {
        console.error(`[wali-status] Error processing ${file}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error(`[wali-status] Error collecting openspec history: ${e.message}\n${e.stack}`);
  }

  // Sort by finished_at descending
  executions.sort((a, b) => (b.finished_at || '').localeCompare(a.finished_at || ''));

  // Deduplicate: for same task_title, keep only the latest one
  // (unless the latest is failed and there's a success for same title)
  const deduped = [];
  const seenTitles = new Map(); // title -> best execution
  for (const exec of executions) {
    const title = exec.task_title || exec.id;
    if (!seenTitles.has(title)) {
      seenTitles.set(title, exec);
      deduped.push(exec);
    } else {
      // If existing is failed and new one is success, replace
      const existing = seenTitles.get(title);
      if (existing.status === 'failed' && exec.status === 'success') {
        const idx = deduped.indexOf(existing);
        if (idx >= 0) deduped[idx] = exec;
        seenTitles.set(title, exec);
      }
    }
  }

  return deduped.slice(0, 20); // Keep last 20
}
