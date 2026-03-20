// ==SkillScript==
// @name         analyze_page
// @description  分析目标页面的 DOM 结构，返回前端框架信息、关键交互元素选择器、动态加载区域、全局变量等，辅助用户脚本开发。传入分析目标描述（如"找到评论区的输入框和提交按钮"、"分析页面用了什么框架、有哪些可操作元素"）。
// @param        goal string [required] 分析目标 — 描述你想了解页面的哪些信息（如"找到搜索框选择器"、"分析页面结构和框架"）
// @param        tabId number 目标标签页 ID（默认使用当前活跃标签页）
// @grant        CAT.agent.conversation
// @grant        CAT.agent.dom
// @timeout      120
// ==/SkillScript==

const SYSTEM_PROMPT = `你是一个用户脚本开发辅助分析专家。你的任务是分析网页结构，为编写 Tampermonkey/ScriptCat 用户脚本提供精准的技术信息。

## 你的职责

分析页面并返回对脚本开发有用的信息：
- 页面使用的前端框架和技术栈
- 目标元素的 CSS 选择器（优先稳定选择器）
- 动态内容加载机制（SPA、懒加载、无限滚动等）
- 有用的全局变量和 API 端点
- 适合该页面的脚本开发建议

## 可用工具

- **read_page**: 读取页面骨架 HTML（精简版，只保留定位属性和文本摘要）
  - selector: CSS 选择器缩小范围
  - maxLength: 最大返回长度
- **execute_script**: 在页面中执行 JS 代码，必须用 \`return\` 返回值
  - code: JavaScript 代码
  - **重要**: 代码通过 \`new Function(code)\` 执行，必须用 \`return\` 返回值
  - 正确: \`return document.title\`
  - 错误: \`(() => { return document.title })()\`

## 分析流程

初始消息中已包含页面骨架和基础检测数据，你已掌握页面框架和全局变量信息。

1. **骨架分析**：从已有的 HTML 骨架中定位元素
2. **精确提取**：用 execute_script 获取元素的详细属性（id、class、name、data-* 等）
3. **选择器构造**：优先级 #id > [name] > [data-*] > [aria-label] > .class > 后代选择器

**最多调用 3 次工具，然后回复结果。**

## 回复格式

### 框架与技术栈
列出检测到的框架、版本、技术栈。

### 目标元素分析
针对用户的分析目标，返回：
- 元素选择器 + 说明
- 选择器稳定性评估（是否依赖动态 class）

### 开发建议
针对该页面特点给出脚本编写建议：
- 推荐的 @run-at 时机
- 是否需要 MutationObserver（SPA/动态加载）
- 是否需要拦截 XHR/Fetch
- 其他注意事项`;

// 确定 tabId
let targetTabId = args.tabId;
if (!targetTabId) {
  try {
    const tabs = await CAT.agent.dom.listTabs();
    const activeTab = tabs.find((t) => t.active);
    if (activeTab) {
      targetTabId = activeTab.tabId;
    } else if (tabs.length > 0) {
      targetTabId = tabs[0].tabId;
    } else {
      return "错误：没有找到任何打开的标签页";
    }
  } catch (e) {
    return `错误：获取标签页列表失败: ${e.message || e}`;
  }
}

// 页面骨架读取函数
function buildSkeletonScript(selector, maxLength) {
  return `
    var KEEP_ATTRS = ['id','class','name','type','placeholder','role','aria-label','value','for','action','method','data-testid'];
    var SKIP_TAGS = ['SCRIPT','STYLE','NOSCRIPT','SVG','LINK','META','BR','HR','IMG','VIDEO','AUDIO','CANVAS','IFRAME'];
    var WRAPPER_TAGS = ['DIV','SPAN','SECTION','ARTICLE','MAIN','HEADER','FOOTER','NAV','ASIDE','FIGURE','FIGCAPTION'];
    var TEXT_LIMIT = 100;
    var root = document.querySelector('${selector.replace(/'/g, "\\'")}');
    if (!root) return null;
    function hasAttrs(el) {
      for (var i = 0; i < KEEP_ATTRS.length; i++) {
        if (el.getAttribute(KEEP_ATTRS[i])) return true;
      }
      return false;
    }
    function walk(node, depth) {
      if (depth > 30) return '';
      if (node.nodeType === 3) {
        var t = node.textContent.trim();
        if (!t) return '';
        return t.length > TEXT_LIMIT ? t.slice(0, TEXT_LIMIT) + '...' : t;
      }
      if (node.nodeType !== 1) return '';
      var el = node;
      var tag = el.tagName;
      if (SKIP_TAGS.indexOf(tag) >= 0) return '';
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return '';
      var children = '';
      for (var j = 0; j < el.childNodes.length; j++) {
        children += walk(el.childNodes[j], depth + 1);
      }
      if (!children.trim() && !hasAttrs(el)) return '';
      if (!hasAttrs(el) && WRAPPER_TAGS.indexOf(tag) >= 0) {
        var elementChildren = [];
        for (var k = 0; k < el.childNodes.length; k++) {
          var c = el.childNodes[k];
          if (c.nodeType === 1) elementChildren.push(c);
          else if (c.nodeType === 3 && c.textContent.trim()) elementChildren.push(c);
        }
        if (elementChildren.length <= 1) return children;
      }
      var attrs = '';
      for (var i = 0; i < KEEP_ATTRS.length; i++) {
        var val = el.getAttribute(KEEP_ATTRS[i]);
        if (val) attrs += ' ' + KEEP_ATTRS[i] + '="' + val.replace(/"/g, '&quot;') + '"';
      }
      var lower = tag.toLowerCase();
      return '<' + lower + attrs + '>' + children + '</' + lower + '>';
    }
    var html = walk(root, 0);
    var title = document.title;
    var url = location.href;
    return { title: title, url: url, html: html.slice(0, ${maxLength}), truncated: html.length > ${maxLength} };
  `;
}

