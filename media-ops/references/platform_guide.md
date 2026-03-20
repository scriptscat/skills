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
| 正文 | `.ProseMirror`（使用 `execCommand('insertHTML', ...)` 注入 HTML） |
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

---

## 小红书

### 页面入口

| 页面 | URL |
|------|-----|
| 登录页 | `https://creator.xiaohongshu.com/login` |
| 创作者中心 | `https://creator.xiaohongshu.com/` |
| 发布笔记 | `https://creator.xiaohongshu.com/publish/publish` |

### 内容格式

小红书笔记以**图片+文字**为核心：
- **图片**：必选，至少 1 张，最多 18 张。第一张为封面图
- **标题**：最多 20 字
- **正文**：纯文本，支持 emoji、话题标签（#话题#）、@用户
- **话题**：通过 # 添加相关话题，增加曝光

### 笔记类型

- **图文笔记**：多张图片 + 文字描述（主要类型）
- **视频笔记**：视频 + 文字描述

### 发布页面流程

发布页面 URL：`https://creator.xiaohongshu.com/publish/publish`

1. 默认显示「上传视频」tab，需点击「上传图文」tab 切换
2. 上传至少 1 张图片后，编辑器才会出现
3. 图片上传可通过 `input[type="file"][accept*="jpg"]` + `DataTransfer` 注入

### 编辑器关键元素

| 元素 | 选择器 / 方法 |
|------|--------------|
| 标题输入框 | `input[placeholder*="标题"]`（通过 nativeInputValueSetter 设置值） |
| 正文编辑器 | `.tiptap.ProseMirror`（TipTap 编辑器，用 `execCommand('insertText')` 注入纯文本） |
| 暂存草稿 | 文本为「暂存离开」的 button |
| 发布 | 文本为「发布」的 button |
| 话题 | 文本为「话题」的 button |

> **⚠️ 重要：小红书点击「发布」按钮会直接发布，没有二次确认弹窗！必须在点击前通过 `ask_user` 确认。**

### 写作风格要点

- 标题吸睛、口语化，常用 emoji
- 正文分段简短，善用 emoji 做列表标记
- 结尾引导互动（"你们觉得呢？""记得收藏！"）
- 话题标签放在文末
