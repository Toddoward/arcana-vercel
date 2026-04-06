// ============================================================
// src/engine/scenes/DungeonScene.js
// 던전 씬 — Perspective 3인칭 + CameraRig + Proximity Culling
//
// GDD §20.1~20.5 (던전 구조, 노드 타입, 진행 흐름, 코어 클리어)
//
// 카메라 설계:
//   - PerspectiveCamera (BattleScene 동일 구도)
//   - 노드 정지 상태: 3인칭 뒤에서 바라보는 구도
//   - 노드→엣지 이동: 체이스 카메라 (Lerp follow)
//   - 엣지→노드 도착: Slerp 안착
//   - 전투 진입: cinematic Slerp (BattleScene과 매끄럽게 연결)
//
// Proximity Culling:
//   현재 노드 + 인접 1홉만 visible=true, 나머지 false
// ============================================================
import * as THREE from 'three';
import { BaseScene }      from '../SceneManager.js';
import { assetManager }   from '../AssetManager.js';
import { CameraRig, CAM_MODE } from '../CameraRig.js';
import { DUNGEON }        from '../../constants/constants.js';
import { useGameStore }   from '../../stores/gameStore.js';
import { usePlayerStore } from '../../stores/playerStore.js';
import { useUiStore }     from '../../stores/uiStore.js';
import { TokenRoll }      from '../../game/battle/TokenRoll.js';
import { getEnemyPool }   from '../../game/data/enemies.js';

// ── 노드 타입별 색상 / 재질 ──────────────────────────────────
const NODE_COLOR = {
  BATTLE:   0x802020,
  TREASURE: 0xc9a84c,
  EVENT:    0x4080c0,
  TRAP:     0xa04080,
  SHOP:     0x40a040,
  EMPTY:    0x303040,
  BOSS:     0xff2020,
  CORE:     0x40c0c0,
};

// 노드 배치 간격
const NODE_SPACING_X = 4.0;
const NODE_SPACING_Z = 5.0;

// 카메라 오프셋 (노드 위치 기준)
const CAM_OFFSET  = new THREE.Vector3(0, 3.5, 5.5);
const CAM_LOOK_UP = new THREE.Vector3(0, 0.5, 0); // 노드 기준 look 오프셋

export class DungeonScene extends BaseScene {
  constructor(sm) {
    super(sm);
    this._nodeGroup  = null;
    this._edgeGroup  = null;
    this._nodeMeshMap = new Map();  // nodeId → mesh
    this._edgeMeshMap = new Map();  // `${from}-${to}` → mesh
    this._graph      = null;        // 현재 던전 그래프
    this.cameraRig   = new CameraRig();

    // 파티 마커 Lerp 이동 상태
    this._partyMarker    = null;
    this._markerMoveFrom = new THREE.Vector3();
    this._markerMoveTo   = new THREE.Vector3();
    this._markerMoveT    = 1.0;
    this._markerMoveCb   = null;
    this._markerMoveSpd  = 4.0;

    this._raycaster  = new THREE.Raycaster();
    this._pointer    = new THREE.Vector2();
    this._clickCb    = null;
  }

