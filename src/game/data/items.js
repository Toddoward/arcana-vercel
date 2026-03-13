// ============================================================
// src/game/data/items.js
// 장비 / 소모품 아이템 데이터
//
// GDD: §7.2(아이템 점유 크기) §23(소모품 6종)
//      §24.1(장비 티어) §24.2(무기 8종) §24.3(방어구 5슬롯×3계열)
//      §24.4(악세사리 3슬롯)
//
// 의존:
//   CardEffect.js — EQUIP_SLOT, EFFECT_TYPE, ELEMENT.*
//   constants.js  — ELEMENT
//
// 아이템 구조:
// {
//   id:          string
//   name:        string
//   icon:        string
//   type:        'weapon'|'armor'|'accessory'|'consumable'
//   equipSlot:   EQUIP_SLOT.* | null
//   tier:        1|2|3 | null (소모품)
//   size:        'small'|'medium'|'large'|'xlarge'  (GDD §7.2)
//   classReq:    string[] | null  (null=공용)
//   element:     ELEMENT.* | null
//   effectType:  EFFECT_TYPE.*  (귀속 카드 결정)
//   basePrice:   number  (골드, GDD §22.3)
//   description: string
//   // 소모품 전용
//   consumeEffect: object | null
// }
// ============================================================

import { EQUIP_SLOT, EFFECT_TYPE } from '../battle/CardEffect.js';
import { ELEMENT, STATUS } from '../../constants/constants.js';

// ── 아이템 점유 크기 (GDD §7.2) ─────────────────────────────
// small: 1~2칸, medium: 2~4칸, large: 4~6칸, xlarge: 6~8칸
// GridCell 계산: ITEM_SIZE_COLS × ITEM_SIZE_ROWS

export const ITEM_SIZE = {
  SMALL:  'small',
  MEDIUM: 'medium',
  LARGE:  'large',
  XLARGE: 'xlarge',
};

