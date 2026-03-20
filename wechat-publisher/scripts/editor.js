// ==SkillScript==
// @name         editor
// @description  探索或注入内容到微信公众号编辑器（ProseMirror/UEditor），支持上传封面图
// @param        tabId number [required] 编辑器所在的标签页 ID
// @param        action string[explore,inject,upload_cover] [required] explore=探索编辑器结构，inject=注入内容，upload_cover=上传封面图
// @param        title string 文章标题（inject 时使用）
// @param        content string 正文内容，HTML 格式（inject 时使用）
// @param        digest string 摘要（inject 时可选）
// @param        author string 作者（inject 时可选）
// @param        imageData string 图片 base64 data URL（upload_cover 时使用）
// @grant        CAT.agent.dom
// @timeout      60000
// ==/SkillScript==

const { tabId, action } = args;

// CAT.agent.dom.executeScript 返回 {result, tabId} 包装对象，提取实际值
const unwrap = (v) =>
  v && typeof v === 'object' && 'result' in v ? v.result : v;

// ==================== 探索编辑器 ====================
if (action === 'explore') {
  return unwrap(
    await CAT.agent.dom.executeScript(
      `
    var info = {
      platform: 'wechat',
      url: window.location.href,
      editables: [],
      inputs: [],
      buttons: [],
      proseMirror: false,
      ueditor: false
    };

    var pm = document.querySelector('.ProseMirror');
    if (pm) {
      info.proseMirror = true;
      info.proseMirrorEditable = pm.getAttribute('contenteditable') === 'true';
    }

    if (window.UE) {
      info.ueditor = true;
      try {
        var ue = window.UE.getEditor('ueditor_0');
        info.ueditorReady = ue && typeof ue.setContent === 'function';
      } catch (e) { info.ueditorReady = false; }
    }

    var editableEls = document.querySelectorAll('[contenteditable="true"]');
    for (var i = 0; i < editableEls.length; i++) {
      var el = editableEls[i];
      info.editables.push({
        tag: el.tagName, id: el.id || null,
        className: (el.className || '').substring(0, 200),
        contentLength: el.innerHTML.length
      });
    }

    ['#title', '#author', '#js_description', '#digest'].forEach(function(sel) {
      var inp = document.querySelector(sel);
      if (inp) info.inputs.push({
        selector: sel, tag: inp.tagName,
        value: (inp.value || inp.textContent || '').substring(0, 100),
        placeholder: inp.placeholder || ''
      });
    });

    ['#js_submit', '#js_send', '#js_preview'].forEach(function(sel) {
      var btn = document.querySelector(sel);
      if (btn) info.buttons.push({
        selector: sel, text: btn.textContent ? btn.textContent.trim() : '',
        disabled: btn.disabled || false
      });
    });

    return info;
    `,
      { tabId }
    )
  );
}

// ==================== 注入内容 ====================
if (action === 'inject') {
  if (!args.title && !args.content) {
    return { error: 'inject 模式需要提供 title 或 content' };
  }

  const results = { title: false, content: false, errors: [] };

  if (args.content) {
    const CHUNK_SIZE = 30000;
    const contentStr = args.content;

    await CAT.agent.dom.executeScript(
      `var existing = document.getElementById('__sc_inject_content__');
       if (existing) existing.remove();
       var ta = document.createElement('textarea');
       ta.id = '__sc_inject_content__';
       ta.style.display = 'none';
       document.body.appendChild(ta);
       return true;`,
      { tabId }
    );

    for (let i = 0; i < contentStr.length; i += CHUNK_SIZE) {
      const chunk = JSON.stringify(contentStr.substring(i, i + CHUNK_SIZE));
      const isFirst = i === 0;
      await CAT.agent.dom.executeScript(
        `var ta = document.getElementById('__sc_inject_content__');
         if (!ta) return false;
         ${isFirst ? 'ta.value = ' : 'ta.value += '}${chunk};
         return true;`,
        { tabId }
      );
    }

    const contentResult = unwrap(
      await CAT.agent.dom.executeScript(
        `
      var ta = document.getElementById('__sc_inject_content__');
      var content = ta ? ta.value : '';
      if (ta) ta.remove();
      if (!content) return { ok: false, error: '临时节点为空' };

      // 模拟粘贴事件注入 HTML（ProseMirror 会正确解析 HTML，insertHTML 会被转为纯文本）
      function pasteHTML(el, html) {
        el.focus();
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        var plain = tempDiv.textContent || tempDiv.innerText || '';
        var pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
        Object.defineProperty(pasteEvent, 'clipboardData', {
          value: {
            getData: function(type) {
              if (type === 'text/html') return html;
              if (type === 'text/plain') return plain;
              return '';
            },
            types: ['text/html', 'text/plain'],
            items: [],
            files: []
          }
        });
        el.dispatchEvent(pasteEvent);
      }

      var pm = document.querySelector('.ProseMirror');
      if (pm) {
        pasteHTML(pm, content);
        return { ok: true, method: 'ProseMirror' };
      }

      if (window.UE && window.UE.getEditor) {
        try {
          var ue = window.UE.getEditor('ueditor_0');
          ue.setContent(content);
          return { ok: true, method: 'UEditor' };
        } catch (e) { /* fallback */ }
      }

      var editor = document.querySelector('.edui-body-container')
        || document.querySelector('[contenteditable="true"]');
      if (editor) {
        pasteHTML(editor, content);
        return { ok: true, method: 'contenteditable' };
      }

      return { ok: false, error: '未找到编辑器' };
      `,
        { tabId }
      )
    );

    results.content = contentResult && contentResult.ok;
    results.contentMethod = contentResult ? contentResult.method : null;
    if (!results.content) {
      results.errors.push(
        'content: ' + (contentResult ? contentResult.error : '注入失败')
      );
    }
  }

  async function fillField(selector, value, fieldName) {
    if (!value) return null;
    try {
      const exists = unwrap(
        await CAT.agent.dom.executeScript(
          `return !!document.querySelector('${selector}');`,
          { tabId }
        )
      );
      if (!exists) {
        results.errors.push(
          fieldName + ': 未找到元素 (' + selector + ')'
        );
        return false;
      }
      await CAT.agent.dom.fill(selector, value, { tabId, trusted: true });
      return true;
    } catch (e) {
      results.errors.push(fieldName + ': ' + (e.message || e));
      return false;
    }
  }

  results.title = await fillField('#title', args.title, 'title');
  results.author = await fillField('#author', args.author, 'author');
  results.digest = await fillField(
    '#js_description',
    args.digest,
    'digest'
  );

  return results;
}