  // ── 초기화 (1회) ─────────────────────────────────────────
  init() {
    // BattleScene과 동일한 Perspective 구도
    this.camera = new THREE.PerspectiveCamera(
      55, window.innerWidth / window.innerHeight, 0.1, 100,
    );
    this.camera.position.set(0, 3.5, 5.5);
    this.camera.lookAt(0, 0.5, 0);

    this.cameraRig.attachCamera(this.camera);
    this.cameraRig.setMode(CAM_MODE.CINEMATIC);

    this.scene.background = new THREE.Color(0x080610);
    this.scene.fog = new THREE.Fog(0x080610, 12, 28);

    this.scene.add(new THREE.AmbientLight(0x303050, 3.0));
    const dirLight = new THREE.DirectionalLight(0xfff0d0, 1.2);
    dirLight.position.set(3, 8, 4);
    dirLight.castShadow = true;
    this.scene.add(dirLight);
    const rimLight = new THREE.PointLight(0x4020a0, 1.5, 16);
    rimLight.position.set(-4, 3, -4);
    this.scene.add(rimLight);

    // 바닥 (BattleScene과 동일)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x0a0818, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this._nodeGroup = new THREE.Group();
    this._edgeGroup = new THREE.Group();
    this.scene.add(this._nodeGroup);
    this.scene.add(this._edgeGroup);

    // 파티 마커
    this._partyMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x4080e0, emissive: 0x102040 }),
    );
    this._partyMarker.visible = false;
    this.scene.add(this._partyMarker);
  }

  // ── 씬 진입 ──────────────────────────────────────────────
  onEnter(payload = {}) {
    // 그래프 생성 또는 저장된 그래프 복원
    const gs = useGameStore.getState();
    let graph = payload.dungeonGraph ?? gs.dungeonGraph;

    if (!graph) {
      graph = this._generateGraph();
      useGameStore.getState().enterDungeon(graph);
    }

    this._graph = { ...graph };
    this._buildScene(this._graph);
    this._updateProximity(this._graph.currentNodeId);
    this._placePartyMarker(this._graph.currentNodeId);

    // 진입 연출: 시작 노드 앞으로 Slerp
    this._slerpToNode(this._graph.currentNodeId, () => {
      this.cameraRig.setMode(CAM_MODE.TRACKING);
      this._startFollowMarker();
      this._registerNodeClick();
    });
  }

  // ── 씬 퇴장 ──────────────────────────────────────────────
  onExit() {
    this._removeNodeClick();
    this.cameraRig.unbindInput();
    this.cameraRig.stopFollow();
    this._nodeGroup?.clear();
    this._edgeGroup?.clear();
    this._nodeMeshMap.clear();
    this._edgeMeshMap.clear();
    if (this._partyMarker) this._partyMarker.visible = false;
  }

  // ================================================================
  // 던전 그래프 생성 (GDD §20.1)
  // ================================================================
  _generateGraph() {
    const nodeCount = DUNGEON.NODE_MIN +
      Math.floor(Math.random() * (DUNGEON.NODE_MAX - DUNGEON.NODE_MIN + 1));
    const depth = DUNGEON.DEPTH_MIN +
      Math.floor(Math.random() * (DUNGEON.DEPTH_MAX - DUNGEON.DEPTH_MIN + 1));

    const nodes = [];
    const edges = [];
    let idCounter = 0;

    // 시작 노드
    nodes.push({ id: `n0`, type: 'EMPTY', x: 0, z: 0, depth: 0 });

    // 계층별 노드 배치 (트리 구조)
    for (let d = 1; d <= depth; d++) {
      const count = Math.max(1, Math.floor(nodeCount / depth) +
        (d === Math.ceil(depth / 2) ? nodeCount % depth : 0));

      const prevLayer = nodes.filter((n) => n.depth === d - 1);
      for (let i = 0; i < count; i++) {
        idCounter++;
        const x = (i - (count - 1) / 2) * NODE_SPACING_X;
        const z = -(d * NODE_SPACING_Z);
        const type = d === depth ? 'CORE' : this._randomNodeType();
        nodes.push({ id: `n${idCounter}`, type, x, z, depth: d });

        // 이전 레이어에서 가장 가까운 노드에 엣지 연결
        const closest = prevLayer.reduce((a, b) =>
          Math.abs(a.x - x) < Math.abs(b.x - x) ? a : b
        );
        edges.push({ from: closest.id, to: `n${idCounter}` });
      }
    }

    // 같은 depth 인접 노드끼리 추가 연결 (분기 형성)
    for (let d = 1; d <= depth; d++) {
      const layer = nodes.filter((n) => n.depth === d);
      for (let i = 0; i < layer.length - 1; i++) {
        if (Math.random() < 0.3) {
          edges.push({ from: layer[i].id, to: layer[i + 1].id });
        }
      }
    }

    return { nodes, edges, currentNodeId: 'n0' };
  }

  _randomNodeType() {
    const r = Math.random();
    const ratios = DUNGEON.NODE_RATIO;
    let acc = 0;
    for (const [type, w] of Object.entries(ratios)) {
      acc += w;
      if (r < acc) return type;
    }
    return 'EMPTY';
  }

  // ================================================================
  // 씬 빌드 — 노드·엣지 3D 메시 생성
  // ================================================================
  _buildScene(graph) {
    this._nodeGroup.clear();
    this._edgeGroup.clear();
    this._nodeMeshMap.clear();
    this._edgeMeshMap.clear();

    // 노드 메시
    graph.nodes.forEach((node) => {
      const color = NODE_COLOR[node.type] ?? NODE_COLOR.EMPTY;

      // 노드 본체 (박스)
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.3, 1.2),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
      );
      body.position.set(node.x, 0, node.z);
      body.castShadow = true;
      body.userData = { nodeId: node.id, type: node.type };

      // 현재 노드 링 표시
      if (node.id === graph.currentNodeId) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.75, 0.06, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0xc9a84c }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(node.x, 0.16, node.z);
        ring.userData = { isRing: true };
        this._nodeGroup.add(ring);
      }

      this._nodeGroup.add(body);
      this._nodeMeshMap.set(node.id, body);
    });

    // 엣지 메시 (연결선)
    graph.edges.forEach((edge) => {
      const from = graph.nodes.find((n) => n.id === edge.from);
      const to   = graph.nodes.find((n) => n.id === edge.to);
      if (!from || !to) return;

      const fromV  = new THREE.Vector3(from.x, 0.05, from.z);
      const toV    = new THREE.Vector3(to.x,   0.05, to.z);
      const length = fromV.distanceTo(toV);
      const mid    = new THREE.Vector3().addVectors(fromV, toV).multiplyScalar(0.5);

      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.06, length),
        new THREE.MeshBasicMaterial({ color: 0x3a3050 }),
      );
      line.position.copy(mid);
      line.lookAt(toV);
      this._edgeGroup.add(line);
      this._edgeMeshMap.set(`${edge.from}-${edge.to}`, line);
    });
  }

  // ================================================================
  // Proximity Culling — 현재 노드 + 인접 1홉만 visible
  // ================================================================
  _updateProximity(currentNodeId) {
    if (!this._graph) return;

    // 인접 노드 ID 수집
    const visible = new Set([currentNodeId]);
    this._graph.edges.forEach((e) => {
      if (e.from === currentNodeId) visible.add(e.to);
      if (e.to   === currentNodeId) visible.add(e.from);
    });

    // 노드 visible 토글
    this._nodeMeshMap.forEach((mesh, nodeId) => {
      mesh.visible = visible.has(nodeId);
    });

    // 링 메시도 토글
    this._nodeGroup.children.forEach((child) => {
      if (child.userData?.isRing) child.visible = visible.has(currentNodeId);
    });

    // 엣지 visible — 양쪽 끝 노드가 모두 visible이어야 표시
    this._edgeMeshMap.forEach((mesh, key) => {
      const [from, to] = key.split('-');
      mesh.visible = visible.has(from) && visible.has(to);
    });
  }

  // ================================================================
  // 파티 마커 배치 / 이동
  // ================================================================
  _placePartyMarker(nodeId) {
    const mesh = this._nodeMeshMap.get(nodeId);
    if (!mesh || !this._partyMarker) return;
    this._partyMarker.position.set(mesh.position.x, 0.8, mesh.position.z);
    this._partyMarker.visible = true;
  }

  _startMarkerMove(fromNodeId, toNodeId, onDone = null) {
    const fromMesh = this._nodeMeshMap.get(fromNodeId);
    const toMesh   = this._nodeMeshMap.get(toNodeId);
    if (!fromMesh || !toMesh) { this._placePartyMarker(toNodeId); onDone?.(); return; }

    this._markerMoveFrom.set(fromMesh.position.x, 0.8, fromMesh.position.z);
    this._markerMoveTo.set(toMesh.position.x,   0.8, toMesh.position.z);
    this._markerMoveT  = 0;
    this._markerMoveCb = onDone;
    this._partyMarker.visible = true;
    this._partyMarker.position.copy(this._markerMoveFrom);
  }

  _startFollowMarker() {
    if (!this._partyMarker?.visible) return;
    this.cameraRig.setMode(CAM_MODE.TRACKING);
    this.cameraRig.follow(
      this._partyMarker.position,
      CAM_OFFSET,
    );
  }

  // ================================================================
  // 카메라 헬퍼
  // ================================================================
  _slerpToNode(nodeId, onDone = null) {
    const mesh = this._nodeMeshMap.get(nodeId);
    if (!mesh) { onDone?.(); return; }
    const dest = new THREE.Vector3(
      mesh.position.x + CAM_OFFSET.x,
      CAM_OFFSET.y,
      mesh.position.z + CAM_OFFSET.z,
    );
    const look = new THREE.Vector3(
      mesh.position.x + CAM_LOOK_UP.x,
      CAM_LOOK_UP.y,
      mesh.position.z + CAM_LOOK_UP.z,
    );
    this.cameraRig.setMode(CAM_MODE.CINEMATIC);
    this.cameraRig.slerpTo(dest, look, 1.8, onDone);
  }

  // ================================================================
  // 노드 클릭 처리
  // ================================================================
  _registerNodeClick() {
    this._clickCb = (e) => {
      this._pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
      this._pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const hits = this._raycaster.intersectObjects(this._nodeGroup.children, false);
      if (!hits.length) return;
      const { nodeId } = hits[0].object.userData;
      if (nodeId) this._enterNode(nodeId);
    };
    window.addEventListener('click', this._clickCb);
  }

  _removeNodeClick() {
    if (this._clickCb) {
      window.removeEventListener('click', this._clickCb);
      this._clickCb = null;
    }
  }

  // ================================================================
  // 노드 진입 분기 (GDD §20.2)
  // ================================================================
  _enterNode(nodeId) {
    if (!this._graph) return;
    const node = this._graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // 인접 노드만 이동 가능
    const reachable = this._graph.edges
      .filter((e) => e.from === this._graph.currentNodeId || e.to === this._graph.currentNodeId)
      .map((e) => e.from === this._graph.currentNodeId ? e.to : e.from);
    if (!reachable.includes(nodeId)) return;

    const prevId = this._graph.currentNodeId;
    this._graph = { ...this._graph, currentNodeId: nodeId };
    useGameStore.getState().moveDungeonNode(nodeId);

    // Proximity Culling 갱신
    this._updateProximity(nodeId);

    // 파티 마커 체이스 이동 → 목표 노드 Slerp 안착
    this._startMarkerMove(prevId, nodeId, () => {
      this._slerpToNode(nodeId, () => {
        this.cameraRig.setMode(CAM_MODE.TRACKING);
        this._startFollowMarker();

        // 이동 완료 후 노드 이벤트 처리
        switch (node.type) {
          case 'BATTLE':   return this._handleBattleNode(node);
          case 'TREASURE': return this._handleTreasureNode(node);
          case 'TRAP':     return this._handleTrapNode(node);
          case 'SHOP':     return useUiStore.getState().openInventory();
          case 'BOSS':     return this._handleBossNode(node);
          case 'CORE':     return this._handleCoreNode(node);
          case 'EVENT':    return this._handleEventNode(node);
          default: break;
        }
      });
    });

    // 링 갱신 (현재 노드 표시)
    this._refreshCurrentRing(nodeId);
  }

  _refreshCurrentRing(currentNodeId) {
    // 기존 링 제거
    const toRemove = this._nodeGroup.children.filter((c) => c.userData?.isRing);
    toRemove.forEach((r) => this._nodeGroup.remove(r));

    // 새 링 추가
    const mesh = this._nodeMeshMap.get(currentNodeId);
    if (!mesh) return;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.06, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xc9a84c }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(mesh.position.x, 0.16, mesh.position.z);
    ring.userData = { isRing: true };
    this._nodeGroup.add(ring);
  }

  // ================================================================
  // 노드 타입별 이벤트 핸들러 (GDD §20.2)
  // ================================================================
  _handleBattleNode(node) {
    // cinematic Slerp 후 battle 씬 전환 (BattleScene과 매끄럽게)
    const enemies = this._spawnEnemies(node.tier ?? 'mid', 2 + Math.floor(Math.random() * 2));
    this.cameraRig.setMode(CAM_MODE.CINEMATIC);

    // 전투 진입 방향으로 카메라 전진
    const curMesh = this._nodeMeshMap.get(this._graph.currentNodeId);
    if (curMesh) {
      const fwdPos  = new THREE.Vector3(curMesh.position.x, 2.5, curMesh.position.z - 3);
      const fwdLook = new THREE.Vector3(curMesh.position.x, 0.5, curMesh.position.z - 8);
      this.cameraRig.slerpTo(fwdPos, fwdLook, 2.0, () => {
        useGameStore.getState().enterBattle(enemies);
        this.sceneManager.switchTo('battle', {
          allies: usePlayerStore.getState().players,
          enemies,
          returnTo: 'dungeon',
        });
      });
    } else {
      useGameStore.getState().enterBattle(enemies);
      this.sceneManager.switchTo('battle', {
        allies: usePlayerStore.getState().players,
        enemies,
        returnTo: 'dungeon',
      });
    }
  }

  _handleBossNode(node) {
    const pool    = getEnemyPool('late');
    const boss    = pool[Math.floor(Math.random() * pool.length)];
    const scaled  = { ...boss, hp: Math.round(boss.hp * 1.8) };
    this._handleBattleNode({ ...node, _enemies: [scaled] });
  }

  _handleTreasureNode(node) {
    const gold = 30 + Math.floor(Math.random() * 50);
    const exp  = 20 + Math.floor(Math.random() * 30);
    const ps   = usePlayerStore.getState();
    for (const p of ps.players) {
      ps.addExp?.(p.id, exp);
      ps.addGold?.(p.id, gold);
    }
    useUiStore.getState().showToast?.(`💰 보물 획득! +${gold}G / +${exp}EXP`);
  }

  _handleTrapNode(node) {
    const leader  = usePlayerStore.getState().players[0];
    const dex     = leader?.stats?.DEX ?? leader?.stats?.dex ?? 5;
    const result  = TokenRoll.roll({ stat: dex });
    if (result.successes > 0) {
      useUiStore.getState().showToast?.('🪤 함정을 간파했습니다!');
    } else {
      const dmg = 15 + Math.floor(Math.random() * 20);
      useUiStore.getState().showToast?.(`🪤 함정 발동! 파티 ${dmg} 데미지`);
      this.cameraRig.shake(0.2, 400);
      const ps = usePlayerStore.getState();
      for (const p of ps.players) ps.takeDamage(p.id, dmg);
    }
  }

  _handleCoreNode(node) {
    const leader  = usePlayerStore.getState().players[0];
    const luk     = leader?.stats?.LUK ?? leader?.stats?.luk ?? 5;
    const result  = TokenRoll.roll({ stat: luk });

    if (result.successes > 0) {
      const ps = usePlayerStore.getState();
      for (const p of ps.players) ps.addExp?.(p.id, 200);
      useUiStore.getState().showToast?.('✨ 던전 코어 클리어! +200 EXP');

      // 코어 클리어 zoom-out 연출 후 월드맵 복귀
      this.cameraRig.setMode(CAM_MODE.CINEMATIC);
      const coreMesh = this._nodeMeshMap.get(this._graph.currentNodeId);
      if (coreMesh) {
        const zoomOutPos  = new THREE.Vector3(coreMesh.position.x, 14, coreMesh.position.z + 18);
        const zoomOutLook = new THREE.Vector3(coreMesh.position.x, 0, coreMesh.position.z);
        this.cameraRig.slerpTo(zoomOutPos, zoomOutLook, 0.8, () => {
          setTimeout(() => {
            useGameStore.getState().exitDungeon?.();
            this.sceneManager.switchTo('worldmap');
          }, 1000);
        });
      } else {
        setTimeout(() => {
          useGameStore.getState().exitDungeon?.();
          this.sceneManager.switchTo('worldmap');
        }, 1500);
      }
    } else {
      const ps = usePlayerStore.getState();
      for (const p of ps.players) {
        const penalty = Math.round(p.maxHp * 0.10);
        ps.takeDamage(p.id, penalty);
      }
      useUiStore.getState().showToast?.('💀 코어 공략 실패! 최대 HP -10%');
      this.cameraRig.shake(0.25, 500);
    }
  }

  _handleEventNode(node) {
    const events = [
      { id: 'campfire',    label: '야영지',   stat: 'con', type: 'HEAL' },
      { id: 'inscription', label: '고대 비문', stat: 'int', type: 'TEMP_BUFF' },
    ];
    const event = events[Math.floor(Math.random() * events.length)];
    useUiStore.getState().showRandomEvent?.({ event, success: Math.random() > 0.4 });
  }

  _spawnEnemies(tier, count) {
    const pool = getEnemyPool(tier);
    return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
  }

  // ================================================================
  // 매 프레임
  // ================================================================
  update(delta) {
    // 파티 마커 Lerp 이동
    if (this._markerMoveT < 1.0) {
      this._markerMoveT = Math.min(this._markerMoveT + delta * this._markerMoveSpd, 1.0);
      const t = _easeInOut(this._markerMoveT);
      this._partyMarker?.position.lerpVectors(
        this._markerMoveFrom, this._markerMoveTo, t,
      );
      if (this._markerMoveT >= 1.0) {
        this._partyMarker?.position.copy(this._markerMoveTo);
        if (this._markerMoveCb) { this._markerMoveCb(); this._markerMoveCb = null; }
      }
    }

    this.cameraRig.update(delta);
  }

  dispose() {
    this._removeNodeClick();
    this.cameraRig.unbindInput();
    this.onExit();
    super.dispose();
  }
}

// ── 유틸 ────────────────────────────────────────────────────
function _easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
