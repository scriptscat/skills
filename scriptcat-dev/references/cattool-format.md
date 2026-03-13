# CATTool Format Reference

## ==CATTool== Header

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

## Fields

### @name (required)

Tool identifier, `snake_case`. The LLM calls the tool by this name.

When inside a Skill, the tool gets a `skillname__` prefix at runtime (e.g., skill `search`, tool `google` → `search__google`).

### @description (recommended)

Tells the LLM when to use this tool and what it returns. Be specific — this is what the LLM uses to decide whether to call the tool.

### @param

Format: `paramName type [required] description`

**Supported types:**
- `string` — kept as-is
- `number` — auto-converted via `Number()`
- `boolean` — auto-converted: `"true"` → `true`, everything else → `false`

**Enum syntax:** `string[val1,val2,val3]` — restrict to listed values.

```js
// @param  keyword   string              [required]  Search keyword
// @param  maxCount  number                          Max results to return
// @param  verbose   boolean                         Whether to include details
// @param  sortBy    string[price,sales,rating]      Sort order
```

No object or array parameter types. For complex inputs, use JSON strings and parse inside the tool.

### @grant

Declares required API permissions. CATTool auth is **independent** — permissions are never inherited from the calling script.

Common grants:
- `GM_xmlhttpRequest` — cross-origin HTTP
- `GM_getValue` / `GM_setValue` — persistent storage
- `GM_notification` — desktop notifications
- `GM_setClipboard` — clipboard
- `GM_openInTab` — open tabs
- `CAT.agent.dom` — browser DOM control
- `CAT.agent.conversation` — sub-agent conversations
- `CAT.agent.tools` — call other CATTools
- `CAT.agent.task` — scheduled task management

### @require

External JS library URL. Downloaded and cached **at install time**, injected into the sandbox at runtime (not re-downloaded per execution).

### @timeout

Custom execution timeout in **seconds**. Default is `30`. Use for long-running tools (e.g., web scraping, large file processing).

```js
// @timeout 120   // 2 minutes
```

## Runtime

### Execution environment

CATTools run in ScriptCat's Sandbox (Offscreen → Sandbox), using the same `BgExecScriptWarp` runtime as background scripts. Code is wrapped in `with(arguments[0])` for isolation.

### Timeout

Default **30-second** timeout enforced via `Promise.race()`. Customizable via `@timeout` (in seconds). After timeout, resources are cleaned up and an error is thrown.

### args object

Contains all LLM-provided parameters, auto-converted per `@param` type definitions:

```js
const { keyword, maxCount, verbose } = args;
```

### Async support

Top-level `await` is supported:

```js
const resp = await GM.xmlHttpRequest({ url: args.url });
return { status: resp.status, body: resp.responseText };
```

## Return Values

### Plain return

Use `return` to send results back to the LLM. Objects are JSON-serialized automatically:

```js
return { price: 99.5, currency: "CNY", inStock: true };
```

### Returning attachments

Return a `ToolResultWithAttachments` object to include binary data (images, files, audio):

```js
return {
  content: "Screenshot captured successfully.",   // text sent to LLM
  attachments: [                                  // stored & displayed in UI
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

| Field | Type | Description |
|---|---|---|
| `type` | `"image"` \| `"file"` \| `"audio"` | Attachment category |
| `name` | string | File name (e.g. `"report.pdf"`) |
| `mimeType` | string | MIME type (e.g. `"image/jpeg"`) |
| `data` | string \| Blob | base64/data-URL string, or a Blob object |

Multiple attachments are supported — add more items to the `attachments` array.

**Provider behavior:** images are forwarded to the LLM as vision input; audio is supported on OpenAI; files and unsupported modalities are gracefully degraded to text descriptions.

## @param → JSON Schema mapping

`@param` definitions automatically map to JSON Schema for LLM function calling:

```js
// @param  keyword  string  [required]  Search keyword
// @param  count    number              Max results
```

Becomes (internally):
```json
{
  "type": "object",
  "properties": {
    "keyword": { "type": "string", "description": "Search keyword" },
    "count": { "type": "number", "description": "Max results" }
  },
  "required": ["keyword"]
}
```

You don't need to write schemas manually.
