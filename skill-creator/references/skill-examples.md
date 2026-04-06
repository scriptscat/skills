# Existing Skill Examples

## browser-automation — the reference Skill

The most complete Skill in this repo. Study its patterns when writing your own.

### Structure

```
browser-automation/
├── SKILL.cat.md
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

### What makes its SKILL.cat.md good

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
└── SKILL.cat.md
```

Example SKILL.cat.md body:
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
├── SKILL.cat.md
└── scripts/
    ├── fetch_content.js
    ├── parse_html.js
    └── extract_links.js
```

The SKILL.cat.md should describe when to use each tool and how they compose:
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
├── SKILL.cat.md
├── scripts/
│   └── call_api.js
└── references/
    ├── endpoints.md
    └── auth_guide.md
```

In SKILL.cat.md, give explicit triggers for each reference:
```markdown
When the user asks about authentication or gets a 401 error, use read_reference to load `auth_guide.md`.
For the full list of available endpoints, use read_reference to load `endpoints.md`.
```

Don't just say "see references/" — state the exact condition that should prompt reading each file.

## wechat-publisher / xiaohongshu-publisher — the pipeline pattern

Both publisher Skills follow the same multi-phase pipeline architecture, adapted per platform.

### Structure

```
wechat-publisher/
├── SKILL.cat.md
├── scripts/
│   ├── login.js           # Check status / wait for QR login
│   ├── editor.js          # Explore / inject / upload_cover
│   ├── extract_articles.js # Fetch article list and content
│   ├── extract_styles.js  # Parse inline styles from HTML
│   ├── manage_styles.js   # CRUD for style profiles in OPFS
│   └── generate_image.js  # Generate cover/illustrations
└── references/
    ├── platform_guide.md           # Fallback selectors, DOM quirks
    └── style_analysis_template.md  # Analysis dimensions for style learning
```

### What makes the pipeline pattern good

**1. Numbered phases with skip points:**

```
1. Login → 2. Materials → 3. Style Learning (optional) → 4. Content Creation → 5. Publish
```

Each phase starts with `ask_user` to confirm or skip. The user stays in control without micromanaging. `create_task` tracks progress across phases.

**2. Multi-action scripts reduce tool count:**

Instead of 6 separate scripts for explore, inject, upload_cover, etc., one `editor` script with `action` enum handles all editor operations. The LLM sees one tool with clear action choices, not a dozen similar-sounding tools.

**3. Login pattern is reusable across platforms:**

Both publishers use the same login architecture:
- `action=check` → detect status via selectors → screenshot QR if not logged in
- `action=wait` → poll every 3s until login or timeout (120s)

The only difference is the selectors and platform URL.

**4. Style management separates writing from layout:**

WeChat needs both writing style (tone, structure) and layout style (HTML templates, colors). Xiaohongshu only needs writing style (plain text platform). The same `manage_styles` CRUD pattern works for both — just different `type` values.

**5. Safety gates before irreversible actions:**

```markdown
- ⚠️ Publishing is irreversible — **explicitly warn the user** in `ask_user`
- ⚠️ Xiaohongshu publish is INSTANT — no confirmation dialog!
```

The SKILL.cat.md doesn't just say "be careful" — it specifies exactly when to warn and what the risk is.

**6. OPFS anti-pattern called out explicitly:**

```markdown
⚠️ **禁止 opfs_write → opfs_read 中转模式**：素材文本内容已在对话上下文中...
```

This prevents a common mistake where text data is written to OPFS then read back (which only returns a blob URL).

### When to use the pipeline pattern

- Multi-step workflows with distinct phases (login → collect → create → publish)
- Workflows where each phase can succeed or fail independently
- Tasks that need user confirmation at key decision points
- Cross-platform Skills that share the same pipeline structure but differ in platform specifics

## file-parser — the dispatch pattern

A simpler pattern for Skills that provide format-specific processing.

### Structure

```
file-parser/
├── SKILL.cat.md
└── scripts/
    ├── parse_excel.js   # .xlsx/.xls → JSON rows
    ├── parse_pdf.js     # .pdf → per-page text
    ├── parse_word.js    # .docx → text/HTML
    ├── parse_csv.js     # .csv/.tsv → JSON rows
    └── parse_pptx.js    # .pptx → per-slide text
```

### What makes the dispatch pattern good

**1. SKILL.cat.md is a routing table:**

```markdown
| Format | Extension | Script | Output |
|--------|-----------|--------|--------|
| Excel  | .xlsx/.xls | `parse_excel` | JSON row arrays |
| PDF    | .pdf | `parse_pdf` | Per-page text + metadata |
```

The Agent can pattern-match file type → script name instantly.

**2. Dual input support:**

All scripts accept either `attachmentId` (from user upload FileBlock) or `filePath` (from OPFS). Priority: `attachmentId` first (no extra storage step needed).

**3. Truncation with flags:**

```markdown
- Table data: default max 200 rows (configurable via `maxRows`)
- If data exceeds limits, `truncated: true` flag is set
```

The Agent knows when it has partial data and can ask the user if they need more.

**4. No over-engineering:**

Each script does one thing — parse a format. No multi-action pattern needed because the operations don't share logic. The dispatch happens in SKILL.cat.md (the Agent picks the right script), not in code.

### When to use the dispatch pattern

- Format/type-specific processing (file parsing, API integrations per service)
- Each operation is independent with no shared state
- The routing logic is simple enough for the LLM to handle via the SKILL.cat.md table

## Key takeaways

1. **SKILL.cat.md is a prompt, not documentation** — write as instructions for the Agent ("You now have tools to..."), not as a reference for humans ("This Skill provides...")
2. **Description triggers everything** — 30-80 words, specific keywords, list trigger scenarios
3. **Scripts should be self-contained** — each Skill Script declares its own @grant and works independently
4. **Show input → output in tool tables** — don't just repeat @description
5. **Branch in workflows** — real tasks have conditions; a flat numbered list isn't enough
6. **Examples teach better than rules** — `→`/`←` compact format, cover diverse scenarios
7. **Caveats should include recovery actions** — "if X happens, do Y", not just "X might happen"
8. **Use references for bulk content** — keep SKILL.cat.md under 500 lines, push large docs to references/ with explicit read conditions
9. **Choose the right pattern** — pipeline for multi-phase workflows, dispatch for format-specific routing, tool-set for related operations on the same domain
