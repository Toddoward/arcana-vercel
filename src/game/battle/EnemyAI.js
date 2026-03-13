// ============================================================
// src/game/battle/EnemyAI.js
// 전투 내 적 AI — 상황 기반 가중치 로직
//
// 행동 유형 8종:
//   ATTACK_SINGLE  / ATTACK_AOE / DEFEND
//   STATUS_EFFECT  / BUFF_ALLY  / HEAL_ALLY
//   FLEE           / SPECIAL
//
// 결정 흐름:
//   1. 가능한 행동 목록 필터링
//   2. 상황 보정 계수 × 기본 가중치 계산
//   3. 가중치 랜덤 선택
//   4. 타겟 결정
// ============================================================

export const ENEMY_ACTION = {
  ATTACK_SINGLE: 'ATTACK_SINGLE', // 단일 공격
  ATTACK_AOE:    'ATTACK_AOE',    // 광역 공격
  DEFEND:        'DEFEND',        // 방어 태세
  STATUS_EFFECT: 'STATUS_EFFECT', // 상태이상 부여
  BUFF_ALLY:     'BUFF_ALLY',     // 아군 버프
  HEAL_ALLY:     'HEAL_ALLY',     // 아군 힐
  FLEE:          'FLEE',          // 도주
  SPECIAL:       'SPECIAL',       // 분열/소환/변신
};

// ── 적 템플릿 타입 ─────────────────────────────────────────────
export const ENEMY_TYPE = {
  SMALL:   'SMALL',   // 최저 HP 타겟, 빠른 행동
  LARGE:   'LARGE',   // 최고 HP 타겟, 광역 특화
  MAGIC:   'MAGIC',   // 최저 HP 타겟, 마법 공격
  SUPPORT: 'SUPPORT', // 아군 힐/버프, 최저 DEX 타겟
  BOSS:    'BOSS',    // 전체 행동 가능, 특수 행동 보유
  DEFAULT: 'DEFAULT', // 랜덤 타겟
};

// ── 적 타입별 기본 가중치 ──────────────────────────────────────
const BASE_WEIGHTS = {
  [ENEMY_TYPE.SMALL]: {
    [ENEMY_ACTION.ATTACK_SINGLE]: 70,
    [ENEMY_ACTION.STATUS_EFFECT]: 20,
    [ENEMY_ACTION.FLEE]:          10,
  },
  [ENEMY_TYPE.LARGE]: {
    [ENEMY_ACTION.ATTACK_SINGLE]: 40,
    [ENEMY_ACTION.ATTACK_AOE]:    40,
    [ENEMY_ACTION.DEFEND]:        20,
  },
  [ENEMY_TYPE.MAGIC]: {
    [ENEMY_ACTION.ATTACK_SINGLE]: 30,
    [ENEMY_ACTION.ATTACK_AOE]:    30,
    [ENEMY_ACTION.STATUS_EFFECT]: 40,
  },
  [ENEMY_TYPE.SUPPORT]: {
    [ENEMY_ACTION.HEAL_ALLY]:     50,
    [ENEMY_ACTION.BUFF_ALLY]:     30,
    [ENEMY_ACTION.ATTACK_SINGLE]: 20,
  },
  [ENEMY_TYPE.BOSS]: {
    [ENEMY_ACTION.ATTACK_SINGLE]: 30,
    [ENEMY_ACTION.ATTACK_AOE]:    25,
    [ENEMY_ACTION.STATUS_EFFECT]: 20,
    [ENEMY_ACTION.DEFEND]:        10,
    [ENEMY_ACTION.SPECIAL]:       15,
  },
  [ENEMY_TYPE.DEFAULT]: {
    [ENEMY_ACTION.ATTACK_SINGLE]: 60,
    [ENEMY_ACTION.STATUS_EFFECT]: 20,
    [ENEMY_ACTION.DEFEND]:        20,
  },
};

// ================================================================
export class CombatEnemyAI {
  /**
   * @param {object} enemyTemplate
   *   { id, type, hp, maxHp, atk, def, element, allies: [] }
   */
  constructor(enemyTemplate) {
    this._template = enemyTemplate;
  }

