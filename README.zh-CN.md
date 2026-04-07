# ScriptCat Agent Skills

[ScriptCat](https://github.com/scriptscat/scriptcat) Agent 技能包和示例。

## 技能列表

| 技能 | 说明 | 安装 |
|------|------|------|
| [browser-automation](./browser-automation/) | 页面分析、DOM 操作、表单填写、截图、导航 | [安装](https://raw.githubusercontent.com/scriptscat/skills/main/browser-automation/SKILL.cat.md) |
| [scheduled-tasks](./scheduled-tasks/) | 基于 cron 的定时任务，支持 internal（LLM 自动执行）和 event（脚本回调）两种模式 | [安装](https://raw.githubusercontent.com/scriptscat/skills/main/scheduled-tasks/SKILL.cat.md) |
| [skill-creator](./skill-creator/) | 辅助创建、测试和打包新的 Skill | [安装](https://raw.githubusercontent.com/scriptscat/skills/main/skill-creator/SKILL.cat.md) |
| [file-parser](./file-parser/) | 解析常见文件格式（Excel、PDF、Word、CSV、PPT），提取文本和结构化数据 | [安装](https://raw.githubusercontent.com/scriptscat/skills/main/file-parser/SKILL.cat.md) |
| [scriptcat-dev](./scriptcat-dev/) | 脚本猫/油猴脚本开发助手 — 编写、调试和优化用户脚本 | [安装](https://raw.githubusercontent.com/scriptscat/skills/main/scriptcat-dev/SKILL.cat.md) |
| [synology-office-sheet](./synology-office-sheet/) | 读写群晖 Synology Office 电子表格单元格 | [安装](https://raw.githubusercontent.com/scriptscat/skills/main/synology-office-sheet/SKILL.cat.md) |
| [wechat-publisher](./wechat-publisher/) | 微信公众号运营助手 — 素材收集、文章编写、配图生成与发布 | [安装](https://raw.githubusercontent.com/scriptscat/skills/main/wechat-publisher/SKILL.cat.md) |
| [xiaohongshu-publisher](./xiaohongshu-publisher/) | 小红书运营助手 — 笔记编写、风格学习、配图生成与发布 | [安装](https://raw.githubusercontent.com/scriptscat/skills/main/xiaohongshu-publisher/SKILL.cat.md) |

## 示例

Agent 脚本 API 代码示例，位于 [`examples/`](./examples/)：

| 目录 | 说明 |
|------|------|
| [conversation](./examples/conversation/) | 对话 API — 聊天、流式输出、工具调用 |
| [dom](./examples/dom/) | DOM API — 页面读取、表单填写、标签页管理 |
| [config](./examples/config/) | Skill 配置 — 声明配置字段，通过 `CAT_CONFIG` 访问 |
| [page_copilot.user.js](./examples/page_copilot.user.js) | 完整用户脚本 — 右键唤起的 AI 网页助手 |

## 安装

在浏览器中打开 `SKILL.cat.md` 链接，ScriptCat 会自动弹出安装提示。也可以在 **Agent → Skills** 页面中粘贴 `SKILL.cat.md` URL 安装。

## 技能目录结构

```
skill-name/
├── SKILL.cat.md          # 提示词 + YAML frontmatter（name, description, config）
├── scripts/          # Skill 脚本，使用 ==SkillScript== 头部格式（可选）
└── references/       # Agent 上下文参考文档（可选）
```

`scripts/` 目录中的脚本使用 `==SkillScript==` 头部格式声明元数据和参数。Agent 通过 `execute_skill_script` 元工具调用它们，也可以通过 `CAT.agent.skills.call(skillName, scriptName, params?)` 编程式调用。

### 配置字段

Skill 可以在 `SKILL.cat.md` frontmatter 中声明配置字段。用户在 UI 中填写值，脚本通过 `CAT_CONFIG` 访问：

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
// 在 Skill 脚本中：
const key = CAT_CONFIG.API_KEY;
```

完整示例见 [examples/config](./examples/config/)。

## 许可证

GPLv3
