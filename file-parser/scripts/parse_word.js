// ==SkillScript==
// @name         parse_word
// @description  解析 Word 文档（.docx），提取纯文本或 HTML 内容
// @param        filePath string OPFS 文件路径（与 attachmentId 二选一）
// @param        attachmentId string 附件 ID（与 filePath 二选一）
// @param        format string 输出格式：text（默认）或 html
// @grant        CAT.agent.opfs
// @require      https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js
// @timeout      120
// ==/SkillScript==

// 读取文件
let blob;
if (args.attachmentId) {
  const att = await CAT.agent.opfs.readAttachment(args.attachmentId);
  blob = att.data;
} else if (args.filePath) {
  const file = await CAT.agent.opfs.read(args.filePath, 'blob');
  blob = file.data;
} else {
  return { content: JSON.stringify({ success: false, error: '需要提供 filePath 或 attachmentId' }) };
}

const arrayBuffer = await blob.arrayBuffer();
const outputFormat = args.format || 'text';

let result;
if (outputFormat === 'html') {
  result = await mammoth.convertToHtml({ arrayBuffer });
} else {
  result = await mammoth.extractRawText({ arrayBuffer });
}

const warnings = result.messages
  .filter((m) => m.type === 'warning')
  .map((m) => m.message);

// 截断过长内容
const maxLength = 100000;
let content = result.value;
let truncated = false;
if (content.length > maxLength) {
  content = content.substring(0, maxLength);
  truncated = true;
}

return {
  content: JSON.stringify({
    success: true,
    format: outputFormat,
    length: result.value.length,
    truncated,
    warnings: warnings.length > 0 ? warnings : undefined,
    content,
  }),
};
