# Worldmap Flow — Diagnosis
**Date:** 2026-04-07
**Status:** Diagnosis only. No fixes applied.

---

## Issue #1 — Turn Flow: UI Not Wired to Turn Logic

### Root Cause
`WorldMapScene.onTurnStart()` (line 334–348) is defined but is only ever called from
`advanceWorldTurn()` (line 531) **after** the world turn ends — not at the start of a
player's turn. No signal is emitted to any React component when `currentPlayerIndex`
changes, so users never see a "Player X's Turn" announcement.

`WorldHUD.jsx` (line 62) shows a static "Turn {worldTurn}" counter but has no observer
for `currentPlayerIndex` and renders no turn-transition UI (toast, banner, modal).

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `src/engine/scenes/WorldMapScene.js` | 334–348, 527–531 | `onTurnStart()` isolated; no UI signal on turn change |
| `src/ui/hud/WorldHUD.jsx` | 62 | Static counter only; no turn-start/end feedback |
| `src/App.jsx` | 252 | `onEndTurn` handler exists but does not trigger any turn-announcement UI |

### What Is Missing
- A call to `useUiStore.getState().showToast(...)` (or equivalent) inside `onTurnStart()` with the current player's name.
- A Zustand subscriber in `WorldHUD` (or a dedicated `TurnBanner` component) that reacts to `currentPlayerIndex` changes and displays a timed overlay.

---

## Issue #2 — UI Depth: React Components Not Visible Over Three.js Canvas

### Root Cause
`index.html` sets `z-index: 0` on the canvas wrapper and `z-index: 10` on `#ui-root`,
which is correct in principle. However, `App.jsx` line 162 sets `pointerEvents: 'none'`
on the root React div (required so clicks pass through to Three.js), and several child
components do **not** restore `pointerEvents: 'auto'`, making them visually present but
non-interactive (click events fall through to the canvas).

Additionally, full-screen modals rendered inside `App.jsx` (ShopUI, RandomEventModal,
etc.) rely on inline z-index values that are not sourced from `theme.js`, creating
inconsistent layering when multiple overlays are open simultaneously.

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `index.html` | 27–36 | Z-index hierarchy defined here; canvas=0, ui-root=10 |
| `src/App.jsx` | 162, 405–416 | Root `pointerEvents: 'none'`; not all children restore `'auto'` |
| `src/ui/hud/WorldHUD.jsx` | throughout | No explicit `pointerEvents: 'auto'` on interactive elements |

### What Is Missing
- Every interactive React overlay must set `pointerEvents: 'auto'` explicitly.
- All z-index values must be sourced from `src/ui/theme.js` tokens to avoid conflicts.
- A stacking-context audit: any component that sets `transform` or `opacity` creates a new stacking context and can break assumed z-order.

---

## Issue #3 — Movement: AP Cost Not Enforced (Player Teleports)

### Root Cause
`WorldMapScene._handleTileClick()` (line 265–309) calls
`useGameStore.getState().moveParty?.({ x, y })` immediately upon tile click with no
AP validation. `playerStore.spendAP()` exists (line 224–231 of `playerStore.js`) but is
never invoked for worldmap movement. The result is free, instant teleportation.

`HexGrid.js` exposes a `distance()` helper (line 99+) that could compute move cost, but
it is never called from the movement path.

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `src/engine/scenes/WorldMapScene.js` | 265–309 | No AP check before `moveParty()` call |
| `src/stores/playerStore.js` | 224–231, 488–492 | `spendAP()` exists; `movePlayer()` never calls it |
| `src/game/world/HexGrid.js` | 99+ | `distance()` available but unused for movement cost |

### What Is Missing
- Compute `apCost = hexGrid.distance(fromX, fromY, toX, toY)` before moving.
- Gate movement: `if (player.currentAP < apCost) return`.
- Call `playerStore.getState().spendAP(playerId, apCost)` after movement is accepted.
- A UI indicator showing remaining AP on the worldmap HUD.

---

## Issue #4 — Movement: No Hex Shortest-Path LERP Interpolation

### Root Cause
`WorldMapScene._startMarkerMove()` (line 317–328) uses `THREE.Vector3.lerpVectors()`
between the current position and the destination in a single straight-line interpolation.
It does not follow hex-grid topology; the marker cuts diagonally across tiles.

`HexGrid.findPath()` (line 99–150) is a working A* implementation but is **only** called
by `DragonAI.js` — never by player movement. `_handleTileClick()` never invokes
`findPath()`.

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `src/engine/scenes/WorldMapScene.js` | 265–309, 317–328, 595–605 | No `findPath()` call; single lerp to destination |
| `src/game/world/HexGrid.js` | 99–150 | `findPath()` implemented but not used for player movement |

### What Is Missing
- Before calling `_startMarkerMove()`, compute: `const path = worldGrid.findPath(fromX, fromY, toX, toY)`.
- Validate: `if (!path || path.length === 0) return` (unreachable tile).
- Redesign `_startMarkerMove()` to accept a path array and advance through each waypoint sequentially, Lerping between consecutive hex centers.
- Store the active path in an instance variable and advance through it frame-by-frame in the update loop.

---

## Issue #5 — Tile Events: No Battle/Dungeon/Town/Event Trigger on Arrival

### Root Cause
`WorldMapScene._handleTileClick()` (lines 298–308) fires tile-event logic
**synchronously** at the moment of click — before the marker Lerp animation completes.
`_startMarkerMove()` accepts an optional `onDone` callback (the `_markerMoveCb`
mechanism at line 603), but `_handleTileClick()` never passes one. As a result, event
modals appear (or are supposed to appear) before the player visually arrives at the tile.

In `App.jsx` (lines 258–283), modals for `villagePayload`, `randomEventPayload`, etc.
render conditionally on state flags — but those flags are set too early and there is no
integration connecting WorldMapScene's arrival event to DungeonScene or BattleScene
transitions.

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `src/engine/scenes/WorldMapScene.js` | 265–309, 317–328, 603 | Events triggered at click, not at arrival; `onDone` callback unused |
| `src/ui/hud/WorldHUD.jsx` | throughout | No modal renders for dungeon/battle/town triggers |
| `src/App.jsx` | 258–283 | Payloads set without waiting for marker Lerp to complete |

### What Is Missing
- Move all tile-event logic into a callback passed to `_startMarkerMove()`:
  `_startMarkerMove(fromPos, toPos, () => this._triggerTileEvent(x, y, tileType))`.
- `_triggerTileEvent()` should branch on `tileType`: battle → emit scene transition to `BattleScene`; dungeon → `DungeonScene`; town → set `villagePayload`; event → set `randomEventPayload`.
- Scene transitions must be routed through `SceneManager.switchTo()`, not direct store writes.

---

## Summary

| # | Issue | Root Cause | Severity |
|---|-------|-----------|----------|
| 1 | Turn flow UI | `onTurnStart()` never signals React; no turn banner | HIGH |
| 2 | Z-index / pointer-events | `pointerEvents: 'none'` not restored on interactive overlays; unsourced inline z-index values | HIGH |
| 3 | AP cost enforcement | `spendAP()` never called for worldmap movement | HIGH |
| 4 | Hex path LERP | `findPath()` exists but never integrated into player movement | HIGH |
| 5 | Tile event triggers | Events fire at click-time, not on marker arrival; `onDone` callback unused | MEDIUM |

All five issues are **disconnected wiring** — the underlying systems (pathfinding, AP, stores, event callbacks) exist but are not connected to each other or to the React UI layer.
