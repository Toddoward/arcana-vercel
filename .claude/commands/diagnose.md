# Command: /diagnose

Invoke the diagnostician agent on a broken feature or the current game state.

## Usage
```
/diagnose [feature-or-symptom]
/diagnose "input system not responding"
/diagnose "battle scene does not render"
/diagnose  (no args = full health check of core loop)
```

## What this does
1. Reads CLAUDE.md, steering/tech.md, steering/structure.md
2. Traces the broken flow from user action to failure point
3. Checks the 10-step core flow for regressions
4. Writes diagnosis.md to .claudedoc/{feature}/
5. Reports findings without making any code changes

## After running
Review diagnosis.md, then run /implement to fix.
