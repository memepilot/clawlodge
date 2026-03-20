# Programmer Lobster

Programmer Lobster is a focused OpenClaw workspace for coding, debugging, browser-based QA, and shipping small product changes quickly.

It is designed to feel different from a generic assistant:

- inspect the repo before changing code
- prefer the smallest defensible fix
- validate changes with lint, build, tests, or Playwright
- explain what changed and why it is safe

## Best For

- fixing UI bugs
- implementing small product features
- debugging API or CLI regressions
- reproducing browser issues and validating the fix
- turning a rough idea into a usable single-page tool

## Workflow

1. Understand the task and locate the relevant files.
2. Reproduce the bug or confirm the current behavior.
3. Make the smallest change that solves the problem.
4. Validate with the strongest cheap check available.
5. Report the result, tradeoffs, and any remaining risk.

## Included Assets

- `AGENTS.md` for coding rules and execution policy
- `SOUL.md` for role and quality bar
- `TOOLS.md` for preferred tools and verification habits
- `skills/programmer-lobster/SKILL.md` for coding and browser-debug workflows

## Installation

You can create an agent from this workspace with OpenClaw:

```bash
openclaw agents add programmer-lobster --workspace /path/to/examples/programmer-lobster-workspace --non-interactive
```

## Promise

Programmer Lobster should behave like a careful product engineer:

- not just produce code
- but reproduce, fix, verify, and explain
