// ============================================================
// src/engine/AssetManager.js
// 에셋 관리 껍데기 (현재 프리미티브 도형만 사용)
// 추후 GLTF 모델 교체 가능하도록 MeshComponent 인터페이스 추상화
// ============================================================
import * as THREE from 'three';

// ── MeshComponent 인터페이스 ─────────────────────────────────
// 모든 게임 오브젝트(캐릭터/몬스터/타일 등)는 이 인터페이스를 구현해야 함.
// 현재는 프리미티브 도형을 반환하고,
// 추후 GLTF 모델이 준비되면 내부 구현만 교체한다.
export class MeshComponent {
  constructor() {
    // Three.js Object3D 또는 Group — 씬에 add()할 루트 오브젝트
    this.object3D = new THREE.Group();
  }

  // 씬에 추가
  addTo(scene) {
    scene.add(this.object3D);
    return this;
  }

  // 씬에서 제거 + 메모리 해제
  removeFrom(scene) {
    scene.remove(this.object3D);
    this.dispose();
  }

  // 위치 설정 헬퍼
  setPosition(x, y, z) {
    this.object3D.position.set(x, y, z);
    return this;
  }

  // 지오메트리/머터리얼 해제 (오버라이드 권장)
  dispose() {
    this.object3D.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}

// ── AssetManager 클래스 ──────────────────────────────────────
class AssetManager {
  constructor() {
    // Three.js 로딩 매니저 (추후 GLTF 로드 진행률 표시용)
    this._loadingManager = new THREE.LoadingManager(
      // onLoad
      () => { this._onLoadComplete(); },
      // onProgress
      (url, loaded, total) => { this._onProgress(url, loaded, total); },
      // onError
      (url) => { console.error(`[AssetManager] 로드 실패: ${url}`); },
    );

    this._cache    = new Map();   // key → Three.js 오브젝트 캐시
    this._progress = 0;          // 0~1
    this._ready    = false;
    this._onReadyCallbacks = [];
  }

  // ── 로딩 완료 콜백 등록 ──────────────────────────────────
  onReady(fn) {
    if (this._ready) { fn(); return; }
    this._onReadyCallbacks.push(fn);
  }

  _onLoadComplete() {
    this._ready   = true;
    this._progress = 1;
    this._onReadyCallbacks.forEach((fn) => fn());
    this._onReadyCallbacks = [];
  }

  _onProgress(url, loaded, total) {
    this._progress = total > 0 ? loaded / total : 1;
  }

  // ── 프리미티브 생성 헬퍼 (현재 주력 방식) ────────────────
  // 모든 게임 오브젝트는 이 헬퍼를 통해 생성
  // 추후 GLTF 준비 시 내부 로직만 교체

