// ==SkillScript==
// @name         editor
// @description  探索或注入内容到平台编辑器。支持微信公众号（ProseMirror/UEditor）和小红书（TipTap）
// @param        platform string[wechat,xiaohongshu] [required] 目标平台
// @param        tabId number [required] 编辑器所在的标签页 ID
// @param        action string[explore,inject,prepare,upload_cover] [required] explore=探索编辑器结构，inject=注入内容，prepare=准备编辑器（小红书：切换tab+上传图片），upload_cover=上传封面图（微信：通过图片库上传）
// @param        title string 文章/笔记标题（inject 时使用）
// @param        content string 正文内容：微信为 HTML，小红书为纯文本（inject 时使用）
// @param        digest string 摘要（微信可选）
// @param        author string 作者（微信可选）
// @param        imageData string 图片 base64 data URL（小红书 prepare 时使用，用于自动上传图片触发编辑器）
// @param        imagePath string OPFS 图片路径（小红书 prepare 时使用，替代 imageData，脚本自动从 OPFS 读取）
// @grant        CAT.agent.dom
// @grant        CAT.agent.opfs
// @timeout      60000
// ==/SkillScript==

const { platform, tabId, action } = args;

// CAT.agent.dom.executeScript 返回 {result, tabId} 包装对象，提取实际值
const unwrap = (v) =>
  v && typeof v === 'object' && 'result' in v ? v.result : v;

// ==================== 准备编辑器（小红书专用）====================
if (action === 'prepare') {
  if (platform !== 'xiaohongshu') {
    return { error: 'prepare 仅支持小红书平台' };
  }

  // 0. 如果传入 imagePath，从 OPFS 读取并转为 imageData
  if (args.imagePath && !args.imageData) {
    try {
      const readResult = await CAT.agent.opfs.read(args.imagePath, 'blob');
      if (readResult && readResult.data) {
        const arrayBuffer = await readResult.data.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 0x8000;
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode.apply(
            null,
            bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))
          );
        }
        args.imageData =
          'data:' +
          (readResult.mimeType || 'image/png') +
          ';base64,' +
          btoa(binary);
      }
    } catch (e) {
      // OPFS 读取失败，回退到占位图
    }
  }

  // 1. 切换到「上传图文」tab（带重试，等待页面加载）
  let tabReady = false;
  for (let retry = 0; retry < 6; retry++) {
    const tabStatus = unwrap(
      await CAT.agent.dom.executeScript(
        `
      // 如果编辑器或文件上传区已存在，说明 tab 已经被点击过
      if (document.querySelector('.tiptap.ProseMirror') ||
          document.querySelector('input[type="file"][accept*="jpg"]')) {
        return 'already_ready';
      }
      var tabs = document.querySelectorAll('.creator-tab');
      for (var i = 0; i < tabs.length; i++) {
        var text = tabs[i].textContent.trim();
        if (text.indexOf('上传图文') >= 0 && tabs[i].offsetParent !== null) {
          tabs[i].click();
          return 'clicked';
        }
      }
      return tabs.length > 0 ? 'not_found' : 'no_tabs';
      `,
        { tabId }
      )
    );

    if (tabStatus === 'clicked' || tabStatus === 'already_ready') {
      tabReady = true;
      break;
    }
    // 页面可能还没加载完，等待后重试
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!tabReady) {
    return { error: '未找到「上传图文」tab，页面可能未加载完成' };
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 2. 上传图片到 file input
  if (args.imageData) {
    unwrap(
      await CAT.agent.dom.executeScript(
        `
      var dataUrl = ${JSON.stringify(args.imageData)};
      var arr = dataUrl.split(',');
      var mime = arr[0].match(/:(.*?);/)[1];
      var bstr = atob(arr[1]);
      var n = bstr.length;
      var u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      var file = new File([u8arr], 'cover.png', { type: mime });

      var fileInput = document.querySelector('input[type="file"][accept*="jpg"]');
      if (!fileInput) return false;

      var dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
      `,
        { tabId }
      )
    );
  } else {
    // 没有图片数据时，生成占位图（用 toDataURL 同步转换，避免 toBlob 异步问题）
    unwrap(
      await CAT.agent.dom.executeScript(
        `
      var canvas = document.createElement('canvas');
      canvas.width = 500; canvas.height = 500;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 500, 500);
      ctx.fillStyle = '#999';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('占位图片', 250, 260);

      var dataUrl = canvas.toDataURL('image/png');
      var arr = dataUrl.split(',');
      var bstr = atob(arr[1]);
      var n = bstr.length;
      var u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      var file = new File([u8arr], 'placeholder.png', { type: 'image/png' });

      var fileInput = document.querySelector('input[type="file"][accept*="jpg"]');
      if (!fileInput) return false;

      var dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
      `,
        { tabId }
      )
    );
  }

  // 3. 轮询等待编辑器出现（最多 10 秒）
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    const ready = unwrap(
      await CAT.agent.dom.executeScript(
        `return !!document.querySelector('.tiptap.ProseMirror');`,
        { tabId }
      )
    );
    if (ready) {
      return { success: true, message: '编辑器已就绪' };
    }
  }

  return {
    success: false,
    message: '编辑器未出现，可能需要手动上传图片',
  };
}

