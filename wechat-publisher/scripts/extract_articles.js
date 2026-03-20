// ==SkillScript==
// @name         extract_articles
// @description  从微信公众号后台提取已发表文章列表，或通过 URL / 当前页面提取文章正文
// @param        tabId number [required] 页面所在的标签页 ID
// @param        mode string[list,detail,fetch_detail] [required] list=提取文章列表，detail=提取当前页面文章正文，fetch_detail=通过URL直接获取文章正文（无需打开页面）
// @param        url string 文章 URL（fetch_detail 模式必填）
// @grant        CAT.agent.dom
// ==/SkillScript==

const modeJson = JSON.stringify(args.mode);
const urlJson = args.url ? JSON.stringify(args.url) : 'null';

// executeScript 返回 {result, tabId} 包装对象，提取实际值
const unwrap = (v) =>
  v && typeof v === 'object' && 'result' in v ? v.result : v;

const result = unwrap(await CAT.agent.dom.executeScript(
  `
  var mode = ${modeJson};
  var url = ${urlJson};

  function extractArticleFromDoc(doc) {
    var title = '';
    var el = doc.querySelector('#activity-name, .rich_media_title');
    if (el) title = el.textContent.trim();

    var author = '';
    el = doc.querySelector('#js_name, .rich_media_meta_text');
    if (el) author = el.textContent.trim();

    var publishTime = '';
    el = doc.querySelector('#publish_time, .rich_media_meta_date');
    if (el) publishTime = el.textContent.trim();

    var contentEl = doc.querySelector('#js_content, .rich_media_content');
    var contentHtml = '';
    var plainText = '';
    if (contentEl) {
      // WeChat 图片使用 data-src 懒加载，fetch 获取的 HTML 中 JS 未执行，需手动转换
      var imgs = contentEl.querySelectorAll('img[data-src]');
      for (var ii = 0; ii < imgs.length; ii++) {
        var src = imgs[ii].getAttribute('src');
        if (!src || src === '' || src.indexOf('data:') === 0) {
          imgs[ii].setAttribute('src', imgs[ii].getAttribute('data-src'));
        }
      }
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
    return extractArticleFromDoc(document);
  }

  if (mode === 'fetch_detail') {
    return fetch(url).then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
      return resp.text();
    }).then(function(html) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var result = extractArticleFromDoc(doc);
      result.url = url;
      return result;
    }).catch(function(err) {
      return { error: 'Failed to fetch article: ' + err.message, url: url };
    });
  }

  return { error: 'Invalid mode. Use "list", "detail", or "fetch_detail".' };
  `,
  { tabId: args.tabId }
));

return result;
