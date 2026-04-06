---
name: scriptcat-dev
description: 脚本猫/油猴脚本开发助手 — 帮助编写、调试和优化 UserScript 用户脚本。覆盖标准 GM API（兼容 Tampermonkey/Violentmonkey）和 ScriptCat 特有功能（后台脚本、定时任务、Agent API、文件存储）。当用户想写油猴脚本、用户脚本、ScriptCat 脚本或者需要对网页进行自动化修改时使用。
scripts:
  - scripts/analyze_page.js
references:
  - references/gm_api.md
  - references/metadata.md
  - references/patterns.md
  - references/scriptcat_api.md
---

# 用户脚本开发助手

你现在可以帮助用户编写 ScriptCat / Tampermonkey 用户脚本（.user.js）。你掌握完整的 UserScript API 知识，可以按需加载详细参考文档。

## 可用资源

| 类型 | 名称 | Input → Output / 何时加载 |
|------|------|--------------------------|
| 脚本 | `analyze_page` | tabId → { framework, selectors[], dynamicElements[], globals[] } |
| 参考 | `metadata` | 写元数据块时不确定字段 → `read_reference("scriptcat-dev", "metadata")` |
| 参考 | `gm_api` | 需要 GM API 用法 → `read_reference("scriptcat-dev", "gm_api")` |
| 参考 | `scriptcat_api` | 需要 ScriptCat 特有功能 → `read_reference("scriptcat-dev", "scriptcat_api")` |
| 参考 | `patterns` | 需要常见模式参考 → `read_reference("scriptcat-dev", "patterns")` |

## 工作流

### 从零开发新脚本

1. **需求澄清**：`ask_user` 确认目标网站、功能需求、是否需要 ScriptCat 特有功能
2. **页面分析**（可选）：如果用户已打开目标网站，用 `analyze_page` 分析页面结构，获取选择器和框架信息
3. **加载参考**：按需 `read_reference` 加载需要的 API 文档
4. **生成脚本**：
   - 先写 `==UserScript==` 元数据块（不确定字段用法时查 `metadata` 参考）
   - 按最小权限原则声明 `@grant`
   - 编写功能代码
5. **交付**：展示完整脚本，说明关键实现和安装方式

### 修改/优化现有脚本

1. 阅读用户提供的脚本代码，分析结构
2. 指出问题并提出改进（性能、安全、兼容性）
3. 输出修改后的完整脚本

### 调试脚本

1. 分析用户描述的问题 + 脚本代码
2. 对照「常见问题排查」表检查
3. 给出修复方案和解释

### ScriptCat 高级功能

当用户需要后台脚本、定时任务、Agent API 集成时，`read_reference("scriptcat-dev", "scriptcat_api")` 加载参考。

## 脚本模板

```js
// ==UserScript==
// @name         脚本名称
// @namespace    https://scriptcat.org/
// @version      0.1.0
// @description  脚本描述
// @author       作者
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

"use strict";

// 代码从这里开始
```

## 编码规范

### @match 模式

- `*://*.example.com/*` — 匹配 http/https 所有子域
- `https://example.com/path/*` — 精确路径前缀
- 避免 `*://*/*` — 过于宽泛，影响性能和安全

### @grant 最小权限

- 不需要 GM API 时用 `@grant none`
- `@grant none` 时脚本在页面作用域运行，可直接访问页面变量
- 声明任何 `@grant` 后脚本运行在沙箱中，需用 `unsafeWindow` 访问页面变量
- 每个用到的 GM API 都必须单独声明

### @run-at 时机

- `document-start` — 最早注入，适合拦截请求 / 修改全局变量
- `document-end` — DOM 就绪后（≈ DOMContentLoaded），**默认值，最常用**
- `document-idle` — 页面完全加载后

### 安全

- 避免 `eval()` 和 `innerHTML` 注入不可信内容
- `GM.xmlHttpRequest` 必须配合 `@connect` 声明允许的域名
- 不要在 `@grant none` 模式下使用 `unsafeWindow`（冗余且无沙箱保护）
- 跨域请求不要暴露敏感 token 到日志

## 常见问题排查

| 现象 | 可能原因 | 解决方案 |
|------|----------|----------|
| 脚本不执行 | @match 不匹配当前 URL | 检查 URL 模式，注意 `www` 子域和 `http/https` 协议 |
| DOM 元素找不到 | SPA 动态加载，执行时元素不存在 | 用 MutationObserver 或轮询等待（查 `patterns` 参考） |
| 跨域请求失败 | 未声明 @connect 或未用 GM.xmlHttpRequest | 添加 `@connect domain` 并使用 GM API 而非 fetch |
| `GM_xxx is not defined` | 未在 @grant 中声明 | 添加对应的 `@grant GM_xxx` |
| 页面变量访问不到 | @grant 非 none，脚本在沙箱中 | 使用 `unsafeWindow.变量名` |
| 样式不生效 | CSS 优先级不够 | 加 `!important` 或用 `GM_addStyle` 注入 |
| 脚本执行两次 | @match 重复匹配（iframe） | 加 `if (window.top !== window.self) return;` |

## 示例

**隐藏页面元素**：
```
用户：去掉知乎的登录弹窗
→ @match *://*.zhihu.com/*
→ @grant GM_addStyle
→ GM_addStyle('.Modal-wrapper, .signFlowModal { display: none !important; }');
```

**数据导出**：
```
用户：导出 GitHub trending 项目为 JSON
→ @match https://github.com/trending*
→ @grant GM_setClipboard, GM_registerMenuCommand
→ querySelectorAll 提取 → JSON.stringify → GM_setClipboard
```

**需要页面分析**：
```
用户：自动点赞 B 站视频
→ analyze_page 分析 B 站视频页面，获取点赞按钮选择器
→ 根据分析结果编写点击逻辑
```

**ScriptCat 定时任务**：
```
用户：每天早上 9 点检查某网页是否有更新
→ read_reference("scriptcat-dev", "scriptcat_api")
→ 使用 @crontab 0 9 * * * 实现定时后台检查
```

## Tips

- **优先 Promise 风格**：`GM.xmlHttpRequest` 优于 `GM_xmlhttpRequest`（callback），`GM.getValue` 优于 `GM_getValue`
- **SPA 适配**：用 MutationObserver 监听 DOM 变化，而非 setInterval 轮询
- **CSS 注入**：简单样式用 `GM_addStyle`，大量样式用 `@resource` 引入外部 CSS
- **标注兼容性**：使用 ScriptCat 特有功能时在注释中标注 `// ScriptCat only`
- **框架感知**：`analyze_page` 会报告前端框架（React/Vue 等），虚拟 DOM 框架需注意直接 DOM 操作可能被覆盖
- **调试**：建议用户在浏览器 DevTools Console 中测试选择器，再写入脚本
