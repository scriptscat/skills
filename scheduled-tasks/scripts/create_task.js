// ==CATTool==
// @name         create_task
// @description  Create a scheduled task. Supports internal (LLM auto-executes) and event (notifies script) modes
// @param        name string [required] Task name
// @param        crontab string [required] Cron expression, format: min hour day month weekday, e.g. "0 9 * * *"
// @param        mode string[internal,event] [required] Execution mode: internal=LLM auto-executes, event=notifies script
// @param        prompt string The instruction the LLM executes each time (required for internal mode)
// @param        notify boolean Send desktop notification on completion, default false
// @param        modelId string Model ID for internal mode execution (optional, uses system default if omitted)
// @param        skills string Skill loading strategy: "auto"=load all, or comma-separated skill names
// @param        maxIterations number Max tool-call rounds for LLM in internal mode, default 10
// @grant        CAT.agent.task
// ==/CATTool==

const options = {
  name: args.name,
  crontab: args.crontab,
  mode: args.mode || "internal",
  enabled: true,
  notify: !!args.notify,
};

if (options.mode === "internal") {
  if (!args.prompt) {
    return { error: "prompt is required for internal mode" };
  }
  options.prompt = args.prompt;
  if (args.modelId) {
    options.modelId = args.modelId;
  }
  if (args.maxIterations) {
    options.maxIterations = args.maxIterations;
  }
}

if (args.skills) {
  options.skills = args.skills === "auto" ? "auto" : args.skills.split(",").map((s) => s.trim());
}

const task = await CAT.agent.task.create(options);

return {
  id: task.id,
  name: task.name,
  crontab: task.crontab,
  mode: task.mode,
  enabled: task.enabled,
  notify: task.notify,
  nextruntime: task.nextruntime ? new Date(task.nextruntime).toLocaleString() : "not calculated",
};
