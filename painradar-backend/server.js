// PainRadar Backend Server - Spaceship Edition
// 运行在海外服务器，直接调用外部API，存MySQL，推送Vercel

const http = require('http');
const { execSync } = require('child_process');
const mysql = require('mysql2/promise');

const PORT = 3847;
const DB_CONFIG = {
  host: 'localhost',
  user: 'ztshkzhkyl_radar',
  password: process.env.DB_PASSWORD || 'Pr@dar2026Sec',
  database: 'ztshkzhkyl_painradar',
  charset: 'utf8mb4',
};
const ZHIPU_KEY = process.env.ZHIPU_API_KEY;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_DIR = process.env.VERCEL_PROJECT_DIR;

// ========== Fetch helper (Node 22 built-in fetch) ==========
async function fetchJSON(url, options = {}) {
  const timeout = options.timeout || 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ========== Database ==========
let pool;
async function initDB() {
  pool = mysql.createPool(DB_CONFIG);
  await pool.execute(`CREATE TABLE IF NOT EXISTS opportunities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title_en VARCHAR(255),
    title_zh VARCHAR(255),
    data JSON,
    feasibility CHAR(1) DEFAULT 'B',
    source VARCHAR(50),
    created_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (created_date),
    INDEX idx_feasibility (feasibility)
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS market_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    snapshot_date DATE UNIQUE,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS search_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    report JSON,
    raw_count INT DEFAULT 0,
    score DECIMAL(3,1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_keyword (keyword),
    INDEX idx_created (created_at)
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS raw_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source VARCHAR(20),
    title VARCHAR(500),
    url VARCHAR(1000),
    engagement INT DEFAULT 0,
    biz_score FLOAT DEFAULT 0,
    data JSON,
    fetched_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (fetched_date)
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS analysis_tasks (
    id VARCHAR(36) PRIMARY KEY,
    type VARCHAR(30) NOT NULL,
    input JSON,
    result JSON,
    state ENUM('pending','running','done','error') DEFAULT 'pending',
    error_msg TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_type_state (type, state),
    INDEX idx_created (created_at)
  )`);
  console.log('[DB] Tables initialized');
}

// ========== Async Analysis Task System ==========
const crypto = require('crypto');
const runningTasks = new Map(); // in-memory tracking

async function createTask(type, input) {
  const id = crypto.randomUUID();
  await pool.execute('INSERT INTO analysis_tasks (id, type, input, state) VALUES (?, ?, ?, ?)', [id, type, JSON.stringify(input), 'pending']);
  return id;
}

async function completeTask(id, result) {
  await pool.execute('UPDATE analysis_tasks SET state=?, result=?, completed_at=NOW() WHERE id=?', ['done', JSON.stringify(result), id]);
  runningTasks.delete(id);
}

async function failTask(id, errMsg) {
  await pool.execute('UPDATE analysis_tasks SET state=?, error_msg=?, completed_at=NOW() WHERE id=?', ['error', errMsg, id]);
  runningTasks.delete(id);
}

// Async market analysis
async function runMarketAnalysis(taskId) {
  try {
    await pool.execute('UPDATE analysis_tasks SET state=? WHERE id=?', ['running', taskId]);
    const [taskRows] = await pool.execute('SELECT input FROM analysis_tasks WHERE id=?', [taskId]);
    const input = typeof taskRows[0].input === 'string' ? JSON.parse(taskRows[0].input) : taskRows[0].input;
    
    const si = input.stockIndices || {};
    const crypto = input.crypto || {};
    const fg = input.fearGreed || {};
    const news = input.news || [];
    
    const stockCtx = [];
    if (si.nasdaq) stockCtx.push(`${si.nasdaq.name||'纳斯达克'}: ${si.nasdaq.price} (${si.nasdaq.change>0?'+':''}${si.nasdaq.change}%)`);
    if (si.dji) stockCtx.push(`${si.dji.name||'道琼斯'}: ${si.dji.price} (${si.dji.change>0?'+':''}${si.dji.change}%)`);
    if (si.sse) stockCtx.push(`${si.sse.name||'上证指数'}: ${si.sse.price} (${si.sse.change>0?'+':''}${si.sse.change}%)`);
    if (si.szse) stockCtx.push(`${si.szse.name||'深证成指'}: ${si.szse.price} (${si.szse.change>0?'+':''}${si.szse.change}%)`);
    if (si.hsi) stockCtx.push(`${si.hsi.name||'恒生指数'}: ${si.hsi.price} (${si.hsi.change>0?'+':''}${si.hsi.change}%)`);
    const cryptoCtx = crypto.btc ? `BTC:$${crypto.btc.price}(${crypto.btc.change}%) ETH:$${crypto.eth?.price}(${crypto.eth?.change}%) SOL:$${crypto.sol?.price}(${crypto.sol?.change}%)` : '';
    const fgCtx = fg.value ? `恐惧贪婪指数:${fg.value}(${fg.label})` : '';
    const newsCtx = news.slice(0, 8).map((n, i) => `${i+1}. ${n.title} [${n.source}]`).join('\n');
    
    const today = new Date().toISOString().split('T')[0];
    const prompt = `今天${today}的实时市场数据：
${stockCtx.join(' | ') || '无'}
${cryptoCtx} ${fgCtx}
新闻：${newsCtx || '无'}

用大白话分析，不要金融术语。每个市场说清楚：现在啥情况→为啥→接下来会怎样→建议。要提到具体的公司名和事件名，不要说"一些大公司"这种模糊的话。

输出纯JSON：
{"summary":"一句话总结","us_market":{"trend":"涨/跌/震荡","analysis":"3-4句大白话分析，提到具体公司如苹果英伟达等","prediction":"1-2周预测+原因","confidence":"high/medium/low"},"cn_market":{"trend":"","analysis":"提到具体板块如新能源芯片等","prediction":"","confidence":""},"hk_market":{"trend":"","analysis":"提到具体公司如腾讯阿里等","prediction":"","confidence":""},"crypto_market":{"trend":"","analysis":"解释恐贪指数对普通人的意义","prediction":"","confidence":""},"money_opportunities":"2-3条能直接做的赚钱建议","risk_warnings":["风险1","风险2"]}`;

    console.log(`[task:${taskId}] Running market analysis...`);
    const result = await callLLM(prompt, 16000, 'glm-5'); // GLM-5 needs big max_tokens (thinking eats tokens)
    const parsed = tryParseJSON(result) || { summary: result.substring(0, 500) };
    parsed._analyzedAt = new Date().toISOString();
    parsed._dataSource = { stocks: '新浪财经', crypto: 'CoinGecko', fearGreed: 'Alternative.me', news: 'HackerNews+Reddit' };
    
    await completeTask(taskId, parsed);
    console.log(`[task:${taskId}] Market analysis done`);
  } catch (e) {
    console.error(`[task:${taskId}] Market analysis failed:`, e.message);
    await failTask(taskId, e.message);
  }
}

// Async news analysis
async function runNewsAnalysis(taskId) {
  try {
    await pool.execute('UPDATE analysis_tasks SET state=? WHERE id=?', ['running', taskId]);
    const [taskRows] = await pool.execute('SELECT input FROM analysis_tasks WHERE id=?', [taskId]);
    const input = typeof taskRows[0].input === 'string' ? JSON.parse(taskRows[0].input) : taskRows[0].input;
    const newsItems = input.news || [];
    
    const newsList = newsItems.map((n, i) => `${i+1}. [${n.source}] ${n.title}${n.url ? ' ('+n.url+')' : ''}`).join('\n');
    
    const prompt = `分析这些科技新闻的赚钱机会：
${newsList}

每条新闻用大白话说：在讲什么→为什么跟赚钱有关→程序员能做什么赚钱（要具体可执行）。

输出纯JSON数组：
[{"title":"新闻标题","source":"来源","relevance":"high/medium/low","analysis":"大白话说清楚这条新闻讲什么、为什么重要","money_angle":"具体赚钱思路，能直接去做的","action_items":["第一步做什么","然后做什么"]}]`;
    
    console.log(`[task:${taskId}] Running news analysis (${newsItems.length} items)...`);
    const result = await callLLM(prompt, 16000, 'glm-5');
    let parsed = tryParseJSON(result);
    if (!Array.isArray(parsed)) parsed = parsed?.items || [{ analysis: result.substring(0, 500) }];
    
    const output = { analyses: parsed, _analyzedAt: new Date().toISOString(), _newsCount: newsItems.length };
    await completeTask(taskId, output);
    console.log(`[task:${taskId}] News analysis done`);
  } catch (e) {
    console.error(`[task:${taskId}] News analysis failed:`, e.message);
    await failTask(taskId, e.message);
  }
}

// ========== Data Scrapers ==========
const NEWS_JUNK = /\b(died|death|obituary|wins?\s|champion|election|president|war\s|arrest|scandal|lawsuit|court\s|judge|patent|acqui|IPO|funding|raised|nfl|nba|super bowl|oscars|grammy|holiday)\b/i;
const PAIN_SIGNALS = {
  WILLING_PAY: /\b(pay for|worth paying|shut up and take|would buy|will pay|pricing|subscription|pro plan|premium|upgrade|budget|invest in)\b/i,
  STRONG_PAIN: /\b(frustrat|hate|terrible|broken|awful|annoy|painful|suck|worst|horrible|unusable|nightmare|waste of time|give up|fed up|sick of|tired of)\b/i,
  NEED_ALT: /\b(alternative|looking for|replace|switch from|better than|instead of|need a|wish there|why isn.t there|someone should build)\b/i,
  BIZ_SIGNAL: /\b(saas|pricing|revenue|startup|monetiz|payment|subscript|customer|churn|convert|profit|market|launch|freelanc|agency|client|billing|invoice|workflow|automat)\b/i,
  SIMPLE_FIX: /\b(simple|easy|just need|basic|lightweight|minimal|tiny|small tool|quick|script|chrome extension|cli tool|bot|plugin|widget|template)\b/i,
};

function calcScore(item) {
  const text = `${item.title || ''} ${item.body || ''}`.toLowerCase();
  let base = item._source === 'hn' ? Math.min(item.points || 0, 200) + (item.num_comments || 0) * 2
    : item._source === 'google_trends' ? Math.min((item.points || 0) / 5, 300)
    : (item.reactions || 0) + (item.comments_count || 0) * 3;
  base = Math.max(base, 5);
  
  let pain = 1.0;
  const flags = [];
  if (PAIN_SIGNALS.WILLING_PAY.test(text)) { pain *= 3.0; flags.push('willing-to-pay'); }
  if (PAIN_SIGNALS.STRONG_PAIN.test(text)) { pain *= 2.5; flags.push('strong-pain'); }
  if (PAIN_SIGNALS.NEED_ALT.test(text)) { pain *= 2.0; flags.push('need-alt'); }
  if (PAIN_SIGNALS.BIZ_SIGNAL.test(text)) { pain *= 1.5; flags.push('biz-signal'); }
  if (PAIN_SIGNALS.SIMPLE_FIX.test(text)) { pain *= 1.8; flags.push('simple-fix'); }
  if (NEWS_JUNK.test(text)) { pain *= 0.05; flags.push('news-junk'); }
  
  return { score: Math.round(base * pain * 100) / 100, base, pain, flags };
}

async function fetchHN(tag, limit) {
  try {
    const data = await fetchJSON(`https://hn.algolia.com/api/v1/search?tags=${tag}&hitsPerPage=${limit}`, { timeout: 12000 });
    return (data.hits || []).map(h => ({
      id: h.objectID, title: h.title, url: h.url,
      points: h.points || 0, num_comments: h.num_comments || 0,
      created_at: h.created_at, _source: 'hn',
    }));
  } catch { return []; }
}

async function fetchHNQuery(query, limit) {
  try {
    const data = await fetchJSON(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`, { timeout: 12000 });
    return (data.hits || []).map(h => ({
      id: h.objectID, title: h.title, url: h.url,
      points: h.points || 0, num_comments: h.num_comments || 0,
      created_at: h.created_at, _source: 'hn',
    }));
  } catch { return []; }
}

// Fetch HN comments for a single item using Algolia HN API
async function fetchHNComments(itemId, maxComments = 5) {
  try {
    const data = await fetchJSON(`https://hn.algolia.com/api/v1/items/${itemId}`, { timeout: 10000 });
    const allComments = data.children || [];

    // Sort by points descending, take top N
    const topComments = allComments
      .filter(c => c.text)
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, maxComments);

    return topComments.map(c => ({
      text: (c.text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200),
      author: c.author || 'unknown',
      points: c.points || 0,
    }));
  } catch (e) {
    console.error(`[fetchHNComments] Error fetching comments for item ${itemId}:`, e.message);
    return [];
  }
}

// Fetch comments for multiple HN items with rate limiting (serial + 200ms delay)
async function fetchHNCommentsBatch(items, maxPerItem = 5) {
  const comments = {};
  for (const item of items) {
    if (!item.id) continue;
    try {
      const itemComments = await fetchHNComments(item.id, maxPerItem);
      comments[item.id] = itemComments;
      console.log(`[HN Comments] Fetched ${itemComments.length} comments for item ${item.id}`);
      // Rate limiting: 200ms delay between requests
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`[HN Comments] Failed for ${item.id}:`, e.message);
    }
  }
  return comments;
}

