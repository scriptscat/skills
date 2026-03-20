// ==SkillScript==
// @name         parse_excel
// @description  解析 Excel 文件（.xlsx/.xls），提取表格数据为 JSON。支持指定工作表和行数限制
// @param        filePath string OPFS 文件路径（与 attachmentId 二选一）
// @param        attachmentId string 附件 ID（与 filePath 二选一）
// @param        sheetName string 工作表名称（默认第一个工作表）
// @param        sheetIndex number 工作表索引，从 0 开始
// @param        maxRows number 最大返回行数（默认 200）
// @grant        CAT.agent.opfs
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
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
const workbook = XLSX.read(arrayBuffer, { type: 'array' });

// 选择工作表
let sheetName;
if (args.sheetName) {
  sheetName = args.sheetName;
} else if (args.sheetIndex !== undefined) {
  sheetName = workbook.SheetNames[args.sheetIndex];
} else {
  sheetName = workbook.SheetNames[0];
}

if (!sheetName || !workbook.Sheets[sheetName]) {
  return {
    content: JSON.stringify({
      success: false,
      error: '工作表 "' + sheetName + '" 不存在',
      availableSheets: workbook.SheetNames,
    }),
  };
}

const sheet = workbook.Sheets[sheetName];
const allData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
const maxRows = args.maxRows || 200;
const totalRows = allData.length;
const data = allData.slice(0, maxRows);
const headers = data.length > 0 ? Object.keys(data[0]) : [];

return {
  content: JSON.stringify({
    success: true,
    sheets: workbook.SheetNames,
    activeSheet: sheetName,
    headers,
    totalRows,
    returnedRows: data.length,
    truncated: totalRows > maxRows,
    data,
  }),
};
