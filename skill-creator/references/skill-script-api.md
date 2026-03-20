# Skill Script API Reference

## Metadata header

```js
// ==SkillScript==
// @name         tool_name
// @description  What this tool does
// @param        paramName  type  [required]  description
// @grant        GM_xmlhttpRequest
// @require      https://cdn.example.com/lib.js
// @timeout      120
// ==/SkillScript==
```

### @name (required)

Script identifier, snake_case. The LLM invokes this script via the `execute_skill_script` meta-tool by passing the skill name and script name.

For example, a script named `google` in skill `search` is invoked as `execute_skill_script(skill="search", script="google", params={...})`.

### @description (recommended)

Tells the LLM when to use this script and what it returns. Be specific — this is what the LLM uses to decide whether to invoke the script.

### @param

Parameter definition: `paramName type [required] description`

**Supported types:**
- `string` — kept as-is
- `number` — auto-converted via `Number()`
- `boolean` — auto-converted: `"true"` → `true`, everything else → `false`

**Enum syntax:** `string[val1,val2,val3]` — restrict to listed values

```js
// @param  keyword   string              [required]  Search keyword
// @param  maxCount  number                          Max results to return
// @param  verbose   boolean                         Whether to include details
// @param  sortBy    string[price,sales,rating]      Sort order
```

### @grant

Declares required API permissions. Skill Script auth is **independent** — permissions are never inherited from the calling script.

### @require

External JS library URL. Downloaded and cached **at install time**, injected into the Sandbox at runtime (not re-downloaded per execution).

### @timeout

Custom execution timeout in **seconds**. Default is `300` (5 minutes). Use this for scripts that need a shorter or longer limit.

```js
// @timeout 120   // 2 minutes
```

## Runtime

### Execution environment

Skill Scripts run in ScriptCat's Sandbox (Offscreen → Sandbox), using the same `BgExecScriptWarp` runtime as background scripts. Code is wrapped in `with(arguments[0])` for isolation.

### Timeout

Default **300-second** (5-minute) timeout enforced via `Promise.race()`. Customizable via `@timeout` (in seconds). After timeout, resources are cleaned up and an error is thrown.

### args object

Contains all LLM-provided parameters, auto-converted per @param type definitions:

```js
const { keyword, maxCount, verbose } = args;
```

### Return value

Use `return` to send results back to the LLM. Objects are JSON-serialized automatically:

```js
return { price: 99.5, currency: "CNY", inStock: true };
```

### Returning attachments

Skill Scripts can return binary attachments (images, files, audio) alongside text results. Return a `ToolResultWithAttachments` object:

```js
return {
  content: "Screenshot captured successfully.",   // text sent to LLM
  attachments: [                                  // stored & displayed in UI, not sent to LLM as text
    {
      type: "image",                              // "image" | "file" | "audio"
      name: "screenshot.png",
      mimeType: "image/png",
      data: "data:image/png;base64,iVBOR..."      // base64 data-URL string, or Blob
    }
  ]
};
```

**Detection rule:** the runtime checks `typeof content === "string" && Array.isArray(attachments)`. If matched, it splits the return into text result + attachment storage; otherwise the return is treated as a plain value.

**AttachmentData fields:**

| Field    | Type               | Description                                |
|----------|--------------------|--------------------------------------------|
| type     | `"image"` \| `"file"` \| `"audio"` | Attachment category              |
| name     | string             | File name (e.g. `"report.pdf"`)            |
| mimeType | string             | MIME type (e.g. `"image/jpeg"`, `"application/pdf"`) |
| data     | string \| Blob     | base64 / data-URL string, or a Blob object |

**Multiple attachments** are supported — just add more items to the `attachments` array.

**Provider behavior:** images are forwarded to the LLM as vision input (Anthropic base64 / OpenAI image_url); audio is supported on OpenAI; files and unsupported modalities are gracefully degraded to text descriptions.

**Important:** The LLM **cannot see** attachment contents — it only receives the `content` text field. So when returning attachments, the `content` must clearly state what was generated and instruct the LLM not to regenerate it. Example: `content: "Code generation complete. 1 script attached as .js file. Do NOT rewrite the code."`

### Async support