async function fetchGH(query, limit) {
  try {
    const data = await fetchJSON(
      `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=reactions&per_page=${limit}`,
      { timeout: 12000, headers: { 'User-Agent': 'PainRadar', 'Accept': 'application/vnd.github.v3+json' } }
    );
    return (data.items || []).map(i => ({
      id: i.id, title: i.title, url: i.html_url,
      body: (i.body || '').substring(0, 500),
      reactions: i.reactions?.total_count || 0,
      comments_count: i.comments || 0,
      created_at: i.created_at, _source: 'github',
    }));
  } catch { return []; }
}

// ========== New Data Source Fetchers ==========

// Fetch Ask HN posts - strong pain signal source
async function fetchAskHN(limit = 30) {
  try {
    const data = await fetchJSON(
      `https://hn.algolia.com/api/v1/search?query=Ask%20HN&tags=ask_hn&hitsPerPage=${limit}`,
      { timeout: 12000 }
    );
    return (data.hits || []).map(h => ({
      id: h.objectID,
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points || 0,
      num_comments: h.num_comments || 0,
      created_at: h.created_at,
      _source: 'ask_hn',
    }));
  } catch (e) {
    console.error('[fetchAskHN] Error:', e.message);
    return [];
  }
}

// Fetch Stack Overflow high-vote questions
async function fetchStackOverflow(pagesize = 30) {
  try {
    // Fetch recent hot questions across popular dev tags
    const tags = ['python', 'javascript', 'api', 'automation', 'web-scraping', 'docker', 'aws', 'stripe'];
    const allItems = [];
    for (const tag of tags.slice(0, 3)) { // limit to 3 calls to avoid rate limit
      try {
        const data = await fetchJSON(
          `https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&site=stackoverflow&tagged=${tag}&pagesize=10&filter=!nNPvSNP4(R`,
          { timeout: 10000 }
        );
        for (const i of (data.items || [])) {
          allItems.push({
            id: i.question_id,
            title: i.title,
            url: i.link,
            score: i.score || 0,
            view_count: i.view_count || 0,
            tags: i.tags || [],
            answer_count: i.answer_count || 0,
            creation_date: i.creation_date ? new Date(i.creation_date * 1000).toISOString() : null,
            _source: 'stackoverflow',
          });
        }
      } catch {}
    }
    console.log(`[fetchStackOverflow] ${allItems.length} questions`);
    return allItems;
  } catch (e) {
    console.error('[fetchStackOverflow] Error:', e.message);
    return [];
  }
}

