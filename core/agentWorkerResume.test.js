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


test("resumeWorker continues a task after its required step is approved", async () => {
  const agent = manager.createAgent({
    id: "worker-approval-resume-agent",
    name: "Worker Approval Resume Agent"
  });
  assert.equal(agent.success, true);

  const created = manager.createTask(
    agent.agent.id,
    "Prepare a message after approval",
    { id: "worker-approval-resume-task" }
  );
  assert.equal(created.success, true);

  const step = manager.addStep(created.task.id, {
    id: "worker-approval-resume-step",
    name: "Prepare outbound message",
    description: "Wait for approval before preparing the safe handoff",
    action: "send_message",
    input: { request: "Prepare a test message" }
  });
  assert.equal(step.success, true);
  assert.equal(step.step.requiresApproval, true);

  const createdWorker = workerApi.createWorker({
    id: "worker-approval-resume-worker",
    agentId: agent.agent.id
  });
  assert.equal(createdWorker.success, true);
  assert.equal(
    workerApi.assignTask(createdWorker.worker.id, created.task.id).success,
    true
  );

  const initial = await workerApi.runAssignedTask(createdWorker.worker.id);
  assert.equal(initial.success, false, "execution must not proceed before approval");
  assert.equal(initial.task.status, manager.TASK_STATES.WAITING_APPROVAL);
  assert.equal(initial.workerStatus, workerApi.WORKER_STATES.WAITING_APPROVAL);

  const approved = manager.approveStep(created.task.id, step.step.id);
  assert.equal(approved.success, true);
  assert.equal(approved.task.status, manager.TASK_STATES.READY);

  const resumed = await workerApi.resumeWorker(createdWorker.worker.id);
  assert.equal(resumed.success, true);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.task.status, manager.TASK_STATES.COMPLETED);
  assert.equal(resumed.worker.status, workerApi.WORKER_STATES.IDLE);
  assert.equal(resumed.worker.activeTaskId, null);
  assert.deepEqual(resumed.worker.queue, []);

  const completedStep = resumed.task.steps.find(item => item.id === step.step.id);
  assert.equal(completedStep.status, manager.STEP_STATES.COMPLETED);
  assert.equal(completedStep.result.executed, false);
  assert.equal(completedStep.result.awaitingIntegration, true);
});

test("resumeWorker does not bypass a pending approval", async () => {
  const agent = manager.createAgent({ id: "worker-pending-approval-agent" });
  assert.equal(agent.success, true);

  const created = manager.createTask(
    agent.agent.id,
    "Wait for approval",
    { id: "worker-pending-approval-task" }
  );
  assert.equal(created.success, true);

  const step = manager.addStep(created.task.id, {
    id: "worker-pending-approval-step",
    name: "Approval protected message",
    action: "send_message",
    input: { request: "Do not send without approval" }
  });
  assert.equal(step.success, true);

  const createdWorker = workerApi.createWorker({
    id: "worker-pending-approval-worker",
    agentId: agent.agent.id
  });
  assert.equal(createdWorker.success, true);
  assert.equal(workerApi.assignTask(createdWorker.worker.id, created.task.id).success, true);

  const initial = await workerApi.runAssignedTask(createdWorker.worker.id);
  assert.equal(initial.task.status, manager.TASK_STATES.WAITING_APPROVAL);

  const attempted = await workerApi.resumeWorker(createdWorker.worker.id);
  assert.equal(attempted.success, false);
  assert.equal(attempted.requiresApproval, true);
  assert.equal(attempted.task.status, manager.TASK_STATES.WAITING_APPROVAL);
  assert.equal(attempted.worker.status, workerApi.WORKER_STATES.WAITING_APPROVAL);
});


