// ==SkillScript==
// @name         check_login
// @description  检测微信公众号后台的登录状态，返回登录信息或未登录提示
// @param        tabId number [required] 微信公众号页面所在的标签页 ID
// @grant        CAT.agent.dom
// ==/SkillScript==

const result = await CAT.agent.dom.executeScript(
  `
  var url = window.location.href;
  var scanQR = document.querySelector('.login__type__container__scan');
  var loginPage = document.querySelector('.login__type__container');
  var nickname = document.querySelector('.weui-desktop-account__nickname');
  var sideMenu = document.querySelector('.weui-desktop-sidebar');
  var token = new URLSearchParams(window.location.search).get('token');

  if (nickname || sideMenu) {
    return {
      status: 'logged_in',
      nickname: nickname ? nickname.textContent.trim() : null,
      token: token,
      url: url
    };
  }
  if (scanQR || loginPage) {
    return {
      status: 'need_login',
      hasQRCode: !!scanQR,
      url: url
    };
  }
  return {
    status: 'unknown',
    url: url,
    bodyText: document.body ? document.body.textContent.substring(0, 200) : ''
  };
  `,
  { tabId: args.tabId }
);

return result;