// ================================================================
// 무기 (GDD §24.2 — 8종)
// ================================================================
export const WEAPONS = {

  // 한손검 — Fighter, SLASH, Fire/Ice (GDD §24.2)
  longsword_t1: {
    id: 'longsword_t1', name: '롱소드', icon: '⚔️',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_R,
    tier: 1, size: ITEM_SIZE.LARGE,
    classReq: ['Fighter'], element: ELEMENT.FIRE,
    effectType: EFFECT_TYPE.SLASH,
    basePrice: 80,
    description: '화염이 깃든 한손검. STR 기반 베기 공격.',
  },
  longsword_ice_t2: {
    id: 'longsword_ice_t2', name: '서리 롱소드', icon: '🗡️',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_R,
    tier: 2, size: ITEM_SIZE.LARGE,
    classReq: ['Fighter'], element: ELEMENT.ICE,
    effectType: EFFECT_TYPE.SLASH,
    basePrice: 200,
    description: '빙기가 서린 한손검. 강화된 베기 + 빙결 확률.',
  },

  // 방패 — Fighter, GUARD, Ice/Dark
  shield_t1: {
    id: 'shield_t1', name: '철 방패', icon: '🛡️',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_L,
    tier: 1, size: ITEM_SIZE.LARGE,
    classReq: ['Fighter'], element: ELEMENT.ICE,
    effectType: EFFECT_TYPE.GUARD,
    basePrice: 60,
    description: '냉기가 스며든 방패. 방어력 버프.',
  },
  dark_shield_t2: {
    id: 'dark_shield_t2', name: '암흑 방패', icon: '🖤',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_L,
    tier: 2, size: ITEM_SIZE.LARGE,
    classReq: ['Fighter'], element: ELEMENT.DARK,
    effectType: EFFECT_TYPE.GUARD,
    basePrice: 180,
    description: '암흑 에너지가 깃든 방패. 방어 + HP 흡수.',
  },

  // 단검 — Rogue, PIERCE, Lightning
  dagger_t1: {
    id: 'dagger_t1', name: '단검', icon: '🗡️',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_R,
    tier: 1, size: ITEM_SIZE.MEDIUM,
    classReq: ['Rogue'], element: ELEMENT.LIGHTNING,
    effectType: EFFECT_TYPE.PIERCE,
    basePrice: 70,
    description: '번개가 깃든 단검. 방어 관통 공격.',
  },
  shadow_dagger_t3: {
    id: 'shadow_dagger_t3', name: '그림자 단검', icon: '💨',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_R,
    tier: 3, size: ITEM_SIZE.MEDIUM,
    classReq: ['Rogue'], element: ELEMENT.LIGHTNING,
    effectType: EFFECT_TYPE.PIERCE,
    basePrice: 500,
    description: '전설의 그림자 단검. 극강 관통 + 감전.',
  },

  // 활 — Rogue, PIERCE, Lightning/Fire (양손)
  bow_t1: {
    id: 'bow_t1', name: '단궁', icon: '🏹',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_2H,
    tier: 1, size: ITEM_SIZE.LARGE,
    classReq: ['Rogue'], element: ELEMENT.LIGHTNING,
    effectType: EFFECT_TYPE.PIERCE,
    basePrice: 90,
    description: '번개 깃든 활. 원거리 관통 공격 (양손).',
  },
  fire_bow_t2: {
    id: 'fire_bow_t2', name: '화염 장궁', icon: '🔥',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_2H,
    tier: 2, size: ITEM_SIZE.LARGE,
    classReq: ['Rogue'], element: ELEMENT.FIRE,
    effectType: EFFECT_TYPE.PIERCE,
    basePrice: 220,
    description: '화염을 쏘는 장궁. 관통 + 화상 확률.',
  },

  // 지팡이 — Wizard, BURST/FOCUS, 전 속성 (양손)
  staff_fire_t1: {
    id: 'staff_fire_t1', name: '화염 지팡이', icon: '🔮',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_2H,
    tier: 1, size: ITEM_SIZE.LARGE,
    classReq: ['Wizard'], element: ELEMENT.FIRE,
    effectType: EFFECT_TYPE.BURST,
    basePrice: 100,
    description: '화염 마법 지팡이. INT 기반 범위 폭발.',
  },
  staff_ice_t2: {
    id: 'staff_ice_t2', name: '빙하 지팡이', icon: '❄️',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_2H,
    tier: 2, size: ITEM_SIZE.LARGE,
    classReq: ['Wizard'], element: ELEMENT.ICE,
    effectType: EFFECT_TYPE.FOCUS,
    basePrice: 240,
    description: '빙결 집중 지팡이. 단일 고배율 냉기 공격.',
  },
  staff_dark_t3: {
    id: 'staff_dark_t3', name: '공허의 지팡이', icon: '🌑',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_2H,
    tier: 3, size: ITEM_SIZE.LARGE,
    classReq: ['Wizard'], element: ELEMENT.DARK,
    effectType: EFFECT_TYPE.FOCUS,
    basePrice: 550,
    description: '공허에서 온 전설 지팡이. 최고 배율 암흑 집중.',
  },

  // 성서 — Cleric, REGEN, Ice/Dark (보조)
  holy_book_t1: {
    id: 'holy_book_t1', name: '성서', icon: '📖',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_L,
    tier: 1, size: ITEM_SIZE.MEDIUM,
    classReq: ['Cleric'], element: ELEMENT.ICE,
    effectType: EFFECT_TYPE.REGEN,
    basePrice: 75,
    description: '신성한 서적. HP 재생 버프.',
  },

  // 철퇴 — Cleric/Fighter, SLASH, Fire/Dark (한손)
  mace_t1: {
    id: 'mace_t1', name: '철퇴', icon: '🔨',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_R,
    tier: 1, size: ITEM_SIZE.LARGE,
    classReq: ['Cleric', 'Fighter'], element: ELEMENT.FIRE,
    effectType: EFFECT_TYPE.SLASH,
    basePrice: 70,
    description: '화염이 깃든 철퇴.',
  },
  dark_mace_t2: {
    id: 'dark_mace_t2', name: '암흑 철퇴', icon: '💀',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_R,
    tier: 2, size: ITEM_SIZE.LARGE,
    classReq: ['Cleric', 'Fighter'], element: ELEMENT.DARK,
    effectType: EFFECT_TYPE.FOCUS,
    basePrice: 190,
    description: '암흑 에너지의 철퇴. 공격 + 저주 확률.',
  },

  // 류트 — Bard, HASTE/EMPOWER, Lightning/Dark (양손)
  lute_t1: {
    id: 'lute_t1', name: '류트', icon: '🎵',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_2H,
    tier: 1, size: ITEM_SIZE.LARGE,
    classReq: ['Bard'], element: ELEMENT.LIGHTNING,
    effectType: EFFECT_TYPE.HASTE,
    basePrice: 80,
    description: '번개 선율 류트. 아군 DEX 버프.',
  },
  dark_lute_t2: {
    id: 'dark_lute_t2', name: '어둠의 류트', icon: '🎸',
    type: 'weapon', equipSlot: EQUIP_SLOT.WEAPON_2H,
    tier: 2, size: ITEM_SIZE.LARGE,
    classReq: ['Bard'], element: ELEMENT.DARK,
    effectType: EFFECT_TYPE.EMPOWER,
    basePrice: 210,
    description: '암흑 공명 류트. 아군 공격력 + HP 흡수.',
  },
};

