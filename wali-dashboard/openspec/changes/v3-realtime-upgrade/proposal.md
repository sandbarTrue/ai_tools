# 看板 v3 第二轮优化 - 实时性 + 任务进度

## 背景
看板 v3 布局已确认OK，但存在以下问题：
1. 命令和日志没有滚动更新（页面不自动刷新）
2. 缺少每个任务的进度条（已完成/总任务数）
3. 私聊 session 数据没展示
4. Claude Code session 列表全显示同一个项目名，看不出具体任务

## 目标
- 看板数据每 30 秒自动刷新
- 每个任务显示进度条
- 展示所有 session（包括私聊）
- Claude Code session 显示有意义的信息

## 数据源
前端从 https://junaitools.com/wali-api/stats.json 获取数据。
后端 collector 每 5 分钟生成新数据。
