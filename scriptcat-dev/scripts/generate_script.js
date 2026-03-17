// ==SkillScript==
// @name         generate_script
// @description  Generate or modify ScriptCat UserScript or Skill Script code using a coding sub-agent. Requires a confirmed technical approach from analyze_feasibility. Returns ready-to-install .js file attachments. Pass existing_code when modifying a previously generated script.
// @param        spec           string  [required]  What the script should do: functional requirements, target sites, trigger conditions, and any user preferences. When modifying, describe what to change.
// @param        approach       string  [required]  Technical approach confirmed by analyze_feasibility and approved by the user: script type(s), APIs to use, implementation strategy. Do NOT fabricate — must come from a prior analyze_feasibility call.
// @param        name           string  Desired script/tool name (optional, sub-agent will choose if omitted).
// @param        existing_code  string  Existing script code to modify. When provided, the sub-agent refines this code instead of writing from scratch. For multi-script, join with SCRIPT_SEPARATOR.
// @grant        CAT.agent.conversation
// @timeout      120
// ==/SkillScript==

const { spec, approach, name, existing_code } = args;

const coderPrompt = `## RESTRICTIONS — READ FIRST
- You are inside the generate_script tool. Do NOT call \`analyze_feasibility\` or \`generate_script\` — calling them would cause infinite recursion.
- Output raw JavaScript code ONLY. No markdown fences, no explanation, no commentary.

# Role

You are a ScriptCat script developer. Write complete, ready-to-install scripts.

## References

Use \`read_reference\` to look up API signatures, coding rules, and patterns:
- **coding-patterns.md** — Header formats, coding rules, and common code patterns (READ THIS FIRST)
- **scriptcat.d.ts** — TypeScript definitions for all GM APIs and CAT.agent.* APIs
- **userscript-api.md** — GM_* / GM.* API documentation
- **skillscript-format.md** — Skill Script metadata format and runtime behavior
- **cat-agent-api.md** — CAT.agent.dom, conversation, skills, task APIs

## Code Quality Requirements

### Error Handling
- Skill Script: wrap main logic in try-catch; return \`{ error: "descriptive message" }\` on failure
- Network requests: handle HTTP errors (non-2xx), timeouts, and malformed responses
- DOM operations: null-check elements before accessing properties
- JSON parsing: always wrap \`JSON.parse\` in try-catch

BAD — silent failure:
\`\`\`js
const resp = await GM.xmlHttpRequest({ url, method: "GET", responseType: "json" });
const items = resp.response.data.items;
\`\`\`
GOOD — checked and reported:
\`\`\`js
const resp = await GM.xmlHttpRequest({ url, method: "GET", responseType: "json" });
if (resp.status !== 200) return { error: \`HTTP \${resp.status}: \${resp.statusText}\` };
const items = resp.response?.data?.items;
if (!items) return { error: "Unexpected response shape — missing data.items" };
\`\`\`

### Robustness
- Validate critical data before use — don't assume API responses have the expected shape
- Use sensible defaults for optional data
- UserScript: clean up resources (disconnect MutationObservers, clear intervals) when appropriate
- Skill Script: keep return data concise — summarize rather than dumping raw HTML/JSON

### @grant Completeness
Every API call in the code MUST have a matching \`@grant\` in the header. Missing grants cause silent \`undefined\` at runtime.

BAD — missing @grant:
\`\`\`
// @grant  GM_xmlhttpRequest
// (forgot GM_setValue)
await GM.setValue("key", value);  // undefined!
\`\`\`
GOOD — all grants declared:
\`\`\`
// @grant  GM_xmlhttpRequest
// @grant  GM_setValue
await GM.setValue("key", value);
\`\`\`

### Style
- Meaningful variable names — no single letters except loop indices
- No magic strings/numbers — use named constants for URLs, selectors, config values
- Keep functions focused — extract helpers when a block exceeds ~30 lines
- Brief comments only for non-obvious logic (workarounds, encoding tricks)

### Output Size
- Aim for the minimum code that fulfills requirements — typically under 150 lines per script
- Do NOT add speculative features, extra configurability, or defensive code for impossible scenarios
- If requirements are complex enough to need 200+ lines, extract helpers but do not pad

## Modification Mode

When existing code is provided:
- Preserve the original structure and style; change ONLY what the modification request requires
- Keep the existing header metadata; update @description/@grant/@param only if the change demands it
- Do NOT rewrite unrelated parts of the code

## Output Rules

- Output ONLY raw JavaScript code — no markdown, no prose
- If generating **multiple scripts**, separate them with: \`// ===SCRIPT_SEPARATOR===\`
- UserScript: start with \`// ==UserScript==\`, include @name, @namespace (https://scriptcat.org/), @version (1.0.0), @description, @author, @match/@crontab/@background, @grant for every API
- Skill Script: start with \`// ==SkillScript==\`, @name (snake_case), @description, @param lines, @grant for every API`;