// ================================================================
// 방어구 (GDD §24.3 — 5슬롯 × 3계열)
// ================================================================
export const ARMORS = {

  // ── 헤비 아머 (Fighter) ───────────────────────────────────
  heavy_helm_t1: {
    id: 'heavy_helm_t1', name: '철 투구', icon: '⛑️',
    type: 'armor', equipSlot: EQUIP_SLOT.HELM,
    tier: 1, size: ITEM_SIZE.MEDIUM,
    classReq: ['Fighter'], element: null,
    effectType: EFFECT_TYPE.GUARD,
    basePrice: 50,
    description: '두터운 철 투구. 방어 버프.',
  },
  heavy_chest_t1: {
    id: 'heavy_chest_t1', name: '판금 흉갑', icon: '🦺',
    type: 'armor', equipSlot: EQUIP_SLOT.CHEST,
    tier: 1, size: ITEM_SIZE.XLARGE,
    classReq: ['Fighter'], element: null,
    effectType: EFFECT_TYPE.GUARD,
    basePrice: 100,
    description: '묵직한 판금 흉갑. 강력한 방어 버프.',
  },
  heavy_boots_t1: {
    id: 'heavy_boots_t1', name: '철제 장화', icon: '👢',
    type: 'armor', equipSlot: EQUIP_SLOT.BOOTS,
    tier: 1, size: ITEM_SIZE.MEDIUM,
    classReq: ['Fighter'], element: null,
    effectType: EFFECT_TYPE.GUARD,
    basePrice: 45,
    description: '단단한 철제 장화.',
  },
  heavy_gloves_t1: {
    id: 'heavy_gloves_t1', name: '철제 건틀릿', icon: '🥊',
    type: 'armor', equipSlot: EQUIP_SLOT.GLOVES,
    tier: 1, size: ITEM_SIZE.MEDIUM,
    classReq: ['Fighter'], element: null,
    effectType: EFFECT_TYPE.EMPOWER,
    basePrice: 45,
    description: '공격력 보강 건틀릿.',
  },
  heavy_pants_t1: {
    id: 'heavy_pants_t1', name: '판금 각반', icon: '🩲',
    type: 'armor', equipSlot: EQUIP_SLOT.PANTS,
    tier: 1, size: ITEM_SIZE.LARGE,
    classReq: ['Fighter'], element: null,
    effectType: EFFECT_TYPE.GUARD,
    basePrice: 60,
    description: '판금 각반. 방어 버프.',
  },

  // ── 미디엄 아머 (Cleric/Rogue) ───────────────────────────
  medium_helm_t1: {
    id: 'medium_helm_t1', name: '가죽 모자', icon: '🎩',
    type: 'armor', equipSlot: EQUIP_SLOT.HELM,
    tier: 1, size: ITEM_SIZE.MEDIUM,
    classReq: ['Cleric', 'Rogue'], element: null,
    effectType: EFFECT_TYPE.SENSE,
    basePrice: 40,
    description: '가죽 모자. 감각 행동 카드.',
  },
  medium_chest_t1: {
    id: 'medium_chest_t1', name: '가죽 갑옷', icon: '🥋',
    type: 'armor', equipSlot: EQUIP_SLOT.CHEST,
    tier: 1, size: ITEM_SIZE.LARGE,
    classReq: ['Cleric', 'Rogue'], element: null,
    effectType: EFFECT_TYPE.REGEN,
    basePrice: 75,
    description: '가죽 갑옷. 재생 버프.',
  },

  // ── 라이트 아머 (Wizard/Bard) ────────────────────────────
  light_robe_t1: {
    id: 'light_robe_t1', name: '마법사 로브', icon: '👘',
    type: 'armor', equipSlot: EQUIP_SLOT.CHEST,
    tier: 1, size: ITEM_SIZE.LARGE,
    classReq: ['Wizard', 'Bard'], element: null,
    effectType: EFFECT_TYPE.DRAW,
    basePrice: 65,
    description: '마법사 로브. 드로우 카드.',
  },
  light_boots_t1: {
    id: 'light_boots_t1', name: '경량 부츠', icon: '👟',
    type: 'armor', equipSlot: EQUIP_SLOT.BOOTS,
    tier: 1, size: ITEM_SIZE.MEDIUM,
    classReq: ['Wizard', 'Bard'], element: null,
    effectType: EFFECT_TYPE.HASTE,
    basePrice: 40,
    description: '바람처럼 가벼운 부츠. DEX 버프.',
  },
};

