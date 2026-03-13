// ==CATTool==
// @name         http_request
// @description  Make an HTTP request to any URL (cross-origin, no CORS restrictions). Supports GET, POST, PUT, PATCH, DELETE. Returns status, headers, and response body.
// @param        url string [required] The URL to request
// @param        method string[GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS] HTTP method (default: GET)
// @param        headers string JSON object of request headers, e.g. {"Content-Type": "application/json"}
// @param        body string Request body (for POST/PUT/PATCH)
// @param        responseType string[text,json] Expected response type (default: text, auto-detects JSON)
// @grant        GM_xmlhttpRequest
// ==/CATTool==

const method = (args.method || "GET").toUpperCase();

let headers;
if (args.headers) {
  try {
    headers = JSON.parse(args.headers);
  } catch {
    return { error: "Invalid headers JSON: " + args.headers };
  }
}

const response = await new Promise((resolve, reject) => {
  let settled = false;
  const settle = (fn, val) => {
    if (settled) return;
    settled = true;
    fn(val);
  };

  GM_xmlhttpRequest({
    method,
    url: args.url,
    headers,
    data: args.body,
    timeout: 25000,
    onload: (res) => settle(resolve, res),
    onerror: (res) => settle(reject, new Error("Request failed: " + (res.statusText || res.status || "network error"))),
    ontimeout: () => settle(reject, new Error("Request timed out (25s)")),
    onabort: () => settle(reject, new Error("Request aborted")),
  });
});

// Parse response headers
const headerObj = {};
if (response.responseHeaders) {
  response.responseHeaders
    .trim()
    .split("\n")
    .forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > 0) {
        headerObj[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
      }
    });
}

// Build result
const result = {
  status: response.status,
  statusText: response.statusText,
  url: response.finalUrl || args.url,
  headers: headerObj,
};

// Parse body
const contentType = headerObj["content-type"] || "";
const bodyText = response.responseText || "";
const wantJson = args.responseType === "json" || contentType.includes("application/json");

if (wantJson) {
  try {
    result.body = JSON.parse(bodyText);
  } catch {
    result.body = bodyText;
  }
} else {
  // Truncate large text responses to avoid overwhelming the LLM context
  if (bodyText.length > 50000) {
    result.body = bodyText.slice(0, 50000);
    result.truncated = true;
    result.totalLength = bodyText.length;
  } else {
    result.body = bodyText;
  }
}

return result;