Top-level `await` is supported:

```js
const resp = await GM.xmlHttpRequest({ url: args.url });
return { status: resp.status, body: resp.responseText };
```

## Available GM APIs

Full GM API access via `@grant`, identical to regular userscripts.

### GM_xmlhttpRequest / GM.xmlHttpRequest

Cross-origin HTTP requests:

```js
// @grant GM_xmlhttpRequest

const resp = await GM.xmlHttpRequest({
  url: "https://api.example.com/data",
  method: "GET",
  headers: { "Authorization": "Bearer xxx" },
});
return JSON.parse(resp.responseText);
```

### GM_getValue / GM.getValue

Read from persistent storage:

```js
// @grant GM_getValue
const saved = await GM.getValue("key", defaultValue);
```

### GM_setValue / GM.setValue

Write to persistent storage:

```js
// @grant GM_setValue
await GM.setValue("key", { data: "value" });
```

### GM_deleteValue / GM.deleteValue

Delete a stored value:

```js
// @grant GM_deleteValue
await GM.deleteValue("key");
```

### GM_notification / GM.notification

Show a desktop notification:

```js
// @grant GM_notification
GM.notification({ title: "Alert", text: "Task complete", timeout: 5000 });
```

### GM_setClipboard / GM.setClipboard

Write to clipboard:

```js
// @grant GM_setClipboard
GM.setClipboard("copied text", "text/plain");
```

### GM_openInTab / GM.openInTab

Open a URL in a new tab:

```js
// @grant GM_openInTab
GM.openInTab("https://example.com", { active: true });
```

## CAT Agent APIs

Available via `@grant CAT.agent.conversation`, `@grant CAT.agent.dom`, `@grant CAT.agent.task`, `@grant CAT.agent.skills`, `@grant CAT.agent.model`, `@grant CAT.agent.opfs`.

### CAT.agent.conversation

Create sub-agent conversations with LLM, supporting tools, skills, and streaming:

```js
// @grant CAT.agent.conversation

// Create a conversation
const conv = await CAT.agent.conversation.create({
  system: "You are a helpful assistant.",
  model: "model-id",          // optional, uses default model if omitted
  maxIterations: 20,           // max tool-calling loops, default 20
  skills: "auto",              // "auto" loads all skills, or ["skill-name"]
  tools: [{                    // inline tools with handlers
    name: "lookup",
    description: "Look up a value",
    parameters: { type: "object", properties: { key: { type: "string" } } },
    handler: async (args) => ({ value: "result" }),
  }],
  commands: { "/reset": async (args, conv) => { await conv.clear(); return "Cleared."; } },
  ephemeral: false,            // true = in-memory only, no persistence, no built-in tools
  cache: true,                 // prompt caching, default true
});

// Non-streaming chat
const reply = await conv.chat("Hello!");
// reply: { content, thinking?, toolCalls?, usage? }

// Streaming chat
const stream = await conv.chatStream("Summarize this page.");
for await (const chunk of stream) {
  // chunk.type: "content_delta" | "thinking_delta" | "tool_call" | "content_block" | "done" | "error"
  if (chunk.type === "content_delta") console.log(chunk.content);
}

// Get message history
const messages = await conv.getMessages();

// Clear messages
await conv.clear();

// Persist conversation
await conv.save();

// Retrieve an existing conversation
const existing = await CAT.agent.conversation.get("conversation-id");
```

### CAT.agent.dom

Full browser DOM control:

```js
// @grant CAT.agent.dom

// List all tabs
const tabs = await CAT.agent.dom.listTabs();

// Read page content
const page = await CAT.agent.dom.readPage({ tabId: 123, selector: "main" });

// Screenshot
const imageData = await CAT.agent.dom.screenshot({ tabId: 123 });

// Click (trusted = CDP-level click)
await CAT.agent.dom.click("button.submit", { tabId: 123, trusted: true });

// Fill form field
await CAT.agent.dom.fill("input[name=q]", "search term", { tabId: 123, trusted: true });

// Scroll
await CAT.agent.dom.scroll("down", { tabId: 123 });

// Navigate
await CAT.agent.dom.navigate("https://example.com", { tabId: 123 });

// Wait for element
await CAT.agent.dom.waitFor(".results", { tabId: 123, timeout: 5000 });

// Execute JS in page context
const result = await CAT.agent.dom.executeScript("document.title", { tabId: 123 });
```

