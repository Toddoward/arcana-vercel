// ============================================================
// src/engine/CameraRig.js
// 공용 카메라 제어 모듈 — 모든 씬이 공유하는 중앙 카메라 시스템
//
// 사용법:
//   this.cameraRig = new CameraRig();
//   this.cameraRig.attachCamera(this.camera);
//   this.cameraRig.bindInput(window, 'worldmap');
//   // update 루프에서:
//   this.cameraRig.update(delta);
//
// GDD §3.2 (카메라 시스템)
// ============================================================
import * as THREE from 'three';

// ── 모드 상수 ─────────────────────────────────────────────
export const CAM_MODE = {
  TRACKING:  'tracking',   // 타겟 자동 추적
  FREE:      'free',       // 유저 자유 조작
  CINEMATIC: 'cinematic',  // 연출 전용 (입력 차단)
};

// ── 씬별 카메라 오프셋 프리셋 ─────────────────────────────
export const CAM_PRESET = {
  // WorldMap: 아이소메트릭 (Orthographic)
  WORLDMAP_DEFAULT: { pos: new THREE.Vector3(0, 40, 28), look: new THREE.Vector3(0, 0, 0) },

  // Battle/Dungeon: 3인칭 (Perspective)
  BATTLE_OVERVIEW:  { pos: new THREE.Vector3(0, 8, 12),  look: new THREE.Vector3(0, 1, -2) },
  BATTLE_PLAYER:    { offset: new THREE.Vector3(0, 3, 5) }, // 플레이어 위치 기준 오프셋
  DUNGEON_NODE:     { offset: new THREE.Vector3(0, 3, 5) }, // 노드 위치 기준 오프셋
};

export class CameraRig {
  constructor() {
    this._camera      = null;
    this._mode        = CAM_MODE.TRACKING;

    // ── Slerp (구면 보간 이동) ─────────────────────────
    this._slerpActive = false;
    this._slerpFrom   = new THREE.Vector3();
    this._slerpTo     = new THREE.Vector3();
    this._slerpLookFrom = new THREE.Vector3();
    this._slerpLookTo   = new THREE.Vector3();
    this._slerpT      = 0;
    this._slerpSpeed  = 1.8;      // 기본 속도 (높을수록 빠름)
    this._slerpCb     = null;     // 완료 콜백

    // ── Lerp follow (타겟 추적) ────────────────────────
    this._followTarget  = null;   // THREE.Vector3 | null
    this._followOffset  = new THREE.Vector3(0, 3, 5);
    this._followLookAt  = null;   // null이면 target 자체
    this._followSpeed   = 4.0;

    // ── Shake ──────────────────────────────────────────
    this._shakeIntensity = 0;
    this._shakeDecay     = 0;
    this._shakeOffset    = new THREE.Vector3();

    // ── 자유 시점 (WorldMap pan/zoom) ─────────────────
    this._freePan        = new THREE.Vector3();  // 누적 pan 오프셋
    this._zoomLevel      = 1.0;   // Orthographic 배율
    this._zoomMin        = 0.3;
    this._zoomMax        = 2.5;

    // ── 입력 ───────────────────────────────────────────
    this._inputType      = null;  // 'worldmap' | 'battle' | 'dungeon'
    this._inputEl        = null;
    this._handlers       = {};
    this._isDragging     = false;
    this._dragButton     = -1;
    this._dragLast       = { x: 0, y: 0 };

    // ── 내부 임시 벡터 (GC 절약) ──────────────────────
    this._tmpVec   = new THREE.Vector3();
    this._tmpQA    = new THREE.Quaternion();
    this._tmpQB    = new THREE.Quaternion();
    this._tmpQC    = new THREE.Quaternion();
  }

  // ──────────────────────────────────────────────────────
  // 공개 API
  // ──────────────────────────────────────────────────────

  /** 씬 카메라 바인딩 */
  attachCamera(camera) {
    this._camera = camera;
  }

  /** 현재 모드 변경 */
  setMode(mode) {
    this._mode = mode;
  }

