# ScriptCat Agent Skills

[中文](./README.zh-CN.md)

Skills and examples for [ScriptCat](https://github.com/scriptscat/scriptcat) Agent.

## Skills

| Skill | Description | Install |
|-------|-------------|---------|
| [browser-automation](./browser-automation/) | Page analysis, DOM operations, form filling, screenshots, navigation | [Install](https://raw.githubusercontent.com/scriptscat/skills/main/browser-automation/SKILL.cat.md) |
| [scheduled-tasks](./scheduled-tasks/) | Cron-based task scheduling with internal (LLM auto-run) and event (script callback) modes | [Install](https://raw.githubusercontent.com/scriptscat/skills/main/scheduled-tasks/SKILL.cat.md) |
| [skill-creator](./skill-creator/) | Helps create, test and package new Skills | [Install](https://raw.githubusercontent.com/scriptscat/skills/main/skill-creator/SKILL.cat.md) |
| [file-parser](./file-parser/) | Parse common file formats (Excel, PDF, Word, CSV, PPT), extract text and structured data | [Install](https://raw.githubusercontent.com/scriptscat/skills/main/file-parser/SKILL.cat.md) |
| [scriptcat-dev](./scriptcat-dev/) | UserScript development assistant — write, debug and optimize user scripts | [Install](https://raw.githubusercontent.com/scriptscat/skills/main/scriptcat-dev/SKILL.cat.md) |
| [synology-office-sheet](./synology-office-sheet/) | Read and write Synology Office spreadsheet cells | [Install](https://raw.githubusercontent.com/scriptscat/skills/main/synology-office-sheet/SKILL.cat.md) |
| [wechat-publisher](./wechat-publisher/) | WeChat Official Account assistant — content collection, writing, image generation and publishing | [Install](https://raw.githubusercontent.com/scriptscat/skills/main/wechat-publisher/SKILL.cat.md) |
| [xiaohongshu-publisher](./xiaohongshu-publisher/) | Xiaohongshu (RED) assistant — note writing, style learning, image generation and publishing | [Install](https://raw.githubusercontent.com/scriptscat/skills/main/xiaohongshu-publisher/SKILL.cat.md) |

## Examples

Code examples for the Agent script API, located in [`examples/`](./examples/):

| Directory | Description |
|-----------|-------------|
| [conversation](./examples/conversation/) | Conversation API — chat, streaming, tool calling |
| [dom](./examples/dom/) | DOM API — page reading, form filling, tab management |
| [config](./examples/config/) | Skill Config — declare config fields, access via `CAT_CONFIG` |
| [page_copilot.user.js](./examples/page_copilot.user.js) | Full userscript — right-click AI assistant with streaming UI |

## Installation

Open the `SKILL.cat.md` URL in your browser, and ScriptCat will prompt to install the skill. You can also paste a `SKILL.cat.md` URL in the **Agent → Skills** page.

## Skill Structure

```
skill-name/
├── SKILL.cat.md          # Prompt + YAML frontmatter (name, description, config)
├── scripts/          # Skill Scripts using ==SkillScript== header format (optional)
└── references/       # Reference docs for Agent context (optional)
```

Scripts in the `scripts/` directory use the `==SkillScript==` header format to declare metadata and parameters. The Agent invokes them via the `execute_skill_script` meta-tool, or programmatically via `CAT.agent.skills.call(skillName, scriptName, params?)`.

### Config Fields

Skills can declare configuration fields in `SKILL.cat.md` frontmatter. Users fill values in the UI, scripts access them via `CAT_CONFIG`:

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
// In a Skill Script:
const key = CAT_CONFIG.API_KEY;
```

See [examples/config](./examples/config/) for complete examples.