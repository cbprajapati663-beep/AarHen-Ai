const test = require("node:test");
const assert = require("node:assert/strict");

const manager = require("./agentManager");
const runner = require("./agentRunner");
const workerApi = require("./agentWorker");

test.beforeEach(() => {
  workerApi.reset();
  runner.reset();
  manager.reset();
});

test("resumeWorker restarts the Agent Runner loop and completes the queued task", async () => {
  const agent = manager.createAgent({
    id: "worker-resume-agent",
    name: "Worker Resume Agent"
  });
  assert.equal(agent.success, true);

  const created = manager.createTask(
    agent.agent.id,
    "Complete a task after pause",
    { id: "worker-resume-task" }
  );
  assert.equal(created.success, true);

  const first = manager.addStep(created.task.id, {
    id: "worker-resume-step-1",
    name: "Pause first step",
    description: "Pause after the first step",
    action: "calculate"
  });
  const second = manager.addStep(created.task.id, {
    id: "worker-resume-step-2",
    name: "Complete second step",
    description: "Complete after resume",
    action: "calculate"
  });
  assert.equal(first.success, true);
  assert.equal(second.success, true);

  const createdWorker = workerApi.createWorker({
    id: "worker-resume-worker",
    agentId: agent.agent.id
  });
  assert.equal(createdWorker.success, true);
  assert.equal(
    workerApi.assignTask(createdWorker.worker.id, created.task.id).success,
    true
  );

  let firstExecutions = 0;
  let secondExecutions = 0;
  const controlledRunner = async ({ task, step }) => {
    if (step.id === first.step.id) {
      firstExecutions += 1;
      const paused = manager.pauseTask(task.id);
      assert.equal(paused.success, true);
      return { success: true, output: "first step complete" };
    }
    if (step.id === second.step.id) {
      secondExecutions += 1;
      return { success: true, output: "second step complete" };
    }
    throw new Error("Unexpected step: " + step.id);
  };

  const initial = await workerApi.runAssignedTask(
    createdWorker.worker.id,
    { runner: controlledRunner }
  );
  assert.equal(initial.success, true);
  assert.equal(initial.task.status, manager.TASK_STATES.PAUSED);
  assert.equal(initial.workerStatus, workerApi.WORKER_STATES.PAUSED);
  assert.equal(firstExecutions, 1);
  assert.equal(secondExecutions, 0);

  const resumed = await workerApi.resumeWorker(createdWorker.worker.id);
  assert.equal(resumed.success, true);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.task.status, manager.TASK_STATES.COMPLETED);
  assert.equal(resumed.worker.status, workerApi.WORKER_STATES.IDLE);
  assert.equal(resumed.worker.activeTaskId, null);
  assert.deepEqual(resumed.worker.queue, []);
  assert.equal(firstExecutions, 1, "completed first step must not repeat");
  assert.equal(secondExecutions, 1, "next pending step must execute once");
});
