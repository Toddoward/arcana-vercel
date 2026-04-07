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
import { HexGrid }        from '../../game/world/HexGrid.js';
import { DragonAI }       from '../../game/world/DragonAI.js';
import { getEnemyPool, getEnemyById } from '../../game/data/enemies.js';
import { getActiveMainQuest, QUEST_STATUS } from '../../game/data/quests.js';
import { CameraRig, CAM_MODE }        from '../CameraRig.js';

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
    this._dragonAI       = null;
    this._syncManager    = null;
    this.cameraRig       = new CameraRig();

    // 파티 마커 Lerp 이동 상태
    this._markerMoveFrom = new THREE.Vector3();
    this._markerMoveTo   = new THREE.Vector3();
    this._markerMoveT    = 1.0;   // 1.0 = 이동 완료 상태
    this._markerMoveCb   = null;
    this._markerMoveSpd  = 6.0;   // units/sec

    // HexGrid 인스턴스 (경로탐색 + AP 비용 계산용)
    this._hexGrid = null;
  }

  setSyncManager(sm) { this._syncManager = sm; }

  // ── 초기화 (1회) ─────────────────────────────────────────
  init() {
    // 아이소메트릭 Orthographic (viewH=28, 약간 기울어진 각도)
    const aspect = window.innerWidth / window.innerHeight;
    const viewH  = 28;
    this.camera = new THREE.OrthographicCamera(
      -viewH * aspect / 2,  viewH * aspect / 2,
       viewH / 2,           -viewH / 2,
      0.1, 300,
    );
    this.camera.position.set(0, 40, 28);
    this.camera.lookAt(0, 0, 0);

    // CameraRig 연결
    this.cameraRig.attachCamera(this.camera);
    this.cameraRig.setZoom(1.0);
    this.cameraRig.setMapBound(55);
    this.cameraRig.bindInput(window, 'worldmap');

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
      this._hexGrid  = HexGrid.deserialize(worldMap);
      this._dragonAI = new DragonAI(worldMap);
    } else if (gs.worldMap) {
      // 세이브 복귀
      this._buildTiles(gs.worldMap);
      this._hexGrid  = HexGrid.deserialize(gs.worldMap);
      this._dragonAI = new DragonAI(gs.worldMap);
    }

    this._updateMarkers();
    this._registerEvents();

    // 초기 카메라 — castlePos 또는 partyPos 상공으로 Slerp 진입 연출
    const gs2 = useGameStore.getState();
    const focusPos = gs2.partyPos ?? gs2.castlePos;
    if (focusPos) {
      const mesh = this._tileMeshMap.get(`${focusPos.x},${focusPos.y}`);
      if (mesh) {
        const target = new THREE.Vector3(mesh.position.x, 40, mesh.position.z + 28);
        const lookAt = new THREE.Vector3(mesh.position.x, 0, mesh.position.z);
        // 카메라를 맵 반대편에서 시작해서 Slerp
        this.camera.position.set(mesh.position.x, 80, mesh.position.z + 60);
        this.cameraRig.slerpTo(target, lookAt, 1.2, () => {
          // 도착 후 tracking 모드로 전환
          this.cameraRig.setMode(CAM_MODE.TRACKING);
          this._startFollowParty();
        });
      }
    }
  }

  onExit() {
    this._removeEvents();
    this.cameraRig.unbindInput();
    this.cameraRig.stopFollow();
  }

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
    this._removeEvents(); // 씬 재진입 시 기존 핸들러 정리 (중복 방지)
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
    const gs = useGameStore.getState();
    const ps = usePlayerStore.getState();
    const prevPos = gs.partyPos;

    // ── AP 검사 (Fix-3) ──────────────────────────────────────
    if (prevPos && this._hexGrid) {
      const apCost = this._hexGrid.distance(prevPos.x, prevPos.y, x, y);
      const localPlayer = ps.players.find((p) => p.id === gs.localPlayerId);
      if (localPlayer && localPlayer.currentAP < apCost) {
        useUiStore.getState().showToast?.(
          `AP 부족 (필요: ${apCost}, 현재: ${localPlayer.currentAP})`,
          'warn',
        );
        return;
      }
      if (localPlayer && apCost > 0) {
        ps.spendAP(localPlayer.id, apCost);
      }
    }

    gs.moveParty?.({ x, y });

    // ── 파티 마커 경로 이동 (Fix-4) + 도착 이벤트 (Fix-5) ───
    const onArrival = () => this._onMarkerArrival(x, y, type);

    if (prevPos && this._hexGrid) {
      const path = this._hexGrid.findPath(prevPos.x, prevPos.y, x, y);
      if (path && path.length > 0) {
        this._walkPath(prevPos, path, onArrival);
      } else {
        this._startMarkerMove(prevPos, { x, y }, onArrival);
      }
    } else {
      this._updateMarkers();
      onArrival();
    }

    // ── 카메라 ────────────────────────────────────────────────
    const isCinematic = type === TILE.ENEMY || type === TILE.DUNGEON ||
                        type === TILE.BOSS   || type === TILE.RANDOM_EVENT;
    if (isCinematic) {
      this.cameraRig.setMode(CAM_MODE.CINEMATIC);
      this._slerpToTile(x, y);
    } else {
      this._slerpToTile(x, y, () => this._startFollowParty());
    }
  }

  /**
   * 파티 마커를 경로 waypoint 배열을 따라 순차적으로 Lerp 이동
   * @param {{x,y}} fromPos 시작 타일 좌표
   * @param {Array<{x,y}>} path findPath() 반환 경로
   * @param {Function|null} onDone 경로 완료 콜백
   */
  _walkPath(fromPos, path, onDone = null) {
    const step = (currentPos, remaining) => {
      if (remaining.length === 0) { onDone?.(); return; }
      const [next, ...rest] = remaining;
      this._startMarkerMove(currentPos, next, () => step(next, rest));
    };
    step(fromPos, path);
  }

  /**
   * 파티 마커가 목적지 타일에 도착했을 때 실행
   * 모든 tile-event 트리거는 여기서만 발생 (Fix-5)
   */
  _onMarkerArrival(x, y, type) {
    const gs = useGameStore.getState();

    // ── C-2: 드래곤 타일 강제 전투 (GDD §19.5) ──────────────
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

  // ── 카메라 헬퍼 ──────────────────────────────────────────────

  /**
   * 파티 마커 Lerp 이동 시작 — from 타일 → to 타일 부드럽게 이동
   * 이동 완료 후 onDone 콜백 호출
   */
  _startMarkerMove(fromPos, toPos, onDone = null) {
    const fromMesh = this._tileMeshMap.get(`${fromPos.x},${fromPos.y}`);
    const toMesh   = this._tileMeshMap.get(`${toPos.x},${toPos.y}`);
    if (!fromMesh || !toMesh) { this._updateMarkers(); onDone?.(); return; }

    this._markerMoveFrom.set(fromMesh.position.x, 0.6, fromMesh.position.z);
    this._markerMoveTo.set(toMesh.position.x, 0.6, toMesh.position.z);
    this._markerMoveT   = 0;
    this._markerMoveCb  = onDone;
    this._partyMarker.visible = true;
    this._partyMarker.position.copy(this._markerMoveFrom);
  }

  /**
   * 턴 시작 — 현재 행동 플레이어 위치로 Slerp
   * advanceWorldTurn 후 App.jsx 또는 SyncManager에서 호출
   */
  onTurnStart() {
    const gs = useGameStore.getState();
    const ps = usePlayerStore.getState();
    const idx = gs.currentPlayerIndex ?? 0;
    const player = ps.players[idx];
    if (!player) return;

    // 턴 시작 토스트 알림
    useUiStore.getState().showToast?.(`${player.name ?? `Player ${idx + 1}`}의 턴`);

    const pos = { x: player.tileX ?? 0, y: player.tileY ?? 0 };
    const mesh = this._tileMeshMap.get(`${pos.x},${pos.y}`);
    if (!mesh) return;

    // 해당 플레이어 위치로 Slerp 후 tracking
    this.cameraRig.setMode(CAM_MODE.TRACKING);
    this._slerpToTile(pos.x, pos.y, () => this._startFollowParty());
  }

  /** 지정 타일 상공으로 Slerp */
  _slerpToTile(x, y, onDone = null) {
    const mesh = this._tileMeshMap.get(`${x},${y}`);
    if (!mesh) { onDone?.(); return; }
    const target = new THREE.Vector3(mesh.position.x, 40, mesh.position.z + 28);
    const lookAt = new THREE.Vector3(mesh.position.x, 0, mesh.position.z);
    this.cameraRig.slerpTo(target, lookAt, 2.0, onDone);
  }

  /** 파티 마커 follow 시작 */
  _startFollowParty() {
    if (!this._partyMarker.visible) return;
    this.cameraRig.setMode(CAM_MODE.TRACKING);
    // _partyMarker.position은 매 프레임 Lerp로 갱신되므로 직접 참조
    this.cameraRig.follow(
      this._partyMarker.position,
      new THREE.Vector3(0, 40, 28),
    );
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
  // DungeonScene.onEnter 내에서 그래프를 생성하고 gameStore.enterDungeon을 호출함
  // WorldMapScene은 originTile과 함께 씬 전환만 수행
  _enterDungeon(x, y) {
    // cinematic 카메라로 던전 방향 Slerp 후 씬 전환
    this.cameraRig.setMode(CAM_MODE.CINEMATIC);
    this._slerpToTile(x, y, () => {
      this.sceneManager.switchTo('dungeon', { originTile: { x, y } });
    });
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
    // 다음 턴 플레이어 위치로 카메라 Slerp
    this.onTurnStart();
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

    const dragonPos = new THREE.Vector3(targetMesh.position.x, 40, targetMesh.position.z + 28);
    const dragonLook = new THREE.Vector3(targetMesh.position.x, 0, targetMesh.position.z);

    // cinematic 모드로 드래곤 타일로 Slerp
    this.cameraRig.setMode(CAM_MODE.CINEMATIC);
    this.cameraRig.slerpTo(dragonPos, dragonLook, 1.2, () => {
      // 드래곤 마커 이동
      this._dragonMarker.position.set(targetMesh.position.x, 0.7, targetMesh.position.z);

      // CAM_HOLD_MS 대기 후 partyMarker로 복귀
      setTimeout(() => {
        const gs = useGameStore.getState();
        const partyMesh = gs.partyPos
          ? this._tileMeshMap.get(`${gs.partyPos.x},${gs.partyPos.y}`)
          : null;
        const backPos  = partyMesh
          ? new THREE.Vector3(partyMesh.position.x, 40, partyMesh.position.z + 28)
          : new THREE.Vector3(0, 40, 28);
        const backLook = partyMesh
          ? new THREE.Vector3(partyMesh.position.x, 0, partyMesh.position.z)
          : new THREE.Vector3(0, 0, 0);

        this.cameraRig.slerpTo(backPos, backLook, 1.0, () => {
          this._dragonCutscene = false;
          this.cameraRig.setMode(CAM_MODE.TRACKING);
          this._startFollowParty();
          onComplete();
        });
      }, CAM_HOLD_MS);
    });
  }

  // ================================================================
  // 매 프레임
  // ================================================================
  update(delta) {
    // ── 파티 마커 타일 단위 Lerp 이동 ──────────────────────
    if (this._markerMoveT < 1.0) {
      this._markerMoveT = Math.min(this._markerMoveT + delta * this._markerMoveSpd, 1.0);
      const t = _easeInOut(this._markerMoveT);
      this._partyMarker.position.lerpVectors(
        this._markerMoveFrom, this._markerMoveTo, t,
      );

      if (this._markerMoveT >= 1.0) {
        // 이동 완료
        this._partyMarker.position.copy(this._markerMoveTo);
        if (this._markerMoveCb) { this._markerMoveCb(); this._markerMoveCb = null; }
      }
    }

    // ── CameraRig 업데이트 ──────────────────────────────────
    this.cameraRig.update(delta);

    // ── 드래곤 마커 회전 ────────────────────────────────────
    if (this._dragonMarker.visible) {
      this._dragonMarker.rotation.y += delta * 1.5;
    }
  }

  dispose() {
    this._removeEvents();
    this.cameraRig.unbindInput();
    super.dispose();
  }
}
