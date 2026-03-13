// ============================================================
// src/game/battle/BossAI.js
// 중간 보스 / 레드 드래곤 특수 행동 (GDD §26, §27)
//
// 사용 방법:
//   CombatEngine._executeEnemyAction() 에서
//   case ENEMY_ACTION.SPECIAL:
//     return BossAI.executeSpecial(enemy, context, engine);
//
// context = {
//   enemies:    [...],   // 현재 전장 적 목록 (참조)
//   addEnemy:   fn,      // 소환 등록 콜백
//   pushLog:    fn,      // 전투 로그 콜백
//   playerStore: ...,    // usePlayerStore.getState()
// }
// ============================================================

import { STATUS, POSITION } from '../../constants/constants.js';
import { TokenRoll }         from './TokenRoll.js';

// ── 보스 ID 상수 ──────────────────────────────────────────────
export const BOSS_ID = {
  WYVERN:        'wyvern',
  GOLEM:         'golem',
  LICH:          'lich',
  GRIFFIN:       'griffin',
  DRAGON_KNIGHT: 'dragon_knight',
  RED_DRAGON:    'red_dragon',
};

// ── 레드 드래곤 페이즈 경계 (GDD §27) ────────────────────────
const DRAGON_PHASE = {
  PHASE1_MIN: 0.60,  // HP 100%~60%
  PHASE2_MIN: 0.30,  // HP 60%~30%
  // PHASE3: HP 30%~0%
};

// ── 소환 몬스터 템플릿 ─────────────────────────────────────────
function makeMinion(id, name, hp, atk) {
  return { id: `${id}_${Date.now()}`, name, hp, maxHp: hp, atk, def: 0, type: 'SMALL', statusEffects: [] };
}

