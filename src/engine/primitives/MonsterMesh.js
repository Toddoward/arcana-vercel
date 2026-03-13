// ============================================================
// src/engine/primitives/MonsterMesh.js
// 몬스터 프리미티브 (GDD §2.2)
//
// 템플릿별 형태/색상:
//   SMALL   — 작은 구체        (파랑)
//   MEDIUM  — 구체+큰 눈       (초록)
//   LARGE   — 박스 몸통+뿔     (빨강)
//   MAGIC   — 팔면체 (부유)    (보라)
//   SUPPORT — 납작 원반        (노랑)
//   SPECIAL — 검은 커스텀      (검정)
// ============================================================

import * as THREE from 'three';
import { COLOR } from '../../constants/constants.js';

export const MONSTER_TEMPLATE = {
  SMALL:   'SMALL',
  MEDIUM:  'MEDIUM',
  LARGE:   'LARGE',
  MAGIC:   'MAGIC',
  SUPPORT: 'SUPPORT',
  SPECIAL: 'SPECIAL',
};

const TEMPLATE_COLOR = {
  SMALL:   COLOR.MONSTER_SMALL,
  MEDIUM:  COLOR.MONSTER_MEDIUM,
  LARGE:   COLOR.MONSTER_LARGE,
  MAGIC:   COLOR.MONSTER_MAGIC,
  SUPPORT: COLOR.MONSTER_SUPPORT,
  SPECIAL: COLOR.MONSTER_SPECIAL,
};

export class MonsterMesh {
  /**
   * @param {string} template  MONSTER_TEMPLATE 값 중 하나
   * @param {object} [opts]
   * @param {number} [opts.scale=1]
   */
  constructor(template = MONSTER_TEMPLATE.SMALL, opts = {}) {
    const scale = opts.scale ?? 1;
    this._group = new THREE.Group();
    this._template = template;

    const col = TEMPLATE_COLOR[template] ?? 0x888888;
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.1 });

    switch (template) {
      case MONSTER_TEMPLATE.SMALL:
        this._buildSmall(mat, scale);
        break;
      case MONSTER_TEMPLATE.MEDIUM:
        this._buildMedium(mat, scale);
        break;
      case MONSTER_TEMPLATE.LARGE:
        this._buildLarge(mat, scale);
        break;
      case MONSTER_TEMPLATE.MAGIC:
        this._buildMagic(mat, scale);
        break;
      case MONSTER_TEMPLATE.SUPPORT:
        this._buildSupport(mat, scale);
        break;
      case MONSTER_TEMPLATE.SPECIAL:
      default:
        this._buildSpecial(mat, scale);
        break;
    }

    this._group.traverse((obj) => {
      if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = false; }
    });
    this._mat = mat;
  }

  // ── 템플릿별 빌더 ──────────────────────────────────────────

  _buildSmall(mat, s) {
    const geo  = new THREE.SphereGeometry(0.3 * s, 12, 8);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.3 * s;
    this._group.add(mesh);
  }

  _buildMedium(mat, s) {
    // 몸통
    const bodyGeo = new THREE.SphereGeometry(0.38 * s, 14, 10);
    const body    = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.4 * s;
    this._group.add(body);
    // 눈 (빛나는 작은 구 2개)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.8 });
    [-0.12, 0.12].forEach((ox) => {
      const eyeGeo = new THREE.SphereGeometry(0.07 * s, 8, 6);
      const eye    = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(ox * s, 0.52 * s, 0.33 * s);
      this._group.add(eye);
    });
  }

  _buildLarge(mat, s) {
    // 박스 몸통
    const bodyGeo = new THREE.BoxGeometry(0.7 * s, 0.9 * s, 0.6 * s);
    const body    = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.5 * s;
    this._group.add(body);
    // 뿔
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    [{ x: -0.1, z: 0.05 }, { x: 0.1, z: 0.05 }].forEach(({ x, z }) => {
      const hornGeo = new THREE.ConeGeometry(0.06 * s, 0.3 * s, 8);
      const horn    = new THREE.Mesh(hornGeo, hornMat);
      horn.position.set(x * s, 1.05 * s, z * s);
      this._group.add(horn);
    });
  }

  _buildMagic(mat, s) {
    // 팔면체 (부유 애니메이션은 AnimateBob 외부에서 처리)
    const geo  = new THREE.OctahedronGeometry(0.35 * s, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.7 * s; // 살짝 떠있음
    this._group.add(mesh);
    // 후광 링
    const ringGeo = new THREE.TorusGeometry(0.45 * s, 0.04 * s, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({ color: mat.color, emissive: mat.color, emissiveIntensity: 0.5, transparent: true, opacity: 0.6 });
    const ring    = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.7 * s;
    this._group.add(ring);
  }

  _buildSupport(mat, s) {
    // 납작 원반
    const diskGeo = new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.18 * s, 20);
    const disk    = new THREE.Mesh(diskGeo, mat);
    disk.position.y = 0.09 * s;
    this._group.add(disk);
    // 십자 마크 (가는 박스)
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const hBar     = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.04 * s, 0.1 * s), crossMat);
    const vBar     = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.04 * s, 0.5 * s), crossMat);
    [hBar, vBar].forEach((b) => { b.position.y = 0.19 * s; this._group.add(b); });
  }

  _buildSpecial(mat, s) {
    // 검은 커스텀 — 다면체
    const geo  = new THREE.DodecahedronGeometry(0.35 * s, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.35 * s;
    this._group.add(mesh);
  }

  // ── 퍼블릭 API ────────────────────────────────────────────

  /** Three.js Group */
  get group() { return this._group; }

  /** 월드 좌표 설정 */
  setPosition(x, y, z) { this._group.position.set(x, y, z); }

  /** MAGIC 몬스터 부유 애니메이션 — 외부 update 루프에서 호출 */
  animateFloat(delta) {
    if (this._template === MONSTER_TEMPLATE.MAGIC) {
      this._floatT = (this._floatT ?? 0) + delta;
      this._group.position.y = Math.sin(this._floatT * 1.5) * 0.12;
    }
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
