---
name: scriptcat-skill-creator
description: Create and improve ScriptCat Agent Skills. Use when the user wants to create a new Skill, write Skill Scripts, improve an existing Skill, or package a Skill for distribution. Also applies when the user says things like "make a tool that does X", "build an Agent plugin", "automate XX with a Skill", or wants to extend the Agent's capabilities.
references:
  - scriptcat.d.ts
  - skill-examples.md
  - skill-script-api.md
---

# ScriptCat Skill Creator

You create, improve, and package Skills for the ScriptCat Agent. A Skill extends what the Agent can do.

## Core concepts

**Skill = SKILL.cat.md (prompt + metadata) + optional scripts/ (Skill Scripts) + optional references/ (on-demand docs)**

Loading sequence: Agent sees each Skill's `name` + `description` → decides to call `load_skill(name)` → SKILL.cat.md body injected → scripts listed → `execute_skill_script` invokes scripts → `read_reference` loads docs on demand.

Read `references/scriptcat.d.ts` for full type definitions of all CAT APIs.

### Agent built-in tools

Don't create Skill Scripts that duplicate these — design Skills that complement them.

| Tool | What it does |
|------|-------------|
| `web_fetch` | Fetch URL + LLM extraction (text only, requires `prompt`) |
| `web_search` | Web search → title/URL/snippet results |
| `get_tab_content` | Read tab content + LLM extraction (requires `prompt`) |
| `list_tabs` | List open tabs (filterable) |
| `open_tab` / `close_tab` / `activate_tab` | Tab management |
| `execute_script` | Run JS in page tab (MAIN world, 30s timeout) or sandbox |
| `opfs_write` / `opfs_read` / `opfs_list` / `opfs_delete` | Workspace files. `opfs_read` returns blob URL only; use `CAT.agent.opfs.read` in Skill Scripts for text |
| `ask_user` | Ask user a question (free text or structured choices) |
| `agent` | Spawn sub-agent (no ask_user, no nesting) |
| `create_task` / `update_task` / `list_tasks` | Task tracking |
| `load_skill` / `execute_skill_script` / `read_reference` | Skill meta-tools |

### When to create a Skill Script (vs using built-in tools)

Create a Skill Script **only** when:
- Built-in tools can't do it — cross-origin HTTP (`GM_xmlhttpRequest`), binary downloads, persistent key-value storage (`GM.getValue`)
- You need `@grant` permissions — `CAT.agent.dom` (screenshots, trusted click/fill), `CAT.agent.conversation` (sub-agents), `CAT.agent.task` (scheduled tasks)
- Complex logic needs encapsulation — error-prone as raw `execute_script`, or reused across multiple Agent turns

**Don't** create scripts for: page reading (use `get_tab_content`), web search (use `web_search` → `web_fetch`), simple JS execution (use `execute_script`), tab management (use built-in tools).

## Creating a new Skill

### Step 1: Interview

Before writing anything, understand what the user actually needs. Use `ask_user` to clarify ambiguities — it supports structured choices (single/multi-select) which are much better than open-ended questions for narrowing down options.

If the user's request is already specific (clear problem, scope, and capabilities), confirm your understanding in one sentence and go straight to Step 2. Don't ask questions you already know the answer to.

Otherwise, clarify:

- **The problem**: What should this Skill help with? What's the typical scenario?
- **Scope**: Is it a prompt-only Skill (translation, writing style) or does it need tool scripts?
- **Capabilities needed**: DOM access? HTTP requests? Screenshots? Scheduled tasks? Storage?
- **Target audience**: Will other people install this, or is it personal use?

Don't assume — a user saying "make a translation tool" might want a prompt-only Skill that guides the LLM's translation style, or a Skill Script that calls a translation API, or a full Skill that reads pages and translates in-place. Ask when it's ambiguous.

### Step 2: Design

Decide the structure based on the interview:

```
skill-name/
├── SKILL.cat.md              # Required: prompt + metadata
├── scripts/              # Optional: Skill Scripts (.js)
└── references/           # Optional: large docs, loaded on demand
```

