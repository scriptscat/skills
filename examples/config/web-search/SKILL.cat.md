---
name: web-search
description: Search the web via SerpAPI and return structured results
config:
  SERP_API_KEY:
    title: "SerpAPI Key"
    type: text
    secret: true
    required: true
  MAX_RESULTS:
    title: "Max Results"
    type: number
    default: 5
  SAFE_SEARCH:
    title: "Safe Search"
    type: switch
    default: true
---

# Web Search Skill

You can search the web using the `web_search` tool.

## Usage

- When the user asks a question that requires up-to-date information, use `web_search`.
- Always summarize the search results in a readable format.
- Include source URLs for reference.

## Tips

- Use specific, concise search queries for better results.
- If the first search doesn't find what you need, try rephrasing the query.
