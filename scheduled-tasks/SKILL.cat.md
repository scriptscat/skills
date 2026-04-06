---
name: scheduled-tasks
description: Create, list, update, delete, and trigger cron-based scheduled tasks. Use for recurring automation (daily summaries, periodic checks, timed notifications), one-off scheduled jobs, or managing existing tasks (view, modify, pause, resume, delete).
scripts:
  - create_scheduled_task.js
  - delete_scheduled_task.js
  - list_scheduled_tasks.js
  - run_scheduled_task_now.js
  - update_scheduled_task.js
references:
  - cron_cheatsheet.md
  - event_listener_template.md
---

# Scheduled Tasks Skill

Create and manage cron-based scheduled tasks. Tasks run automatically at their scheduled time — the user does not need to be online.

> **Note:** These tools manage **persistent cron-based scheduled tasks** (stored in extension storage, survive browser restart). They are different from the built-in `create_task`/`list_tasks`/`update_task`/`delete_task` tools which are for **in-session task tracking** only.

## Two Modes

- **internal** — The Agent (LLM) receives the prompt and autonomously executes it (search, summarize, analyze). Best for tasks requiring understanding and generation.
- **event** — The task emits an event; a userscript listener handles execution (HTTP requests, bot notifications). Best for deterministic operations.

Rule of thumb: "understand/summarize/analyze" → internal. "send/call/check a fixed endpoint" → event.

### Event mode: listener setup

After creating an event-mode task, the user needs a userscript with `addListener`. Offer to help write it. See `references/event_listener_template.md` for templates.

```js
// In a userscript — @grant CAT.agent.task
CAT.agent.task.addListener("task_id_here", (trigger) => {
  // trigger = { taskId, name, crontab, triggeredAt }
});
```

## Tools

| Tool | Input → Output |
|------|----------------|
| `create_scheduled_task` | name, cron, mode, prompt?, notify?, modelId? → task ID + next run time |
| `list_scheduled_tasks` | mode?, enabled? → tasks with status and last run info |
| `update_scheduled_task` | id, fields to change → updated task info |
| `delete_scheduled_task` | id → deletion confirmation |
| `run_scheduled_task_now` | id → triggers immediate execution (schedule unaffected) |

## Workflow

**Creating:**
1. Decide mode (internal / event) based on user intent
2. Convert time description to cron (see `references/cron_cheatsheet.md`). If ambiguous, confirm with user
3. For internal: write a specific prompt (see below)
4. `create_scheduled_task` → confirm next run time
5. For event: remind user to set up listener script

**Managing:** `list_scheduled_tasks` → then `update_scheduled_task` / `delete_scheduled_task` / `run_scheduled_task_now` as needed

**Failed tasks:** Check `lastRunStatus`/`lastRunError` in `list_scheduled_tasks`. Inform user with error details. Fix (rewrite prompt, raise maxIterations, check URL), then `run_scheduled_task_now` to verify.

### Time description → cron

- "every morning" → `0 9 * * *`
- "weekday afternoons" → `0 14 * * 1-5`
- "Mon, Wed, Fri at 10am" → `0 10 * * 1,3,5`
- "twice a day" → `0 9,18 * * *` (confirm hours with user)

## Writing Internal Mode Prompts

The prompt is the Agent's sole instruction each time. Be specific:

| Bad | Good |
|-----|------|
| "summarize news" | "Search today's tech news, pick the 5 most important stories, provide title + one-sentence summary. Focus on AI, open source, major launches." |
| "check the website" | "Visit https://example.com/status, check if all services show 'operational'. If any is down, list affected services and status." |

Principles: specify scope, quantity, format, sources, and failure handling.

## Examples

```
User: "Summarize tech news every morning at 9"
→ create_scheduled_task("Daily tech news", "0 9 * * *", "internal",
    prompt="Search today's tech news, pick 5 most important, title + summary each", notify=true)

User: "Check service health every 30 min"
→ create_scheduled_task("Health check", "*/30 * * * *", "event")
  // Remind user to set up addListener

User: "Change news task to weekdays only"
→ list_scheduled_tasks() → find task → update_scheduled_task(id, crontab="0 9 * * 1-5")

User: "Pause the news task"
→ update_scheduled_task(id, enabled=false)

User: "Run it once now to test"
→ run_scheduled_task_now(id)
```

## Important Notes

- Internal mode requires `prompt`; `modelId` and `maxIterations` are optional
- `skills`: `"auto"` loads all, or pass a string array of skill names (e.g. `["skill-a", "skill-b"]`)
- `notify=true` sends desktop notification on completion
- Minimum interval: ~1 minute (chrome.alarms limit)
- `run_scheduled_task_now` requires the task to be enabled
- **Mode is immutable** — to switch, delete and recreate
- **Timezone:** Cron uses user's local browser timezone, no UTC conversion needed