// Fetch GitHub issues - feature requests with reactions
async function fetchGitHubIssues(limit = 30) {
  try {
    const results = [];

    // Query 1: enhancement label with reactions > 5
    try {
      const data1 = await fetchJSON(
        `https://api.github.com/search/issues?q=label:enhancement+state:open+reactions:>5&sort=reactions&per_page=${limit}`,
        { timeout: 12000, headers: { 'User-Agent': 'PainRadar', 'Accept': 'application/vnd.github.v3+json' } }
      );
      (data1.items || []).forEach(i => {
        results.push({
          id: i.id,
          title: i.title,
          url: i.html_url,
          body: (i.body || '').substring(0, 500),
          reactions: i.reactions?.total_count || 0,
          comments_count: i.comments || 0,
          repository_url: i.repository_url,
          created_at: i.created_at,
          _source: 'github_issues',
        });
      });
    } catch (e) {
      console.error('[fetchGitHubIssues] Query 1 error:', e.message);
    }

    // Query 2: feature-request label with reactions > 3
    try {
      const data2 = await fetchJSON(
        `https://api.github.com/search/issues?q=label:feature-request+state:open+reactions:>3&sort=reactions&per_page=${limit}`,
        { timeout: 12000, headers: { 'User-Agent': 'PainRadar', 'Accept': 'application/vnd.github.v3+json' } }
      );
      (data2.items || []).forEach(i => {
        // Avoid duplicates
        if (!results.find(r => r.id === i.id)) {
          results.push({
            id: i.id,
            title: i.title,
            url: i.html_url,
            body: (i.body || '').substring(0, 500),
            reactions: i.reactions?.total_count || 0,
            comments_count: i.comments || 0,
            repository_url: i.repository_url,
            created_at: i.created_at,
            _source: 'github_issues',
          });
        }
      });
    } catch (e) {
      console.error('[fetchGitHubIssues] Query 2 error:', e.message);
    }

    // Sort by reactions
    results.sort((a, b) => b.reactions - a.reactions);
    return results.slice(0, limit * 2);
  } catch (e) {
    console.error('[fetchGitHubIssues] Error:', e.message);
    return [];
  }
}

// Fetch GitHub issue comments for a single issue
// issueUrl format: https://api.github.com/repos/{owner}/{repo}/issues/{number}
async function fetchGitHubIssueComments(issueUrl, maxComments = 5) {
  try {
    // Convert HTML URL to API URL if needed
    // e.g., https://github.com/owner/repo/issues/123 -> https://api.github.com/repos/owner/repo/issues/123/comments
    let commentsUrl;
    if (issueUrl.includes('api.github.com')) {
      commentsUrl = issueUrl.replace('/issues/', '/issues/').replace(/\/\d+$/, '') + '/comments';
    } else {
      // Parse HTML URL: https://github.com/owner/repo/issues/123
      const match = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      if (!match) return [];
      const [, owner, repo, issueNum] = match;
      commentsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNum}/comments?per_page=${maxComments}`;
    }

    const data = await fetchJSON(commentsUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'PainRadar', 'Accept': 'application/vnd.github.v3+json' }
    });

    if (!Array.isArray(data)) return [];

    return data.slice(0, maxComments).map(c => ({
      text: (c.body || '').replace(/\r?\n/g, ' ').trim().substring(0, 200),
      author: c.user?.login || 'unknown',
      created_at: c.created_at,
    }));
  } catch (e) {
    console.error(`[fetchGitHubIssueComments] Error for ${issueUrl}:`, e.message);
    return [];
  }
}

// Fetch comments for top GitHub issues (by biz_score)
async function fetchGitHubCommentsBatch(items, maxItems = 10, maxPerItem = 5) {
  // Only fetch comments for top items by biz_score
  const topItems = items
    .filter(i => i._source === 'github_issues' && i.url)
    .slice(0, maxItems);

  const comments = {};
  for (const item of topItems) {
    try {
      const itemComments = await fetchGitHubIssueComments(item.url, maxPerItem);
      comments[item.id] = itemComments;
      console.log(`[GH Comments] Fetched ${itemComments.length} comments for issue ${item.id}`);
      // Small delay to avoid rate limit
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(`[GH Comments] Failed for ${item.id}:`, e.message);
    }
  }
  return comments;
}

// Fetch Reddit pain points via RSS (JSON API blocked by Cloudflare 403)
function stripHtmlRss(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeXmlEnt(str) {
  if (!str) return '';
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, c) => String.fromCharCode(parseInt(c))).replace(/&#x([0-9a-fA-F]+);/g, (m, c) => String.fromCharCode(parseInt(c, 16)));
}

function parseRssEntries(xml, subreddit) {
  const items = [];
  const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[0];
    const titleM = entry.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleM ? decodeXmlEnt(titleM[1]) : '';
    const linkM = entry.match(/<link[^>]*href="([^"]*)"[^>]*>/i);
    const url = linkM ? linkM[1] : '';
    const authorM = entry.match(/<author[\s\S]*?<name>([^<]*)<\/name>/i);
    const author = authorM ? decodeXmlEnt(authorM[1]) : 'unknown';
    const contentM = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
    const body = stripHtmlRss(contentM ? contentM[1] : '').substring(0, 500);
    const idM = entry.match(/<id>([^<]*)<\/id>/i);
    const id = idM ? idM[1].replace('t3_', '') : `rss-${Date.now()}`;
    const pubM = entry.match(/<published>([^<]*)<\/published>/i) || entry.match(/<updated>([^<]*)<\/updated>/i);
    const created_at = pubM ? pubM[1] : new Date().toISOString();
    if (title && url) {
      items.push({ id, title, url, body, score: 0, num_comments: 0, subreddit, created_at, _source: 'reddit', _rss_mode: true });
    }
  }
  return items;
}

async function fetchRedditPainPoints(limit = 50) {
  const subs = ['SaaS', 'startups', 'Entrepreneur', 'smallbusiness', 'sideproject'];
  const allItems = [];
  for (const sub of subs) {
    try {
      const url = `https://www.reddit.com/r/${sub}/.rss?limit=25`;
      const cmd = `curl -sL --max-time 15 -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0' '${url}'`;
      const xml = execSync(cmd, { timeout: 20000, encoding: 'utf-8' });
      const items = parseRssEntries(xml, sub);
      allItems.push(...items);
      console.log(`[Reddit RSS] r/${sub}: ${items.length} posts`);
    } catch (e) {
      console.log(`[Reddit RSS] r/${sub} failed: ${e.message}`);
    }
  }
  console.log(`[Reddit RSS] Total: ${allItems.length} posts from ${subs.length} subs`);
  return allItems;
}

