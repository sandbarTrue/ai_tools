针对Linux服务器（Ubuntu x86_64）IP被小红书封禁（错误代码300012，通常表示IP风控或请求特征异常）的情况，以下是具体的技术解决方案。

**⚠️ 免责声明**：以下内容仅供技术研究和网络安全测试使用。请遵守小红书的服务条款及相关法律法规，不得用于非法数据爬取或破坏平台运营。

### 1. Cloudflare WARP 安装与配置 (推荐方案)

Cloudflare WARP 可以为你的服务器提供一个 IPv4/IPv6 出口，有效地隐藏服务器的真实 IP 并绕过 IP 封锁。这是目前最稳定且免费的方案。

**步骤 1: 安装 WARP 客户端**
由于 Cloudflare 官方仓库在国内访问可能不稳定，这里提供直接下载 Deb 包的方式。

```bash
# 进入临时目录
cd /tmp

# 下载最新版 WARP (Ubuntu x86_64)
wget https://github.com/cloudflare/cloudflare-docs/raw/production/static/warp-client_2023.3.470_amd64.deb -O warp-client.deb

# 如果 GitHub 无法访问，请尝试使用国内镜像或自行寻找 deb 包链接
# 安装
sudo dpkg -i warp-client.deb

# 修复可能的依赖问题
sudo apt-get install -f
```

**步骤 2: 注册并连接 WARP**
WARP 默认是作为 SOCKS5 代理运行的，这正是我们需要的方式。

```bash
# 注册客户端 (如果卡住请多试几次)
warp-cli register

# 设置代理模式 (SOCKS5)
warp-cli set-mode proxy

# 连接 WARP
warp-cli connect

# 检查状态 (应显示 Status: Connected)
warp-cli status
```

**步骤 3: 在代码中使用代理**
连接成功后，WARP 默认在 `127.0.0.1:40000` 开启 SOCKS5 代理。
在你的爬虫或请求代码中设置代理：
*   **地址**: `127.0.0.1`
*   **端口**: `40000`
*   **类型**: `SOCKS5`

### 2. 免费 SOCKS5 代理 (备选方案)

⚠️ **警告**: 公开的免费代理极度不稳定，且存在隐私泄露风险。对于小红书这种风控严格的平台，免费代理很可能已经被污染（之前被其他人滥用过），成功率极低。

如果必须使用，建议使用动态拨号（由于是服务器环境，通常无法使用ADSL拨号），或者寻找付费的短效代理。如果只是测试，可以使用以下命令获取公开列表：

**安装 Proxychains4 (代理链工具)**
这允许你强制让某个命令走代理。

```bash
sudo apt update
sudo apt install proxychains4 -y
```

**配置 Proxychains**
编辑配置文件：
```bash
nano /etc/proxychains4.conf
```
在文件末尾的 `[ProxyList]` 下方添加你找到的免费代理 IP（需要你去专门网站查找，如：`185.199.229.156 7157` 这种格式）：
```text
[ProxyList]
# 示例 (你需要替换成真实可用的)
# socks5 1.2.3.4 1080
# http 5.6.7.8 8080
```

**使用方式**
```bash
# 强制 curl 走代理链
proxychains4 curl -v https://www.xiaohongshu.com
```

### 3. 小红书 API 分析

**结论：没有公开、不限 IP 的官方 API。**

1.  **官方 API**: 小红书主要面向移动端应用，没有像 Twitter 或 Reddit 那样完全开放的公开 API 平台。其内部 API（移动端抓包获得的接口）有非常严格的加密机制（Shield 字段、签字校验）。
2.  **IP 限制**: 即使你破解了加密参数，服务器端的 IP 风控依然存在。高频请求会直接触发 300012 或 300013 错误。
3.  **Web API**: 网页版 API 相对简单，但更容易触发人机验证（验证码）和 IP 封禁。

**绕过思路总结：**
*   **首选**：使用方案 1 (WARP) + 代码中设置 SOCKS5 代理。这是最干净的 IP。
*   **进阶**：如果 WARP 的 IP 段也被封（概率较小），你需要购买**住宅代理**。数据中心 IP（你的服务器和免费代理）在小红书风控中权重极低，极易被封。住宅代理模拟真实家庭宽带用户，存活率最高。
