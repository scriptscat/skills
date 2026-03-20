// ==SkillScript==
// @name         parse_pptx
// @description  解析 PowerPoint 文件（.pptx），逐页提取幻灯片文本内容
// @param        filePath string OPFS 文件路径（与 attachmentId 二选一）
// @param        attachmentId string 附件 ID（与 filePath 二选一）
// @param        startSlide number 起始幻灯片编号，从 1 开始（默认 1）
// @param        endSlide number 结束幻灯片编号（默认全部）
// @grant        CAT.agent.opfs
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
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

// PPTX 是 ZIP 格式，解压后读取幻灯片 XML
const zip = await JSZip.loadAsync(blob);

// 查找所有幻灯片文件（ppt/slides/slide1.xml, slide2.xml, ...）
const slideFiles = [];
zip.forEach((path, entry) => {
  const match = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
  if (match) {
    slideFiles.push({ index: parseInt(match[1]), path, entry });
  }
});

// 按编号排序
slideFiles.sort((a, b) => a.index - b.index);

if (slideFiles.length === 0) {
  return {
    content: JSON.stringify({ success: false, error: '未找到幻灯片内容，可能不是有效的 .pptx 文件' }),
  };
}

const totalSlides = slideFiles.length;
const startSlide = Math.max(1, args.startSlide || 1);
const endSlide = Math.min(totalSlides, args.endSlide || totalSlides);

// 从 XML 中提取文本的辅助函数
// PPTX 中文本在 <a:t> 元素中，段落在 <a:p> 中
function extractTextFromXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  const ns = 'http://schemas.openxmlformats.org/drawingml/2006/main';

  const paragraphs = doc.getElementsByTagNameNS(ns, 'p');
  const lines = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const textNodes = paragraphs[i].getElementsByTagNameNS(ns, 't');
    let line = '';
    for (let j = 0; j < textNodes.length; j++) {
      line += textNodes[j].textContent || '';
    }
    if (line.trim()) {
      lines.push(line.trim());
    }
  }

  return lines;
}

// 逐页提取文本
const slides = [];
for (const sf of slideFiles) {
  if (sf.index < startSlide || sf.index > endSlide) continue;
  const xmlContent = await sf.entry.async('string');
  const texts = extractTextFromXml(xmlContent);
  slides.push({ slide: sf.index, texts });
}

// 尝试提取备注（ppt/notesSlides/notesSlide1.xml）
for (const slide of slides) {
  const notePath = 'ppt/notesSlides/notesSlide' + slide.slide + '.xml';
  const noteEntry = zip.file(notePath);
  if (noteEntry) {
    const noteXml = await noteEntry.async('string');
    const noteTexts = extractTextFromXml(noteXml);
    if (noteTexts.length > 0) {
      slide.notes = noteTexts;
    }
  }
}

return {
  content: JSON.stringify({
    success: true,
    totalSlides,
    parsedRange: startSlide + '-' + endSlide,
    returnedSlides: slides.length,
    truncated: endSlide < totalSlides,
    slides,
  }),
};
