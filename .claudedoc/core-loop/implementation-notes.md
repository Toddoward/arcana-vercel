# Implementation Notes — CRITICAL-2 & CRITICAL-4
**Date**: 2026-04-06  
**Status**: ✅ Both fixes applied, build passes

---

## CRITICAL-4 (previous session)

**File**: `src/engine/scenes/BattleScene.js:290`

```diff
- this._combatEngine.endTurn();
+ this._combatEngine.endPlayerTurn(this._myPlayerId);
```

---

## CRITICAL-2 — CombatEngine constructor ignores PassiveManager

**File**: `src/game/battle/CombatEngine.js:32`

```diff
- constructor() {
-   this._initiative = null;
+ constructor(passiveManager = null) {
+   this._passiveManager = passiveManager;
+   this._initiative = null;
```

**Why**: `BattleScene.js:117` passes `this._passiveManager` to `new CombatEngine(...)`, but the
old constructor accepted no arguments — the PassiveManager was silently discarded and
`this._passiveManager` was never set. The passive tick call in `BattleScene.endPlayerTurn()`
(`this._passiveManager?.tick(...)`) bypassed CombatEngine entirely anyway, so this fix aligns
ownership: CombatEngine now holds the reference for future internal use.

## Build result

`vite build` — ✅ zero errors (same pre-existing `sRGBEncoding` warning unrelated to these fixes)

---

## CRITICAL-3 — startCombat() extra argument removed

**File**: `src/engine/scenes/BattleScene.js:126`

```diff
- this._combatEngine.startCombat(
-   usePlayerStore.getState().players,
-   enemies,
- );
+ this._combatEngine.startCombat(enemies);
```

`CombatEngine.startCombat(enemies)` reads players directly from `playerStore` internally (line 49-51).
The extra `players` argument was ignored but signalled a logic disconnect.

---

## Remaining CRITICAL issues (see diagnosis.md)

- CRITICAL-1: PeerJS ESM import missing in PeerManager.js (multiplayer)

## CRITICAL-5 — reviveWithScroll() implemented

**File**: `src/game/battle/CombatEngine.js` — new method added before `checkBattleEnd()`

**Behaviour**:
1. Finds the first player holding a `revival_scroll` (checks both `inventoryItems` and legacy `inventory` arrays)
2. Removes one scroll — uses `removeInventoryItem` for `inventoryItems`, or `usePlayerStore.setState` splice for the legacy `inventory` path
3. Revives all dead players via `playerStore.revivePlayer(id)` (30% HP)
4. Resets `this._started = true` in case `_endCombat('LOSE')` had already cleared it
5. Pushes a battle log entry

**Note**: `p.inventory` vs `p.inventoryItems` inconsistency is pre-existing. Both paths handled.

## CRITICAL-1 — PeerJS ESM import fixed

**File**: `src/network/PeerManager.js`

```diff
+ import Peer from 'peerjs';
  ...
- const PeerClass = (typeof Peer !== 'undefined') ? Peer : null;
- if (!PeerClass) { reject(new Error(...)); return; }
- this._peer = peerId ? new PeerClass(peerId) : new PeerClass();
+ this._peer = peerId ? new Peer(peerId) : new Peer();
```

Removed the CDN global check entirely. PeerJS is an npm dependency (`"peerjs": "^1.5.4"`) —
it must be imported as an ESM module in Vite builds, not read from `window.Peer`.

**Bundle delta**: ~919 KB → ~1,008 KB (PeerJS is now actually bundled — previously it was dead code).

---

## HIGH-1 — PassiveManager tick uses currentUnit()

**File**: `src/engine/scenes/BattleScene.js:294`

```diff
- const playerIds = usePlayerStore.getState().players.map((p) => p.id);
- this._passiveManager?.tick(playerIds[0]); // TODO: 현재 행동자 기준
+ this._passiveManager?.tick(this._combatEngine.currentUnit());
```

Passive effects now tick for the actual acting unit, not always the first player.

---

## HIGH-2 — Enemy DEX key normalised

**File**: `src/game/battle/CombatEngine.js` (initiative unit map for enemies)

```diff
- dex: e.dex ?? 3,
+ dex: e.DEX ?? e.dex ?? 3,  // 대/소문자 모두 허용
```

Mirrors the player-side handling (`p.stats?.DEX ?? p.stats?.dex ?? 5`). Enemy initiative
rolls now correctly use the enemy's actual DEX value instead of always defaulting to 3.

---

## HIGH-3 — Scene key normalisation made explicit

**File**: `src/App.jsx:102`

```diff
- const goTo = (key, payload) => sceneManager.goTo(key.toLowerCase().replace('_', ''), payload);
+ const SCENE_KEY_MAP = {
+   [SCENE.MAIN_MENU]: 'mainmenu',
+   [SCENE.WORLD_MAP]: 'worldmap',
+   [SCENE.BATTLE]:    'battle',
+   [SCENE.DUNGEON]:   'dungeon',
+ };
+ const goTo = (key, payload) => {
+   const sceneKey = SCENE_KEY_MAP[key];
+   if (!sceneKey) return;
+   sceneManager.goTo(sceneKey, payload);
+ };
```

`replace('_', '')` only removed the **first** underscore. Any future SCENE constant with
two underscores (e.g. `DUNGEON_FLOOR`) would have silently routed to the wrong key.
The explicit map also acts as self-documentation of which SCENE constants have Three.js scenes.

Note: `goTo` is currently defined but not called in App.jsx (all call sites use
`sceneManager.goTo(literal)` directly). The map is still the correct form for future use.

---

## All CRITICALs and HIGH-1/2/3 resolved. Remaining items from diagnosis.md:

- HIGH-3 (fragile scene key normalisation) — low actual risk for current scenes
- M-1 (PeerJS unhandled rejection on CDN failure)
- M-2 (WorldMapScene duplicate event listeners on re-enter)

## Next step

Run `/verify` to validate the full core loop.
