// ============================================================
// src/game/deck/DeckBuilder.js
// 장비 귀속 덱 구성 / 전투 중 장비 교체 / 덱 소진 처리
//
// GDD: §9.1(덱=장비귀속) §9.3(전략분기) §9.4(장비교체4단계)
//      §10.4(핸드시스템) §10.5(덱초기화/소진)
//
// 의존:
//   CardEffect.js  — getCardForItem, isPassiveCard, EQUIP_SLOT
//   playerStore.js — deck, hand, discard, field 조작
//   constants.js   — HAND.INIT_DRAW
// ============================================================

import {
  getCardForItem,
  getCardById,
  isPassiveCard,
  EQUIP_SLOT,
} from './CardEffect.js';
import { usePlayerStore } from '../../stores/playerStore.js';
import { HAND } from '../../constants/constants.js';

// ── 양손 무기 점유 슬롯 (GDD §9.2) ───────────────────────────
const TWO_HAND_OCCUPIED = [EQUIP_SLOT.WEAPON_R, EQUIP_SLOT.WEAPON_L];

// ================================================================
export class DeckBuilder {

  // ================================================================
  // 장비 목록으로 덱 구성
  //
  // @param {object[]} equippedItems
  //   [{ id, equipSlot, effectType, element, tier }, ...]
  //
  // @returns {object[]} 카드 인스턴스 배열
  //   각 카드에 instanceId 부여 (동일 카드 복수 소지 구분용)
  // ================================================================
  static buildDeckFromEquipment(equippedItems) {
    const deck = [];

    for (const item of equippedItems) {
      // 양손 장비는 WEAPON_R 슬롯으로 처리, WEAPON_L은 점유만 됨
      if (item.equipSlot === EQUIP_SLOT.WEAPON_L &&
          equippedItems.some((i) => i.equipSlot === EQUIP_SLOT.WEAPON_2H)) {
        continue; // 양손 장비 착용 시 왼손 슬롯 무시
      }

      const card = getCardForItem(item);
      if (!card) continue;

      deck.push(DeckBuilder._makeInstance(card, item.id));
    }

    return deck;
  }

  // ================================================================
  // 전투 시작 전 덱 준비
  // GDD §10.5: 항상 셔플 init (이전 전투 상태 미반영)
  //
  // @param {object[]} deck  buildDeckFromEquipment 결과
  // @returns {{ deck: object[], hand: object[], discard: [], field: [] }}
  // ================================================================
  static initForCombat(deck) {
    const shuffled = DeckBuilder._shuffle([...deck]);
    const hand     = shuffled.splice(0, HAND.INIT_DRAW); // 5장 드로우
    return {
      deck:    shuffled,
      hand,
      discard: [],
      field:   [],
    };
  }

  // ================================================================
  // 전투 중 장비 교체 (GDD §9.4 4단계)
  //
  // @param {object} state   { deck, hand, discard, field }
  // @param {object} oldItem { id, equipSlot, effectType, element, tier }
  // @param {object} newItem { id, equipSlot, effectType, element, tier }
  //
  // @returns {{ deck, hand, discard, field, drawCount }}
  //   drawCount: 반환된 Hand 수 = 새로 드로우할 수
  // ================================================================
  static equipSwap(state, oldItem, newItem) {
    let { deck, hand, discard, field } = state;

    // 1. 이전 장비 카드를 덱에서 전부 제거
    const oldCard = getCardForItem(oldItem);
    if (oldCard) {
      deck = deck.filter((c) => c.cardId !== oldCard.id);
    }

    // 2. Hand 전부 덱으로 반환
    const returnedCount = hand.length;
    deck  = [...deck, ...hand];
    hand  = [];

    // 3. 새 장비 카드 덱에 추가
    const newCard = getCardForItem(newItem);
    if (newCard) {
      deck.push(DeckBuilder._makeInstance(newCard, newItem.id));
    }

    // 4. 반환된 Hand 수만큼 새로 드로우
    const drawCount = returnedCount;
    const drawn     = DeckBuilder._drawN({ deck, hand, discard }, drawCount);

    return {
      deck:    drawn.deck,
      hand:    drawn.hand,
      discard,
      field,
      drawCount,
    };
  }

  // ================================================================
  // 카드 드로우 (덱 소진 처리 포함)
  // GDD §10.5: 덱 소진 → 1턴 소모 → 묘지 셔플 → 덱 재구성
  //
  // @param {object} state   { deck, hand, discard }
  // @param {number} count   드로우할 수
  //
  // @returns {{ deck, hand, discard, reshuffled: boolean }}
  // ================================================================
  static draw(state, count = 1) {
    let { deck, hand, discard } = state;
    let reshuffled = false;

    for (let i = 0; i < count; i++) {
      // 핸드 최대 12장 (GDD §10.4)
      if (hand.length >= HAND.MAX_SIZE) break;

      // 덱 소진 시 묘지 셔플 → 덱 재구성
      if (deck.length === 0) {
        if (discard.length === 0) break; // 묘지도 없으면 드로우 불가
        deck       = DeckBuilder._shuffle([...discard]);
        discard    = [];
        reshuffled = true;
      }

      hand = [...hand, deck.shift()];
    }

    return { deck, hand, discard, reshuffled };
  }

