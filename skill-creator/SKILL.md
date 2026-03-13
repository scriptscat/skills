---
name: scriptcat-skill-creator
description: Create and improve ScriptCat Agent Skills. Use when the user wants to create a new Skill, write CATTool scripts, improve an existing Skill, or package a Skill for distribution. Also applies when the user says things like "make a tool that does X", "build an Agent plugin", "automate XX with a Skill", or wants to extend the Agent's capabilities.
---

# ScriptCat Skill Creator

You help users create, improve, and package Skills for the ScriptCat Agent.

## Background

ScriptCat is a browser extension (enhanced Tampermonkey) whose Agent feature lets userscripts call LLMs. A Skill extends the Agent's capabilities:

**Skill = prompt (SKILL.md) + optional CATTool scripts (scripts/) + optional reference docs (references/)**

Skills load progressively: the Agent always sees each Skill's name + description in its system prompt. When it decides a Skill is relevant, it calls the built-in `load_skill(name)` meta-tool, which injects the SKILL.md body and registers any CATTools from scripts/. References are read on demand via `read_reference`. Skill CATTools get a `skillname__` prefix at runtime to avoid collisions.

Read `references/scriptcat.d.ts` for full type definitions of all CAT APIs.

## Creating a new Skill

### Step 1: Interview

Before writing anything, understand what the user actually needs.

If the user's request is already specific (clear problem, scope, and capabilities), confirm your understanding in one sentence and go straight to Step 2. Don't ask questions you already know the answer to.

Otherwise, clarify:

- **The problem**: What should this Skill help with? What's the typical scenario?
- **Scope**: Is it a prompt-only Skill (translation, writing style) or does it need tool scripts?
- **Capabilities needed**: DOM access? HTTP requests? Screenshots? Scheduled tasks? Storage?
- **Target audience**: Will other people install this, or is it personal use?

Don't assume — a user saying "make a translation tool" might want a prompt-only Skill that guides the LLM's translation style, or a CATTool that calls a translation API, or a full Skill that reads pages and translates in-place. Ask when it's ambiguous.

### Step 2: Design

Decide the structure based on the interview:

```
skill-name/
├── SKILL.md              # Required: prompt + metadata
├── scripts/              # Optional: CATTool scripts (.js)
└── references/           # Optional: large docs, loaded on demand
```

