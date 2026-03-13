# CATTool API Reference

## Metadata header

```js
// ==CATTool==
// @name         tool_name
// @description  What this tool does
// @param        paramName  type  [required]  description
// @grant        GM_xmlhttpRequest
// @require      https://cdn.example.com/lib.js
// @timeout      120
// ==/CATTool==
```

### @name (required)

Tool identifier, snake_case. The LLM calls the tool by this name.

When inside a Skill, the tool gets a `skillname__` prefix at runtime (e.g., skill `search` tool `google` → `search__google`).

### @description (recommended)

Tells the LLM when to use this tool and what it returns. Be specific — this is what the LLM uses to decide whether to call the tool.

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

Declares required API permissions. CATTool auth is **independent** — permissions are never inherited from the calling script.

### @require

External JS library URL. Downloaded and cached **at install time**, injected into the Sandbox at runtime (not re-downloaded per execution).

### @timeout

Custom execution timeout in **seconds**. Default is `30`. Use this for long-running tools (e.g., web scraping, large file processing).

```js
// @timeout 120   // 2 minutes
```

## Runtime

### Execution environment

CATTools run in ScriptCat's Sandbox (Offscreen → Sandbox), using the same `BgExecScriptWarp` runtime as background scripts. Code is wrapped in `with(arguments[0])` for isolation.

### Timeout

Default **30-second** timeout enforced via `Promise.race()`. Customizable via `@timeout` (in seconds). After timeout, resources are cleaned up and an error is thrown.

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

CATTools can return binary attachments (images, files, audio) alongside text results. Return a `ToolResultWithAttachments` object:

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

Available via `@grant CAT.agent.dom`, `@grant CAT.agent.task`, etc.

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

### CAT.agent.tools

Call other installed CATTools:

```js
// @grant CAT.agent.tools
const result = await CAT.agent.tools.call("other_tool", { param: "value" });
```

## Notes

- Permissions are verified per-execution via `@grant` declarations. Sensitive operations may trigger a user confirmation dialog.
- `@param` definitions automatically map to JSON Schema for LLM function calling — you don't need to write schemas manually.