// ================================================================
// 악세사리 (GDD §24.4 — 3슬롯)
// ================================================================
export const ACCESSORIES = {

  // 반지 — 스탯 수치 직접 보정
  iron_ring_t1: {
    id: 'iron_ring_t1', name: '철 반지', icon: '💍',
    type: 'accessory', equipSlot: EQUIP_SLOT.RING,
    tier: 1, size: ITEM_SIZE.SMALL,
    classReq: null, element: null,
    effectType: EFFECT_TYPE.EMPOWER,
    basePrice: 40,
    description: '공격력을 높여주는 철 반지.',
  },
  ruby_ring_t2: {
    id: 'ruby_ring_t2', name: '루비 반지', icon: '❤️',
    type: 'accessory', equipSlot: EQUIP_SLOT.RING,
    tier: 2, size: ITEM_SIZE.SMALL,
    classReq: null, element: ELEMENT.FIRE,
    effectType: EFFECT_TYPE.REGEN,
    basePrice: 150,
    description: '화염 속성 루비 반지. HP 재생.',
  },

  // 목걸이 — 상태이상 저항 / 굴림 확률 보정
  silver_necklace_t1: {
    id: 'silver_necklace_t1', name: '은 목걸이', icon: '📿',
    type: 'accessory', equipSlot: EQUIP_SLOT.NECKLACE,
    tier: 1, size: ITEM_SIZE.SMALL,
    classReq: null, element: null,
    effectType: EFFECT_TYPE.COUNTER,
    basePrice: 50,
    description: '은 목걸이. 반격 패시브 카드.',
  },
  amulet_of_warding_t2: {
    id: 'amulet_of_warding_t2', name: '수호 부적', icon: '🔱',
    type: 'accessory', equipSlot: EQUIP_SLOT.NECKLACE,
    tier: 2, size: ITEM_SIZE.SMALL,
    classReq: null, element: ELEMENT.ICE,
    effectType: EFFECT_TYPE.BARRIER,
    basePrice: 160,
    description: '상태이상을 막아주는 수호 부적. 방벽 패시브.',
  },

  // 망토 — AP / DP 보정
  travelers_cloak_t1: {
    id: 'travelers_cloak_t1', name: '여행자 망토', icon: '🧥',
    type: 'accessory', equipSlot: EQUIP_SLOT.CLOAK,
    tier: 1, size: ITEM_SIZE.LARGE,
    classReq: null, element: null,
    effectType: EFFECT_TYPE.HASTE,
    basePrice: 55,
    description: '가벼운 여행자 망토. DEX 버프 → AP 증가.',
  },
  shadow_cloak_t3: {
    id: 'shadow_cloak_t3', name: '그림자 망토', icon: '🌑',
    type: 'accessory', equipSlot: EQUIP_SLOT.CLOAK,
    tier: 3, size: ITEM_SIZE.LARGE,
    classReq: null, element: ELEMENT.DARK,
    effectType: EFFECT_TYPE.TAUNT,
    basePrice: 480,
    description: '그림자 속에 숨는 망토. 도발 패시브로 피격 집중.',
  },
};

