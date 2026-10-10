const test = require("node:test");
const assert = require("node:assert/strict");

const manager = require("./agentManager");
const runner = require("./agentRunner");

test.beforeEach(() => {
  manager.reset();
  runner.reset();
});

function createTwoStepTask() {
  const agent = manager.createAgent({
    id: "resume-lifecycle-agent",
    name: "Resume Lifecycle Agent"
  });
  assert.equal(agent.success, true);

  const task = manager.createTask(
    agent.agent.id,
    "Verify pause and resume execution",
    { id: "resume-lifecycle-task" }
  );
  assert.equal(task.success, true);

  const first = manager.addStep(task.task.id, {
    id: "resume-step-1",
    name: "First step",
    description: "First step",
    action: "calculate"
  });
  const second = manager.addStep(task.task.id, {
    id: "resume-step-2",
    name: "Second step",
    description: "Second step",
    action: "calculate"
  });
  assert.equal(first.success, true);
  assert.equal(second.success, true);

  return { taskId: task.task.id, firstId: first.step.id, secondId: second.step.id };
}

test("resumeTask restarts the execution loop after a task has paused", async () => {
  const { taskId, firstId, secondId } = createTwoStepTask();
  let firstExecutions = 0;
  let secondExecutions = 0;

  const controlledRunner = async ({ task, step }) => {
    if (step.id === firstId) {
      firstExecutions += 1;
      const paused = manager.pauseTask(task.id);
      assert.equal(paused.success, true);
      return { success: true, output: "first step complete" };
    }
    if (step.id === secondId) {
      secondExecutions += 1;
      return { success: true, output: "second step complete" };
    }
    throw new Error("Unexpected step: " + step.id);
  };

  const initial = await runner.runTask(taskId, { runner: controlledRunner });
  assert.equal(initial.success, true);
  assert.equal(initial.result.paused, true);
  assert.equal(initial.task.status, manager.TASK_STATES.PAUSED);
  assert.equal(firstExecutions, 1);
  assert.equal(secondExecutions, 0);

  const resumed = await runner.resumeTask(taskId);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.success, true);
  assert.equal(resumed.task.status, manager.TASK_STATES.COMPLETED);
  assert.equal(firstExecutions, 1, "completed first step must not repeat");
  assert.equal(secondExecutions, 1, "next pending step must execute once");
});

test("resumeTask does not start a duplicate loop while an action is in flight", async () => {
  const { taskId, firstId, secondId } = createTwoStepTask();
  let firstExecutions = 0;
  let secondExecutions = 0;
  let notifyStarted;
  let releaseStep;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  const gate = new Promise(resolve => { releaseStep = resolve; });

  const controlledRunner = async ({ task, step }) => {
    if (step.id === firstId) {
      firstExecutions += 1;
      const paused = manager.pauseTask(task.id);
      assert.equal(paused.success, true);
      notifyStarted();
      await gate;
      return { success: true, output: "first step complete" };
    }
    if (step.id === secondId) {
      secondExecutions += 1;
      return { success: true, output: "second step complete" };
    }
    throw new Error("Unexpected step: " + step.id);
  };

  const initialPromise = runner.runTask(taskId, { runner: controlledRunner });
  await started;
  const resumePromise = runner.resumeTask(taskId);
  releaseStep();

  const [initial, resumed] = await Promise.all([initialPromise, resumePromise]);
  assert.equal(initial.success, true);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.success, true);
  assert.equal(resumed.task.status, manager.TASK_STATES.COMPLETED);
  assert.equal(firstExecutions, 1);
  assert.equal(secondExecutions, 1);
});


test("reset refuses to discard runner state while a task is in flight", async () => {
  const { taskId, firstId, secondId } = createTwoStepTask();
  let notifyStarted;
  let releaseStep;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  const gate = new Promise(resolve => { releaseStep = resolve; });
  let secondExecutions = 0;

  const controlledRunner = async ({ step }) => {
    if (step.id === firstId) {
      notifyStarted();
      await gate;
      return { success: true, output: "first step complete" };
    }
    if (step.id === secondId) {
      secondExecutions += 1;
      return { success: true, output: "second step complete" };
    }
    throw new Error("Unexpected step: " + step.id);
  };

  const initialPromise = runner.runTask(taskId, { runner: controlledRunner });
  await started;

  const reset = runner.reset();
  assert.equal(reset.success, false);
  assert.equal(reset.status, "agent-runner-reset-blocked");
  assert.equal(reset.activeRunCount, 1);
  assert.match(reset.error, /while tasks are executing/i);

  releaseStep();
  const initial = await initialPromise;
  assert.equal(initial.success, true);
  assert.equal(initial.task.status, manager.TASK_STATES.COMPLETED);
  assert.equal(secondExecutions, 1);
});
