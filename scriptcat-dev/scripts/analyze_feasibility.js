// ==SkillScript==
// @name         analyze_feasibility
// @description  Analyze technical feasibility of a ScriptCat script request. Evaluates the requirements, determines script type (UserScript or Skill Script), identifies needed APIs, assesses risks, and proposes an implementation approach. Call this before generate_script to validate the plan with the user.
// @param        requirements  string  [required]  User requirements organized by the main agent: what the script should do, target sites, trigger conditions, and any known constraints.
// @param        target_url    string  URL of the target website. When provided, fetches the page and includes a simplified HTML structure for the sub-agent to analyze DOM feasibility, available selectors, and embedded data.
// @grant        CAT.agent.conversation
// @grant        GM_xmlhttpRequest
// @timeout      120
// ==/SkillScript==

const { requirements, target_url } = args;

// ---------------------------------------------------------------------------
// HTML simplification — inspired by browser-automation's buildSkeletonScript
// ---------------------------------------------------------------------------

const KEEP_ATTRS = ["id", "class", "name", "type", "placeholder", "role",
  "aria-label", "value", "for", "action", "method", "data-testid", "href", "src"];
const SKIP_TAGS = new Set(["style", "noscript", "svg", "link", "meta", "br",
  "hr", "img", "video", "audio", "canvas", "iframe", "path", "picture", "source"]);
const WRAPPER_TAGS = new Set(["div", "span", "section", "article", "main",
  "header", "footer", "nav", "aside", "figure", "figcaption"]);

const MAX_HTML = 50000;       // overall output cap
const TEXT_LIMIT = 120;       // per text node
const SCRIPT_KEEP_LIMIT = 5000;   // inline script content threshold
const SCRIPT_TRUNCATE_TO = 1000;  // truncate long inline scripts to this

function simplifyHtml(raw) {
  // 1. Remove HTML comments
  let html = raw.replace(/<!--[\s\S]*?-->/g, "");

  // 2. Remove inline styles & event handlers from tags
  html = html.replace(/\s+(style|on\w+)\s*=\s*("[^"]*"|'[^']*')/gi, "");

  // 3. Remove base64 data URIs (keep first 30 chars for context)
  html = html.replace(/data:[^;]+;base64,[A-Za-z0-9+/=]{100,}/g, "data:...base64...");

  // 4. Process <script> tags with nuanced rules
  html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, content) => {
    const attrLower = attrs.toLowerCase();

    // Data scripts — always keep content
    if (/type\s*=\s*["'](application\/json|application\/ld\+json)["']/.test(attrLower)) {
      const trimmed = content.trim();
      if (trimmed.length > SCRIPT_KEEP_LIMIT) {
        return `<script${attrs}>${trimmed.slice(0, SCRIPT_TRUNCATE_TO)}...[truncated ${trimmed.length} chars]</script>`;
      }
      return match;
    }

    // Scripts with data-related id (e.g., __NEXT_DATA__, __INITIAL_STATE__)
    const idMatch = attrLower.match(/id\s*=\s*["']([^"']*)["']/);
    if (idMatch && /data|state|config|props|context/i.test(idMatch[1])) {
      const trimmed = content.trim();
      if (trimmed.length > SCRIPT_KEEP_LIMIT) {
        return `<script${attrs}>${trimmed.slice(0, SCRIPT_TRUNCATE_TO)}...[truncated ${trimmed.length} chars]</script>`;
      }
      return match;
    }

    // External scripts — keep tag with src only
    if (/src\s*=/.test(attrLower)) {
      return `<script${attrs}></script>`;
    }

    // Inline scripts — keep short ones, truncate long ones
    const trimmed = content.trim();
    if (!trimmed) return "";
    if (trimmed.length <= SCRIPT_KEEP_LIMIT) {
      return match;
    }
    return `<script${attrs}>${trimmed.slice(0, SCRIPT_TRUNCATE_TO)}...[truncated ${trimmed.length} chars]</script>`;
  });

  // 5. Remove skip tags entirely (style, svg, noscript, etc.)
  for (const tag of SKIP_TAGS) {
    const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, "gi");
    html = html.replace(re, "");
    // Self-closing variants
    const reSelf = new RegExp(`<${tag}[^>]*/?>`, "gi");
    html = html.replace(reSelf, "");
  }

  // 6. Strip non-essential attributes from remaining tags
  html = html.replace(/<(\w+)(\s[^>]*)>/g, (match, tag, attrStr) => {
    if (tag.toLowerCase() === "script") return match; // already processed
    const kept = [];
    for (const attr of KEEP_ATTRS) {
      const re = new RegExp(`(?:^|\\s)(${attr})\\s*=\\s*("[^"]*"|'[^']*')`, "i");
      const m = attrStr.match(re);
      if (m) kept.push(`${m[1]}=${m[2]}`);
    }
    return kept.length > 0 ? `<${tag} ${kept.join(" ")}>` : `<${tag}>`;
  });

  // 7. Truncate long text nodes
  html = html.replace(/>([^<]{120,})/g, (match, text) => {
    const trimmed = text.trim();
    if (trimmed.length > TEXT_LIMIT) {
      return ">" + trimmed.slice(0, TEXT_LIMIT) + "...";
    }
    return match;
  });

  // 8. Collapse whitespace
  html = html.replace(/\n\s*\n/g, "\n").replace(/\t/g, " ").replace(/ {2,}/g, " ");

  // 9. Overall truncation
  if (html.length > MAX_HTML) {
    html = html.slice(0, MAX_HTML) + "\n...[truncated, total " + raw.length + " chars]";
  }

  return html.trim();
}

