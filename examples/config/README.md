# Skill Config Examples

Examples demonstrating the **Skill Config** feature — declaring configuration fields in `SKILL.md` frontmatter and accessing them via `CAT_CONFIG` in Skill Script scripts.

## Skills

| Skill | Config Fields | Description |
|-------|--------------|-------------|
| [weather-query](./weather-query/) | API Key (secret), Default City, Units (select) | Query weather via OpenWeatherMap |
| [web-search](./web-search/) | API Key (secret), Max Results (number), Safe Search (switch) | Search the web via SerpAPI |

## How Config Works

### 1. Declare in SKILL.md

```yaml
---
name: my-skill
config:
  API_KEY:
    title: "API Key"
    type: text
    secret: true
    required: true
  MAX_RESULTS:
    title: "Max Results"
    type: number
    default: 10
---
```

### 2. Access in Skill Scripts

```javascript
const apiKey = CAT_CONFIG.API_KEY;
const max = CAT_CONFIG.MAX_RESULTS;
```

### 3. User fills values in UI

After installing the Skill, click the **Config** button on the skill card to fill in values.

## Supported Field Types

| Type | UI Control | Example |
|------|-----------|---------|
| `text` | Input / Password (if `secret: true`) | API keys, URLs |
| `number` | Number input | Limits, counts |
| `select` | Dropdown | `values: [a, b, c]` |
| `switch` | Toggle | Feature flags |

## Field Properties

- `title` — Display label
- `type` — `text` (default), `number`, `select`, `switch`
- `secret` — Mask input (password field)
- `required` — Show required indicator
- `default` — Pre-filled default value
- `values` — Options list (for `select` type)
