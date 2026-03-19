# 微信公众号编辑器 DOM 参考

> 微信后台可能更新页面结构，选择器失效时用 `explore_editor` 或 `browser_action` 重新探索。

## 页面入口

| 页面 | URL |
|------|-----|
| 登录页 | `https://mp.weixin.qq.com/` |
| 新建图文 | `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1` |
| 草稿箱 | 左侧菜单 → 内容与互动 → 草稿箱 |
| 已发表 | 左侧菜单 → 内容与互动 → 发表记录 |

## 编辑器关键元素

### 标题
- `#title` — 主标题输入框

### 作者
- `#author` — 作者输入框

### 正文编辑器
优先级从高到低：
1. `window.UE.getEditor('ueditor_0')` — UEditor JS API（最可靠）
2. `.edui-body-container` — UEditor body 容器
3. `#ueditor_0` — UEditor 实例容器
4. `[contenteditable="true"]` — 通用 fallback

### 摘要
- `#js_description` 或 `textarea[name="digest"]`

### 封面图
- `.js_cover_area` / `#js_cover_area` — 需用户手动操作

## 操作按钮

| 功能 | 选择器 |
|------|--------|
| 保存草稿 | `#js_submit` |
| 发表 | `#js_send` |
| 预览 | `#js_preview` |

## 文章列表页元素

### 已发表文章
- 文章卡片: `.weui-desktop-publish__list__item`
- 标题: `.weui-desktop-publish__title`
- 时间: `.weui-desktop-publish__time`

### 草稿箱
- 文章卡片: `.weui-desktop-appmsg__list__item`
- 标题: `.weui-desktop-appmsg__title`

## 公众号文章页（已发布）
- 标题: `#activity-name` / `.rich_media_title`
- 作者: `#js_name` / `.rich_media_meta_text`
- 发布时间: `#publish_time` / `.rich_media_meta_date`
- 正文: `#js_content` / `.rich_media_content`

## 公众号 HTML 样式规范

公众号过滤 class，只保留 inline style：

```html
<!-- 标题 -->
<h2 style="font-size: 20px; font-weight: bold; color: #333; margin: 24px 0 12px;">标题</h2>

<!-- 正文 -->
<p style="font-size: 16px; color: #333; line-height: 1.8; margin-bottom: 16px;">正文</p>

<!-- 强调 -->
<strong style="color: #1e80ff;">重点</strong>

<!-- 引用 -->
<blockquote style="border-left: 3px solid #1e80ff; padding: 12px 16px; margin: 16px 0; background: #f6f8fa; color: #666; font-size: 15px;">
  引用内容
</blockquote>

<!-- 小字 -->
<p style="font-size: 14px; color: #888; line-height: 1.6;">注释</p>

<!-- 分割线 -->
<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

<!-- 列表 -->
<ul style="padding-left: 24px; margin-bottom: 16px;">
  <li style="font-size: 16px; color: #333; line-height: 1.8; margin-bottom: 8px;">项目</li>
</ul>
```
