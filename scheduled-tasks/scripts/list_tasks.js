// ==SkillScript==
// @name         list_tasks
// @description  List all scheduled tasks with name, mode, cron, enabled status, and last run result. Supports optional filtering by mode and enabled status.
// @param        mode string[internal,event] Filter by execution mode (optional, shows all if omitted)
// @param        enabled boolean Filter by enabled status (optional, shows all if omitted)
// @grant        CAT.agent.task
// ==/SkillScript==

let tasks = await CAT.agent.task.list();

if (args.mode) {
  tasks = tasks.filter((t) => t.mode === args.mode);
}
if (args.enabled !== undefined) {
  tasks = tasks.filter((t) => t.enabled === args.enabled);
}

if (tasks.length === 0) {
  return { message: "No scheduled tasks found", count: 0 };
}

return {
  count: tasks.length,
  tasks: tasks.map((t) => ({
    id: t.id,
    name: t.name,
    mode: t.mode,
    crontab: t.crontab,
    enabled: t.enabled,
    notify: t.notify,
    lastRunStatus: t.lastRunStatus || "never executed",
    lastRunError: t.lastRunError || null,
    lastruntime: t.lastruntime ? new Date(t.lastruntime).toLocaleString() : null,
    nextruntime: t.nextruntime ? new Date(t.nextruntime).toLocaleString() : null,
  })),
};
