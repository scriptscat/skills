// ==SkillScript==
// @name         extract_styles
// @description  从当前打开的公众号文章页面中程序化提取排版样式（字号、颜色、间距、强调方式等），返回结构化的样式数据
// @param        tabId number [required] 已打开的公众号文章页面标签页 ID
// @grant        CAT.agent.dom
// ==/SkillScript==

const result = await CAT.agent.dom.executeScript(
  `
  var contentEl = document.querySelector('#js_content, .rich_media_content');
  if (!contentEl) return { error: '未找到文章内容区域' };

  var styles = {
    paragraphs: [],
    headings: [],
    strongs: [],
    blockquotes: [],
    lists: [],
    hrs: [],
    images: { count: 0, positions: [] },
    summary: {}
  };

  // 提取元素的关键样式
  function getStyles(el) {
    var cs = window.getComputedStyle(el);
    return {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      lineHeight: cs.lineHeight,
      marginTop: cs.marginTop,
      marginBottom: cs.marginBottom,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      textIndent: cs.textIndent,
      letterSpacing: cs.letterSpacing,
      textAlign: cs.textAlign,
      borderLeft: cs.borderLeftWidth + ' ' + cs.borderLeftStyle + ' ' + cs.borderLeftColor,
      textDecoration: cs.textDecoration
    };
  }

  // 提取 inline style 属性（原始值，不是 computed）
  function getInlineStyle(el) {
    return el.getAttribute('style') || '';
  }

  // 采样段落（取前 10 个）
  var ps = contentEl.querySelectorAll('p, section > span');
  for (var i = 0; i < Math.min(ps.length, 10); i++) {
    var p = ps[i];
    var text = p.textContent.trim();
    if (!text || text.length < 5) continue;
    styles.paragraphs.push({
      text: text.substring(0, 50),
      computed: getStyles(p),
      inline: getInlineStyle(p)
    });
  }

  // 提取标题
  var hs = contentEl.querySelectorAll('h1, h2, h3, h4, strong[style], span[style]');
  for (var j = 0; j < hs.length; j++) {
    var h = hs[j];
    var hText = h.textContent.trim();
    if (!hText || hText.length < 2) continue;
    var cs = window.getComputedStyle(h);
    var fontSize = parseFloat(cs.fontSize);
    // 只收集看起来像标题的元素（字号 > 正文或加粗）
    if (h.tagName.match(/^H[1-4]$/) || fontSize >= 18 || (cs.fontWeight >= 700 && hText.length < 50)) {
      styles.headings.push({
        tag: h.tagName,
        text: hText.substring(0, 50),
        computed: getStyles(h),
        inline: getInlineStyle(h)
      });
    }
    if (styles.headings.length >= 8) break;
  }

  // 提取强调文字样式
  var strongs = contentEl.querySelectorAll('strong, em, b');
  for (var k = 0; k < Math.min(strongs.length, 5); k++) {
    var s = strongs[k];
    if (!s.textContent.trim()) continue;
    styles.strongs.push({
      tag: s.tagName,
      text: s.textContent.trim().substring(0, 30),
      computed: getStyles(s),
      inline: getInlineStyle(s)
    });
  }

  // 提取引用块
  var bqs = contentEl.querySelectorAll('blockquote');
  for (var l = 0; l < Math.min(bqs.length, 3); l++) {
    styles.blockquotes.push({
      text: bqs[l].textContent.trim().substring(0, 50),
      computed: getStyles(bqs[l]),
      inline: getInlineStyle(bqs[l])
    });
  }

  // 提取列表
  var uls = contentEl.querySelectorAll('ul, ol');
  for (var m = 0; m < Math.min(uls.length, 3); m++) {
    var li = uls[m].querySelector('li');
    styles.lists.push({
      type: uls[m].tagName,
      listComputed: getStyles(uls[m]),
      listInline: getInlineStyle(uls[m]),
      itemComputed: li ? getStyles(li) : null,
      itemInline: li ? getInlineStyle(li) : null
    });
  }

  // 提取分割线
  var hrs = contentEl.querySelectorAll('hr');
  for (var n = 0; n < Math.min(hrs.length, 2); n++) {
    styles.hrs.push({
      computed: getStyles(hrs[n]),
      inline: getInlineStyle(hrs[n])
    });
  }

  // 统计图片
  var imgs = contentEl.querySelectorAll('img');
  styles.images.count = imgs.length;
  for (var o = 0; o < Math.min(imgs.length, 5); o++) {
    // 判断图片在文章中的大致位置
    var imgRect = imgs[o].getBoundingClientRect();
    var contentRect = contentEl.getBoundingClientRect();
    var position = (imgRect.top - contentRect.top) / contentRect.height;
    styles.images.positions.push({
      index: o,
      relativePosition: Math.round(position * 100) + '%',
      width: imgs[o].width,
      hasCaption: !!(imgs[o].nextElementSibling && imgs[o].nextElementSibling.textContent.trim().length < 50)
    });
  }

  // 生成摘要：取最常见的样式值
  if (styles.paragraphs.length > 0) {
    var first = styles.paragraphs[0].computed;
    styles.summary = {
      bodyFontSize: first.fontSize,
      bodyColor: first.color,
      bodyLineHeight: first.lineHeight,
      bodyMarginBottom: first.marginBottom,
      bodyLetterSpacing: first.letterSpacing,
      bodyTextIndent: first.textIndent,
      headingCount: styles.headings.length,
      blockquoteCount: styles.blockquotes.length,
      listCount: styles.lists.length,
      imageCount: styles.images.count,
      hrCount: styles.hrs.length
    };
    if (styles.headings.length > 0) {
      styles.summary.headingFontSize = styles.headings[0].computed.fontSize;
      styles.summary.headingColor = styles.headings[0].computed.color;
      styles.summary.headingFontWeight = styles.headings[0].computed.fontWeight;
    }
  }

  return styles;
  `,
  { tabId: args.tabId }
);

return result;
