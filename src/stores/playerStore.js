// ============================================================
// src/stores/playerStore.js
// 캐릭터 데이터, 스탯, 인벤토리, 덱, 골드, 경험치 관리
// ============================================================
import { create } from 'zustand';
import {
  CLASS_BASE_STATS,
  CLASS_LEVEL_STAT_GROWTH,
  CLASS_DEFAULT_POSITION,
  CHARACTER_CREATION_FREE_POINTS,
  calcMaxHP,
  calcRequiredExp,
  DP,
  HAND,
  INVENTORY,
  POSITION,
  STATUS,
} from '../constants/constants.js';

// 단일 플레이어 초기 데이터 생성
function createPlayer(id, classType, playerName) {
  const baseStats = { ...CLASS_BASE_STATS[classType] };
  const maxHP = calcMaxHP(baseStats.CON);

  return {
    id,
    name:        playerName,
    classType,
    level:       1,
    exp:         0,

    // ── 스탯 ───────────────────────────────
    stats:       { ...baseStats },
    // 임시 버프/디버프 (전투 중 적용, 전투 종료 시 초기화)
    statModifiers: {
      STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, LUK: 0,
    },
    freePoints:  CHARACTER_CREATION_FREE_POINTS,

    // ── HP ─────────────────────────────────
    maxHP,
    currentHP:   maxHP,
    isDead:      false,
    isSpectating: false,

    // ── AP ─────────────────────────────────
    // 전투 AP = DEX 그대로, 매 턴 초기화
    currentAP:   baseStats.DEX,

    // ── DP (Deterministic Point) ───────────
    maxDP:       DP.DEFAULT_MAX,
    currentDP:   DP.DEFAULT_MAX,

    // ── 포지션 (전투) ──────────────────────
    position:    CLASS_DEFAULT_POSITION[classType],

    // ── 상태이상 ────────────────────────────
    statusEffects: [],
    // [{ type: STATUS.BURN, duration: 2, source: 'enemy' }, ...]

    // ── 장비 슬롯 ───────────────────────────
    equipment: {
      rightHand:  null,
      leftHand:   null,
      head:       null,
      chest:      null,
      pants:      null,
      boots:      null,
      gloves:     null,
      ring:       null,
      necklace:   null,
      cloak:      null,
    },

    // ── 인벤토리 ────────────────────────────
    inventoryCols:  INVENTORY.INIT_COLS,
    inventoryRows:  INVENTORY.INIT_ROWS,
    inventoryItems: [],
    // [{ itemId, col, row, width, height, data }]

    // ── 덱 ─────────────────────────────────
    deck:    [],   // 전체 카드 풀 (장비 귀속)
    hand:    [],   // 현재 핸드 (최대 12장)
    discard: [],   // 묘지
    field:   [],   // 필드 등록된 패시브 카드

    // ── 골드 ───────────────────────────────
    gold: 0,

    // ── 월드맵 위치 ─────────────────────────
    tileX: 12,
    tileY: 12,   // 왕국 성(CASTLE) 시작

    // ── 퀘스트 ─────────────────────────────
    activeQuests: [],
    // [{ questId, type, target, progress, completed }]
  };
}

