# Steering: Tech

## Stack (locked — do not change without explicit approval)
- Runtime:   React 18 (functional components + hooks only)
- Renderer:  Three.js r128 (NOT r129+, API differences exist)
- State:     Zustand (no Redux, no Context for game state)
- Network:   PeerJS (WebRTC P2P — host is authoritative)
- Build:     Vite 5
- Deploy:    Vercel (Serverless for /api/signal.js)
- Language:  Vanilla JS with JSDoc (no TypeScript migration)

## Dependency Rules
- Do NOT add new npm packages without flagging in diagnosis.md first
- Do NOT upgrade Three.js version (r128 API assumed throughout)
- Do NOT add a state management library other than Zustand

## Known Technical Constraints
- Three.js canvas must be mounted BEFORE renderer initializes
- PeerJS requires HTTPS (Vercel provides this automatically)
- WebRTC may fail between peers on the same NAT (same WiFi)
- Vercel Serverless functions have 10s timeout limit
- PeerJS cloud signal server is used (self-hosted /api/signal.js as fallback)

## Allowed Patterns

### State mutation
```js
// CORRECT
useGameStore.getState().someAction(payload)

// WRONG — never mutate directly
gameStore.state.someValue = newValue
```

### Scene transition
```js
// CORRECT — always through SceneManager
sceneManager.transitionTo('battle', { enemies })

// WRONG — never import scenes directly into components
import BattleScene from './BattleScene'
```

### Camera
```js
// CORRECT — always delegate to CameraRig
cameraRig.moveToTarget(position, duration)

// WRONG — never set camera properties directly in scenes
camera.position.set(x, y, z)
```

### Render loop
```js
// CORRECT — geometries and materials created ONCE, reused
const geo = new THREE.BoxGeometry(1,1,1)  // outside loop

// WRONG — creates new objects every frame
renderer.render(() => {
  const geo = new THREE.BoxGeometry(1,1,1)  // memory leak
})
```

## Known Bugs (do not work around — fix properly)
- Input system unresponsive (root cause not yet diagnosed)
- UI not reacting to Zustand state changes (subscription issue suspected)
- Lobby join mode branching missing (App.jsx mode="join" not implemented)

## Build Command
```bash
npm run build
```
Must exit with code 0 before any commit. Zero tolerance for build failures.

## Git Workflow
- Branch: main (single branch — direct commits after verifier pass)
- Remote: GitHub → auto-triggers Vercel deploy
- Commit format: see CLAUDE.md
