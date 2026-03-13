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
  pendingReturnTo: null,    // 전투 후 복귀할 씬 키
  battleEnemies:   [],     // 현재 전투 적 목록
  battleLog:       [],     // 전투 로그 (최근 20개 유지)

  // ── 던전 상태 ─────────────────────────────
  inDungeon:       false,
  dungeonGraph:    null,   // { nodes, edges, currentNodeId }

  // ── 파티 위치 ─────────────────────────────
  partyPos:        null,   // { x, y } 현재 파티 위치

  // ── 퀘스트 진행도 ─────────────────────────
  questProgress:   {},     // { main_0, main_1, ... } → QUEST_STATUS 값

  // ── 네트워크 ──────────────────────────────
  hostId:          null,   // PeerJS host ID
  isHost:          false,
  localPlayerId:   null,   // 이 클라이언트의 플레이어 ID
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
    pendingReturnTo: null,
    inDungeon:       false,
  }),

  resetGame: () => set(initialState),

  // ── 퀘스트 마일스톤 ───────────────────────
  // questId 지정 시 questProgress[questId] = COMPLETED 도 업데이트
  advanceQuestStage: (questId) => set((state) => {
    const nextStage = Math.min(state.questStage + 1, 4);
    const questProgress = questId
      ? { ...state.questProgress, [questId]: 'COMPLETED' }
      : state.questProgress;
    return { questStage: nextStage, questProgress };
  }),

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

  setPendingReturnTo: (key) => set({ pendingReturnTo: key }),
  clearPendingReturnTo: ()  => set({ pendingReturnTo: null }),

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
  setLocalPlayerId: (id) => set({ localPlayerId: id }),

  // ── 파티 이동 ─────────────────────────────
  moveParty: (pos) => set({ partyPos: pos }),

  // ── 드래곤 이동 (WorldMapScene._runEnemyAIPhase 에서 호출) ──
  moveDragon: (pos) => set({ dragonPos: pos }),

  // ── 월드 턴 진행 (GDD §8.1) ───────────────
  advanceWorldTurn: () => set((state) => {
    const nextIdx = (state.currentPlayerIndex + 1) % state.playerCount;
    return {
      worldTurn:          nextIdx === 0 ? state.worldTurn + 1 : state.worldTurn,
      currentPlayerIndex: nextIdx,
    };
  }),

  // ── 퀘스트 진행도 갱신 ────────────────────
  setQuestProgress: (key, status) => set((state) => ({
    questProgress: { ...state.questProgress, [key]: status },
  })),

  setPlayerCount: (count) => set({ playerCount: count }),

  // SyncManager.broadcastSnapshot() 에서 직렬화
  getSnapshot: () => {
    const s = get();
    return {
      currentScene:  s.currentScene,
      worldTurn:     s.worldTurn,
      playerCount:   s.playerCount,
      inBattle:      s.inBattle,
      inDungeon:     s.inDungeon,
      dragonPos:     s.dragonPos,
      dragonThreat:  s.dragonThreat,
      castlePos:     s.castlePos,
      partyPos:      s.partyPos,
      battleEnemies: s.battleEnemies,
      battleLog:     s.battleLog,
    };
  },

  // STATE_SNAPSHOT 수신 시 클라이언트 스토어 적용
  applySnapshot: (snap) => {
    if (!snap) return;
    set((state) => ({
      currentScene:  snap.currentScene  ?? state.currentScene,
      worldTurn:     snap.worldTurn     ?? state.worldTurn,
      playerCount:   snap.playerCount   ?? state.playerCount,
      inBattle:      snap.inBattle      ?? state.inBattle,
      inDungeon:     snap.inDungeon     ?? state.inDungeon,
      dragonPos:     snap.dragonPos     ?? state.dragonPos,
      dragonThreat:  snap.dragonThreat  ?? state.dragonThreat,
      castlePos:     snap.castlePos     ?? state.castlePos,
      partyPos:      snap.partyPos      ?? state.partyPos,
      battleEnemies: snap.battleEnemies ?? state.battleEnemies,
      battleLog:     snap.battleLog     ?? state.battleLog,
    }));
  },
}));
