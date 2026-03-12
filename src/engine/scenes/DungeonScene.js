// ============================================================
// src/engine/scenes/DungeonScene.js
// 던전 씬 — 노드 그래프 기반 탑뷰 표시
// ============================================================
import * as THREE from 'three';
import { BaseScene } from '../SceneManager.js';
import { assetManager } from '../AssetManager.js';

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
  }

  // ── 씬 퇴장 ──────────────────────────────────────────────
  onExit() {
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

  // ── 매 프레임 ─────────────────────────────────────────────
  update(delta) {
    // 추후 노드 호버/선택 애니메이션
  }

  // ── 해제 ──────────────────────────────────────────────────
  dispose() {
    this.onExit();
    super.dispose();
  }
}