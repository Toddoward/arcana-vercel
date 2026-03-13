// ============================================================
// src/game/deck/PassiveManager.js
// 패시브 카드 필드 등록 / 자동 발동 / 주기 틱 / 초기화
//
// GDD: §10.1(패시브 카드 발동방식) §10.3(COUNTER/BARRIER/TAUNT)
//      §13.4(상태이상 기본 지속 2주기)
//
// 의존:
//   CardEffect.js  — getCardById, isPassiveCard, isOneShotPassive, EFFECT_TYPE
//   TokenRoll.js   — 반격(COUNTER) 굴림
//   playerStore.js — field[], takeDamage, applyStatus
//   constants.js   — STATUS
//
// 패시브 발동 흐름:
//   핸드 → registerPassive (AP소모, DeckBuilder 경유)
//   → field[] 에 등록
//   → 매 주기 tick() 또는 피격 시 checkOnHit() 호출
//   → 조건 충족 시 자동 발동
//   → ONE_SHOT: 발동 즉시 discard / PERSISTENT: duration 감소
// ============================================================

import { getCardById, isOneShotPassive, EFFECT_TYPE } from './CardEffect.js';
import { TokenRoll } from '../battle/TokenRoll.js';
import { usePlayerStore } from '../../stores/playerStore.js';
import { STATUS } from '../../constants/constants.js';

// 기본 지속 주기 (GDD §13.4)
const DEFAULT_DURATION = 2;

// BARRIER 데미지 감소 비율 (successRatio × 30%, CombatEngine._resolveCardImpact 기준)
const BARRIER_MAX_REDUCTION = 0.30;

// ================================================================
export class PassiveManager {

  // ================================================================
  // 피격 시 패시브 처리 — COUNTER / BARRIER
  //
  // CombatEngine._applyDamageToTarget() 에서 플레이어가 피격될 때 호출
  //
  // @param {string}   playerId    피격당한 플레이어 ID
  // @param {number}   incomingDmg 원래 데미지
  // @param {object}   attacker    { id, atk, element, dex } 공격자 정보
  // @param {object[]} allEnemies  현재 살아있는 적 배열 (COUNTER 반격 타겟용)
  //
  // @returns {{ finalDmg: number, counterFired: boolean, barrierActive: boolean }}
  // ================================================================
  static onHit(playerId, incomingDmg, attacker, allEnemies) {
    const ps      = usePlayerStore.getState();
    const player  = ps.getPlayer(playerId);
    if (!player) return { finalDmg: incomingDmg, counterFired: false, barrierActive: false };

    let finalDmg       = incomingDmg;
    let counterFired   = false;
    let barrierActive  = false;

    const field = [...(player.field ?? [])];

    for (let i = field.length - 1; i >= 0; i--) {
      const entry  = field[i];
      const cardDef = getCardById(entry.cardId);
      if (!cardDef) continue;

      // ── BARRIER: 데미지 감소 ───────────────────────────────
      if (cardDef.effectType === EFFECT_TYPE.BARRIER) {
        const reduction = entry.reduction ?? Math.round(BARRIER_MAX_REDUCTION * 0.5 * 100) / 100;
        finalDmg        = Math.max(0, Math.round(finalDmg * (1 - reduction)));
        barrierActive   = true;
        // 지속성: duration은 tick()에서 감소
      }

      // ── COUNTER: 피격 시 자동 반격 굴림 ─────────────────────
      if (cardDef.effectType === EFFECT_TYPE.COUNTER && !counterFired) {
        const roll    = TokenRoll.roll({ stat: player.stats?.STR ?? 5 });
        if (roll.successes > 0 && allEnemies.length > 0) {
          // 공격자에게 반격 데미지 (반격 데미지 = 성공 토큰 수 × 2)
          const counterDmg = roll.successes * 2;
          const target     = allEnemies.find((e) => e.id === attacker?.id) ?? allEnemies[0];
          if (target) {
            target.hp = Math.max(0, target.hp - counterDmg);
          }
          counterFired = true;
        }
        // ONE_SHOT: 발동 즉시 field에서 제거 → discard로
        PassiveManager._expirePassive(playerId, entry.instanceId);
      }
    }

    return { finalDmg, counterFired, barrierActive };
  }

