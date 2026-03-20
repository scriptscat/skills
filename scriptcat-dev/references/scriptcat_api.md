# ScriptCat 特有 API 参考

以下 API 和元数据为 ScriptCat 独有，不兼容 Tampermonkey / Violentmonkey。使用时建议在注释中标注 `// ScriptCat only`。

---

## 后台脚本与定时任务

### @background

声明脚本为后台脚本，在 Service Worker 中运行，无需匹配页面。

```js
// ==UserScript==
// @name         后台监控脚本
// @background
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @connect      api.example.com
// ==/UserScript==

const resp = await GM.xmlHttpRequest({
  url: "https://api.example.com/status",
});
const data = JSON.parse(resp.responseText);
if (data.hasUpdate) {
  GM.notification({ title: "有新更新", text: data.message });
}
```

**注意**：后台脚本无法访问 DOM（没有 document/window），只能使用 GM API。

### @crontab

定时执行表达式，配合 `@background` 使用。格式为 6 位 cron：`秒 分 时 日 月 周`。

```js
// @background
// @crontab      0 0 9 * * *        // 每天 9:00:00
// @crontab      0 */30 * * * *     // 每 30 分钟
// @crontab      0 0 9 * * 1-5      // 工作日 9:00
// @crontab      0 0 8,12,18 * * *  // 每天 8:00、12:00、18:00
// @crontab      once 2025-12-31 00:00:00  // 一次性，指定时间
```

每次触发时脚本重新执行。脚本执行完毕后自动回收。

### CATRetryError

在后台脚本中抛出此错误可让 ScriptCat 稍后重试。

```js
// @background
try {
  const resp = await GM.xmlHttpRequest({ url: "https://api.example.com/data" });
  if (resp.status === 429) {
    throw new CATRetryError("请求限流", 60); // 60 秒后重试
  }
  // 处理数据...
} catch (e) {
  if (e instanceof CATRetryError) throw e;
  throw new CATRetryError("请求失败，稍后重试", 300); // 5 分钟后重试
}
```

构造函数：
- `new CATRetryError(message, seconds)` — N 秒后重试
- `new CATRetryError(message, date)` — 指定时间重试

最小重试间隔 5 秒。

---

## ScriptCat 独有函数

### CAT_registerMenuInput

注册带输入框的菜单项。用户点击后弹出输入对话框。

```js
// @grant GM_registerMenuCommand  // 共用同一个 grant

CAT_registerMenuInput("设置延迟时间", (value) => {
  console.log("用户输入:", value);
}, {
  inputType: "number",       // "text" | "number" | "boolean"
  title: "延迟设置",
  inputLabel: "延迟秒数",
  inputDefaultValue: 5,
  inputPlaceholder: "请输入秒数",
});

// 取消注册
CAT_unregisterMenuInput(menuId);
```

### CAT_userConfig

打开脚本的用户配置页面（需在元数据中定义 UserConfig）。

```js
// @grant GM_registerMenuCommand

GM_registerMenuCommand("打开设置", () => {
  CAT_userConfig();
});
```

### CAT_fetchDocument

获取 URL 内容并解析为 Document 对象。在内容脚本上下文中可用。

```js
const doc = await CAT_fetchDocument("https://example.com/page");
if (doc) {
  const title = doc.querySelector("title")?.textContent;
  const links = doc.querySelectorAll("a");
}
```

### CAT_createBlobUrl

从 Blob 创建 URL。ScriptCat 管理 URL 生命周期（自动回收）。

```js
const blob = new Blob(["Hello"], { type: "text/plain" });
const url = await CAT_createBlobUrl(blob);
// 可在页面 DOM 中使用此 URL
```

### CAT_fetchBlob

获取 URL 内容作为 Blob。主要用于 `GM.xmlHttpRequest` 的 stream 响应。

```js
const blob = await CAT_fetchBlob("blob:chrome-extension://xxx/yyy");
```

### CAT_scriptLoaded

配合 `@early-start` 使用。通知 ScriptCat 脚本已完成初始化。

```js
// @early-start

// 脚本极早执行，可以拦截全局对象
Object.defineProperty(window, 'someGlobal', { value: 'intercepted' });

// 通知初始化完成
await CAT_scriptLoaded();
```

---

## 文件存储

### CAT_fileStorage

操作 ScriptCat 的云端/本地文件存储系统。每个脚本有独立的 `app/<uuid>` 目录。

```js
// 上传文件
CAT_fileStorage("upload", {
  path: "data/export.json",
  data: new Blob([JSON.stringify(data)], { type: "application/json" }),
  onload: () => console.log("上传成功"),
  onerror: (err) => console.error("上传失败:", err.error),
});

// 列出文件
CAT_fileStorage("list", {
  path: "data/",
  onload: (files) => {
    // files: [{ name, path, absPath, size, digest, createtime, updatetime }]
    files.forEach(f => console.log(f.name, f.size));
  },
});

// 下载文件
CAT_fileStorage("download", {
  file: fileInfo, // 从 list 返回的文件对象
  onload: (blob) => {
    const text = await blob.text();
  },
});

// 删除文件
CAT_fileStorage("delete", {
  path: "data/old.json",
  onload: () => console.log("删除成功"),
});

// 打开存储配置
CAT_fileStorage("config");
```

**错误码**：
| code | 含义 |
|------|------|
| 1 | 存储未配置 |
| 2 | 配置错误 |
| 3 | 路径不存在 |
| 4 | 上传失败 |
| 5 | 下载失败 |
| 6 | 删除失败 |
| 7 | 文件路径不允许 |
| 8 | 网络错误 |