  /**
   * Slerp 이동 — pos까지 구면 보간, lookAt으로 시선 보간
   * @param {THREE.Vector3} pos     목표 카메라 위치
   * @param {THREE.Vector3} lookAt  목표 시선 포인트
   * @param {number}        speed   보간 속도 (기본 1.8)
   * @param {Function}      onDone  도착 후 콜백
   */
  slerpTo(pos, lookAt, speed = 1.8, onDone = null) {
    if (!this._camera) return;
    this._slerpFrom.copy(this._camera.position);
    this._slerpTo.copy(pos);
    this._slerpLookFrom.copy(this._camera.getWorldDirection(this._tmpVec)
      .multiplyScalar(10).add(this._camera.position));
    this._slerpLookTo.copy(lookAt);
    this._slerpT      = 0;
    this._slerpSpeed  = speed;
    this._slerpActive = true;
    this._slerpCb     = onDone;
  }

  /**
   * Follow — 매 프레임 target + offset 위치로 Lerp 추적
   * @param {THREE.Vector3} target  추적할 월드 포지션
   * @param {THREE.Vector3} offset  카메라 오프셋 (기본 뒤+위)
   * @param {THREE.Vector3|null} lookAt  null이면 target 자체
   */
  follow(target, offset = null, lookAt = null) {
    this._followTarget = target.clone();
    if (offset) this._followOffset.copy(offset);
    this._followLookAt = lookAt ? lookAt.clone() : null;
  }

  /** follow 중단 */
  stopFollow() {
    this._followTarget = null;
  }

  /**
   * 화면 흔들기 연출
   * @param {number} intensity  진폭 (0.1 ~ 0.5 권장)
   * @param {number} durationMs 지속시간 ms
   */
  shake(intensity = 0.15, durationMs = 250) {
    this._shakeIntensity = intensity;
    this._shakeDecay     = intensity / (durationMs / 1000);
  }

  /**
   * 씬별 입력 이벤트 바인딩
   * @param {EventTarget} el    이벤트 대상 (window 또는 canvas)
   * @param {'worldmap'|'battle'|'dungeon'} type
   */
  bindInput(el, type) {
    this.unbindInput();
    this._inputEl   = el;
    this._inputType = type;

    if (type === 'worldmap') {
      this._handlers.mousedown  = (e) => this._onMouseDown(e);
      this._handlers.mousemove  = (e) => this._onMouseMove(e);
      this._handlers.mouseup    = (e) => this._onMouseUp(e);
      this._handlers.wheel      = (e) => this._onWheel(e);
      this._handlers.contextmenu = (e) => e.preventDefault();
      el.addEventListener('mousedown',   this._handlers.mousedown);
      el.addEventListener('mousemove',   this._handlers.mousemove);
      el.addEventListener('mouseup',     this._handlers.mouseup);
      el.addEventListener('wheel',       this._handlers.wheel, { passive: false });
      el.addEventListener('contextmenu', this._handlers.contextmenu);
    }
    // battle / dungeon 은 슬랩 연출 전용 — 유저 입력 없음
  }

  /** 입력 이벤트 해제 */
  unbindInput() {
    if (!this._inputEl) return;
    Object.entries(this._handlers).forEach(([ev, fn]) => {
      this._inputEl.removeEventListener(ev, fn);
    });
    this._handlers  = {};
    this._inputEl   = null;
    this._inputType = null;
  }

  /**
   * 리사이즈 처리 — SceneManager._onResize에서 호출
   * @param {number} w
   * @param {number} h
   */
  onResize(w, h) {
    if (!this._camera) return;
    if (this._camera.isPerspectiveCamera) {
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
    } else if (this._camera.isOrthographicCamera) {
      this._applyZoom();
    }
  }