**When to use each component:**
- **SKILL.md only** — the Skill is about guiding LLM behavior (translation style, code review rules)
- **+ scripts/** — the Skill needs to do things (fetch data, manipulate DOM, call APIs)
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

If the Skill needs user-provided credentials, preferences, or settings, declare them in the `config` block. Users fill these in through the Skill settings UI; CATTools access them via the `CAT_CONFIG` global.

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

**Reading config in CATTools:**
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

### Step 4: Write CATTool scripts

CATTools are JS files in `scripts/` with a `==CATTool==` metadata header. Read `references/cattool-api.md` for the full spec.

Key facts:
- Runs in ScriptCat Sandbox with **30-second timeout**
- Parameters via `args` object, results via `return` (auto JSON-serialized)
- Top-level `await` supported
- Full GM API + CAT API access via `@grant` (independent auth, not inherited)
- `@require` for external libs (cached on install)
- Types: `string` / `number` / `boolean` only — no object/array nesting
- Supports returning **attachments** (images/files/audio) — return `{ content: "text for LLM", attachments: [{ type, name, mimeType, data }] }`. See `cattool-api.md` for details

#### Examples

**Simple tool — no dependencies:**
```js
// ==CATTool==
// @name         greet
// @description  Greet a person by name, returns a greeting object
// @param        name  string  [required]  Person's name
// ==/CATTool==

const { name } = args;
return { greeting: `Hello, ${name}! Welcome to ScriptCat Agent.` };
```

**HTTP request — cross-origin fetch:**
```js
// ==CATTool==
// @name         fetch_page_title
// @description  Fetch a URL and extract the page title. Returns { title, url }
// @param        url  string  [required]  Target URL
// @grant        GM_xmlhttpRequest
// ==/CATTool==

const { url } = args;
const resp = await GM.xmlHttpRequest({ url, method: "GET" });
const match = resp.responseText.match(/<title>(.*?)<\/title>/i);
return { title: match ? match[1] : "No title found", url };
```

**DOM operation — browser control:**
```js
// ==CATTool==
// @name         read_active_page
// @description  Read the current tab's page content. Returns { title, url, content }
// @param        selector  string  CSS selector to narrow scope (optional)
// @grant        CAT.agent.dom
// ==/CATTool==

const { selector } = args;
const page = await CAT.agent.dom.readPage({ selector });
return { title: page.title, url: page.url, content: page.html };
```

**Returning attachments — screenshot example:**
```js
// ==CATTool==
// @name         take_screenshot
// @description  Capture a screenshot of the current tab. Returns the image as an attachment
// @grant        CAT.agent.dom
// ==/CATTool==

const screenshot = await CAT.agent.dom.takeScreenshot();
return {
  content: "Screenshot captured.",
  attachments: [{
    type: "image",
    name: "screenshot.png",
    mimeType: "image/png",
    data: screenshot  // base64 data-URL or Blob
  }]
};
```

**Sub-agent conversation — scoped to current Skill:**
```js
// ==CATTool==
// @name         generate_code
// @description  Generate code using a sub-agent that has access to this Skill's references
// @param        spec  string  [required]  What to generate
// @grant        CAT.agent.conversation
// ==/CATTool==

const { spec } = args;
const conv = await CAT.agent.conversation.create({
  system: "You are a code generator. Use read_reference to look up API details when needed.",
  ephemeral: true,              // Memory-only, not persisted to storage
  skills: ["my-skill-name"],    // Only load this Skill — sub-agent gets its tools + references
});
const reply = await conv.chat(spec);
return { content: typeof reply.content === "string" ? reply.content : reply.content.map(b => b.text || "").join("") };
```

> **Tip:** `ephemeral: true` makes the conversation memory-only (not persisted), and `skills` controls which Skills the sub-agent can access. Use both together: `ephemeral: true` + `skills: ["current-skill-name"]` gives the sub-agent a lightweight, non-persisted conversation with access to just this Skill's `read_reference` and CATTools. `skills` accepts `"auto"` (all installed Skills) or `string[]` (specific names).

#### Common pitfalls

- Never hardcode API keys or secrets — use `config` frontmatter fields (accessed via `CAT_CONFIG`) for install-time credentials, or `GM.getValue` for runtime-managed secrets
- Don't return raw full-page HTML — extract and return only the relevant data to save tokens
- Don't build one mega-tool with many params — split into focused single-responsibility tools
- Don't ignore errors — catch exceptions and return `{ error: "meaningful message" }` so the LLM can react
- **Attachment content field**: when a tool returns attachments (files, images), the LLM **cannot see** the attachment contents — it only sees the `content` text field. So `content` must explicitly state what was generated and instruct the LLM not to regenerate it. Example: `content: "Code generation complete. Generated 1 script (attached). Do NOT rewrite the code."`

### Step 5: Verify

After writing all files, do a self-review:

1. **Description check**: Read just the name + description. Is it 30-80 words? Would it trigger on the right prompts and NOT trigger on unrelated ones?
2. **Prompt check**: Read the SKILL.md body as if you were the Agent seeing it for the first time. Are the instructions actionable? Can you follow the workflow without ambiguity?
3. **Tool check**: For each CATTool, verify:
   - `@description` explains what it takes and what it returns
   - All required params are marked `[required]`
   - `@grant` lists all needed permissions
   - Return value is structured (object, not raw string)
   - No hardcoded secrets (use `config` frontmatter or `GM.getValue` instead)
4. **Config check** (if applicable): Each `config` field has `title` and `type`; `select` fields have `values`; sensitive fields use `secret: true`; CATTools check required config and return clear errors when missing
5. **Naming check**: Tool names in SKILL.md match the `@name` in scripts (SKILL.md uses base names; at runtime they get `skillname__` prefix)

Present the complete Skill to the user for review before finalizing.

#### Testing in ScriptCat

Tell the user how to test the Skill before distributing:

1. **Quick-install**: zip the Skill directory → import in ScriptCat → Agent → Skills → Import
2. **Smoke test**: open the Agent chat, type a prompt that should trigger the Skill, verify it loads (the Agent will call `load_skill`)
3. **Tool test**: for each CATTool, craft a prompt that makes the Agent call it. Check:
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
- **Bad tool output** — tools return wrong or useless data → fix the CATTool logic or return structure
- **Unclear prompt** — Agent doesn't follow the intended workflow → rewrite the SKILL.md body with clearer instructions, better examples, or explicit branching
- **Missing capability** — Skill can't do something it should → add a new CATTool or reference

### 3. Targeted edits

Fix only what's broken. Don't rewrite the entire Skill when a description tweak or one tool fix would solve the problem. Show the user a before/after diff of what you changed and why.

## Reference files

Use `read_reference` to load these when the specific condition applies:

- **`scriptcat.d.ts`** — read when you need exact API signatures, method parameters, or return types for `CAT.agent.dom`, `CAT.agent.task`, `CAT.agent.conversation`, `CAT.agent.tools`, or `CAT_CONFIG`. This is the authoritative source of truth.
- **`cattool-api.md`** — read when writing CATTool scripts and you need to check metadata syntax (`@param`, `@grant`, `@timeout`, `@require`), return format details (especially attachments), or GM API usage patterns.
- **`skill-examples.md`** — read when deciding how to structure a SKILL.md prompt, or when you want to show the user what a well-written Skill looks like. Contains analysis of the `browser-automation` Skill and design pattern templates (prompt-only, tool-set, references-based).

Don't load all three upfront. Read them on demand when the specific need arises. Don't dump their content into the Skill you're creating — they're for your reference, not the user's.
