// ==CATTool==
// @name         update_task
// @description  Update a scheduled task's configuration — cron expression, enabled/disabled, prompt, etc.
// @param        id string [required] Task ID
// @param        name string New task name
// @param        crontab string New cron expression
// @param        enabled boolean Enable or disable the task
// @param        prompt string New LLM instruction (internal mode only)
// @param        notify boolean Send desktop notification on completion
// @param        modelId string Model ID for internal mode execution
// @param        skills string Skill loading strategy: "auto"=load all, or comma-separated skill names
// @param        maxIterations number Max tool-call rounds for LLM in internal mode
// @grant        CAT.agent.task
// ==/CATTool==

const updates = {};

if (args.name !== undefined) updates.name = args.name;
if (args.crontab !== undefined) updates.crontab = args.crontab;
if (args.prompt !== undefined) updates.prompt = args.prompt;
if (args.enabled !== undefined) updates.enabled = args.enabled;
if (args.notify !== undefined) updates.notify = args.notify;
if (args.modelId !== undefined) updates.modelId = args.modelId;
if (args.skills !== undefined) {
  updates.skills = args.skills === "auto" ? "auto" : args.skills.split(",").map((s) => s.trim());
}
if (args.maxIterations !== undefined) updates.maxIterations = args.maxIterations;

if (Object.keys(updates).length === 0) {
  return { error: "At least one field to update is required" };
}

const task = await CAT.agent.task.update(args.id, updates);

return {
  id: task.id,
  name: task.name,
  crontab: task.crontab,
  mode: task.mode,
  enabled: task.enabled,
  notify: task.notify,
  nextruntime: task.nextruntime ? new Date(task.nextruntime).toLocaleString() : null,
  message: "Task updated",
};
