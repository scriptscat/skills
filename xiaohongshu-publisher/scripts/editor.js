// ==SkillScript==
// @name         editor
// @description  探索或注入内容到小红书编辑器（TipTap），支持准备编辑器和上传图片
// @param        tabId number [required] 编辑器所在的标签页 ID
// @param        action string[explore,inject,prepare] [required] explore=探索编辑器结构，inject=注入内容，prepare=准备编辑器（切换tab+上传图片）
// @param        title string 笔记标题（inject 时使用）
// @param        content string 正文内容，纯文本（inject 时使用）
// @param        imageData string 图片 base64 data URL（prepare 时使用，用于自动上传图片触发编辑器）
// @param        imagePath string OPFS 图片路径（prepare 时使用，替代 imageData，脚本自动从 OPFS 读取）
// @grant        CAT.agent.dom
// @grant        CAT.agent.opfs
// @timeout      60000
// ==/SkillScript==

const { tabId, action } = args;

// CAT.agent.dom.executeScript 返回 {result, tabId} 包装对象，提取实际值
const unwrap = (v) =>
  v && typeof v === 'object' && 'result' in v ? v.result : v;

// ==================== 准备编辑器 ====================
if (action === 'prepare') {
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
    // 没有图片数据时，生成占位图
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

// ==================== 注入内容 ====================
if (action === 'inject') {
  if (!args.title && !args.content) {
    return { error: 'inject 模式需要提供 title 或 content' };
  }

  const results = { title: false, content: false, errors: [] };

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

return {
  error:
    '无效的 action: ' +
    action +
    '，可选: explore, inject, prepare',
};