  /**
   * 매 프레임 업데이트 — 씬의 update(delta)에서 호출
   * @param {number} delta  초 단위 프레임 시간
   */
  update(delta) {
    if (!this._camera) return;

    // 1. Slerp 이동
    if (this._slerpActive) {
      this._slerpT = Math.min(this._slerpT + delta * this._slerpSpeed, 1);
      const t = _easeInOut(this._slerpT);

      this._camera.position.lerpVectors(this._slerpFrom, this._slerpTo, t);

      // 시선 보간
      this._tmpVec.lerpVectors(this._slerpLookFrom, this._slerpLookTo, t);
      this._camera.lookAt(this._tmpVec);

      if (this._slerpT >= 1) {
        this._slerpActive = false;
        this._camera.position.copy(this._slerpTo);
        this._camera.lookAt(this._slerpLookTo);
        if (this._slerpCb) { this._slerpCb(); this._slerpCb = null; }
      }
      return; // Slerp 중엔 follow 덮어쓰기 방지
    }

    // 2. Follow (tracking 모드)
    if (this._mode === CAM_MODE.TRACKING && this._followTarget) {
      this._tmpVec.copy(this._followTarget).add(this._followOffset);
      this._camera.position.lerp(this._tmpVec, Math.min(delta * this._followSpeed, 1));
      const lookTarget = this._followLookAt ?? this._followTarget;
      this._camera.lookAt(lookTarget);
    }

    // 3. Shake 오프셋 적용
    if (this._shakeIntensity > 0) {
      this._shakeOffset.set(
        (Math.random() - 0.5) * this._shakeIntensity,
        (Math.random() - 0.5) * this._shakeIntensity * 0.5,
        0,
      );
      this._camera.position.add(this._shakeOffset);
      this._shakeIntensity = Math.max(0, this._shakeIntensity - this._shakeDecay * delta);
    }
  }

  // ──────────────────────────────────────────────────────
  // 내부 — 입력 핸들러 (WorldMap)
  // ──────────────────────────────────────────────────────

  _onMouseDown(e) {
    // 우클릭(2) = pan
    if (e.button === 2) {
      this._isDragging  = true;
      this._dragButton  = 2;
      this._dragLast    = { x: e.clientX, y: e.clientY };
    }
  }

  _onMouseMove(e) {
    if (!this._isDragging || this._dragButton !== 2) return;
    if (!this._camera) return;

    const dx = e.clientX - this._dragLast.x;
    const dy = e.clientY - this._dragLast.y;
    this._dragLast = { x: e.clientX, y: e.clientY };

    // Orthographic: pan = 픽셀 → 월드 단위 변환
    const panSpeed = 0.05 * this._zoomLevel;
    this._freePan.x -= dx * panSpeed;
    this._freePan.z -= dy * panSpeed;

    // pan 경계 클램프 (월드맵 크기 기준 — 호출 측에서 setMapBounds로 설정 가능)
    const bound = this._mapBound ?? 40;
    this._freePan.x = Math.max(-bound, Math.min(bound, this._freePan.x));
    this._freePan.z = Math.max(-bound, Math.min(bound, this._freePan.z));

    if (!this._slerpActive) {
      this._camera.position.x = this._freePan.x;
      this._camera.position.z = this._freePan.z;
    }

    // 유저 조작 감지 → free 모드 전환
    this.setMode(CAM_MODE.FREE);
    this.stopFollow();
  }

  _onMouseUp(e) {
    if (e.button === 2) this._isDragging = false;
  }

  _onWheel(e) {
    if (!this._camera) return;
    e.preventDefault();

    const delta = e.deltaY > 0 ? 1.08 : 0.93;
    this._zoomLevel = Math.max(this._zoomMin, Math.min(this._zoomMax, this._zoomLevel * delta));
    this._applyZoom();

    // 유저 조작 → free 모드
    this.setMode(CAM_MODE.FREE);
    this.stopFollow();
  }

  _applyZoom() {
    if (!this._camera || !this._camera.isOrthographicCamera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const viewH = 28 * this._zoomLevel;
    const aspect = w / h;
    this._camera.left   = -viewH * aspect / 2;
    this._camera.right  =  viewH * aspect / 2;
    this._camera.top    =  viewH / 2;
    this._camera.bottom = -viewH / 2;
    this._camera.updateProjectionMatrix();
  }

  /** 맵 경계 설정 (WorldMapScene에서 호출) */
  setMapBound(bound) {
    this._mapBound = bound;
  }

  /** pan 오프셋 초기화 */
  resetPan() {
    this._freePan.set(0, 0, 0);
  }

  /** 현재 zoom 레벨 외부에서 설정 */
  setZoom(level) {
    this._zoomLevel = Math.max(this._zoomMin, Math.min(this._zoomMax, level));
    this._applyZoom();
  }
}

// ── 내부 유틸 ─────────────────────────────────────────────
function _easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
