---
name: file-parser
description: 解析常见文件格式（Excel、PDF、Word、CSV、PPT），提取文本和结构化数据。当用户上传文件附件、需要提取表格数据、解析 PDF 文档、读取 Word/PPT 内容或处理 CSV 数据时使用。支持从附件（attachmentId）或 OPFS 路径读取。
scripts:
  - parse_csv.js
  - parse_excel.js
  - parse_pdf.js
  - parse_pptx.js
  - parse_word.js
---

# 文件解析 Skill

你现在可以解析用户上传或 OPFS 中的文件，提取可读内容和结构化数据。根据文件扩展名或 MIME 类型选择对应脚本。

## 支持格式

| 格式 | 扩展名 | 脚本 | 输出 |
|------|--------|------|------|
| Excel | .xlsx / .xls | `parse_excel` | JSON 表格数据（行数组） |
| PDF | .pdf | `parse_pdf` | 逐页文本 + 元数据 |
| Word | .docx | `parse_word` | 纯文本或 HTML |
| CSV/TSV | .csv / .tsv | `parse_csv` | JSON 表格数据（行数组） |
| PowerPoint | .pptx | `parse_pptx` | 逐页幻灯片文本 |

## 使用时机

当用户消息中包含 **FileBlock**（`type: "file"`）或提到 OPFS 中的文件路径，且文件属于上述格式时，调用对应脚本解析。

## 文件读取方式

每个脚本都支持两种文件来源（二选一）：

- **`attachmentId`** — 从附件存储读取（用户刚上传的文件，消息中 FileBlock 的 attachmentId）
- **`filePath`** — 从 OPFS workspace 读取（已存储的文件路径）

优先使用 `attachmentId`（如果消息中有 FileBlock），因为无需额外存储步骤。

## 输出处理

- 所有脚本返回 JSON 格式的 `content`，包含 `success` 字段
- 表格类数据（Excel/CSV）默认限制 200 行，可通过 `maxRows` 调整
- PDF 默认限制 30 页，可通过 `maxPages` 调整
- 如果数据被截断，`truncated: true` 会标记

## 典型调用流程

1. 用户上传文件 → 消息包含 `FileBlock { attachmentId, mimeType, name }`
2. 根据 `name` 扩展名或 `mimeType` 选择对应脚本
3. 传入 `attachmentId` 调用脚本
4. 解析结果返回给用户，或用于后续处理

## 调用示例

**用户上传 Excel**:
```
→ execute_skill_script("file-parser", "parse_excel", { attachmentId: "abc123" })
← { success: true, fileName: "data.xlsx", sheets: [{ name: "Sheet1", rows: [...], rowCount: 150, truncated: false }] }
```

**解析 OPFS 中的 PDF**:
```
→ execute_skill_script("file-parser", "parse_pdf", { filePath: "docs/report.pdf", maxPages: 10 })
← { success: true, pages: [{ page: 1, text: "..." }], totalPages: 25, truncated: true }
```

**解析 Word 文档**:
```
→ execute_skill_script("file-parser", "parse_word", { attachmentId: "def456" })
← { success: true, fileName: "doc.docx", text: "...", html: "<p>..." }
```

## 大文件建议

- Excel/CSV 超过 1000 行：先用默认 maxRows 预览，询问用户是否需要更多
- PDF 超过 50 页：先解析前几页，再按需解析后续页
- 如果解析结果过大，分批解析并在上下文中直接使用（不要保存到 OPFS 再读取，opfs_read 只返回 blob URL 无法取回文本）
