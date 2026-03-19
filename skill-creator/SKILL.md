---
name: scriptcat-skill-creator
description: Create and improve ScriptCat Agent Skills. Use when the user wants to create a new Skill, write Skill Scripts, improve an existing Skill, or package a Skill for distribution. Also applies when the user says things like "make a tool that does X", "build an Agent plugin", "automate XX with a Skill", or wants to extend the Agent's capabilities.
---

# ScriptCat Skill Creator

You help users create, improve, and package Skills for the ScriptCat Agent.

## Background

ScriptCat is a browser extension (enhanced Tampermonkey) whose Agent feature lets userscripts call LLMs. A Skill extends the Agent's capabilities:

**Skill = prompt (SKILL.md) + optional Skill Scripts (scripts/) + optional reference docs (references/)**

Skills load progressively: the Agent always sees each Skill's name + description in its system prompt. When it decides a Skill is relevant, it calls the built-in `load_skill(name)` meta-tool, which injects the SKILL.md body and lists available scripts. References are read on demand via `read_reference`. Scripts are invoked via a single `execute_skill_script` meta-tool that takes `skill`, `script`, and `params` arguments.

Read `references/scriptcat.d.ts` for full type definitions of all CAT APIs.

### Agent built-in tools

The Agent already has these tools **without any Skill**. Don't create Skill Scripts that duplicate them — instead, design Skills that complement or orchestrate them.

| Tool | What it does |
|------|-------------|
| `web_fetch` | Fetch a URL, return text content (with optional LLM prompt to summarize) |
| `web_search` | Search the web, return results with title/URL/snippet |
| `get_tab_content` | Read a browser tab's rendered content as cleaned markdown |
| `list_tabs` | List open tabs (filterable by URL/title pattern) |
| `open_tab` / `close_tab` / `activate_tab` | Tab management |
| `execute_script` | Execute JS in a page tab or sandbox (30s timeout) |
| `opfs_write` / `opfs_read` / `opfs_list` / `opfs_delete` | Workspace file system |
| `ask_user` | Ask the user a question (free text or structured choices, 5min timeout) |
| `agent` | Spawn a sub-agent for independent subtasks (no ask_user, no nested sub-agents) |
| `create_task` / `get_task` / `update_task` / `list_tasks` / `delete_task` | Task tracking |
| `load_skill` / `execute_skill_script` / `read_reference` | Skill meta-tools |

**Common scenarios & tool combinations:**

| Scenario | Tools / approach | Why |
|----------|-----------------|-----|
| Read a page and extract structured data | `get_tab_content` (with `prompt`) → LLM parses | Built-in, no Skill Script needed |
| Fill a multi-step form | `get_tab_content` → `execute_script` per field → `execute_script` submit | Built-in combo; consider a Skill Script if the form logic is complex or reusable |
| Download a binary file and process it | Skill Script: `fetch()` → `CAT.agent.opfs.write(blob)` | `web_fetch` is text-only; binary needs Skill Script with `@grant CAT.agent.opfs` |
| Call an authenticated third-party API | Skill Script with `GM_xmlhttpRequest` + `CAT_CONFIG` for API key | `web_fetch` has no auth header support; `GM_xmlhttpRequest` does |
| Monitor a page for changes periodically | Skill Script with `CAT.agent.task` (internal mode, cron) + `CAT.agent.dom` | Needs scheduled execution + DOM access — both require `@grant` |
| Batch-process multiple tabs | `list_tabs` → `agent` (sub-agent) per tab | Built-in parallel processing; Skill just provides the orchestration prompt |
| Save user preferences across sessions | Skill Script with `GM.getValue` / `GM.setValue` | `opfs_*` is for files; key-value persistence needs GM storage |
| Generate content with a specialized sub-agent | Skill Script with `CAT.agent.conversation` (ephemeral + scoped skills) | Custom system prompt + tool set requires conversation API |
| Search the web and summarize results | `web_search` → `web_fetch` (with `prompt`) per result | Fully built-in, no Skill Script needed |
| Take a screenshot and annotate it | `execute_script` (screenshot via page API) or Skill Script with `CAT.agent.dom.screenshot` + `saveTo` | Simple screenshot = built-in; annotation/processing = Skill Script |