  // ================================================================
  // 카드를 핸드 → 묘지로 이동 (카드 사용 후)
  //
  // @param {object} state    { hand, discard }
  // @param {string} instanceId
  // @returns {{ hand, discard }}
  // ================================================================
  static discardFromHand(state, instanceId) {
    const { hand, discard } = state;
    const card = hand.find((c) => c.instanceId === instanceId);
    if (!card) return state;
    return {
      hand:    hand.filter((c) => c.instanceId !== instanceId),
      discard: [...discard, card],
    };
  }

  // ================================================================
  // 카드를 핸드 → 필드로 이동 (패시브 등록)
  //
  // @param {object} state    { hand, field }
  // @param {string} instanceId
  // @returns {{ hand, field }} | null (패시브 카드 아니면 null)
  // ================================================================
  static registerPassive(state, instanceId) {
    const { hand, field } = state;
    const card = hand.find((c) => c.instanceId === instanceId);
    if (!card) return null;

    // 패시브 카드 여부 검증
    const cardDef = getCardById(card.cardId);
    if (!cardDef || !isPassiveCard(cardDef)) return null;

    return {
      hand:  hand.filter((c) => c.instanceId !== instanceId),
      field: [...field, { ...card, registeredAt: Date.now() }],
    };
  }

  // ================================================================
  // 전투 종료 시 덱/핸드/묘지/필드 초기화
  // GDD §10.5: 전투 종료 → 전부 초기화
  //
  // @param {object[]} equippedItems  현재 장착 장비 목록
  // @returns {{ deck, hand, discard, field }}
  // ================================================================
  static resetAfterCombat(equippedItems) {
    const deck = DeckBuilder.buildDeckFromEquipment(equippedItems);
    return {
      deck,
      hand:    [],
      discard: [],
      field:   [],
    };
  }

  // ================================================================
  // 덱 유효성 검사 (디버그/저장 시 사용)
  //
  // @param {object[]} deck
  // @returns {{ valid: boolean, issues: string[] }}
  // ================================================================
  static validate(deck) {
    const issues = [];

    if (!Array.isArray(deck)) {
      return { valid: false, issues: ['deck이 배열이 아님'] };
    }

    // instanceId 중복 검사
    const ids = deck.map((c) => c.instanceId);
    const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupIds.length > 0) {
      issues.push(`중복 instanceId: ${dupIds.join(', ')}`);
    }

    // cardId 유효성 검사
    for (const card of deck) {
      if (!getCardById(card.cardId)) {
        issues.push(`유효하지 않은 cardId: ${card.cardId}`);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  // ================================================================
  // 덱 통계 요약 (디버그/UI용)
  //
  // @param {object[]} deck
  // @returns {object} 통계
  // ================================================================
  static summarize(deck) {
    const byType   = {};
    const byElem   = {};
    const byTier   = { 1: 0, 2: 0, 3: 0 };
    let   passives = 0;

    for (const card of deck) {
      const def = getCardById(card.cardId);
      if (!def) continue;

      byType[def.effectType] = (byType[def.effectType] ?? 0) + 1;
      const elem = def.element ?? 'NEUTRAL';
      byElem[elem] = (byElem[elem] ?? 0) + 1;
      byTier[def.tier] = (byTier[def.tier] ?? 0) + 1;
      if (isPassiveCard(def)) passives++;
    }

    return {
      total:    deck.length,
      byType,
      byElem,
      byTier,
      passives,
      actives:  deck.length - passives,
    };
  }

  // ================================================================
  // 내부 유틸
  // ================================================================

  // Fisher-Yates 셔플
  static _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 카드 인스턴스 생성 (instanceId는 itemId + 타임스탬프 기반)
  static _makeInstance(cardDef, itemId) {
    return {
      instanceId: `${cardDef.id}_${itemId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      cardId:     cardDef.id,
      itemId,
    };
  }

  // N장 드로우 내부 헬퍼
  static _drawN(state, count) {
    let { deck, hand, discard } = state;
    for (let i = 0; i < count; i++) {
      if (hand.length >= HAND.MAX_SIZE) break;
      if (deck.length === 0) {
        if (discard.length === 0) break;
        deck    = DeckBuilder._shuffle([...discard]);
        discard = [];
      }
      hand = [...hand, deck.shift()];
    }
    return { deck, hand, discard };
  }
}