# Command: /verify-and-commit

Invoke the flow-verifier agent, and commit if all checks pass.

## Usage
```
/verify-and-commit [feature-name]
/verify-and-commit "input-system"
```

## What this does
1. Runs all verification scenarios (A–D) against the implementation
2. Writes verification-report.md to .claudedoc/{feature}/

### If PASS:
3. Runs /close-scope — updates product.md, CLAUDE.md Known Open Issues,
   and creates the next scope stub
4. Stages all changes: `git add -A`
5. Commits with conventional format
6. Pushes to origin main
7. Reports commit hash

### If FAIL:
- Lists BLOCKER findings
- Does NOT run /close-scope
- Does NOT commit
- Returns to implementer with specific issues

## Commit format used
```
type(scope): description

- what changed
- what was tested
- closes: #issue if applicable
```

## After running
If PASS: Vercel auto-deploys. Check deployment URL.
If FAIL: Fix blockers, then run /verify-and-commit again.