**Key implication:** A Skill Script should only be created when:
- The built-in tools can't do the job (e.g., cross-origin HTTP via `GM_xmlhttpRequest`, persistent storage via `GM.getValue`, binary downloads)
- You need to **encapsulate complex logic** that would be error-prone as raw `execute_script` code
- The operation requires specific `@grant` permissions (e.g., `CAT.agent.dom`, `CAT.agent.conversation`, `CAT.agent.task`)
- The workflow is **reusable** — if the same multi-step logic will be triggered repeatedly, packaging it as a Skill Script is cleaner than relying on the LLM to reconstruct it each time

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
├── SKILL.md              # Required: prompt + metadata
├── scripts/              # Optional: Skill Scripts (.js)
└── references/           # Optional: large docs, loaded on demand
```

**When to use each component:**
- **SKILL.md only** — the Skill is about guiding LLM behavior (translation style, code review rules)
- **+ scripts/** — the Skill needs to do things (fetch data, manipulate DOM, call APIs) via Skill Scripts
- **+ references/** — there's too much reference material for SKILL.md (>500 lines), or docs that are only needed sometimes

Share your proposed structure with the user before writing code.

### Step 3: Write SKILL.md

The SKILL.md is a **prompt for the LLM**, not documentation for humans. Write it as instructions that tell the Agent what to do, not as a reference manual.

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

**Example — weather API Skill:**
```yaml
config:
  API_KEY:
    title: "OpenWeatherMap API Key"
    type: text
    secret: true
    required: true
  DEFAULT_CITY:
    title: "Default City"
    type: text
    default: "Beijing"
  UNITS:
    title: "Temperature Units"
    type: select
    values: [metric, imperial, standard]
    default: metric
```

**Reading config in Skill Scripts:**
```js
const apiKey = CAT_CONFIG.API_KEY;
if (!apiKey) {
  return { error: "API_KEY not configured. Set it in Skills → Config." };
}
const units = CAT_CONFIG.UNITS || "metric";
```

`CAT_CONFIG` is a frozen read-only object injected at runtime. Always check required fields and provide fallbacks for optional ones.

**When to use config vs `GM.getValue`:**
- **Config** — values the user sets once at install time (API keys, preferences). Declared in frontmatter, has a UI form.
- **GM.getValue** — values the Skill reads/writes at runtime (session state, caches, user data accumulated over time).

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

Keep the body under 500 lines. The `browser-automation` Skill in `references/skill-examples.md` is a good reference for structure and tone.

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

**Simple tool — no dependencies:**
```js
// ==SkillScript==
// @name         greet
// @description  Greet a person by name, returns a greeting object
// @param        name  string  [required]  Person's name
// ==/SkillScript==

const { name } = args;
return { greeting: `Hello, ${name}! Welcome to ScriptCat Agent.` };
```

**HTTP request — cross-origin fetch:**
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

**DOM operation — browser control:**
```js
// ==SkillScript==
// @name         read_active_page
// @description  Read the current tab's page content. Returns { title, url, content }
// @param        selector  string  CSS selector to narrow scope (optional)
// @grant        CAT.agent.dom
// ==/SkillScript==

const { selector } = args;
const page = await CAT.agent.dom.readPage({ selector });
return { title: page.title, url: page.url, content: page.html };
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

#### Common pitfalls

- Never hardcode API keys or secrets — use `config` frontmatter fields (accessed via `CAT_CONFIG`) for install-time credentials, or `GM.getValue` for runtime-managed secrets
- Don't return raw full-page HTML — extract and return only the relevant data to save tokens
- Don't build one mega-script with many params — split into focused single-responsibility scripts
- Don't ignore errors — catch exceptions and return `{ error: "meaningful message" }` so the LLM can react
- **Attachment content field**: when a script returns attachments (files, images), the LLM **cannot see** the attachment contents — it only sees the `content` text field. So `content` must explicitly state what was generated and instruct the LLM not to regenerate it. Example: `content: "Code generation complete. Generated 1 script (attached). Do NOT rewrite the code."`

### Step 5: Verify

After writing all files, do a self-review:

1. **Description check**: Read just the name + description. Is it 30-80 words? Would it trigger on the right prompts and NOT trigger on unrelated ones?
2. **Prompt check**: Read the SKILL.md body as if you were the Agent seeing it for the first time. Are the instructions actionable? Can you follow the workflow without ambiguity?
3. **Script check**: For each Skill Script, verify:
   - `@description` explains what it takes and what it returns
   - All required params are marked `[required]`
   - `@grant` lists all needed permissions
   - Return value is structured (object, not raw string)
   - No hardcoded secrets (use `config` frontmatter or `GM.getValue` instead)
