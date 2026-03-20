# GM API 参考

标准 Greasemonkey / Tampermonkey API，ScriptCat 完全兼容。每个 API 需在 `@grant` 中声明。

> **命名约定**：`GM_xxx` 是传统回调风格，`GM.xxx` 是 Promise 风格。功能相同，推荐使用 `GM.xxx`。

---

## 跨域请求

### GM.xmlHttpRequest / GM_xmlhttpRequest

绕过浏览器同源策略发送 HTTP 请求。需配合 `@connect` 声明目标域名。

```js
// @grant GM_xmlhttpRequest
// @connect api.example.com

// Promise 风格（推荐）
const resp = await GM.xmlHttpRequest({
  method: "GET",
  url: "https://api.example.com/data",
  headers: { "Authorization": "Bearer token" },
  responseType: "json",
});
console.log(resp.response); // 已解析的 JSON

// POST 请求
const resp2 = await GM.xmlHttpRequest({
  method: "POST",
  url: "https://api.example.com/submit",
  headers: { "Content-Type": "application/json" },
  data: JSON.stringify({ key: "value" }),
});

// 带进度的下载
GM_xmlhttpRequest({
  method: "GET",
  url: "https://example.com/large-file",
  responseType: "blob",
  onprogress: (e) => console.log(`${e.loaded}/${e.total}`),
  onload: (resp) => { /* resp.response 是 Blob */ },
  onerror: (err) => console.error(err),
});
```

**XHRDetails 常用字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| method | string | GET/POST/PUT/DELETE/PATCH |
| url | string | 请求地址 |
| headers | object | 自定义请求头 |
| data | string/Blob/FormData | 请求体 |
| responseType | string | text/json/blob/arraybuffer/document/stream |
| timeout | number | 超时毫秒数 |
| anonymous | boolean | 不发送 cookie |
| cookie | string | 自定义 cookie 字符串 |
| redirect | string | follow/error/manual |
| nocache | boolean | 禁用缓存 |

**XHRResponse 字段**：

| 字段 | 说明 |
|------|------|
| status | HTTP 状态码 |
| statusText | 状态文本 |
| responseText | 响应文本 |
| response | 按 responseType 解析的响应 |
| responseHeaders | 响应头字符串 |
| finalUrl | 重定向后的最终 URL |

---

## 持久化存储

### GM.getValue / GM_getValue

读取存储的值。

```js
// @grant GM_getValue
const token = await GM.getValue("token", "");          // 默认空字符串
const config = await GM.getValue("config", { a: 1 });  // 默认对象
```

### GM.setValue / GM_setValue

写入存储的值。支持基本类型和可序列化的对象。

```js
// @grant GM_setValue
await GM.setValue("token", "abc123");
await GM.setValue("config", { theme: "dark", fontSize: 14 });
```

### GM.deleteValue / GM_deleteValue

```js
// @grant GM_deleteValue
await GM.deleteValue("token");
```

### GM.listValues / GM_listValues

列出所有存储的 key。

```js
// @grant GM_listValues
const keys = await GM.listValues(); // ["token", "config"]
```

### 批量操作（ScriptCat / TM 5+）

```js
// @grant GM_getValues
// @grant GM_setValues
// @grant GM_deleteValues
const vals = await GM.getValues({ token: "", count: 0 }); // 带默认值
await GM.setValues({ token: "new", count: 5 });
await GM.deleteValues(["token", "count"]);
```

### GM.addValueChangeListener / GM_addValueChangeListener

监听存储值变化（跨标签页同步）。

```js
// @grant GM_addValueChangeListener
const listenerId = await GM.addValueChangeListener("config", (name, oldVal, newVal, remote) => {
  // remote=true 表示来自其他标签页/脚本实例
  console.log(`${name} changed:`, oldVal, "→", newVal);
});

// 移除监听
// @grant GM_removeValueChangeListener
await GM.removeValueChangeListener(listenerId);
```

---

## 页面操作

### GM.addStyle / GM_addStyle

注入 CSS 样式。返回 `<style>` 元素。

```js
// @grant GM_addStyle
GM_addStyle(`
  .annoying-ad { display: none !important; }
  .my-widget { position: fixed; bottom: 20px; right: 20px; z-index: 99999; }
`);
```

### GM.addElement / GM_addElement

向页面添加 DOM 元素。