export const usePlayerStore = create((set, get) => ({
  // ── 플레이어 목록 ─────────────────────────
  players:   [],   // createPlayer()로 생성된 객체 배열
  localPlayerId: null,

  // ── 초기화 ────────────────────────────────
  initPlayers: (playerConfigs) => {
    // playerConfigs: [{ id, classType, name }, ...]
    const players = playerConfigs.map(({ id, classType, name }) =>
      createPlayer(id, classType, name)
    );
    set({ players, localPlayerId: playerConfigs[0]?.id ?? null });
  },

  resetPlayers: () => set({ players: [], localPlayerId: null }),

  // ── 로컬 플레이어 조회 ────────────────────
  getLocalPlayer: () => {
    const { players, localPlayerId } = get();
    return players.find((p) => p.id === localPlayerId) ?? null;
  },

  getPlayer: (id) => get().players.find((p) => p.id === id) ?? null,

  // ── 스탯 자유 포인트 배분 ─────────────────
  allocateStat: (playerId, statKey) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId || p.freePoints <= 0) return p;
      const newStats = { ...p.stats, [statKey]: p.stats[statKey] + 1 };
      const maxHP = calcMaxHP(newStats.CON);
      return {
        ...p,
        stats:      newStats,
        freePoints: p.freePoints - 1,
        maxHP,
        currentHP:  Math.min(p.currentHP, maxHP),
        currentAP:  newStats.DEX,
      };
    }),
  })),

  // ── 레벨업 ────────────────────────────────
  addExp: (playerId, amount) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      let { exp, level, stats, maxHP, currentHP } = p;
      exp += amount;

      // 연속 레벨업 처리
      while (exp >= calcRequiredExp(level)) {
        exp -= calcRequiredExp(level);
        level += 1;
        const growth = CLASS_LEVEL_STAT_GROWTH[p.classType];
        stats = {
          STR: stats.STR + growth.STR,
          DEX: stats.DEX + growth.DEX,
          CON: stats.CON + growth.CON,
          INT: stats.INT + growth.INT,
          WIS: stats.WIS + growth.WIS,
          LUK: stats.LUK + growth.LUK,
        };
        maxHP = calcMaxHP(stats.CON);
        currentHP = maxHP; // 레벨업 시 HP 전량 회복
      }

      return { ...p, exp, level, stats, maxHP, currentHP };
    }),
  })),

  // ── HP 관리 ───────────────────────────────
  healPlayer: (playerId, amount) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        currentHP: Math.min(p.currentHP + amount, p.maxHP),
      }
    ),
  })),

  damagePlayer: (playerId, amount) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const currentHP = Math.max(0, p.currentHP - amount);
      const isDead = currentHP <= 0;
      return { ...p, currentHP, isDead };
    }),
  })),

  revivePlayer: (playerId) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const currentHP = Math.floor(p.maxHP * 0.30); // 30% HP로 부활
      return { ...p, currentHP, isDead: false, isSpectating: false };
    }),
  })),

  setSpectating: (playerId, val) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, isSpectating: val }
    ),
  })),

  // ── AP 관리 ───────────────────────────────
  resetAP: (playerId) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      // AP = DEX + DEX 버프/디버프 합산
      const effectiveDEX = p.stats.DEX + p.statModifiers.DEX;
      return { ...p, currentAP: Math.max(0, effectiveDEX) };
    }),
  })),

  spendAP: (playerId, amount) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        currentAP: Math.max(0, p.currentAP - amount),
      }
    ),
  })),

  // ── DP 관리 ───────────────────────────────
  spendDP: (playerId, amount) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        currentDP: Math.max(0, p.currentDP - amount),
      }
    ),
  })),

  recoverDP: (playerId, amount) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        currentDP: Math.min(p.currentDP + amount, p.maxDP),
      }
    ),
  })),

  upgradeMaxDP: (playerId) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId || p.maxDP >= DP.UPGRADED_MAX) return p;
      return { ...p, maxDP: p.maxDP + 1, currentDP: p.currentDP + 1 };
    }),
  })),

  // ── 포지션 전환 ───────────────────────────
  switchPosition: (playerId) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      return {
        ...p,
        position: p.position === POSITION.FRONT
          ? POSITION.BACK
          : POSITION.FRONT,
      };
    }),
  })),

  // ── 상태이상 관리 ──────────────────────────
  addStatus: (playerId, statusType, duration) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const existing = p.statusEffects.find((s) => s.type === statusType);
      if (existing) {
        // 중첩 시 지속 시간 누적
        return {
          ...p,
          statusEffects: p.statusEffects.map((s) =>
            s.type === statusType
              ? { ...s, duration: s.duration + duration }
              : s
          ),
        };
      }
      return {
        ...p,
        statusEffects: [...p.statusEffects, { type: statusType, duration }],
      };
    }),
  })),

  removeStatus: (playerId, statusType) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        statusEffects: p.statusEffects.filter((s) => s.type !== statusType),
      }
    ),
  })),

  tickStatusEffects: (playerId) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        statusEffects: p.statusEffects
          .map((s) => ({ ...s, duration: s.duration - 1 }))
          .filter((s) => s.duration > 0),
      }
    ),
  })),

  // ── 스탯 버프/디버프 ──────────────────────
  applyStatModifier: (playerId, statKey, amount) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        statModifiers: {
          ...p.statModifiers,
          [statKey]: p.statModifiers[statKey] + amount,
        },
      }
    ),
  })),

  clearStatModifiers: (playerId) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        statModifiers: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, LUK: 0 },
      }
    ),
  })),

  // ── 덱 관리 ───────────────────────────────
  setDeck: (playerId, deck) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, deck }
    ),
  })),

  setHand: (playerId, hand) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, hand }
    ),
  })),

  setDiscard: (playerId, discard) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, discard }
    ),
  })),

  setField: (playerId, field) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, field }
    ),
  })),

  // 전투 종료 시 덱 전체 초기화
  resetCombatCards: (playerId) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      // 덱은 장비 귀속이므로 재구성, hand/discard/field 초기화
      return { ...p, hand: [], discard: [], field: [] };
    }),
  })),

  // ── 장비 관리 ─────────────────────────────
  equipItem: (playerId, slotKey, item) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        equipment: { ...p.equipment, [slotKey]: item },
      }
    ),
  })),

  unequipItem: (playerId, slotKey) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        equipment: { ...p.equipment, [slotKey]: null },
      }
    ),
  })),

  // ── 인벤토리 관리 ─────────────────────────
  addInventoryItem: (playerId, itemEntry) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        inventoryItems: [...p.inventoryItems, itemEntry],
      }
    ),
  })),

  removeInventoryItem: (playerId, itemId) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        inventoryItems: p.inventoryItems.filter((i) => i.itemId !== itemId),
      }
    ),
  })),

  expandInventory: (playerId) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      return {
        ...p,
        inventoryCols: p.inventoryCols + INVENTORY.EXPAND_COLS_PER_UPGRADE,
      };
    }),
  })),

  // ── 골드 관리 ─────────────────────────────
  addGold: (playerId, amount) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, gold: p.gold + amount }
    ),
  })),

  spendGold: (playerId, amount) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId || p.gold < amount) return p;
      return { ...p, gold: p.gold - amount };
    }),
  })),

  // 골드 송금 (같은 타일 or 인접 1칸 조건은 호출부에서 검증)
  transferGold: (fromId, toId, amount) => set((state) => {
    const from = state.players.find((p) => p.id === fromId);
    if (!from || from.gold < amount) return state;
    return {
      players: state.players.map((p) => {
        if (p.id === fromId) return { ...p, gold: p.gold - amount };
        if (p.id === toId)   return { ...p, gold: p.gold + amount };
        return p;
      }),
    };
  }),

  // ── 월드맵 위치 ───────────────────────────
  movePlayer: (playerId, x, y) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, tileX: x, tileY: y }
    ),
  })),

  // ── 퀘스트 관리 ───────────────────────────
  addQuest: (playerId, quest) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        activeQuests: [...p.activeQuests, quest],
      }
    ),
  })),

  updateQuestProgress: (playerId, questId, progress) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        activeQuests: p.activeQuests.map((q) =>
          q.questId !== questId ? q : { ...q, progress }
        ),
      }
    ),
  })),

  failQuest: (playerId, questId) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        // 배달 아이템 제거 + 퀘스트 삭제
        activeQuests: p.activeQuests.filter((q) => q.questId !== questId),
        inventoryItems: p.inventoryItems.filter(
          (i) => i.questId !== questId
        ),
      }
    ),
  })),

  completeQuest: (playerId, questId) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        activeQuests: p.activeQuests.map((q) =>
          q.questId !== questId ? q : { ...q, completed: true }
        ),
      }
    ),
  })),

  // ── 로컬 스토리지 저장/불러오기 ───────────
  saveToLocal: () => {
    const { players, localPlayerId } = get();
    const local = players.find((p) => p.id === localPlayerId);
    if (local) {
      localStorage.setItem(
        `arcana_player_${localPlayerId}`,
        JSON.stringify(local)
      );
    }
  },

  loadFromLocal: (playerId) => {
    const raw = localStorage.getItem(`arcana_player_${playerId}`);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
}));