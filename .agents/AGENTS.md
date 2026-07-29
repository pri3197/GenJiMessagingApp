# Antigravity Workspace Rules & Agent Directives

## CI/CD Pipeline Monitoring & Auto-Debugging Directives

1. **Continuous Pipeline Vigilance**:
   - Whenever code changes are committed and pushed to GitHub, automatically check the pipeline status for `pri3197/GenJiMessagingApp`.
   
2. **Autonomous Error Extraction**:
   - Never guess why a pipeline failed. Always fetch and inspect the full, un-truncated error logs from GitHub Actions before diagnosing.

3. **Antigravity Debug & Fix Loop**:
   - Identify the exact broken file and line number.
   - Fix the underlying code contract without suppressing symptoms or commenting out assertions.
   - Run local test verification (`npm test`).
   - Push the fix to Git and verify that the pipeline succeeds.