// ==================== 探索编辑器 ====================
if (action === 'explore') {
  if (platform === 'wechat') {
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

  if (platform === 'xiaohongshu') {
    return unwrap(
      await CAT.agent.dom.executeScript(
        `
      var info = {
        platform: 'xiaohongshu',
        url: window.location.href,
        editorReady: false,
        title: null,
        editor: null,
        buttons: []
      };

      var titleInput = document.querySelector('input[placeholder*="标题"]');
      if (titleInput) {
        info.title = {
          found: true,
          placeholder: titleInput.placeholder,
          value: titleInput.value
        };
      }

      var editor = document.querySelector('.tiptap.ProseMirror');
      if (editor) {
        info.editorReady = true;
        info.editor = {
          className: editor.className,
          contentLength: editor.textContent.trim().length,
          parentClass: (editor.parentElement.className || '').substring(0, 100)
        };
      }

      document.querySelectorAll('button').forEach(function(btn) {
        var text = btn.textContent.trim();
        if (text && text.length < 20) {
          info.buttons.push({ text: text, disabled: btn.disabled });
        }
      });

      return info;
      `,
        { tabId }
      )
    );
  }

  return { error: '不支持的平台: ' + platform };
}

// ==================== 注入内容 ====================
if (action === 'inject') {
  if (!args.title && !args.content) {
    return { error: 'inject 模式需要提供 title 或 content' };
  }

  const results = { platform, title: false, content: false, errors: [] };

  // ---- 微信公众号 ----
  if (platform === 'wechat') {
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

        var pm = document.querySelector('.ProseMirror');
        if (pm) {
          pm.focus();
          document.execCommand('insertHTML', false, content);
          pm.dispatchEvent(new Event('input', { bubbles: true }));
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
          editor.focus();
          document.execCommand('insertHTML', false, content);
          editor.dispatchEvent(new Event('input', { bubbles: true }));
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

  // ---- 小红书 ----
  if (platform === 'xiaohongshu') {
    if (args.title) {
      const titleResult = unwrap(
        await CAT.agent.dom.executeScript(
          `
        var titleInput = document.querySelector('input[placeholder*="标题"]');
        if (!titleInput) return { ok: false, error: '未找到标题输入框' };

        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(titleInput, ${JSON.stringify(args.title)});
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true };
        `,
          { tabId }
        )
      );

      results.title = titleResult && titleResult.ok;
      if (!results.title) {
        results.errors.push(
          'title: ' + (titleResult ? titleResult.error : '设置失败')
        );
      }
    }

    if (args.content) {
      const contentResult = unwrap(
        await CAT.agent.dom.executeScript(
          `
        var editor = document.querySelector('.tiptap.ProseMirror');
        if (!editor) return { ok: false, error: '未找到 TipTap 编辑器' };

        editor.focus();
        document.execCommand('insertText', false, ${JSON.stringify(args.content)});
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return { ok: true, method: 'TipTap insertText' };
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

    return results;
  }

  return { error: '不支持的平台: ' + platform };
}

// ==================== 上传封面图（微信公众号）====================
if (action === 'upload_cover') {
  if (platform !== 'wechat') {
    return { error: 'upload_cover 目前仅支持微信公众号' };
  }

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
    '，可选: explore, inject, prepare, upload_cover',
};
