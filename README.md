# ScriptCat Agent Skills

[中文](./README.zh-CN.md)

Skills and examples for [ScriptCat](https://github.com/scriptscat/scriptcat) Agent.

## Skills

| Skill | Description |
|-------|-------------|
| [browser-automation](./browser-automation/) | Page analysis, DOM operations, form filling, screenshots, navigation |
| [scheduled-tasks](./scheduled-tasks/) | Cron-based task scheduling with internal (LLM auto-run) and event (script callback) modes |
| [skill-creator](./skill-creator/) | Helps create, test and package new Skills |

## Standalone CATTools

General-purpose tools that can be installed individually without a Skill. Located in [`cattools/`](./cattools/):

| Tool | Description |
|------|-------------|
| [http_request](./cattools/http_request.js) | Cross-origin HTTP requests (GET/POST/PUT/DELETE) via GM_xmlhttpRequest |
| [run_script](./cattools/run_script.js) | Execute JavaScript in a sandboxed environment for data processing |

Install via `CAT.agent.tools.install(code)` or import in the **Agent → CATTools** page.

## Examples

Code examples for the Agent script API, located in [`examples/`](./examples/):

| Directory | Description |
|-----------|-------------|
| [conversation](./examples/conversation/) | Conversation API — chat, streaming, tool calling |
| [dom](./examples/dom/) | DOM API — page reading, form filling, tab management |
| [tools](./examples/tools/) | CATTool — writing and using custom tools |
| [config](./examples/config/) | Skill Config — declare config fields, access via `CAT_CONFIG` |
| [page_copilot.user.js](./examples/page_copilot.user.js) | Full userscript — right-click AI assistant with streaming UI |

## Installation

Zip a skill directory and import it in ScriptCat extension **Agent → Skills** page.

## Skill Structure

```
skill-name/
├── SKILL.md          # Prompt + YAML frontmatter (name, description, config)
├── scripts/          # CATTool scripts (optional)
└── references/       # Reference docs for Agent context (optional)
```

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
// In CATTool script:
const key = CAT_CONFIG.API_KEY;
```

See [examples/config](./examples/config/) for complete examples.