// ============================================================
// src/game/data/cards.js
// 장비 귀속 카드 조회 테이블 + 클래스별 빌드 방향 메타데이터
//
// GDD: §9.1(덱=장비귀속) §9.2(슬롯별 카드 타입)
//      §10.3(효과 13종) §24.6(클래스별 빌드 방향성)
//
// 의존:
//   CardEffect.js — getCardForItem, CARD_POOL, EFFECT_TYPE, EQUIP_SLOT
//   items.js      — ALL_ITEMS, STARTER_EQUIPMENT
//
// 역할:
//   - 장비 아이템 ID → 귀속 카드 ID를 확정적으로 제공
//   - CARD_POOL에서 동적 생성된 카드를 장비 단위로 묶어 조회
//   - 클래스별 추천 빌드 메타 정보 제공 (UI 가이드용)
// ============================================================

import { getCardForItem, getCardsForSlot, EFFECT_TYPE, EQUIP_SLOT } from '../deck/CardEffect.js';
import { ALL_ITEMS, STARTER_EQUIPMENT } from './items.js';
// 주의: cards.js ↔ items.js 순환 참조 없음 (items.js는 cards.js를 import하지 않음)

// ================================================================
// 장비 아이템 ID → 귀속 카드 ID 확정 테이블
// items.js의 각 장비 { equipSlot, effectType, element, tier } 로
// CardEffect.getCardForItem() 을 통해 카드 ID를 계산
//
// 런타임에서도 getCardForItem(item) 직접 호출로 동일 결과 얻음.
// 이 테이블은 빠른 조회 캐시 + 디버그 목적.
// ================================================================

function buildEquipCardTable() {
  const table = {};
  for (const [itemId, item] of Object.entries(ALL_ITEMS)) {
    if (!item.equipSlot || !item.effectType) continue;
    const card = getCardForItem(item);
    table[itemId] = card?.id ?? null;
  }
  return table;
}

/** itemId → cardId 조회 테이블 */
export const EQUIP_CARD_TABLE = buildEquipCardTable();

/**
 * 장비 아이템 ID로 귀속 카드 ID 반환
 * @param {string} itemId
 * @returns {string|null}
 */
export function getCardIdForItem(itemId) {
  return EQUIP_CARD_TABLE[itemId] ?? null;
}

// ================================================================
// 클래스별 추천 빌드 방향 (GDD §24.6)
// UI의 빌드 가이드 / 상점 추천 아이템에 활용
// ================================================================
export const CLASS_BUILD_GUIDE = {

  Fighter: {
    // GDD §24.6: 탱커 or 딜러
    builds: [
      {
        name:     '탱커',
        desc:     '헤비 아머 풀셋 + 방패 + 도발 → 방어/반격 패시브 중심',
        coreEffectTypes: [EFFECT_TYPE.GUARD, EFFECT_TYPE.TAUNT, EFFECT_TYPE.COUNTER],
        coreSlots:       [EQUIP_SLOT.WEAPON_L, EQUIP_SLOT.CHEST, EQUIP_SLOT.HELM],
        starterItems:    ['longsword_t1', 'shield_t1', 'heavy_chest_t1'],
      },
      {
        name:     '딜러',
        desc:     '양손검 + 경량 아머 → 공격 카드 집중, 少카드 고확률',
        coreEffectTypes: [EFFECT_TYPE.SLASH, EFFECT_TYPE.EMPOWER, EFFECT_TYPE.PIERCE],
        coreSlots:       [EQUIP_SLOT.WEAPON_R, EQUIP_SLOT.WEAPON_2H],
        starterItems:    ['longsword_t1', 'heavy_chest_t1'],
      },
    ],
    statPriority: ['STR', 'CON', 'DEX'],
  },

  Wizard: {
    builds: [
      {
        name:     '폭딜',
        desc:     '단일 속성 지팡이 → 폭발/집중 집중',
        coreEffectTypes: [EFFECT_TYPE.BURST, EFFECT_TYPE.FOCUS],
        coreSlots:       [EQUIP_SLOT.WEAPON_2H],
        starterItems:    ['staff_fire_t1'],
      },
      {
        name:     '제어',
        desc:     'Ice/Dark 지팡이 → 상태이상 부여 중심',
        coreEffectTypes: [EFFECT_TYPE.FOCUS, EFFECT_TYPE.SENSE],
        coreSlots:       [EQUIP_SLOT.WEAPON_2H, EQUIP_SLOT.HELM],
        starterItems:    ['staff_fire_t1', 'light_robe_t1'],
      },
    ],
    statPriority: ['INT', 'WIS', 'DEX'],
  },

  Rogue: {
    builds: [
      {
        name:     '암살',
        desc:     'Lightning 단검 + DEX 악세사리 → 少카드 선제 고확률',
        coreEffectTypes: [EFFECT_TYPE.PIERCE, EFFECT_TYPE.HASTE],
        coreSlots:       [EQUIP_SLOT.WEAPON_R, EQUIP_SLOT.CLOAK],
        starterItems:    ['dagger_t1', 'travelers_cloak_t1'],
      },
      {
        name:     '함정',
        desc:     '패시브 카드 중심 → 반격/방벽 누적',
        coreEffectTypes: [EFFECT_TYPE.COUNTER, EFFECT_TYPE.BARRIER, EFFECT_TYPE.PIERCE],
        coreSlots:       [EQUIP_SLOT.WEAPON_R, EQUIP_SLOT.NECKLACE],
        starterItems:    ['dagger_t1', 'medium_chest_t1', 'silver_necklace_t1'],
      },
    ],
    statPriority: ['DEX', 'LUK', 'STR'],
  },

  Cleric: {
    builds: [
      {
        name:     '힐러',
        desc:     'WIS 집중 + 성서 → 버프/힐/부활 중심',
        coreEffectTypes: [EFFECT_TYPE.REGEN, EFFECT_TYPE.GUARD, EFFECT_TYPE.EMPOWER],
        coreSlots:       [EQUIP_SLOT.WEAPON_L, EQUIP_SLOT.CHEST],
        starterItems:    ['mace_t1', 'holy_book_t1', 'medium_chest_t1'],
      },
      {
        name:     '전투 사제',
        desc:     'Dark 철퇴 → 공격+힐 균형',
        coreEffectTypes: [EFFECT_TYPE.SLASH, EFFECT_TYPE.REGEN, EFFECT_TYPE.FOCUS],
        coreSlots:       [EQUIP_SLOT.WEAPON_R, EQUIP_SLOT.WEAPON_L],
        starterItems:    ['dark_mace_t2', 'holy_book_t1'],
      },
    ],
    statPriority: ['WIS', 'CON', 'INT'],
  },

  Bard: {
    builds: [
      {
        name:     '버프 특화',
        desc:     'Lightning 류트 + LUK 악세사리 → 팀 버프 극대화',
        coreEffectTypes: [EFFECT_TYPE.HASTE, EFFECT_TYPE.EMPOWER, EFFECT_TYPE.DRAW],
        coreSlots:       [EQUIP_SLOT.WEAPON_2H, EQUIP_SLOT.RING],
        starterItems:    ['lute_t1', 'light_robe_t1', 'iron_ring_t1'],
      },
      {
        name:     '디버프',
        desc:     'Dark 류트 → 상태이상/저주 중심',
        coreEffectTypes: [EFFECT_TYPE.EMPOWER, EFFECT_TYPE.SENSE, EFFECT_TYPE.TAUNT],
        coreSlots:       [EQUIP_SLOT.WEAPON_2H, EQUIP_SLOT.CLOAK],
        starterItems:    ['dark_lute_t2', 'shadow_cloak_t3'],
      },
    ],
    statPriority: ['DEX', 'WIS', 'LUK'],
  },
};

