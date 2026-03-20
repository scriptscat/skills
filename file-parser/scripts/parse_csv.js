// ==SkillScript==
// @name         parse_csv
// @description  解析 CSV/TSV 文件，提取表格数据为 JSON。自动检测分隔符
// @param        filePath string OPFS 文件路径（与 attachmentId 二选一）
// @param        attachmentId string 附件 ID（与 filePath 二选一）
// @param        delimiter string 分隔符（默认自动检测：逗号、制表符、分号）
// @param        maxRows number 最大返回行数（默认 200）
// @param        encoding string 文件编码（默认 utf-8）
// @grant        CAT.agent.opfs
// @require      https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js
// @timeout      120
// ==/SkillScript==

// 读取文件
let text;
if (args.attachmentId) {
  const att = await CAT.agent.opfs.readAttachment(args.attachmentId);
  text = await new Response(att.data).text();
} else if (args.filePath) {
  const file = await CAT.agent.opfs.read(args.filePath, 'text');
  text = file.content;
} else {
  return { content: JSON.stringify({ success: false, error: '需要提供 filePath 或 attachmentId' }) };
}

// 解析 CSV
const parseConfig = {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: true,
};

if (args.delimiter) {
  parseConfig.delimiter = args.delimiter;
}

const result = Papa.parse(text, parseConfig);

if (result.errors && result.errors.length > 0) {
  // 有错误但可能部分解析成功，继续处理
  const criticalErrors = result.errors.filter((e) => e.type === 'Abort');
  if (criticalErrors.length > 0) {
    return {
      content: JSON.stringify({
        success: false,
        error: '解析失败',
        errors: result.errors.slice(0, 5),
      }),
    };
  }
}

const maxRows = args.maxRows || 200;
const totalRows = result.data.length;
const data = result.data.slice(0, maxRows);
const headers = result.meta.fields || [];

return {
  content: JSON.stringify({
    success: true,
    delimiter: result.meta.delimiter,
    headers,
    totalRows,
    returnedRows: data.length,
    truncated: totalRows > maxRows,
    errors: result.errors && result.errors.length > 0 ? result.errors.slice(0, 5) : undefined,
    data,
  }),
};
