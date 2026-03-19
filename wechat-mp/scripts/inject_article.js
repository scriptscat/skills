// ==SkillScript==
// @name         inject_article
// @description  将文章内容注入微信公众号编辑器。通过临时 DOM 节点中转大文本，避免拼接进脚本字符串。建议先调用 explore_editor 确认编辑器状态。
// @param        tabId number [required] 编辑器所在的标签页 ID
// @param        title string [required] 文章标题
// @param        content string [required] 文章 HTML 正文内容
// @param        digest string 文章摘要（可选）
// @param        author string 作者名（可选）
// @grant        CAT.agent.dom
// ==/SkillScript==

const results = { title: false, content: false, digest: false, author: false, errors: [] };

// ---- 第 1 步：注入正文 ----
// 策略：将 content 分块写入隐藏的 textarea（ISOLATED world 可直接操作 DOM 赋值），
// 然后在 MAIN world 读取并通过 UEditor API 注入编辑器。
// 两个 world 共享同一个 DOM 树，所以临时节点跨 world 可见。

// 1a. 创建临时节点并写入内容（ISOLATED world）
// 注意：textarea.value 赋值不需要元素可见，也不需要触发事件
const contentChunks = [];
const CHUNK_SIZE = 30000; // 每块 30KB，避免单次脚本字符串过大
const contentStr = args.content;

for (let i = 0; i < contentStr.length; i += CHUNK_SIZE) {
  contentChunks.push(contentStr.substring(i, i + CHUNK_SIZE));
}

// 创建临时节点
await CAT.agent.dom.executeScript(
  `var existing = document.getElementById('__sc_inject_content__');
   if (existing) existing.remove();
   var ta = document.createElement('textarea');
   ta.id = '__sc_inject_content__';
   ta.style.display = 'none';
   document.body.appendChild(ta);
   return true;`,
  { tabId: args.tabId }
);

// 分块写入内容
for (let i = 0; i < contentChunks.length; i++) {
  const chunkJson = JSON.stringify(contentChunks[i]);
  const isFirst = i === 0;
  await CAT.agent.dom.executeScript(
    `var ta = document.getElementById('__sc_inject_content__');
     if (!ta) return false;
     ${isFirst ? 'ta.value = ' : 'ta.value += '}${chunkJson};
     return true;`,
    { tabId: args.tabId }
  );
}

// 1b. 在 MAIN world 读取临时节点内容，注入编辑器
const contentResult = await CAT.agent.dom.executeScript(
  `
  var ta = document.getElementById('__sc_inject_content__');
  var content = ta ? ta.value : '';
  if (ta) ta.remove();

  if (!content) return { ok: false, error: 'temp node empty or not found' };

  // 优先使用 UEditor API（最可靠，编辑器内部状态同步）
  if (window.UE && window.UE.getEditor) {
    try {
      var ue = window.UE.getEditor('ueditor_0');
      ue.setContent(content);
      return { ok: true, method: 'UEditor API' };
    } catch (e) { /* fallback to DOM */ }
  }

  // Fallback: 直接操作 contenteditable
  var editor = document.querySelector('.edui-body-container')
    || document.querySelector('[contenteditable="true"]');
  if (editor) {
    editor.focus();
    editor.innerHTML = content;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true, method: 'DOM innerHTML' };
  }

  return { ok: false, error: 'editor element not found' };
  `,
  { tabId: args.tabId, world: 'MAIN' }
);

if (contentResult && contentResult.ok) {
  results.content = true;
  results.contentMethod = contentResult.method;
} else {
  results.errors.push('content: ' + (contentResult ? contentResult.error : 'executeScript failed'));
}

// ---- 第 2 步：设置标题、摘要、作者（使用 trusted fill）----

async function fillField(selector, value, fieldName) {
  if (!value) return null; // 可选字段未提供，跳过
  try {
    const exists = await CAT.agent.dom.executeScript(
      `return !!document.querySelector('${selector}');`,
      { tabId: args.tabId }
    );
    if (!exists) {
      results.errors.push(fieldName + ': element not found (' + selector + ')');
      return false;
    }
    await CAT.agent.dom.fill(selector, value, {
      tabId: args.tabId,
      trusted: true,
    });
    return true;
  } catch (e) {
    results.errors.push(fieldName + ': ' + (e.message || e));
    return false;
  }
}

results.title = await fillField('#title', args.title, 'title');
results.author = await fillField('#author', args.author, 'author');
results.digest = await fillField('#js_description', args.digest, 'digest');

return results;
