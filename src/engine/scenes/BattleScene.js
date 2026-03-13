// ============================================================
// src/engine/scenes/BattleScene.js
// 전투 씬 — 실제 로직 연결 (파트10)
//
// GDD: §3.2(파티 등 뒤 3인칭, 매 턴 카메라 이동)
//      §8.3(이니셔티브 Bresenham) §10(카드 시스템)
//      §11(포지션 Front/Back) §13(전투 워크플로우)
//      §16(전투 종료 조건)
//
// 의존:
//   CombatEngine.js  — startCombat, processPlayerTurn, processEnemyTurn
//   DeckBuilder.js   — initForCombat, draw
//   PassiveManager.js— tick, onHit
//   gameStore.js     — inBattle, battleEnemies, addBattleLog
//   playerStore.js   — players, currentAP, hand, field
//   uiStore.js       — showTokenRoll, showResult
//   SyncManager.js   — broadcastSnapshot (턴 종료마다)
// ============================================================

import * as THREE from 'three';
import { BaseScene }       from '../SceneManager.js';
import { assetManager }    from '../AssetManager.js';
import { POSITION, COLOR } from '../../constants/constants.js';
import { useGameStore }    from '../../stores/gameStore.js';
import { usePlayerStore }  from '../../stores/playerStore.js';
import { useUiStore }      from '../../stores/uiStore.js';
import { CombatEngine }    from '../../game/battle/CombatEngine.js';
import { DeckBuilder }     from '../../game/deck/DeckBuilder.js';
import { PassiveManager }  from '../../game/deck/PassiveManager.js';

// 포지션별 Z 좌표
const POSITION_Z = {
  [POSITION.FRONT]: -1.5,
  [POSITION.BACK]:  -3.5,
};
const ALLY_X_SLOTS  = [-2.25, -0.75,  0.75, 2.25];
const ENEMY_X_SLOTS = [-2.25, -0.75,  0.75, 2.25];

export class BattleScene extends BaseScene {
  constructor(sm) {
    super(sm);
    this._allyMeshes    = {};
    this._enemyMeshes   = {};
    this._cameraTarget  = new THREE.Vector3(0, 1, -2);
    this._combatEngine  = null;
    this._syncManager   = null;
    this._passiveManager= null;
    this._isFinalBoss   = false;
    this._returnTo      = 'worldmap'; // 전투 후 복귀 씬
    this._myPlayerId    = null;
    this._raycaster     = new THREE.Raycaster();
    this._pointer       = new THREE.Vector2();
    this._clickHandler  = null;
  }

  setSyncManager(sm) { this._syncManager = sm; }

  // ── 초기화 (1회) ─────────────────────────────────────────
  init() {
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 3, 5);
    this.camera.lookAt(this._cameraTarget);

    this.scene.add(new THREE.AmbientLight(0x201828, 3.0));
    const dirLight = new THREE.DirectionalLight(0xfff0d0, 1.5);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    this.scene.add(dirLight);
    const rimLight = new THREE.PointLight(0x4020a0, 2.0, 20);
    rimLight.position.set(-5, 4, -5);
    this.scene.add(rimLight);

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x0e0c14, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Front/Back 구분선
    const divider = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x3a3050, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    divider.rotation.x = -Math.PI / 2;
    divider.position.set(0, 0.01, -2.5);
    this.scene.add(divider);

