// ============================================================
// src/engine/scenes/MainMenuScene.js
// 메인 메뉴 씬 — Three.js 배경 파티클만 렌더링
// 실제 UI는 React DOM 오버레이(MainMenuScreen.jsx)가 담당
// ============================================================
import * as THREE from 'three';
import { BaseScene } from '../SceneManager.js';
import { COLOR } from '../../constants/constants.js';

export class MainMenuScene extends BaseScene {
  constructor(sm) {
    super(sm);
    this._particles = null;
  }

  // ── 초기화 (1회) ─────────────────────────────────────────
  init() {
    // 퍼스펙티브 카메라
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    this.camera.position.set(0, 0, 5);

    // 앰비언트 라이트
    const ambient = new THREE.AmbientLight(0x1a1020, 2.0);
    this.scene.add(ambient);

    // 배경: 어두운 보라빛
    this.scene.background = new THREE.Color(0x07070a);
    this.scene.fog = new THREE.FogExp2(0x07070a, 0.08);

    // 부유 파티클 (먼지/별 효과)
    this._initParticles();
  }

  _initParticles() {
    const COUNT = 300;
    const positions = new Float32Array(COUNT * 3);
    const colors    = new Float32Array(COUNT * 3);

    const goldColor  = new THREE.Color(COLOR.GOLD ?? 0xc9a84c);
    const whiteColor = new THREE.Color(0x9090a8);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

      const c = Math.random() < 0.2 ? goldColor : whiteColor;
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

    const mat = new THREE.PointsMaterial({
      size:         0.04,
      vertexColors: true,
      transparent:  true,
      opacity:      0.7,
      depthWrite:   false,
    });

    this._particles = new THREE.Points(geo, mat);
    this.scene.add(this._particles);
  }

  // ── 씬 진입 ──────────────────────────────────────────────
  onEnter() {
    // 카메라 초기 위치 복원
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);
  }

  // ── 매 프레임 ─────────────────────────────────────────────
  update(delta) {
    if (!this._particles) return;
    // 파티클 천천히 회전
    this._particles.rotation.y += delta * 0.02;
    this._particles.rotation.x += delta * 0.005;
  }

  // ── 씬 종료 ──────────────────────────────────────────────
  onExit() {
    // 메인 메뉴 특별 해제 없음
  }

  dispose() {
    super.dispose();
  }
}