// ================================================================
// 소모품 (GDD §23 — 6종)
// ================================================================
export const CONSUMABLES = {

  potion_small: {
    id: 'potion_small', name: '포션 (소)', icon: '🧪',
    type: 'consumable', equipSlot: null,
    tier: null, size: ITEM_SIZE.SMALL,
    classReq: null, element: null, effectType: null,
    basePrice: 20,
    description: 'HP 소량 회복. 전투 중/외 사용 가능.',
    consumeEffect: { type: 'HEAL', amount: 30 },
  },

  potion_large: {
    id: 'potion_large', name: '포션 (대)', icon: '🍶',
    type: 'consumable', equipSlot: null,
    tier: null, size: ITEM_SIZE.SMALL,
    classReq: null, element: null, effectType: null,
    basePrice: 60,
    description: 'HP 대량 회복.',
    consumeEffect: { type: 'HEAL', amount: 80 },
  },

  dp_crystal: {
    id: 'dp_crystal', name: 'DP 크리스탈', icon: '💎',
    type: 'consumable', equipSlot: null,
    tier: null, size: ITEM_SIZE.SMALL,
    classReq: null, element: null, effectType: null,
    basePrice: 50,
    description: 'DP 전량 회복 (GDD §12.3).',
    consumeEffect: { type: 'RESTORE_DP_FULL' },
  },

  antidote: {
    id: 'antidote', name: '해독제', icon: '🫙',
    type: 'consumable', equipSlot: null,
    tier: null, size: ITEM_SIZE.SMALL,
    classReq: null, element: null, effectType: null,
    basePrice: 30,
    description: '상태이상 1개 즉시 해제.',
    consumeEffect: { type: 'CLEANSE_STATUS', count: 1 },
  },

  revival_scroll: {
    id: 'revival_scroll', name: '부활 스크롤', icon: '📜',
    type: 'consumable', equipSlot: null,
    tier: null, size: ITEM_SIZE.SMALL,
    classReq: null, element: null, effectType: null,
    basePrice: 150,
    description: '사망한 파티원 1명 부활 (HP 30%).',
    consumeEffect: { type: 'REVIVE', hpRatio: 0.3 },
  },

  teleport_scroll: {
    id: 'teleport_scroll', name: '텔레포트 스크롤', icon: '🌀',
    type: 'consumable', equipSlot: null,
    tier: null, size: ITEM_SIZE.SMALL,
    classReq: null, element: null, effectType: null,
    basePrice: 100,
    description: '월드맵 임의 타일로 즉시 이동.',
    consumeEffect: { type: 'TELEPORT_RANDOM' },
  },
};

// ================================================================
// 전체 아이템 맵 (ID → 아이템)
// ================================================================
export const ALL_ITEMS = {
  ...WEAPONS,
  ...ARMORS,
  ...ACCESSORIES,
  ...CONSUMABLES,
};

/** ID로 아이템 조회 */
export function getItemById(id) {
  return ALL_ITEMS[id] ?? null;
}

/** 특정 클래스가 착용 가능한 장비 목록 */
export function getItemsForClass(className, tier = null) {
  return Object.values(ALL_ITEMS).filter((item) => {
    if (item.type === 'consumable') return false;
    if (item.classReq && !item.classReq.includes(className)) return false;
    if (tier !== null && item.tier !== tier) return false;
    return true;
  });
}

/** 초기 장비 세트 (GDD §24.1 T1 획득처: 초기 장비) */
export const STARTER_EQUIPMENT = {
  Fighter: ['longsword_t1', 'shield_t1', 'heavy_chest_t1', 'heavy_boots_t1'],
  Wizard:  ['staff_fire_t1', 'light_robe_t1', 'light_boots_t1'],
  Rogue:   ['dagger_t1', 'medium_chest_t1', 'travelers_cloak_t1'],
  Cleric:  ['mace_t1', 'holy_book_t1', 'medium_chest_t1'],
  Bard:    ['lute_t1', 'light_robe_t1', 'travelers_cloak_t1'],
};
