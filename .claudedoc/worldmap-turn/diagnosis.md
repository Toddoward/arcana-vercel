# Worldmap Turn — Diagnosis
**Date:** 2026-04-07
**Status:** Diagnosis only. No fixes applied.

Legend: **BROKEN** = system exists, wired wrong. **MISSING** = no implementation at all.

---

## Issue #1 — Turn Ownership Display

**Verdict: BROKEN**

### Root Cause
`advanceWorldTurn()` in `gameStore.js` (line 230–236) correctly cycles `currentPlayerIndex`
but does NOT reset the new player's AP. `playerStore.resetAP()` exists (line 215–222)
but is never called from either `advanceWorldTurn()` or `WorldMapScene._finalizeWorldTurn()`.

As a result, after a turn ends the incoming player has 0 AP (spent during the previous
turn's movement) and cannot move.

`WorldHUD.jsx` now reads `currentPlayerIndex` and `currentPlayerName` and the top bar
shows "X의 턴" — but the displayed AP is never shown at all (no AP readout exists in WorldHUD).

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `src/stores/gameStore.js` | 230–236 | `advanceWorldTurn()` only cycles index + turn; never resets AP |
| `src/engine/scenes/WorldMapScene.js` | 583–590 | `_finalizeWorldTurn()` calls `advanceWorldTurn()` but not `resetAP()` |
| `src/stores/playerStore.js` | 215–222 | `resetAP()` exists and is correct, but never called per-turn on worldmap |
| `src/ui/hud/WorldHUD.jsx` | throughout | No AP readout exists — AP value invisible to the player |

### What Is Missing
- In `_finalizeWorldTurn()`: after `gs.advanceWorldTurn()`, call `usePlayerStore.getState().resetAP(nextPlayer.id)`.
- Add an AP display to `WorldHUD` (e.g., `⚡ {currentPlayer.currentAP} AP`).

---

## Issue #2 — Camera: Turn Transition

**Verdict: BROKEN**

### Root Cause
`onTurnStart()` (WorldMapScene.js:389–406) correctly calls `_slerpToTile()` to the new
player's position — but it reads `player.tileX / player.tileY`, which are individual
player tile coordinates. On the worldmap all players share a single `partyPos` in
`gameStore`; individual `tileX/tileY` are only set by `playerStore.movePlayer()` (used
for force-join). For a fresh game these fields are `undefined`, so `onTurnStart()` tries
to Slerp to tile `(0, 0)` instead of the party's actual position.

During movement, the camera does chase the marker correctly for normal tiles via
`_slerpToTile(x, y, () => this._startFollowParty())`. However for cinematic tiles
(ENEMY, DUNGEON, BOSS, RANDOM\_EVENT), `_slerpToTile(x, y)` is called **with no
callback** (line 314), so `_startFollowParty()` is never re-armed after the cutscene —
camera freezes at the tile instead of following the moving marker.

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `src/engine/scenes/WorldMapScene.js` | 389–406 | `onTurnStart()` reads `player.tileX/tileY` (undefined for party) instead of `gs.partyPos` |
| `src/engine/scenes/WorldMapScene.js` | 314 | Cinematic `_slerpToTile(x, y)` has no callback — camera stays frozen |

### What Is Missing
- `onTurnStart()` should use `gs.partyPos` as the focus point, not individual player coordinates.
- Cinematic path needs `_slerpToTile(x, y, () => this._startFollowParty())` so follow resumes after cutscene.

---

## Issue #3 — Camera: Right-Click Orbit

**Verdict: MISSING** (orbit system does not exist)

### Root Cause
`CameraRig._onMouseMove()` (line 253–279) implements right-click drag as a **pure
world-space pan**:

```js
this._freePan.x -= dx * panSpeed;  // line 263
this._freePan.z -= dy * panSpeed;  // line 264
```

The camera's X and Z are then set directly to `_freePan.x / _freePan.z` (lines 272–273),
clamped to `±_mapBound` around the world origin. There is no pivot point, no rotation
matrix, no spherical coordinates — no orbit implementation of any kind.

The GDD intent (orbit around the current look-at point) would require computing the
vector from a target to the camera, rotating it, and repositioning. That code does not
exist anywhere in `CameraRig.js`.

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `src/engine/CameraRig.js` | 244–281 | Right-click handler is a translate/pan; orbital rotation is absent entirely |

### What Is Missing
- A `_orbitTarget` (THREE.Vector3) that tracks the current look-at point.
- Right-click drag should rotate a spherical coordinate offset around `_orbitTarget`
  and reposition `camera.position` accordingly, then call `camera.lookAt(_orbitTarget)`.

---

## Issue #4 — Input Passthrough

**Verdict: BROKEN**

### Root Cause
`WorldMapScene._onPointerClick()` (line 243) listens on `window` for every `'click'`
event with no guard against UI-originated clicks:

```js
_onPointerClick(e) {
  if (this._dragonCutscene) return;
  this._updatePointer(e);
  this._raycaster.intersectObjects(this._tileGroup.children, false);
  // ...
}
```

When the user clicks a HUD button (e.g. "턴 종료"), the DOM event bubbles up to
`window`. There is no `e.target` check. The raycaster fires against the tile group at
whatever screen coordinates the button was at, often hitting a tile behind it.

The React side is correctly layered (`pointerEvents:'auto'` on HUD fixed divs) so the
button receives the click first — but `stopPropagation()` is never called, and the
`window` listener catches it anyway.

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `src/engine/scenes/WorldMapScene.js` | 243–251 | `_onPointerClick` has no `e.target` / canvas check; fires on all window clicks |

### What Is Missing
- The renderer canvas element reference must be stored (e.g., `this._canvas = renderer.domElement`).
- `_onPointerClick` must early-return if `e.target !== this._canvas`.
- Alternatively, listen on the canvas element directly instead of `window`.

---

## Issue #5 — Movement: Teleport

**Verdict: BROKEN**

### Root Cause
`_walkPath()` and `_startMarkerMove()` exist and the Lerp update loop is correct.
The animation **does** run — but `_hexGrid.findPath()` is called with the current
`partyPos` as `fromPos`. If the partyPos tile is not registered in the HexGrid
(e.g., initial spawn tile is missing), `findPath()` returns `null`, the code falls back
to a direct single-segment `_startMarkerMove(prevPos, {x,y}, onArrival)`, and the marker
animates in a straight line that crosses non-adjacent tiles — visually resembling teleportation
for long-distance clicks.

More critically: `gs.moveParty({x, y})` is called **before** the path walk begins
(line 278). The store is updated instantly, so any system reading `partyPos` during
animation sees the player already at the destination. This causes tile-event logic that
reads `partyPos` post-move to conflict with the still-animating marker.

Additionally, `_hexGrid` is deserialized from `worldMap.tiles`, but those tiles use the
same offset-coordinate system as the mesh map — `findPath()` works on `HexGrid.tiles`
(a Map keyed by `"x,y"`). If `WorldGenerator` produces tiles not registered in
`HexGrid.setTile()` the path search will fail silently.

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `src/engine/scenes/WorldMapScene.js` | 278 | `moveParty()` fires before animation; store and visual are immediately out of sync |
| `src/engine/scenes/WorldMapScene.js` | 295–307 | `findPath()` null falls back to straight-line lerp instead of rejecting the move |
| `src/game/world/HexGrid.js` | 99–150 | `findPath()` returns `null` silently for unreachable or unmapped tiles |

### What Is Missing
- `gs.moveParty()` should be called **inside `_onMarkerArrival()`** (after animation) so
  store and visual stay in sync.
- Null path should show a toast ("이동 불가") and abort rather than falling back to
  straight-line.

---

## Issue #6 — Turn End: AI Phase

**Verdict: BROKEN** (API mismatch — DragonAI method called does not exist)

### Root Cause
`WorldMapScene._runEnemyAIPhase()` (line 544–581) calls:

```js
const nextPos = this._dragonAI.move(gs.dragonPos, gs.worldMap);  // line 547
```

`DragonAI` has **no `move()` method**. Its only public method is `tick()` (DragonAI.js
line 31), which reads state directly from `useGameStore` internally and calls
`useGameStore.getState().setDragonPos(nextPos)` itself before returning
`{ moved, burnedVillage, gameOver }`.

Because `move()` is undefined, calling it returns `undefined`, which is falsy.
`_runEnemyAIPhase()` sees `!nextPos` and immediately calls `_finalizeWorldTurn()` —
**skipping all dragon movement, village burning, and game-over checks**. Turn cycling
still occurs (index advances), but the AI phase is entirely bypassed every time.

Secondary problem: `_finalizeWorldTurn()` calls `gs.advanceWorldTurn()` which cycles
`currentPlayerIndex` and increments `worldTurn` — but never calls `resetAP()` for the
incoming player (see Issue #1), so the next player starts with 0 AP.

### Affected Files
| File | Lines | Problem |
|------|-------|---------|
| `src/engine/scenes/WorldMapScene.js` | 547 | Calls `_dragonAI.move()` — method does not exist on DragonAI |
| `src/engine/scenes/WorldMapScene.js` | 548 | `!nextPos` guard silently swallows the error and skips AI |
| `src/engine/scenes/WorldMapScene.js` | 583–590 | `_finalizeWorldTurn()` never resets AP for the next player |
| `src/game/world/DragonAI.js` | 31 | Correct method is `tick()` (no args); updates store internally |
| `src/stores/gameStore.js` | 230–236 | `advanceWorldTurn()` does not reset AP |

### What Is Missing
- Replace `this._dragonAI.move(gs.dragonPos, gs.worldMap)` with
  `const result = this._dragonAI.tick()`.
- Read dragon outcome from `result.moved`, `result.burnedVillage`, `result.gameOver`.
- After `advanceWorldTurn()`, call `resetAP()` on the next player.

---

## Summary

| # | Issue | Verdict | Root Cause (one line) | Key File : Line |
|---|-------|---------|----------------------|-----------------|
| 1 | Turn ownership / AP display | BROKEN | `resetAP()` never called per turn; no AP readout in HUD | gameStore.js:230, WorldMapScene.js:583 |
| 2 | Camera turn transition | BROKEN | `onTurnStart()` reads undefined `tileX/Y`; cinematic path drops follow callback | WorldMapScene.js:395, 314 |
| 3 | Camera right-click orbit | **MISSING** | Right-click is pan, not orbit; no pivot/rotation code exists anywhere | CameraRig.js:253–279 |
| 4 | Input passthrough | BROKEN | `_onPointerClick` listens on `window` with no canvas/target guard | WorldMapScene.js:243 |
| 5 | Movement teleport | BROKEN | `moveParty()` fires before animation; null path falls back to straight lerp | WorldMapScene.js:278, 302 |
| 6 | Turn end / AI phase | BROKEN | `_dragonAI.move()` does not exist; `tick()` is correct API — AI phase silently skipped | WorldMapScene.js:547 |
