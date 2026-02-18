#!/bin/bash
set -euo pipefail

# import.sh - 在新机器上从加密包恢复瓦力环境
# 用法: bash import.sh /path/to/wali-export-xxx.tar.gz.enc

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
fail() { log_error "$1"; exit 1; }

# 检查参数
if [[ $# -lt 1 ]]; then
    echo "用法: bash import.sh /path/to/wali-export-xxx.tar.gz.enc"
    exit 1
fi

EXPORT_FILE="$1"

# 检查文件存在
if [[ ! -f "$EXPORT_FILE" ]]; then
    fail "导出包不存在: $EXPORT_FILE"
fi

# 检查是否 root
if [[ $EUID -ne 0 ]]; then
    fail "请以 root 用户运行此脚本 (sudo bash import.sh ...)"
fi

log_info "开始导入瓦力环境..."
log_info "导出包: $EXPORT_FILE"

# 临时目录
IMPORT_DIR="/tmp/wali-import-$$"

# 1. 解密解压
log_info "解密压缩包（请输入密码）..."
rm -rf "$IMPORT_DIR"
mkdir -p "$IMPORT_DIR"

TEMP_TAR="/tmp/wali-import-$$.tar.gz"
if ! openssl enc -aes-256-cbc -d -pbkdf2 -in "$EXPORT_FILE" -out "$TEMP_TAR" 2>/dev/null; then
    rm -rf "$IMPORT_DIR" "$TEMP_TAR"
    fail "解密失败，请检查密码是否正确"
fi

log_info "解压文件..."
if ! tar xzf "$TEMP_TAR" -C "$IMPORT_DIR"; then
    rm -rf "$IMPORT_DIR" "$TEMP_TAR"
    fail "解压失败"
fi
rm -f "$TEMP_TAR"
log_info "  解压完成"

# 2. 安装 nvm + Node.js v24
log_info "检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    log_info "安装 nvm..."
    export NVM_DIR="$HOME/.nvm"
    if [[ ! -d "$NVM_DIR" ]]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    source "$NVM_DIR/nvm.sh"

    log_info "安装 Node.js v24..."
    nvm install 24
    nvm use 24
    nvm alias default 24
    log_info "  Node.js $(node -v) 安装完成"
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 20 ]]; then
        log_warn "Node.js 版本较低 ($NODE_VERSION)，建议升级到 v24"
    fi
    log_info "  已安装 Node.js: $(node -v)"
fi

# 确保 nvm 在 profile 中
if ! grep -q 'NVM_DIR' /root/.bashrc 2>/dev/null; then
    echo '' >> /root/.bashrc
    echo 'export NVM_DIR="$HOME/.nvm"' >> /root/.bashrc
    echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"' >> /root/.bashrc
fi

# 3. 安装 openclaw
log_info "检查 openclaw..."
if ! command -v openclaw &> /dev/null; then
    log_info "安装 openclaw..."
    npm i -g openclaw
    log_info "  openclaw 安装完成"
else
    log_info "  已安装 openclaw: $(openclaw --version 2>/dev/null || echo 'unknown')"
fi

# 4. 恢复配置文件
log_info "恢复配置文件..."

restore_file() {
    local src="$1"
    local dest="$2"
    if [[ -f "$src" ]]; then
        mkdir -p "$(dirname "$dest")"
        # 备份已存在的文件
        if [[ -f "$dest" ]]; then
            cp "$dest" "${dest}.bak.$(date +%Y%m%d)"
            log_info "  已备份: $dest"
        fi
        cp "$src" "$dest"
        log_info "  已恢复: $dest"
    else
        log_warn "  源文件不存在: $src"
    fi
}

restore_file "$IMPORT_DIR/config/openclaw.json" "/root/.openclaw/openclaw.json"
restore_file "$IMPORT_DIR/config/.openspec-config" "/root/.openspec-config"
restore_file "$IMPORT_DIR/scripts/anthropic-oauth-proxy.js" "/root/anthropic-oauth-proxy.js"

# 5. 恢复 SSH keys
log_info "恢复 SSH keys..."
if [[ -f "$IMPORT_DIR/ssh/spaceship_rsa" ]]; then
    mkdir -p /root/.ssh
    chmod 700 /root/.ssh
    cp "$IMPORT_DIR/ssh/spaceship_rsa" /root/.ssh/
    chmod 600 /root/.ssh/spaceship_rsa
    log_info "  SSH key 已恢复"
else
    log_warn "  无 SSH key 需要恢复"
fi

# 6. Clone GitHub repos
log_info "克隆 GitHub 仓库..."

# 确保 SSH agent 运行
eval "$(ssh-agent -s)" 2>/dev/null || true
ssh-add /root/.ssh/spaceship_rsa 2>/dev/null || true

