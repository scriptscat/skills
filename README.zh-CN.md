# ScriptCat Agent Skills

[ScriptCat](https://github.com/scriptscat/scriptcat) Agent 技能包和示例。

## 技能列表

| 技能 | 说明 |
|------|------|
| [browser-automation](./browser-automation/) | 页面分析、DOM 操作、表单填写、截图、导航 |
| [scheduled-tasks](./scheduled-tasks/) | 基于 cron 的定时任务，支持 internal（LLM 自动执行）和 event（脚本回调）两种模式 |
| [skill-creator](./skill-creator/) | 辅助创建、测试和打包新的 Skill |

## 独立 CATTool

通用工具，无需 Skill 即可单独安装。位于 [`cattools/`](./cattools/)：

| 工具 | 说明 |
|------|------|
| [http_request](./cattools/http_request.js) | 跨域 HTTP 请求（GET/POST/PUT/DELETE），基于 GM_xmlhttpRequest |
| [run_script](./cattools/run_script.js) | 在沙箱环境中执行 JavaScript，用于数据处理和计算 |

通过 `CAT.agent.tools.install(code)` 安装，或在 **Agent → CATTools** 页面导入。

## 示例

Agent 脚本 API 代码示例，位于 [`examples/`](./examples/)：

| 目录 | 说明 |
|------|------|
| [conversation](./examples/conversation/) | 对话 API — 聊天、流式输出、工具调用 |
| [dom](./examples/dom/) | DOM API — 页面读取、表单填写、标签页管理 |
| [tools](./examples/tools/) | CATTool — 编写和使用自定义工具 |
| [config](./examples/config/) | Skill 配置 — 声明配置字段，通过 `CAT_CONFIG` 访问 |
| [page_copilot.user.js](./examples/page_copilot.user.js) | 完整用户脚本 — 右键唤起的 AI 网页助手 |

## 安装

将技能目录压缩为 `.zip` 文件，在 ScriptCat 扩展的 **Agent → Skills** 页面中导入。

## 技能目录结构

```
skill-name/
├── SKILL.md          # 提示词 + YAML frontmatter（name, description, config）
├── scripts/          # CATTool 脚本（可选）
└── references/       # Agent 上下文参考文档（可选）
```

### 配置字段

Skill 可以在 `SKILL.md` frontmatter 中声明配置字段。用户在 UI 中填写值，脚本通过 `CAT_CONFIG` 访问：

```yaml
---
name: my-skill
config:
  API_KEY:
    title: "API Key"
    type: text
    secret: true
    required: true
---
```

```javascript
// 在 CATTool 脚本中：
const key = CAT_CONFIG.API_KEY;
```

完整示例见 [examples/config](./examples/config/)。

## 许可证

GPLv3