    this.scene.background = new THREE.Color(0x0a0810);
    this.scene.fog = new THREE.Fog(0x0a0810, 15, 30);
  }

  // ── 씬 진입 ──────────────────────────────────────────────
  onEnter(payload = {}) {
    const { allies = [], enemies = [], isFinalBoss = false, returnTo = 'worldmap' } = payload;
    this._isFinalBoss = isFinalBoss;
    this._returnTo    = returnTo;

    // 내 플레이어 ID (로컬)
    this._myPlayerId = useGameStore.getState().localPlayerId
      ?? usePlayerStore.getState().players[0]?.id;

    // 3D 메시 생성
    this._spawnAllies(allies);
    this._spawnEnemies(enemies);

    // 호스트만 CombatEngine 인스턴스화 + 시작
    if (useGameStore.getState().isHost) {
      this._passiveManager = new PassiveManager();
      this._combatEngine   = new CombatEngine(this._passiveManager);

      // 각 플레이어 덱 초기화 (GDD §10.5: 전투 시작 시 5장 드로우)
      const ps = usePlayerStore.getState();
      for (const player of ps.players) {
        const deckState = DeckBuilder.initForCombat(player.deck ?? []);
        ps.setDeckState(player.id, deckState);
      }

      this._combatEngine.startCombat(
        usePlayerStore.getState().players,
        enemies,
      );

      this._syncManager?.broadcastSnapshot();
    }

    // 적 클릭 이벤트 등록 (타겟 선택용)
    this._clickHandler = (e) => this._onEnemyClick(e);
    window.addEventListener('click', this._clickHandler);

    // 첫 턴 처리
    this._processTurn();
  }

  // ── 씬 퇴장 ──────────────────────────────────────────────
  onExit() {
    if (this._clickHandler) {
      window.removeEventListener('click', this._clickHandler);
      this._clickHandler = null;
    }
    Object.values(this._allyMeshes).forEach((m)  => this.scene.remove(m));
    Object.values(this._enemyMeshes).forEach((m) => this.scene.remove(m));
    this._allyMeshes   = {};
    this._enemyMeshes  = {};
    this._combatEngine = null;
  }

  // ================================================================
  // 턴 처리 루프 (GDD §13)
  // ================================================================
  _processTurn() {
    if (!this._combatEngine) return;
    const engine = this._combatEngine;
    const unit   = engine.currentUnit();
    if (!unit) return;

    if (unit.isPlayer) {
      // GDD §13: 플레이어 턴 — 자동 드로우 1장 + HandUI 활성화
      if (useGameStore.getState().isHost) {
        const ps = usePlayerStore.getState();
        const player = ps.players.find((p) => p.id === unit.id);
        if (player) {
          const newState = DeckBuilder.draw(player, 1);
          ps.setDeckState(player.id, newState);
        }
      }
      // 내 턴이면 HandUI 활성화 (uiStore 플래그)
      const isMyTurn = unit.id === this._myPlayerId;
      useUiStore.getState().setMyTurn?.(isMyTurn, unit.id);

      // 카메라 행동자 등 뒤로 (GDD §3.2)
      this.moveCameraToPlayer(unit.id);
    } else {
      // GDD §13: 적 턴 — 자동 처리
      useUiStore.getState().setMyTurn?.(false, null);
      if (useGameStore.getState().isHost) {
        // 짧은 딜레이 후 적 액션 처리 (연출 느낌)
        setTimeout(() => {
          const result = engine.processEnemyTurn();
          useGameStore.getState().addBattleLog?.(result?.log ?? '적이 행동했습니다.');
          this._applyEnemyResult(result);
          this._checkBattleEnd();
        }, 600);
      }
    }
  }

  // ================================================================
  // 플레이어 카드 사용 (HandUI onUseCard 콜백)
  // ================================================================
  useCard(instanceId, targetId) {
    if (!this._combatEngine) return;
    const engine = this._combatEngine;
    const unit   = engine.currentUnit();
    if (!unit?.isPlayer || unit.id !== this._myPlayerId) return;

    const result = engine.useCard(unit.id, instanceId, targetId);
    if (!result?.ok) return;

    useGameStore.getState().addBattleLog?.(result.log ?? '카드를 사용했습니다.');
    this._syncManager?.broadcastSnapshot();

    // AP 소모 후 잔여 AP가 없으면 자동 턴 종료
    const player = usePlayerStore.getState().players.find((p) => p.id === unit.id);
    if ((player?.currentAP ?? 0) <= 0) {
      this.endPlayerTurn();
    }
  }

  // ================================================================
  // 플레이어 패시브 등록 (HandUI onRegisterPassive 콜백)
  // ================================================================
  registerPassive(instanceId) {
    if (!this._combatEngine) return;
    const unit = this._combatEngine.currentUnit();
    if (!unit?.isPlayer) return;
    const ps = usePlayerStore.getState();
    DeckBuilder.registerPassive(ps.players.find((p) => p.id === unit.id), instanceId);
    ps.moveToField?.(unit.id, instanceId);
    this._syncManager?.broadcastSnapshot();
  }

  // ================================================================
  // 플레이어 턴 종료
  // ================================================================
  endPlayerTurn() {
    if (!this._combatEngine) return;
    this._combatEngine.endTurn();

    // 패시브 tick (GDD §10.6)
    if (useGameStore.getState().isHost) {
      const playerIds = usePlayerStore.getState().players.map((p) => p.id);
      this._passiveManager?.tick(playerIds[0]); // TODO: 현재 행동자 기준
      this._syncManager?.broadcastSnapshot();
    }

    this._checkBattleEnd();
    if (!this._battleEnded) this._processTurn();
  }

  // ================================================================
  // 전투 종료 판정 (GDD §16)
  // ================================================================
  _checkBattleEnd() {
    if (!this._combatEngine) return;
    const result = this._combatEngine.checkBattleEnd();
    if (!result) return;

    this._battleEnded = true;
    useUiStore.getState().setMyTurn?.(false, null);

    if (result === 'WIN') {
      this._onBattleWin();
    } else {
      this._onBattleLose();
    }
  }

  _onBattleWin() {
    const gs = useGameStore.getState();
    const enemies = gs.battleEnemies ?? [];
    const totalExp  = enemies.reduce((s, e) => s + (e.expReward  ?? 0), 0);
    const totalGold = enemies.reduce((s, e) => s + (e.goldReward ?? 0), 0);

    // 보상 지급 (GDD §6.6)
    if (gs.isHost) {
      const ps = usePlayerStore.getState();
      for (const p of ps.players) {
        ps.addExp?.(p.id, totalExp);
        ps.addGold?.(p.id, Math.floor(totalGold / ps.players.length));
      }
      // 덱 리셋 (GDD §10.7)
      for (const p of ps.players) {
        const resetDeck = DeckBuilder.resetAfterCombat(p.equipment ?? {});
        ps.setDeckState?.(p.id, resetDeck);
      }
      gs.exitBattle?.();
      this._syncManager?.broadcastSnapshot();
    }

    const resultPayload = this._isFinalBoss
      ? { result: 'GAME_CLEAR' }
      : { result: 'WIN', rewards: { exp: totalExp, gold: totalGold, items: [] } };
    useUiStore.getState().showResult?.(resultPayload);

    // ResultScreen 닫힘(onContinue) 후 복귀 씬으로 전환
    // App.jsx의 onContinue 핸들러에서 sceneManager.switchTo(returnTo) 호출
    useGameStore.getState()._pendingReturnTo = this._returnTo;
  }

  _onBattleLose() {
    // GDD §16.2: 전멸 시 게임오버 or 부활 스크롤 확인
    const hasRevive = usePlayerStore.getState().players.some((p) =>
      p.inventory?.some((i) => i.id === 'revival_scroll')
    );
    if (hasRevive) {
      useUiStore.getState().showRevivePrompt?.();
    } else {
      useUiStore.getState().showResult?.({ result: 'GAME_OVER', reason: '파티가 전멸했습니다.' });
    }
  }

  _applyEnemyResult(result) {
    if (!result?.targets) return;
    // 맞은 플레이어 HP 갱신은 CombatEngine이 playerStore 직접 수정
    // 메시 흔들림 연출
    for (const { playerId } of result.targets ?? []) {
      const mesh = this._allyMeshes[playerId];
      if (mesh) this._shakeMesh(mesh);
    }
  }

  // ================================================================
  // 적 클릭 (타겟 선택용)
  // ================================================================
  _onEnemyClick(e) {
    this._updatePointer(e);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects(Object.values(this._enemyMeshes), true);
    if (!hits.length) return;
    const { enemyId } = hits[0].object.userData;
    // uiStore로 타겟 선택 전달 (HandUI의 포인트&클릭 흐름에서 handleTargetClick 호출)
    useUiStore.getState().setPendingTarget?.(enemyId);
  }

  _updatePointer(e) {
    this._pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    this._pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  // ================================================================
  // 3D 메시 관리
  // ================================================================
  _spawnAllies(allies) {
    Object.values(this._allyMeshes).forEach((m) => this.scene.remove(m));
    this._allyMeshes = {};
    allies.forEach((player, i) => {
      const group = assetManager.createCharacterMesh(COLOR[player.className] ?? 0xc9a84c);
      const posZ  = POSITION_Z[player.position] ?? POSITION_Z[POSITION.FRONT];
      group.position.set(ALLY_X_SLOTS[i] ?? 0, 0, posZ);
      group.userData = { playerId: player.id };
      this.scene.add(group);
      this._allyMeshes[player.id] = group;
    });
  }

  _spawnEnemies(enemies) {
    Object.values(this._enemyMeshes).forEach((m) => this.scene.remove(m));
    this._enemyMeshes = {};
    enemies.forEach((enemy, i) => {
      const mesh = assetManager.createMonsterMesh(enemy.type ?? 'DEFAULT');
      const posZ = enemy.position === POSITION.BACK ? -10 : -8;
      mesh.position.set(ENEMY_X_SLOTS[i] ?? 0, 0.5, posZ);
      mesh.rotation.y = Math.PI;
      mesh.userData   = { enemyId: enemy.id };
      // 자식 메시에도 enemyId 전파 (raycaster용)
      mesh.traverse((c) => { if (c.isMesh) c.userData.enemyId = enemy.id; });
      this.scene.add(mesh);
      this._enemyMeshes[enemy.id] = mesh;
    });
  }

  // ================================================================
  // 퍼블릭 메서드 (씬 외부에서 호출 가능)
  // ================================================================

  /** 현재 행동 캐릭터 등 뒤로 카메라 이동 (GDD §3.2) */
  moveCameraToPlayer(playerId) {
    const mesh = this._allyMeshes[playerId];
    if (mesh) this._cameraTarget.set(mesh.position.x, 1.2, mesh.position.z);
  }

  /** 포지션 전환 시 메시 위치 갱신 */
  updateAllyPosition(playerId, newPosition) {
    const mesh = this._allyMeshes[playerId];
    if (mesh) mesh.position.z = POSITION_Z[newPosition] ?? POSITION_Z[POSITION.FRONT];
  }

  /** 적 제거 (사망 처리) */
  removeEnemy(enemyId) {
    const mesh = this._enemyMeshes[enemyId];
    if (mesh) { this.scene.remove(mesh); delete this._enemyMeshes[enemyId]; }
  }

  // ================================================================
  // 보조 연출
  // ================================================================
  _shakeMesh(mesh, intensity = 0.12, duration = 200) {
    const orig = mesh.position.x;
    const start = Date.now();
    const shake = () => {
      const elapsed = Date.now() - start;
      if (elapsed > duration) { mesh.position.x = orig; return; }
      mesh.position.x = orig + (Math.random() - 0.5) * intensity;
      requestAnimationFrame(shake);
    };
    shake();
  }

  // ================================================================
  // 매 프레임
  // ================================================================
  update(delta) {
    // 카메라 부드러운 추적 (GDD §3.2)
    this.camera.position.lerp(
      new THREE.Vector3(this._cameraTarget.x, this._cameraTarget.y + 3, this._cameraTarget.z + 5),
      delta * 3,
    );
    this.camera.lookAt(this._cameraTarget);

    // 마법형 적 부유 애니메이션
    const t = Date.now() * 0.002;
    Object.values(this._enemyMeshes).forEach((mesh) => {
      if (mesh.userData.type === 'MAGIC') mesh.position.y = 0.5 + Math.sin(t) * 0.15;
    });
  }

  dispose() { this.onExit(); super.dispose(); }
}