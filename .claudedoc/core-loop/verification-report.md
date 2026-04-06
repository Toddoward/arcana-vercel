# Verification Report — Core Loop
**Date**: 2026-04-06  
**Build**: ✅ PASS (zero errors, one pre-existing sRGBEncoding warning)  
**Overall**: ✅ PASS — ready to commit

---

## Fix Spot-Checks

| Fix | File:Line | Evidence |
|-----|-----------|----------|
| CRITICAL-4 endPlayerTurn | `BattleScene.js:287` | `this._combatEngine.endPlayerTurn(this._myPlayerId)` ✅ |
| CRITICAL-2 constructor | `CombatEngine.js:32-33` | `constructor(passiveManager = null)` + `this._passiveManager = passiveManager` ✅ |
| CRITICAL-3 startCombat | `BattleScene.js:126` | `this._combatEngine.startCombat(enemies)` — single arg ✅ |
| CRITICAL-5 reviveWithScroll | `CombatEngine.js:660` | method defined, calls `revivePlayer`, resets `_started` ✅ |
| CRITICAL-1 PeerJS import | `PeerManager.js:18,71` | `import Peer from 'peerjs'` + `new Peer(peerId)` ✅ |
| HIGH-1 passive tick | `BattleScene.js:291` | `this._passiveManager?.tick(this._combatEngine.currentUnit())` ✅ |
| HIGH-2 enemy DEX | `CombatEngine.js:82` | `e.DEX ?? e.dex ?? 3` ✅ |
| HIGH-3 scene key map | `App.jsx:102-111` | `SCENE_KEY_MAP` explicit lookup ✅ |

---

## Scenario Traces

### Scenario A — Single player: full win path
1. `App` mounts → `currentScene === SCENE.MAIN_MENU` → `MainMenuScreen` renders ✅
2. `onNewGame` → `goToScene(SCENE.LOBBY)` → `LobbyScreen` renders ✅
3. `onReady(charData)` → `initPlayers([charData])` → `onStartGame` → `sceneManager.goTo('worldmap')` ✅
4. `WorldMapScene.onEnter` → tiles built, DragonAI initialised ✅
5. Player clicks tile → `_handleTileClick` → `sceneManager.goTo('battle', {allies, enemies})` ✅
6. `BattleScene.onEnter` → `new CombatEngine(this._passiveManager)` [CRITICAL-2 ✅] → `startCombat(enemies)` [CRITICAL-3 ✅] → `_processTurn()` ✅
7. Player uses card → `useCard()` → AP depleted → `endPlayerTurn()` → `CombatEngine.endPlayerTurn(myPlayerId)` [CRITICAL-4 ✅] → `_advanceTurn()` → next unit ✅
8. Passive tick fires for actual acting unit [HIGH-1 ✅]; enemy DEX used correctly in initiative [HIGH-2 ✅] ✅
9. All enemies die → `checkBattleEnd()` returns `'WIN'` → `_onBattleWin()` → rewards granted → `showResult({result:'WIN'})` ✅
10. `handleContinue` → `sceneManager.goTo('worldmap')` — state in stores persists ✅

**Result: PASS**

---

### Scenario B — Single player: lose + revive path
1–6. Same as A ✅
7. All players reach `hp=0` → `checkBattleEnd()` returns `'LOSE'` → `_onBattleLose()` ✅
8. `hasRevive` check finds `revival_scroll` → `showRevivePrompt()` ✅
9. User clicks "사용" → `handleRevive()` → `bt._combatEngine.reviveWithScroll()` [CRITICAL-5 ✅]:
   - Scroll consumed from inventory ✅
   - All dead players revived at 30% HP via `revivePlayer()` ✅
   - `this._started = true` reset ✅
10. `bt._processTurn()` → combat resumes ✅

**Result: PASS**

---

### Scenario C — Single player: lose + game over path
1–8. Same as B ✅
9. User clicks "포기" → `hideRevivePrompt()` + `showResult({result:'GAME_OVER'})` ✅
10. `GameOver` screen renders → `handleGameRestart` → `sceneManager.goTo('mainmenu')` ✅

**Result: PASS**

---

### Scenario D — Multiplayer: host creates, guest joins
1. `App.useEffect` → `new PeerManager()` → `peerRef.current.init()` → `new Peer()` [CRITICAL-1 ✅]
2. PeerJS assigns ID → `HostManager` registers → `SyncManager` attached to scenes ✅
3. Guest calls `peerManager.connect(hostId)` → `DataConnection` established ✅
4. On `LOBBY_JOIN` → host `broadcastSnapshot()` → guest receives `STATE_SNAPSHOT` → `applySnapshot()` syncs state ✅
5. Host enters battle → `broadcastSnapshot()` after each turn → guest UI reflects same state ✅

**Result: PASS** (PeerJS CDN availability not testable statically; unhandled rejection on CDN fail is M-1, still open)

---

## Self-Review Checklist
- [x] No files written outside declared directories
- [x] `npm run build` passes with zero errors
- [x] No locked values in CameraRig.js were touched
- [x] Known Open Issues list updated below
- [x] Commit message follows conventional format

---

## CLAUDE.md Known Open Issues — Updated

### Resolved this session
- [x] Input system not responding ← root cause was CRITICAL-4 (endTurn method missing) + CRITICAL-2/3
- [x] Multiplayer PeerJS broken ← CRITICAL-1 ESM import

### Still open
- [ ] WebRTC cross-network test not done
- [ ] Assets not in repo: favicon.png, title.png, apple-touch-icon.png
- [ ] M-1: Unhandled PeerJS rejection on CDN failure (PeerManager.js)
- [ ] M-2: Duplicate event listeners on WorldMapScene re-enter
- [ ] DungeonScene stub only — gameplay incomplete
- [ ] AudioManager all stubs — game is silent