**When to use each component:**
- **SKILL.cat.md only** — the Skill is about guiding LLM behavior (translation style, code review rules)
- **+ scripts/** — the Skill needs to do things (fetch data, manipulate DOM, call APIs) via Skill Scripts
- **+ references/** — there's too much reference material for SKILL.cat.md (>500 lines), or docs that are only needed sometimes

Share your proposed structure with the user before writing code.

### Step 3: Write SKILL.cat.md

The SKILL.cat.md is a **prompt for the LLM**, not documentation for humans. Write it as instructions that tell the Agent what to do, not as a reference manual.

#### Frontmatter

```yaml
---
name: skill-name          # Required, english kebab-case
description: ...          # Required, the trigger mechanism (see below)
config:                   # Optional: user-configurable fields (see below)
  FIELD_NAME:
    title: "Display Label"
    type: text|number|select|switch
---
```

#### Config fields (optional)

If the Skill needs user-provided credentials, preferences, or settings, declare them in the `config` block. Users fill these in through the Skill settings UI; Skill Scripts access them via the `CAT_CONFIG` global.

**Supported types:**

| Type | UI Control | Example use |
|------|-----------|-------------|
| `text` | Input (or password if `secret: true`) | API keys, URLs |
| `number` | Number input | Limits, thresholds |
| `select` | Dropdown (`values: [...]` required) | Units, modes |
| `switch` | Toggle | Feature flags |

**Field properties:** `title` (display label), `type` (required), `secret` (mask input), `required` (show indicator), `default` (pre-filled value), `values` (options for `select`).

**Example:**
```yaml
config:
  API_KEY:
    title: "API Key"
    type: text
    secret: true
    required: true
  AUTO_PUBLISH:
    title: "Auto-publish after creation"
    type: switch
    default: false
  OUTPUT_FORMAT:
    title: "Output Format"
    type: select
    values: [json, csv, markdown]
    default: json
```

**Reading config in scripts:** `CAT_CONFIG` is a frozen read-only object. Always validate required fields:
```js
if (!CAT_CONFIG.API_KEY) return { error: "API_KEY not configured. Set it in Skills → Config." };
```

**Config vs `GM.getValue`:** Config = install-time settings with UI form (API keys, preferences). `GM.getValue` = runtime read/write (caches, session state, accumulated data).

#### Writing the description

The description is the **sole trigger mechanism** — it's the only thing the Agent sees before deciding to load the Skill. Aim for 1-3 sentences, 30-80 words:

- **Sentence 1**: What the Skill does (the core capability)
- **Sentence 2-3**: When to use it — list 3-5 trigger scenarios or keywords

**Good** (specific, actionable, right length):
```yaml
description: Browser automation — analyze pages with a sub-agent, then perform DOM operations (click, fill, navigate, screenshot, scroll). Use when the user wants to interact with web pages, fill forms, extract data, or automate browser tasks.
```

**Bad** (too vague, no trigger cues):
```yaml
description: A browser tool
```

**Bad** (too broad, will false-trigger on everything):
```yaml
description: Help the user with any task involving websites, data, automation, or information retrieval.
```

#### Writing the prompt body

The body should tell the Agent *how to act*, not explain concepts. Good patterns:

- **Tool table**: list each tool with what it takes as input and what it returns — don't just repeat the @description
  ```markdown
  | Tool | Input → Output |
  |------|----------------|
  | `fetch_price` | url → { price, currency, title } |
  | `compare` | urls[] → { cheapest, comparison_table } |
  ```

- **Workflow with branching**: numbered steps, with clear conditions for different paths
  ```markdown
  1. `list_tabs` → pick the target tab
  2. `read_page` → understand the page
  3. If the user wants to fill a form → use `smart_fill` for each field
  4. If the user wants to extract data → use `read_page` with a specific selector
  ```

- **Compact examples**: use `→` / `←` notation, show the actual tool calls
  ```markdown
  **Search scenario:**
  → smart_fill("input[name=q]", "ScriptCat", tabId=123)
  ← { success: true, value: "ScriptCat" }
  → click_and_wait("input[type=submit]", tabId=123)
  ← { clicked: true, navigated: true, url: "https://..." }
  ```

- **Reference pointers**: if references/ exist, state the exact condition to read each one
  ```markdown
  When the user asks about a site not in the known list, use read_reference to load `supported_sites.md`.
  ```

- **Pipeline with phases**: for multi-step workflows (publishing, data processing), use numbered phases with `ask_user` at transitions. Each phase should be skippable:
  ```markdown
  ## Pipeline
  1. Login → 2. Collect Materials → 3. Style Learning (optional) → 4. Create Content → 5. Publish

  Use `ask_user` before each phase to confirm intent (allow skipping). Use `create_task` to track progress.
  ```

Keep the body under 500 lines. The `browser-automation` and publisher Skills in `references/skill-examples.md` are good references for structure and tone.

### Step 4: Write Skill Scripts

Skill Scripts are JS files in `scripts/` with a `==SkillScript==` metadata header. Read `references/skill-script-api.md` for the full spec.

Key facts:
- Runs in ScriptCat Sandbox with **300-second (5-minute) timeout**
- Parameters via `args` object, results via `return` (auto JSON-serialized)
- Top-level `await` supported
- Full GM API + CAT API access via `@grant` (independent auth, not inherited)
- `@require` for external libs (cached on install)
- Types: `string` / `number` / `boolean` only — no object/array nesting
- Invoked via the `execute_skill_script` meta-tool (takes `skill`, `script`, `params`) or programmatically via `CAT.agent.skills.call(skillName, scriptName, params?)`
- Supports returning **attachments** (images/files/audio) — return `{ content: "text for LLM", attachments: [{ type, name, mimeType, data }] }`. See `skill-script-api.md` for details

#### Examples

**HTTP request — cross-origin fetch with `GM_xmlhttpRequest`:**
```js
// ==SkillScript==
// @name         fetch_page_title
// @description  Fetch a URL and extract the page title. Returns { title, url }
// @param        url  string  [required]  Target URL
// @grant        GM_xmlhttpRequest
// ==/SkillScript==

const { url } = args;
const resp = await GM.xmlHttpRequest({ url, method: "GET" });
const match = resp.responseText.match(/<title>(.*?)<\/title>/i);
return { title: match ? match[1] : "No title found", url };
```

**Returning attachments — screenshot example:**
```js
// ==SkillScript==
// @name         take_screenshot
// @description  Capture a screenshot of the current tab. Returns the image as an attachment
// @grant        CAT.agent.dom
// ==/SkillScript==

const result = await CAT.agent.dom.screenshot();
return {
  content: "Screenshot captured.",
  attachments: [{
    type: "image",
    name: "screenshot.jpg",
    mimeType: "image/jpeg",
    data: result.dataUrl  // base64 data-URL string
  }]
};
```

**Sub-agent conversation — scoped to current Skill:**
```js
// ==SkillScript==
// @name         generate_code
// @description  Generate code using a sub-agent that has access to this Skill's references
// @param        spec  string  [required]  What to generate
// @grant        CAT.agent.conversation
// ==/SkillScript==

const { spec } = args;
const conv = await CAT.agent.conversation.create({
  system: "You are a code generator. Use read_reference to look up API details when needed.",
  ephemeral: true,              // Memory-only, not persisted to storage
  skills: ["my-skill-name"],    // Only load this Skill — sub-agent gets its scripts + references
});
const reply = await conv.chat(spec);
return { content: typeof reply.content === "string" ? reply.content : reply.content.map(b => b.text || "").join("") };
```

> **Tip:** `ephemeral: true` makes the conversation memory-only (not persisted), and `skills` controls which Skills the sub-agent can access. Use both together: `ephemeral: true` + `skills: ["current-skill-name"]` gives the sub-agent a lightweight, non-persisted conversation with access to just this Skill's `read_reference` and Skill Scripts. `skills` accepts `"auto"` (all installed Skills) or `string[]` (specific names).

**Programmatic invocation — calling another Skill's script:**
```js
// ==SkillScript==
// @name         enhanced_search
// @description  Search using another Skill's script
// @param        query  string  [required]  Search query
// @grant        CAT.agent.skills
// ==/SkillScript==

const { query } = args;
const result = await CAT.agent.skills.call("web-scraper", "fetch_content", { url: `https://search.example.com?q=${encodeURIComponent(query)}` });
return result;
```

**Multi-action script — the dominant architecture pattern:**

Most real Skills combine related operations into a single script using an enum `action` parameter. This is the most common pattern across existing Skills (editor, login, manage_styles, etc.).

```js
// ==SkillScript==
// @name         editor
// @description  Explore or inject content into the editor. explore=DOM structure, inject=write title/body
// @param        tabId    number                   [required]  Target tab ID
// @param        action   string[explore,inject]   [required]  Operation to perform
// @param        title    string                               Article title (inject only)
// @param        content  string                               Body content (inject only)
// @grant        CAT.agent.dom
// @timeout      60000
// ==/SkillScript==

const { tabId, action } = args;

// CRITICAL: executeScript returns {result, tabId} wrapper — always unwrap
const unwrap = (v) =>
  v && typeof v === 'object' && 'result' in v ? v.result : v;

if (action === 'explore') {
  return unwrap(await CAT.agent.dom.executeScript(`
    return {
      title: document.querySelector('#title')?.value || '',
      editor: !!document.querySelector('[contenteditable="true"]'),
      buttons: Array.from(document.querySelectorAll('button'))
        .map(b => ({ text: b.textContent.trim(), disabled: b.disabled }))
        .filter(b => b.text.length < 20)
    };
  `, { tabId }));
}

if (action === 'inject') {
  if (!args.title && !args.content) return { error: 'Need title or content' };
  // ... inject logic (fill fields, paste into editor, etc.)
  return { title: true, content: true, errors: [] };
}

return { error: `Invalid action: ${action}, expected: explore, inject` };
```

> **Key conventions in this pattern:**
> - `@param action string[val1,val2,...]` — enum syntax restricts values; the LLM sees valid options
> - `unwrap()` — `executeScript` returns `{ result, tabId }` wrapper, not the raw value. This is the **#1 gotcha** for new Skill authors
> - Each action validates its own params and returns structured results
> - Always end with a default `return { error: ... }` for invalid actions

#### Common pitfalls

- Never hardcode API keys or secrets — use `config` frontmatter fields (accessed via `CAT_CONFIG`) for install-time credentials, or `GM.getValue` for runtime-managed secrets
- Don't return raw full-page HTML — extract and return only the relevant data to save tokens
- Don't build one mega-script with many params — split into focused single-responsibility scripts (but DO combine related operations using the multi-action `action` enum pattern — one script per domain object is fine, e.g. `editor` with explore/inject/upload_cover actions)
- Don't ignore errors — catch exceptions and return `{ error: "meaningful message" }` so the LLM can react
- **`executeScript` always needs unwrap** — `CAT.agent.dom.executeScript()` returns `{ result, tabId }`, not the raw value. Define `const unwrap = (v) => v && typeof v === 'object' && 'result' in v ? v.result : v;` at the top of every script that uses `executeScript`
- **Attachment content field**: when a script returns attachments (files, images), the LLM **cannot see** the attachment contents — it only sees the `content` text field. So `content` must explicitly state what was generated and instruct the LLM not to regenerate it. Example: `content: "Code generation complete. Generated 1 script (attached). Do NOT rewrite the code."`
- **Leaking tabs** — if a Skill Script opens or navigates to a tab (via `CAT.agent.dom.navigate` or `open_tab`) for an intermediate operation, close it when done. Either close it inside the script itself, or instruct the Agent in SKILL.cat.md to `close_tab` after processing the result. Forgetting this leads to tab buildup that confuses the user and wastes resources
- **OPFS path conventions** — use `{skill-name}/{category}/{filename}` for organized storage (e.g. `wechat-publisher/styles/writing/profile.json`). Sanitize user-provided names: `name.replace(/[\/\\:*?"<>|]/g, '_')`
- **`ask_user` before irreversible actions** — publishing, deleting, sending. Explicitly warn the user in the `ask_user` message (e.g. "⚠️ 发布后不可撤回"). Some platforms have no confirmation dialog — the action is instant
- **Large string injection** — `executeScript` has a string size limit for inline code. For large content (>30KB HTML), use chunked injection via a hidden textarea. See `skill-script-api.md` → Common Patterns for the technique

### Step 5: Verify

After writing all files, do a self-review:

1. **Description check**: Read just the name + description. Is it 30-80 words? Would it trigger on the right prompts and NOT trigger on unrelated ones?
2. **Prompt check**: Read the SKILL.cat.md body as if you were the Agent seeing it for the first time. Are the instructions actionable? Can you follow the workflow without ambiguity?
3. **Script check**: For each Skill Script, verify:
   - `@description` explains what it takes and what it returns
   - All required params are marked `[required]`
   - `@grant` lists all needed permissions
   - Return value is structured (object, not raw string)
   - No hardcoded secrets (use `config` frontmatter or `GM.getValue` instead)
4. **Config check** (if applicable): Each `config` field has `title` and `type`; `select` fields have `values`; sensitive fields use `secret: true`; Skill Scripts check required config and return clear errors when missing
5. **Naming check**: Script names in SKILL.cat.md match the `@name` in scripts (the Agent invokes them via `execute_skill_script` with the skill and script name)

Present the complete Skill to the user for review before finalizing.

#### Testing in ScriptCat

Tell the user how to test the Skill before distributing:

1. **Quick-install**: open the SKILL.cat.md URL in ScriptCat, or paste the URL in Agent → Skills → Import from URL
2. **Smoke test**: open the Agent chat, type a prompt that should trigger the Skill, verify it loads (the Agent will call `load_skill`)
3. **Script test**: for each Skill Script, craft a prompt that makes the Agent call it. Check:
   - Does the tool return the expected structure?
   - Do error cases return `{ error: "..." }` instead of throwing?
   - Does the Agent use the return value correctly in its response?
4. **Negative test**: type a prompt that should NOT trigger the Skill — verify it stays unloaded
5. **Debug**: if a tool fails, check the ScriptCat background page console (right-click extension icon → Inspect) for errors. Common issues: missing `@grant`, wrong `CAT_CONFIG` field name, timeout on slow APIs

### Step 6: Deliver

Output:
1. All files with complete content
2. In Claude Code: write files directly to the target directory
3. Brief install instructions: open the SKILL.cat.md URL in browser, or paste the URL in ScriptCat → Agent → Skills

If the user wants to iterate, go back to the relevant step. Don't rewrite everything — make targeted edits.

## Improving an existing Skill

### 1. Read first
Read the existing SKILL.cat.md and all scripts/ before suggesting changes.

### 2. Diagnose & fix

Identify the problem category, then apply targeted fixes:

| Problem | Diagnosis | Fix |
|---------|-----------|-----|
| Skill doesn't trigger | Description too vague or missing keywords | Rewrite description (30-80 words, add trigger phrases) |
| Skill false-triggers | Description too broad | Narrow scope, remove generic keywords |
| Agent ignores workflow | SKILL.cat.md instructions unclear | Add branching logic, examples, explicit tool references |
| Script returns wrong data | Logic error or bad return structure | Fix script, verify `@param` matches SKILL.cat.md docs |
| Missing capability | No script for the operation | Add new Skill Script or reference |
| Built-in overlap | Script duplicates `web_fetch`, `list_tabs`, etc. | Remove script, reference built-in tool in SKILL.cat.md |
| SKILL.cat.md too long | Over 500 lines | Move large docs to `references/` with explicit read conditions |
| Tab leakage | Missing `close_tab` after intermediate ops | Add tab cleanup instructions to SKILL.cat.md |

### 3. Targeted edits
Fix only what's broken — don't rewrite the entire Skill when a description tweak or one script fix solves the problem. Show the user before/after of what you changed and why.

## Reference files

Load on demand — don't read all upfront. Don't dump their content into the Skill you're creating.

| Reference | When to read |
|-----------|-------------|
| `scriptcat.d.ts` | Need exact API signatures for `CAT.agent.*` or `CAT_CONFIG` — authoritative type definitions |
| `skill-script-api.md` | Writing Skill Scripts — metadata syntax (`@param`, `@grant`), return formats, GM APIs, **Common Patterns** (unwrap, chunked injection, file upload, retry/polling, multi-action, PasteHTML, React inputs) |
| `skill-examples.md` | Structuring a SKILL.cat.md prompt — analysis of `browser-automation` (tool-set), publisher Skills (pipeline), `file-parser` (dispatch), plus design pattern templates |