# Clone openclaw-skills
SKILLS_DIR="/root/.openclaw/workspace/skills-from-github"
if [[ ! -d "$SKILLS_DIR" ]]; then
    log_info "  克隆 openclaw-skills..."
    mkdir -p "$(dirname "$SKILLS_DIR")"
    git clone git@github.com:sandbarTrue/openclaw-skills.git "$SKILLS_DIR"
    log_info "  openclaw-skills 已克隆"
else
    log_info "  openclaw-skills 已存在，跳过"
fi

# Clone ai_tools (wali-workspace branch)
AI_TOOLS_DIR="/root/.openclaw/workspace/ai_tools"
if [[ ! -d "$AI_TOOLS_DIR" ]]; then
    log_info "  克隆 ai_tools (wali-workspace 分支)..."
    git clone -b wali-workspace git@github.com:sandbarTrue/ai_tools.git "$AI_TOOLS_DIR"
    log_info "  ai_tools 已克隆"
else
    log_info "  ai_tools 已存在，跳过"
fi

# 7. 恢复 crontab
log_info "恢复 crontab..."
if [[ -f "$IMPORT_DIR/crontab.txt" ]] && [[ -s "$IMPORT_DIR/crontab.txt" ]]; then
    # 检查不是只有注释
    if grep -v '^#' "$IMPORT_DIR/crontab.txt" | grep -q .; then
        crontab "$IMPORT_DIR/crontab.txt"
        log_info "  crontab 已恢复"
    else
        log_warn "  crontab 文件为空，跳过"
    fi
else
    log_warn "  无 crontab 需要恢复"
fi

# 8. 恢复 iptables
log_info "恢复 iptables 规则..."
if [[ -f "$IMPORT_DIR/iptables.rules" ]] && [[ -s "$IMPORT_DIR/iptables.rules" ]]; then
    if grep -v '^#' "$IMPORT_DIR/iptables.rules" | grep -q .; then
        iptables-restore < "$IMPORT_DIR/iptables.rules"
        log_info "  iptables 规则已恢复"

        # 保存 iptables 规则持久化
        if command -v netfilter-persistent &> /dev/null; then
            netfilter-persistent save
        fi
    else
        log_warn "  iptables 文件为空，跳过"
    fi
else
    log_warn "  无 iptables 规则需要恢复"
fi

# 9. 恢复 collectors 配置
log_info "恢复 collectors 配置..."
restore_file "$IMPORT_DIR/collectors/config.json" "/root/.openclaw/workspace/collectors/config.json"

# 10. 运行 services.sh 启动 screen 服务
log_info "检查 screen 服务脚本..."
if [[ -f "$IMPORT_DIR/services.sh" ]]; then
    chmod +x "$IMPORT_DIR/services.sh"
    log_info "  services.sh 可用，需要手动检查并启动服务"
    log_info "  脚本位置: $IMPORT_DIR/services.sh"
fi

# 11. 启动 OpenClaw gateway
log_info "启动 OpenClaw gateway..."
if command -v openclaw &> /dev/null; then
    openclaw gateway start || log_warn "  gateway 启动可能已运行"
    sleep 3
else
    log_warn "  openclaw 命令不可用，跳过 gateway 启动"
fi

# 12. 验证
log_info "验证环境..."
sleep 2

VERIFIED=true

if command -v openclaw &> /dev/null; then
    if openclaw status &>/dev/null; then
        log_info "  openclaw status: 正常"
    else
        log_warn "  openclaw status: 检查失败"
        VERIFIED=false
    fi
fi

# 检查 gateway 端口
if curl -s http://localhost:8089/health &>/dev/null || curl -s http://localhost:8089 &>/dev/null; then
    log_info "  gateway 端口 8089: 响应正常"
else
    log_warn "  gateway 端口 8089: 无响应（可能尚未完全启动）"
fi

# 检查配置文件
if [[ -f "/root/.openclaw/openclaw.json" ]]; then
    log_info "  openclaw.json: 已恢复"
else
    log_error "  openclaw.json: 缺失"
    VERIFIED=false
fi

# 清理
log_info "清理临时文件..."
# 保留 services.sh 供参考
cp "$IMPORT_DIR/services.sh" /tmp/import-services.sh 2>/dev/null || true
rm -rf "$IMPORT_DIR"

# 完成
echo ""
log_info "=========================================="
if [[ "$VERIFIED" == "true" ]]; then
    log_info "导入完成！"
else
    log_warn "导入完成，但部分验证失败，请检查"
fi
log_info "=========================================="
echo ""
log_info "后续步骤:"
log_info "1. 检查并启动 screen 服务: cat /tmp/import-services.sh"
log_info "2. 验证飞书机器人: openclaw feishu test"
log_info "3. 检查所有服务状态: openclaw status"
