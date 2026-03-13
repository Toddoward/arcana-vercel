// ============================================================
// src/engine/SceneManager.js
// Three.js 씬 생명주기 관리 — 씬 전환, dispose, 렌더 루프
// ============================================================
import * as THREE from 'three';
import { SCENE } from '../constants/constants.js';
import { useUiStore } from '../stores/uiStore.js';
import { useGameStore } from '../stores/gameStore.js';

// ── 씬 클래스 베이스 (모든 씬이 상속) ──────────────────────
export class BaseScene {
  constructor(sceneManager) {
    this.sm       = sceneManager;       // SceneManager 참조
    this.scene    = new THREE.Scene();
    this.camera   = null;
    this.isActive = false;
  }

  // 씬 최초 생성 시 1회 호출 (Three.js 오브젝트 초기화)
  init() {}

  // 씬 활성화될 때마다 호출 (상태 리셋, 이벤트 등록)
  onEnter(payload) {}

  // 씬 비활성화될 때 호출 (이벤트 해제)
  onExit() {}

  // 매 프레임 호출
  update(delta) {}

  // Three.js 오브젝트 전체 해제 (씬 파괴 시)
  dispose() {
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => {
            if (v instanceof THREE.Texture) v.dispose();
          });
          m.dispose();
        });
      }
    });
  }
}

// ── SceneManager ─────────────────────────────────────────────
export class SceneManager {
  constructor() {
    this.renderer     = null;
    this.clock        = new THREE.Clock();
    this.scenes       = {};       // { [SCENE_KEY]: BaseScene 인스턴스 }
    this.currentScene = null;     // 현재 활성 씬
    this.isRunning    = false;
    this._rafId       = null;
    this._resizeHandler = null;
  }

  // ── 초기화 ───────────────────────────────────────────────
  init(canvas) {
    // WebGL 렌더러 생성
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha:     false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;

    // 리사이즈 핸들러
    this._resizeHandler = this._onResize.bind(this);
    window.addEventListener('resize', this._resizeHandler);

    return this;
  }

  // ── 씬 등록 ──────────────────────────────────────────────
  register(key, SceneClass) {
    const instance = new SceneClass(this);
    instance.init();
    this.scenes[key] = instance;
    return this;
  }

  // ── 씬 전환 ──────────────────────────────────────────────
  // payload: 다음 씬에 전달할 임의 데이터 (선택적)
  // switchTo: goTo의 별칭 (씬 내부에서 this.sceneManager.switchTo() 로 호출)
  switchTo(sceneKey, payload = {}) { return this.goTo(sceneKey, payload); }

  async goTo(sceneKey, payload = {}) {
    const next = this.scenes[sceneKey];
    if (!next) {
      console.warn(`[SceneManager] 씬 미등록: ${sceneKey}`);
      return;
    }

    // 현재 씬 종료
    if (this.currentScene) {
      this.currentScene.isActive = false;
      this.currentScene.onExit();
    }

    // 전환 중 블랙 프레임 방지: 렌더러 클리어
    this.renderer.clear();

    // 새 씬 활성화
    this.currentScene        = next;
    this.currentScene.isActive = true;
    this.currentScene.onEnter(payload);

    // Zustand uiStore 동기화
    useUiStore.getState().goToScene(sceneKey);
    useUiStore.getState().resetInGameUI();

    this.clock.getDelta(); // 누적 delta 리셋
  }

  // ── 렌더 루프 ─────────────────────────────────────────────
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._loop();
  }

  stop() {
    this.isRunning = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _loop() {
    if (!this.isRunning) return;
    this._rafId = requestAnimationFrame(() => this._loop());

    const delta = this.clock.getDelta();

    if (this.currentScene && this.currentScene.camera) {
      this.currentScene.update(delta);
      this.renderer.render(
        this.currentScene.scene,
        this.currentScene.camera,
      );
    }
  }

  // ── 리사이즈 ──────────────────────────────────────────────
  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.renderer.setSize(w, h);

    // 활성 씬의 카메라 aspect 갱신
    if (this.currentScene?.camera) {
      const cam = this.currentScene.camera;
      if (cam.isPerspectiveCamera) {
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
    }
  }

  // ── 전체 해제 ─────────────────────────────────────────────
  dispose() {
    this.stop();
    window.removeEventListener('resize', this._resizeHandler);

    Object.values(this.scenes).forEach((s) => s.dispose());
    this.scenes = {};

    this.renderer.dispose();
    this.renderer = null;
  }
}

// ── 싱글턴 인스턴스 ──────────────────────────────────────────
// React App.jsx에서 import해서 사용
export const sceneManager = new SceneManager();