```js
// @grant GM_addElement

// 添加到 document.head
GM_addElement("link", { rel: "stylesheet", href: "https://example.com/style.css" });

// 添加到指定父元素
const container = document.getElementById("app");
GM_addElement(container, "div", { id: "my-widget", textContent: "Hello" });
```

---

## 菜单与交互

### GM.registerMenuCommand / GM_registerMenuCommand

在脚本管理器弹出菜单中注册命令。

```js
// @grant GM_registerMenuCommand
const menuId = GM_registerMenuCommand("打开设置", () => {
  // 用户点击时执行
  showSettingsPanel();
});

// 带选项
GM_registerMenuCommand("切换模式", toggleMode, {
  accessKey: "m",      // 快捷键
  autoClose: true,     // 点击后关闭弹出菜单
});

// 取消注册
// @grant GM_unregisterMenuCommand
GM_unregisterMenuCommand(menuId);
```

### GM.notification / GM_notification

显示桌面通知。

```js
// @grant GM_notification
GM.notification({
  title: "任务完成",
  text: "数据已导出到剪贴板",
  image: "https://example.com/icon.png",
  timeout: 5000,
  onclick: () => { window.focus(); },
});

// 简写
GM.notification("通知内容", "标题");

// 带按钮（ScriptCat）
GM.notification({
  title: "确认操作",
  text: "是否继续？",
  buttons: [{ title: "确认" }, { title: "取消" }],
  onclick: (event) => {
    if (event.isButtonClick) {
      console.log("点击了按钮:", event.buttonClickIndex); // 0 或 1
    }
  },
});
```

### GM.setClipboard / GM_setClipboard

复制文本到剪贴板。

```js
// @grant GM_setClipboard
GM_setClipboard("复制的文本内容");
GM_setClipboard("<b>HTML</b>", "text/html"); // 复制 HTML
```

---

## 标签页管理

### GM.openInTab / GM_openInTab

打开新标签页。

```js
// @grant GM_openInTab
const tab = GM_openInTab("https://example.com", {
  active: true,    // 是否前台打开
  insert: true,    // 插入到当前标签旁
  setParent: true, // 关联父标签
});

// 监听关闭
tab.onclose = () => console.log("标签页已关闭");
// 手动关闭
tab.close();
```

---

## 资源访问

### GM_getResourceText

获取 `@resource` 声明的文本内容。

```js
// @resource     myCSS https://example.com/style.css
// @grant        GM_getResourceText
// @grant        GM_addStyle

const css = GM_getResourceText("myCSS");
GM_addStyle(css);
```

### GM_getResourceURL

获取 `@resource` 的 URL（blob: 或 data: URL）。

```js
// @resource     myIcon https://example.com/icon.png
// @grant        GM_getResourceURL

const iconUrl = GM_getResourceURL("myIcon");
img.src = iconUrl;
```

---

## 下载

### GM.download / GM_download

下载文件到本地。

```js
// @grant GM_download
GM_download({
  url: "https://example.com/file.pdf",
  name: "document.pdf",
  saveAs: true,  // 弹出另存为对话框
  onprogress: (e) => console.log(`${e.loaded}/${e.total}`),
  onload: () => console.log("下载完成"),
  onerror: (e) => console.error("下载失败:", e.error),
});

// 简写
GM_download("https://example.com/file.pdf", "document.pdf");
```

---

## Cookie 操作

### GM.cookie（ScriptCat / TM 4.18+）

需要 `@grant GM_cookie`。

```js
// @grant GM_cookie

// 列出 cookie
const cookies = await GM.cookie.list({ domain: "example.com" });

// 设置 cookie
await GM.cookie.set({
  url: "https://example.com",
  name: "token",
  value: "abc123",
  path: "/",
  secure: true,
});

// 删除 cookie
await GM.cookie.delete({ name: "token", url: "https://example.com" });
```

---

## 日志

### GM_log（ScriptCat）

```js
// @grant GM_log
GM_log("调试信息", "info");
GM_log("发生错误", "error", { module: "parser" });
```

级别：`debug` | `info` | `warn` | `error`

---

## 脚本信息

### GM_info / GM.info

只读对象，包含脚本元数据和运行环境信息。无需 @grant。

```js
console.log(GM_info.scriptHandler);  // "ScriptCat" 或 "Tampermonkey"
console.log(GM_info.version);        // 扩展版本
console.log(GM_info.script.name);    // 脚本名称
console.log(GM_info.script.version); // 脚本版本
console.log(GM_info.script.grant);   // 已声明的 grant 列表
```
