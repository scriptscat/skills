// ==SkillScript==
// @name         manage_styles
// @description  管理风格档案：列表、保存、加载、删除。语言风格（writing）与排版风格（layout）分开存储，支持自由搭配
// @param        action string [required] 操作类型：list / save / load / delete
// @param        type string [required] 风格类型：writing（语言风格）/ layout（排版风格）
// @param        name string 风格档案名称（save/load/delete 时必填）
// @param        platform string 平台标识（save 时必填）
// @param        styleGuide string 风格指南内容，Markdown 格式（save 时必填）
// @param        sourceArticles string 来源文章标题，JSON 数组字符串（save 时可选）
// @grant        CAT.agent.opfs
// ==/SkillScript==

const STYLES_DIR = 'wechat-publisher/styles';
const VALID_TYPES = ['writing', 'layout'];
const TYPE_LABELS = { writing: '语言风格', layout: '排版风格' };

function safeFileName(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
}

function typeDir(type) {
  return `${STYLES_DIR}/${type}`;
}

function stylePath(type, name) {
  return `${typeDir(type)}/${safeFileName(name)}.json`;
}

function validateType() {
  if (!args.type || !VALID_TYPES.includes(args.type)) {
    return `错误：type 参数必须为 writing 或 layout，当前值：${args.type}`;
  }
  return null;
}

// 读取某个类型目录下的所有档案
async function readProfiles(type) {
  let entries;
  try {
    entries = await CAT.agent.opfs.list(typeDir(type));
  } catch (e) {
    return [];
  }

  const profiles = [];
  for (const entry of entries) {
    if (entry.type !== 'file' || !entry.name.endsWith('.json')) continue;
    try {
      const data = await CAT.agent.opfs.read(`${typeDir(type)}/${entry.name}`);
      const profile = JSON.parse(data.content);
      profiles.push({
        name: profile.name,
        type: profile.type,
        platform: profile.platform,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        sourceCount: (profile.sourceArticles || []).length
      });
    } catch (e) {
      // 跳过损坏的文件
    }
  }
  return profiles;
}

function formatProfiles(profiles, typeLabel) {
  if (profiles.length === 0) return null;
  const lines = profiles.map((s, i) =>
    `  ${i + 1}. **${s.name}** (${s.platform}) — 来源 ${s.sourceCount} 篇，更新于 ${s.updatedAt || s.createdAt}`
  );
  return `### ${typeLabel}（${profiles.length} 个）\n${lines.join('\n')}`;
}

async function listStyles() {
  const err = validateType();
  // 如果指定了类型，只列出该类型；否则列出全部
  if (!args.type) {
    // 列出所有类型
    const sections = [];
    let total = 0;
    for (const t of VALID_TYPES) {
      const profiles = await readProfiles(t);
      total += profiles.length;
      const section = formatProfiles(profiles, TYPE_LABELS[t]);
      if (section) sections.push(section);
    }
    if (total === 0) {
      return { content: '暂无保存的风格档案。' };
    }
    return { content: `已保存 ${total} 个风格档案：\n\n${sections.join('\n\n')}` };
  }

  if (err) return { content: err };
  const profiles = await readProfiles(args.type);
  if (profiles.length === 0) {
    return { content: `暂无保存的${TYPE_LABELS[args.type]}档案。`, styles: [] };
  }
  const section = formatProfiles(profiles, TYPE_LABELS[args.type]);
  return { content: section, styles: profiles };
}

async function saveStyle() {
  const err = validateType();
  if (err) return { content: err };
  if (!args.name) return { content: '错误：缺少 name 参数' };
  if (!args.platform) return { content: '错误：缺少 platform 参数' };
  if (!args.styleGuide) return { content: '错误：缺少 styleGuide 参数' };

  const path = stylePath(args.type, args.name);
  const now = new Date().toISOString();

  // 尝试读取已有的档案以保留 createdAt
  let createdAt = now;
  try {
    const existing = await CAT.agent.opfs.read(path);
    const old = JSON.parse(existing.content);
    createdAt = old.createdAt || now;
  } catch (e) {
    // 新建
  }

  let sourceArticles = [];
  if (args.sourceArticles) {
    try {
      sourceArticles = JSON.parse(args.sourceArticles);
    } catch (e) {
      sourceArticles = [args.sourceArticles];
    }
  }

  const profile = {
    name: args.name,
    type: args.type,
    platform: args.platform,
    createdAt,
    updatedAt: now,
    sourceArticles,
    styleGuide: args.styleGuide
  };

  await CAT.agent.opfs.write(path, JSON.stringify(profile, null, 2));

  const label = TYPE_LABELS[args.type];
  return {
    content: `${label}档案「${args.name}」已保存。\n平台：${args.platform}\n来源文章：${sourceArticles.length} 篇\n路径：${path}`
  };
}

async function loadStyle() {
  const err = validateType();
  if (err) return { content: err };
  if (!args.name) return { content: '错误：缺少 name 参数' };

  const path = stylePath(args.type, args.name);
  let data;
  try {
    data = await CAT.agent.opfs.read(path);
  } catch (e) {
    return { content: `未找到${TYPE_LABELS[args.type]}档案「${args.name}」` };
  }

  const profile = JSON.parse(data.content);
  const label = TYPE_LABELS[args.type];
  return {
    content: `已加载${label}档案「${profile.name}」(${profile.platform})，更新于 ${profile.updatedAt || profile.createdAt}。\n\n${profile.styleGuide}`,
    profile
  };
}

async function deleteStyle() {
  const err = validateType();
  if (err) return { content: err };
  if (!args.name) return { content: '错误：缺少 name 参数' };

  const path = stylePath(args.type, args.name);
  try {
    await CAT.agent.opfs.delete(path);
    return { content: `${TYPE_LABELS[args.type]}档案「${args.name}」已删除。` };
  } catch (e) {
    return { content: `删除失败：未找到${TYPE_LABELS[args.type]}档案「${args.name}」` };
  }
}

switch (args.action) {
  case 'list':
    return await listStyles();
  case 'save':
    return await saveStyle();
  case 'load':
    return await loadStyle();
  case 'delete':
    return await deleteStyle();
  default:
    return { content: `未知操作：${args.action}，支持 list / save / load / delete` };
}
