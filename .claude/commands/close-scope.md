# Command: /close-scope

Close the current scope, update all spec files, and prepare next scope.

## Usage
```
/close-scope [scope-name] [commit-hash]
/close-scope "worldmap-turn" "a3f9c12"
```

## What this does

### Step 1 — Update steering/product.md
- Move current scope from Feature Queue to Resolved table
  with today's date and provided commit hash
- Set next PRIORITY 1 item to IN PROGRESS
- Update Current Mission to next priority item
- Update Completion Criteria to match next scope
- Update Out of Scope to exclude current scope items

### Step 2 — Update CLAUDE.md Known Open Issues
- Mark resolved issues as [x]
- Add any new issues discovered during this scope as [ ]

### Step 3 — Create next scope diagnosis stub
- Create .claudedoc/{next-scope}/diagnosis.md with header only:
  ```
  # Diagnosis: {next-scope}
  Status: PENDING — run /diagnose to populate
  ```

### Step 4 — Report
> Do not commit here. verify-and-commit handles the commit after this step completes.

Print summary:
- Closed: {scope-name} @ {commit-hash}
- Resolved issues: list
- Next scope: {next-scope}
- Run /diagnose to begin next scope