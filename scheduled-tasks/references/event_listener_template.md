# Event Listener Template

When a task is created in **event** mode, it only emits a trigger — a userscript must listen and handle execution. Below are ready-to-use templates.

## Minimal Listener

```js
// ==UserScript==
// @name         My Task Listener
// @namespace    https://example.com
// @grant        CAT.agent.task
// ==/UserScript==

CAT.agent.task.addListener("TASK_ID_HERE", (trigger) => {
  // trigger = { taskId, name, crontab, triggeredAt }
  console.log(`Task "${trigger.name}" fired at ${trigger.triggeredAt}`);
});
```

## HTTP Request Example

A common pattern: call an API endpoint on schedule and handle the response.

```js
// ==UserScript==
// @name         Scheduled API Checker
// @namespace    https://example.com
// @grant        CAT.agent.task
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// ==/UserScript==

CAT.agent.task.addListener("TASK_ID_HERE", async (trigger) => {
  try {
    const resp = await new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: "https://api.example.com/status",
        onload: resolve,
        onerror: reject,
      });
    });

    const data = JSON.parse(resp.responseText);

    if (data.status !== "ok") {
      GM_notification({
        title: `⚠️ ${trigger.name}`,
        text: `Service status: ${data.status}`,
      });
    }
  } catch (err) {
    console.error(`[${trigger.name}] Request failed:`, err);
    GM_notification({
      title: `❌ ${trigger.name}`,
      text: `Request failed: ${err.message}`,
    });
  }
});
```

## Bot Notification Example

Push a message to a webhook (Slack, Discord, DingTalk, Feishu, etc.).

```js
// ==UserScript==
// @name         Scheduled Bot Push
// @namespace    https://example.com
// @grant        CAT.agent.task
// @grant        GM_xmlhttpRequest
// ==/UserScript==

const WEBHOOK_URL = "https://hooks.example.com/webhook/YOUR_TOKEN";

CAT.agent.task.addListener("TASK_ID_HERE", async (trigger) => {
  const message = {
    text: `⏰ Scheduled task "${trigger.name}" triggered at ${trigger.triggeredAt}`,
  };

  try {
    await new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: WEBHOOK_URL,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(message),
        onload: resolve,
        onerror: reject,
      });
    });
    console.log(`[${trigger.name}] Notification sent`);
  } catch (err) {
    console.error(`[${trigger.name}] Failed to send notification:`, err);
  }
});
```

## Tips

- Replace `TASK_ID_HERE` with the actual task ID returned by `create_scheduled_task`
- One userscript can listen to multiple tasks by calling `addListener` multiple times
- Use `GM_notification` for desktop alerts, `GM_xmlhttpRequest` for HTTP calls
- Always wrap async work in try/catch to avoid silent failures
