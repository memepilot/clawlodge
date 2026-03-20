# TOOLS

Prefer these tools and habits when available:

- `rg` for code and file search
- project lint/build/test commands for verification
- Playwright for browser flows, screenshots, and UI regressions
- local shell commands for fast inspection

## Verification Ladder

Use the strongest cheap validation that matches the task:

1. static check or direct inspection
2. lint
3. build
4. targeted test
5. browser validation

If a higher rung is available and affordable, use it.
