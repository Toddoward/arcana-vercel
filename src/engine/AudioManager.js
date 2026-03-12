// ============================================================
// src/engine/AudioManager.js
// 오디오 시스템 껍데기 (현재 no-op)
// 추후 Howler.js 연동으로 활성화
// ============================================================

// ── 오디오 레이어 식별자 ─────────────────────────────────────
export const AUDIO_LAYER = {
  BGM_WORLD:  'BGM_WORLD',   // 월드맵 배경음악
  BGM_BATTLE: 'BGM_BATTLE',  // 일반 전투 BGM
  BGM_BOSS:   'BGM_BOSS',    // 보스 전투 BGM
  SFX_CARD:   'SFX_CARD',    // 카드 사용 효과음
  SFX_HIT:    'SFX_HIT',     // 피격 효과음
  SFX_HEAL:   'SFX_HEAL',    // 회복 효과음
  SFX_DRAGON: 'SFX_DRAGON',  // 드래곤 연출 효과음
  SFX_UI:     'SFX_UI',      // UI 클릭/전환 효과음
};

// ── AudioManager 클래스 ──────────────────────────────────────
class AudioManager {
  constructor() {
    this._enabled = false;   // 오디오 활성화 플래그 (추후 true로 전환)
    this._volume  = {
      master: 1.0,
      bgm:    0.6,
      sfx:    0.8,
    };
    this._current = {
      bgm: null,   // 현재 재생 중인 BGM 식별자
    };
  }

  // ── BGM ────────────────────────────────────────────────
  // 배경음악 재생 (현재 no-op)
  playBGM(layerId) {
    if (!this._enabled) return;
    // TODO: Howler.js 연동 시 구현
    // if (this._current.bgm === layerId) return;
    // this.stopBGM();
    // Howler.play(layerId, { loop: true, volume: this._volume.bgm });
    // this._current.bgm = layerId;
    this._current.bgm = layerId;
  }

  // 배경음악 정지 (현재 no-op)
  stopBGM() {
    if (!this._enabled) return;
    // TODO: Howler.js 연동 시 구현
    this._current.bgm = null;
  }

  // BGM 페이드 (현재 no-op)
  fadeBGM(fromId, toId, durationMs = 1000) {
    if (!this._enabled) return;
    // TODO: Howler.js 페이드 인/아웃 크로스페이드 구현
    this._current.bgm = toId;
  }

  // ── SFX ────────────────────────────────────────────────
  // 효과음 1회 재생 (현재 no-op)
  playSFX(layerId) {
    if (!this._enabled) return;
    // TODO: Howler.js 연동 시 구현
    // Howler.play(layerId, { volume: this._volume.sfx });
  }

  // ── 볼륨 제어 ──────────────────────────────────────────
  setMasterVolume(v) {
    this._volume.master = Math.max(0, Math.min(1, v));
    // TODO: Howler.Howler.volume(this._volume.master);
  }

  setBGMVolume(v) {
    this._volume.bgm = Math.max(0, Math.min(1, v));
  }

  setSFXVolume(v) {
    this._volume.sfx = Math.max(0, Math.min(1, v));
  }

  // ── 활성화 / 비활성화 ─────────────────────────────────
  enable()  { this._enabled = true;  }
  disable() { this._enabled = false; this.stopBGM(); }

  // ── 씬 전환 헬퍼 ───────────────────────────────────────
  // 씬별 BGM 자동 전환 (SceneManager.goTo 후 호출)
  onSceneChange(sceneKey) {
    const SCENE_BGM_MAP = {
      MAIN_MENU:        null,
      LOBBY:            null,
      CHARACTER_SELECT: null,
      WORLD_MAP:        AUDIO_LAYER.BGM_WORLD,
      BATTLE:           AUDIO_LAYER.BGM_BATTLE,
      DUNGEON:          AUDIO_LAYER.BGM_BATTLE,
      RESULT:           null,
    };
    const nextBGM = SCENE_BGM_MAP[sceneKey];
    if (nextBGM) {
      this.fadeBGM(this._current.bgm, nextBGM);
    } else {
      this.stopBGM();
    }
  }

  // ── 해제 ───────────────────────────────────────────────
  dispose() {
    this.stopBGM();
    this._enabled = false;
    // TODO: Howler.js 전체 해제
  }
}

// ── 싱글턴 ───────────────────────────────────────────────────
export const audioManager = new AudioManager();