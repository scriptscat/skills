// ==SkillScript==
// @name         generate_image
// @description  生成图片（封面图、文章配图等）。自动查找支持图片生成的模型（通过 supportsImageOutput 标记），生成后保存到 OPFS 并返回
// @param        prompt string [required] 图片描述/生成提示词
// @param        savePath string 保存路径（相对 OPFS workspace），默认 media-ops/images/{timestamp}.png
// @grant        CAT.agent.model
// @grant        CAT.agent.conversation
// @grant        CAT.agent.opfs
// @timeout      120000
// ==/SkillScript==

// 1. 查找支持图片生成的模型
const models = await CAT.agent.model.list();
const targetModel = models.find((m) => m.supportsImageOutput);

if (!targetModel) {
  return {
    content: JSON.stringify({
      success: false,
      error: '未找到支持图片生成的模型',
      availableModels: models.map((m) => ({ name: m.name, model: m.model })),
      hint: '请在 ScriptCat 模型配置中启用「图片输出」选项，支持的模型如：gpt-image-1.5、gemini-3.1-flash-image-preview、gpt-4o 等',
    }),
  };
}

// 2. 使用找到的模型创建对话并生成图片
const conv = await CAT.agent.conversation.create({
  model: targetModel.id,
  ephemeral: true,
});

const reply = await conv.chat(args.prompt);

// 3. 从回复中提取图片 block
let imageBlock = null;

// 检查 content 中的图片块
if (Array.isArray(reply.content)) {
  for (const block of reply.content) {
    if (block.type === 'image') {
      imageBlock = block;
      break;
    }
  }
}

// 检查 toolCalls 中的附件
if (!imageBlock && reply.toolCalls) {
  for (const tc of reply.toolCalls) {
    if (tc.attachments) {
      for (const att of tc.attachments) {
        if (att.type === 'image') {
          imageBlock = att;
          break;
        }
      }
    }
    if (imageBlock) break;
  }
}

if (!imageBlock) {
  return {
    content: JSON.stringify({
      success: false,
      error: '模型未返回图片',
      model: targetModel.model,
      reply:
        typeof reply.content === 'string'
          ? reply.content.substring(0, 200)
          : JSON.stringify(reply.content).substring(0, 200),
    }),
  };
}

// 4. 从 attachment 存储读取图片 Blob，保存到 workspace OPFS
const savePath = args.savePath || 'media-ops/images/' + Date.now() + '.png';

const attachmentData = await CAT.agent.opfs.readAttachment(imageBlock.attachmentId);
if (attachmentData && attachmentData.data) {
  await CAT.agent.opfs.write(savePath, attachmentData.data);
}

return {
  content: JSON.stringify({
    success: true,
    model: targetModel.model,
    savedTo: savePath,
  }),
  attachments: [imageBlock],
};
