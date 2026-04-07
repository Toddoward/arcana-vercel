# Verification Report: worldmap-turn
**Date:** 2026-04-07
**Result: PASS — all 4 scenarios clear**

---

## Scenario A — Turn end → Dragon AI → Next player turn → AP reset → UI
| Check | Result |
|-------|--------|
| `endWorldTurn()` calls `_runEnemyAIPhase()` | PASS |
| `_dragonAI.tick()` used (not `.move()`) | PASS |
| `_finalizeWorldTurn()` calls `advanceWorldTurn()` | PASS |
| `resetAP(nextPlayer.id)` called after index advances | PASS |
| `onTurnStart()` fires toast with player name | PASS |
| Camera slerps to `gs.partyPos` (not undefined tileX/Y) | PASS |
| WorldHUD shows `currentPlayerName` + `⚡ N AP` | PASS |

## Scenario B — AP enforcement blocks movement
| Check | Result |
|-------|--------|
| `hexGrid.distance()` computes cost before any state change | PASS |
| Insufficient AP → `showToast('AP 부족…')` + early return | PASS |
| `findPath()` null → `showToast('이동할 수 없는 타일')` + early return | PASS |
| AP spent only after both validations clear | PASS |
| `moveParty()` deferred to `_onMarkerArrival()` | PASS |

## Scenario C — HUD button click does not reach tile raycaster
| Check | Result |
|-------|--------|
| Event listeners bound to `renderer.domElement`, not `window` | PASS |
| WorldHUD in `#ui-root` (sibling DOM branch from canvas) | PASS |
| Button click does not propagate through canvas element | PASS |

## Scenario D — Camera follow after turn transition and cinematic tiles
| Check | Result |
|-------|--------|
| `onTurnStart()` uses `gs.partyPos` | PASS |
| Cinematic slerp has `_startFollowParty` callback | PASS |
| All `_slerpToTile()` calls pass follow callback | PASS |

---

## Files Verified
- `src/engine/scenes/WorldMapScene.js`
- `src/ui/hud/WorldHUD.jsx`
- `src/stores/gameStore.js` (advanceWorldTurn)
- `src/stores/playerStore.js` (resetAP, spendAP)
- `src/game/world/DragonAI.js` (tick API)
- `src/game/world/HexGrid.js` (findPath, distance)
