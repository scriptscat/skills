// ==SkillScript==
// @name         delete_scheduled_task
// @description  Delete a scheduled task and clear its run history
// @param        id string [required] Task ID
// @grant        CAT.agent.task
// ==/SkillScript==

const task = await CAT.agent.task.get(args.id);
if (!task) {
  return { error: `Task ${args.id} not found` };
}

const removed = await CAT.agent.task.remove(args.id);

return {
  removed,
  name: task.name,
  message: removed ? `Deleted task '${task.name}'` : "Delete failed",
};
