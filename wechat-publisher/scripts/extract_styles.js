// ==SkillScript==
// @name         extract_styles
// @description  从公众号文章提取排版样式（字号、颜色、间距、强调方式等），支持通过 URL 直接获取（无需打开页面）
// @param        tabId number [required] 标签页 ID
// @param        url string 文章 URL（可选，提供时通过 fetch 获取 HTML 解析 inline style，无需打开文章页面）
// @grant        CAT.agent.dom
// ==/SkillScript==

const urlJson = args.url ? JSON.stringify(args.url) : 'null';

// executeScript 返回 {result, tabId} 包装对象，提取实际值
const unwrap = (v) =>
  v && typeof v === 'object' && 'result' in v ? v.result : v;

const result = unwrap(await CAT.agent.dom.executeScript(
  `
  var url = ${urlJson};

  // 解析 inline style 字符串为结构化对象
  function parseInlineStyle(styleStr) {
    var result = {};
    if (!styleStr) return result;
    var parts = styleStr.split(';');
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i].split(':');
      if (pair.length >= 2) {
        var key = pair[0].trim();
        var value = pair.slice(1).join(':').trim();
        var camelKey = key.replace(/-([a-z])/g, function(m, c) { return c.toUpperCase(); });
        result[camelKey] = value;
      }
    }
    return result;
  }

  // 从 inline style 提取关键样式（用于 fetch 模式）
  function getStylesFromInline(el) {
    var p = parseInlineStyle(el.getAttribute('style') || '');
    return {
      fontSize: p.fontSize || '',
      fontWeight: p.fontWeight || '',
      fontFamily: p.fontFamily || '',
      color: p.color || '',
      backgroundColor: p.backgroundColor || '',
      lineHeight: p.lineHeight || '',
      marginTop: p.marginTop || '',
      marginBottom: p.marginBottom || '',
      paddingTop: p.paddingTop || '',
      paddingBottom: p.paddingBottom || '',
      paddingLeft: p.paddingLeft || '',
      paddingRight: p.paddingRight || '',
      textIndent: p.textIndent || '',
      letterSpacing: p.letterSpacing || '',
      textAlign: p.textAlign || '',
      borderLeft: [p.borderLeftWidth, p.borderLeftStyle, p.borderLeftColor].filter(Boolean).join(' ') || p.borderLeft || '',
      textDecoration: p.textDecoration || ''
    };
  }

  // 从 computed style 提取关键样式（用于页面模式）
  function getStylesFromComputed(el) {
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

  function getInlineStyle(el) {
    return el.getAttribute('style') || '';
  }

  function extractStylesFromDoc(doc, useComputed) {
    var contentEl = doc.querySelector('#js_content, .rich_media_content');
    if (!contentEl) return { error: '未找到文章内容区域' };

    var getStyles = useComputed ? getStylesFromComputed : getStylesFromInline;

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
      var isHeading = false;
      if (h.tagName.match(/^H[1-4]$/)) {
        isHeading = true;
      } else {
        // 从 inline style 判断是否为标题（字号 >= 18 或 font-weight >= 700）
        var inlineP = parseInlineStyle(getInlineStyle(h));
        var fs = parseFloat(inlineP.fontSize) || 0;
        var fw = parseInt(inlineP.fontWeight) || (inlineP.fontWeight === 'bold' ? 700 : 0);
        if (useComputed) {
          var cs = window.getComputedStyle(h);
          fs = parseFloat(cs.fontSize) || fs;
          fw = parseInt(cs.fontWeight) || fw;
        }
        isHeading = fs >= 18 || (fw >= 700 && hText.length < 50);
      }
      if (isHeading) {
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
      var imgInfo = {
        index: o,
        hasCaption: !!(imgs[o].nextElementSibling && imgs[o].nextElementSibling.textContent.trim().length < 50)
      };
      if (useComputed) {
        var imgRect = imgs[o].getBoundingClientRect();
        var contentRect = contentEl.getBoundingClientRect();
        var position = contentRect.height ? (imgRect.top - contentRect.top) / contentRect.height : 0;
        imgInfo.relativePosition = Math.round(position * 100) + '%';
        imgInfo.width = imgs[o].width;
      } else {
        // fetch 模式下估算图片位置：按 DOM 顺序在所有子节点中的相对位置
        var allChildren = contentEl.children;
        var imgParent = imgs[o].closest('#js_content > *, .rich_media_content > *') || imgs[o].parentElement;
        for (var pi = 0; pi < allChildren.length; pi++) {
          if (allChildren[pi] === imgParent || allChildren[pi].contains(imgs[o])) {
            imgInfo.relativePosition = Math.round(pi / allChildren.length * 100) + '%';
            break;
          }
        }
        imgInfo.width = parseInt(imgs[o].getAttribute('width')) || parseInt((parseInlineStyle(getInlineStyle(imgs[o]))).width) || null;
      }
      styles.images.positions.push(imgInfo);
    }

    // 生成摘要
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
  }

  if (url) {
    return fetch(url).then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
      return resp.text();
    }).then(function(html) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var result = extractStylesFromDoc(doc, false);
      result.url = url;
      result.source = 'fetch';
      return result;
    }).catch(function(err) {
      return { error: 'Failed to fetch article: ' + err.message, url: url };
    });
  }

  var result = extractStylesFromDoc(document, true);
  result.source = 'page';
  return result;
  `,
  { tabId: args.tabId }
));

return result;
