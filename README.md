# ScriptCat Agent Skills

[中文](./README.zh-CN.md)

Skills and examples for [ScriptCat](https://github.com/scriptscat/scriptcat) Agent.

## Skills

| Skill | Description |
|-------|-------------|
| [browser-automation](./browser-automation/) | Page analysis, DOM operations, form filling, screenshots, navigation |
| [scheduled-tasks](./scheduled-tasks/) | Cron-based task scheduling with internal (LLM auto-run) and event (script callback) modes |
| [skill-creator](./skill-creator/) | Helps create, test and package new Skills |

## Examples

Code examples for the Agent script API, located in [`examples/`](./examples/):

| Directory | Description |
|-----------|-------------|
| [conversation](./examples/conversation/) | Conversation API — chat, streaming, tool calling |
| [dom](./examples/dom/) | DOM API — page reading, form filling, tab management |
| [config](./examples/config/) | Skill Config — declare config fields, access via `CAT_CONFIG` |
| [page_copilot.user.js](./examples/page_copilot.user.js) | Full userscript — right-click AI assistant with streaming UI |

## Installation

Zip a skill directory and import it in ScriptCat extension **Agent → Skills** page.

## Skill Structure

```
skill-name/
├── SKILL.md          # Prompt + YAML frontmatter (name, description, config)
├── scripts/          # Skill Scripts using ==SkillScript== header format (optional)
└── references/       # Reference docs for Agent context (optional)
```

Scripts in the `scripts/` directory use the `==SkillScript==` header format to declare metadata and parameters. The Agent invokes them via the `execute_skill_script` meta-tool, or programmatically via `CAT.agent.skills.call(skillName, scriptName, params?)`.

### Config Fields

Skills can declare configuration fields in `SKILL.md` frontmatter. Users fill values in the UI, scripts access them via `CAT_CONFIG`:

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