// New pain signal keywords for pre-filtering
const PAIN_SIGNAL_KEYWORDS = [
  /i'd pay|shut up and take my money|willing to pay|take my money/i,
  /frustrated with|hate using|wish there was|tired of/i,
  /switching from|alternative to|better than|looking for/i,
  /how do you handle|what do you use for|anyone built|is there a/i,
  /pain point|struggle with|annoying|waste of time/i,
];

// Match pain signals and tag items
function matchPainSignals(item) {
  const text = `${item.title || ''} ${item.body || ''}`;
  const matchedKeywords = [];

  for (const pattern of PAIN_SIGNAL_KEYWORDS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) {
        matchedKeywords.push(match[0]);
      }
    }
  }

  item._painSignals = matchedKeywords;
  return matchedKeywords.length > 0;
}

async function fetchAllData() {
  const results = await Promise.allSettled([
    // Original sources
    fetchHN('ask_hn', 30),
    fetchHN('show_hn', 30),
    fetchHNQuery('frustrated OR "looking for" OR alternative OR "need a"', 25),
    fetchHNQuery('pricing OR "pay for" OR subscription OR "worth paying"', 20),
    fetchHNQuery('simple tool OR chrome extension OR cli OR "side project"', 20),
    fetchGH('frustrated OR broken OR unusable type:issue sort:reactions', 20),
    fetchGH('feature request OR enhancement type:issue sort:reactions', 20),
    fetchGH('"looking for alternative" OR "switch from" type:issue sort:reactions', 15),
    // New data sources
    fetchAskHN(30),
    fetchStackOverflow(30),
    fetchGitHubIssues(30),
    fetchRedditPainPoints(50),
  ]);

  const items = [];
  const seen = new Set();
  results.forEach(r => {
    if (r.status !== 'fulfilled') return;
    r.value.forEach(item => {
      const key = item.id || item.title;
      if (seen.has(key)) return;
      seen.add(key);
      // Apply pain signal matching
      matchPainSignals(item);
      items.push(item);
    });
  });

  items.forEach(i => { i._score = calcScore(i); });
  // Sort: items with pain signals first, then by score
  items.sort((a, b) => {
    const aPain = a._painSignals?.length || 0;
    const bPain = b._painSignals?.length || 0;
    if (aPain !== bPain) return bPain - aPain;
    return b._score.score - a._score.score;
  });

  // ========== Fetch comments for top items ==========
  console.log('[fetchAllData] Fetching comments for top items...');

  // Get top HN items for comment fetching
  const hnItems = items.filter(i => (i._source === 'hn' || i._source === 'ask_hn')).slice(0, 15);
  if (hnItems.length > 0) {
    try {
      const hnComments = await fetchHNCommentsBatch(hnItems, 5);
      // Attach comments to items
      for (const item of hnItems) {
        if (hnComments[item.id]) {
          item.comments = hnComments[item.id];
        }
      }
    } catch (e) {
      console.error('[fetchAllData] HN comment fetch failed:', e.message);
    }
  }

  // Get top GitHub Issues for comment fetching
  const ghItems = items.filter(i => i._source === 'github_issues').slice(0, 10);
  if (ghItems.length > 0) {
    try {
      const ghComments = await fetchGitHubCommentsBatch(ghItems, 10, 5);
      // Attach comments to items
      for (const item of ghItems) {
        if (ghComments[item.id]) {
          item.comments = ghComments[item.id];
        }
      }
    } catch (e) {
      console.error('[fetchAllData] GH comment fetch failed:', e.message);
    }
  }

  const totalComments = items.reduce((sum, i) => sum + (i.comments?.length || 0), 0);
  console.log(`[fetchAllData] Total comments fetched: ${totalComments}`);

  return items;
}

// ========== Market Data (Real Sources) ==========

// Yahoo Finance v8 - 美股/港股指数 (with User-Agent to avoid 429)
async function fetchYahooQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, { 
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainRadar/1.0)' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const prev = meta.chartPreviousClose || meta.previousClose;
    const cur = meta.regularMarketPrice;
    if (!cur) return null;
    const change = prev ? Math.round((cur - prev) / prev * 10000) / 100 : 0;
    return { price: cur, change, currency: meta.currency, source: 'Yahoo Finance', sourceType: 'real' };
  } catch { return null; }
}

