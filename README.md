# AarHen-AI

AarHen-AI is a Node.js personal and business AI core. This repository contains the core orchestration, memory and learning, research, provider, worker, voice/vision, checkpoint recovery, and safety modules.

## Requirements

- Node.js 20 or newer
- npm

## Install

```bash
git clone https://github.com/cbprajapati663-beep/AarHen-Ai.git
cd AarHen-Ai
npm install
```

## Run tests locally

Run the core system checks:

```bash
npm test
```

Run the in-flight task cancellation regression:

```bash
npm run test:cancellation
```

Run the full automated suite, including HTTP smoke tests, worker/runner integration, checkpoint restart/recovery, provider-failure recovery, and recovery-lease safety tests:

```bash
npm run test:all
```

The core tests do not enable live research by default. To opt into the existing live-research test, set `RUN_LIVE_RESEARCH_TEST=true` in an environment where the required provider configuration is available.

## Optional persistent checkpoint storage

Checkpoint storage is in-memory by default. To enable file-backed checkpoint persistence, set `AARHEN_CHECKPOINT_STORE_DIR` to a writable directory before starting the Node.js process.

Linux/macOS example:

```bash
export AARHEN_CHECKPOINT_STORE_DIR="$PWD/data/checkpoints"
npm start
```

The checkpoint engine loads saved JSON checkpoints from this directory at startup. Keep the directory private, include it in your backup plan, and use a filesystem with reliable atomic file operations. This file-backed store is suitable for processes sharing the same filesystem; it is **not** a distributed database or a multi-host coordination service. Persistent storage is opt-in so a default run does not silently write task data to disk.

## Recovery lease storage

Recovery execution leases use file-backed storage under `data/recovery-leases` by default. Set `AARHEN_RECOVERY_LEASE_DIR` to choose another writable directory. Lease coordination and stale-guard recovery require processes to share the same filesystem. Cross-host guard cleanup is intentionally refused when the recorded owner cannot be verified.

Stale leases and mutation guards are not automatically reclaimed. Inspection exposes redacted metadata; cleanup requires owner authorization, an exact inspected fingerprint, explicit confirmation, and the relevant stale-process safety checks. Cleanup does not start or resume task execution.

## Start the server

```bash
npm start
```

Autonomous execution is opt-in through the request context (`autonomous: true`). Protected external actions remain approval-controlled. Do not connect external actions to real customers until owner authentication, permissions, approval, STOP, recovery, and provider configuration have been verified in the target deployment.

Keep API keys and other secrets out of source control. Use a test environment for manual experiments.

## CI

GitHub Actions runs the complete automated test suite for relevant pull requests and pushes to `main`. Server changes are included in both triggers. A green individual workflow confirms only the checks in that workflow; it does not by itself mean every capability is production-ready or that live providers have been tested.
