# 平台参考指南

> 平台会更新页面结构，选择器失效时用 `editor`（action=explore）或 `browser_action` 重新探索。

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

**⚠️ 必须按顺序执行，不可跳步：**

1. `navigate` 打开发布页 — 此时页面只有 tab 栏（上传视频/上传图文/写长文），**编辑器、标题框、发布按钮均不存在**
2. **立即调用 `editor`（action=prepare）** — 自动点击「上传图文」tab + 上传图片（或占位图）
3. 等待 `prepare` 返回 `success: true` 后，编辑器才可用
4. **在 prepare 完成前不要使用 `browser_action`、`screenshot` 或 `editor`(explore) 分析页面**，否则会因找不到元素陷入死循环

技术细节：
- tab 选择器：`.creator-tab`（text = "上传图文"）
- 图片上传：`input[type="file"][accept*="jpg"]` + `DataTransfer` 注入
- 编辑器出现标志：`.tiptap.ProseMirror` 存在

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
