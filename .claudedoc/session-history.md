# Session History — Key Decisions

## 2026-03-15 — Final UI + Camera Session
**Completed:**
- CameraRig.js unified across all 3 scenes (WorldMap, Battle, Dungeon)
- Dark fantasy UI theme finalized — tokens locked in theme.js
- Directory confirmed: src/game/battle/ (NOT combat/ — this was corrected)
- README rewritten in UX-first language (no technical jargon)
- GDD_master.md completed to 19 sections
- Vercel deployment package (zip) prepared

**Open at session end:**
- Lobby join mode branching not implemented (App.jsx mode="join" hardcoded)
- WebRTC cross-network test not performed
- Asset images not in repo (must upload manually):
  - public/assets/icons/favicon.png
  - public/assets/icons/apple-touch-icon.png
  - public/assets/images/title.png

## 2026-04-06 — Harness Setup Session (current)
**Completed:**
- CLAUDE.md written
- .claude/agents/: diagnostician, implementer, flow-verifier
- .claude/steering/: product, tech, structure
- .claude/commands/: /diagnose, /implement, /verify-and-commit

**Immediate next step:**
Run /diagnose with no arguments to get a full health check of why
input is unresponsive and UI is not reacting to state changes.

## Architecture Decisions Log

| Decision | Reason | Date |
|---|---|---|
| battle/ not combat/ | Naming corrected mid-project | 2026-03-12 |
| CameraRig.js as single camera module | Prevent per-scene camera drift | 2026-03-15 |
| PeerJS host-authoritative | Simpler than consensus model for 1-4 players | early |
| Zustand over Context | Performance — avoid full tree re-render on state change | early |
| No TypeScript | Reduce setup friction for solo developer | early |
| Three.js r128 locked | r129+ has breaking API changes in geometry handling | early |
