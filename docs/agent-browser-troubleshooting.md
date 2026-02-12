# Agent-Browser 故障排查与解决

**日期**: 2026-02-12
**问题**: OpenClaw agent-browser 工具无法连接到浏览器控制服务
**状态**: ✅ 已解决

---

## 📋 问题现象

### 报错信息
```
Can't reach the openclaw browser control service (timed out after 15000ms).
Start (or restart) the OpenClaw gateway (OpenClaw.app menubar, or `openclaw gateway`) and try again.
```

### 初始诊断

| 检查项 | 状态 |
|---------|------|
| Gateway 运行状态 | ✅ 运行中 |
| Gateway 端口 18789 | ✅ 正常监听 |
| Relay 端口 18792 | ✅ 正常监听 |
| **浏览器控制端口 18791** | ❌ **缺失** |
| Chrome CDP 端口 18800 | ❌ 未启动 |

### 关键发现

浏览器控制服务日志显示：
```json
{"browser/service": "Browser control service ready (profiles=2)"}
```

**但实际上端口 18791 没有监听**，导致 `browser` 工具连接超时。

---

## 🔍 根本原因分析

### 代码层面分析

在 `/root/.nvm/versions/node/v24.10.0/lib/node_modules/openclaw/dist/browser/client-fetch.js` 中：

```javascript
export async function fetchBrowserJson(url, init) {
    const timeoutMs = init?.timeoutMs ?? 5000;
    try {
        if (isAbsoluteHttp(url)) {
            return await fetchHttpJson(url, { ...init, timeoutMs });
        }
        const started = await startBrowserControlServiceFromConfig();
        if (!started) {
            throw new Error("browser control disabled");
        }
        const dispatcher = createBrowserRouteDispatcher(createBrowserControlContext());
        const parsed = new URL(url, "http://localhost");
        // ...
    }
}
```

**问题**：当 `baseUrl` 为 `undefined` 时：
```javascript
new URL(undefined, "http://localhost")  // 结果: http://localhost/ (端口 80)
```
这导致连接到错误端口，而不是 Gateway 的浏览器控制端口 18791。

### 真正原因

经过深入排查，发现**浏览器进程未启动**：

| 场景 | 状态 |
|------|------|
| CLI `openclaw browser start` | ✅ Chrome 启动成功 |
| CDP 端口 18800 | ✅ 正常监听 |
| browser tool 连接 | ✅ 正常工作 |

**关键发现**：浏览器控制服务需要先用 CLI 启动浏览器实例，然后 `browser` tool 才能正常工作。

---

## ✅ 解决方案

### 步骤 1：确保配置正确

`~/.openclaw/openclaw.json`:

```json
{
  "browser": {
    "enabled": true,
    "defaultProfile": "openclaw",
    "headless": true,
    "noSandbox": true,
    "executablePath": "/usr/bin/google-chrome",
    "profiles": {
      "openclaw": {
        "cdpPort": 18800,
        "color": "#FF4500"
      }
    }
  }
}
```

### 步骤 2：重启 Gateway

```bash
# 停止所有进程
pkill -9 -f openclaw

# 重新启动
nohup openclaw-gateway > /tmp/openclaw-gateway.log 2>&1 &

# 等待就绪
sleep 5
```

### 步骤 3：启动浏览器（关键步骤）

```bash
# 先启动浏览器实例
openclaw browser start

# 确认状态
openclaw browser status
```

**输出**：
```
🦞 browser [openclaw] running: true
profile: openclaw
enabled: true
running: true
cdpPort: 18800
cdpUrl: http://127.0.0.1:18800
```

### 步骤 4：测试 browser tool

```javascript
// 在 Agent 中调用
await browser({ action: "status" });      // ✅ 成功
await browser({ action: "open", targetUrl: "https://www.baidu.com" });  // ✅ 成功
```

---

## 📊 验证结果

| 操作 | 状态 | 详情 |
|------|------|------|
| **status** | ✅ 成功 | 返回完整的浏览器状态 |
| **open** | ✅ 成功 | 打开新标签页，返回 targetId |
| **CDP 连接** | ✅ 正常 | 端口 18800 正常响应 |
| **Chrome 进程** | ✅ 运行中 | PID 正常 |