4. **Config check** (if applicable): Each `config` field has `title` and `type`; `select` fields have `values`; sensitive fields use `secret: true`; Skill Scripts check required config and return clear errors when missing
5. **Naming check**: Script names in SKILL.md match the `@name` in scripts (the Agent invokes them via `execute_skill_script` with the skill and script name)

Present the complete Skill to the user for review before finalizing.

#### Testing in ScriptCat

Tell the user how to test the Skill before distributing:

1. **Quick-install**: zip the Skill directory → import in ScriptCat → Agent → Skills → Import
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
3. A zip command for packaging: `cd skill-name/ && zip -r ../skill-name.zip SKILL.md scripts/ references/`
4. Brief install instructions: import the .zip in ScriptCat → Agent → Skills

If the user wants to iterate, go back to the relevant step. Don't rewrite everything — make targeted edits.

## Improving an existing Skill

When the user brings an existing Skill to improve, follow a different approach:

### 1. Read first

Read the existing SKILL.md and all scripts/ before suggesting changes. Understand what the Skill currently does and how it's structured.

### 2. Diagnose

Identify the category of problem:

- **Trigger issues** — Skill doesn't fire when it should, or fires when it shouldn't → fix the description (check length, keywords, specificity)
- **Bad script output** — scripts return wrong or useless data → fix the Skill Script logic or return structure
- **Unclear prompt** — Agent doesn't follow the intended workflow → rewrite the SKILL.md body with clearer instructions, better examples, or explicit branching
- **Missing capability** — Skill can't do something it should → add a new Skill Script or reference

Use this checklist to systematically review the Skill:

#### Optimization checklist

- **Description trigger precision**: Does the description (30-80 words) cover typical user phrasings? Does it false-trigger on unrelated prompts? Check both positive and negative triggers.
- **Built-in tool overlap**: Does any Skill Script duplicate `web_fetch`, `list_tabs`, `execute_script`, or other built-in tools? If so, remove it and reference the built-in in SKILL.md instead.
- **Tool granularity**: Is there a mega-script doing too many things? Split into focused single-responsibility scripts. Conversely, are there too many tiny scripts that should be one?
- **Prompt workflow**: Does the SKILL.md have clear branching logic? Are error/edge-case paths covered, or only the happy path?
- **Examples**: Are there input→output examples? Do they cover the main scenarios (including error cases)?
- **Error handling**: Do scripts return `{ error: "..." }` rather than throwing? Does SKILL.md guide the Agent on how to handle errors?
- **References usage**: Is the SKILL.md body over 500 lines? Should large docs move to `references/` for on-demand loading?

#### Common optimization patterns

- **Outdated documentation** — API signatures or parameter descriptions in SKILL.md don't match actual Skill Script `@param` headers → sync them
- **Description keyword gaps** — add trigger phrases the user would naturally say (e.g., "fill forms" for browser-automation) while keeping the description under 80 words
- **Built-in tool hints** — when a workflow uses both built-in tools and Skill Scripts, explicitly state in SKILL.md which steps use built-in tools (e.g., "Use the built-in `list_tabs` tool to find tabIds")

### 3. Targeted edits

Fix only what's broken. Don't rewrite the entire Skill when a description tweak or one tool fix would solve the problem. Show the user a before/after diff of what you changed and why.

## Reference files

Use `read_reference` to load these when the specific condition applies:

- **`scriptcat.d.ts`** — read when you need exact API signatures, method parameters, or return types for `CAT.agent.conversation`, `CAT.agent.dom`, `CAT.agent.task`, `CAT.agent.skills`, `CAT.agent.model`, `CAT.agent.opfs`, or `CAT_CONFIG`. This is the authoritative source of truth.
- **`skill-script-api.md`** — read when writing Skill Scripts and you need to check metadata syntax (`@param`, `@grant`, `@timeout`, `@require`), return format details (especially attachments), or GM API usage patterns.
- **`skill-examples.md`** — read when deciding how to structure a SKILL.md prompt, or when you want to show the user what a well-written Skill looks like. Contains analysis of the `browser-automation` Skill and design pattern templates (prompt-only, tool-set, references-based).

Don't load all three upfront. Read them on demand when the specific need arises. Don't dump their content into the Skill you're creating — they're for your reference, not the user's.
