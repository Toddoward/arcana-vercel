# ARCANA — Project Constitution

## Identity
- Project: ARCANA (1–4 player co-op browser game)
- Stack: React 18 + Three.js r128 + Zustand + PeerJS + Vite 5
- Deploy: Vercel (auto-deploy on git push to main)
- Repo: arcana-vercel

## Current Priority (override everything else)
**The game is unplayable. No input works. No UI responds.**
Fix the playable loop FIRST. Do not add features until this passes:
  Title → Lobby → Character Select → Worldmap → one Battle → return

## Confirmed Architecture
- Engine: CameraRig.js, SceneManager.js, AssetManager.js
- Scenes: WorldMapScene, BattleScene, DungeonScene
- State: Zustand (gameStore, playerStore, uiStore)
- Network: PeerJS P2P — host holds authoritative state
- Signal: /api/signal.js (Vercel Serverless)

## Directory Rules (hard constraints)
- Battle logic      → src/game/battle/        (NOT combat/)
- Camera logic      → src/engine/CameraRig.js only
- UI design tokens  → src/ui/theme.js         (no inline colors/sizes)
- Scene files       → src/engine/scenes/      only
- Agent outputs     → .claudedoc/{feature}/   only

## Locked Values — NEVER MODIFY
- All numeric literals in CameraRig.js (interpolation params)
- All numeric literals in shader/geometry code
- Exception: only when Todd explicitly provides replacement values

## Known Open Issues
- [x] Input system not responding (CRITICAL-1~5 resolved)
- [x] Lobby join mode branching (resolved)
- [x] Worldmap: the turn doesn't start or end, and it's impossible to tell whose turn it is.
- [x] Worldmap: movement ignores AP cost (teleports freely)
- [x] Worldmap: no hex path interpolation (LERP movement missing)
- [x] Worldmap: tile arrival events not triggering
- [x] Worldmap: turn start/end flow not wired to UI
- [x] UI: React components not visible over Three.js canvas (z-index)
- [x] Assets not in repo (resolved: present at public/assets/icons and public/assets/images)
- [ ] WebRTC cross-network test not done
- [ ] Battle flow: card play → damage → enemy AI turn not fully wired

## Code Style
- ESM only (no CommonJS require)
- Functional React components only (no class components)
- No inline styles — use theme.js tokens exclusively
- JSDoc comments on all exported functions

## Workflow Rules
1. Run diagnostician before any implementation
2. Implement one atomic unit at a time
3. Run `npm run build` after every change — fix before continuing
4. Run flow-verifier after every implementation
5. Commit only after verifier passes — use conventional commit format
6. Update Known Open Issues list when issues are resolved or discovered
7. Use /clear between unrelated tasks to avoid context pollution

## Commit Format
```
type(scope): short description

- bullet: what changed and why
- bullet: what was tested
- closes: #issue if applicable
```
Types: feat | fix | refactor | test | docs | chore

## Self-Review Checklist (run before every commit)
- [ ] No files written outside declared directories
- [ ] npm run build passes with zero errors
- [ ] No locked values were modified
- [ ] Known Open Issues list updated
- [ ] Commit message follows format above
