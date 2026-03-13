// ============================================================
// src/game/deck/CardEffect.js
// 카드 효과 타입 정의 & 장비 슬롯 귀속 카드 풀
//
// GDD: §9.1(덱=장비귀속) §9.2(슬롯별 카드타입) §10.2(AP코스트)
//      §10.3(효과타입 13종) §5.2(속성상성)
//
// 의존:
//   constants.js — ELEMENT, STATUS, CARD_COST, CARD_DAMAGE
//
// 핵심 설계 원칙 (변경 금지):
//   카드는 장비에 귀속됨. 레벨업 드래프트 방식 아님.
//   무기 슬롯 → 공격 카드 (SLASH/PIERCE/BURST/FOCUS)
//   방어구/악세 슬롯 → 버프+행동+패시브 카드
// ============================================================

import {
  ELEMENT,
  CARD_COST,
  CLASS,
} from '../../constants/constants.js';

// ── 효과 타입 13종 (GDD §10.3) ────────────────────────────────
export const EFFECT_TYPE = {
  // 공격 (4종)
  SLASH:   'SLASH',   // 단일 물리, STR×1.5 + tier
  PIERCE:  'PIERCE',  // 단일 물리 + 방어 30% 무시
  BURST:   'BURST',   // 범위 마법, INT×1.5 + tier (전체)
  FOCUS:   'FOCUS',   // 단일 고배율 마법, INT×2.5 + tier

  // 버프 (4종)
  EMPOWER: 'EMPOWER', // 아군 공격력 1주기 상승
  GUARD:   'GUARD',   // 아군 방어력 1주기 상승
  HASTE:   'HASTE',   // 아군 DEX 1주기 상승
  REGEN:   'REGEN',   // 아군 매 주기 최대HP×5% 회복

  // 행동 (2종)
  DRAW:    'DRAW',    // 추가 드로우
  SENSE:   'SENSE',   // 덱 상위 N장 확인 후 순서 조정

  // 패시브 (3종)
  COUNTER: 'COUNTER', // 피격 시 자동 반격 굴림 (1회성)
  BARRIER: 'BARRIER', // N주기 피격 데미지 감소 (지속성)
  TAUNT:   'TAUNT',   // N주기 적 타겟팅 자신에게 집중 (지속성)
};

// ── 카드 분류 (액티브/패시브) ──────────────────────────────────
export const CARD_CATEGORY = {
  ACTIVE:  'ACTIVE',  // 내 턴 즉발
  PASSIVE: 'PASSIVE', // 필드 등록 → 조건 충족 시 자동 발동
};

// 패시브 카드 지속 방식
export const PASSIVE_MODE = {
  ONE_SHOT:   'ONE_SHOT',   // 발동 즉시 Discard
  PERSISTENT: 'PERSISTENT', // duration 주기 반복 후 Discard
};

// 장비 슬롯 정의 (GDD §9.2)
export const EQUIP_SLOT = {
  WEAPON_R:  'WEAPON_R',  // 오른손 무기
  WEAPON_L:  'WEAPON_L',  // 왼손 무기
  WEAPON_2H: 'WEAPON_2H', // 양손 무기 (오른손+왼손 점유)
  OFFHAND:   'OFFHAND',   // 보조 장비
  HELM:      'HELM',
  CHEST:     'CHEST',
  PANTS:     'PANTS',
  BOOTS:     'BOOTS',
  GLOVES:    'GLOVES',
  RING:      'RING',
  NECKLACE:  'NECKLACE',
  CLOAK:     'CLOAK',
};

// 슬롯 → 카드 분류 매핑 (GDD §9.2)
export const SLOT_CARD_CATEGORY = {
  [EQUIP_SLOT.WEAPON_R]:  'ATTACK',
  [EQUIP_SLOT.WEAPON_L]:  'ATTACK',
  [EQUIP_SLOT.WEAPON_2H]: 'ATTACK',
  [EQUIP_SLOT.OFFHAND]:   'ATTACK',
  [EQUIP_SLOT.HELM]:      'BUFF_ACTION_PASSIVE',
  [EQUIP_SLOT.CHEST]:     'BUFF_ACTION_PASSIVE',
  [EQUIP_SLOT.PANTS]:     'BUFF_ACTION_PASSIVE',
  [EQUIP_SLOT.BOOTS]:     'BUFF_ACTION_PASSIVE',
  [EQUIP_SLOT.GLOVES]:    'BUFF_ACTION_PASSIVE',
  [EQUIP_SLOT.RING]:      'BUFF_ACTION_PASSIVE',
  [EQUIP_SLOT.NECKLACE]:  'BUFF_ACTION_PASSIVE',
  [EQUIP_SLOT.CLOAK]:     'BUFF_ACTION_PASSIVE',
};

