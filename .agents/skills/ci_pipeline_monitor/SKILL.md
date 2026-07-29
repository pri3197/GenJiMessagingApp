---
name: ci_pipeline_monitor
description: Monitors GitHub Actions CI/CD pipeline runs, inspects workflow run statuses via gh CLI or API, detects failures, extracts failure logs, and triggers Antigravity IDE automated debugging and fix workflows.
---

# GitHub Actions CI/CD Pipeline Monitor & Antigravity IDE Debugger Skill

## Overview
This skill instructs the agent to monitor GitHub Actions pipeline executions for the `pri3197/GenJiMessagingApp` repository, detect failed CI/CD workflow steps, automatically extract complete error stack traces, and initiate autonomous step-by-step debugging and resolution.

---

## Workflow Instructions

### Step 1: Check GitHub Pipeline Status
Check recent GitHub Actions workflow runs:
```bash
gh run list --repo pri3197/GenJiMessagingApp --limit 5
```
Or query GitHub API:
```bash
curl -s https://api.github.com/repos/pri3197/GenJiMessagingApp/actions/runs?per_page=5
```

### Step 2: Detect Failures & Extract Logs
If any run exhibits `conclusion: "failure"` or `status: "completed"` with error:
1. Identify the failed job and step ID.
2. Download and read the full failed log traceback:
   ```bash
   gh run view <RUN_ID> --log-failed
   ```

### Step 3: Antigravity IDE Automated Debugging Loop
When a pipeline failure is detected:
1. **Log Analysis**: Inspect the exact file and line number causing the failure.
2. **Root Cause Diagnosis**: Trace failing unit tests, syntax errors, or environment mismatches.
3. **Automated Code Fix**: Apply minimal targeted code modifications to fix the root cause.
4. **Local Verification**: Run `npm test` locally to verify that all test suites pass.
5. **Commit & Push**: Commit the fix with a descriptive message (e.g., `fix(ci): auto-remediate pipeline failure in <component>`) and push to `main`.
6. **Re-Verify CI Pipeline**: Trigger or monitor the new pipeline run to confirm green `conclusion: "success"`.
