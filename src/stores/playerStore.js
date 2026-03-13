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

  // ── 아이템 추가 ───────────────────────────
  addItem: (playerId, item) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, inventory: [...(p.inventory ?? []), item] }
    ),
  })),

  // ── DP 최대치 업그레이드 (GDD §21: 5→최대 8) ──
  upgradeDp: (playerId) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        maxDp:          Math.min((p.maxDp ?? 5) + 1, 8),
        inventoryExpanded: (p.inventoryExpanded ?? 0),
      }
    ),
  })),

  // ── 인벤토리 확장 횟수 기록 ────────────────
  // expandInventory는 기존에 있으므로 횟수 카운터만 별도 관리
  incrementInvExpanded: (playerId) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, inventoryExpanded: (p.inventoryExpanded ?? 0) + 1 }
    ),
  })),

  // ── 장비 강화 (GDD §21 대장간) ────────────
  upgradeEquipment: (playerId, slot, forgeTier) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const equip = p.equipment?.[slot];
      if (!equip) return p;
      return {
        ...p,
        equipment: {
          ...p.equipment,
          [slot]: { ...equip, forgeLevel: forgeTier },
        },
      };
    }),
  })),

  // ── 전체 HP·DP 회복 (여관) ─────────────────
  healFull: (playerId) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        currentHp: p.maxHp,
        dp:        p.maxDp ?? 5,
      }
    ),
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

  // ── 전투 전용 메서드 ──────────────────────

  // 전투 시작: 전 플레이어 덱 셔플 + 5장 드로우
  initCombatDecks: () => set((state) => ({
    players: state.players.map((p) => {
      const shuffled = [...p.deck].sort(() => Math.random() - 0.5);
      const hand     = shuffled.slice(0, 5);
      const deck     = shuffled.slice(5);
      return { ...p, deck, hand, discard: [], field: [] };
    }),
  })),

  // 카드 N장 드로우 (덱 소진 시 묘지 셔플 후 재구성)
  drawCards: (playerId, count = 1) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      let deck    = [...p.deck];
      let discard = [...p.discard];
      let hand    = [...p.hand];

      for (let i = 0; i < count; i++) {
        if (deck.length === 0) {
          // 묘지 셔플 → 덱 재구성
          deck    = discard.sort(() => Math.random() - 0.5);
          discard = [];
        }
        if (deck.length > 0) hand.push(deck.shift());
      }
      // 핸드 최대 12장
      if (hand.length > 12) hand = hand.slice(0, 12);
      return { ...p, deck, discard, hand };
    }),
  })),

  // 덱 상위 N장 확인 (Sense 카드)
  peekDeck: (playerId, count = 3) => {
    const p = get().players.find((pl) => pl.id === playerId);
    return p ? p.deck.slice(0, count) : [];
  },

  // HP 데미지 적용
  takeDamage: (playerId, amount) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, hp: Math.max(0, p.hp - amount) }
    ),
  })),

  // 상태이상 적용 (중첩 시 지속 연장)
  applyStatus: (playerId, statusType, duration) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const existing = p.statusEffects.find((s) => s.type === statusType);
      if (existing) {
        return {
          ...p,
          statusEffects: p.statusEffects.map((s) =>
            s.type === statusType ? { ...s, duration: s.duration + duration } : s
          ),
        };
      }
      return { ...p, statusEffects: [...p.statusEffects, { type: statusType, duration }] };
    }),
  })),

  // 임시 스탯 버프 적용 (1주기)
  applyBuff: (playerId, statBuff, durationCycles = 1) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const updated = { ...p.statModifiers };
      for (const [key, val] of Object.entries(statBuff)) {
        updated[key.toUpperCase()] = (updated[key.toUpperCase()] ?? 0) + val;
      }
      return { ...p, statModifiers: updated };
    }),
  })),

  // 패시브 카드 필드 등록
  applyPassive: (playerId, passiveType, data = {}) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        field: [...p.field, { type: passiveType, ...data, id: `${passiveType}_${Date.now()}` }],
      }
    ),
  })),

  // 패시브 만료: field에서 instanceId 항목 제거 → discard로 이동
  // PassiveManager._expirePassive() 에서 호출
  expirePassive: (playerId, instanceId) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const card = p.field.find((c) => c.instanceId === instanceId);
      return {
        ...p,
        field:   p.field.filter((c) => c.instanceId !== instanceId),
        discard: card ? [...p.discard, card] : p.discard,
      };
    }),
  })),

  // 상태이상 틱 (주기 종료 시 전 플레이어 적용)
  tickStatusEffects: () => set((state) => ({
    players: state.players.map((p) => {
      let hp = p.hp;
      // 지속 데미지 처리
      for (const s of p.statusEffects) {
        if (s.type === 'BURN' || s.type === 'POISON') {
          hp = Math.max(0, hp - Math.round(p.maxHp * 0.05));
        }
      }
      return {
        ...p,
        hp,
        statusEffects: p.statusEffects
          .map((s)  => ({ ...s, duration: s.duration - 1 }))
          .filter((s) => s.duration > 0),
      };
    }),
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

  // ── 덱 상태 일괄 갱신 (DeckBuilder 반환값 적용) ──────────────
  // DeckBuilder.initForCombat / draw / resetAfterCombat 결과를 반영
  setDeckState: (playerId, deckState) => set((state) => ({
    players: state.players.map((p) =>
      p.id !== playerId ? p : {
        ...p,
        deck:    deckState.deck    ?? p.deck,
        hand:    deckState.hand    ?? p.hand,
        discard: deckState.discard ?? p.discard,
        field:   deckState.field   ?? p.field,
        currentAP: deckState.currentAP ?? p.currentAP,
      }
    ),
  })),

  // ── 패시브 카드 hand → field 이동 ────────────────────────────
  // DeckBuilder.registerPassive 호출 후 store 반영용
  moveToField: (playerId, instanceId) => set((state) => ({
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const card = p.hand?.find((c) => c.instanceId === instanceId);
      if (!card) return p;
      return {
        ...p,
        hand:  p.hand.filter((c) => c.instanceId !== instanceId),
        field: [...(p.field ?? []), card],
      };
    }),
  })),

  loadFromLocal: (playerId) => {
    const raw = localStorage.getItem(`arcana_player_${playerId}`);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  // ── 동기화 스냅샷 (SyncManager 연동) ──────────────────────────
  getSnapshot: () => {
    return { players: get().players };
  },

  applySnapshot: (snap) => {
    if (!snap?.players) return;
    set({ players: snap.players });
  },
}));