// ================================================================
// 메인 진입점
// ================================================================
export const BossAI = {
  /**
   * @param {object} enemy    적 객체 (hp, maxHp, id, ...)
   * @param {object} context  { enemies, addEnemy, pushLog, playerStore }
   * @param {object} engine   CombatEngine 인스턴스 (내부 메서드 접근용)
   * @returns {object}  행동 결과
   */
  executeSpecial(enemy, context, engine) {
    const bossId = (enemy.bossId ?? enemy.id ?? '').toLowerCase();

    if (bossId.includes(BOSS_ID.WYVERN))        return this._wyvern(enemy, context);
    if (bossId.includes(BOSS_ID.GOLEM))         return this._golem(enemy, context);
    if (bossId.includes(BOSS_ID.LICH))          return this._lich(enemy, context);
    if (bossId.includes(BOSS_ID.GRIFFIN))       return this._griffin(enemy, context);
    if (bossId.includes(BOSS_ID.DRAGON_KNIGHT)) return this._dragonKnight(enemy, context);
    if (bossId.includes(BOSS_ID.RED_DRAGON))    return this._redDragon(enemy, context);

    context.pushLog?.(`⚡ ${enemy.name ?? enemy.id} 특수 행동 (미정의)`);
    return { special: true };
  },

  // ================================================================
  // 와이번 (GDD §26)
  // ================================================================
  _wyvern(enemy, ctx) {
    const roll = Math.random();
    const ps   = ctx.playerStore;

    if (roll < 0.40) {
      // 독 브레스: 전체 플레이어에게 POISON 부여
      ps.players.filter((p) => p.hp > 0).forEach((p) => {
        ps.addStatus(p.id, STATUS.POISON, 2);
      });
      ctx.pushLog?.('🐉 와이번 — 독 브레스! 전체에게 POISON 부여');
      return { action: 'POISON_BREATH' };

    } else if (roll < 0.70) {
      // 돌진: 단일 타겟 고데미지 (ATK × 2.0)
      const target = this._pickTarget(ps.players, 'lowHp');
      if (target) {
        const dmg = Math.round((enemy.atk ?? 10) * 2.0);
        ps.damagePlayer(target.id, dmg);
        ctx.pushLog?.(`🐉 와이번 — 돌진! ${target.name} 에게 ${dmg} 데미지`);
      }
      return { action: 'CHARGE' };

    } else {
      // 상승: 이번 주기 Back 공격만 가능 (플래그 세팅)
      enemy._ascending = true;
      ctx.pushLog?.('🐉 와이번 — 상승! 이번 주기 Back만 공격');
      return { action: 'ASCEND' };
    }
  },

  // ================================================================
  // 골렘 (GDD §26)
  // ================================================================
  _golem(enemy, ctx) {
    const ps       = ctx.playerStore;
    const hpRatio  = (enemy.hp ?? 0) / (enemy.maxHp ?? 1);

    // HP 50% 이하 → 소형 골렘 2기 소환 (1회만)
    if (hpRatio <= 0.5 && !enemy._summonedMinions) {
      enemy._summonedMinions = true;
      const m1 = makeMinion('mini_golem', '소형 골렘', 30, 6);
      const m2 = makeMinion('mini_golem', '소형 골렘', 30, 6);
      ctx.addEnemy?.(m1);
      ctx.addEnemy?.(m2);
      ctx.pushLog?.('🪨 골렘 — 소형 골렘 2기 소환!');
      return { action: 'SUMMON_MINIONS' };
    }

    // 바위 던지기: 단일 STUN 굴림
    const target = this._pickTarget(ps.players, 'random');
    if (target) {
      const stunRoll = TokenRoll.roll({ stat: enemy.atk ?? 8 });
      if (stunRoll.successes > 0) {
        ps.addStatus(target.id, STATUS.STUN, 1);
        ctx.pushLog?.(`🪨 골렘 — 바위 던지기! ${target.name} STUN`);
      } else {
        const dmg = enemy.atk ?? 8;
        ps.damagePlayer(target.id, dmg);
        ctx.pushLog?.(`🪨 골렘 — 바위 던지기 빗나감! ${target.name} 에게 ${dmg} 데미지`);
      }
    }
    return { action: 'ROCK_THROW' };
  },

  // ================================================================
  // 리치 (GDD §26)
  // ================================================================
  _lich(enemy, ctx) {
    const ps   = ctx.playerStore;
    const roll = Math.random();

    if (roll < 0.35) {
      // 이중 저주: 랜덤 2명에게 CURSE
      const targets = [...ps.players.filter((p) => p.hp > 0)]
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
      targets.forEach((p) => ps.addStatus(p.id, STATUS.CURSE, 2));
      ctx.pushLog?.(`💀 리치 — 이중 저주! ${targets.map((p) => p.name).join(', ')} CURSE`);
      return { action: 'DOUBLE_CURSE' };

    } else {
      // 스켈레톤 소환
      const sk1 = makeMinion('skeleton', '스켈레톤', 20, 5);
      const sk2 = makeMinion('skeleton', '스켈레톤', 20, 5);
      ctx.addEnemy?.(sk1);
      ctx.addEnemy?.(sk2);
      ctx.pushLog?.('💀 리치 — 스켈레톤 2기 소환!');
      return { action: 'SUMMON_SKELETON' };
    }
  },

  /**
   * 리치 자동 부활 (GDD §26) — 리치 HP 0 도달 시 외부에서 호출
   * CombatEngine._checkBattleEnd 또는 _removeEnemy 전에 체크
   */
  tryLichRevive(enemy, ctx) {
    if (enemy.id?.includes(BOSS_ID.LICH) && !enemy._revived && enemy.hp <= 0) {
      enemy._revived = true;
      enemy.hp       = Math.floor(enemy.maxHp * 0.30);
      enemy.def      = 0; // 방어력 0으로
      ctx.pushLog?.('💀 리치 — 자동 부활! 방어력 0, HP 30% 복구');
      return true;
    }
    return false;
  },

  // ================================================================
  // 그리핀 (GDD §26)
  // ================================================================
  _griffin(enemy, ctx) {
    const ps   = ctx.playerStore;
    const roll = Math.random();

    if (roll < 0.30) {
      // 급습: DEX 최고 타겟에게 강공격 (ATK × 1.8)
      const target = this._pickTarget(ps.players, 'highDex');
      if (target) {
        const dmg = Math.round((enemy.atk ?? 12) * 1.8);
        ps.damagePlayer(target.id, dmg);
        ctx.pushLog?.(`🦅 그리핀 — 급습! ${target.name} 에게 ${dmg} 데미지`);
      }
      return { action: 'SWIFT_STRIKE' };

    } else if (roll < 0.60) {
      // 바람 폭풍: 전체 DEX -2 (2주기)
      ps.players.filter((p) => p.hp > 0).forEach((p) => {
        ps.applyStatModifier(p.id, 'DEX', -2);
      });
      ctx.pushLog?.('🦅 그리핀 — 바람 폭풍! 전체 DEX -2');
      return { action: 'WIND_STORM' };

    } else {
      // 비행 + 강하: 1턴 근접 불가(플래그) → 다음 턴 전체 기절 굴림
      if (!enemy._diveBombing) {
        enemy._diveBombing = true;
        ctx.pushLog?.('🦅 그리핀 — 비행! 이번 주기 근접 불가');
        return { action: 'FLY' };
      } else {
        enemy._diveBombing = false;
        ps.players.filter((p) => p.hp > 0).forEach((p) => {
          const roll = TokenRoll.roll({ stat: p.stats?.DEX ?? 5 });
          if (roll.successes === 0) ps.addStatus(p.id, STATUS.STUN, 1);
        });
        ctx.pushLog?.('🦅 그리핀 — 강하! 전체 기절 판정');
        return { action: 'DIVE_BOMB' };
      }
    }
  },

  // ================================================================
  // 드래곤 나이트 (GDD §26)
  // ================================================================
  _dragonKnight(enemy, ctx) {
    const ps      = ctx.playerStore;
    const hpRatio = (enemy.hp ?? 0) / (enemy.maxHp ?? 1);

    // HP 30% 이하 → 분노 상태 (전 스탯 +50%) 1회
    if (hpRatio <= 0.30 && !enemy._enraged) {
      enemy._enraged = true;
      enemy.atk = Math.round((enemy.atk ?? 12) * 1.5);
      enemy.def = Math.round((enemy.def ?? 4) * 1.5);
      ctx.pushLog?.('⚔️ 드래곤 나이트 — 분노! ATK/DEF +50%');
      return { action: 'ENRAGE' };
    }

    const roll = Math.random();
    if (roll < 0.40) {
      // 화염검: 단일 + BURN
      const target = this._pickTarget(ps.players, 'lowHp');
      if (target) {
        const dmg = enemy.atk ?? 12;
        ps.damagePlayer(target.id, dmg);
        ps.addStatus(target.id, STATUS.BURN, 2);
        ctx.pushLog?.(`⚔️ 드래곤 나이트 — 화염검! ${target.name} ${dmg} 데미지 + BURN`);
      }
      return { action: 'FLAME_SWORD' };

    } else {
      // 돌격: Front 전체 공격
      ps.players.filter((p) => p.hp > 0 && p.position === POSITION.FRONT).forEach((p) => {
        ps.damagePlayer(p.id, enemy.atk ?? 12);
      });
      ctx.pushLog?.('⚔️ 드래곤 나이트 — 돌격! Front 전체 공격');
      return { action: 'CHARGE_FRONT' };
    }
  },

  // ================================================================
  // 레드 드래곤 3페이즈 (GDD §27)
  // ================================================================
  _redDragon(enemy, ctx) {
    const ps      = ctx.playerStore;
    const hpRatio = (enemy.hp ?? 0) / (enemy.maxHp ?? 1);

    // 페이즈 판별
    if (hpRatio >= DRAGON_PHASE.PHASE1_MIN) {
      return this._dragonPhase1(enemy, ctx, ps);
    } else if (hpRatio >= DRAGON_PHASE.PHASE2_MIN) {
      return this._dragonPhase2(enemy, ctx, ps);
    } else {
      return this._dragonPhase3(enemy, ctx, ps);
    }
  },

  _dragonPhase1(enemy, ctx, ps) {
    // 페이즈1: 브레스(전체 BURN) or 랜덤 클로
    if (Math.random() < 0.55) {
      ps.players.filter((p) => p.hp > 0).forEach((p) => {
        const dmg = Math.round((enemy.atk ?? 20) * 0.7);
        ps.damagePlayer(p.id, dmg);
        ps.addStatus(p.id, STATUS.BURN, 2);
      });
      ctx.pushLog?.('🔥 레드 드래곤 — 화염 브레스! 전체 BURN + 데미지');
      return { action: 'BREATH_FIRE', phase: 1 };
    } else {
      const target = this._pickTarget(ps.players, 'random');
      if (target) {
        ps.damagePlayer(target.id, enemy.atk ?? 20);
        ctx.pushLog?.(`🔥 레드 드래곤 — 클로! ${target.name} 에게 ${enemy.atk ?? 20} 데미지`);
      }
      return { action: 'CLAW', phase: 1 };
    }
  },

  _dragonPhase2(enemy, ctx, ps) {
    // 페이즈2: 비행(1턴 근접 불가) + 착지 기절
    if (!enemy._flying) {
      enemy._flying = true;
      ctx.pushLog?.('🔥 레드 드래곤 — 비행! 근접 공격 불가');
      return { action: 'FLY', phase: 2 };
    } else {
      enemy._flying = false;
      // 착지 충격 → 전체 STUN 판정
      ps.players.filter((p) => p.hp > 0).forEach((p) => {
        const stunRoll = TokenRoll.roll({ stat: p.stats?.CON ?? 5 });
        if (stunRoll.successes === 0) ps.addStatus(p.id, STATUS.STUN, 1);
      });
      ctx.pushLog?.('🔥 레드 드래곤 — 착지! 전체 기절 판정');
      return { action: 'LAND_SHOCKWAVE', phase: 2 };
    }
  },

  _dragonPhase3(enemy, ctx, ps) {
    // 페이즈3: 분노 (행동 2회) + 화염 장판
    if (!enemy._enraged) {
      enemy._enraged   = true;
      enemy._actCount  = 2; // 매 턴 2회 행동 플래그 (Initiative 처리 외부)
      ctx.pushLog?.('🔥 레드 드래곤 — 분노!! 행동 2회 + 화염 장판 시작');
    }

    // 화염 장판: 포지션 무관 전체에게 지속 데미지 + BURN
    ps.players.filter((p) => p.hp > 0).forEach((p) => {
      const dmg = Math.round((enemy.atk ?? 20) * 0.5);
      ps.damagePlayer(p.id, dmg);
      ps.addStatus(p.id, STATUS.BURN, 1);
    });
    ctx.pushLog?.('🔥 레드 드래곤 — 화염 장판! 전체 BURN + 데미지');
    return { action: 'FIRE_FIELD', phase: 3 };
  },

  // ================================================================
  // 내부 헬퍼
  // ================================================================
  _pickTarget(players, mode = 'random') {
    const alive = players.filter((p) => p.hp > 0);
    if (!alive.length) return null;

    switch (mode) {
      case 'lowHp':
        return alive.reduce((a, b) => (a.hp < b.hp ? a : b));
      case 'highDex':
        return alive.reduce((a, b) =>
          (a.stats?.DEX ?? 0) > (b.stats?.DEX ?? 0) ? a : b
        );
      case 'random':
      default:
        return alive[Math.floor(Math.random() * alive.length)];
    }
  },
};