test("runAssignedTask rejects a concurrent invocation for the same worker", async () => {
  const agent = manager.createAgent({
    id: "worker-single-flight-agent",
    name: "Worker Single Flight Agent"
  });
  assert.equal(agent.success, true);

  const created = manager.createTask(
    agent.agent.id,
    "Execute once under concurrent calls",
    { id: "worker-single-flight-task" }
  );
  assert.equal(created.success, true);

  const step = manager.addStep(created.task.id, {
    id: "worker-single-flight-step",
    name: "Gated execution step",
    description: "Ensure overlapping calls cannot start a second run",
    action: "calculate"
  });
  assert.equal(step.success, true);

  const createdWorker = workerApi.createWorker({
    id: "worker-single-flight-worker",
    agentId: agent.agent.id
  });
  assert.equal(createdWorker.success, true);
  assert.equal(
    workerApi.assignTask(createdWorker.worker.id, created.task.id).success,
    true
  );

  let executions = 0;
  let signalStarted;
  let releaseExecution;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const gate = new Promise(resolve => { releaseExecution = resolve; });

  const controlledRunner = async () => {
    executions += 1;
    signalStarted();
    await gate;
    return { success: true, output: "completed exactly once" };
  };

  try {
    const firstRun = workerApi.runAssignedTask(
      createdWorker.worker.id,
      { runner: controlledRunner }
    );
    await started;

    const duplicate = await workerApi.runAssignedTask(
      createdWorker.worker.id,
      { runner: controlledRunner }
    );
    assert.equal(duplicate.success, false);
    assert.match(duplicate.error, /already running/i);
    assert.equal(executions, 1, "the overlapping call must not start another execution");

    releaseExecution();
    const completed = await firstRun;
    assert.equal(completed.success, true);
    assert.equal(completed.task.status, manager.TASK_STATES.COMPLETED);
    assert.equal(executions, 1);
    assert.equal(
      workerApi.getWorker(createdWorker.worker.id).worker.status,
      workerApi.WORKER_STATES.IDLE
    );
  } finally {
    releaseExecution();
  }
});


test("runQueue halts at an approval gate without starting later queued tasks", async () => {
  const agent = manager.createAgent({
    id: "worker-queue-approval-agent",
    name: "Worker Queue Approval Agent"
  });
  assert.equal(agent.success, true);

  const protectedTask = manager.createTask(
    agent.agent.id,
    "Require approval before outbound action",
    { id: "worker-queue-protected-task" }
  );
  const laterTask = manager.createTask(
    agent.agent.id,
    "Run only after protected task clears",
    { id: "worker-queue-later-task" }
  );
  assert.equal(protectedTask.success, true);
  assert.equal(laterTask.success, true);

  const protectedStep = manager.addStep(protectedTask.task.id, {
    id: "worker-queue-protected-step",
    name: "Approval-protected outbound action",
    action: "send_message",
    input: { request: "Do not send without approval" }
  });
  const laterStep = manager.addStep(laterTask.task.id, {
    id: "worker-queue-later-step",
    name: "Later safe calculation",
    action: "calculate"
  });
  assert.equal(protectedStep.success, true);
  assert.equal(laterStep.success, true);

  const createdWorker = workerApi.createWorker({
    id: "worker-queue-approval-worker",
    agentId: agent.agent.id
  });
  assert.equal(createdWorker.success, true);
  assert.equal(workerApi.assignTask(createdWorker.worker.id, protectedTask.task.id).success, true);
  assert.equal(workerApi.assignTask(createdWorker.worker.id, laterTask.task.id).success, true);

  let laterTaskExecutions = 0;
  const result = await workerApi.runQueue(createdWorker.worker.id, {
    runner: async ({ task }) => {
      if (task.id === laterTask.task.id) {
        laterTaskExecutions += 1;
      }
      return { success: true, output: "unexpected runner invocation" };
    }
  });

  assert.equal(result.processed, 1, "queue must stop after the first approval-gated task");
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].success, false);
  assert.equal(result.results[0].task.status, manager.TASK_STATES.WAITING_APPROVAL);
  assert.equal(laterTaskExecutions, 0, "later queued work must not run before approval");
  assert.deepEqual(result.worker.queue, [protectedTask.task.id, laterTask.task.id]);
  assert.equal(result.worker.activeTaskId, protectedTask.task.id);
  assert.equal(result.worker.status, workerApi.WORKER_STATES.WAITING_APPROVAL);
  assert.equal(manager.getTask(laterTask.task.id).task.status, manager.TASK_STATES.READY);
});
