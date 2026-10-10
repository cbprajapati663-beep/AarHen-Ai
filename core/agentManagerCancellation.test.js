const test = require("node:test");
const assert = require("node:assert/strict");

const manager = require("./agentManager");

test("cancelling an in-flight step preserves CANCELLED and blocks later steps", async () => {
  manager.reset();

  const agentResult = manager.createAgent({
    id: "cancel-inflight-agent",
    name: "Cancel Inflight Agent"
  });
  assert.equal(agentResult.success, true);

  const taskResult = manager.createTask(
    agentResult.agent.id,
    "Cancel a task while its step is running",
    { id: "cancel-inflight-task" }
  );
  assert.equal(taskResult.success, true);

  const firstStep = manager.addStep(taskResult.task.id, {
    id: "cancel-inflight-step-1",
    name: "In-flight step",
    description: "Wait while cancellation occurs",
    action: "calculate"
  });
  const secondStep = manager.addStep(taskResult.task.id, {
    id: "cancel-inflight-step-2",
    name: "Must not run",
    description: "Must remain pending after cancellation",
    action: "calculate"
  });
  assert.equal(firstStep.success, true);
  assert.equal(secondStep.success, true);

  let signalStarted;
  let releaseStep;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const gate = new Promise(resolve => { releaseStep = resolve; });
  let firstExecutions = 0;
  let secondExecutions = 0;

  const running = manager.runTask(taskResult.task.id, async ({ step }) => {
    if (step.id === firstStep.step.id) {
      firstExecutions += 1;
      signalStarted();
      await gate;
      return { success: true, output: "runner completed after cancellation" };
    }
    if (step.id === secondStep.step.id) {
      secondExecutions += 1;
      return { success: true, output: "should never execute" };
    }
    throw new Error("Unexpected step: " + step.id);
  });

  await started;

  const cancelled = manager.cancelTask(
    taskResult.task.id,
    "Cancelled by regression test."
  );
  assert.equal(cancelled.success, true);
  assert.equal(cancelled.task.status, manager.TASK_STATES.CANCELLED);
  assert.equal(
    cancelled.task.steps.find(step => step.id === firstStep.step.id).status,
    manager.STEP_STATES.STOPPED
  );

  releaseStep();
  const finalResult = await running;

  assert.equal(finalResult.success, false);
  assert.equal(finalResult.cancelled, true);
  assert.equal(finalResult.task.status, manager.TASK_STATES.CANCELLED);
  assert.equal(firstExecutions, 1);
  assert.equal(secondExecutions, 0);
  assert.equal(
    finalResult.task.steps.find(step => step.id === firstStep.step.id).status,
    manager.STEP_STATES.STOPPED
  );
  assert.equal(
    finalResult.task.steps.find(step => step.id === secondStep.step.id).status,
    manager.STEP_STATES.PENDING
  );
});
