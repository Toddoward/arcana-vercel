// ============================================================
// src/engine/scenes/WorldMapScene.js
// 월드맵 씬 — Three.js Hex 그리드 렌더링
// ============================================================
import * as THREE from 'three';
import { BaseScene } from '../SceneManager.js';
import { assetManager } from '../AssetManager.js';
import { WORLD, TILE, COLOR } from '../../constants/constants.js';
import { useUIStore } from '../../stores/uiStore.js';

export class WorldMapScene extends BaseScene {
  constructor(sm) {
    super(sm);
    this._tileGroup    = null;
    this._unitGroup    = null;
    this._raycaster    = new THREE.Raycaster();
    this._pointer      = new THREE.Vector2();
    this._clickHandler = null;
    this._hoverHandler = null;
  }

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

    this.scene.add(new THREE.AmbientLight(0x404060, 2.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(10, 20, 10);
    this.scene.add(dir);

    this.scene.background = new THREE.Color(0x07070a);

    this._tileGroup = new THREE.Group();
    this._unitGroup = new THREE.Group();
    this.scene.add(this._tileGroup);
    this.scene.add(this._unitGroup);
  }

  // ── 씬 진입 ──────────────────────────────────────────────
  onEnter(payload = {}) {
    if (payload.worldMap) {
      this._buildTiles(payload.worldMap);
    }
    this._registerEvents();
  }

  // ── 씬 퇴장 (1개만 정의) ──────────────────────────────────
  onExit() {
    this._removeEvents();
  }

  // ── Hex 타일 빌드 ─────────────────────────────────────────
  _buildTiles(worldMap) {
    this._tileGroup.clear();

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
    });
  }

  _tileColor(type) {
    const MAP = {
      [TILE.EMPTY]:          COLOR.TILE_EMPTY,
      [TILE.VILLAGE]:        COLOR.TILE_VILLAGE,
      [TILE.VILLAGE_BURNED]: COLOR.TILE_VILLAGE_BURNED,
      [TILE.DUNGEON]:        COLOR.TILE_DUNGEON,
      [TILE.ENEMY]:          COLOR.TILE_ENEMY,
      [TILE.QUEST]:          COLOR.TILE_QUEST,
      [TILE.RANDOM_EVENT]:   COLOR.TILE_RANDOM,
      [TILE.CASTLE]:         COLOR.TILE_CASTLE,
      [TILE.BOSS]:           COLOR.TILE_BOSS,
    };
    return MAP[type] ?? COLOR.TILE_EMPTY;
  }

  // ── 이벤트 등록 / 해제 ────────────────────────────────────
  _registerEvents() {
    this._clickHandler = (e) => this._onPointerClick(e);
    this._hoverHandler = (e) => this._onPointerMove(e);
    window.addEventListener('click',     this._clickHandler);
    window.addEventListener('mousemove', this._hoverHandler);
  }

  _removeEvents() {
    if (this._clickHandler) {
      window.removeEventListener('click',     this._clickHandler);
      this._clickHandler = null;
    }
    if (this._hoverHandler) {
      window.removeEventListener('mousemove', this._hoverHandler);
      this._hoverHandler = null;
    }
  }

  // ── 포인터 핸들러 (동기 함수 — import는 최상단에서 처리) ──
  _onPointerClick(e) {
    this._updatePointer(e);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects(this._tileGroup.children, false);
    if (hits.length > 0) {
      const { tileX, tileY, type } = hits[0].object.userData;
      useUIStore.getState().setSelectedTile({ x: tileX, y: tileY, type });
    }
  }

  _onPointerMove(e) {
    this._updatePointer(e);
    // 추후 호버 하이라이트
  }

  _updatePointer(e) {
    this._pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    this._pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  // ── 매 프레임 ─────────────────────────────────────────────
  update(delta) {
    // 추후 드래곤 이동 연출 등
  }

  // ── 해제 ──────────────────────────────────────────────────
  dispose() {
    this._removeEvents();
    super.dispose();
  }
}