  // ================================================================
  // 주기 종료 틱 — 지속성 패시브 duration 감소
  //
  // CombatEngine._tickStatusEffects() 이후 호출
  //
  // @param {string} playerId
  // ================================================================
  static tick(playerId) {
    const ps     = usePlayerStore.getState();
    const player = ps.getPlayer(playerId);
    if (!player) return;

    const field    = [...(player.field ?? [])];
    const expired  = [];

    for (const entry of field) {
      const cardDef = getCardById(entry.cardId);
      if (!cardDef) { expired.push(entry.instanceId); continue; }

      // ONE_SHOT은 tick에서 건드리지 않음 (onHit에서 처리)
      if (isOneShotPassive(cardDef)) continue;

      // duration 감소
      entry.duration = (entry.duration ?? DEFAULT_DURATION) - 1;
      if (entry.duration <= 0) {
        expired.push(entry.instanceId);
      }
    }

    // 만료된 패시브 제거 → discard
    for (const instanceId of expired) {
      PassiveManager._expirePassive(playerId, instanceId);
    }
  }

  // ================================================================
  // TAUNT 활성 여부 확인
  //
  // EnemyAI 타겟팅 시 playerStore.players를 순회하며 호출 가능하나,
  // 여기서는 단일 플레이어 기준 확인 헬퍼 제공
  //
  // @param {string} playerId
  // @returns {boolean}
  // ================================================================
  static hasTaunt(playerId) {
    const ps     = usePlayerStore.getState();
    const player = ps.getPlayer(playerId);
    if (!player) return false;

    return (player.field ?? []).some((entry) => {
      const cardDef = getCardById(entry.cardId);
      return cardDef?.effectType === EFFECT_TYPE.TAUNT &&
             (entry.duration ?? 0) > 0;
    });
  }

  // ================================================================
  // 패시브 카드 필드 등록 시 초기 duration 설정
  //
  // DeckBuilder.registerPassive() 이후 playerStore.applyPassive() 전에
  // 카드 tier에 따른 duration/reduction 값을 계산해 반환
  //
  // @param {object} cardDef  getCardById() 결과
  // @param {number} successRatio  TokenRoll 성공비율 (0~1)
  // @returns {object} applyPassive data 인자
  // ================================================================
  static buildPassiveData(cardDef, successRatio) {
    switch (cardDef.effectType) {
      case EFFECT_TYPE.BARRIER:
        return {
          duration:  DEFAULT_DURATION + (cardDef.tier - 1), // tier당 +1주기
          reduction: Math.round(successRatio * BARRIER_MAX_REDUCTION * 100) / 100,
        };

      case EFFECT_TYPE.TAUNT:
        return {
          duration: DEFAULT_DURATION + (cardDef.tier - 1),
        };

      case EFFECT_TYPE.COUNTER:
        return {
          charges: 1, // ONE_SHOT: 1회 사용
        };

      default:
        return { duration: DEFAULT_DURATION };
    }
  }

  // ================================================================
  // 전투 종료 시 전체 패시브 초기화
  // GDD §10.1: 전투 종료 시 field 전부 초기화
  //
  // @param {string[]} playerIds
  // ================================================================
  static clearAll(playerIds) {
    const ps = usePlayerStore.getState();
    for (const id of playerIds) {
      const player = ps.getPlayer(id);
      if (!player) continue;
      // field의 모든 항목을 discard로 이동
      const expired = (player.field ?? []).map((e) => e.instanceId);
      for (const instanceId of expired) {
        PassiveManager._expirePassive(id, instanceId);
      }
    }
  }

  // ================================================================
  // 내부: 패시브 만료 처리 (field → discard)
  // ================================================================
  static _expirePassive(playerId, instanceId) {
    const ps     = usePlayerStore.getState();
    const player = ps.getPlayer(playerId);
    if (!player) return;

    const card = (player.field ?? []).find((c) => c.instanceId === instanceId);
    if (!card) return;

    // playerStore에 field 갱신 직접 반영
    // (playerStore에 removeFromField / addToDiscard 메서드 있다고 가정)
    ps.expirePassive(playerId, instanceId);
  }
}