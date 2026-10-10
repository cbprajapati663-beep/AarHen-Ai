const test = require("node:test");
const assert = require("node:assert/strict");

const agentRunner = require("./agentRunner");
const autonomousGuard = require("./autonomousGuard");

test.beforeEach(() => {
  agentRunner.reset();
  autonomousGuard.reset();
});

test("emergency STOP blocks a safe built-in action before execution", async () => {
  const stop = autonomousGuard.activateStop("Regression test STOP");
  assert.equal(stop.success, true);

  const runner = agentRunner.createRunner();
  const result = await runner({
    task: {
      id: "stop-safe-task",
      agentId: "test-agent",
      request: "Calculate 1 + 1",
      stopRequested: false,
      pauseRequested: false,
      context: {}
    },
    step: {
      id: "step-safe",
      action: "calculate",
      approved: true,
      input: { request: "Calculate 1 + 1" }
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.stopped, true);
  assert.equal(result.blocked, true);
  assert.equal(result.executionStatus, "autonomous-stop");
});

test("emergency STOP cannot be bypassed by approving a protected action", async () => {
  const stop = autonomousGuard.activateStop("Regression test STOP");
  assert.equal(stop.success, true);

  const runner = agentRunner.createRunner();
  const result = await runner({
    task: {
      id: "stop-protected-task",
      agentId: "test-agent",
      request: "Write a file",
      stopRequested: false,
      pauseRequested: false,
      context: {}
    },
    step: {
      id: "step-protected",
      action: "write_file",
      approved: true,
      input: { request: "Write a file" }
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.stopped, true);
  assert.equal(result.executionStatus, "autonomous-stop");
  assert.notEqual(result.executionStatus, "protected-action-prepared");
});

test("emergency STOP blocks custom action handlers even when approved", async () => {
  let handlerCalled = false;
  const registered = agentRunner.registerAction(
    "stop_guard_custom_test",
    async () => {
      handlerCalled = true;
      return { success: true };
    }
  );
  assert.equal(registered.success, true);

  const stop = autonomousGuard.activateStop("Regression test STOP");
  assert.equal(stop.success, true);

  const runner = agentRunner.createRunner();
  const result = await runner({
    task: {
      id: "stop-custom-task",
      agentId: "test-agent",
      request: "Run a custom action",
      stopRequested: false,
      pauseRequested: false,
      context: {}
    },
    step: {
      id: "step-custom",
      action: "stop_guard_custom_test",
      approved: true,
      input: { request: "Run a custom action" }
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.stopped, true);
  assert.equal(result.executionStatus, "autonomous-stop");
  assert.equal(handlerCalled, false);
});
