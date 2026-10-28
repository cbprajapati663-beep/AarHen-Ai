# AarHen-AI Live-Test Readiness

This guide separates a **local authenticated smoke test** from a **live-provider test**. Passing GitHub Actions does not mean a hosted server, API secrets, or external providers have been configured.

## Current safety baseline

The repository currently has regression coverage for:
- the global Emergency STOP at the runner and worker boundaries;
- approval gates that stop queue processing;
- separate general API and owner API keys;
- production fail-closed behavior when the general API key is missing;
- owner-only recovery endpoints and invalid-owner-key rejection;
- checkpoint/recovery lease safeguards.

The production commit should still be checked in GitHub Actions before a deployment. These tests do not replace a manual test against the exact deployment environment.

## Stage 1 — local authenticated smoke test (safe to start first)

Requirements: Node.js 20+, npm, a test machine, and no production customer data.

1. Clone the repository and install dependencies:
   ```powershell
   git clone https://github.com/cbprajapati663-beep/AarHen-Ai.git
   cd AarHen-Ai
   npm install
   ```

2. Generate **two different** high-entropy secrets. Run this twice and keep the values in a private password manager or local environment; never commit them:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Set the first value as `AARHEN_API_KEY` and the second value as `AARHEN_OWNER_API_KEY`. Do not use the same value for both.

3. In the same PowerShell terminal, set the environment for this terminal session (replace the placeholders locally; do not paste keys into chat or source files):
   ```powershell
   $env:NODE_ENV = "production"
   $env:AARHEN_API_KEY = "<your-private-general-api-key>"
   $env:AARHEN_OWNER_API_KEY = "<your-different-private-owner-api-key>"
   npm start
   ```
   Keep this terminal open. If the app reports a missing required provider or configuration, record the non-secret error; do not paste secrets into logs or screenshots.

4. Open a second PowerShell terminal and verify the public health endpoint:
   ```powershell
   Invoke-RestMethod http://localhost:3000/health
   ```
   Expected: HTTP 200 and a successful health response.

5. Verify that an unauthenticated protected request is rejected:
   ```powershell
   try {
     Invoke-RestMethod -Method Post -Uri http://localhost:3000/ask -ContentType "application/json" -Body '{"input":"Reply with exactly: AarHen smoke test"}'
   } catch {
     $_.Exception.Response.StatusCode.value__
   }
   ```
   Expected: HTTP 401 when the general API key is configured. Do not interpret a 200 from `/health` as proof that protected routes are authenticated.

6. Verify an authenticated, harmless request:
   ```powershell
   $headers = @{ Authorization = "Bearer $env:AARHEN_API_KEY" }
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/ask -Headers $headers -ContentType "application/json" -Body '{"input":"Reply with exactly: AarHen smoke test","context":{"autonomous":false}}'
   ```
   Expected: a JSON response with `success: true` if the configured local orchestration path can answer. A provider/configuration error should be recorded as a separate dependency issue, not silently treated as a pass.

7. Stop the server with Ctrl+C. Do not use real customer records or enable external side-effect actions in this first pass.

## Stage 2 — owner-route authentication check

Only run this against a local test instance with the two test secrets set.

- A request to any owner-only recovery endpoint must include **both**:
  - `Authorization: Bearer <AARHEN_API_KEY>`
  - `X-Aarhen-Owner-Key: <AARHEN_OWNER_API_KEY>`
- A general API key alone, an incorrect owner key, or a client-supplied `ownerAuthorized: true` must not authorize the route.
- Use a disposable test task only. Recovery/resume can execute task work after explicit confirmation; do not experiment against live customer workflows.

## Stage 3 — live provider test

Do this only after Stage 1 succeeds. Configure the provider credentials required by the provider adapter being tested, using private environment variables or the hosting provider's secret manager. Provider names and configuration differ by adapter; verify the specific adapter's required environment variables before running a live call.

Start with a harmless public-information query and a strict request/time budget. Confirm:
- which provider handled the request and whether fallback was used;
- timeout/error handling and whether secrets are absent from logs;
- STOP blocks the next execution attempt;
- a failed provider does not silently retry a potentially side-effecting action;
- checkpoint/recovery behavior works with disposable test data.

Never test send-email, send-message, write-file, delete-file, financial actions, or other external side effects on real targets during the first live test.

## Stage 4 — before hosting publicly

Do not expose the server to the public internet until all of these are verified in the target hosting environment:
- `NODE_ENV=production`;
- separate `AARHEN_API_KEY` and `AARHEN_OWNER_API_KEY` secrets are present and private;
- HTTPS, request-size limits, rate limiting, and suitable network access controls are configured;
- checkpoint and recovery-lease directories are persistent, private, backed up, and on a filesystem that supports the documented atomic operations;
- STOP behavior and recovery behavior have been tested against the actual process/deployment topology;
- provider credentials and billing limits are intentionally configured;
- all relevant GitHub Actions checks for the exact deployed commit have completed successfully.

**Deployment limitation:** the current global STOP flag and in-process execution guards are process-local. Do not assume they coordinate multiple independent server instances. For a multi-instance deployment, use shared, atomic coordination and verify it before allowing autonomous execution.

## Test result record

For each run, record date/time, commit SHA, environment (local/staging), check name, expected result, actual result, and pass/fail. Never record API keys or other secrets.
