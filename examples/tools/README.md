# Skill Script 示例

Skill Script 是 Skill 中的工具脚本，使用 `==SkillScript==` 头部格式定义。安装 Skill 后，其中的脚本会自动注册为 Agent 内置工具，LLM 在对话中可以自动调用。

## 文件说明

| 文件                | 说明                                                           |
| ------------------- | -------------------------------------------------------------- |
| `hello_world.js`    | 最简示例 — 无 grant，单参数                                    |
| `text_processor.js` | 纯计算工具 — 多参数、enum 类型、switch 分支                    |
| `json_formatter.js` | JSON 处理 — 路径查询、错误处理                                 |
| `weather_query.js`  | 网络请求 — 使用 `GM_xmlhttpRequest` 调用外部 API               |

## SkillScript 元数据格式

```javascript
// ==SkillScript==
// @name         tool_name          （必填）工具名称，LLM 通过此名称调用
// @description  工具描述            （推荐）告诉 LLM 这个工具做什么
// @param        paramName type [required] 参数描述
// @grant        GM_xmlhttpRequest   需要的 GM API 权限
// ==/SkillScript==
```

### @param 语法

```
@param  参数名  类型  [required]  描述
```

- **类型**: `string` / `number` / `boolean`
- **enum**: `string[val1,val2,val3]` — 限定可选值
- **[required]**: 标记为必填参数（可选）

### 运行时变量

- `args` — 包含 LLM 传入的所有参数，按 `@param` 定义的类型自动转换
- 通过 `return` 返回结果（对象会被 JSON 序列化后返回给 LLM）

## 安装方式

Skill Script 必须作为 Skill 的一部分安装。在 `SKILL.md` 的 frontmatter 中通过 `scripts` 字段引用脚本文件：

```yaml
---
name: my-skill
scripts:
  - hello_world.js
---
```

安装 Skill 后，其中的脚本会自动注册为 Agent 可用工具。

## 编程调用

在 UserScript 中使用 `CAT.agent.skills` API 调用 Skill 中的脚本工具：

```javascript
// @grant CAT.agent.skills
const result = await CAT.agent.skills.call("my-skill", "hello_world", { name: "ScriptCat" });
```

## 测试方法

1. **安装 Skill**: 将包含脚本的 Skill 通过安装页面安装
2. **在 Agent 聊天中测试**: 打开 ScriptCat 设置页的 Agent Chat，直接对话即可触发工具调用
   - 例如安装含 `hello_world` 的 Skill 后，对 Agent 说"向张三打招呼"
   - 例如安装含 `weather_query` 的 Skill 后，对 Agent 说"北京今天天气怎么样"
3. **通过脚本调用**: 使用 `CAT.agent.skills.call(skillName, scriptName, params)` 直接调用
