# Command: /implement

Invoke the implementer agent to fix what diagnostician found.

## Usage
```
/implement [feature-name]
/implement "input-system"
/implement "battle-render"
```

## What this does
1. Reads CLAUDE.md + all steering docs
2. Reads .claudedoc/{feature}/diagnosis.md
3. Implements the minimum fix described in diagnosis
4. Runs `npm run build` — does NOT continue if build fails
5. Writes implementation-notes.md to .claudedoc/{feature}/
6. Hands off to flow-verifier

## Rules
- One atomic fix per invocation
- Build must pass before marking ready for verification
- Locked values in CLAUDE.md are never touched

## After running
Review implementation-notes.md, then run /verify.
