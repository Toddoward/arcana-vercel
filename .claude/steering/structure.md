# Steering: Structure

## Canonical Directory Map
```
arcana-vercel/
├── CLAUDE.md                        ← project constitution (read every session)
├── .claude/
│   ├── agents/                      ← agent role definitions
│   ├── steering/                    ← this directory
│   └── commands/                    ← custom slash commands
├── .claudedoc/                      ← session outputs (diagnosis, notes, reports)
│   └── {feature-name}/
│       ├── diagnosis.md
│       ├── implementation-notes.md
│       └── verification-report.md
├── api/
│   └── signal.js                    ← Vercel Serverless WebRTC signal relay
├── public/
│   └── assets/
│       ├── icons/favicon.png        ← NOT in repo, add manually
│       └── images/title.png         ← NOT in repo, add manually
├── src/
│   ├── engine/
│   │   ├── CameraRig.js             ← ALL camera logic lives here only
│   │   ├── SceneManager.js          ← scene lifecycle and transitions
│   │   ├── AssetManager.js          ← Three.js mesh/material creation
│   │   └── scenes/
│   │       ├── WorldMapScene.js
│   │       ├── BattleScene.js
│   │       └── DungeonScene.js
│   ├── game/
│   │   ├── battle/                  ← battle logic (NOT combat/)
│   │   │   ├── CombatEngine.js
│   │   │   ├── EnemyAI.js
│   │   │   ├── CardEffects.js
│   │   │   └── InitiativeTracker.js
│   │   ├── deck/
│   │   │   ├── DeckBuilder.js
│   │   │   └── PassiveManager.js
│   │   ├── world/
│   │   │   ├── WorldGenerator.js
│   │   │   ├── HexGrid.js
│   │   │   └── DragonAI.js
│   │   └── data/
│   │       ├── cards.js
│   │       ├── items.js
│   │       ├── enemies.js
│   │       └── quests.js
│   ├── network/
│   │   ├── PeerManager.js
│   │   ├── HostManager.js
│   │   └── SyncManager.js
│   ├── stores/
│   │   ├── gameStore.js
│   │   ├── playerStore.js
│   │   └── uiStore.js
│   ├── ui/
│   │   ├── theme.js                 ← ALL design tokens (colors, fonts, radii)
│   │   ├── common/
│   │   ├── hud/
│   │   └── screens/
│   └── constants.js                 ← ALL magic numbers and string keys
├── index.html
├── package.json
└── vite.config.js
```

## Hard Rules

### Never create files in:
- Root of src/ (components go in ui/, logic goes in game/ or engine/)
- src/engine/scenes/ for non-scene files
- .claudedoc/ for anything other than session outputs

### Never move or rename:
- CameraRig.js (many imports depend on this path)
- theme.js (UI components import from this exact path)
- constants.js (referenced everywhere)

### Single responsibility per directory:
- src/engine/  → rendering and scene lifecycle only
- src/game/    → game rules and data only
- src/network/ → PeerJS communication only
- src/stores/  → Zustand state only
- src/ui/      → React components only

## File Naming Convention
- React components: PascalCase.jsx (e.g. CardHand.jsx)
- Engine/game modules: PascalCase.js (e.g. CombatEngine.js)
- Stores: camelCase + Store suffix (e.g. gameStore.js)
- Data files: camelCase plural (e.g. cards.js, enemies.js)

## Import Order Convention
```js
// 1. React
import { useState, useEffect } from 'react'
// 2. Third-party
import * as THREE from 'three'
// 3. Engine
import { CameraRig } from '../engine/CameraRig'
// 4. Stores
import { useGameStore } from '../stores/gameStore'
// 5. UI
import { CardHand } from '../ui/hud/CardHand'
// 6. Constants
import { SCENE_KEYS } from '../constants'
```
