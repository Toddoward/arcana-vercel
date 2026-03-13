// ============================================================
// src/engine/primitives/ItemMesh.js
// 아이템 프리미티브 (GDD §2.2)
//
// 속성별 색상:
//   FIRE      — 주황  / ICE       — 하늘  / LIGHTNING — 노랑
//   DARK      — 보라  / NEUTRAL   — 회색
//
// animateBob(delta): Y축 상하 부유 애니메이션
// ============================================================

import * as THREE from 'three';
import { ELEMENT, COLOR } from '../../constants/constants.js';

const ELEMENT_COLOR = {
  [ELEMENT.FIRE]:      COLOR.ELEMENT_FIRE,
  [ELEMENT.ICE]:       COLOR.ELEMENT_ICE,
  [ELEMENT.LIGHTNING]: COLOR.ELEMENT_LIGHTNING,
  [ELEMENT.DARK]:      COLOR.ELEMENT_DARK,
  [ELEMENT.NEUTRAL]:   COLOR.ELEMENT_NEUTRAL,
};

export class ItemMesh {
  /**
   * @param {string} element  ELEMENT.* 상수
   * @param {object} [opts]
   * @param {number} [opts.scale=1]
   * @param {number} [opts.bobAmplitude=0.12]  부유 진폭 (월드 유닛)
   * @param {number} [opts.bobSpeed=1.8]       부유 속도 (rad/s)
   */
  constructor(element = ELEMENT.NEUTRAL, opts = {}) {
    const scale        = opts.scale        ?? 1;
    this._bobAmplitude = opts.bobAmplitude ?? 0.12;
    this._bobSpeed     = opts.bobSpeed     ?? 1.8;
    this._bobT         = 0;
    this._baseY        = 0;

    const col = ELEMENT_COLOR[element] ?? COLOR.ELEMENT_NEUTRAL;

    // 아이템 본체: 다이아몬드 모양 (팔면체)
    const geo  = new THREE.OctahedronGeometry(0.28 * scale, 0);
    const mat  = new THREE.MeshStandardMaterial({
      color:             col,
      roughness:         0.3,
      metalness:         0.6,
      emissive:          new THREE.Color(col),
      emissiveIntensity: 0.25,
    });
    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.castShadow = true;

    // 회전 고정값 — 약간 기울여서 보석처럼 보이도록
    this._mesh.rotation.x = 0.3;

    // 발광 파티클 링 (얇은 토러스)
    const ringGeo = new THREE.TorusGeometry(0.35 * scale, 0.025 * scale, 6, 20);
    const ringMat = new THREE.MeshStandardMaterial({
      color:             col,
      emissive:          new THREE.Color(col),
      emissiveIntensity: 0.5,
      transparent:       true,
      opacity:           0.55,
    });
    this._ring = new THREE.Mesh(ringGeo, ringMat);
    this._ring.rotation.x = Math.PI / 2;

    // 그룹
    this._group = new THREE.Group();
    this._group.add(this._mesh);
    this._group.add(this._ring);

    this._mat     = mat;
    this._ringMat = ringMat;
  }

  /** Three.js Group */
  get group() { return this._group; }

  /** Three.js Mesh (본체만) */
  get mesh() { return this._mesh; }

  /**
   * Y축 부유 애니메이션
   * @param {number} delta  프레임 delta (초)
   */
  animateBob(delta) {
    this._bobT += delta * this._bobSpeed;
    this._group.position.y = this._baseY + Math.sin(this._bobT) * this._bobAmplitude;
    this._mesh.rotation.y += delta * 1.2;  // 자전
    this._ring.rotation.z += delta * 0.6;  // 링 회전
  }

  /** 기준 Y 좌표 설정 (setPosition과 함께 사용) */
  setPosition(x, y, z) {
    this._baseY = y;
    this._group.position.set(x, y, z);
  }

  dispose() {
    this._group.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material?.dispose();
      }
    });
    this._group.parent?.remove(this._group);
  }
}
