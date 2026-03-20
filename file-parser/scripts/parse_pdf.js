// ==SkillScript==
// @name         parse_pdf
// @description  解析 PDF 文件，逐页提取文本内容和元数据
// @param        filePath string OPFS 文件路径（与 attachmentId 二选一）
// @param        attachmentId string 附件 ID（与 filePath 二选一）
// @param        startPage number 起始页码，从 1 开始（默认 1）
// @param        endPage number 结束页码（默认全部）
// @param        maxPages number 最大解析页数（默认 30）
// @grant        CAT.agent.opfs
// @require      https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js
// @timeout      180
// ==/SkillScript==

// 禁用 Web Worker，在沙箱环境中使用主线程解析
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

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
const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

const totalPages = pdf.numPages;
const startPage = Math.max(1, args.startPage || 1);
const maxPages = args.maxPages || 30;
const endPage = Math.min(totalPages, args.endPage || totalPages, startPage + maxPages - 1);

// 提取元数据
let metadata = {};
try {
  const meta = await pdf.getMetadata();
  if (meta && meta.info) {
    metadata = {
      title: meta.info.Title || '',
      author: meta.info.Author || '',
      subject: meta.info.Subject || '',
      creator: meta.info.Creator || '',
      creationDate: meta.info.CreationDate || '',
    };
  }
} catch (e) {
  // 元数据提取失败不影响文本提取
}

// 逐页提取文本
const pages = [];
for (let i = startPage; i <= endPage; i++) {
  const page = await pdf.getPage(i);
  const textContent = await page.getTextContent();
  const text = textContent.items.map((item) => item.str).join('');
  pages.push({ page: i, text });
}

return {
  content: JSON.stringify({
    success: true,
    totalPages,
    parsedRange: startPage + '-' + endPage,
    returnedPages: pages.length,
    truncated: endPage < totalPages,
    metadata,
    pages,
  }),
};
