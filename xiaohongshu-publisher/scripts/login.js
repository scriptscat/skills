// ==SkillScript==
// @name         login
// @description  检测小红书登录状态，未登录时自动切换到二维码模式并截图返回，或轮询等待登录完成
// @param        tabId number [required] 页面所在的标签页 ID
// @param        action string[check,wait] [required] check=检测状态并截图二维码，wait=轮询等待登录
// @param        timeout number 等待超时（秒），仅 wait 模式，默认 120
// @grant        CAT.agent.dom
// @timeout      180000
// ==/SkillScript==

const tabId = args.tabId;

// executeScript 返回 {result, tabId} 包装对象，提取实际值
const unwrap = (v) =>
  v && typeof v === 'object' && 'result' in v ? v.result : v;

const config = {
  loggedInSelectors: ['.user-info', '.user_avatar'],
  loginPageSelectors: ['.login-container'],
  getNickname: `
    var el = document.querySelector('.user-info');
    if (el) {
      var text = el.textContent.trim();
      return text.replace(/\\s*退出登录.*$/, '').trim() || null;
    }
    return null;
  `,
  getExtra: 'return {};',
};

// 登录检测函数
async function checkLogin() {
  const loggedInSels = JSON.stringify(config.loggedInSelectors);
  const loginPageSels = JSON.stringify(config.loginPageSelectors);

  const statusInfo = unwrap(
    await CAT.agent.dom.executeScript(
      `
    var loggedInSels = ${loggedInSels};
    var loginPageSels = ${loginPageSels};

    var status = 'unknown';
    for (var i = 0; i < loggedInSels.length; i++) {
      if (document.querySelector(loggedInSels[i])) { status = 'logged_in'; break; }
    }
    if (status === 'unknown') {
      for (var j = 0; j < loginPageSels.length; j++) {
        if (document.querySelector(loginPageSels[j])) { status = 'need_login'; break; }
      }
    }
    return { status: status, url: window.location.href };
    `,
      { tabId }
    )
  );

  const status = statusInfo ? statusInfo.status : 'unknown';
  let pageUrl = statusInfo ? statusInfo.url : '';

  // 页面可能未加载完毕导致 executeScript 返回空，从 tab 信息获取 URL
  if (!pageUrl) {
    try {
      const tabs = await CAT.agent.dom.listTabs();
      const tab = tabs.find((t) => t.tabId === tabId);
      if (tab && tab.url) pageUrl = tab.url;
    } catch (_) {}
  }

  // URL-based fallback: if on creator pages (not /login), assume logged in
  if (status === 'unknown') {
    if (pageUrl.includes('creator.xiaohongshu.com') && !pageUrl.includes('/login')) {
      return {
        status: 'logged_in',
        platform: 'xiaohongshu',
        nickname: null,
        url: pageUrl,
        note: '通过 URL 推断已登录（创作者页面无登录提示）',
      };
    }
  }

  if (status === 'logged_in') {
    const nickname = unwrap(
      await CAT.agent.dom.executeScript(config.getNickname, { tabId })
    );
    const extra = unwrap(
      await CAT.agent.dom.executeScript(config.getExtra, { tabId })
    );
    return {
      status: 'logged_in',
      platform: 'xiaohongshu',
      nickname,
      url: pageUrl || unwrap(
        await CAT.agent.dom.executeScript('return window.location.href;', {
          tabId,
        })
      ),
      ...(extra || {}),
    };
  }

  return { status: status, platform: 'xiaohongshu', url: pageUrl };
}

// 切换到二维码登录模式
async function switchToQrMode() {
  unwrap(
    await CAT.agent.dom.executeScript(
      `
    var container = document.querySelector('.login-box-container');
    if (!container) return false;

    var imgs = container.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].width >= 50 && imgs[i].width <= 80) {
        imgs[i].click();
        return true;
      }
    }
    return false;
    `,
      { tabId }
    )
  );

  await new Promise((resolve) => setTimeout(resolve, 500));
}

// ---- action: check ----
if (args.action === 'check') {
  const result = await checkLogin();

  if (result.status === 'logged_in') {
    return result;
  }

  // 未登录：切换到二维码模式，然后截图
  await switchToQrMode();

  try {
    const screenshot = await CAT.agent.dom.screenshot({
      tabId,
      selector: '.login-box-container',
    });
    if (screenshot) {
      return {
        ...result,
        message: '请扫描二维码登录小红书',
        content: '请扫描二维码登录',
        attachments: [screenshot],
      };
    }
  } catch (e) {
    // 二维码区域可能不存在，回退到全页截图
    try {
      const fullScreenshot = await CAT.agent.dom.screenshot({ tabId });
      if (fullScreenshot) {
        return {
          ...result,
          message: '请查看页面并手动登录',
          content: '未找到二维码区域，请查看页面手动登录',
          attachments: [fullScreenshot],
        };
      }
    } catch (_) {}
  }

  return { ...result, message: '请手动登录' };
}

// ---- action: wait ----
if (args.action === 'wait') {
  const maxWait = (args.timeout || 120) * 1000;
  const interval = 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const result = await checkLogin();
    if (result.status === 'logged_in') {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return {
    status: 'timeout',
    platform: 'xiaohongshu',
    message: '等待登录超时（' + Math.round(maxWait / 1000) + '秒），请重试',
  };
}

return { error: '无效的 action: ' + args.action + '，可选: check, wait' };