// 新浪财经 - A股/港股/美股指数 (GBK encoded)
async function fetchSinaStock(symbol) {
  try {
    const res = await fetch(`https://hq.sinajs.cn/list=${symbol}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn' },
      signal: AbortSignal.timeout(8000),
    });
    // Handle GBK encoding
    let text;
    try {
      const buf = Buffer.from(await res.arrayBuffer());
      text = new TextDecoder('gbk').decode(buf);
    } catch {
      text = await res.text(); // fallback to UTF-8
    }
    const match = text.match(/"(.+)"/);
    if (!match) return null;
    const parts = match[1].split(',');
    // s_sh000001/int_* 简版格式: 名称,最新,涨跌额,涨跌幅,...
    const name = parts[0], cur = parseFloat(parts[1]), changePct = parseFloat(parts[3]);
    if (!cur || isNaN(cur)) return null;
    return { price: cur, change: changePct, name, source: '新浪财经', sourceType: 'real' };
  } catch (e) { console.error(`[sina] ${symbol} error:`, e.message); return null; }
}

// HackerNews top stories for tech news
async function fetchHNTopNews(limit = 5) {
  try {
    const data = await fetchJSON('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=' + limit, { timeout: 10000 });
    return (data?.hits || []).map(h => ({
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points,
      source: 'HackerNews',
      sourceType: 'real'
    }));
  } catch { return []; }
}

// Reddit trending in tech/startup subs (via RSS)
async function fetchRedditTrending(sub = 'technology', limit = 5) {
  try {
    const url = `https://www.reddit.com/r/${sub}/.rss?limit=${limit}`;
    const cmd = `curl -sL --max-time 15 -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0' '${url}'`;
    const xml = execSync(cmd, { timeout: 20000, encoding: 'utf-8' });
    return parseRssEntries(xml, sub).map(item => ({
      title: item.title,
      url: item.url,
      score: 0,
      source: `Reddit r/${sub}`,
      sourceType: 'real'
    }));
  } catch { return []; }
}

async function fetchMarketData() {
  const [crypto, fg, ndx, dji, sse, szse, hsi, hnNews, reddit, redditStartup] = await Promise.allSettled([
    fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true', { timeout: 10000 }),
    fetchJSON('https://api.alternative.me/fng/?limit=1', { timeout: 8000 }),
    fetchSinaStock('int_nasdaq'),   // 纳斯达克 (新浪国际指数)
    fetchSinaStock('int_dji'),      // 道琼斯
    fetchSinaStock('s_sh000001'),   // 上证指数
    fetchSinaStock('s_sz399001'),   // 深证成指
    fetchSinaStock('int_hangseng'), // 恒生指数
    fetchHNTopNews(5),
    fetchRedditTrending('technology', 3),
    fetchRedditTrending('SaaS', 3),
  ]);
  
  // Crypto
  let cryptoData = null;
  if (crypto.status === 'fulfilled' && typeof crypto.value === 'object') {
    const d = crypto.value;
    const fmt = (id) => { const c = d[id]; return c ? { price: c.usd, change: Math.round((c.usd_24h_change || 0) * 100) / 100, source: 'CoinGecko', sourceType: 'real' } : null; };
    cryptoData = { btc: fmt('bitcoin'), eth: fmt('ethereum'), sol: fmt('solana') };
  }
  
  // Fear & Greed
  let fearGreed = null;
  if (fg.status === 'fulfilled' && fg.value?.data?.[0]) {
    const item = fg.value.data[0];
    fearGreed = { value: parseInt(item.value), label: item.value_classification, source: 'Alternative.me', sourceType: 'real' };
  }
  
  // Stock indices (from Sina)
  const stocks = {};
  if (ndx.status === 'fulfilled' && ndx.value) stocks.nasdaq = ndx.value;
  if (dji.status === 'fulfilled' && dji.value) stocks.dji = dji.value;
  if (sse.status === 'fulfilled' && sse.value) stocks.sse = sse.value;
  if (szse.status === 'fulfilled' && szse.value) stocks.szse = szse.value;
  if (hsi.status === 'fulfilled' && hsi.value) stocks.hsi = hsi.value;
  
  // News
  const news = [
    ...(hnNews.status === 'fulfilled' ? hnNews.value : []),
    ...(reddit.status === 'fulfilled' ? reddit.value : []),
    ...(redditStartup.status === 'fulfilled' ? redditStartup.value : []),
  ];
  
  return { crypto: cryptoData, fearGreed, stockIndices: stocks, news };
}

// ========== LLM Analysis (Streaming, Event-Driven) ==========
async function callLLM(prompt, maxTokens = 4000, model = 'glm-5') {
  if (!ZHIPU_KEY) throw new Error('No ZHIPU_API_KEY');
  
  // Use streaming to avoid timeout issues with long generations
  const res = await fetch('https://open.bigmodel.cn/api/coding/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_KEY}` },
    body: JSON.stringify({
      model, messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens, temperature: 0.4,
      stream: true,
    }),
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API ${res.status}: ${errText.substring(0, 200)}`);
  }
  
  // Read SSE stream event by event
  let content = '';
  let reasoning = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    // Process complete SSE lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.substring(6).trim();
      if (data === '[DONE]') continue;
      
      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) content += delta.content;
        if (delta?.reasoning_content) reasoning += delta.reasoning_content;
      } catch {}
    }
  }
  
  console.log(`[LLM] ${model}: content=${content.length}c, reasoning=${reasoning.length}c`);
  
  // GLM-5 thinking model: content has the final answer, reasoning has the thought process
  // If content is empty, try to extract JSON from reasoning
  if (content.trim()) return content;
  
  // Fallback: extract JSON from reasoning
  if (reasoning) {
    // Try to find JSON object or array in reasoning
    const jsonMatch = reasoning.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      console.log(`[LLM] Extracted JSON from reasoning (${jsonMatch[0].length}c)`);
      return jsonMatch[0];
    }
  }
  return reasoning;
}

function tryParseJSON(text) {
  if (!text) return null;
  
  // Helper: fix common JSON issues from LLMs
  function fixJSON(s) {
    // Fix single quotes used as string delimiters: "key": 'value' → "key": "value"
    // Match pattern: ": '" at field value position, replace with ": "
    s = s.replace(/:\s*'([^']*?)'/g, (m, val) => ': "' + val.replace(/"/g, '\\"') + '"');
    return s;
  }
  
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(fixJSON(text)); } catch {}
  
  const m1 = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (m1) {
    try { return JSON.parse(m1[1]); } catch {}
    try { return JSON.parse(fixJSON(m1[1])); } catch {}
  }
  
  const m2 = text.match(/\[[\s\S]*\]/);
  if (m2) {
    try { return JSON.parse(m2[0]); } catch {}
    try { return JSON.parse(fixJSON(m2[0])); } catch {}
  }
  
  // 截断修复 (with quote fix)
  if (m2) {
    const fixed = fixJSON(m2[0]);
    const boundaries = [];
    const re = /\}\s*,\s*\{/g;
    let bm;
    while ((bm = re.exec(fixed)) !== null) boundaries.push(bm.index);
    for (let i = boundaries.length - 1; i >= 0; i--) {
      try { return JSON.parse(fixed.substring(0, boundaries[i] + 1) + ']'); } catch {}
    }
  }
  return null;
}

// ========== Status & Analysis ==========
let status = { state: 'idle', progress: 0, message: '' };

async function runFullAnalysis() {
  if (status.state === 'running') return;
  status = { state: 'running', progress: 5, message: '📡 抓取社区数据...' };
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // 1. Fetch raw data
    const items = await fetchAllData();
    console.log(`[fetch] ${items.length} items`);
    status.progress = 25;
    status.message = `🧠 AI分析 ${items.length} 条数据...`;
    
    // 2. Save raw data to DB (with full content and pain signals)
    const conn = await pool.getConnection();
    try {
      for (const item of items.filter(i => !NEWS_JUNK.test(i.title)).slice(0, 100)) {
        // Build comprehensive data object
        const fullData = {
          // Original content
          original: {
            title: item.title,
            url: item.url,
            body: item.body || null,
            points: item.points || null,
            num_comments: item.num_comments || null,
            reactions: item.reactions || null,
            score: item.score || null,
            view_count: item.view_count || null,
            tags: item.tags || null,
            subreddit: item.subreddit || null,
            repository_url: item.repository_url || null,
            created_at: item.created_at || null,
          },
          // Comments (fetched from HN/GitHub)
          comments: item.comments || [],
          // Pain signal analysis results
          painAnalysis: {
            matchedKeywords: item._painSignals || [],
            hasPainSignals: (item._painSignals || []).length > 0,
            score: item._score?.score || 0,
            baseScore: item._score?.base || 0,
            painMultiplier: item._score?.pain || 1,
            flags: item._score?.flags || [],
          },
          // Source metadata
          source: item._source,
          fetchedAt: new Date().toISOString(),
        };

        await conn.execute(
          'INSERT IGNORE INTO raw_data (source, title, url, engagement, biz_score, data, fetched_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            item._source || 'unknown',
            item.title || '',
            item.url || '',
            item.points || item.reactions || item.score || 0,
            item._score?.score || 0,
            JSON.stringify(fullData),
            today
          ]
        );
      }
    } finally { conn.release(); }
    
    // 3. LLM Analysis - prioritize items with pain signals
    const top = items.filter(i => !NEWS_JUNK.test(i.title)).slice(0, 25);
    const itemList = top.map((item, i) => {
      const srcMap = {
        'hn': 'HN', 'github': 'GH', 'ask_hn': 'AskHN',
        'stackoverflow': 'SO', 'github_issues': 'GHIssues', 'reddit': 'Reddit'
      };
      const src = srcMap[item._source] || item._source;
      let eng = '';
      if (item._source === 'hn' || item._source === 'ask_hn') {
        eng = `${item.points || 0}赞/${item.num_comments || 0}评`;
      } else if (item._source === 'stackoverflow') {
        eng = `${item.score || 0}票/${item.view_count || 0}浏览`;
      } else if (item._source === 'reddit') {
        eng = `${item.score || 0}赞/${item.num_comments || 0}评`;
      } else {
        eng = `${item.reactions || 0}反应/${item.comments_count || 0}评`;
      }
      const flags = (item._score?.flags || []).join(',');
      const painSignals = (item._painSignals || []).slice(0, 2).join('; ');

      // Build comment summary (up to 3 most valuable comments)
      let commentSummary = '';
      if (item.comments && item.comments.length > 0) {
        // Select comments containing pain signal keywords
        const painKeywords = ['pay', 'frustrated', 'hate', 'alternative', 'looking for', 'need', 'wish', 'expensive', 'suck', 'broken', 'annoying'];
        const scoredComments = item.comments.map(c => {
          const text = (c.text || '').toLowerCase();
          let score = c.points || 1;
          for (const kw of painKeywords) {
            if (text.includes(kw)) score += 10;
          }
          return { ...c, _score: score };
        }).sort((a, b) => b._score - a._score);

        const topComments = scoredComments.slice(0, 3);
        if (topComments.length > 0) {
          const quotes = topComments.map(c => `"${c.text.substring(0, 80)}${c.text.length > 80 ? '...' : ''}"`);
          commentSummary = `\n   💬 评论摘要: ${quotes.join(' | ')}`;
        }
      }

      return `${i+1}. [${src}] ${item.title} | ${eng} | ${flags}${painSignals ? ' | 💢' + painSignals : ''}${commentSummary}`;
    }).join('\n');

    const prompt = `你是帮程序员找副业项目的商机分析师。从以下社区讨论中找出10个"一个人就能做、能收费、用户真的会付钱"的产品机会。

关键原则：
- 只推荐一个程序员1-4周能做出MVP的项目
- 必须有明确的付费用户群（谁会付钱？为什么？）
- 要说清楚"现在用的方案有什么问题"→"我们做什么"→"怎么收钱"
- 不要推荐需要打败大公司的项目（比如做搜索引擎、做浏览器）
- Chrome插件、Telegram/Discord Bot、API服务、小工具网站、CLI工具这些都是好方向

**重要：区分需求类型**
- 仔细分析每条讨论，判断用户是真的在找解决方案（direct_demand），还是只是在讨论技术问题（inferred）
- 优先选择那些明确表达"我在找X"、"有没有替代品"、"愿意付费"的帖子
- 如果只是技术讨论或分享经验，标注为 inferred，这类商机排在后面

社区数据：
${itemList}

输出JSON数组，每个商机用大白话说清楚：
[{
  "en": {"title":"产品名（英文，简短）","description":"一句话说清楚做什么","originalProblem":"用户现在遇到什么问题（具体，引用社区讨论）","whyNow":"为什么现在做这个时机好","monetization":"怎么收钱（具体定价，如月费$9/年费$49）","targetUser":"谁会买单（越具体越好）","devCost":"一个人多久能做出来","competition":"主要竞品是谁，我们凭什么能赢","evidence":"社区里的真实证据"},
  "zh": {"title":"中文名","description":"","originalProblem":"","whyNow":"","monetization":"","targetUser":"","devCost":"","competition":"","evidence":""},
  "tags":{"platform":["Web"],"audience":["Developers"],"payWillingness":"High","category":"SaaS Tool"},
  "feasibility":"A/B/C",
  "heatLevel":"🔥🔥🔥",
  "sources":["HackerNews"],
  "attention":"High/Medium/Low",
  "evidenceStrength":"Strong/Medium/Weak",
  "evidence_type":"direct_demand",
  "suggestedKeyword":"搜索关键词"
}]

**evidence_type 说明（必须填写）：**
- direct_demand：用户直接说"我在找X"、"有没有替代"、"愿意付费"等明确需求信号
- inferred：从讨论中推测出来的需求，用户没有直接表达

**排序规则：** direct_demand 的商机必须排在数组前面，inferred 的排在后面。

A=一个人1-4周能做出收费版本
B=需要1-3个月或需要特定领域知识
C=不切实际（直接排除，不要输出C级的）

注意：不要输出C级项目。只给真正能下手的A和B。evidence用纯文本不要引号。只输出JSON。`;

    console.log(`[analyze] Calling LLM...`);
    const llmResult = await callLLM(prompt, 16000);
    console.log(`[analyze] Response: ${llmResult.length} chars`);
    // Debug: save raw response
    try { require('fs').writeFileSync('/tmp/painradar-debug-llm.txt', llmResult); } catch {}
    
    let opportunities = tryParseJSON(llmResult);
    if (!opportunities) { 
      console.error('[analyze] JSON parse failed, first 300:', llmResult.substring(0, 300));
      console.error('[analyze] JSON parse failed, last 200:', llmResult.substring(llmResult.length - 200));
      opportunities = []; 
    }
    if (!Array.isArray(opportunities)) opportunities = opportunities.items || [];
    console.log(`[analyze] Parsed ${opportunities.length} opportunities`);
    
    status.progress = 60;
    status.message = '📊 获取市场数据...';
    
    // 4. Save opportunities to DB
    const conn2 = await pool.getConnection();
    try {
      for (const opp of opportunities) {
        await conn2.execute(
          'INSERT INTO opportunities (title_en, title_zh, data, feasibility, source, created_date) VALUES (?, ?, ?, ?, ?, ?)',
          [opp.en?.title || null, opp.zh?.title || null, JSON.stringify(opp), opp.feasibility || 'B', (opp.sources || [])[0] || 'HN', today]
        );
      }
    } finally { conn2.release(); }
    
    // 5. Market data - FETCH FIRST, NO LLM (prevent OOM on shared hosting)
    let market = { crypto: null, fearGreed: null, stockIndices: {}, news: [] };
    try {
      market = await fetchMarketData();
      console.log(`[market] Fetched: ${Object.keys(market.stockIndices || {}).length} indices, ${(market.news || []).length} news, crypto=${!!market.crypto}`);
    } catch (e) { console.error('[market] fetchMarketData crashed:', e.message); }
    
    // Build market overview from REAL data only (no LLM call = no OOM risk)
    const si = market.stockIndices || {};
    const fmtIdx = (idx) => idx ? `${idx.name || ''} ${idx.price} (${idx.change>0?'+':''}${idx.change}%)` : '';
    
    const marketOverview = {
      stocks: {
        us: (si.nasdaq || si.dji) ? `${si.nasdaq ? fmtIdx(si.nasdaq) : ''}${si.dji ? ' | ' + fmtIdx(si.dji) : ''}` : null,
        cn: (si.sse || si.szse) ? `${si.sse ? fmtIdx(si.sse) : ''}${si.szse ? ' | ' + fmtIdx(si.szse) : ''}` : null,
        hk: si.hsi ? fmtIdx(si.hsi) : null,
        crypto: market.crypto ? `BTC $${market.crypto.btc?.price?.toLocaleString()} (${market.crypto.btc?.change>0?'+':''}${market.crypto.btc?.change}%) | ETH $${market.crypto.eth?.price?.toLocaleString()} (${market.crypto.eth?.change>0?'+':''}${market.crypto.eth?.change}%)` : null,
      },
      stockSources: {
        us: (si.nasdaq || si.dji) ? '新浪财经 (实时)' : null,
        cn: (si.sse || si.szse) ? '新浪财经 (实时)' : null,
        hk: si.hsi ? '新浪财经 (实时)' : null,
        crypto: 'CoinGecko (实时)',
      },
      stockIndices: si,
      summary: null, // No LLM summary to save memory
      news: (market.news || []).slice(0, 10),
      bigNews: [], // Raw news replaces LLM-analyzed news
      events: [],
      crypto: market.crypto,
      fearGreed: market.fearGreed,
      lastUpdate: new Date().toISOString(),
    };
    
    // Save market snapshot
    try {
      await pool.execute(
        'INSERT INTO market_snapshots (snapshot_date, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)',
        [today, JSON.stringify(marketOverview)]
      );
    } catch {}
    
    status.progress = 80;
    status.message = '🚀 生成静态文件...';
    
    // 6. Build latest.json
    // Get recent opportunities (last 3 days) for cumulative view
    const [recentOpps] = await pool.execute(
      'SELECT data, feasibility, created_date FROM opportunities WHERE created_date >= DATE_SUB(CURDATE(), INTERVAL 3 DAY) ORDER BY feasibility ASC, created_date DESC LIMIT 30'
    );
    
    const allOpps = recentOpps.map(r => {
      const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      d._fromPrevious = r.created_date.toISOString().split('T')[0] !== today;
      return d;
    });
    
    const latestJson = {
      status: 'done',
      generatedAt: new Date().toISOString(),
      marketOverview,
      rawCount: items.length,
      sourceCounts: {
        HackerNews: items.filter(i => i._source === 'hn').length,
        AskHN: items.filter(i => i._source === 'ask_hn').length,
        GitHub: items.filter(i => i._source === 'github').length,
        GitHubIssues: items.filter(i => i._source === 'github_issues').length,
        StackOverflow: items.filter(i => i._source === 'stackoverflow').length,
        Reddit: items.filter(i => i._source === 'reddit').length,
      },
      painSignalCount: items.filter(i => (i._painSignals || []).length > 0).length,
      opportunities: allOpps,
      summary: `共 ${allOpps.length} 个商机（今日新增 ${opportunities.length} 个）`,
    };
    
    // 7. Write latest.json to public web dir (auto-deployed via junaitools.com)
    const fs = require('fs');
    const homeDir = process.env.HOME || '/home/ztshkzhkyl';
    const webDataDir = `${homeDir}/junaitools.com/painradar/data`;
    fs.mkdirSync(webDataDir, { recursive: true });
    fs.writeFileSync(`${webDataDir}/latest.json`, JSON.stringify(latestJson));
    // Also keep local copy
    fs.writeFileSync('/tmp/painradar-latest.json', JSON.stringify(latestJson));
    console.log(`[deploy] latest.json auto-published (${allOpps.length} opps)`);
    
    status.progress = 100;
    status.state = 'done';
    status.message = `✅ ${opportunities.length} 个新商机已生成`;
    status.result = latestJson;
    console.log(`=== Done! ${opportunities.length} new opportunities ===`);
    
  } catch (err) {
    console.error('[run] Error:', err);
    status = { state: 'error', progress: 0, message: `❌ ${err.message}` };
  }
}

// ========== HTTP Server ==========
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  const send = (code, body) => { res.writeHead(code); res.end(JSON.stringify(body)); };
  if (req.method === 'OPTIONS') return send(200, {});
  
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  if (url.pathname === '/status') return send(200, status);
  
  if (url.pathname === '/trigger' && (req.method === 'POST' || url.searchParams.get('action') === 'trigger')) {
    if (status.state === 'running') return send(200, { status: 'already_running' });
    runFullAnalysis();
    return send(200, { status: 'triggered' });
  }
  
  if (url.pathname === '/result') {
    if (status.result) return send(200, status.result);
    return send(404, { error: 'No result yet' });
  }
  
  if (url.pathname === '/market') {
    try {
      const [rows] = await pool.execute('SELECT data FROM market_snapshots ORDER BY snapshot_date DESC LIMIT 1');
      if (rows.length) return send(200, typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data);
    } catch {}
    return send(404, { error: 'No market data' });
  }
  
  if (url.pathname === '/opportunities') {
    try {
      const days = parseInt(url.searchParams.get('days') || '7');
      const [rows] = await pool.execute(
        'SELECT data, feasibility, created_date FROM opportunities WHERE created_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ORDER BY feasibility ASC, created_date DESC',
        [days]
      );
      return send(200, rows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data));
    } catch (e) { return send(500, { error: e.message }); }
  }
  
  // === Async Analysis APIs (GET-based to avoid WAF 403 on shared hosting) ===
  
  // GET /analyze/market — 触发市场分析 (GET to avoid WAF)
  if (url.pathname === '/analyze/market' && url.searchParams.get('action') === 'trigger') {
    try {
      const market = await fetchMarketData();
      const taskId = await createTask('market', {
        stockIndices: market.stockIndices,
        crypto: market.crypto,
        fearGreed: market.fearGreed,
        news: (market.news || []).slice(0, 8),
      });
      runMarketAnalysis(taskId);
      return send(200, { taskId, state: 'pending' });
    } catch (e) { return send(500, { error: e.message }); }
  }
  
  // GET /analyze/news — 触发新闻分析 (GET to avoid WAF)
  if (url.pathname === '/analyze/news' && url.searchParams.get('action') === 'trigger') {
    try {
      const market = await fetchMarketData();
      const taskId = await createTask('news', { news: (market.news || []).slice(0, 10) });
      runNewsAnalysis(taskId);
      return send(200, { taskId, state: 'pending' });
    } catch (e) { return send(500, { error: e.message }); }
  }
  
  // GET /analyze/:id — 查询分析任务状态/结果
  if (req.method === 'GET' && url.pathname.startsWith('/analyze/')) {
    const taskId = url.pathname.split('/')[2];
    if (!taskId) return send(400, { error: 'task id required' });
    try {
      const [rows] = await pool.execute('SELECT * FROM analysis_tasks WHERE id=?', [taskId]);
      if (!rows.length) return send(404, { error: 'Task not found' });
      const task = rows[0];
      return send(200, {
        taskId: task.id,
        type: task.type,
        state: task.state,
        result: task.result ? (typeof task.result === 'string' ? JSON.parse(task.result) : task.result) : null,
        error: task.error_msg,
        createdAt: task.created_at,
        completedAt: task.completed_at,
      });
    } catch (e) { return send(500, { error: e.message }); }
  }
  
  // GET /analyze — 列出最近的分析任务
  if (req.method === 'GET' && url.pathname === '/analyze') {
    try {
      const type = url.searchParams.get('type');
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      let sql = 'SELECT id, type, state, created_at, completed_at FROM analysis_tasks';
      const params = [];
      if (type) { sql += ' WHERE type=?'; params.push(type); }
      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);
      const [rows] = await pool.execute(sql, params);
      return send(200, { tasks: rows });
    } catch (e) { return send(500, { error: e.message }); }
  }
  
  // Deep search
  if (req.method === 'POST' && url.pathname === '/search') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { keyword } = JSON.parse(body);
        if (!keyword) return send(400, { error: 'keyword required' });
        
        // Fetch HN + GitHub for this keyword
        const [hnRes, ghRes] = await Promise.allSettled([
          fetchHNQuery(keyword, 15),
          fetchGH(`${keyword} type:issue sort:reactions`, 10),
        ]);
        const hn = hnRes.status === 'fulfilled' ? hnRes.value : [];
        const gh = ghRes.status === 'fulfilled' ? ghRes.value : [];
        
        const items = [...hn, ...gh].slice(0, 15);
        const itemList = items.map((i, idx) => `${idx+1}. [${i._source}] ${i.title} | ${i.points || i.reactions || 0}`).join('\n');
        
        const prompt = `你是一位独立开发者商机分析师。针对"${keyword}"这个领域，结合以下社区讨论数据，输出一份深度商机分析报告。

社区数据：
${itemList}

要求（严格按以下JSON结构输出）：

1. executive_summary（字符串）：用3-5句话总结该领域的商业潜力，包含市场规模估算、增长趋势、关键驱动力。必须具体，不要空话。

2. existing_products（数组，至少3个）：该领域已有的知名产品/服务，每个包含：
   - name：产品名称（如 "Snyk", "SonarQube"）
   - website：官网URL
   - what_it_does：这个产品是干什么的（2-3句话，通俗易懂）
   - pricing：定价模式（免费/付费/Freemium，具体价格）
   - strengths：核心优势（1-2句话）
   - weaknesses：主要不足/用户吐槽点（1-2句话）
   - target_users：目标用户群

3. painPoints（数组，至少4个）：每个痛点包含：
   - title：痛点标题
   - description：具体描述（引用社区讨论中的真实证据，至少50字）
   - severity：high/medium/low
   - willingness_to_pay：用户为解决此痛点愿意支付多少（具体金额范围）
   - affected_users：受影响的用户群体和估计规模
   - current_solutions：现有解决方案及其不足

4. opportunities（数组，至少3个）：每个商机包含：
   - title：产品名称
   - description：产品定位（2-3句话）
   - related_products：与哪些已有产品相关/竞争（列出名称）
   - our_advantage：我们作为独立开发者的差异化优势在哪里（为什么用户会选我们而不是已有产品，至少2句话）
   - monetization：具体定价策略（月费/年费/一次性，具体金额）
   - dev_cost：开发成本估算（人数×时间）
   - competition：主要竞品详细分析（至少2个竞品，说明各自优劣势）
   - first_step：独立开发者第一步应该做什么（可执行的行动）
   - revenue_potential：12个月内的收入预期

5. market_context：
   - market_size：预估市场规模
   - growth_rate：增长率
   - key_players：主要玩家
   - entry_barriers：进入壁垒

6. verdict：
   - score：1-10评分
   - recommendation：给独立开发者的具体建议（至少3句话，包含具体行动步骤）
   - risk_factors：主要风险点（至少2个）

输出纯JSON，不要markdown。中文。每个字段都要有实质内容，不要泛泛而谈。`;
        
        const result = await callLLM(prompt, 15000); // GLM-5 needs more tokens (thinking + output)
        const report = tryParseJSON(result);
        const finalReport = report || { executive_summary: result.substring(0, 500) };
        
        // Save to MySQL
        try {
          const score = finalReport.verdict?.score || null;
          await pool.execute(
            'INSERT INTO search_reports (keyword, report, raw_count, score) VALUES (?, ?, ?, ?)',
            [keyword, JSON.stringify(finalReport), items.length, score]
          );
          console.log(`[search] Saved report for "${keyword}" (score: ${score})`);
        } catch (dbErr) { console.error('[search] DB save failed:', dbErr.message); }
        
        send(200, { keyword, report: finalReport, rawCount: items.length });
      } catch (e) { send(500, { error: e.message }); }
    });
    return;
  }
  
  // GET /reports — 获取历史搜索报告列表
  if (req.method === 'GET' && url.pathname === '/reports') {
    try {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const [rows] = await pool.execute(
        'SELECT id, keyword, score, raw_count, created_at FROM search_reports ORDER BY created_at DESC LIMIT ?',
        [limit]
      );
      send(200, { reports: rows });
    } catch (e) { send(500, { error: e.message }); }
    return;
  }

  // GET /reports/:id — 获取单个报告详情
  if (req.method === 'GET' && url.pathname.startsWith('/reports/')) {
    try {
      const id = url.pathname.split('/')[2];
      const [rows] = await pool.execute('SELECT * FROM search_reports WHERE id = ?', [id]);
      if (rows.length === 0) return send(404, { error: 'Report not found' });
      const row = rows[0];
      row.report = typeof row.report === 'string' ? JSON.parse(row.report) : row.report;
      send(200, { keyword: row.keyword, report: row.report, rawCount: row.raw_count, createdAt: row.created_at });
    } catch (e) { send(500, { error: e.message }); }
    return;
  }

  send(200, { service: 'PainRadar Backend', status: status.state, endpoints: ['/status', '/trigger', '/result', '/market', '/opportunities', '/search', '/reports'] });
});

// ========== Start ==========
(async () => {
  await initDB();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🔍 PainRadar Backend | http://0.0.0.0:${PORT}`);
    console.log(`   GET  /status        → 查询状态`);
    console.log(`   POST /trigger       → 触发分析`);
    console.log(`   GET  /result        → 最新结果`);
    console.log(`   GET  /market        → 市场数据`);
    console.log(`   GET  /opportunities → 历史商机`);
    console.log(`   POST /search        → 深度搜索\n`);
  });
})();
