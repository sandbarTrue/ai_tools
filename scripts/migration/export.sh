#!/bin/bash
set -euo pipefail

# export.sh - 导出瓦力环境配置和状态到加密压缩包
# 用法: bash export.sh

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 时间戳
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
EXPORT_DIR="/tmp/wali-export-$$"
EXPORT_FILE="/tmp/wali-export-${TIMESTAMP}.tar.gz.enc"
MANIFEST_FILE="/tmp/wali-export-manifest-${TIMESTAMP}.txt"

log_info "开始导出瓦力环境..."
log_info "临时目录: $EXPORT_DIR"

# 1. 创建临时目录
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

# 2. 复制配置文件
log_info "复制配置文件..."

copy_file() {
    local src="$1"
    local dest_dir="$2"
    if [[ -f "$src" ]]; then
        mkdir -p "$EXPORT_DIR/$dest_dir"
        cp "$src" "$EXPORT_DIR/$dest_dir/"
        log_info "  已复制: $src"
    else
        log_warn "  文件不存在: $src"
    fi
}

copy_file "/root/.openclaw/openclaw.json" "config"
copy_file "/root/.openspec-config" "config"
copy_file "/root/anthropic-oauth-proxy.js" "scripts"
copy_file "/root/.ssh/spaceship_rsa" "ssh"
copy_file "/root/.openclaw/workspace/collectors/config.json" "collectors"

# 3. 导出 crontab
log_info "导出 crontab..."
if crontab -l > "$EXPORT_DIR/crontab.txt" 2>/dev/null; then
    log_info "  crontab 已导出"
else
    log_warn "  无 crontab 或导出失败"
    echo "# 无 crontab 配置" > "$EXPORT_DIR/crontab.txt"
fi

# 4. 导出 iptables 规则
log_info "导出 iptables 规则..."
if sudo iptables-save > "$EXPORT_DIR/iptables.rules" 2>/dev/null; then
    log_info "  iptables 规则已导出"
else
    log_warn "  iptables 导出失败或无规则"
    echo "# 无 iptables 规则" > "$EXPORT_DIR/iptables.rules"
fi

# 5. 记录 screen 服务列表和启动命令
log_info "记录 screen 服务..."
SERVICES_SH="$EXPORT_DIR/services.sh"
cat > "$SERVICES_SH" << 'HEADER'
#!/bin/bash
# services.sh - 重建 screen 服务的脚本
# 由 export.sh 自动生成

set -e

HEADER

# 获取所有 screen 会话
SCREEN_LIST=$(screen -ls 2>/dev/null || true)
if [[ -n "$SCREEN_LIST" ]]; then
    echo "# 以下是在导出时运行的 screen 会话:" >> "$SERVICES_SH"
    echo "# $SCREEN_LIST" >> "$SERVICES_SH"
    echo "" >> "$SERVICES_SH"

    # 尝试记录每个 screen 的详细信息
    while IFS= read -r line; do
        # 提取 screen 名称 (格式: PID.name)
        if [[ "$line" =~ ([0-9]+)\.([a-zA-Z0-9_-]+) ]]; then
            screen_name="${BASH_REMATCH[2]}"
            echo "# Screen: $screen_name" >> "$SERVICES_SH"
            echo "# screen -dmS $screen_name <command>" >> "$SERVICES_SH"
        fi
    done <<< "$SCREEN_LIST"
    log_info "  已记录 screen 服务列表"
else
    echo "# 无运行中的 screen 服务" >> "$SERVICES_SH"
    log_warn "  无运行中的 screen 服务"
fi

# 6. 记录所有 git repo 列表
log_info "记录 git repo 列表..."
REPOS_TXT="$EXPORT_DIR/repos.txt"
echo "# Git Repositories - Exported at $TIMESTAMP" > "$REPOS_TXT"
echo "# Format: path | remote_url" >> "$REPOS_TXT"
echo "" >> "$REPOS_TXT"

# 搜索 workspace 目录下的 git repo
WORKSPACE_DIR="/root/.openclaw/workspace"
if [[ -d "$WORKSPACE_DIR" ]]; then
    find "$WORKSPACE_DIR" -name ".git" -type d 2>/dev/null | while read -r gitdir; do
        repopath=$(dirname "$gitdir")
        remoteurl=$(cd "$repopath" && git remote get-url origin 2>/dev/null || echo "no-remote")
        echo "$repopath | $remoteurl" >> "$REPOS_TXT"
    done
    log_info "  已记录 git repo 列表"
else
    log_warn "  workspace 目录不存在"
fi

# 7. 生成 manifest.txt
log_info "生成文件清单..."
MANIFEST="$EXPORT_DIR/manifest.txt"
echo "# Wali Export Manifest" > "$MANIFEST"
echo "# Generated: $(date)" >> "$MANIFEST"
echo "# Hostname: $(hostname)" >> "$MANIFEST"
echo "" >> "$MANIFEST"
echo "Files:" >> "$MANIFEST"

cd "$EXPORT_DIR"
find . -type f -exec ls -lh {} \; | while read -r line; do
    echo "  $line" >> "$MANIFEST"
done

echo "" >> "$MANIFEST"
echo "MD5 Checksums:" >> "$MANIFEST"
find . -type f -exec md5sum {} \; >> "$MANIFEST" 2>/dev/null || true

# 复制 manifest 到外部（不加密）
cp "$MANIFEST" "$MANIFEST_FILE"
log_info "  清单已保存到: $MANIFEST_FILE"

# 8. 打包
log_info "打包文件..."
cd "$EXPORT_DIR"
tar czf /tmp/wali-export-${TIMESTAMP}.tar.gz .
log_info "  打包完成"

# 9. 加密
log_info "加密压缩包（请输入密码）..."
openssl enc -aes-256-cbc -pbkdf2 -salt -in /tmp/wali-export-${TIMESTAMP}.tar.gz -out "$EXPORT_FILE"
rm -f /tmp/wali-export-${TIMESTAMP}.tar.gz

# 10. 清理
log_info "清理临时目录..."
rm -rf "$EXPORT_DIR"

# 完成
echo ""
log_info "=========================================="
log_info "导出完成!"
log_info "加密包: $EXPORT_FILE"
log_info "清单文件: $MANIFEST_FILE"
log_info "=========================================="
echo ""
log_info "请妥善保管加密包和密码，将其传输到新机器后运行 import.sh"
