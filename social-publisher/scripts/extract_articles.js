// ==SkillScript==
// @name         extract_articles
// @description  从微信公众号后台提取已发表文章列表，或从已打开的文章页面提取正文详情
// @param        tabId number [required] 页面所在的标签页 ID
// @param        mode string[list,detail] [required] list=提取文章列表，detail=提取当前文章正文
// @grant        CAT.agent.dom
// ==/SkillScript==

const modeJson = JSON.stringify(args.mode);

// executeScript 返回 {result, tabId} 包装对象，提取实际值
const unwrap = (v) =>
  v && typeof v === 'object' && 'result' in v ? v.result : v;

const result = unwrap(await CAT.agent.dom.executeScript(
  `
  var mode = ${modeJson};

  if (mode === 'list') {
    var articles = [];
    var items = document.querySelectorAll(
      '.weui-desktop-publish__list__item, .publish_item, .weui-desktop-appmsg__list__item'
    );
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var titleEl = item.querySelector(
        '.weui-desktop-publish__title, .weui-desktop-appmsg__title, a[href*="appmsg"]'
      );
      var timeEl = item.querySelector(
        '.weui-desktop-publish__time, .weui-desktop-appmsg__date, time'
      );
      var linkEl = item.querySelector('a[href]');
      articles.push({
        title: titleEl ? titleEl.textContent.trim() : '',
        time: timeEl ? timeEl.textContent.trim() : '',
        link: linkEl ? linkEl.href : ''
      });
    }
    return { mode: 'list', count: articles.length, articles: articles };
  }

  if (mode === 'detail') {
    var title = '';
    var el = document.querySelector('#activity-name, .rich_media_title');
    if (el) title = el.textContent.trim();

    var author = '';
    el = document.querySelector('#js_name, .rich_media_meta_text');
    if (el) author = el.textContent.trim();

    var publishTime = '';
    el = document.querySelector('#publish_time, .rich_media_meta_date');
    if (el) publishTime = el.textContent.trim();

    var contentEl = document.querySelector('#js_content, .rich_media_content');
    var contentHtml = '';
    var plainText = '';
    if (contentEl) {
      contentHtml = contentEl.innerHTML;
      plainText = contentEl.textContent.trim();
    }

    return {
      mode: 'detail',
      title: title,
      author: author,
      publishTime: publishTime,
      contentHtml: contentHtml.substring(0, 50000),
      plainText: plainText.substring(0, 10000),
      wordCount: plainText.length
    };
  }

  return { error: 'Invalid mode. Use "list" or "detail".' };
  `,
  { tabId: args.tabId }
));

return result;
