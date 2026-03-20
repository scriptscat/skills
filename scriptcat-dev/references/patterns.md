# 常见开发模式

用户脚本常用代码模式速查。

---

## 等待元素出现

### MutationObserver（推荐）

适用于 SPA 和动态加载页面。

```js
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (timeout > 0) {
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`等待 ${selector} 超时`));
      }, timeout);
    }
  });
}

// 使用
const btn = await waitForElement(".submit-btn");
btn.click();
```

### 轮询（简单场景）

```js
function waitForElement(selector, interval = 500, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error(`等待 ${selector} 超时`));
      }
    }, interval);
  });
}
```

---

## SPA 路由变化检测

### History API 拦截

```js
// 拦截 pushState / replaceState
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

function onRouteChange() {
  console.log("路由变化:", location.href);
  // 重新执行你的逻辑
}

history.pushState = function (...args) {
  originalPushState.apply(this, args);
  onRouteChange();
};
history.replaceState = function (...args) {
  originalReplaceState.apply(this, args);
  onRouteChange();
};
window.addEventListener("popstate", onRouteChange);
```

### URL 轮询（兼容方案）

```js
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    onRouteChange();
  }
}, 1000);
```

---

## XHR / Fetch 拦截

### 拦截 XMLHttpRequest

需在 `@run-at document-start` 执行。

```js
// @run-at document-start
// @grant none

const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url, ...args) {
  this._url = url;
  this._method = method;
  return originalOpen.call(this, method, url, ...args);
};

XMLHttpRequest.prototype.send = function (body) {
  this.addEventListener("load", function () {
    if (this._url.includes("/api/data")) {
      const data = JSON.parse(this.responseText);
      console.log("拦截到数据:", data);
    }
  });
  return originalSend.call(this, body);
};
```

### 拦截 Fetch

```js
// @run-at document-start
// @grant none

const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : input.url;
  const response = await originalFetch.call(this, input, init);

  if (url.includes("/api/data")) {
    const clone = response.clone();
    clone.json().then(data => {
      console.log("拦截到 Fetch 数据:", data);
    });
  }

  return response;
};
```

---

## CSS 注入

### GM_addStyle（简单样式）

```js
// @grant GM_addStyle

GM_addStyle(`
  /* 隐藏广告 */
  .ad-banner, [class*="advertisement"] {
    display: none !important;
  }

  /* 自定义样式 */
  .my-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 2147483647;
    background: white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
`);
```

### @resource 外部 CSS

```js
// @resource     customCSS https://example.com/style.css
// @grant        GM_getResourceText
// @grant        GM_addStyle

const css = GM_getResourceText("customCSS");
GM_addStyle(css);
```

### 动态切换样式

```js
// @grant GM_addStyle
// @grant GM_registerMenuCommand

let styleEl = null;
let enabled = false;

GM_registerMenuCommand("切换暗色模式", () => {
  if (enabled) {
    styleEl?.remove();
    styleEl = null;
  } else {
    styleEl = GM_addStyle(`
      html { filter: invert(1) hue-rotate(180deg); }
      img, video { filter: invert(1) hue-rotate(180deg); }
    `);
  }
  enabled = !enabled;
});
```

---

## 数据导出

### 复制到剪贴板

```js
// @grant GM_setClipboard
// @grant GM_registerMenuCommand

GM_registerMenuCommand("导出数据", () => {
  const items = document.querySelectorAll(".item");
  const data = Array.from(items).map(el => ({
    title: el.querySelector(".title")?.textContent?.trim(),
    link: el.querySelector("a")?.href,
  }));
  GM_setClipboard(JSON.stringify(data, null, 2));
  alert(`已复制 ${data.length} 条数据到剪贴板`);
});
```

### 下载为文件

```js
function downloadFile(content, filename, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 导出 CSV
const csv = "标题,链接\n" + data.map(d => `"${d.title}","${d.link}"`).join("\n");
downloadFile(csv, "export.csv", "text/csv");

// 导出 JSON
downloadFile(JSON.stringify(data, null, 2), "export.json", "application/json");
```

---

## 键盘快捷键

```js
document.addEventListener("keydown", (e) => {
  // Ctrl+Shift+K 触发
  if (e.ctrlKey && e.shiftKey && e.key === "K") {
    e.preventDefault();
    togglePanel();
  }
});
```

---

## 防抖与节流

```js
// 防抖：连续触发只执行最后一次
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流：固定间隔最多执行一次
function throttle(fn, interval = 300) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// 监听页面滚动（节流）
window.addEventListener("scroll", throttle(() => {
  console.log("scroll position:", window.scrollY);
}, 200));
```

---

## 跨 iframe 通信

### postMessage

```js
// 主页面脚本
window.addEventListener("message", (e) => {
  if (e.data?.type === "MY_SCRIPT_DATA") {
    console.log("收到 iframe 数据:", e.data.payload);
  }
});

// iframe 内脚本（@match 匹配 iframe URL）
window.parent.postMessage({
  type: "MY_SCRIPT_DATA",
  payload: { key: "value" },
}, "*");
```

### GM_setValue 跨标签页同步

```js
// 脚本 A（发送）
// @grant GM_setValue
await GM.setValue("shared_data", { updated: Date.now(), items: [...] });

// 脚本 B（接收）
// @grant GM_addValueChangeListener
GM_addValueChangeListener("shared_data", (name, oldVal, newVal, remote) => {
  if (remote) {
    console.log("来自其他实例的更新:", newVal);
  }
});
```

---

## 浮动面板 UI

```js
// @grant GM_addStyle
// @grant GM_registerMenuCommand

function createPanel() {
  GM_addStyle(`
    #my-panel {
      position: fixed; top: 60px; right: 20px; z-index: 2147483647;
      width: 320px; background: #fff; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: none;
    }
    #my-panel.visible { display: block; }
    #my-panel .header {
      padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #eee;
      display: flex; justify-content: space-between; align-items: center;
    }
    #my-panel .body { padding: 16px; max-height: 400px; overflow-y: auto; }
    #my-panel .close { cursor: pointer; border: none; background: none; font-size: 18px; }
  `);

  const panel = document.createElement("div");
  panel.id = "my-panel";
  panel.innerHTML = `
    <div class="header">
      <span>我的面板</span>
      <button class="close">&times;</button>
    </div>
    <div class="body">内容区域</div>
  `;
  document.body.appendChild(panel);

  panel.querySelector(".close").onclick = () => panel.classList.remove("visible");
  return panel;
}

const panel = createPanel();
GM_registerMenuCommand("显示面板", () => panel.classList.toggle("visible"));
```

---

## 页面元素批量操作

```js
// 移除所有匹配元素
function removeAll(selector) {
  document.querySelectorAll(selector).forEach(el => el.remove());
}

// 持续移除（对付动态加载的广告）
function keepRemoving(selector) {
  removeAll(selector);
  const observer = new MutationObserver(() => removeAll(selector));
  observer.observe(document.body, { childList: true, subtree: true });
  return observer; // 返回以便需要时断开
}

keepRemoving(".ad-container, [class*='sponsor']");
```