### CAT.agent.task

Scheduled task management:

```js
// @grant CAT.agent.task

// Create a task
const task = await CAT.agent.task.create({
  name: "Daily check",
  crontab: "0 9 * * *",
  mode: "internal",       // "internal" = Agent runs the prompt; "event" = fires event to script
  enabled: true,
  prompt: "Check the dashboard and summarize",
  skills: "auto",
});

// Listen for task triggers (event mode)
CAT.agent.task.addListener(task.id, (trigger) => {
  console.log("Task triggered:", trigger.name);
});
```

### CAT.agent.skills.call

Programmatically invoke another Skill's script:

```js
// @grant CAT.agent.skills
const result = await CAT.agent.skills.call("skill-name", "script_name", { param: "value" });
```

Arguments: `call(skillName, scriptName, params?)` — `skillName` is the target Skill's name, `scriptName` is the `@name` of the script within that Skill, and `params` is an optional object of parameters.

### CAT.agent.model

Query configured LLM models (read-only, apiKey excluded for security):

```js
// @grant CAT.agent.model

// List all configured models
const models = await CAT.agent.model.list();
// models: [{ id, name, provider, apiBaseUrl, model, maxTokens? }]

// Get a specific model by ID
const model = await CAT.agent.model.get("model-id");

// Get the default model ID
const defaultId = await CAT.agent.model.getDefault();
```

### CAT.agent.opfs

Workspace file system operations. All paths are relative to `agents/workspace/` in OPFS:

```js
// @grant CAT.agent.opfs

// Write a file (string, Blob, or data URL)
const writeResult = await CAT.agent.opfs.write("reports/daily.txt", "Report content...");
// writeResult: { path, size }

// Read a file as text
const readResult = await CAT.agent.opfs.read("reports/daily.txt");
// readResult: { path, content, size }

// Read a file as Blob (for binary processing / re-uploading)
const blobResult = await CAT.agent.opfs.read("images/chart.png", "blob");
// blobResult: { path, data: Blob, size, mimeType }

// List files and directories
const entries = await CAT.agent.opfs.list("reports/");
// entries: [{ name, type: "file"|"directory", size? }]

// Delete a file or directory
await CAT.agent.opfs.delete("reports/old.txt");
```

## Common Patterns

These patterns are derived from real Skills in production. Use them as building blocks.

### executeScript unwrap

`CAT.agent.dom.executeScript()` wraps every return in `{ result, tabId }`. Always unwrap:

```js
const unwrap = (v) =>
  v && typeof v === 'object' && 'result' in v ? v.result : v;

const title = unwrap(
  await CAT.agent.dom.executeScript('return document.title;', { tabId })
);
```

Define `unwrap` at the top of every script that uses `executeScript`. This is the **#1 gotcha** for new Skill authors.

### Multi-action scripts

Use an enum `@param` to combine related operations into one script:

```js
// @param  action  string[explore,inject,upload]  [required]  Operation to perform
```

Structure: one `if (action === '...')` block per action, each validating its own params and returning structured results. Always add a final `return { error: ... }` for invalid actions. Real examples: `editor` (explore/inject/upload_cover), `login` (check/wait), `manage_styles` (list/save/load/delete).

### Chunked content injection

For injecting large strings (>30KB) via `executeScript`, use a hidden textarea as a buffer:

```js
const CHUNK_SIZE = 30000;

// 1. Create hidden textarea
await CAT.agent.dom.executeScript(`
  var existing = document.getElementById('__sc_inject__');
  if (existing) existing.remove();
  var ta = document.createElement('textarea');
  ta.id = '__sc_inject__'; ta.style.display = 'none';
  document.body.appendChild(ta);