// ==================== 上传封面图 ====================
if (action === 'upload_cover') {
  if (!args.imageData) {
    return { error: 'upload_cover 需要提供 imageData（base64 data URL）' };
  }

  // 第1步：点击封面区域 → 从图片库选择
  await CAT.agent.dom.executeScript(
    `var btn = document.querySelector('.js_cover_btn_area'); if (btn) btn.click();`,
    { tabId }
  );
  await new Promise((r) => setTimeout(r, 500));

  const imgBtnClicked = unwrap(
    await CAT.agent.dom.executeScript(
      `var area = document.querySelector('#js_cover_area');
     var btn = area ? area.querySelector('.js_imagedialog') : null;
     if (btn) { btn.click(); return true; }
     return false;`,
      { tabId }
    )
  );
  if (!imgBtnClicked) {
    return { error: '未找到「从图片库选择」按钮' };
  }
  await new Promise((r) => setTimeout(r, 1500));

  // 第2步：上传图片到图片库弹窗
  const imageDataJson = JSON.stringify(args.imageData);
  await CAT.agent.dom.executeScript(
    `
    var allInputs = document.querySelectorAll('input[type="file"]');
    var dialogInput = null;
    for (var i = 0; i < allInputs.length; i++) {
      var p = allInputs[i];
      while (p) {
        if ((p.className || '').match(/dialog/i)) { dialogInput = allInputs[i]; break; }
        p = p.parentElement;
      }
      if (dialogInput) break;
    }
    if (!dialogInput) return false;

    var dataUrl = ${imageDataJson};
    var arr = dataUrl.split(',');
    var mime = arr[0].match(/:(.*?);/)[1];
    var bstr = atob(arr[1]);
    var n = bstr.length;
    var u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    var file = new File([u8arr], 'cover_' + Date.now() + '.png', { type: mime });

    var dt = new DataTransfer();
    dt.items.add(file);
    dialogInput.files = dt.files;
    dialogInput.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
    `,
    { tabId }
  );
  await new Promise((r) => setTimeout(r, 3000));

  // 第3步：确认自动选中，点击「下一步」
  const step3 = unwrap(
    await CAT.agent.dom.executeScript(
      `
    var selected = document.querySelector('.weui-desktop-img-picker__item.selected');
    if (!selected) return { ok: false, error: '没有选中的图片' };

    var allBtns = document.querySelectorAll('.weui-desktop-dialog button, .weui-desktop-dialog a');
    for (var j = 0; j < allBtns.length; j++) {
      if (allBtns[j].textContent.trim() === '下一步' && allBtns[j].offsetParent !== null) {
        allBtns[j].click();
        return { ok: true };
      }
    }
    return { ok: false, error: '未找到下一步按钮' };
    `,
      { tabId }
    )
  );
  if (!step3 || !step3.ok) {
    return { error: '下一步失败: ' + (step3 ? step3.error : '未知') };
  }
  await new Promise((r) => setTimeout(r, 2000));

  // 第4步：点击「确认」（裁剪页面）
  unwrap(
    await CAT.agent.dom.executeScript(
      `
    var allBtns = document.querySelectorAll('.weui-desktop-dialog button, .weui-desktop-dialog a');
    for (var k = 0; k < allBtns.length; k++) {
      if (allBtns[k].textContent.trim() === '确认' && allBtns[k].offsetParent !== null) {
        allBtns[k].click();
        return true;
      }
    }
    return false;
    `,
      { tabId }
    )
  );
  await new Promise((r) => setTimeout(r, 2000));

  // 验证结果
  const success = unwrap(
    await CAT.agent.dom.executeScript(
      `
    var area = document.querySelector('#js_cover_area');
    if (!area) return false;
    var previews = area.querySelectorAll('[class*="preview"]');
    for (var i = 0; i < previews.length; i++) {
      if (previews[i].offsetParent !== null) return true;
    }
    return false;
    `,
      { tabId }
    )
  );

  return {
    success: !!success,
    message: success ? '封面图设置成功' : '封面图设置失败',
  };
}

return {
  error:
    '无效的 action: ' +
    action +
    '，可选: explore, inject, upload_cover',
};