// ================================================================
// 스타터 덱 구성 (신규 게임 — T1 초기 장비 기반)
// DeckBuilder.buildDeckFromEquipment() 에 전달할 아이템 목록 반환
// ================================================================

/**
 * 클래스 스타터 장비 → DeckBuilder용 아이템 배열 반환
 * @param {string} className
 * @returns {object[]}  { id, equipSlot, effectType, element, tier }
 */
export function getStarterItemsForDeck(className) {
  const starterIds = STARTER_EQUIPMENT[className] ?? [];
  return starterIds
    .map((id) => ALL_ITEMS[id])
    .filter(Boolean)
    .map((item) => ({
      id:         item.id,
      equipSlot:  item.equipSlot,
      effectType: item.effectType,
      element:    item.element,
      tier:       item.tier,
    }));
}

// ================================================================
// 효과 타입별 설명 텍스트 (CardUI 툴팁용)
// ================================================================
export const EFFECT_TYPE_DESC = {
  [EFFECT_TYPE.SLASH]:   '단일 물리 데미지 (STR × 1.5 + 티어 보정)',
  [EFFECT_TYPE.PIERCE]:  '단일 물리 데미지 + 방어 30% 무시 (STR × 1.5)',
  [EFFECT_TYPE.BURST]:   '범위 마법 데미지 전체 (INT × 1.5 + 티어 보정)',
  [EFFECT_TYPE.FOCUS]:   '단일 고배율 마법 데미지 (INT × 2.5 + 티어 보정)',
  [EFFECT_TYPE.EMPOWER]: '아군 공격력 1주기 상승 (STR 기반)',
  [EFFECT_TYPE.GUARD]:   '아군 방어력 1주기 상승 (CON 기반)',
  [EFFECT_TYPE.HASTE]:   '아군 DEX 1주기 상승 → AP 증가',
  [EFFECT_TYPE.REGEN]:   '아군 매 주기 최대HP × 5% 회복',
  [EFFECT_TYPE.DRAW]:    '추가 카드 드로우',
  [EFFECT_TYPE.SENSE]:   '덱 상위 N장 확인 후 순서 조정',
  [EFFECT_TYPE.COUNTER]: '피격 시 자동 반격 굴림 [패시브 1회성]',
  [EFFECT_TYPE.BARRIER]: 'N주기 피격 데미지 감소 [패시브 지속]',
  [EFFECT_TYPE.TAUNT]:   'N주기 적 타겟팅을 자신에게 집중 [패시브 지속]',
};

// 티어 보정 수치 (GDD §10.3)
export const TIER_BONUS = { 1: 5, 2: 10, 3: 15 };