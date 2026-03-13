// ============================================================
// src/engine/scenes/DungeonScene.js
// 던전 씬 — 노드 그래프 탑뷰 + 노드 진행 로직 (파트10)
//
// GDD: §20.1~20.5 (던전 구조, 노드 타입, 진행 흐름, 코어 클리어)
//
// 의존:
//   gameStore.js   — moveDungeonNode, exitDungeon
//   playerStore.js — players (LUK 스탯 참조)
//   uiStore.js     — showResult, showToast, showRandomEvent
//   TokenRoll.js   — 함정/코어 굴림
//   enemies.js     — ENEMY_POOL (전투 노드 스폰)
// ============================================================
import * as THREE from 'three';
import { BaseScene }      from '../SceneManager.js';
import { assetManager }   from '../AssetManager.js';
import { useGameStore }   from '../../stores/gameStore.js';
import { usePlayerStore } from '../../stores/playerStore.js';
import { useUiStore }     from '../../stores/uiStore.js';
import { TokenRoll }      from '../../game/battle/TokenRoll.js';
import { getEnemyPool }   from '../../game/data/enemies.js';

// ── 노드 타입별 색상 ─────────────────────────────────────────
const NODE_COLOR = {
  BATTLE:   0x802020,
  TREASURE: 0xc9a84c,
  EVENT:    0x4080c0,
  TRAP:     0xa04080,
  SHOP:     0x40a040,
  EMPTY:    0x303040,
  BOSS:     0xff2020,
};

export class DungeonScene extends BaseScene {
  constructor(sm) {
    super(sm);
    this._nodeGroup = null;
    this._edgeGroup = null;
  }

  // ── 초기화 (1회) ─────────────────────────────────────────
  init() {
    const aspect = window.innerWidth / window.innerHeight;
    const viewH  = 16;
    this.camera = new THREE.OrthographicCamera(
      -viewH * aspect / 2,  viewH * aspect / 2,
       viewH / 2,           -viewH / 2,
      0.1, 100,
    );
    this.camera.position.set(0, 20, 0);
    this.camera.lookAt(0, 0, 0);

    this.scene.background = new THREE.Color(0x080610);
    this.scene.add(new THREE.AmbientLight(0x303050, 3.0));

    this._nodeGroup = new THREE.Group();
    this._edgeGroup = new THREE.Group();
    this.scene.add(this._nodeGroup);
    this.scene.add(this._edgeGroup);
  }

  // ── 씬 진입 ──────────────────────────────────────────────
  onEnter(payload = {}) {
    if (payload.dungeonGraph) {
      this._buildGraph(payload.dungeonGraph);
    }
    this._postEnterHook();
  }

  // ── 씬 퇴장 ──────────────────────────────────────────────
  onExit() {
    this._removeNodeClick();
    if (this._nodeGroup) this._nodeGroup.clear();
    if (this._edgeGroup) this._edgeGroup.clear();
  }

