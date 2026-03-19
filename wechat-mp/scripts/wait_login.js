// ==SkillScript==
// @name         wait_login
// @description  轮询等待微信公众号登录成功（最多等待 120 秒），避免每次轮询都经过 LLM
// @param        tabId number [required] 微信公众号页面所在的标签页 ID
// @param        timeout number 超时时间（秒），默认 120
// @grant        CAT.agent.dom
// ==/SkillScript==

const maxWait = (args.timeout || 120) * 1000;
const interval = 3000;
const startTime = Date.now();

while (Date.now() - startTime < maxWait) {
  const result = await CAT.agent.dom.executeScript(
    `
    var nickname = document.querySelector('.weui-desktop-account__nickname');
    var sideMenu = document.querySelector('.weui-desktop-sidebar');
    if (nickname || sideMenu) {
      return {
        status: 'logged_in',
        nickname: nickname ? nickname.textContent.trim() : null,
        token: new URLSearchParams(window.location.search).get('token'),
        url: window.location.href
      };
    }
    return null;
    `,
    { tabId: args.tabId }
  );

  if (result && result.status === 'logged_in') {
    return result;
  }

  await new Promise((resolve) => setTimeout(resolve, interval));
}

return { status: 'timeout', message: '等待登录超时（' + Math.round(maxWait / 1000) + '秒），请重试' };
