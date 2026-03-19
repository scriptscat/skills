// ==SkillScript==
// @name         login
// @description  检测平台登录状态，未登录时自动切换到二维码模式并截图返回，或轮询等待登录完成。支持微信公众号、小红书
// @param        platform string[wechat,xiaohongshu] [required] 目标平台
// @param        tabId number [required] 页面所在的标签页 ID
// @param        action string[check,wait] [required] check=检测状态并截图二维码，wait=轮询等待登录
// @param        timeout number 等待超时（秒），仅 wait 模式，默认 120
// @grant        CAT.agent.dom
// @timeout      180000
// ==/SkillScript==

const platform = args.platform;
const tabId = args.tabId;

// 各平台的登录检测配置
const platformConfig = {
  wechat: {
    loggedInSelectors: ['.weui-desktop-layout', '.acount_box-nickname'],
    loginPageSelectors: ['.login__type__container__scan', '.login__type__container'],
    getNickname: `
      var el = document.querySelector('.acount_box-nickname, .weui-desktop-account__nickname');
      return el ? el.textContent.trim() : null;
    `,
    getExtra: `
      return { token: new URLSearchParams(window.location.search).get('token') };
    `,
  },
  xiaohongshu: {
    loggedInSelectors: ['.user-info', '.user_avatar'],
    loginPageSelectors: ['.login-container'],
    getNickname: `
      var el = document.querySelector('.user-info');
      if (el) {
        // user-info 包含 "用户名 退出登录"，取第一个文本节点
        var text = el.textContent.trim();
        return text.replace(/\\s*退出登录.*$/, '').trim() || null;
      }
      return null;
    `,
    getExtra: 'return {};',
  },
};

const config = platformConfig[platform];
if (!config) {
  return { error: '不支持的平台: ' + platform + '，可选: wechat, xiaohongshu' };
}

// 通用登录检测函数
async function checkLogin() {
  const loggedInSels = JSON.stringify(config.loggedInSelectors);
  const loginPageSels = JSON.stringify(config.loginPageSelectors);

  const status = await CAT.agent.dom.executeScript(
    `
    var loggedInSels = ${loggedInSels};
    var loginPageSels = ${loginPageSels};

    for (var i = 0; i < loggedInSels.length; i++) {
      if (document.querySelector(loggedInSels[i])) return 'logged_in';
    }
    for (var j = 0; j < loginPageSels.length; j++) {
      if (document.querySelector(loginPageSels[j])) return 'need_login';
    }
    return 'unknown';
    `,
    { tabId }
  );

  if (status === 'logged_in') {
    const nickname = await CAT.agent.dom.executeScript(config.getNickname, { tabId });
    const extra = await CAT.agent.dom.executeScript(config.getExtra, { tabId });
    return {
      status: 'logged_in',
      platform,
      nickname,
      url: await CAT.agent.dom.executeScript('return window.location.href;', { tabId }),
      ...extra,
    };
  }

  return { status: status, platform };
}

// 小红书：切换到二维码登录模式
// 默认显示短信登录，需要点击切换图标（login-box-container 内约 64x64 的 img）
async function switchToQrMode() {
  if (platform !== 'xiaohongshu') return;

  await CAT.agent.dom.executeScript(
    `
    var container = document.querySelector('.login-box-container');
    if (!container) return false;

    var imgs = container.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      // 切换图标大约 50-80px，二维码大约 120-200px
      if (imgs[i].width >= 50 && imgs[i].width <= 80) {
        imgs[i].click();
        return true;
      }
    }
    return false;
    `,
    { tabId }
  );

  // 等待二维码渲染
  await new Promise((resolve) => setTimeout(resolve, 500));
}

// ---- action: check ----
if (args.action === 'check') {
  const result = await checkLogin();

  if (result.status === 'logged_in') {
    return result;
  }

  // 未登录：尝试切换到二维码模式，然后截图二维码区域
  await switchToQrMode();

  // 各平台的二维码区域选择器
  const qrSelectors = {
    wechat: '.login__type__container__scan',
    xiaohongshu: '.login-box-container',
  };
  const qrSelector = qrSelectors[platform];

  const screenshot = await CAT.agent.dom.screenshot({
    tabId,
    selector: qrSelector,
  });
  if (screenshot) {
    return {
      ...result,
      message: '请扫描二维码登录' + (platform === 'wechat' ? '微信公众号' : '小红书'),
      content: '请扫描二维码登录',
      attachments: [screenshot],
    };
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
    platform,
    message: '等待登录超时（' + Math.round(maxWait / 1000) + '秒），请重试',
  };
}

return { error: '无效的 action: ' + args.action + '，可选: check, wait' };