async function readPageSkeleton(selector, maxLength) {
  try {
    const result = await CAT.agent.dom.executeScript(
      buildSkeletonScript(selector, maxLength),
      { tabId: targetTabId }
    );
    return result || { title: "", url: "", html: "元素未找到: " + selector };
  } catch (e) {
    return { title: "", url: "", html: `页面读取失败: ${e.message || e}` };
  }
}

// 预读取页面骨架
let initialSkeleton;
try {
  initialSkeleton = await readPageSkeleton("body", 200000);
} catch (e) {
  return `错误：读取页面骨架失败: ${e.message || e}`;
}

// 页面基础检测（框架、全局变量等）
let pageInfo;
try {
  pageInfo = await CAT.agent.dom.executeScript(`
    var info = {};

    // 检测前端框架
    var frameworks = [];
    if (window.__NEXT_DATA__) frameworks.push('Next.js');
    if (window.__NUXT__) frameworks.push('Nuxt.js');
    if (document.querySelector('[data-reactroot], [data-reactid], #__next')) frameworks.push('React');
    if (document.querySelector('[data-v-], [data-server-rendered]') || window.__VUE__) frameworks.push('Vue');
    if (window.angular || document.querySelector('[ng-app], [data-ng-app], [ng-controller]')) frameworks.push('Angular');
    if (window.jQuery || window.$) frameworks.push('jQuery ' + (window.jQuery ? window.jQuery.fn.jquery : ''));
    if (window.Svelte) frameworks.push('Svelte');
    if (document.querySelector('[data-lit-component]')) frameworks.push('Lit');
    info.frameworks = frameworks;

    // 检测 SPA 特征
    info.isSPA = !!(
      window.__NEXT_DATA__ || window.__NUXT__ ||
      document.querySelector('#app, #root, #__next, #__nuxt') ||
      window.history.pushState !== History.prototype.pushState
    );

    // 检测有用的全局变量
    var globals = [];
    var skip = ['chrome','webpackChunk','__webpack','__REACT','__VUE'];
    try {
      for (var key in window) {
        if (key.startsWith('__') && !skip.some(function(s) { return key.startsWith(s); })) {
          globals.push(key);
        }
      }
    } catch(e) {}
    info.globals = globals.slice(0, 20);

    // 页面基本信息
    info.title = document.title;
    info.url = location.href;
    info.charset = document.characterSet;
    info.iframeCount = document.querySelectorAll('iframe').length;
    info.formCount = document.querySelectorAll('form').length;
    info.inputCount = document.querySelectorAll('input, textarea, select').length;
    info.linkCount = document.querySelectorAll('a[href]').length;

    return info;
  `, { tabId: targetTabId });
} catch (e) {
  pageInfo = { error: e.message || String(e) };
}

// 创建子 conversation
let conv;
try {
  conv = await CAT.agent.conversation.create({
    ephemeral: true,
    system: SYSTEM_PROMPT,
    maxIterations: 5,
    tools: [
      {
        name: "read_page",
        description: "读取页面骨架 HTML（精简版）。初始消息已包含完整骨架，仅在需要特定区域细节时使用。",
        parameters: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS 选择器" },
            maxLength: { type: "number", description: "最大返回长度（默认 200000）" },
          },
          required: ["selector"],
        },
        handler: async (handlerArgs) => {
          return await readPageSkeleton(handlerArgs.selector, handlerArgs.maxLength || 200000);
        },
      },
      {
        name: "execute_script",
        description: "在页面执行 JS 代码。通过 new Function(code) 执行，必须用 return 返回值。",
        parameters: {
          type: "object",
          properties: {
            code: { type: "string", description: "JS 代码，必须用 return 返回值" },
          },
          required: ["code"],
        },
        handler: async (handlerArgs) => {
          try {
            return await CAT.agent.dom.executeScript(handlerArgs.code, { tabId: targetTabId });
          } catch (e) {
            return `脚本执行失败: ${e.message || e}`;
          }
        },
      },
    ],
  });
} catch (e) {
  return `错误：创建分析会话失败: ${e.message || e}`;
}

// 组装分析请求
const message = `## 分析目标
${args.goal}

## 页面基础信息
${JSON.stringify(pageInfo, null, 2)}

## 页面骨架
- 标题: ${initialSkeleton.title}
- URL: ${initialSkeleton.url}
${initialSkeleton.truncated ? "- （骨架已截断，可用 read_page 读取局部区域）" : ""}

\`\`\`html
${initialSkeleton.html}
\`\`\``;

try {
  const reply = await conv.chat(message);
  return reply.content;
} catch (e) {
  return `错误：页面分析失败: ${e.message || e}`;
}