  /**
   * 단순 박스 메시 생성
   * @param {number} w  width
   * @param {number} h  height
   * @param {number} d  depth
   * @param {number} color  hex color
   */
  createBox(w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color });
    return new THREE.Mesh(geo, mat);
  }

  /**
   * 구 메시 생성
   * @param {number} radius
   * @param {number} color  hex color
   */
  createSphere(radius, color) {
    const geo = new THREE.SphereGeometry(radius, 16, 12);
    const mat = new THREE.MeshStandardMaterial({ color });
    return new THREE.Mesh(geo, mat);
  }

  /**
   * 실린더 메시 생성
   */
  createCylinder(rt, rb, h, color) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, 16);
    const mat = new THREE.MeshStandardMaterial({ color });
    return new THREE.Mesh(geo, mat);
  }

  /**
   * 플레이어 캐릭터 프리미티브 그룹
   * CapsuleGeometry(몸) + SphereGeometry(머리)
   * NOTE: CapsuleGeometry는 r142+에서 지원 → r128 대응 직접 구현
   */
  createCharacterMesh(color = 0xc9a84c) {
    const group = new THREE.Group();

    // 몸통: 원기둥 + 구 2개로 캡슐 근사
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color });
    const body    = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;

    // 몸통 캡 (위/아래 반구)
    const capGeo = new THREE.SphereGeometry(0.25, 16, 8);
    const topCap = new THREE.Mesh(capGeo, bodyMat.clone());
    topCap.position.y = 0.8;
    const botCap = new THREE.Mesh(capGeo, bodyMat.clone());
    botCap.position.y = 0;

    // 머리
    const headGeo = new THREE.SphereGeometry(0.22, 16, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf0d8c0 });
    const head    = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.15;

    group.add(body, topCap, botCap, head);
    group.castShadow    = true;
    group.receiveShadow = false;

    return group;
  }

  /**
   * 몬스터 프리미티브 — 템플릿별 도형 반환
   * @param {'SMALL'|'MEDIUM'|'LARGE'|'MAGIC'|'SUPPORT'|'SPECIAL'} template
   */
  createMonsterMesh(template) {
    const TEMPLATE_MAP = {
      SMALL:   { shape: 'sphere',    r: 0.3,              color: 0x4488ff },
      MEDIUM:  { shape: 'box',       w: 0.6, h: 0.8, d: 0.6, color: 0x44bb44 },
      LARGE:   { shape: 'box',       w: 1.0, h: 1.4, d: 1.0, color: 0xff4444 },
      MAGIC:   { shape: 'octahedron',r: 0.4,              color: 0xaa44ff },
      SUPPORT: { shape: 'cylinder',  rt: 0.2, rb: 0.3, h: 0.8, color: 0xffdd00 },
      SPECIAL: { shape: 'torus',     r: 0.3, tube: 0.1,   color: 0x222222 },
    };

    const cfg = TEMPLATE_MAP[template] ?? TEMPLATE_MAP.MEDIUM;
    let geo;

    switch (cfg.shape) {
      case 'sphere':
        geo = new THREE.SphereGeometry(cfg.r, 16, 12); break;
      case 'box':
        geo = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d); break;
      case 'octahedron':
        geo = new THREE.OctahedronGeometry(cfg.r, 0); break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(cfg.rt, cfg.rb, cfg.h, 16); break;
      case 'torus':
        geo = new THREE.TorusGeometry(cfg.r, cfg.tube, 8, 24); break;
      default:
        geo = new THREE.BoxGeometry(0.6, 0.8, 0.6);
    }

    const mat  = new THREE.MeshStandardMaterial({ color: cfg.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  /**
   * 타일 메시 (Hex 그리드용 평평한 실린더)
   * @param {number} radius  hex 반지름
   * @param {number} color
   */
  createTileMesh(radius = 1, color = 0x2a2830) {
    const geo  = new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, 0.1, 6);
    const mat  = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0.0,
    });
    return new THREE.Mesh(geo, mat);
  }

  /**
   * 아이템 박스 메시 — 속성별 색상
   * @param {'FIRE'|'ICE'|'LIGHTNING'|'DARK'|'NEUTRAL'} element
   */
  createItemMesh(element = 'NEUTRAL') {
    const ELEM_COLOR = {
      FIRE:      0xff6600,
      ICE:       0x88ddff,
      LIGHTNING: 0xffee00,
      DARK:      0x7700bb,
      NEUTRAL:   0xaaaaaa,
    };
    const geo  = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const mat  = new THREE.MeshStandardMaterial({
      color:     ELEM_COLOR[element] ?? ELEM_COLOR.NEUTRAL,
      roughness: 0.4,
      metalness: 0.6,
      emissive:  ELEM_COLOR[element] ?? 0x000000,
      emissiveIntensity: 0.15,
    });
    return new THREE.Mesh(geo, mat);
  }

  // ── 추후 GLTF 로드 예약 영역 ─────────────────────────────
  // 아래는 GLTF 파일 준비 시 활성화할 코드 구조
  //
  // async loadGLTF(key, url) {
  //   if (this._cache.has(key)) return this._cache.get(key);
  //   const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  //   const loader = new GLTFLoader(this._loadingManager);
  //   return new Promise((resolve, reject) => {
  //     loader.load(url, (gltf) => {
  //       this._cache.set(key, gltf.scene);
  //       resolve(gltf.scene);
  //     }, undefined, reject);
  //   });
  // }

  // ── 캐시 해제 ────────────────────────────────────────────
  clearCache() {
    this._cache.clear();
  }

  dispose() {
    this.clearCache();
  }
}

// ── 싱글턴 ───────────────────────────────────────────────────
export const assetManager = new AssetManager();