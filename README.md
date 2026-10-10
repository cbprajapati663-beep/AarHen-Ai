# AarHen-AI

AarHen-AI is a Node.js personal and business AI core. This repository contains the core orchestration, memory and learning, research, provider, worker, voice/vision, and safety modules.

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

Run both suites:

```bash
npm run test:all
```

The core tests do not enable live research by default. To opt into the existing live-research test, set `RUN_LIVE_RESEARCH_TEST=true` in an environment where the required provider configuration is available.

## Start the server

```bash
npm start
```

Keep API keys and other secrets out of source control. Use a test environment for manual experiments, and do not connect external actions to real customers until their approval and safety flows have been verified.

## CI

GitHub Actions runs focused checks for core behavior, providers, worker lifecycle, checkpoint/recovery, and safety. A green individual workflow confirms only the checks in that workflow; it does not by itself mean every capability is production-ready.
