// ============================================================
// src/stores/gameStore.js
// 게임 상태, 월드 턴, 드래곤 위치, 마일스톤 관리
// ============================================================
import { create } from 'zustand';
import {
  TILE,
  WORLD,
  DRAGON_DIFFICULTY,
  SOLO_SCALING,
} from '../constants/constants.js';

const initialState = {
  // ── 게임 세션 ──────────────────────────────
  isGameStarted:   false,
  isGameOver:      false,
  gameOverReason:  null,   // 'ALL_DEAD' | 'DRAGON_REACHED_CASTLE'
  playerCount:     1,

  // ── 마일스톤 (메인 퀘스트 진행도) ────────────
  // 0: 미진행 / 1: 와이번 처치 / 2: 유물 3개 / 3: 봉인해제 / 4: 결전
  questStage:      0,
  artifactsFound:  [],     // 수집한 유물 ID 배열 (최대 3)

  // ── 월드 턴 ───────────────────────────────
  worldTurn:       0,
  currentPlayerIndex: 0,  // 현재 행동 중인 플레이어 인덱스 (입장 순서)
  isEnemyAITurn:   false,

  // ── 월드맵 ────────────────────────────────
  worldMap:        null,   // HexGrid 생성 후 채워짐
  castlePos:       null,   // { x, y } — WorldGenerator 런타임 결정
  dragonSpawn:     null,   // { x, y } — Dragon Nest 내 BOSS 타일 위치 = 드래곤 초기 스폰
  // 몬스터 유닛 목록 (월드맵 위)
  worldUnits:      [],     // [{ id, type, tileX, tileY, stats, ... }]

  // ── 레드 드래곤 ───────────────────────────
  dragonPos:       null,   // { x, y } 현재 위치 (초기값 = dragonSpawn)
  dragonTarget:    null,   // { x, y } 현재 목표 타일
  dragonAlive:     true,
  // 소각된 마을 타일 좌표 목록
  burnedVillages:  [],     // [{ x, y }]

  // ── 전투 상태 ─────────────────────────────
  inBattle:        false,
  battleEnemies:   [],     // 현재 전투 적 목록
  battleLog:       [],     // 전투 로그 (최근 20개 유지)

  // ── 던전 상태 ─────────────────────────────
  inDungeon:       false,
  dungeonGraph:    null,   // { nodes, edges, currentNodeId }

  // ── 네트워크 ──────────────────────────────
  hostId:          null,   // PeerJS host ID
  isHost:          false,
};

export const useGameStore = create((set, get) => ({
  ...initialState,

  // ── 게임 시작 / 종료 ───────────────────────
  startGame: (playerCount, worldMap, castlePos, dragonSpawn) => set({
    isGameStarted:      true,
    isGameOver:         false,
    gameOverReason:     null,
    playerCount,
    worldMap,
    castlePos,
    dragonSpawn,
    worldTurn:          0,
    currentPlayerIndex: 0,
    questStage:         0,
    artifactsFound:     [],
    burnedVillages:     [],
    dragonAlive:        true,
    dragonPos:          dragonSpawn,  // 드래곤 초기 위치 = BOSS 타일
    dragonTarget:       null,
  }),

  triggerGameOver: (reason) => set({
    isGameOver:      true,
    gameOverReason:  reason,
    inBattle:        false,
    inDungeon:       false,
  }),

  resetGame: () => set(initialState),

  // ── 퀘스트 마일스톤 ───────────────────────
  advanceQuestStage: () => set((state) => ({
    questStage: Math.min(state.questStage + 1, 4),
  })),

  addArtifact: (artifactId) => set((state) => {
    const next = [...new Set([...state.artifactsFound, artifactId])];
    // 유물 3개 수집 시 자동으로 2단계 완료
    const questStage = next.length >= 3
      ? Math.max(state.questStage, 2)
      : state.questStage;
    return { artifactsFound: next, questStage };
  }),

  // ── 드래곤 난이도 배율 조회 ────────────────
  getDragonDifficulty: () => {
    const stage = get().questStage;
    return DRAGON_DIFFICULTY[`STAGE_${stage}`];
  },

  // ── 솔로 스케일링 배율 조회 ────────────────
  getScaling: () => SOLO_SCALING[get().playerCount] ?? 1.0,

  // ── 월드 턴 진행 ──────────────────────────
  nextPlayerTurn: () => set((state) => ({
    currentPlayerIndex:
      (state.currentPlayerIndex + 1) % state.playerCount,
    worldTurn: state.currentPlayerIndex === state.playerCount - 1
      ? state.worldTurn + 1
      : state.worldTurn,
  })),

  setEnemyAITurn: (val) => set({ isEnemyAITurn: val }),

  // ── 월드 유닛 ─────────────────────────────
  setWorldUnits: (units) => set({ worldUnits: units }),

  updateWorldUnit: (id, patch) => set((state) => ({
    worldUnits: state.worldUnits.map((u) =>
      u.id === id ? { ...u, ...patch } : u
    ),
  })),

  removeWorldUnit: (id) => set((state) => ({
    worldUnits: state.worldUnits.filter((u) => u.id !== id),
  })),

  // ── 드래곤 이동 ───────────────────────────
  setDragonPos: (pos) => set({ dragonPos: pos }),
  setDragonTarget: (pos) => set({ dragonTarget: pos }),
  setDragonAlive: (val) => set({ dragonAlive: val }),

  // 마을 소각 처리
  burnVillage: (x, y) => set((state) => ({
    burnedVillages: [...state.burnedVillages, { x, y }],
    worldMap: state.worldMap
      ? {
          ...state.worldMap,
          tiles: state.worldMap.tiles.map((tile) =>
            tile.x === x && tile.y === y
              ? { ...tile, type: TILE.VILLAGE_BURNED }
              : tile
          ),
        }
      : state.worldMap,
  })),

  isVillageBurned: (x, y) =>
    get().burnedVillages.some((v) => v.x === x && v.y === y),

  // ── 전투 ──────────────────────────────────
  enterBattle: (enemies) => set({
    inBattle:      true,
    battleEnemies: enemies,
    battleLog:     [],
  }),

  exitBattle: () => set({
    inBattle:      false,
    battleEnemies: [],
  }),

  updateBattleEnemy: (id, patch) => set((state) => ({
    battleEnemies: state.battleEnemies.map((e) =>
      e.id === id ? { ...e, ...patch } : e
    ),
  })),

  removeBattleEnemy: (id) => set((state) => ({
    battleEnemies: state.battleEnemies.filter((e) => e.id !== id),
  })),

  addBattleLog: (msg) => set((state) => ({
    battleLog: [...state.battleLog.slice(-19), msg],
  })),

  // ── 던전 ──────────────────────────────────
  enterDungeon: (dungeonGraph) => set({
    inDungeon:    true,
    dungeonGraph,
  }),

  exitDungeon: () => set({
    inDungeon:    false,
    dungeonGraph: null,
  }),

  moveDungeonNode: (nodeId) => set((state) => ({
    dungeonGraph: state.dungeonGraph
      ? { ...state.dungeonGraph, currentNodeId: nodeId }
      : null,
  })),

  // ── 네트워크 ──────────────────────────────
  setHostInfo: (hostId, isHost) => set({ hostId, isHost }),
}));