let userMessage = "";
if (name) userMessage += `Script/tool name: ${name}\n\n`;
if (existing_code) {
  userMessage += `## Existing Code (modify this)\n\`\`\`js\n${existing_code}\n\`\`\`\n\n`;
  userMessage += `## Modification Request\n${spec}\n`;
} else {
  userMessage += `## Requirements\n${spec}\n`;
}
userMessage += `\n## Technical Approach (confirmed by analyze_feasibility)\n${approach}\n`;

async function tryGenerate() {
  const conv = await CAT.agent.conversation.create({
    system: coderPrompt,
    ephemeral: true,
    skills: ["scriptcat-dev"],
  });
  return await conv.chat(userMessage);
}

// Retry once on failure
let reply;
try {
  reply = await tryGenerate();
} catch (firstErr) {
  try {
    reply = await tryGenerate();
  } catch (retryErr) {
    return { error: `Script generation failed after retry: ${retryErr.message || retryErr}` };
  }
}

// Extract raw code
const raw = typeof reply.content === "string"
  ? reply.content
  : reply.content.map(b => b.text || "").join("");

// Strip all markdown fences, concatenating their contents
const stripFences = (code) => {
  const fencePattern = /```(?:js|javascript)?\s*\n([\s\S]*?)\n```/g;
  const blocks = [];
  let m;
  while ((m = fencePattern.exec(code)) !== null) blocks.push(m[1].trim());
  // If fences found, join them; otherwise return raw code (already unfenced)
  return blocks.length > 0 ? blocks.join("\n\n// ===SCRIPT_SEPARATOR===\n\n") : code.trim();
};

// Strip fences first, then split by separator
const unfenced = stripFences(raw);
const scriptParts = unfenced.split(/\/\/\s*===SCRIPT_SEPARATOR===\s*/).map(s => s.trim()).filter(Boolean);

if (scriptParts.length === 0) {
  return { error: "Sub-agent returned empty code. Please retry or adjust requirements." };
}

// Validate: every script must have a recognizable header
const headerPattern = /\/\/\s*==(UserScript|SkillScript)==/;
const warnings = [];
for (let i = 0; i < scriptParts.length; i++) {
  if (!headerPattern.test(scriptParts[i])) {
    warnings.push(`Script ${i + 1} is missing a ==UserScript== or ==SkillScript== header`);
  }
}

const attachments = [];
const summaryLines = [];

for (const scriptCode of scriptParts) {
  const nameMatch = scriptCode.match(/\/\/\s*@name\s+(.+)/);
  const descMatch = scriptCode.match(/\/\/\s*@description\s+(.+)/);
  const isSkillScript = /==SkillScript==/.test(scriptCode);
  const scriptName = nameMatch ? nameMatch[1].trim() : "script";
  const fileName = scriptName.replace(/\s+/g, "_").toLowerCase() + ".js";
  const type = isSkillScript ? "Skill Script" : "UserScript";
  const lines = scriptCode.split("\n").length;

  let summary = `**${scriptName}** (${type}, ${lines} lines)`;
  if (descMatch) summary += ` — ${descMatch[1].trim()}`;
  summaryLines.push(summary);

  attachments.push({
    type: "file",
    name: fileName,
    mimeType: "application/javascript",
    data: new Blob([scriptCode], { type: "application/javascript" }),
  });
}

const scriptWord = attachments.length === 1 ? "script" : `${attachments.length} scripts`;
let content = `Generated ${scriptWord} (sent as attachments):\n${summaryLines.map(s => `- ${s}`).join("\n")}`;
if (warnings.length > 0) {
  content += `\n\n⚠️ Warnings:\n${warnings.map(w => `- ${w}`).join("\n")}`;
}
content += `\n\nThe script source code has been delivered as .js file attachments. Do NOT regenerate or output the code again — present the summary above to the user and ask if they want any changes.`;

return { content, attachments };
