# 平台参考指南

> 平台会更新页面结构，选择器失效时用 `editor`（action=explore）或 `browser_action` 重新探索。

---

## 微信公众号

### 页面入口

| 页面 | URL |
|------|-----|
| 登录页 | `https://mp.weixin.qq.com/` |
| 新建图文 | 首页点击「新的创作」→「文章」（不能直接通过 URL 进入） |
| 草稿箱 | 左侧菜单 → 内容与互动 → 草稿箱 |
| 已发表 | 左侧菜单 → 内容与互动 → 发表记录 |

### 编辑器关键元素

| 元素 | 选择器 |
|------|--------|
| 标题 | `#title`（textarea，用 `nativeTextAreaValueSetter` 设置） |
| 作者 | `#author`（input） |
| 正文 | `.ProseMirror`（通过模拟粘贴事件注入 HTML） |
| 摘要 | `#js_description`（textarea） |
| 封面图 | 使用 `editor`（action=upload_cover）自动上传 |
| 保存草稿 | `#js_submit` |
| 发表 | `#js_send` |
| 预览 | `#js_preview` |

### 封面图上传流程

使用 `editor`（action=upload_cover, imageData=base64）自动完成：
1. 点击封面区域 `.js_cover_btn_area`
2. 点击「从图片库选择」`.js_imagedialog`
3. 通过弹窗内 `input[type="file"]` 上传图片（`DataTransfer` 注入）
4. 上传后图片自动选中，点击「下一步」
5. 在裁剪页点击「确认」
6. 封面图设置完成（`.js_cover_preview_new` 可见）

> **注意**：上传后图片会自动选中，不要再点击图片项否则会取消选中。

### 文章列表页

- 已发表文章卡片: `.weui-desktop-publish__list__item`
- 标题: `.weui-desktop-publish__title`
- 草稿卡片: `.weui-desktop-appmsg__list__item`

### 公众号文章页（已发布）

- 标题: `#activity-name` / `.rich_media_title`
- 作者: `#js_name` / `.rich_media_meta_text`
- 发布时间: `#publish_time` / `.rich_media_meta_date`
- 正文: `#js_content` / `.rich_media_content`

### 内容格式

公众号过滤 class，只保留 inline style。文章必须用 HTML + inline style 编写。
