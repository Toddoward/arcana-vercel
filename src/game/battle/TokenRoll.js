// ============================================================
// src/game/battle/TokenRoll.js
// For the King 방식 토큰 굴림 시스템
//
// 구조:
//   기본 토큰 수: 6개
//   각 토큰 독립 성공 확률: 60% (기본)
//   스탯 보정: 60% + (관련 스탯 - 5) × 2%  [20% ~ 95% 클램프]
//   속성 상성: 강점 +20% / 약점 -10% (토큰 전체 확률에 적용)
//   DP 소모: 1DP = 토큰 1개 확정 성공 고정
// ============================================================

// ── 속성 상성 맵 ──────────────────────────────────────────────
// ADVANTAGE: 공격 속성이 방어 속성에 대해 강점(×2, +20%)
// DISADVANTAGE: 약점(×1, -10%)
const ELEMENT_MODIFIER = {
  // [공격속성][방어속성] → 'advantage' | 'disadvantage' | 'neutral'
  FIRE: {
    ICE:       'advantage',
    LIGHTNING: 'advantage',
    DARK:      'disadvantage',
  },
  ICE: {
    FIRE:      'advantage',
    DARK:      'advantage',
    LIGHTNING: 'disadvantage',
  },
  LIGHTNING: {
    ICE:       'advantage',
    DARK:      'advantage',
    FIRE:      'disadvantage',
  },
  DARK: {
    FIRE:      'advantage',
    LIGHTNING: 'advantage',
    ICE:       'disadvantage',
  },
};

// 속성 보정 수치
const ADVANTAGE_BONUS    = 0.20;  // +20%
const DISADVANTAGE_BONUS = -0.10; // -10%

// 토큰 확률 클램프
const MIN_RATE = 0.20;
const MAX_RATE = 0.95;

// 기본 토큰 수
const DEFAULT_TOKEN_COUNT = 6;

// ================================================================
export class TokenRoll {
  // ================================================================
  // 핵심 굴림 메서드
  //
  // @param {object} options
  //   stat         {number}  관련 스탯 수치 (STR / DEX / INT / LUK 등)
  //   tokenCount   {number}  토큰 수 (기본 6)
  //   dpSpend      {number}  소모할 DP 수 (0 이상 정수)
  //   attackElem   {string|null} 공격 속성 ('FIRE'|'ICE'|'LIGHTNING'|'DARK'|null)
  //   defenseElem  {string|null} 방어 속성
  //
  // @returns {RollResult}
  //   {
  //     successes:   number,   // 성공한 토큰 수
  //     total:       number,   // 전체 토큰 수
  //     rate:        number,   // 최종 적용 확률 (0~1)
  //     dpUsed:      number,   // 실제 소모된 DP
  //     tokens:      boolean[],// 각 토큰 결과 (true=성공)
  //     elementMod:  string,   // 'advantage'|'disadvantage'|'neutral'
  //   }
  // ================================================================
  static roll({
    stat        = 5,
    tokenCount  = DEFAULT_TOKEN_COUNT,
    dpSpend     = 0,
    attackElem  = null,
    defenseElem = null,
  } = {}) {
    // ── 기본 성공률 계산 ──────────────────────────────────────
    let rate = 0.60 + (stat - 5) * 0.02;

    // ── 속성 보정 ─────────────────────────────────────────────
    const elementMod = TokenRoll.getElementMod(attackElem, defenseElem);
    if (elementMod === 'advantage')    rate += ADVANTAGE_BONUS;
    if (elementMod === 'disadvantage') rate += DISADVANTAGE_BONUS;

    // 클램프
    rate = Math.min(MAX_RATE, Math.max(MIN_RATE, rate));

    // ── DP 소모: 확정 성공 고정 ──────────────────────────────
    const dpUsed      = Math.min(dpSpend, tokenCount);
    const fixedCount  = dpUsed;          // DP로 고정된 성공 토큰 수
    const rollCount   = tokenCount - fixedCount; // 실제 굴릴 토큰 수

    // ── 굴림 ─────────────────────────────────────────────────
    const tokens = [];

    // 고정 성공 토큰
    for (let i = 0; i < fixedCount; i++) tokens.push(true);

    // 확률 굴림 토큰
    for (let i = 0; i < rollCount; i++) {
      tokens.push(Math.random() < rate);
    }

    const successes = tokens.filter(Boolean).length;

    return {
      successes,
      total: tokenCount,
      rate,
      dpUsed,
      tokens,
      elementMod,
    };
  }

  // ================================================================
  // 속성 상성 판정
  // @returns 'advantage' | 'disadvantage' | 'neutral'
  // ================================================================
  static getElementMod(attackElem, defenseElem) {
    if (!attackElem || !defenseElem) return 'neutral';
    const atk = attackElem.toUpperCase();
    const def = defenseElem.toUpperCase();
    return ELEMENT_MODIFIER[atk]?.[def] ?? 'neutral';
  }

  // ================================================================
  // 성공률 미리 계산 (UI 표시용)
  // ================================================================
  static computeRate({ stat = 5, attackElem = null, defenseElem = null } = {}) {
    let rate = 0.60 + (stat - 5) * 0.02;
    const mod = TokenRoll.getElementMod(attackElem, defenseElem);
    if (mod === 'advantage')    rate += ADVANTAGE_BONUS;
    if (mod === 'disadvantage') rate += DISADVANTAGE_BONUS;
    return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
  }

  // ================================================================
  // 속성 상성 부여 상태이상 추가 확률
  // 강점 공격: +15% / 기타: 0%
  // ================================================================
  static statusBonusRate(attackElem, defenseElem) {
    return TokenRoll.getElementMod(attackElem, defenseElem) === 'advantage'
      ? 0.15
      : 0;
  }
}
