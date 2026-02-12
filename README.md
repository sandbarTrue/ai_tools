# OpenClaw Agent-Browser 修复记录

## 📋 问题

OpenClaw agent-browser 工具无法连接到浏览器控制服务，报错：
```
Can't reach the openclaw browser control service (timed out after 15000ms)
```

## ✅ 解决方案

### 关键步骤

1. **先通过 CLI 启动浏览器**（这是关键！）
   ```bash
   openclaw browser start
   ```

2. **验证状态**
   ```bash
   openclaw browser status
   # 输出: 🦞 browser [openclaw] running: true
   ```

3. **然后在 Agent 中使用 browser tool**
   ```javascript
   await browser({ action: "status" });
   await browser({ action: "open", targetUrl: "https://example.com" });
   ```

## 📚 详细文档

完整的故障排查过程、代码分析、调试技巧等，请查看：
**[agent-browser-troubleshooting.md](docs/agent-browser-troubleshooting.md)**

## 🔧 配置参考

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

## 📝 推送步骤

如果需要推送到 GitHub：

```bash
# 1. 设置 GitHub token
export GH_TOKEN=your_github_token

# 2. 创建仓库
gh repo create openclaw-agent-browser-fix --public

# 3. 推送
git remote add origin https://github.com/zhoujun.sandbar/openclaw-agent-browser-fix.git
git branch -M main
git push -u origin main
```

---

**日期**: 2026-02-12
**环境**: Ubuntu 20.04, root, OpenClaw 2026.1.30