// ================================================================
// 카드 데이터 구조
// {
//   id:         string    — 고유 식별자 (equipId_effectType_element_tier)
//   name:       string    — 표시 이름
//   effectType: EFFECT_TYPE.*
//   category:   CARD_CATEGORY.*
//   passiveMode: PASSIVE_MODE.* | null  — 패시브 카드만
//   apCost:     number    — GDD §10.2
//   stat:       'STR'|'DEX'|'INT'|'WIS'|'LUK'|null
//   element:    ELEMENT.* | null
//   tier:       1|2|3
//   equipSlot:  EQUIP_SLOT.*  — 귀속된 장비 슬롯
//   classReq:   CLASS.* | null  — 클래스 제한 (null=공용)
// }
// ================================================================

// ── 카드 팩토리 헬퍼 ──────────────────────────────────────────
function makeCard(base, overrides = {}) {
  return Object.freeze({ ...base, ...overrides });
}

// ── 공격 카드 생성기 ──────────────────────────────────────────
function attackCard({ equipSlot, effectType, element, tier, classReq = null }) {
  const tierName = tier === 1 ? 'T1' : tier === 2 ? 'T2' : 'T3';
  const elemName = element ?? 'NEUTRAL';
  const id       = `${equipSlot}_${effectType}_${elemName}_${tierName}`;

  // AP 코스트: Slash/Pierce = 2AP, Focus = 3AP, Burst = 3AP (GDD §10.2)
  const apCost = (effectType === 'FOCUS' || effectType === 'BURST') ? 3 : 2;

  // 공격 스탯: Slash/Pierce = STR, Burst/Focus = INT
  const stat = (effectType === 'BURST' || effectType === 'FOCUS') ? 'INT' : 'STR';

  const names = {
    SLASH:  { NEUTRAL:'베기', FIRE:'화염 베기', ICE:'냉기 베기', LIGHTNING:'번개 베기', DARK:'암흑 베기' },
    PIERCE: { NEUTRAL:'관통', FIRE:'화염 관통', ICE:'냉기 관통', LIGHTNING:'번개 관통', DARK:'암흑 관통' },
    BURST:  { NEUTRAL:'폭발', FIRE:'화염 폭발', ICE:'냉기 폭발', LIGHTNING:'번개 폭발', DARK:'암흑 폭발' },
    FOCUS:  { NEUTRAL:'집중', FIRE:'화염 집중', ICE:'냉기 집중', LIGHTNING:'번개 집중', DARK:'암흑 집중' },
  };

  return makeCard({
    id,
    name:        `[${tierName}] ${names[effectType]?.[elemName] ?? effectType} `,
    effectType,
    category:    CARD_CATEGORY.ACTIVE,
    passiveMode: null,
    apCost,
    stat,
    element:     element ?? null,
    tier,
    equipSlot,
    classReq,
  });
}

// ── 버프 카드 생성기 ──────────────────────────────────────────
function buffCard({ equipSlot, effectType, element, tier, classReq = null }) {
  const tierName = tier === 1 ? 'T1' : tier === 2 ? 'T2' : 'T3';
  const elemName = element ?? 'NEUTRAL';
  const id       = `${equipSlot}_${effectType}_${elemName}_${tierName}`;

  // AP 코스트: 소형=1, 중형=2 (GDD §10.2)
  const apCost = tier === 1 ? 1 : 2;

  const statMap = { EMPOWER:'STR', GUARD:'CON', HASTE:'DEX', REGEN:'CON' };

  const names = {
    EMPOWER: '강화', GUARD: '수호', HASTE: '신속', REGEN: '재생',
  };

  return makeCard({
    id,
    name:        `[${tierName}] ${element ? element + ' ' : ''}${names[effectType] ?? effectType}`,
    effectType,
    category:    CARD_CATEGORY.ACTIVE,
    passiveMode: null,
    apCost,
    stat:        statMap[effectType] ?? 'CON',
    element:     element ?? null,
    tier,
    equipSlot,
    classReq,
  });
}

