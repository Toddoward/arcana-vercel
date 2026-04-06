# ARCANA — Core Loop Diagnostic Report
**Date**: 2026-04-06  
**Scope**: Full game health check (Title → Lobby → Character Select → WorldMap → Battle → return)  
**Status**: 🔴 NOT PLAYABLE

---

## Core Flow Status

| Step | Status | Blocker |
|------|--------|---------|
| 1. App mounts → Title screen | ✅ PASS | — |
| 2. Title → Lobby | ✅ PASS | — |
| 3. Lobby → Character select | ✅ PASS | — |
| 4. Character select → WorldMap | ✅ PASS | — |
| 5. WorldMap → battle zone click | ⚠️ PARTIAL | DragonAI untested |
| 6. BattleScene loads | ❌ FAIL | CombatEngine constructor mismatch (CRITICAL-2) |
| 7. Combat loop runs | ❌ FAIL | `endTurn()` method missing (CRITICAL-4) |
| 8. Battle ends → return to WorldMap | ❌ FAIL | Blocked by step 7 |
| 9. State persists across transitions | ⚠️ UNKNOWN | Untested under combat |
| 10. Multiplayer: guest joins | ❌ FAIL | PeerJS global reference error (CRITICAL-1) |

---

## CRITICAL Issues

### CRITICAL-1 — PeerJS Global Reference Error
**File**: `src/network/PeerManager.js:70`

```js
// BROKEN — `Peer` is always undefined in ESM/Vite builds
const PeerClass = (typeof Peer !== 'undefined') ? Peer : null;
```

**Fix**:
```js
import Peer from 'peerjs';   // add at top of file
const PeerClass = Peer;
```

**Impact**: All multiplayer (hosting, joining) fails immediately.

---

### CRITICAL-2 — CombatEngine Constructor Ignores PassiveManager
**File**: `src/engine/scenes/BattleScene.js:117` calls `new CombatEngine(this._passiveManager)`  
**File**: `src/game/battle/CombatEngine.js:31` — constructor accepts no parameters

PassiveManager passed is silently discarded; `_passiveManager` is never stored.

**Fix**: Update CombatEngine constructor:
```js
constructor(passiveManager = null) {
  this._passiveManager = passiveManager;
  // ...
}
```

---

### CRITICAL-3 — startCombat() Called with Wrong Signature
**File**: `src/engine/scenes/BattleScene.js:126-129`

```js
// BattleScene passes (players, enemies) — CombatEngine only accepts (enemies)
this._combatEngine.startCombat(usePlayerStore.getState().players, enemies);
```

`CombatEngine.startCombat(enemies)` reads players from store directly. The extra argument is ignored but signals a logic disconnect.

**Fix**: Remove the `players` argument from the BattleScene call.

---

### CRITICAL-4 — `endTurn()` Method Does Not Exist
**File**: `src/engine/scenes/BattleScene.js:288-297`

```js
this._combatEngine.endTurn();  // ← METHOD DOES NOT EXIST
```

CombatEngine defines `endPlayerTurn(playerId)`, not `endTurn()`.  
**Runtime error**: `this._combatEngine.endTurn is not a function`  
Players are permanently stuck after their first action.

**Fix**:
```js
this._combatEngine.endPlayerTurn(this._myPlayerId);
```

---

### CRITICAL-5 — `reviveWithScroll()` Not Implemented
**File**: `src/App.jsx:124`

```js
bt?._combatEngine?.reviveWithScroll?.();  // method does not exist anywhere
```

Revive scroll items are completely non-functional; KO'd players cannot be revived.

**Fix**: Implement `reviveWithScroll()` in `CombatEngine`.

---

## HIGH Issues

### HIGH-1 — PassiveManager.tick() Always Uses playerIds[0]
**File**: `src/engine/scenes/BattleScene.js:295`

```js
this._passiveManager?.tick(playerIds[0]); // TODO: 현재 행동자 기준
```

Passive effects only tick for the first player regardless of whose turn it is.  
**Fix**: Pass `this._combatEngine.currentUnit()` instead.

---

### HIGH-2 — Stat Key Case Mismatch (Player vs Enemy)
**File**: `src/game/battle/CombatEngine.js:76, 81`

Player stats use uppercase keys (`DEX`, `STR`…), enemy stats use lowercase (`dex`, `str`…).  
Enemy DEX always falls through to the default `3`, breaking initiative rolls.

**Fix**: Normalise all stat keys to uppercase on enemy data creation.

---

### HIGH-3 — Scene Transition Key Normalisation is Fragile
**File**: `src/App.jsx:102`

```js
const goTo = (key, payload) => sceneManager.goTo(key.toLowerCase().replace('_', ''), payload);
```

`WORLD_MAP` → `'worldmap'` (works), but `DUNGEON_FLOOR` → `'dungeonfloor'` may not match registered keys.  
**Fix**: Use a centralised constant map instead of dynamic string manipulation.

---

## MEDIUM Issues

| # | File | Issue |
|---|------|-------|
| M-1 | `src/network/PeerManager.js:67-97` | Unhandled promise rejection on PeerJS CDN failure — crashes app |
| M-2 | `src/engine/scenes/WorldMapScene.js:224-234` | `_registerEvents()` doesn't clear old listeners; re-entering scene stacks duplicate handlers |
| M-3 | `src/engine/scenes/DungeonScene.js` | Stub only — player can enter but gameplay is incomplete |
| M-4 | `src/engine/AudioManager.js:37-110` | All methods are TODO stubs; game is completely silent |

---

## LOW Issues

| # | File | Issue |
|---|------|-------|
| L-1 | `src/engine/SceneManager.js:54` | Clock always returns delta=0; animation timing non-functional |
| L-2 | `src/ui/hud/WorldHUD.jsx:69` | `gameStore.questProgress` integration is TODO |
| L-3 | Various | Tight coupling between Three.js scenes and Zustand stores (circular dep risk) |

---

## Missing Files

None — all imports resolve to existing files.

Assets listed in CLAUDE.md as missing: `favicon.png`, `title.png`, `apple-touch-icon.png`  
(These are static assets, not JS modules — won't cause build failure.)

---

## Network / Multiplayer Summary

| Component | Status |
|-----------|--------|
| PeerManager | ❌ BROKEN — ESM import missing |
| HostManager | ❌ BLOCKED by PeerManager |
| SyncManager | ❌ BLOCKED by PeerManager |
| `/api/signal.js` | ✅ OK |
| Heartbeat mechanism | ✅ OK (code structure sound) |

---

## Recommended Fix Order

1. **CRITICAL-4** — add `endPlayerTurn(playerId)` call in BattleScene (combat loop unblocked)
2. **CRITICAL-2** — fix CombatEngine constructor to store PassiveManager
3. **CRITICAL-3** — remove extra `players` arg from `startCombat()` call
4. **CRITICAL-5** — implement `CombatEngine.reviveWithScroll()`
5. **CRITICAL-1** — fix PeerJS ESM import (multiplayer unblocked)
6. **HIGH-1/2** — fix PassiveManager tick and stat key casing
7. **MEDIUM** — event listener cleanup, PeerJS error handling

Run `/implement` after reviewing this report.
