// ============================================================
// src/stores/uiStore.js
// 현재 씬, 모달 상태, 핸드 표시, 선택된 카드 등 UI 전용 상태
// ============================================================
import { create } from 'zustand';
import { SCENE } from '../constants/constants.js';

export const useUIStore = create((set, get) => ({
  // ── 씬 ────────────────────────────────────
  currentScene:  SCENE.MAIN_MENU,
  previousScene: null,

  goToScene: (scene) => set((state) => ({
    previousScene: state.currentScene,
    currentScene:  scene,
  })),

  goBack: () => set((state) => ({
    currentScene:  state.previousScene ?? SCENE.MAIN_MENU,
    previousScene: null,
  })),

  // ── 모달 ──────────────────────────────────
  // 동시에 하나의 모달만 열림
  activeModal:   null,
  // 'INVENTORY' | 'SHOP' | 'FORGE' | 'INN' | 'QUEST' |
  // 'GAME_OVER' | 'TOKEN_ROLL' | 'ITEM_SELECT' | null
  modalData:     null,   // 모달에 전달할 추가 데이터

  openModal: (modalType, data = null) => set({
    activeModal: modalType,
    modalData:   data,
  }),

  closeModal: () => set({
    activeModal: null,
    modalData:   null,
  }),

  // ── 핸드 UI ───────────────────────────────
  isHandVisible:     true,
  selectedCardIndex: null,   // 핸드에서 선택된 카드 인덱스
  hoveredCardIndex:  null,

  setHandVisible: (val) => set({ isHandVisible: val }),

  selectCard: (index) => set({ selectedCardIndex: index }),
  deselectCard: () => set({ selectedCardIndex: null }),
  hoverCard: (index) => set({ hoveredCardIndex: index }),

  // ── 타겟 선택 ─────────────────────────────
  // 카드 사용 시 타겟 선택 모드
  isTargeting:   false,
  targetingCard: null,   // 현재 타겟 선택 중인 카드 데이터
  validTargets:  [],     // 선택 가능한 타겟 ID 배열

  startTargeting: (card, validTargets) => set({
    isTargeting:   true,
    targetingCard: card,
    validTargets,
  }),

  stopTargeting: () => set({
    isTargeting:   false,
    targetingCard: null,
    validTargets:  [],
    selectedCardIndex: null,
  }),

  // ── 토큰 굴림 UI ──────────────────────────
  isRolling:    false,
  rollResult:   null,   // { total, successes, dpUsed, tokens: [] }

  startRoll: () => set({ isRolling: true, rollResult: null }),

  finishRoll: (result) => set({ isRolling: false, rollResult: result }),

  clearRoll: () => set({ rollResult: null }),

  // ── 드래곤 카메라 연출 ────────────────────
  isDragonCutscene: false,

  setDragonCutscene: (val) => set({ isDragonCutscene: val }),

  // ── 전투 HUD ──────────────────────────────
  isBattleLogVisible: false,

  toggleBattleLog: () => set((state) => ({
    isBattleLogVisible: !state.isBattleLogVisible,
  })),

  // ── 알림 토스트 ───────────────────────────
  toasts: [],   // [{ id, message, type: 'info'|'warn'|'error', duration }]

  addToast: (message, type = 'info', duration = 3000) => set((state) => {
    const id = Date.now();
    // 자동 제거 타이머
    setTimeout(() => {
      useUIStore.getState().removeToast(id);
    }, duration);
    return {
      toasts: [...state.toasts, { id, message, type, duration }],
    };
  }),

  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),

  // ── 로비 / 캐릭터 선택 ────────────────────
  lobbyCode:        '',
  lobbyPlayers:     [],
  // [{ id, name, classType, isReady, isHost }]

  setLobbyCode: (code) => set({ lobbyCode: code }),

  setLobbyPlayers: (players) => set({ lobbyPlayers: players }),

  updateLobbyPlayer: (id, patch) => set((state) => ({
    lobbyPlayers: state.lobbyPlayers.map((p) =>
      p.id !== id ? p : { ...p, ...patch }
    ),
  })),

  // ── 월드맵 HUD ────────────────────────────
  // 선택된 타일 정보 (호버/클릭)
  selectedTile: null,   // { x, y, type, ... }

  setSelectedTile: (tile) => set({ selectedTile: tile }),
  clearSelectedTile: () => set({ selectedTile: null }),

  // ── 전체 UI 초기화 (씬 전환 시 사용) ──────
  resetInGameUI: () => set({
    activeModal:       null,
    modalData:         null,
    isHandVisible:     true,
    selectedCardIndex: null,
    hoveredCardIndex:  null,
    isTargeting:       false,
    targetingCard:     null,
    validTargets:      [],
    isRolling:         false,
    rollResult:        null,
    isDragonCutscene:  false,
    isBattleLogVisible:false,
    selectedTile:      null,
  }),
}));