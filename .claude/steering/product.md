# Steering: Product

## Current Mission
Battle flow completeness — a player must be able to:
  1. Enter a battle from a worldmap ENEMY tile
  2. See their card hand and play a card
  3. Deal damage; see enemy HP update
  4. End their turn; enemy AI takes its turn
  5. Win or lose the battle and return to worldmap with updated state

## Resolved Scopes
| Scope | Closed | Commit | Notes |
|-------|--------|--------|-------|
| worldmap-flow | 2026-04-07 | e2b6cdb | Tile events, AP movement, hex LERP, UI z-index |
| worldmap-turn | 2026-04-07 | 715522e | Turn flow, AP reset, dragon AI, input passthrough, camera |

## What "Playable" Means
A player can:
1. Open the browser
2. Enter a name and start a game
3. See and navigate the worldmap
4. Enter and complete one battle
5. Return to worldmap with updated state

All 5 must work before any new content is added.

## Product Goals (post-recovery)
- Every game state must have visible UI feedback
- Player must always know: what they can do, whose turn it is, what happened
- No silent failures — errors surface as UI messages, not console logs
- Game loop must be completable solo (multiplayer is additive, not required)

## UX Constraints
- Every scene transition needs a camera movement (not instant cut)
- Every player action needs immediate visual response (< 100ms feedback)
- Card hand must be visible and interactive during player turn
- Dragon advance must be shown, not just computed silently

## Do Not Add Until Core Loop Works
- New card types
- New enemy types
- New dungeon content
- Inventory or shop UI
- Quest system UI
- Any multiplayer feature beyond existing PeerJS setup

## Feature Queue
| Priority | Scope | Status |
|----------|-------|--------|
| 1 | battle-flow (card play → damage → turn end → enemy AI) | IN PROGRESS |
| 2 | lobby-join (mode="join" branching in App.jsx) | QUEUED |
| 3 | dungeon-entry (node navigation, room events) | QUEUED |
| 4 | town-shop (village entry, shop UI) | QUEUED |
| 5 | quest-system (quest panel, progress tracking) | QUEUED |
| 6 | camera-orbit (right-click orbit around look-at point) | QUEUED |
| 7 | webrtc-crossnetwork (cross-network P2P test) | QUEUED |
