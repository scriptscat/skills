// ==CATTool==
// @name         web_search
// @description  Search the web via SerpAPI and return top results with titles, snippets, and URLs
// @param        query string [required] The search query
// @grant        GM_xmlhttpRequest
// ==/CATTool==

const apiKey = CAT_CONFIG.SERP_API_KEY;
if (!apiKey) {
  return { error: "SERP_API_KEY not configured. Please set it in Skills → Config." };
}

const maxResults = CAT_CONFIG.MAX_RESULTS || 5;
const safeSearch = CAT_CONFIG.SAFE_SEARCH ? "active" : "off";

const params = new URLSearchParams({
  q: args.query,
  api_key: apiKey,
  num: String(maxResults),
  safe: safeSearch,
});
const url = `https://serpapi.com/search.json?${params}`;

const response = await new Promise((resolve, reject) => {
  GM_xmlhttpRequest({
    method: "GET",
    url,
    onload: (res) => resolve(res),
    onerror: (err) => reject(new Error("Request failed: " + (err.statusText || "network error"))),
    ontimeout: () => reject(new Error("Request timed out")),
  });
});

if (response.status !== 200) {
  return { error: `HTTP ${response.status}: ${response.responseText}` };
}

const data = JSON.parse(response.responseText);

// Extract organic results
const results = (data.organic_results || []).slice(0, maxResults).map((r) => ({
  title: r.title,
  url: r.link,
  snippet: r.snippet,
}));

// Include answer box if available
const answerBox = data.answer_box
  ? { title: data.answer_box.title, answer: data.answer_box.answer || data.answer_box.snippet }
  : undefined;

return {
  query: args.query,
  answerBox,
  results,
  totalResults: results.length,
};
