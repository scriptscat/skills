# ScriptCat Coding Patterns & Rules

## Header Formats

### UserScript
```js
// ==UserScript==
// @name         Script Name
// @namespace    https://scriptcat.org/
// @version      1.0.0
// @description  What this script does
// @author       Author
// @match        https://example.com/*
// @grant        GM_xmlhttpRequest
// @connect      api.example.com
// ==/UserScript==
```

### CATTool
```js
// ==CATTool==
// @name         tool_name
// @description  Specific description — LLM reads this to decide when to call
// @param        paramName  type  [required]  description
// @grant        GM_xmlhttpRequest
// @timeout      120
// ==/CATTool==
```

## Coding Rules

1. **@grant everything** — declare every API used. Missing grants cause silent `undefined` errors at runtime.
2. **GM.* for await, GM_* for callbacks** — use `GM.xmlHttpRequest` (Promise) with `await`; use `GM_xmlhttpRequest` (callback) only for streaming/onprogress.
3. **Never hardcode secrets** — use `GM.getValue` or UserConfig for API keys and tokens.
4. **CATTool error handling** — always wrap risky operations in try-catch, return `{ error: "message" }` so the Agent can react.
5. **CATTools have NO DOM** — use `CAT.agent.dom` for any browser interaction.
6. **@match / @background / @crontab are mutually exclusive** — a single script CANNOT combine them.
7. **@connect for HTTP requests** — declare every domain used with `GM_xmlhttpRequest`.
8. **CATTool timeout** — default 30s; use `@timeout N` (seconds) for long-running tools.
9. **@param types** — only `string`, `number`, `boolean`, `string[enum,values]`. No objects/arrays; use JSON strings and parse inside the tool.
10. **Return structured data** — return objects, not raw strings. Keep returns concise; don't dump full HTML.

## Common Patterns

### Cross-origin HTTP Request
```js
// @grant GM_xmlhttpRequest
// @connect api.example.com
const resp = await GM.xmlHttpRequest({
  url: "https://api.example.com/data",
  method: "GET",
  headers: { "Authorization": "Bearer " + token },
  responseType: "json",
});
const data = resp.response;
```

### Persistent Storage
```js
// @grant GM_setValue
// @grant GM_getValue
const val = await GM.getValue("key", defaultValue);
await GM.setValue("key", newValue);
```

### Sub-agent Conversation (CATTool)
```js
// @grant CAT.agent.conversation
const conv = await CAT.agent.conversation.create({
  system: "You are a helpful assistant.",
  ephemeral: true,
});
const reply = await conv.chat("...");
const text = typeof reply.content === "string"
  ? reply.content
  : reply.content.map(b => b.text || "").join("");
```

### Browser Automation (CATTool)
```js
// @grant CAT.agent.dom
await CAT.agent.dom.fill("input[name=q]", "query", { trusted: true });
await CAT.agent.dom.click("button[type=submit]", { trusted: true });
await CAT.agent.dom.waitFor(".results", { timeout: 5000 });
const page = await CAT.agent.dom.readPage({ selector: ".results" });
```

### Returning Attachments (CATTool)
```js
return {
  content: "Screenshot captured.",
  attachments: [{
    type: "image",
    name: "screenshot.png",
    mimeType: "image/png",
    data: screenshotBlob  // base64 data-URL or Blob
  }]
};
```

### Multi-script Data Sharing
When splitting into multiple scripts (e.g., content + background), use storage for communication:
```js
// Script A (content script) writes:
await GM.setValue("shared_data", JSON.stringify(payload));

// Script B (background/crontab) reads:
const raw = await GM.getValue("shared_data", "null");
const payload = JSON.parse(raw);
```

## Multi-script Output Separator

When generating multiple scripts in one response, separate them with:
```
// ===SCRIPT_SEPARATOR===
```