// ── 행동 카드 생성기 ──────────────────────────────────────────
function actionCard({ equipSlot, effectType, tier, classReq = null }) {
  const tierName = tier === 1 ? 'T1' : tier === 2 ? 'T2' : 'T3';
  const id       = `${equipSlot}_${effectType}_${tierName}`;
  const names    = { DRAW: '드로우', SENSE: '감각' };
  return makeCard({
    id,
    name:        `[${tierName}] ${names[effectType] ?? effectType}`,
    effectType,
    category:    CARD_CATEGORY.ACTIVE,
    passiveMode: null,
    apCost:      1,
    stat:        'DEX',
    element:     null,
    tier,
    equipSlot,
    classReq,
  });
}

// ── 패시브 카드 생성기 ────────────────────────────────────────
function passiveCard({ equipSlot, effectType, tier, classReq = null }) {
  const tierName   = tier === 1 ? 'T1' : tier === 2 ? 'T2' : 'T3';
  const id         = `${equipSlot}_${effectType}_${tierName}`;
  const isOneShot  = effectType === 'COUNTER';
  const names      = { COUNTER: '반격', BARRIER: '방벽', TAUNT: '도발' };

  // 등록 AP 코스트: 1회성=1AP, 지속=2AP (GDD §10.2)
  const apCost = isOneShot ? 1 : 2;

  return makeCard({
    id,
    name:        `[${tierName}] ${names[effectType] ?? effectType}`,
    effectType,
    category:    CARD_CATEGORY.PASSIVE,
    passiveMode: isOneShot ? PASSIVE_MODE.ONE_SHOT : PASSIVE_MODE.PERSISTENT,
    apCost,
    stat:        effectType === 'TAUNT' ? 'STR' : 'CON',
    element:     null,
    tier,
    equipSlot,
    classReq,
  });
}

// ================================================================
// 장비 슬롯별 카드 풀 정의
// GDD §9.2: 무기→공격, 방어구/악세→버프+행동+패시브
//
// 각 장비 아이템은 자신의 equipSlot과 tier로
// 이 맵에서 귀속 카드를 조회한다.
// ================================================================

const ELEMENTS_ALL = [ELEMENT.FIRE, ELEMENT.ICE, ELEMENT.LIGHTNING, ELEMENT.DARK, null];
const ELEMENTS_WEAPON = ELEMENTS_ALL; // 무기는 속성 전부
const TIERS = [1, 2, 3];

// ── 무기 슬롯 카드 풀 ────────────────────────────────────────
// 각 무기 아이템은 effectType 1종 + 속성 1종 + tier 고정
// 아래는 슬롯에서 생성 가능한 전체 후보 목록
// (실제 아이템 데이터에서 effectType/element/tier로 1장 지정)

function buildWeaponCards(slot) {
  const cards = [];
  for (const tier of TIERS) {
    for (const elem of ELEMENTS_WEAPON) {
      cards.push(attackCard({ equipSlot: slot, effectType: EFFECT_TYPE.SLASH,  element: elem, tier }));
      cards.push(attackCard({ equipSlot: slot, effectType: EFFECT_TYPE.PIERCE, element: elem, tier }));
      cards.push(attackCard({ equipSlot: slot, effectType: EFFECT_TYPE.BURST,  element: elem, tier }));
      cards.push(attackCard({ equipSlot: slot, effectType: EFFECT_TYPE.FOCUS,  element: elem, tier }));
    }
  }
  return cards;
}