`, { tabId });

// 2. Append chunks
for (let i = 0; i < content.length; i += CHUNK_SIZE) {
  const chunk = JSON.stringify(content.substring(i, i + CHUNK_SIZE));
  const isFirst = i === 0;
  await CAT.agent.dom.executeScript(
    `var ta = document.getElementById('__sc_inject__');
     ${isFirst ? 'ta.value = ' : 'ta.value += '}${chunk};`,
    { tabId }
  );
}

// 3. Use the accumulated content + cleanup
const result = unwrap(await CAT.agent.dom.executeScript(`
  var ta = document.getElementById('__sc_inject__');
  var html = ta ? ta.value : ''; if (ta) ta.remove();
  if (!html) return { ok: false, error: 'Buffer empty' };
  // ... use html (e.g. pasteHTML into editor) ...
  return { ok: true };
`, { tabId }));
```

### File upload via DataTransfer

For programmatic file input without user interaction (images, covers, attachments):

```js
await CAT.agent.dom.executeScript(`
  var dataUrl = ${JSON.stringify(base64DataUrl)};
  var arr = dataUrl.split(',');
  var mime = arr[0].match(/:(.*?);/)[1];
  var bstr = atob(arr[1]);
  var n = bstr.length;
  var u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  var file = new File([u8arr], 'upload_' + Date.now() + '.png', { type: mime });

  var dt = new DataTransfer();
  dt.items.add(file);
  var input = document.querySelector('input[type="file"]');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
`, { tabId });
```

### Retry with polling

For waiting on async conditions (page load, element appearance, login completion):

```js
const maxRetries = 10;
const interval = 1000; // ms

for (let i = 0; i < maxRetries; i++) {
  const ready = unwrap(await CAT.agent.dom.executeScript(
    `return !!document.querySelector('.target-element');`, { tabId }
  ));
  if (ready) break;
  await new Promise(r => setTimeout(r, interval));
}
```

For login polling with timeout (real pattern from publisher Skills):

```js
const maxWait = (args.timeout || 120) * 1000;
const startTime = Date.now();

while (Date.now() - startTime < maxWait) {
  const result = await checkLogin(); // calls executeScript internally
  if (result.status === 'logged_in') return result;
  await new Promise(r => setTimeout(r, 3000));
}

return { status: 'timeout', message: `Login timed out (${maxWait / 1000}s)` };
```

### PasteHTML for rich content editors

ProseMirror editors (WeChat, etc.) require paste events, not `insertHTML`:

```js
function pasteHTML(el, html) {
  el.focus();
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  var plain = tempDiv.textContent || '';
  var pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(pasteEvent, 'clipboardData', {
    value: {
      getData: function(type) {
        if (type === 'text/html') return html;
        if (type === 'text/plain') return plain;
        return '';
      },
      types: ['text/html', 'text/plain'], items: [], files: []
    }
  });
  el.dispatchEvent(pasteEvent);
}
```

### React input value setting

React inputs use synthetic state — `input.value = x` won't update React state. Use the native setter:

```js
var input = document.querySelector('input[name="title"]');
var setter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype, 'value'
).set;
setter.call(input, 'New value');
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
```

### OPFS path conventions

Organize OPFS files by skill → category → file:

```js
const STYLES_DIR = 'my-skill/styles';
function safeName(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
}
const path = `${STYLES_DIR}/writing/${safeName(profileName)}.json`;
await CAT.agent.opfs.write(path, JSON.stringify(data, null, 2));
```

### Login status check + QR screenshot

A reusable pattern for platform authentication:

```js
// 1. Check selectors for logged-in vs login-page state
const status = unwrap(await CAT.agent.dom.executeScript(`
  if (document.querySelector('.logged-in-indicator')) return 'logged_in';
  if (document.querySelector('.login-form')) return 'need_login';
  return 'unknown';
`, { tabId }));

// 2. If not logged in, screenshot the QR code area
if (status === 'need_login') {
  const screenshot = await CAT.agent.dom.screenshot({ tabId, selector: '.qr-code-area' });
  return {
    status: 'need_login',
    content: 'Please scan the QR code to log in',
    attachments: screenshot ? [screenshot] : []
  };
}
```

## Notes

- Permissions are verified per-execution via `@grant` declarations. Sensitive operations may trigger a user confirmation dialog.
- `@param` definitions automatically map to JSON Schema for the `execute_skill_script` meta-tool — you don't need to write schemas manually.
