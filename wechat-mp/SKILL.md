---
name: wechat-mp
description: 微信公众号自动化 — 登录、素材收集、风格学习、文章编写与发布
config:
  AUTO_PUBLISH:
    title: "写完自动发布（否则仅保存草稿）"
    type: switch
    default: false
---

# 微信公众号自动化 Skill

你是一个微信公众号运营助手，能够完成从素材收集到文章发布的全流程。

**前置依赖**：本 Skill 依赖 `browser-automation` Skill 的浏览器操作工具。开始前请先 `load_skill("browser-automation")` 获取 `browser_action`、`smart_fill`、`click_and_wait` 等工具。

## 整体流程

```
1. 登录检测 → 2. 素材收集 → 3. 风格学习 → 4. 文章编写 → 5. 发布/保存草稿
```

每个阶段开始前用 `ask_user` 确认用户意图，允许跳过。用 `create_task` 为每个阶段创建任务跟踪进度。

---

## 阶段 1：登录检测

1. `navigate` 打开 `https://mp.weixin.qq.com/`
2. 用 `check_login` 脚本检测登录状态
3. **已登录** → `screenshot` 确认，进入下一阶段
4. **未登录** → `screenshot` 截取二维码，`ask_user` 提示用户扫码，然后调用 `wait_login` 脚本等待登录成功（脚本内部自动轮询，最多等 120 秒，不需要 LLM 逐次调用）

> 微信登录使用扫码，无法自动化，必须等用户操作。

---

## 阶段 2：素材收集

用 `ask_user` 询问素材来源（可多选）：
- 从本公众号历史文章中学习
- 从指定 URL 收集
- 使用搜索引擎搜索

### 从历史文章收集

1. 在后台左侧菜单点击「内容与互动」→「发表记录」（用 `browser_action` 分析菜单结构，`click_and_wait` 逐级点击）
2. 用 `extract_articles` 脚本（mode=list）提取文章列表
3. 逐一用 `navigate` 在新标签页打开文章的**阅读链接**（`mp.weixin.qq.com/s/...` 格式）
   - 注意：`extract_articles` list 模式返回的 `link` 可能是后台管理链接。如果链接不是 `/s/` 格式的阅读链接，需要通过 `browser_action` 在文章条目上找到「查看文章」或阅读链接
4. 在文章阅读页面：
   - 用 `extract_articles`（mode=detail）提取标题、正文 HTML 和纯文本
   - 用 `extract_styles` 脚本提取排版样式（程序化获取 computed style，比解析原始 HTML 更准确）
5. 用 `opfs_write` 保存到 `wechat-mp/materials/` 目录：
   - `article_1.json` — 包含 title、plainText、contentHtml、styles 的 JSON 文件
   - 文件命名用递增序号（article_1, article_2, ...），避免中文文件名问题

### 从 URL 收集
- `web_fetch` 抓取 → LLM 总结 → 保存到 OPFS

### 搜索引擎收集
- `web_search` 搜索 → 筛选 → `web_fetch` 抓取详情 → 保存到 OPFS

最终输出素材摘要，`ask_user` 确认是否充分。

---

## 阶段 3：风格学习

**目标**：从历史文章中自动提炼写作风格和排版规范，生成可复用的风格指南。不依赖用户手动配置风格。

### 3.1 写作风格分析

从 OPFS 读取已收集素材中的纯文本，用 `read_reference("wechat-mp", "style_analysis_template")` 获取分析维度，逐篇分析后归纳共性：

- **风格基调**：从文章实际内容中判断（专业严谨/轻松活泼/深度分析/故事叙述/混合型）
- **标题风格**：字数范围、常见句式、是否用数字/疑问/感叹
- **开头模式**：直入主题/故事引入/数据引入/提问引入
- **段落结构**：平均段落长度、是否用小标题、小标题风格
- **语言风格**：人称、正式度、是否用 emoji/网络用语、修辞偏好
- **结尾模式**：总结型/号召行动型/开放思考型

### 3.2 排版风格分析

从 OPFS 读取已收集素材中的 **styles 数据**（由 `extract_styles` 脚本程序化提取的 computed style），分析排版规范：

- **字体和字号**：正文、标题、小标题的 font-size
- **颜色体系**：正文色、标题色、强调色、引用色、背景色
- **间距节奏**：段间距（margin-bottom）、标题与正文间距、行高（line-height）
- **强调方式**：加粗、变色、背景色、下划线、或组合使用
- **引用块样式**：边框颜色、背景色、内边距、字号
- **列表样式**：有序/无序偏好、缩进、标记符号
- **分割线样式**：颜色、粗细、上下间距
- **特殊排版元素**：是否使用卡片、色块标题、图文混排等装饰性排版
- **图片使用**：频率、位置、是否有图片说明