---

## GM_registerMenuCommand 扩展选项

ScriptCat 对标准 `GM_registerMenuCommand` 增加了以下选项：

```js
GM_registerMenuCommand("菜单项", callback, {
  accessKey: "m",
  autoClose: true,
  nested: false,      // SC: false 时提升到浏览器右键菜单
  individual: true,   // SC: 不合并同名菜单项
});

// GM.registerMenuCommand 额外支持：
await GM.registerMenuCommand("菜单项", callback, {
  icon: "https://example.com/icon.png", // SC: 菜单图标
  closeOnClick: true,                    // SC: alias for autoClose
});
```

---

## CAT.agent.* — Agent API

ScriptCat Agent 扩展 API，用于在用户脚本中调用 AI 能力和浏览器自动化。每个子 API 需单独声明 `@grant`。

### CAT.agent.conversation — AI 对话

创建 LLM 对话，支持工具调用和流式输出。

```js
// @grant CAT.agent.conversation

const conv = await CAT.agent.conversation.create({
  system: "你是一个翻译助手",
  model: "model-id",       // 可选，默认使用用户配置的模型
  maxIterations: 10,
  tools: [{
    name: "get_page_text",
    description: "获取当前页面文本",
    parameters: { type: "object", properties: {} },
    handler: async () => document.body.innerText.slice(0, 5000),
  }],
});

// 非流式
const reply = await conv.chat("翻译这段话：Hello World");
console.log(reply.content);

// 流式
const stream = await conv.chatStream("翻译页面内容");
for await (const chunk of stream) {
  if (chunk.type === "content_delta") process.stdout.write(chunk.content);
  if (chunk.type === "tool_call") console.log("调用工具:", chunk.toolCall.name);
  if (chunk.type === "error") console.error(chunk.error);
}
```

### CAT.agent.dom — 浏览器 DOM 操作

```js
// @grant CAT.agent.dom

const tabs = await CAT.agent.dom.listTabs();
await CAT.agent.dom.navigate("https://example.com", { tabId: tabs[0].tabId });
const page = await CAT.agent.dom.readPage({ tabId: tabs[0].tabId, selector: "main" });
const screenshot = await CAT.agent.dom.screenshot({ tabId: tabs[0].tabId });
await CAT.agent.dom.click("#button", { tabId: tabs[0].tabId, trusted: true });
await CAT.agent.dom.fill("input[name=q]", "text", { tabId: tabs[0].tabId });
await CAT.agent.dom.scroll("down", { tabId: tabs[0].tabId });
await CAT.agent.dom.waitFor(".result", { tabId: tabs[0].tabId, timeout: 5000 });
const result = await CAT.agent.dom.executeScript("return document.title", { tabId: tabs[0].tabId });
```

### CAT.agent.task — 定时任务管理

```js
// @grant CAT.agent.task

// 创建定时任务（Agent 自动执行 prompt）
const task = await CAT.agent.task.create({
  name: "每日检查",
  crontab: "0 9 * * *",
  mode: "internal",
  enabled: true,
  prompt: "检查仪表盘并汇总异常",
  skills: "auto",
});

// 创建事件模式任务（脚本自己处理）
const eventTask = await CAT.agent.task.create({
  name: "数据同步",
  crontab: "0 */30 * * *",
  mode: "event",
  enabled: true,
});
CAT.agent.task.addListener(eventTask.id, (trigger) => {
  console.log("触发:", trigger.name, trigger.triggeredAt);
});
```

### CAT.agent.skills — Skill 管理

```js
// @grant CAT.agent.skills

const skills = await CAT.agent.skills.list();
const result = await CAT.agent.skills.call("browser-automation", "screenshot", { tabId: 123 });
```

### CAT.agent.model — 模型查询

```js
// @grant CAT.agent.model

const models = await CAT.agent.model.list();
const defaultId = await CAT.agent.model.getDefault();
```

### CAT.agent.opfs — 工作区文件系统

```js
// @grant CAT.agent.opfs

await CAT.agent.opfs.write("data/report.txt", "内容...");
const file = await CAT.agent.opfs.read("data/report.txt");
const entries = await CAT.agent.opfs.list("data/");
await CAT.agent.opfs.delete("data/old.txt");
```

---

## 完整后台脚本示例

```js
// ==UserScript==
// @name         价格监控
// @namespace    https://scriptcat.org/
// @version      0.1.0
// @description  每小时检查商品价格，降价时通知 // ScriptCat only
// @background
// @crontab      0 0 * * * *
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @connect      api.example.com
// ==/UserScript==

"use strict";

const TARGET_URL = "https://api.example.com/product/123";
const PRICE_KEY = "last_price";

try {
  const resp = await GM.xmlHttpRequest({ url: TARGET_URL, responseType: "json" });
  const currentPrice = resp.response.price;
  const lastPrice = await GM.getValue(PRICE_KEY, Infinity);

  if (currentPrice < lastPrice) {
    GM.notification({
      title: "降价提醒！",
      text: `价格从 ¥${lastPrice} 降到 ¥${currentPrice}`,
      timeout: 0, // 不自动消失
    });
  }

  await GM.setValue(PRICE_KEY, currentPrice);
} catch (e) {
  throw new CATRetryError("检查失败，5 分钟后重试", 300);
}
```
