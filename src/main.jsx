// ============================================================
// src/main.jsx
// 엔트리포인트 — Three.js SceneManager + React UI 동시 초기화
//
// 책임:
//   1. Three.js 렌더러 / SceneManager 초기화
//   2. 4개 씬 등록 (mainmenu, worldmap, battle, dungeon)
//   3. React DOM을 #ui-root 에 마운트
//   4. App.jsx 를 React 트리 루트로 설정
// ============================================================

import { createRoot }    from 'react-dom/client';
import React             from 'react';
import App               from './App.jsx';
import { SceneManager }  from './engine/SceneManager.js';
import { MainMenuScene } from './engine/scenes/MainMenuScene.js';
import { WorldMapScene } from './engine/scenes/WorldMapScene.js';
import { BattleScene }   from './engine/scenes/BattleScene.js';
import { DungeonScene }  from './engine/scenes/DungeonScene.js';

// ── 1. Three.js 캔버스 / 렌더러 초기화 ────────────────────
const canvas = document.getElementById('canvas-root');

const sm = new SceneManager()
  .init(canvas)
  .register('mainmenu', MainMenuScene)
  .register('worldmap', WorldMapScene)
  .register('battle',   BattleScene)
  .register('dungeon',  DungeonScene);

sm.start();

// 첫 씬 진입 (메인 메뉴)
sm.goTo('mainmenu');

// ── 2. React DOM 마운트 ────────────────────────────────────
const uiRoot = document.getElementById('ui-root');
createRoot(uiRoot).render(
  <React.StrictMode>
    <App sceneManager={sm} />
  </React.StrictMode>
);