  // ── 던전 노드 그래프 시각화 ───────────────────────────────
  _buildGraph(graph) {
    this._nodeGroup.clear();
    this._edgeGroup.clear();

    // 노드 배치
    graph.nodes.forEach((node) => {
      const color = NODE_COLOR[node.type] ?? NODE_COLOR.EMPTY;
      const mesh  = assetManager.createBox(0.8, 0.2, 0.8, color);
      mesh.position.set(node.x ?? 0, 0, node.z ?? 0);
      mesh.userData = { nodeId: node.id, type: node.type };
      this._nodeGroup.add(mesh);

      // 현재 위치 링 표시
      if (node.id === graph.currentNodeId) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.55, 0.06, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0xc9a84c }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(node.x ?? 0, 0.1, node.z ?? 0);
        this._nodeGroup.add(ring);
      }
    });

    // 엣지 (노드 간 연결선)
    if (graph.edges) {
      graph.edges.forEach((edge) => {
        const from = graph.nodes.find((n) => n.id === edge.from);
        const to   = graph.nodes.find((n) => n.id === edge.to);
        if (!from || !to) return;

        const fromV  = new THREE.Vector3(from.x ?? 0, 0.05, from.z ?? 0);
        const toV    = new THREE.Vector3(to.x   ?? 0, 0.05, to.z   ?? 0);
        const length = fromV.distanceTo(toV);
        const mid    = new THREE.Vector3().addVectors(fromV, toV).multiplyScalar(0.5);

        const line = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.05, length),
          new THREE.MeshBasicMaterial({ color: 0x3a3050 }),
        );
        line.position.copy(mid);
        // lookAt을 Vector3로 호출 (x,y,z 개별 인자 대신)
        line.lookAt(toV);
        this._edgeGroup.add(line);
      });
    }
  }

  // ── 노드 클릭 처리 (GDD §20.3) ──────────────────────────────
  _registerNodeClick() {
    this._raycaster  = new THREE.Raycaster();
    this._pointer    = new THREE.Vector2();
    this._clickCb    = (e) => {
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

  // ── 노드 진입 분기 (GDD §20.2) ───────────────────────────
  _enterNode(nodeId) {
    const gs    = useGameStore.getState();
    const graph = gs.dungeonGraph;
    if (!graph) return;

    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // 인접 노드만 이동 가능 (현재 노드의 엣지 확인)
    const reachable = graph.edges
      .filter((e) => e.from === graph.currentNodeId || e.to === graph.currentNodeId)
      .map((e) => e.from === graph.currentNodeId ? e.to : e.from);
    if (!reachable.includes(nodeId)) return;

    gs.moveDungeonNode(nodeId);
    this._buildGraph({ ...graph, currentNodeId: nodeId });

    switch (node.type) {
      case 'BATTLE':   return this._handleBattleNode(node);
      case 'TREASURE': return this._handleTreasureNode(node);
      case 'TRAP':     return this._handleTrapNode(node);
      case 'SHOP':     return useUiStore.getState().openInventory();
      case 'BOSS':     return this._handleBossNode(node);
      case 'CORE':     return this._handleCoreNode(node);
      case 'EVENT':    return this._handleEventNode(node);
      default: break;   // EMPTY — 아무 것도 없음
    }
  }

  // ── 전투 노드 (GDD §20.2) ────────────────────────────────
  _handleBattleNode(node) {
    const tier    = node.tier ?? 'mid';
    const pool    = getEnemyPool(tier);
    const count   = 2 + Math.floor(Math.random() * 2);
    const enemies = Array.from({ length: count }, () =>
      pool[Math.floor(Math.random() * pool.length)]
    );
    useGameStore.getState().enterBattle(enemies);
    this.sceneManager.switchTo('battle', {
      allies: usePlayerStore.getState().players,
      enemies,
      returnTo: 'dungeon',
    });
  }

  // ── 보물 노드 (GDD §20.2) ────────────────────────────────
  _handleTreasureNode(node) {
    // 간단한 랜덤 보상 (아이템 시스템 연동 전 골드/EXP 지급)
    const gold = 30 + Math.floor(Math.random() * 50);
    const exp  = 20 + Math.floor(Math.random() * 30);
    const ps   = usePlayerStore.getState();
    for (const p of ps.players) {
      ps.addExp?.(p.id, exp);
      ps.addGold?.(p.id, gold);
    }
    useUiStore.getState().showToast?.(`💰 보물 획득! +${gold}G / +${exp}EXP`);
  }

  // ── 함정 노드 (GDD §20.2: 굴림으로 회피) ─────────────────
  _handleTrapNode(node) {
    const leader  = usePlayerStore.getState().players[0];
    const dex     = leader?.stats?.dex ?? 5;
    const result  = TokenRoll.roll({ stat: dex });
    if (result.successes > 0) {
      useUiStore.getState().showToast?.('🪤 함정을 간파했습니다!');
    } else {
      const dmg = 15 + Math.floor(Math.random() * 20);
      useUiStore.getState().showToast?.(`🪤 함정 발동! 파티 ${dmg} 데미지`);
      // 파티 전체 HP 감소 (간략화)
      const ps = usePlayerStore.getState();
      for (const p of ps.players) {
        ps.applyDamage?.(p.id, dmg);
      }
    }
  }

  // ── 보스 노드 (GDD §20.4) ────────────────────────────────
  _handleBossNode(node) {
    const pool    = getEnemyPool('late');
    const bossEnemy = pool[Math.floor(Math.random() * pool.length)];
    const scaled  = { ...bossEnemy, hp: Math.round(bossEnemy.hp * 1.8) };
    useGameStore.getState().enterBattle([scaled]);
    this.sceneManager.switchTo('battle', {
      allies: usePlayerStore.getState().players,
      enemies: [scaled],
      returnTo: 'dungeon',
    });
  }

  // ── 코어 노드 (GDD §20.5) ────────────────────────────────
  _handleCoreNode(node) {
    const leader  = usePlayerStore.getState().players[0];
    const luk     = leader?.stats?.luk ?? 5;
    const result  = TokenRoll.roll({ stat: luk });

    if (result.successes > 0) {
      // 성공 → 200 EXP + 월드맵 복귀
      const ps = usePlayerStore.getState();
      for (const p of ps.players) ps.addExp?.(p.id, 200);
      useUiStore.getState().showToast?.('✨ 던전 코어 클리어! +200 EXP');
      setTimeout(() => {
        useGameStore.getState().exitDungeon?.();
        this.sceneManager.switchTo('worldmap');
      }, 1500);
    } else {
      // 실패 → 최대 HP 10% 패널티
      const ps = usePlayerStore.getState();
      for (const p of ps.players) {
        const penalty = Math.round(p.maxHp * 0.10);
        ps.applyDamage?.(p.id, penalty);
      }
      useUiStore.getState().showToast?.('💀 코어 공략 실패! 최대 HP -10%');
    }
  }

  // ── 이벤트 노드 (GDD §20.2) ──────────────────────────────
  _handleEventNode(node) {
    const events = [
      { id: 'campfire', label: '야영지', stat: 'con', type: 'HEAL' },
      { id: 'inscription', label: '고대 비문', stat: 'int', type: 'TEMP_BUFF' },
    ];
    const event  = events[Math.floor(Math.random() * events.length)];
    useUiStore.getState().showRandomEvent?.({ event, success: Math.random() > 0.4 });
  }

  // ── onEnter에 클릭 등록 연결 ─────────────────────────────
  // (기존 onEnter 이후 호출)
  _postEnterHook() {
    this._registerNodeClick();
  }

  // ── 매 프레임 ─────────────────────────────────────────────
  update(delta) {
    // 추후 노드 호버/선택 애니메이션
  }

  // ── 해제 ──────────────────────────────────────────────────
  dispose() {
    this._removeNodeClick();
    this.onExit();
    super.dispose();
  }
}
