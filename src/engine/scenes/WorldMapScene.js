// ============================================================
// src/engine/scenes/WorldMapScene.js
// 월드맵 씬 — 실제 로직 연결 (파트10)
//
// GDD: §3.1(탑뷰 고정) §3.3(드래곤 카메라 연출)
//      §18(월드맵 시스템 전체) §19(드래곤 이동 메커니즘)
//      §18.6(랜덤 이벤트 풀) §21(마을 시스템)
// ============================================================

import * as THREE from 'three';
import { BaseScene }      from '../SceneManager.js';
import { assetManager }   from '../AssetManager.js';
import { WORLD, TILE, COLOR } from '../../constants/constants.js';
import { useGameStore }   from '../../stores/gameStore.js';
import { usePlayerStore } from '../../stores/playerStore.js';
import { useUiStore }     from '../../stores/uiStore.js';
import { WorldGenerator } from '../../game/world/WorldGenerator.js';
import { DragonAI }       from '../../game/world/DragonAI.js';
import { getEnemyPool, getEnemyById } from '../../game/data/enemies.js';
import { getActiveMainQuest, QUEST_STATUS } from '../../game/data/quests.js';

// 드래곤 카메라 연출 타이밍 (ms)
const CAM_TO_DRAGON_MS = 1200;
const CAM_HOLD_MS      = 800;
const CAM_BACK_MS      = 1000;

// 랜덤 이벤트 풀 (GDD §18.6)
const RANDOM_EVENTS = [
  { id: 'merchant',    label: '상인 조우',        stat: 'luk', type: 'ITEM_BONUS' },
  { id: 'chest',       label: '저주받은 보물상자', stat: 'str', type: 'TRAP_OR_ITEM' },
  { id: 'traveler',    label: '길 잃은 여행자',    stat: 'wis', type: 'ITEM_OR_INFO' },
  { id: 'campfire',    label: '야영지',            stat: 'con', type: 'HEAL' },
  { id: 'inscription', label: '고대 비문',          stat: 'int', type: 'TEMP_BUFF' },
  { id: 'bandits',     label: '도적단 조우',        stat: 'dex', type: 'BATTLE_OR_AMBUSH' },
];

export class WorldMapScene extends BaseScene {
  constructor(sm) {
    super(sm);
    this._tileGroup     = null;
    this._unitGroup     = null;
    this._dragonMarker  = null;
    this._partyMarker   = null;
    this._tileMeshMap   = new Map(); // `${x},${y}` -> mesh
    this._raycaster     = new THREE.Raycaster();
    this._pointer       = new THREE.Vector2();
    this._clickHandler  = null;
    this._hoverHandler  = null;
    this._dragonCutscene = false;
    this._camLerpTarget  = null;
    this._camOrigPos     = null;
    this._dragonAI       = null;
    this._syncManager    = null;
  }

  setSyncManager(sm) { this._syncManager = sm; }

  // ── 초기화 (1회) ─────────────────────────────────────────
  init() {
    const aspect = window.innerWidth / window.innerHeight;
    const viewH  = 20;
    this.camera = new THREE.OrthographicCamera(
      -viewH * aspect / 2,  viewH * aspect / 2,
       viewH / 2,           -viewH / 2,
      0.1, 200,
    );
    this.camera.position.set(0, 30, 0);
    this.camera.lookAt(0, 0, 0);
    this._camOrigPos = this.camera.position.clone();

    this.scene.add(new THREE.AmbientLight(0x404060, 2.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(10, 20, 10);
    this.scene.add(dir);
    this.scene.background = new THREE.Color(0x07070a);

    this._tileGroup = new THREE.Group();
    this._unitGroup = new THREE.Group();
    this.scene.add(this._tileGroup);
    this.scene.add(this._unitGroup);

    // 드래곤 마커 (빨간 구)
    this._dragonMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe03020, emissive: 0x801008 }),
    );
    this._dragonMarker.visible = false;
    this._unitGroup.add(this._dragonMarker);