---

## 🤔 问题反思

### 1. 启动顺序不明确

**问题**：
- `browser` tool 的报错信息不够清晰
- 没有明确提示需要先用 CLI 启动浏览器
- 用户可能认为安装配置后直接就能用

**改进建议**：
- 在错误信息中明确提示："请先运行 `openclaw browser start`"
- 在配置检查时自动检测并启动浏览器

### 2. 服务状态不一致

**问题**：
- 日志显示 "Browser control service ready"
- 但浏览器控制端口没有监听
- 状态和实际不符

**改进建议**：
- 在日志中明确端口绑定状态
- 健康检查应该验证端口是否真的在监听

### 3. Headless 模式下的问题

**环境信息**：
- 系统：Ubuntu 20.04 (有图形界面)
- 用户：root
- X Server：可用 (DISPLAY=:1)

**发现**：
- 非无头模式 (`headless: false`) 在 root 环境下可能有问题
- 需要明确 DISPLAY 环境变量

---

## 📝 最佳实践

### 推荐工作流程

```bash
# 1. 检查 Gateway 状态
openclaw gateway status

# 2. 检查浏览器状态
openclaw browser status

# 3. 启动浏览器（如果未运行）
openclaw browser start

# 4. 使用 browser tool
# 在 Agent 中调用 browser() 函数
```

### 配置建议

| 配置项 | 推荐值 | 说明 |
|---------|---------|------|
| `browser.enabled` | `true` | 启用浏览器控制 |
| `browser.defaultProfile` | `"openclaw"` | 使用隔离浏览器 |
| `browser.headless` | `true` | 无头模式（服务器环境） |
| `browser.noSandbox` | `true` | root 用户需要 |
| `browser.executablePath` | `/usr/bin/google-chrome` | 显式指定 Chrome |

---

## 🎓 学到的经验

### 1. OpenClaw 架构理解

```
┌─────────────┐
│   Agent    │ → browser tool (HTTP 调用)
└──────┬──────┘
       │
┌──────▼────────┐
│   Gateway      │ → 浏览器控制服务 (端口 18791)
└──────┬────────┘
       │
┌──────▼────────┐
│   Browser      │ → Chrome CDP (端口 18800)
└─────────────────┘
```

**关键点**：三层架构中，每层都需要正确配置和启动。

### 2. 调试技巧

1. **使用 CLI 先验证**：
   ```bash
   openclaw browser status  # 比 agent tool 更准确
   ```

2. **检查端口监听**：
   ```bash
   netstat -tlnp | grep -E "18789|18791|18800"
   ```

3. **查看进程详情**：
   ```bash
   ps aux | grep google-chrome
   ```

4. **直接测试 CDP**：
   ```bash
   curl -s http://127.0.0.1:18800/json/version
   ```

### 3. 系统环境检查

在 Linux root 环境下：
- ✅ 检查 DISPLAY 是否设置
- ✅ 检查 X Server 是否运行
- ✅ 使用 `--no-sandbox` 标志
- ✅ 使用 `--disable-gpu` 避免图形问题

---

## 📚 相关文件

- `/root/.openclaw/openclaw.json` - 主配置文件
- `/root/.openclaw/browser/openclaw/user-data/` - 浏览器数据目录
- `/root/.nvm/versions/node/v24.10.0/lib/node_modules/openclaw/dist/` - 代码路径
- `/tmp/openclaw/openclaw-*.log` - 日志文件

---

## ✅ 最终状态

| 功能 | 状态 |
|------|------|
| Gateway 服务 | ✅ 正常运行 |
| 浏览器控制服务 | ✅ 正常监听 |
| Chrome CDP | ✅ 正常监听 (18800) |
| browser tool | ✅ 正常工作 |
| 打开标签页 | ✅ 成功 |
| 状态查询 | ✅ 成功 |

---

**总结**: agent-browser 问题已彻底解决，关键步骤是**先用 CLI 启动浏览器实例**。