// ── 방어구/악세 슬롯 카드 풀 ─────────────────────────────────
function buildArmorCards(slot) {
  const cards = [];
  for (const tier of TIERS) {
    // 버프 카드 (속성 포함)
    for (const elem of ELEMENTS_ALL) {
      cards.push(buffCard({ equipSlot: slot, effectType: EFFECT_TYPE.EMPOWER, element: elem, tier }));
      cards.push(buffCard({ equipSlot: slot, effectType: EFFECT_TYPE.GUARD,   element: elem, tier }));
      cards.push(buffCard({ equipSlot: slot, effectType: EFFECT_TYPE.HASTE,   element: elem, tier }));
      cards.push(buffCard({ equipSlot: slot, effectType: EFFECT_TYPE.REGEN,   element: elem, tier }));
    }
    // 행동 카드 (무속성)
    cards.push(actionCard({ equipSlot: slot, effectType: EFFECT_TYPE.DRAW,  tier }));
    cards.push(actionCard({ equipSlot: slot, effectType: EFFECT_TYPE.SENSE, tier }));
    // 패시브 카드 (무속성)
    cards.push(passiveCard({ equipSlot: slot, effectType: EFFECT_TYPE.COUNTER, tier }));
    cards.push(passiveCard({ equipSlot: slot, effectType: EFFECT_TYPE.BARRIER, tier }));
    cards.push(passiveCard({ equipSlot: slot, effectType: EFFECT_TYPE.TAUNT,   tier }));
  }
  return cards;
}

// ── 전체 카드 풀 빌드 ─────────────────────────────────────────
function buildCardPool() {
  const pool = new Map(); // cardId → card

  const weaponSlots = [
    EQUIP_SLOT.WEAPON_R,
    EQUIP_SLOT.WEAPON_L,
    EQUIP_SLOT.WEAPON_2H,
    EQUIP_SLOT.OFFHAND,
  ];
  const armorSlots = [
    EQUIP_SLOT.HELM,
    EQUIP_SLOT.CHEST,
    EQUIP_SLOT.PANTS,
    EQUIP_SLOT.BOOTS,
    EQUIP_SLOT.GLOVES,
    EQUIP_SLOT.RING,
    EQUIP_SLOT.NECKLACE,
    EQUIP_SLOT.CLOAK,
  ];

  for (const slot of weaponSlots) {
    for (const card of buildWeaponCards(slot)) pool.set(card.id, card);
  }
  for (const slot of armorSlots) {
    for (const card of buildArmorCards(slot)) pool.set(card.id, card);
  }

  return pool;
}

export const CARD_POOL = buildCardPool();

// ================================================================
// 공개 API
// ================================================================

/**
 * 카드 ID로 카드 조회
 * @param {string} cardId
 * @returns {object|null}
 */
export function getCardById(cardId) {
  return CARD_POOL.get(cardId) ?? null;
}

/**
 * 장비 아이템 정의로 귀속 카드 1장 반환
 *
 * @param {object} item
 *   { equipSlot, effectType, element, tier }
 * @returns {object|null} 카드 객체
 */
export function getCardForItem(item) {
  const { equipSlot, effectType, element, tier } = item;
  const elemName = element ?? 'NEUTRAL';
  const tierName = tier === 1 ? 'T1' : tier === 2 ? 'T2' : 'T3';

  // 패시브/행동 카드는 element 없음
  const isNoElem = [
    EFFECT_TYPE.DRAW, EFFECT_TYPE.SENSE,
    EFFECT_TYPE.COUNTER, EFFECT_TYPE.BARRIER, EFFECT_TYPE.TAUNT,
  ].includes(effectType);

  const id = isNoElem
    ? `${equipSlot}_${effectType}_${tierName}`
    : `${equipSlot}_${effectType}_${elemName}_${tierName}`;

  return CARD_POOL.get(id) ?? null;
}

/**
 * 장비 슬롯에서 생성 가능한 전체 카드 후보 목록 반환
 * (아이템 생성 시 랜덤 선택 등에 활용)
 *
 * @param {string} equipSlot  EQUIP_SLOT.*
 * @param {number} [tier]     지정 시 해당 tier만 반환
 * @returns {object[]}
 */
export function getCardsForSlot(equipSlot, tier = null) {
  const cards = [];
  for (const card of CARD_POOL.values()) {
    if (card.equipSlot !== equipSlot) continue;
    if (tier !== null && card.tier !== tier) continue;
    cards.push(card);
  }
  return cards;
}

/**
 * 패시브 카드 여부 판별
 * @param {object} card
 * @returns {boolean}
 */
export function isPassiveCard(card) {
  return card.category === CARD_CATEGORY.PASSIVE;
}

/**
 * 1회성 패시브 여부 판별
 * @param {object} card
 * @returns {boolean}
 */
export function isOneShotPassive(card) {
  return card.passiveMode === PASSIVE_MODE.ONE_SHOT;
}