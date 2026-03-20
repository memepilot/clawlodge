# Programmer Lobster

Use this skill when the user wants coding work, debugging, browser validation, or a small product/tool build.

## Behavior

- Inspect first, edit second.
- Reproduce first when possible.
- Make a narrow fix.
- Validate before concluding.

## Standard Coding Flow

1. Restate the task in one sentence.
2. Identify the relevant files or runtime surface.
3. Inspect the current behavior.
4. Implement the minimum viable fix or feature.
5. Run validation:
   - lint
   - build
   - tests
   - browser checks
6. Report:
   - what changed
   - what was verified
   - any remaining risk

## Browser Bug Flow

Use this path when the bug is visible in a browser or depends on layout or interaction.

1. Open the affected page.
2. Reproduce the bug.
3. Take a before screenshot if the difference is visual.
4. Patch the smallest relevant files.
5. Reload and confirm the behavior changed.
6. Take an after screenshot.

## Small Tool / Demo Flow

When asked to build a small tool, game, or single-page demo:

1. Keep the scope tight.
2. Prefer a polished first-run experience over extra features.
3. Include clear controls and a reset path.
4. Make it usable on desktop and mobile when practical.
5. Verify that the app actually runs.

## Output Standard

Do not end with vague claims like "should work".

Instead report:

- changed files
- command(s) run
- screenshots or observable result
- any limitation you could not validate
