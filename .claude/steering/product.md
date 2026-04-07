# Steering: Product

## Current Mission (until further notice)
Core loop is partially restored. Input errors fixed.
Next target: worldmap turn flow and movement logic.

Must pass before anything else:
  1. Player can only move tiles ≤ AP value per turn
  2. Movement follows hex shortest path with smooth interpolation
  3. Arriving on a tile triggers its event (battle/dungeon/town/event)
  4. React UI renders above Three.js canvas (z-index resolved)
  5. Turn start/end is explicit and visible to player

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

## Feature Priority Order (after core loop)
1. Battle flow completeness (card play → damage → turn end → enemy AI)
2. Worldmap interaction (tile click → move → event trigger)
3. Lobby join flow (mode="join" branching in App.jsx)
4. Dragon advance cutscene
5. Dungeon entry and node navigation
6. Town and shop system
7. Quest system