  // ================================================================
  // 행동 결정 메인
  //
  // @param {object} battleState
  //   {
  //     enemy:       { hp, maxHp, ... } 현재 이 적 상태
  //     allEnemies:  [{ id, hp, maxHp, ... }]  살아있는 아군 적
  //     players:     [{ id, hp, maxHp, dex, position }] 플레이어 목록
  //   }
  //
  // @returns {{ action: string, targetId: string|null, targetAll: boolean }}
  // ================================================================
  decide(battleState) {
    const { enemy, allEnemies, players } = battleState;

    const selfHpRatio  = enemy.hp / enemy.maxHp;
    const avgPlayerHp  = this._avgHpRatio(players);

    // ── 가중치 계산 ───────────────────────────────────────────
    const weights = this._computeWeights(selfHpRatio, avgPlayerHp, allEnemies, players);

    // ── 행동 선택 ──────────────────────────────────────────────
    const action = this._weightedPick(weights);

    // ── 타겟 결정 ──────────────────────────────────────────────
    const targetId = this._pickTarget(action, players, allEnemies);

    return {
      action,
      targetId,
      targetAll: action === ENEMY_ACTION.ATTACK_AOE,
    };
  }

  // ================================================================
  // 상황 보정 가중치 계산
  // ================================================================
  _computeWeights(selfHpRatio, avgPlayerHpRatio, allEnemies, players) {
    const base = { ...(BASE_WEIGHTS[this._template.type] ?? BASE_WEIGHTS[ENEMY_TYPE.DEFAULT]) };

    // ── 자신 HP 구간별 상황 보정 ──────────────────────────────
    if (selfHpRatio >= 0.80) {
      base[ENEMY_ACTION.ATTACK_SINGLE] = (base[ENEMY_ACTION.ATTACK_SINGLE] ?? 0) * 1.5;
      base[ENEMY_ACTION.ATTACK_AOE]    = (base[ENEMY_ACTION.ATTACK_AOE]    ?? 0) * 1.5;
      base[ENEMY_ACTION.DEFEND]        = (base[ENEMY_ACTION.DEFEND]        ?? 0) * 0.5;

    } else if (selfHpRatio >= 0.50) {
      // 기본 유지

    } else if (selfHpRatio >= 0.30) {
      base[ENEMY_ACTION.ATTACK_SINGLE] = (base[ENEMY_ACTION.ATTACK_SINGLE] ?? 0) * 0.8;
      base[ENEMY_ACTION.DEFEND]        = (base[ENEMY_ACTION.DEFEND]        ?? 0) * 1.5;
      base[ENEMY_ACTION.HEAL_ALLY]     = (base[ENEMY_ACTION.HEAL_ALLY]     ?? 0) * 1.5;

    } else if (selfHpRatio >= 0.20) {
      // HP 20~30%: 방어 위주, 도주 준비
      base[ENEMY_ACTION.ATTACK_SINGLE] = (base[ENEMY_ACTION.ATTACK_SINGLE] ?? 0) * 0.5;
      base[ENEMY_ACTION.DEFEND]        = (base[ENEMY_ACTION.DEFEND]        ?? 0) * 2.0;

    } else {
      // HP 20% 미만 — 도주 최우선 (GDD 13.2)
      base[ENEMY_ACTION.FLEE]          = ((base[ENEMY_ACTION.FLEE] ?? 0) + 10) * 3.0;
      base[ENEMY_ACTION.DEFEND]        = (base[ENEMY_ACTION.DEFEND]        ?? 0) * 2.0;
      base[ENEMY_ACTION.ATTACK_SINGLE] = (base[ENEMY_ACTION.ATTACK_SINGLE] ?? 0) * 0.5;
    }

    // ── 플레이어 HP 보정 ─────────────────────────────────────
    if (avgPlayerHpRatio <= 0.30) {
      // 플레이어가 약할 때 → 공격 강화
      base[ENEMY_ACTION.ATTACK_SINGLE] = (base[ENEMY_ACTION.ATTACK_SINGLE] ?? 0) * 2.0;
      base[ENEMY_ACTION.ATTACK_AOE]    = (base[ENEMY_ACTION.ATTACK_AOE]    ?? 0) * 2.0;
    } else if (avgPlayerHpRatio >= 0.70) {
      // 플레이어가 건강할 때 → 방어/도주 강화
      base[ENEMY_ACTION.DEFEND]        = (base[ENEMY_ACTION.DEFEND] ?? 0) * 1.5;
      base[ENEMY_ACTION.FLEE]          = (base[ENEMY_ACTION.FLEE]   ?? 0) * 1.5;
    }

    // ── 아군 HP 보정 (아군이 있고 약할 때 힐/버프 강화) ──────
    const woundedAlly = allEnemies.some(
      (e) => e.id !== this._template.id && e.hp / e.maxHp <= 0.50,
    );
    if (woundedAlly) {
      base[ENEMY_ACTION.HEAL_ALLY] = (base[ENEMY_ACTION.HEAL_ALLY] ?? 0) * 2.0;
      base[ENEMY_ACTION.BUFF_ALLY] = (base[ENEMY_ACTION.BUFF_ALLY] ?? 0) * 1.5;
    }

    // ── 광역 공격 조건: 대형/보스 전용, HP 50%+ ─────────────
    if (
      this._template.type !== ENEMY_TYPE.LARGE &&
      this._template.type !== ENEMY_TYPE.BOSS
    ) {
      base[ENEMY_ACTION.ATTACK_AOE] = 0;
    }

    // ── 특수 행동: 보스 전용 ─────────────────────────────────
    if (this._template.type !== ENEMY_TYPE.BOSS) {
      base[ENEMY_ACTION.SPECIAL] = 0;
    }

    // ── 힐/버프: 아군 없으면 불가 ─────────────────────────────
    if (allEnemies.length <= 1) {
      base[ENEMY_ACTION.HEAL_ALLY] = 0;
      base[ENEMY_ACTION.BUFF_ALLY] = 0;
    }

    // 음수 제거
    for (const key of Object.keys(base)) {
      if (base[key] < 0) base[key] = 0;
    }

    return base;
  }

