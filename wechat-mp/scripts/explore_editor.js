// ==SkillScript==
// @name         explore_editor
// @description  探索微信公众号编辑器的 DOM 结构，返回可操作元素的选择器信息（编辑区域、输入框、按钮、UEditor 状态等）
// @param        tabId number [required] 编辑器所在的标签页 ID
// @grant        CAT.agent.dom
// ==/SkillScript==

// 必须使用 MAIN world 才能访问 window.UE（UEditor 页面全局变量）
const result = await CAT.agent.dom.executeScript(
  `
  var info = {
    url: window.location.href,
    editables: [],
    inputs: [],
    buttons: [],
    ueditor: false,
    ueditorReady: false
  };

  // 查找所有 contenteditable 元素
  var editableEls = document.querySelectorAll('[contenteditable="true"]');
  for (var i = 0; i < editableEls.length; i++) {
    var el = editableEls[i];
    info.editables.push({
      tag: el.tagName,
      id: el.id || null,
      className: (el.className || '').substring(0, 200),
      parentId: el.parentElement ? el.parentElement.id : null,
      contentLength: el.innerHTML.length
    });
  }

  // 查找关键输入框
  var inputSels = ['#title', '#author', '#js_description', '#digest', '#original_article_url'];
  for (var j = 0; j < inputSels.length; j++) {
    var inp = document.querySelector(inputSels[j]);
    if (inp) {
      info.inputs.push({
        selector: inputSels[j],
        tag: inp.tagName,
        value: (inp.value || inp.textContent || '').substring(0, 100),
        placeholder: inp.placeholder || ''
      });
    }
  }

  // 查找关键按钮
  var btnSels = ['#js_submit', '#js_send', '#js_preview'];
  for (var k = 0; k < btnSels.length; k++) {
    var btn = document.querySelector(btnSels[k]);
    if (btn) {
      info.buttons.push({
        selector: btnSels[k],
        text: btn.textContent ? btn.textContent.trim() : '',
        disabled: btn.disabled || false
      });
    }
  }

  // 检测 UEditor（需要 MAIN world）
  if (window.UE) {
    info.ueditor = true;
    try {
      var ue = window.UE.getEditor('ueditor_0');
      info.ueditorReady = ue && typeof ue.setContent === 'function';
    } catch (e) {
      info.ueditorReady = false;
    }
  }

  return info;
  `,
  { tabId: args.tabId, world: 'MAIN' }
);

return result;
