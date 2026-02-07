const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * Lark/Feishu Docx Manager
 * 搞钱大王专用 - 自动化文档操作工具
 */
class LarkDocManager {
    constructor(appId, appSecret) {
        this.appId = appId;
        this.appSecret = appSecret;
        this.baseUrl = 'https://open.feishu.cn/open-apis';
        this.tenantAccessToken = null;
    }

    /**
     * 获取访问令牌 (Tenant Access Token)
     */
    async authenticate() {
        console.log('正在身份验证...');
        try {
            const response = await axios.post(`${this.baseUrl}/auth/v3/tenant_access_token/internal`, {
                app_id: this.appId,
                app_secret: this.appSecret
            });
            this.tenantAccessToken = response.data.tenant_access_token;
            console.log('身份验证成功。');
            return this.tenantAccessToken;
        } catch (error) {
            console.error('身份验证失败:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
            throw error;
        }
    }

    get headers() {
        return {
            'Authorization': `Bearer ${this.tenantAccessToken}`,
            'Content-Type': 'application/json; charset=utf-8'
        };
    }

    /**
     * 创建文档
     * @param {string} title 文档标题
     */
    async createDoc(title) {
        console.log(`正在创建文档: ${title}`);
        try {
            const response = await axios.post(`${this.baseUrl}/docx/v1/documents`, { title }, { headers: this.headers });
            return response.data.data.document;
        } catch (error) {
            console.error('创建文档失败:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
            throw error;
        }
    }

    /**
     * 上传图片到飞书驱动
     * @param {string} filePath 本地文件路径
     * @param {string} parentNode 父节点Token (文档Token)
     */
    async uploadImage(filePath, parentNode) {
        console.log(`正在上传图片: ${filePath}, parentNode: ${parentNode}`);
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            const fileName = path.basename(filePath);
            const fileStream = fs.createReadStream(filePath);

            const form = new FormData();
            form.append('file_name', fileName);
            form.append('parent_type', 'docx_image');
            form.append('parent_node', parentNode);
            form.append('size', fileSize);
            form.append('file', fileStream);

            const headers = {
                ...form.getHeaders(),
                'Authorization': `Bearer ${this.tenantAccessToken}`
            };

            const response = await axios.post(`${this.baseUrl}/drive/v1/medias/upload_all`, form, { headers });
            console.log(`上传成功，Token: ${response.data.data.file_token}`);
            return response.data.data.file_token;
        } catch (error) {
            console.error('上传图片失败:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
            throw error;
        }
    }

    /**
     * 读取文档内容
     * @param {string} documentToken 文档Token
     */
    async getDocContent(documentToken) {
        console.log(`正在读取文档内容: ${documentToken}`);
        try {
            const response = await axios.get(`${this.baseUrl}/docx/v1/documents/${documentToken}/blocks`, { headers: this.headers });
            return response.data.data.items;
        } catch (error) {
            console.error('读取文档失败:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
            throw error;
        }
    }

    /**
     * 在文档末尾追加多个块
     * @param {string} documentToken 文档Token
     * @param {Array} blocks 块定义数组
     */
    async appendBlocks(documentToken, blocks) {
        console.log(`正在向文档追加 ${blocks.length} 个块: ${documentToken}`);
        try {
            const blockId = documentToken;
            
            // 每次最多追加 50 个块 (API 限制)
            const BATCH_SIZE = 50;
            for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
                const chunk = blocks.slice(i, i + BATCH_SIZE);
                const data = {
                    children: chunk
                };
                
                console.log('Sending Payload:', JSON.stringify(data, null, 2));

                await axios.post(
                    `${this.baseUrl}/docx/v1/documents/${documentToken}/blocks/${blockId}/children`,
                    data,
                    { headers: this.headers }
                );
                console.log(`已追加批次 ${i/BATCH_SIZE + 1}`);
                
                // Add delay to avoid Rate Limiting (429)
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            console.log('所有内容追加成功。');
        } catch (error) {
            console.error('追加内容失败:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
            throw error;
        }
    }

    /**
     * 在文档末尾追加文本 (使用 children.create 接口)
     * @param {string} documentToken 文档Token
     * @param {string} text 要追加的内容
     */
    async appendText(documentToken, text) {
        console.log(`正在向文档追加内容: ${documentToken}`);
        try {
            // 在 Docx 中，文档根块 ID 通常与 documentToken 相同
            const blockId = documentToken;
            const data = {
                children: [
                    {
                        block_type: 2, // Text Block
                        text: {
                            elements: [
                                {
                                    text_run: {
                                        content: text
                                    }
                                }
                            ]
                        }
                    }
                ]
            };
            
            const response = await axios.post(
                `${this.baseUrl}/docx/v1/documents/${documentToken}/blocks/${blockId}/children`,
                data,
                { headers: this.headers }
            );
            console.log('内容追加成功。');
            return response.data.data;
        } catch (error) {
            console.error('追加内容失败:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
            throw error;
        }
    }

    /**
     * 添加文档权限
     * @param {string} token 文档Token
     * @param {string} memberId 用户ID (open_id)
     * @param {string} perm 权限 (view/edit)
     */
    async addPermission(token, memberId, perm = 'view') {
        console.log(`正在添加权限: doc=${token}, user=${memberId}, perm=${perm}`);
        try {
            const url = `${this.baseUrl}/drive/v1/permissions/${token}/members?type=docx`;
            const data = {
                member_type: 'openid',
                member_id: memberId,
                perm: perm
            };
            
            await axios.post(url, data, { headers: this.headers });
            console.log('权限添加成功。');
        } catch (error) {
            console.error('添加权限失败:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
            // Don't throw if already exists or other non-critical error, but logging is enough
        }
    }

    /**
     * Download Mermaid diagram as image
     * @param {string} code Mermaid code
     * @param {string} outputPath Output file path
     */
    async downloadMermaidImage(code, outputPath) {
        console.log(`Downloading Mermaid image to: ${outputPath}`);
        const encoded = Buffer.from(code).toString('base64');
        const url = `https://mermaid.ink/img/${encoded}`;
        
        try {
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            });
            
            return new Promise((resolve, reject) => {
                const writer = fs.createWriteStream(outputPath);
                response.data.pipe(writer);
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } catch (error) {
            console.error('Failed to download mermaid image:', error.message);
            throw error;
        }
    }

    // --- Block Helper Functions ---

    static createHeadingBlock(text, level = 1) {
        const blockType = 2 + level; 
        const fieldName = `heading${level}`;
        return {
            block_type: blockType,
            [fieldName]: {
                elements: [{ text_run: { content: text } }]
            }
        };
    }

    static createTextBlock(text, bold = false) {
        return {
            block_type: 2,
            text: {
                elements: [{ 
                    text_run: { 
                        content: text,
                        text_style: { bold: bold }
                    } 
                }]
            }
        };
    }

    static createImageBlock(imageToken, width, height) {
        // block_type 27 = Image
        // Remove width/height to let Feishu auto-size
        return {
            block_type: 27,
            image: {
                image_token: imageToken
            }
        };
    }

    static createCodeBlock(codeContent, language = 1) {
        // block_type 14 = Code
        return {
            block_type: 14,
            code: {
                style: { language: language }, // 1 = Plain Text
                elements: [{ text_run: { content: codeContent } }]
            }
        };
    }
}

// 快速测试示例 & 搞钱设计文档生成器
async function main() {
    let APP_ID, APP_SECRET;
    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            APP_ID = config.LARK_APP_ID;
            APP_SECRET = config.LARK_APP_SECRET;
        } else {
             // Fallback or error if config doesn't exist
             console.error("Config file not found!");
             process.exit(1);
        }
    } catch (error) {
        console.error("Failed to read config:", error);
        process.exit(1);
    }

    const manager = new LarkDocManager(APP_ID, APP_SECRET);

    const architectureDiagram = `graph TD
    User[User / Patient] -->|Open App| Feishu[Feishu Client]
    Feishu -->|API Request| Node[Node.js Backend]
    Node -->|Query/Update| DB[(Database / SQLite)]
    Node -->|Schedule Cron| Cron[Scheduler]
    Cron -->|Trigger| Node
    Node -->|Send Card| Feishu
    Feishu -->|Notify| User
    subgraph "Feishu Cloud"
    Feishu
    end
    subgraph "Your Server"
    Node
    Cron
    DB
    end`;

    const sequenceDiagram = `sequenceDiagram
    participant U as User
    participant F as Feishu Bot
    participant S as Server
    participant D as Database

    Note over S: 09:00 AM Cron Trigger
    S->>D: Get users with schedule
    D-->>S: User List
    S->>F: Send "Time to take meds" Card
    F->>U: Display Card
    U->>F: Click "I Took It"
    F->>S: Webhook (Action Callback)
    S->>D: Update Log (Status=TAKEN)
    S->>D: Decrement Inventory
    D-->>S: Updated
    S-->>F: Update Card (Show "Completed")
    F-->>U: Show Green Checkmark`;

    try {
        await manager.authenticate();

        // 1. 创建设计文档
        const docTitle = `药不能停 App_设计方案_v3.0_最终版_${new Date().getTime()}`;
        const newDoc = await manager.createDoc(docTitle);
        const token = newDoc.document_id;
        console.log(`成功创建文档: ${docTitle}, ID: ${token}`);

        // 2. 生成并上传图片 (Architecture & Sequence)
        const archPath = '/root/.openclaw/workspace/arch_diagram.png';
        const seqPath = '/root/.openclaw/workspace/seq_diagram.png';

        // Ensure directory exists
        const dir = path.dirname(archPath);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }

        await manager.downloadMermaidImage(architectureDiagram, archPath);
        await manager.downloadMermaidImage(sequenceDiagram, seqPath);

        const archToken = await manager.uploadImage(archPath, token);
        const seqToken = await manager.uploadImage(seqPath, token);

        // 3. 构建设计文档内容
        
        // H1: 概览
        await manager.appendBlocks(token, [
            LarkDocManager.createHeadingBlock('1. 项目概览 (Overview)', 1),
            LarkDocManager.createTextBlock('项目名称：药不能停 (Medicine Reminder App)\n'),
            LarkDocManager.createTextBlock('目标：通过飞书机器人提醒用户按时吃药，并追踪库存。\n')
        ]);

        // H1: 系统架构
        await manager.appendBlocks(token, [
            LarkDocManager.createHeadingBlock('2. 系统架构 (System Architecture)', 1),
            LarkDocManager.createTextBlock('系统采用 "Feishu Custom App + Node.js Backend" 架构。下图展示了各个组件的交互关系：\n')
        ]);
        
        await manager.appendBlocks(token, [LarkDocManager.createImageBlock(archToken)]);
        await manager.appendBlocks(token, [LarkDocManager.createTextBlock('图 1: 系统架构图 (Auto-generated)\n', true)]);

        // H1: 核心流程
        await manager.appendBlocks(token, [
            LarkDocManager.createHeadingBlock('3. 核心交互流程 (Sequence)', 1),
            LarkDocManager.createTextBlock('每日服药提醒与确认流程：\n')
        ]);

        await manager.appendBlocks(token, [LarkDocManager.createImageBlock(seqToken)]);
        await manager.appendBlocks(token, [LarkDocManager.createTextBlock('图 2: 核心业务时序图 (Auto-generated)\n', true)]);

        // H1: 数据模型
        await manager.appendBlocks(token, [
            LarkDocManager.createHeadingBlock('4. 数据模型 (Data Models)', 1),
            LarkDocManager.createTextBlock('User (用户): user_id, name, timezone\n'),
            LarkDocManager.createTextBlock('Medicine (药品): name, dosage, inventory_count\n'),
            LarkDocManager.createTextBlock('Schedule (时刻表): cron_expression, enabled\n'),
            LarkDocManager.createTextBlock('Log (记录): status, timestamp\n')
        ]);

        console.log(`\n文档生成完毕！链接: https://www.feishu.cn/docx/${token}`);

    } catch (err) {
        console.error('流程中断:', err.message);
        if (err.response) {
             console.error('API Error Details:', JSON.stringify(err.response.data, null, 2));
        }
    }
}

if (require.main === module) {
    main();
}

module.exports = LarkDocManager;