  // ================================================================
  // 타겟 결정 — 적 타입별 우선순위
  // ================================================================
  _pickTarget(action, players, allEnemies) {
    // 아군 대상 행동
    if (
      action === ENEMY_ACTION.HEAL_ALLY ||
      action === ENEMY_ACTION.BUFF_ALLY
    ) {
      // 가장 HP가 낮은 아군 (자신 제외)
      const allies = allEnemies.filter((e) => e.id !== this._template.id);
      if (allies.length === 0) return null;
      return allies.reduce((a, b) => a.hp / a.maxHp < b.hp / b.maxHp ? a : b).id;
    }

    // 광역 공격: 타겟 없음 (전체 대상)
    if (action === ENEMY_ACTION.ATTACK_AOE) return null;

    // 도주 / 방어 / 특수: 타겟 없음
    if (
      action === ENEMY_ACTION.FLEE    ||
      action === ENEMY_ACTION.DEFEND  ||
      action === ENEMY_ACTION.SPECIAL
    ) return null;

    // 단일 공격 / 상태이상 — 적 타입별 타겟 우선순위
    const livePlayers = players.filter((p) => p.hp > 0);
    if (livePlayers.length === 0) return null;

    // 도발 우선 (모든 적 공통)
    const taunting = livePlayers.find((p) => p.statusEffects?.includes('TAUNT'));
    if (taunting) return taunting.id;

    switch (this._template.type) {
      case ENEMY_TYPE.SMALL:
      case ENEMY_TYPE.MAGIC:
        // 최저 HP 타겟
        return livePlayers.reduce((a, b) => a.hp < b.hp ? a : b).id;

      case ENEMY_TYPE.LARGE:
        // 최고 HP 타겟
        return livePlayers.reduce((a, b) => a.hp > b.hp ? a : b).id;

      case ENEMY_TYPE.SUPPORT:
        // 최저 DEX 타겟
        return livePlayers.reduce((a, b) => a.dex < b.dex ? a : b).id;

      default:
        // 랜덤
        return livePlayers[Math.floor(Math.random() * livePlayers.length)].id;
    }
  }

  // ── 유틸: 가중치 기반 랜덤 선택 ──────────────────────────────
  _weightedPick(weights) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    if (entries.length === 0) return ENEMY_ACTION.ATTACK_SINGLE;

    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;

    for (const [action, w] of entries) {
      r -= w;
      if (r <= 0) return action;
    }
    return entries[entries.length - 1][0];
  }

  // ── 유틸: 플레이어 평균 HP 비율 ──────────────────────────────
  _avgHpRatio(players) {
    if (players.length === 0) return 1;
    const sum = players.reduce((s, p) => s + p.hp / p.maxHp, 0);
    return sum / players.length;
  }
}
