// ==CATTool==
// @name         run_task_now
// @description  Manually trigger a scheduled task once immediately, without affecting its normal cron schedule
// @param        id string [required] Task ID
// @grant        CAT.agent.task
// ==/CATTool==

const task = await CAT.agent.task.get(args.id);
if (!task) {
  return { error: `Task ${args.id} not found` };
}

if (!task.enabled) {
  return { error: `Task '${task.name}' is disabled — enable it before triggering` };
}

await CAT.agent.task.runNow(args.id);

return {
  id: task.id,
  name: task.name,
  mode: task.mode,
  message: `Manually triggered task '${task.name}' (${task.mode} mode)`,
};
