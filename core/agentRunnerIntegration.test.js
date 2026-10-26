const test = require("node:test");
const assert = require("node:assert/strict");

const manager = require("./agentManager");
const runner = require("./agentRunner");
const guard = require("./autonomousGuard");

test.beforeEach(() => {
  const runnerReset = runner.reset();
  assert.equal(runnerReset.success, true);
  manager.reset();
  guard.reset();
});

test("approved external actions complete as safe handoffs without claiming execution", async () => {
  const agent = manager.createAgent({ id: "runner-integration-agent" });
  assert.equal(agent.success, true);

  const created = manager.createTask(
    agent.agent.id,
    "Send a test message",
    { id: "runner-handoff-task" }
  );
  assert.equal(created.success, true);

  const step = manager.addStep(created.task.id, {
    id: "runner-handoff-step",
    name: "Prepare outbound message",
    description: "Prepare a safe handoff for a message",
    action: "send_message",
    input: { request: "Send a test message" }
  });
  assert.equal(step.success, true);
  assert.equal(step.step.requiresApproval, true);

  const approved = manager.approveStep(created.task.id, step.step.id);
  assert.equal(approved.success, true);

  const result = await runner.runTask(created.task.id);
  assert.equal(result.success, true);
  assert.equal(result.task.status, manager.TASK_STATES.COMPLETED);

  const completedStep = result.task.steps.find(item => item.id === step.step.id);
  assert.equal(completedStep.status, manager.STEP_STATES.COMPLETED);
  assert.equal(completedStep.result.executed, false);
  assert.equal(completedStep.result.externalExecution, false);
  assert.equal(completedStep.result.awaitingIntegration, true);
  assert.equal(completedStep.result.handoff.action, "send_message");
});

test("emergency STOP blocks the real runner before a registered action handler runs", async () => {
  let handlerCalls = 0;
  const registered = runner.registerAction(
    "integration_test_action",
    async () => {
      handlerCalls += 1;
      return { success: true, output: "must not run" };
    }
  );
  assert.equal(registered.success, true);

  const agent = manager.createAgent({ id: "runner-stop-agent" });
  assert.equal(agent.success, true);

  const created = manager.createTask(
    agent.agent.id,
    "Verify STOP blocks execution",
    { id: "runner-stop-task" }
  );
  assert.equal(created.success, true);

  const first = manager.addStep(created.task.id, {
    id: "runner-stop-step-1",
    name: "Guarded action",
    description: "Must not run after emergency STOP",
    action: "integration_test_action",
    input: { request: "run guarded action" }
  });
  const second = manager.addStep(created.task.id, {
    id: "runner-stop-step-2",
    name: "Following calculation",
    description: "Must remain pending after STOP",
    action: "calculate",
    input: { request: "calculate 1 + 1" }
  });
  assert.equal(first.success, true);
  assert.equal(second.success, true);

  const approved = manager.approveStep(created.task.id, first.step.id);
  assert.equal(approved.success, true);

  const stopped = guard.activateStop("Regression test emergency STOP");
  assert.equal(stopped.success, true);
  assert.equal(guard.isStopped(), true);

  const result = await runner.runTask(created.task.id);
  assert.equal(result.success, false);
  assert.equal(handlerCalls, 0, "the action handler must never run after STOP");

  const finalTask = manager.getTask(created.task.id).task;
  assert.equal(finalTask.steps.find(item => item.id === first.step.id).status, manager.STEP_STATES.FAILED);
  assert.equal(finalTask.steps.find(item => item.id === second.step.id).status, manager.STEP_STATES.PENDING);
});


test("global STOP blocks direct runner execution before task state changes", async () => {
  const agent = manager.createAgent({ id: "runner-stop-before-mutation-agent" });
  assert.equal(agent.success, true);
  const created = manager.createTask(agent.agent.id, "Must remain untouched", {
    id: "runner-stop-before-mutation-task"
  });
  assert.equal(created.success, true);
  const step = manager.addStep(created.task.id, {
    id: "runner-stop-before-mutation-step",
    name: "Guarded calculation",
    action: "calculate",
    input: { request: "calculate 1 + 1" }
  });
  assert.equal(step.success, true);
  const before = manager.getTask(created.task.id).task;

  assert.equal(guard.activateStop("direct runner execution STOP test").success, true);
  const result = await runner.runTask(created.task.id);

  assert.equal(result.success, false);
  assert.equal(result.stopped, true);
  assert.equal(result.executionStarted, false);
  assert.equal(result.stage, "emergency-stop");
  assert.deepEqual(manager.getTask(created.task.id).task, before);
});

test("global STOP blocks direct runner resume before unpausing a task", async () => {
  const agent = manager.createAgent({ id: "runner-resume-stop-agent" });
  assert.equal(agent.success, true);
  const created = manager.createTask(agent.agent.id, "Must remain paused", {
    id: "runner-resume-stop-task"
  });
  assert.equal(created.success, true);
  const step = manager.addStep(created.task.id, {
    id: "runner-resume-stop-step",
    name: "Guarded calculation",
    action: "calculate",
    input: { request: "calculate 1 + 1" }
  });
  assert.equal(step.success, true);
  assert.equal(manager.pauseTask(created.task.id).success, true);
  const before = manager.getTask(created.task.id).task;

  assert.equal(guard.activateStop("direct runner resume STOP test").success, true);
  const result = await runner.resumeTask(created.task.id);

  assert.equal(result.success, false);
  assert.equal(result.stopped, true);
  assert.equal(result.executionStarted, false);
  assert.equal(result.stage, "emergency-stop");
  assert.deepEqual(manager.getTask(created.task.id).task, before);
});

test("global STOP blocks runner createAndRunTask before invoking the planner", async () => {
  let plannerCalls = 0;
  const planner = {
    createPlannedTask() {
      plannerCalls += 1;
      return { success: false, error: "must not be called" };
    }
  };

  assert.equal(guard.activateStop("direct runner create-and-run STOP test").success, true);
  const result = await runner.createAndRunTask(planner, "agent-id", "Blocked request");

  assert.equal(result.success, false);
  assert.equal(result.stopped, true);
  assert.equal(result.executionStarted, false);
  assert.equal(result.stage, "emergency-stop");
  assert.equal(plannerCalls, 0);
});