    // 파티 마커 (파란 구)
    this._partyMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x4080e0, emissive: 0x102040 }),
    );
    this._partyMarker.visible = false;
    this._unitGroup.add(this._partyMarker);
  }

  // ── 씬 진입 ──────────────────────────────────────────────
  onEnter(payload = {}) {
    const gs = useGameStore.getState();

    if (payload.newGame) {
      // 신규 게임 — 월드 생성 (GDD §18.1)
      const gen    = new WorldGenerator();
      const { grid, castlePos, dragonSpawn } = gen.generate();
      // HexGrid → 직렬화된 plain object (tiles: Array)
      const worldMap = { ...grid.serialize(), castlePos, dragonSpawn };
      const players  = usePlayerStore.getState().players;
      gs.startGame(players.length, worldMap, castlePos, dragonSpawn);
      this._buildTiles(worldMap);
      this._dragonAI = new DragonAI(worldMap);
    } else if (gs.worldMap) {
      // 세이브 복귀
      this._buildTiles(gs.worldMap);
      this._dragonAI = new DragonAI(gs.worldMap);
    }

    this._updateMarkers();
    this._registerEvents();
  }

  onExit() { this._removeEvents(); }

  // ── 공개 API: 호스트 턴 종료 ─────────────────────────────
  endWorldTurn() {
    if (!useGameStore.getState().isHost) return;
    this._runEnemyAIPhase();
  }

  // ================================================================
  // 타일 렌더링
  // ================================================================
  _buildTiles(worldMap) {
    this._tileGroup.clear();
    this._tileMeshMap.clear();

    const R     = 1.0;
    const HEX_W = R * Math.sqrt(3);
    const HEX_H = R * 2;

    worldMap.tiles.forEach((tile) => {
      const { x: q, y: r, type } = tile;
      const wx = HEX_W * (q + r * 0.5) - (WORLD.COLS * HEX_W) / 2;
      const wz = HEX_H * 0.75 * r      - (WORLD.ROWS * HEX_H * 0.75) / 2;

      const color = this._tileColor(type);
      const mesh  = assetManager.createTileMesh(R * 0.96, color);
      mesh.position.set(wx, 0, wz);
      mesh.userData = { tileX: q, tileY: r, type };
      this._tileGroup.add(mesh);
      this._tileMeshMap.set(`${q},${r}`, mesh);
    });
  }

  _tileColor(type) {
    const MAP = {
      [TILE.EMPTY]:          0x384050,
      [TILE.VILLAGE]:        0x60a060,
      [TILE.VILLAGE_BURNED]: 0x804020,
      [TILE.DUNGEON]:        0x5040a0,
      [TILE.ENEMY]:          0xa03030,
      [TILE.QUEST]:          0xc0a020,
      [TILE.RANDOM_EVENT]:   0x408080,
      [TILE.CASTLE]:         0x8090c0,
      [TILE.BOSS]:           0xd02020,
    };
    return MAP[type] ?? 0x384050;
  }

  // ================================================================
  // 마커 위치 갱신
  // ================================================================
  _updateMarkers() {
    const gs = useGameStore.getState();
    if (gs.dragonPos) {
      const m = this._tileMeshMap.get(`${gs.dragonPos.x},${gs.dragonPos.y}`);
      if (m) { this._dragonMarker.position.set(m.position.x, 0.7, m.position.z); this._dragonMarker.visible = true; }
    }
    if (gs.partyPos) {
      const m = this._tileMeshMap.get(`${gs.partyPos.x},${gs.partyPos.y}`);
      if (m) { this._partyMarker.position.set(m.position.x, 0.6, m.position.z); this._partyMarker.visible = true; }
    }
  }

  // ================================================================
  // 포인터 이벤트
  // ================================================================
  _registerEvents() {
    this._clickHandler = (e) => this._onPointerClick(e);
    this._hoverHandler = (e) => this._onPointerMove(e);
    window.addEventListener('click',     this._clickHandler);
    window.addEventListener('mousemove', this._hoverHandler);
  }

  _removeEvents() {
    if (this._clickHandler) { window.removeEventListener('click',     this._clickHandler); this._clickHandler = null; }
    if (this._hoverHandler) { window.removeEventListener('mousemove', this._hoverHandler); this._hoverHandler = null; }
  }

  _onPointerClick(e) {
    if (this._dragonCutscene) return;
    this._updatePointer(e);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects(this._tileGroup.children, false);
    if (!hits.length) return;
    const { tileX, tileY, type } = hits[0].object.userData;
    this._handleTileClick(tileX, tileY, type);
  }

  _onPointerMove(e) {
    this._updatePointer(e);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects(this._tileGroup.children, false);
    if (hits.length) {
      const { tileX, tileY, type } = hits[0].object.userData;
      useUiStore.getState().setHoveredTile?.({ x: tileX, y: tileY, type });
    }
  }

  _updatePointer(e) {
    this._pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    this._pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  // ================================================================
  // 타일 타입별 분기 (GDD §18.2)
  // ================================================================
  _handleTileClick(x, y, type) {
    useGameStore.getState().moveParty?.({ x, y });
    this._updateMarkers();

    // ── C-2: 드래곤 타일 강제 전투 체크 (GDD §19.5) ──────────
    const gs = useGameStore.getState();
    if (gs.dragonPos && gs.dragonPos.x === x && gs.dragonPos.y === y) {
      this._enterDragonBattle();
      return;
    }

    // ── C-1: 전투/던전/이벤트 타일 → 파티 강제 합류 (GDD §18.5)
    if (type === TILE.ENEMY || type === TILE.DUNGEON || type === TILE.RANDOM_EVENT) {
      this._forcePartyJoin(x, y);
    }

    switch (type) {
      case TILE.ENEMY:          return this._enterBattle(x, y);
      case TILE.DUNGEON:        return this._enterDungeon(x, y);
      case TILE.VILLAGE:        return this._enterVillage(x, y);
      case TILE.VILLAGE_BURNED: return useUiStore.getState().showToast?.('🔥 이 마을은 드래곤에 의해 불타버렸습니다.');
      case TILE.RANDOM_EVENT:   return this._triggerRandomEvent(x, y);
      case TILE.QUEST:          return this._handleQuestTile(x, y);
      case TILE.BOSS:           return this._enterBossBattle(x, y);
      case TILE.CASTLE:         return useUiStore.getState().openCastle?.();
      default: break;
    }
  }

  // ── C-1: 파티 강제 합류 (GDD §18.5) ─────────────────────────
  // 트리거 플레이어 DEX 기준 floor(DEX/3) 반경 내 플레이어 강제 이동
  _forcePartyJoin(destX, destY) {
    const ps      = usePlayerStore.getState();
    const gs      = useGameStore.getState();
    const trigger = ps.players.find((p) => p.id === gs.localPlayerId);
    if (!trigger) return;

    const range = Math.floor((trigger.stats?.DEX ?? 5) / 3);
    ps.players.forEach((p) => {
      if (p.id === trigger.id) return;
      const dx = Math.abs((p.tileX ?? 12) - destX);
      const dy = Math.abs((p.tileY ?? 12) - destY);
      if (dx <= range && dy <= range) {
        ps.movePlayer(p.id, destX, destY);
      }
    });
    gs.moveParty?.({ x: destX, y: destY });
    this._syncManager?.broadcastSnapshot();
    this._updateMarkers();
  }

  // ── C-2: 드래곤 타일 강제 전투 (GDD §19.5) ──────────────────
  _enterDragonBattle() {
    const gs    = useGameStore.getState();
    const stage = this._getQuestStage(gs.questProgress ?? {});
    const SCALE = { 0: 3.0, 1: 2.5, 2: 1.75, 3: 1.2, 4: 1.0 };
    const mul   = SCALE[stage] ?? 3.0;
    const base  = getEnemyById?.('red_dragon');
    if (!base) return;
    const scaled = {
      ...base,
      hp:  Math.round(base.hp  * mul),
      atk: Math.round(base.atk * mul),
    };
    gs.enterBattle([scaled]);
    this.sceneManager.switchTo('battle', {
      allies: usePlayerStore.getState().players,
      enemies: [scaled],
      isBoss: true,
      returnTo: 'worldmap',
    });
  }

  // ── 일반 전투 진입 (GDD §18.2)
  _enterBattle(x, y) {
    const tier    = this._getBiomeTier(x, y);
    const pool    = getEnemyPool(tier);
    const count   = 2 + Math.floor(Math.random() * 3);
    const enemies = Array.from({ length: Math.min(count, pool.length) }, () =>
      pool[Math.floor(Math.random() * pool.length)]
    );
    useGameStore.getState().enterBattle(enemies);
    this.sceneManager.switchTo('battle', { allies: usePlayerStore.getState().players, enemies });
  }

  // ── 보스 전투 진입 (GDD §19.5)
  _enterBossBattle(x, y) {
    const gs     = useGameStore.getState();
    const stage  = this._getQuestStage(gs.questProgress ?? {});
    const SCALE  = { 0: 3.0, 1: 2.5, 2: 1.75, 3: 1.2, 4: 1.0 };
    const mul    = SCALE[stage] ?? 3.0;
    const dragon = getEnemyById('red_dragon');
    const scaled = { ...dragon, hp: Math.round(dragon.hp * mul), atk: Math.round(dragon.atk * mul) };
    gs.enterBattle([scaled]);
    this.sceneManager.switchTo('battle', { allies: usePlayerStore.getState().players, enemies: [scaled], isFinalBoss: true });
  }

  // ── 던전 진입 (GDD §20)
  _enterDungeon(x, y) {
    useGameStore.getState().enterDungeon(null);
    this.sceneManager.switchTo('dungeon', { originTile: { x, y } });
  }

  // ── 마을 진입 (GDD §21)
  _enterVillage(x, y) { useUiStore.getState().openVillage?.({ x, y }); }

  // ── 랜덤 이벤트 (GDD §18.6)
  _triggerRandomEvent(x, y) {
    const event   = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    const leader  = usePlayerStore.getState().players[0];
    const statVal = leader?.stats?.[event.stat] ?? 5;
    const success = Math.random() < 0.40 + (statVal - 5) * 0.04;
    useUiStore.getState().showRandomEvent?.({ event, success, x, y });
  }

  // ── 퀘스트 타일
  _handleQuestTile(x, y) {
    const active = getActiveMainQuest(useGameStore.getState().questProgress ?? {});
    if (active) useUiStore.getState().showQuestInteraction?.({ quest: active, x, y });
  }

  // ── 바이옴 티어 계산 (거리 기반)
  _getBiomeTier(x, y) {
    const gs = useGameStore.getState();
    if (!gs.castlePos || !gs.dragonPos) return 'early';
    const cd = Math.abs(x - gs.castlePos.x) + Math.abs(y - gs.castlePos.y);
    const dd = Math.abs(x - gs.dragonPos.x) + Math.abs(y - gs.dragonPos.y);
    if (cd < (cd + dd) * 0.35) return 'early';
    if (cd < (cd + dd) * 0.65) return 'mid';
    return 'late';
  }

  _getQuestStage(qp) {
    for (let s = 4; s >= 0; s--) { if (qp[`main_${s}`] === QUEST_STATUS.COMPLETED) return s; }
    return 0;
  }

  // ================================================================
  // 적 AI 페이즈 — 드래곤 이동 (GDD §8.1, §19.2)
  // ================================================================
  _runEnemyAIPhase() {
    if (!this._dragonAI) { this._finalizeWorldTurn(); return; }
    const gs      = useGameStore.getState();
    const nextPos = this._dragonAI.move(gs.dragonPos, gs.worldMap);
    if (!nextPos)  { this._finalizeWorldTurn(); return; }

    // GDD §3.3 카메라 연출
    this._playDragonCutscene(nextPos, () => {
      const tile = gs.worldMap?.tiles?.find((t) => t.x === nextPos.x && t.y === nextPos.y);
      if (tile?.type === TILE.VILLAGE) {
        gs.burnVillage?.(nextPos);
        this._rebuildTile(nextPos.x, nextPos.y, TILE.VILLAGE_BURNED);
        useUiStore.getState().showToast?.('🔥 드래곤이 마을을 불태웠습니다!');

        // ── C-3: 해당 타일 플레이어 → 인접 빈 타일로 강제 이동 (GDD §19.3)
        const ps = usePlayerStore.getState();
        ps.players.forEach((p) => {
          if (p.tileX === nextPos.x && p.tileY === nextPos.y) {
            const adjacent = gs.worldMap?.tiles?.find((t) =>
              t.type === TILE.EMPTY &&
              Math.abs(t.x - nextPos.x) + Math.abs(t.y - nextPos.y) === 1
            );
            if (adjacent) {
              ps.movePlayer(p.id, adjacent.x, adjacent.y);
              useUiStore.getState().showToast?.(`${p.name} 인근으로 대피했습니다.`);
            }
          }
        });
      }
      if (tile?.type === TILE.CASTLE) {
        useUiStore.getState().showGameOver?.('레드 드래곤이 왕국 성에 도달했습니다.');
        return;
      }
      gs.moveDragon(nextPos);
      this._updateMarkers();
      this._finalizeWorldTurn();
    });
  }

  _finalizeWorldTurn() {
    const gs = useGameStore.getState();
    gs.advanceWorldTurn?.();
    this._autoSave();
    this._syncManager?.broadcastSnapshot();
  }

  _autoSave() {
    try {
      const snap = { game: useGameStore.getState().getSnapshot(), players: usePlayerStore.getState().getSnapshot(), date: new Date().toLocaleString() };
      const saves = JSON.parse(localStorage.getItem('arcana_saves') ?? '[]');
      saves[0] = snap;
      localStorage.setItem('arcana_saves', JSON.stringify(saves));
    } catch { /* 무시 */ }
  }

  _rebuildTile(x, y, newType) {
    const mesh = this._tileMeshMap.get(`${x},${y}`);
    if (mesh) { mesh.material.color.set(this._tileColor(newType)); mesh.userData.type = newType; }
  }

  // ================================================================
  // 드래곤 카메라 연출 (GDD §3.3, §19.6)
  // ================================================================
  _playDragonCutscene(nextPos, onComplete) {
    this._dragonCutscene = true;
    const targetMesh = this._tileMeshMap.get(`${nextPos.x},${nextPos.y}`);
    if (!targetMesh) { this._dragonCutscene = false; onComplete(); return; }

    const targetPos = new THREE.Vector3(targetMesh.position.x, 30, targetMesh.position.z);
    this._camLerpTarget = targetPos;

    setTimeout(() => {
      this._dragonMarker.position.set(targetMesh.position.x, 0.7, targetMesh.position.z);
      setTimeout(() => {
        this._camLerpTarget = this._camOrigPos.clone();
        setTimeout(() => {
          this._dragonCutscene = false;
          this._camLerpTarget  = null;
          onComplete();
        }, CAM_BACK_MS);
      }, CAM_HOLD_MS);
    }, CAM_TO_DRAGON_MS);
  }

  // ================================================================
  // 매 프레임
  // ================================================================
  update(delta) {
    if (this._camLerpTarget) {
      this.camera.position.lerp(this._camLerpTarget, Math.min(delta * 4, 1));
    }
    if (this._dragonMarker.visible) {
      this._dragonMarker.rotation.y += delta * 1.5;
    }
  }

  dispose() { this._removeEvents(); super.dispose(); }
}