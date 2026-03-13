// ============================================================
// src/engine/primitives/CharacterMesh.js
// 플레이어 캐릭터 프리미티브 (GDD §2.2)
//
// Three.js r128 대응 — CapsuleGeometry 없으므로
// CylinderGeometry(몸통) + SphereGeometry×3(캡 상하 + 머리)로 근사
//
// 클래스별 고유 색상 (GDD §2.2):
//   Fighter: #E05C3A / Wizard: #5B8DD9 / Cleric: #F0C040
//   Rogue:   #4DB87A / Bard:   #C47FD5
// ============================================================

import * as THREE from 'three';
import { CLASS, COLOR } from '../../constants/constants.js';

// 클래스 → 몸통 색상 매핑
const CLASS_COLOR = {
  [CLASS.FIGHTER]: COLOR.FIGHTER,
  [CLASS.WIZARD]:  COLOR.WIZARD,
  [CLASS.CLERIC]:  COLOR.CLERIC,
  [CLASS.ROGUE]:   COLOR.ROGUE,
  [CLASS.BARD]:    COLOR.BARD,
};

export class CharacterMesh {
  /**
   * @param {string} classType  CLASS.FIGHTER | WIZARD | ...
   * @param {object} [opts]
   * @param {number} [opts.scale=1]
   */
  constructor(classType = CLASS.FIGHTER, opts = {}) {
    const scale     = opts.scale ?? 1;
    const bodyColor = CLASS_COLOR[classType] ?? 0xc9a84c;

    this._group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color:     bodyColor,
      roughness: 0.7,
      metalness: 0.1,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color:     0xf0d8c0,
      roughness: 0.8,
      metalness: 0.0,
    });

    // ── 몸통 실린더 ───────────────────────────────────────────
    const bodyGeo  = new THREE.CylinderGeometry(0.25 * scale, 0.25 * scale, 0.8 * scale, 16);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.4 * scale;
    bodyMesh.castShadow = true;
    this._group.add(bodyMesh);

    // ── 캡슐 상단 캡 ─────────────────────────────────────────
    const capGeo   = new THREE.SphereGeometry(0.25 * scale, 16, 8);
    const topCap   = new THREE.Mesh(capGeo, bodyMat.clone());
    topCap.position.y = 0.8 * scale;
    topCap.castShadow = true;
    this._group.add(topCap);

    // ── 캡슐 하단 캡 ─────────────────────────────────────────
    const botCap = new THREE.Mesh(capGeo.clone(), bodyMat.clone());
    botCap.position.y = 0;
    botCap.castShadow = true;
    this._group.add(botCap);

    // ── 머리 ─────────────────────────────────────────────────
    const headGeo  = new THREE.SphereGeometry(0.22 * scale, 16, 12);
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.15 * scale;
    headMesh.castShadow = true;
    this._group.add(headMesh);

    // 그룹 전체 그림자 설정
    this._group.traverse((obj) => {
      if (obj.isMesh) obj.castShadow = true;
    });

    this._bodyMat = bodyMat;
    this._scale   = scale;
  }

  /** Three.js Group (씬에 add할 오브젝트) */
  get group() { return this._group; }

  /** 몸통 색상 변경 */
  setColor(hex) {
    this._bodyMat.color.setHex(hex);
  }

  /** 월드 좌표 설정 */
  setPosition(x, y, z) {
    this._group.position.set(x, y, z);
  }

  /** 씬에서 제거할 때 호출 — 지오메트리/머티리얼 해제 */
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