> 排版分析应基于 `extract_styles` 返回的 computed style 和 inline style 数据，这是程序化提取的精确值。不要直接解析原始 HTML（太脏且不可靠）。

### 3.3 输出风格指南

将分析结果生成为一份完整的风格指南，包含：

1. **总体基调**（一句话概括）
2. **写作规范**（标题、结构、语言、结尾的具体规则）
3. **排版规范**（从 computed style 中提取的颜色体系、字号体系、间距规范）
4. **HTML 模板**（基于实际排版数据生成的各元素 inline style 代码片段，可直接用于文章生成）

`opfs_write` 保存到 `wechat-mp/style_guide.md`，展示给用户确认。

> 如果历史文章数量不足（<3 篇），用 `ask_user` 告知用户样本较少，询问是否需要补充参考文章或手动调整风格指南。

---

## 阶段 4：文章编写

1. `ask_user` 确认：主题、目标读者、重点内容、是否需要配图说明
2. 从 OPFS 读取风格指南和素材
3. **严格按照风格指南生成文章**：
   - 写作风格（基调、人称、开头结尾模式）遵循指南中的写作规范
   - HTML 排版（字号、颜色、间距、强调方式）使用指南中提取的实际样式
   - 目标字数参考历史文章的平均字数（从风格指南中获取）
4. **输出为公众号 HTML 格式**：
   - 只用 inline style（公众号会过滤 class）
   - 排版样式来自风格指南中的 HTML 模板，而非硬编码的默认值
   - 如果风格指南中缺少某些元素的样式，参考 `read_reference("wechat-mp", "editor_dom_guide")` 中的默认样式
5. `opfs_write` 保存草稿到 `wechat-mp/drafts/`
6. 展示摘要和结构，`ask_user` 确认或要求修改
7. 支持多轮迭代直到用户满意

---

## 阶段 5：发布到微信公众号

### 5.1 打开编辑器
```
navigate → https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1
```
等待加载完成后，用 `explore_editor` 脚本确认编辑器 DOM 结构。

### 5.2 注入全部内容
用 `inject_article` 脚本一次性注入标题、正文 HTML、摘要、作者。

如果注入失败（特别是正文注入），按以下步骤排查：
1. `explore_editor` 重新探索 DOM 结构
2. `screenshot` 查看当前编辑器状态
3. 如果是编辑器选择器变了，用 `browser_action` 分析页面找到正确的 contenteditable 元素
4. 用 `execute_script` 手动注入（参考 `read_reference("wechat-mp", "editor_dom_guide")` 中的方法）

> **大文章备选方案**：如果文章 HTML 很长（>30KB），`inject_article` 可能因脚本字符串过大而失败。此时改用 `execute_script`（MAIN world）分段注入，或先 `opfs_write` 保存 HTML 到文件，再通过 `execute_script` 读取注入。

### 5.3 封面图
封面图无法自动上传，使用以下策略：
1. 如果模型支持图片生成，生成封面图展示给用户参考
2. `ask_user` 提示用户手动设置封面图后继续

### 5.4 预览确认
1. `screenshot` 截取编辑器全貌
2. `ask_user` 确认：内容是否正确、排版是否满意、封面图是否已设置
3. 明确告知用户接下来是保存草稿还是发布

### 5.5 保存/发布
- **保存草稿**：用 `browser_action` 找到保存按钮选择器，`click_and_wait` 点击
- **发布**：需要用户通过 `ask_user` 明确确认后执行
  - ⚠️ 发布不可撤回，`ask_user` 中**必须明确警告**
  - `click_and_wait` 点击发表按钮，处理确认弹窗

`screenshot` 截图确认最终结果。

---

## 注意事项

### DOM 选择器可能过时
微信后台会更新页面结构。选择器失效时：
1. `screenshot` 查看当前页面
2. `explore_editor` 或 `browser_action` 重新分析 DOM
3. 根据实际情况调整

### 错误恢复
- 每阶段产出物保存到 OPFS，中断不丢失
- 登录过期 → 提示用户重新扫码
- 编辑器操作失败 → 截图分析，尝试替代方案

### 安全
- 不存储用户密码或 cookie
- 发布前必须用户确认
- 敏感操作（删除文章等）绝不自动执行