// ---------------------------------------------------------------------------
// Fetch target page (if URL provided)
// ---------------------------------------------------------------------------

let pageContext = "";
if (target_url) {
  try {
    const resp = await GM.xmlHttpRequest({
      url: target_url,
      method: "GET",
      responseType: "text",
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (resp.status >= 200 && resp.status < 400) {
      const simplified = simplifyHtml(resp.responseText);
      pageContext = `\n\n## Target Page: ${target_url}\n\nHTTP ${resp.status} | Content-Length: ${resp.responseText.length} chars\n\n<page_structure>\n${simplified}\n</page_structure>\n`;
    } else {
      pageContext = `\n\n## Target Page: ${target_url}\n\nFetch failed: HTTP ${resp.status} ${resp.statusText}\n`;
    }
  } catch (err) {
    pageContext = `\n\n## Target Page: ${target_url}\n\nFetch failed: ${err.message || err}\n`;
  }
}

// ---------------------------------------------------------------------------
// Sub-agent prompt & execution
// ---------------------------------------------------------------------------

const analystPrompt = `## RESTRICTIONS — READ FIRST
- You are inside the analyze_feasibility tool. Do NOT call \`analyze_feasibility\` or \`generate_script\` — calling them would cause infinite recursion.
- Focus on analysis only — do not write the full script code.

# Role

You are a ScriptCat technical analyst. Evaluate script requirements and propose a concrete implementation approach.

## References

Use \`read_reference\` to look up exact API signatures. Do NOT guess — verify.

Available files:
- **scriptcat.d.ts** — TypeScript definitions for all GM APIs and CAT.agent.* APIs
- **userscript-api.md** — GM_* / GM.* API documentation
- **skillscript-format.md** — Skill Script metadata format and runtime behavior
- **cat-agent-api.md** — CAT.agent.dom, conversation, skills, task APIs
- **coding-patterns.md** — Common code patterns, header formats, and coding rules

## Decision Principles

### API vs DOM vs CDP
- **Prefer API calls** — more stable, faster, less breakage from UI changes.
- **Use DOM/CDP** when: interactions must trigger frontend event handlers, or the API is undocumented / has anti-bot measures / requires hard-to-extract auth tokens.
- Consider: is the auth token easy to extract? Are there rate limits? Does the site use anti-bot (Cloudflare, reCAPTCHA)?
- If page HTML is provided below, analyze the DOM structure: look for data scripts (\`__NEXT_DATA__\`, \`__INITIAL_STATE__\`), API endpoints in inline scripts, available CSS selectors, and form structures.

### Script Types — MUTUALLY EXCLUSIVE
\`@match\` (content script, has DOM) / \`@background\` (persistent, no page context) / \`@crontab\` (scheduled, background context) — a single script CANNOT combine them.

### Multi-Script
If requirements need both page-level and background processing: split into separate scripts, use \`GM.setValue\`/\`GM.getValue\` for data sharing.

### Skill Script Constraints
Sandbox only (no DOM — use \`CAT.agent.dom\`), default 30s timeout (extend via \`@timeout\`), params via \`args\`, results via \`return\`.

### Error & Edge Case Considerations
Identify likely failure points and recommend how the generated code should handle them:
- Network failures, timeouts, non-2xx responses
- Missing/changed DOM elements (site redesigns)
- Empty data sets, pagination, rate limiting
- Auth token expiration or rotation

## Output Format

### Script Type
UserScript (content / background / crontab) or Skill Script. If multiple scripts needed, list each.

### Required APIs
Specific APIs needed (GM.*, CAT.agent.*, etc.) with brief justification.

### Technical Approach
Step-by-step plan: how data is obtained, how it flows between components, key patterns.

### Risks & Caveats
Failure points, site-specific concerns, timeout issues, cross-origin restrictions.

### Error Handling Recommendations
Key errors to catch and suggested recovery strategies for the generator to implement.

### Feasibility
Verdict: ✅ Feasible / ⚠️ Feasible with caveats / ❌ Not feasible — with brief justification.`;

const userMessage = requirements + pageContext;

async function tryAnalyze() {
  const conv = await CAT.agent.conversation.create({
    system: analystPrompt,
    ephemeral: true,
  });
  return await conv.chat(userMessage);
}

// Retry once on failure
let reply;
try {
  reply = await tryAnalyze();
} catch (firstErr) {
  try {
    reply = await tryAnalyze();
  } catch (retryErr) {
    return { error: `Feasibility analysis failed after retry: ${retryErr.message || retryErr}` };
  }
}

const content = typeof reply.content === "string"
  ? reply.content
  : reply.content.map(b => b.text || "").join("");

return { content };
