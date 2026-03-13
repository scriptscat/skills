# Existing Skill Examples

## browser-automation — the reference Skill

The most complete Skill in this repo. Study its patterns when writing your own.

### Structure

```
browser-automation/
├── SKILL.md
└── scripts/
    ├── list_tabs.js         # List all open tabs
    ├── navigate.js          # Navigate to URL
    ├── screenshot.js        # Capture screenshot
    ├── scroll.js            # Scroll the page
    ├── wait_for.js          # Wait for element to appear
    ├── browser_action.js    # Sub-agent page analysis (read-only)
    ├── smart_fill.js        # CDP trusted form filling
    └── click_and_wait.js    # CDP trusted click + wait for changes
```

### What makes its SKILL.md good

**1. Opening line sets the context immediately:**

> You now have tools to control the browser. They are split into **primitive tools** (direct single operations) and **compound tools** (multi-step operations with sub-agent analysis).

No preamble, no "this Skill is for..." — it jumps straight into what the Agent can now do. The primitive/compound split gives the Agent a mental model for choosing tools.

**2. Tool table shows input → output, not just descriptions:**

```markdown
| Tool | What it does |
|------|-------------|
| `list_tabs` | List all open tabs → find the `tabId` you need |
| `smart_fill` | Fill a form field with CDP trusted input + auto-verify the value |
| `click_and_wait` | CDP trusted click + wait for page changes (navigation, new tabs, DOM mutations) — sub-agent summarizes what changed |
```

Each row tells the Agent what it *gets back*, not just what the tool does. "CDP trusted input + auto-verify the value" is more useful than "fills a form field".

**3. Workflow uses branching, not a flat list:**

```markdown
1. `list_tabs` → pick the target `tabId`
2. `browser_action` → understand the page, get CSS selectors
3. Act on the selectors:
   - **Form fields** → `smart_fill`
   - **Clicks** → `click_and_wait`
   - **Wait for loading** → `wait_for`
   - **Load more content** → `scroll`
4. `browser_action` → verify the result or analyze the next step
5. Repeat until done
```

Step 3 branches by situation. The Agent knows which tool to pick based on what it needs to do, not just a linear sequence.

**4. Examples are compact and cover diverse scenarios:**

```
→ list_tabs()
← tabId=123 [active] | Google | https://www.google.com

→ browser_action("find the search input and search button selectors", tabId=123)
← "Search input: `textarea[name=q]`, Search button: `input[name=btnK]`"

→ smart_fill("textarea[name=q]", "ScriptCat", tabId=123)
← { success: true, value: "ScriptCat" }
```

The `→`/`←` notation is dense and readable. Each example shows a different scenario (search, navigation, scrolling, popups, data extraction, new tabs) — the Agent can pattern-match to the user's actual task.

**5. Tips section teaches *how to think*, not just rules:**

> The `scenario` parameter should be **specific and goal-oriented**:
> - Good: "find the login form's username input, password input, and submit button selectors"
> - Bad: "analyze this page" — too vague, the sub-agent won't know what to look for

Good/bad examples are more effective than abstract rules. The Agent learns what "specific and goal-oriented" means from the contrast.

**6. Caveats are practical, not theoretical:**

> **Popup blocking**: Some clicks open new windows/tabs. If the expected new tab doesn't appear, tell the user to go to the site's address bar → Site settings → allow "Pop-ups and redirects", then retry.

This tells the Agent what to do when something goes wrong — it doesn't just list limitations, it gives recovery actions.

### Description analysis

```yaml
description: Browser automation — analyze pages with a sub-agent, then perform DOM operations (click, fill, navigate, screenshot, scroll)
```

- Sentence 1: core capability (browser automation with sub-agent analysis)
- Lists 5 concrete action keywords as trigger cues
- ~25 words — slightly under the 30-80 range, but works because the keywords are specific enough

## Design patterns

### Prompt-only Skill

For guiding LLM behavior without tool scripts — translation, writing style, code standards:

```
translator/
└── SKILL.md
```

Example SKILL.md body:
```markdown
---
name: translator
description: Translate text between languages with attention to context, idioms, and tone. Use when the user asks to translate content, localize text, or needs multilingual output.
---

# Translator

Translate the user's text while preserving:
- **Meaning**: convey the intent, not literal word-for-word translation
- **Tone**: formal/casual/technical should match the source
- **Format**: keep markdown, code blocks, and structure intact

## Workflow
1. Detect the source language (or ask if ambiguous)
2. Ask for target language if not specified
3. Translate, then briefly note any idioms or cultural references you adapted
```

No tools needed — the Skill is purely about shaping how the Agent responds.

### Tool-set Skill

For providing a group of related tools:

```
web-scraper/
├── SKILL.md
└── scripts/
    ├── fetch_content.js
    ├── parse_html.js
    └── extract_links.js
```

The SKILL.md should describe when to use each tool and how they compose:
```markdown
## Tools
| Tool | Input → Output |
|------|----------------|
| `fetch_content` | url → { html, status, headers } |
| `parse_html` | html + selector → { elements[] } |
| `extract_links` | html → { links[{ text, href }] } |

## Workflow
1. `fetch_content` to get the raw HTML
2. If user wants specific elements → `parse_html` with a CSS selector
3. If user wants all links → `extract_links`
4. Return structured data, not raw HTML
```

### Skill with references

For scenarios requiring large external knowledge:

```
api-helper/
├── SKILL.md
├── scripts/
│   └── call_api.js
└── references/
    ├── endpoints.md
    └── auth_guide.md
```

In SKILL.md, give explicit triggers for each reference:
```markdown
When the user asks about authentication or gets a 401 error, use read_reference to load `auth_guide.md`.
For the full list of available endpoints, use read_reference to load `endpoints.md`.
```

Don't just say "see references/" — state the exact condition that should prompt reading each file.

## Key takeaways

1. **SKILL.md is a prompt, not documentation** — write as instructions for the Agent ("You now have tools to..."), not as a reference for humans ("This Skill provides...")
2. **Description triggers everything** — 30-80 words, specific keywords, list trigger scenarios
3. **Tools should be self-contained** — each CATTool declares its own @grant and works independently
4. **Show input → output in tool tables** — don't just repeat @description
5. **Branch in workflows** — real tasks have conditions; a flat numbered list isn't enough
6. **Examples teach better than rules** — `→`/`←` compact format, cover diverse scenarios
7. **Caveats should include recovery actions** — "if X happens, do Y", not just "X might happen"
8. **Use references for bulk content** — keep SKILL.md under 500 lines, push large docs to references/ with explicit read conditions
