// ============================================================
// src/engine/primitives/TileMesh.js
// 헥스 타일 프리미티브 (GDD §2.2)
//
// tileType별 색상: constants.js COLOR.TILE_* 참조
// setHighlight(bool): 호버/선택 강조 효과
// ============================================================

import * as THREE from 'three';
import { TILE, COLOR } from '../../constants/constants.js';

// tileType → 기본 색상 매핑
const TILE_COLOR_MAP = {
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

// 헥스 평탑(flat-top) 6각형 버텍스 생성
function hexVertices(r) {
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    verts.push(new THREE.Vector2(r * Math.cos(angle), r * Math.sin(angle)));
  }
  return verts;
}

export class TileMesh {
  /**
   * @param {number} radius   헥스 외접원 반지름 (HexGrid TILE_SIZE 와 맞출 것)
   * @param {string} tileType TILE.* 상수
   * @param {object} [opts]
   * @param {number} [opts.height=0.12]  타일 두께
   */
  constructor(radius = 0.95, tileType = TILE.EMPTY, opts = {}) {
    const height      = opts.height ?? 0.12;
    this._baseColor   = TILE_COLOR_MAP[tileType] ?? COLOR.TILE_EMPTY;
    this._highlighted = false;

    // Three.js r128: ExtrudeGeometry로 헥스 형태 생성
    const shape = new THREE.Shape(hexVertices(radius));
    const geo   = new THREE.ExtrudeGeometry(shape, {
      depth:         height,
      bevelEnabled:  false,
    });
    geo.rotateX(-Math.PI / 2); // XZ 평면에 눕히기

    this._mat  = new THREE.MeshStandardMaterial({
      color:     this._baseColor,
      roughness: 0.85,
      metalness: 0.0,
    });
    this._mesh = new THREE.Mesh(geo, this._mat);
    this._mesh.receiveShadow = true;
    this._mesh.position.y    = 0; // 상면이 y=0 근처에 오도록
  }

  /** Three.js Mesh */
  get mesh() { return this._mesh; }

  /** 호버/선택 강조 토글 */
  setHighlight(on) {
    this._highlighted = on;
    if (on) {
      this._mat.emissive.setHex(0xffffff);
      this._mat.emissiveIntensity = 0.25;
    } else {
      this._mat.emissive.setHex(0x000000);
      this._mat.emissiveIntensity = 0;
    }
  }

  /** 타일 색상 강제 변경 (예: VILLAGE → VILLAGE_BURNED 전환) */
  setTileType(tileType) {
    this._baseColor = TILE_COLOR_MAP[tileType] ?? COLOR.TILE_EMPTY;
    this._mat.color.setHex(this._baseColor);
    if (!this._highlighted) {
      this._mat.emissive.setHex(0x000000);
      this._mat.emissiveIntensity = 0;
    }
  }

  setPosition(x, y, z) { this._mesh.position.set(x, y, z); }

  dispose() {
    this._mesh.geometry?.dispose();
    this._mat?.dispose();
    this._mesh.parent?.remove(this._mesh);
  }
}
