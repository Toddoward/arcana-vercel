// ============================================================
// src/game/battle/CombatEngine.js
// 전투 흐름 총괄 — 시작 / 턴 관리 / 카드 사용 / 상태이상 / 승패
//
// 의존:
//   Initiative.js     — Bresenham 이니셔티브
//   TokenRoll.js      — 토큰 굴림
//   EnemyAI.js        — 적 행동 결정
//   gameStore.js      — 전투 상태 읽기/쓰기
//   playerStore.js    — 플레이어 HP/스탯 읽기/쓰기
// ============================================================

import { Initiative }    from './Initiative.js';
import { TokenRoll }     from './TokenRoll.js';
import { CombatEnemyAI, ENEMY_ACTION } from './EnemyAI.js';
import { useGameStore }  from '../../stores/gameStore.js';
import { usePlayerStore } from '../../stores/playerStore.js';

// ── 상태이상 지속 주기 기본값 ─────────────────────────────────
const STATUS_DURATION_DEFAULT = 2; // 주기

// ── 데미지 공식 ───────────────────────────────────────────────
//   카드 데미지 = stat × multiplier + tierBonus - defValue
const TIER_BONUS = { 1: 5, 2: 10, 3: 15 };

// ── 솔로 스케일링 (플레이어 수 → 적 스탯 배율) ───────────────
const SOLO_SCALE = { 1: 0.60, 2: 0.75, 3: 0.90, 4: 1.00 };

// ================================================================
export class CombatEngine {
  constructor() {
    this._initiative = null;
    this._enemies    = [];        // 현재 전투 적 배열
    this._aiMap      = new Map(); // enemyId → CombatEnemyAI
    this._turnQueue  = [];        // 현재 주기 턴 큐 (unitId 배열)
    this._cycle      = 0;
    this._log        = [];        // 전투 로그 (최근 20개)
    this._started    = false;
  }

  // ================================================================
  // 전투 시작
  //
  // @param {object[]} enemies  월드맵에서 전달된 적 목록
  //   [{ id, type, hp, maxHp, atk, def, element, statusEffects:[] }]
  // ================================================================
  startCombat(enemies) {
    const store        = useGameStore.getState();
    const playerStore  = usePlayerStore.getState();
    const playerCount  = store.playerCount;

    // ── 솔로 스케일링 적용 ───────────────────────────────────
    const scale = SOLO_SCALE[playerCount] ?? 1.0;
    this._enemies = enemies.map((e) => ({
      ...e,
      hp:    Math.round(e.maxHp * scale),
      maxHp: Math.round(e.maxHp * scale),
      atk:   Math.round(e.atk  * scale),
      statusEffects: [],
    }));

    // ── 적 AI 인스턴스 생성 ───────────────────────────────────
    this._aiMap.clear();
    for (const e of this._enemies) {
      this._aiMap.set(e.id, new CombatEnemyAI(e));
    }

    // ── 플레이어 덱 셔플 + 5장 드로우 ───────────────────────
    playerStore.initCombatDecks();

    // ── 이니셔티브 계산 ──────────────────────────────────────
    const units = [
      ...playerStore.players.map((p) => ({
        id:       p.id,
        dex:      p.stats.dex,
        isPlayer: true,
      })),
      ...this._enemies.map((e) => ({
        id:       e.id,
        dex:      e.dex ?? 3,
        isPlayer: false,
      })),
    ];
    this._initiative = new Initiative(units);

    this._cycle   = 0;
    this._log     = [];
    this._started = true;

    // 첫 주기 큐 생성
    this._refillQueue();

    useGameStore.getState().enterBattle(this._enemies);
    this._pushLog('⚔️ 전투 시작!');

    // 첫 유닛이 플레이어면 턴 시작 처리 (AP 복원은 initCombatDecks에서 됨 — 드로우만)
    const firstId = this.currentUnit();
    if (firstId) {
      const ps       = usePlayerStore.getState();
      const isPlayer = ps.players.some((p) => p.id === firstId && p.hp > 0);
      if (isPlayer) ps.drawCards(firstId, 1); // 자동 1장 드로우 (initCombatDecks가 5장 처리)
    }

    return { enemies: this._enemies, firstQueue: [...this._turnQueue] };
  }

  // ================================================================
  // 현재 턴의 유닛 ID 반환 (큐 앞에서 peek)
  // ================================================================
  currentUnit() {
    return this._turnQueue[0] ?? null;
  }

  // ================================================================
  // 플레이어 카드 사용
  //
  // @param {string} playerId
  // @param {object} card    { id, effectType, stat, element, tier, apCost }
  // @param {string|null} targetId  null = 광역/자신
  //
  // @returns {{ ok: boolean, reason?: string, result?: object }}
  // ================================================================
  useCard(playerId, card, targetId = null) {
    if (!this._started) return { ok: false, reason: 'NOT_STARTED' };
    if (this.currentUnit() !== playerId) return { ok: false, reason: 'NOT_YOUR_TURN' };

    const playerStore = usePlayerStore.getState();
    const player      = playerStore.getPlayer(playerId);
    if (!player) return { ok: false, reason: 'PLAYER_NOT_FOUND' };

    // AP 확인
    if (player.currentAP < card.apCost) return { ok: false, reason: 'NOT_ENOUGH_AP' };

    // AP 차감
    playerStore.spendAP(playerId, card.apCost);

    // 카드 효과 적용
    const result = this._applyCardEffect(player, card, targetId);

    this._pushLog(`${player.name} → ${card.effectType} 사용 (${result.successes}/${result.total} 성공)`);

    return { ok: true, result };
  }

  // ================================================================
  // 턴 종료 (플레이어가 명시적으로 종료)
  // ================================================================
  endPlayerTurn(playerId) {
    if (this.currentUnit() !== playerId) return { ok: false, reason: 'NOT_YOUR_TURN' };

    // AP 잔량 → 다음 턴으로 미이월 (0으로 리셋)
    usePlayerStore.getState().resetAP(playerId);

    this._advanceTurn();
    return { ok: true, next: this.currentUnit() };
  }

  // ================================================================
  // 적 AI 턴 자동 처리
  // 호출 시점: currentUnit()이 적 ID일 때 외부에서 호출
  //
  // @returns {object} 행동 결과 요약
  // ================================================================
  processEnemyTurn() {
    const enemyId = this.currentUnit();
    const enemy   = this._enemies.find((e) => e.id === enemyId);
    if (!enemy) { this._advanceTurn(); return { skipped: true }; }

    const ai = this._aiMap.get(enemyId);
    if (!ai) { this._advanceTurn(); return { skipped: true }; }

    const playerStore = usePlayerStore.getState();
    const players     = playerStore.players.map((p) => ({
      id:            p.id,
      hp:            p.hp,
      maxHp:         p.maxHp,
      dex:           p.stats.dex,
      statusEffects: p.statusEffects ?? [],
    }));

    const decision = ai.decide({
      enemy:      enemy,
      allEnemies: this._enemies.filter((e) => e.hp > 0),
      players:    players.filter((p) => p.hp > 0),
    });

    const actionResult = this._executeEnemyAction(enemy, decision, players);
    this._pushLog(`👾 ${enemy.id} → ${decision.action}`);

    this._advanceTurn();
    return { decision, actionResult };
  }

  // ================================================================
  // 적 행동 실행
  // ================================================================
  _executeEnemyAction(enemy, decision, players) {
    const { action, targetId, targetAll } = decision;
    const playerStore = usePlayerStore.getState();

    switch (action) {
      case ENEMY_ACTION.ATTACK_SINGLE: {
        if (!targetId) break;
        const target = players.find((p) => p.id === targetId);
        if (!target) break;
        const dmg = this._calcEnemyDamage(enemy, playerStore.getPlayer(targetId));
        playerStore.takeDamage(targetId, dmg);
        return { damage: dmg, target: targetId };
      }

      case ENEMY_ACTION.ATTACK_AOE: {
        const results = [];
        for (const p of players) {
          const dmg = this._calcEnemyDamage(enemy, playerStore.getPlayer(p.id));
          playerStore.takeDamage(p.id, dmg);
          results.push({ damage: dmg, target: p.id });
        }
        return { aoe: true, results };
      }

      case ENEMY_ACTION.DEFEND:
        // 방어 태세: 1주기 DEF 2배 (상태 부여)
        enemy.tempDefBonus = enemy.def; // 다음 주기 초기화 예정
        return { defended: true };

      case ENEMY_ACTION.STATUS_EFFECT: {
        if (!targetId) break;
        const statusType = enemy.element
          ? this._elemToStatus(enemy.element)
          : 'CURSE';
        this._applyStatus(targetId, statusType, STATUS_DURATION_DEFAULT, 'PLAYER');
        return { status: statusType, target: targetId };
      }

      case ENEMY_ACTION.HEAL_ALLY: {
        if (!targetId) break;
        const healTarget = this._enemies.find((e) => e.id === targetId);
        if (healTarget) {
          const healAmt = Math.round(healTarget.maxHp * 0.20);
          healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healAmt);
        }
        return { healed: targetId };
      }

      case ENEMY_ACTION.BUFF_ALLY: {
        if (!targetId) break;
        const buffTarget = this._enemies.find((e) => e.id === targetId);
        if (buffTarget) buffTarget.tempAtkBonus = Math.round(buffTarget.atk * 0.20);
        return { buffed: targetId };
      }

      case ENEMY_ACTION.FLEE: {
        // GDD 13.1: 도주 판정 = DEX 기반 TokenRoll, successes > 0 이면 성공
        const fleeRoll = TokenRoll.roll({ stat: enemy.dex ?? 3 });
        const fled     = fleeRoll.successes > 0;
        if (fled) {
          this._removeEnemy(enemy.id);
          this._pushLog(`💨 ${enemy.id} 도주 성공`);
        }
        return { fled, roll: fleeRoll };
      }

      case ENEMY_ACTION.SPECIAL:
        // 특수 행동: 보스별 구체 구현은 BossAI에서 override
        return { special: true };

      default:
        break;
    }
    return {};
  }

  // ================================================================
  // 카드 효과 적용 (플레이어 → 적)
  // ================================================================
  _applyCardEffect(player, card, targetId) {
    const { effectType, stat: statKey, element, tier } = card;
    const statValue = player.stats[statKey?.toLowerCase()] ?? 5;
    const tierBonus = TIER_BONUS[tier] ?? 0;

    // 타겟 목록 결정
    const targets = this._resolveCardTargets(effectType, targetId);

    let totalSuccesses = 0;
    let totalTokens    = 0;

    for (const tId of targets) {
      const target   = this._getUnit(tId);
      if (!target) continue;

      const roll = TokenRoll.roll({
        stat:        statValue,
        attackElem:  element,
        defenseElem: target.element ?? null,
      });

      totalSuccesses += roll.successes;
      totalTokens    += roll.total;

      // 성공 토큰 수 비례 효과 적용
      this._resolveCardImpact(player, card, target, tId, roll, statValue, tierBonus);
    }

    return { successes: totalSuccesses, total: totalTokens };
  }

  // ── 카드 효과 실제 적용 ───────────────────────────────────────
  _resolveCardImpact(player, card, target, targetId, roll, statValue, tierBonus) {
    const { effectType, element } = card;
    const successRatio = roll.successes / roll.total;
    const playerStore  = usePlayerStore.getState();

    switch (effectType) {
      case 'SLASH':
      case 'PIERCE': {
        // 물리 데미지
        const defIgnore = effectType === 'PIERCE' ? 0.30 : 0;
        const def       = (target.def ?? 0) * (1 - defIgnore);
        const rawDmg    = Math.round(statValue * 1.5 + tierBonus);
        const dmg       = Math.max(0, Math.round(rawDmg * successRatio - def));
        this._applyDamageToTarget(targetId, dmg, target, playerStore);
        // 상태이상 부여 판정
        if (element) this._tryApplyStatus(element, target, targetId, roll);
        break;
      }
      case 'BURST': {
        // 범위 마법 데미지
        const rawDmg = Math.round(statValue * 1.5 + tierBonus);
        const def    = Math.round((target.magDef ?? target.def ?? 0));
        const dmg    = Math.max(0, Math.round(rawDmg * successRatio - def));
        this._applyDamageToTarget(targetId, dmg, target, playerStore);
        if (element) this._tryApplyStatus(element, target, targetId, roll);
        break;
      }
      case 'FOCUS': {
        // 단일 고배율 마법
        const rawDmg = Math.round(statValue * 2.5 + tierBonus);
        const def    = Math.round((target.magDef ?? target.def ?? 0));
        const dmg    = Math.max(0, Math.round(rawDmg * successRatio - def));
        this._applyDamageToTarget(targetId, dmg, target, playerStore);
        if (element) this._tryApplyStatus(element, target, targetId, roll);
        break;
      }
      case 'EMPOWER':
        playerStore.applyBuff(targetId, { atk: Math.round(statValue * successRatio) }, 1);
        break;
      case 'GUARD':
        playerStore.applyBuff(targetId, { def: Math.round(statValue * successRatio) }, 1);
        break;
      case 'HASTE':
        playerStore.applyBuff(targetId, { dex: Math.round(successRatio * 2) }, 1);
        this._initiative?.updateDex(targetId, player.stats.dex + Math.round(successRatio * 2));
        break;
      case 'REGEN':
        playerStore.applyStatus(targetId, 'REGEN', STATUS_DURATION_DEFAULT);
        break;
      case 'DRAW':
        playerStore.drawCards(player.id, Math.max(1, Math.round(successRatio * 2)));
        break;
      case 'SENSE':
        playerStore.peekDeck(player.id, 3);
        break;
      case 'COUNTER':
        playerStore.applyPassive(player.id, 'COUNTER', { charges: 1 });
        break;
      case 'BARRIER':
        playerStore.applyPassive(player.id, 'BARRIER', {
          reduction: Math.round(successRatio * 0.3 * 100), // 30% 감소
          duration:  STATUS_DURATION_DEFAULT,
        });
        break;
      case 'TAUNT':
        playerStore.applyStatus(player.id, 'TAUNT', STATUS_DURATION_DEFAULT);
        break;
      default:
        break;
    }
  }

  // ── 카드 타겟 목록 결정 ───────────────────────────────────────
  _resolveCardTargets(effectType, targetId) {
    // 광역: 모든 살아있는 적
    if (effectType === 'BURST') {
      return this._enemies.filter((e) => e.hp > 0).map((e) => e.id);
    }
    // 자신 대상 버프/패시브
    if (['REGEN', 'COUNTER', 'BARRIER', 'TAUNT', 'DRAW', 'SENSE'].includes(effectType)) {
      return [targetId ?? usePlayerStore.getState().players[0]?.id];
    }
    return targetId ? [targetId] : [];
  }

  // ── 속성 상태이상 부여 시도 ───────────────────────────────────
  _tryApplyStatus(element, target, targetId, roll) {
    const baseChance = TokenRoll.statusBonusRate(element, target.element);
    const chance     = baseChance + (roll.successes / roll.total) * 0.15;
    if (Math.random() < chance) {
      const status = this._elemToStatus(element);
      this._applyStatus(targetId, status, STATUS_DURATION_DEFAULT, 'ENEMY');
    }
  }

  // ── 속성 → 상태이상 변환 ──────────────────────────────────────
  _elemToStatus(element) {
    const map = { FIRE: 'BURN', ICE: 'FREEZE', LIGHTNING: 'SHOCK', DARK: 'CURSE' };
    return map[element?.toUpperCase()] ?? 'CURSE';
  }

  // ── 상태이상 적용 ─────────────────────────────────────────────
  _applyStatus(unitId, statusType, duration, side) {
    if (side === 'PLAYER') {
      usePlayerStore.getState().applyStatus(unitId, statusType, duration);
    } else {
      const enemy = this._enemies.find((e) => e.id === unitId);
      if (!enemy) return;
      const existing = enemy.statusEffects.find((s) => s.type === statusType);
      if (existing) {
        existing.duration += duration; // 중첩 → 지속 연장
      } else {
        enemy.statusEffects.push({ type: statusType, duration });
      }
    }
    // 감전 전파
    if (statusType === 'SHOCK') this._propagateShock(unitId, side);
  }

  // ── 감전 전파 (인접 유닛 1개) ────────────────────────────────
  _propagateShock(sourceId, side) {
    if (side === 'PLAYER') {
      const players  = usePlayerStore.getState().players;
      const srcIndex = players.findIndex((p) => p.id === sourceId);
      if (srcIndex < 0) return;
      const src      = players[srcIndex];
      const adjacent = players.find(
        (p) => p.id !== sourceId && p.position === src.position,
      );
      if (adjacent && !adjacent.statusEffects?.some((s) => s.type === 'SHOCK')) {
        usePlayerStore.getState().applyStatus(adjacent.id, 'SHOCK', 1);
      }
    } else {
      const srcIdx  = this._enemies.findIndex((e) => e.id === sourceId);
      if (srcIdx < 0) return;
      const adjacent = this._enemies.find(
        (e) => e.id !== sourceId && e.hp > 0 &&
               !e.statusEffects.some((s) => s.type === 'SHOCK'),
      );
      if (adjacent) {
        adjacent.statusEffects.push({ type: 'SHOCK', duration: 1 });
      }
    }
  }

  // ── 데미지 적용 ───────────────────────────────────────────────
  _applyDamageToTarget(targetId, dmg, target, playerStore) {
    const enemy = this._enemies.find((e) => e.id === targetId);
    if (enemy) {
      enemy.hp = Math.max(0, enemy.hp - dmg);
      if (enemy.hp <= 0) this._onEnemyDeath(enemy);
    } else {
      playerStore.takeDamage(targetId, dmg);
    }
  }

  // ── 적 사망 처리 ─────────────────────────────────────────────
  _onEnemyDeath(enemy) {
    this._pushLog(`💀 ${enemy.id} 처치!`);
    this._initiative?.removeUnit(enemy.id);
    // 죽은 적을 큐에서 제거
    this._turnQueue = this._turnQueue.filter((id) => id !== enemy.id);
    this._checkBattleEnd();
  }

  // ── 적 제거 (도주) ────────────────────────────────────────────
  _removeEnemy(enemyId) {
    this._enemies     = this._enemies.filter((e) => e.id !== enemyId);
    this._turnQueue   = this._turnQueue.filter((id) => id !== enemyId);
    this._initiative?.removeUnit(enemyId);
    this._checkBattleEnd();
  }

  // ── 적 단위 데미지 계산 ───────────────────────────────────────
  _calcEnemyDamage(enemy, player) {
    const atk = (enemy.atk ?? 5) + (enemy.tempAtkBonus ?? 0);
    const def = player?.stats?.str ?? 3; // 물리 방어
    return Math.max(0, atk - Math.floor(def * 0.5));
  }

  // ================================================================
  // 주기(Cycle) 상태이상 틱 처리
  // ================================================================
  _tickStatusEffects() {
    const playerStore = usePlayerStore.getState();

    // 플레이어 상태이상 틱
    playerStore.tickStatusEffects();

    // 적 상태이상 틱
    for (const enemy of this._enemies) {
      const toRemove = [];
      for (const s of enemy.statusEffects) {
        // 지속 데미지
        if (s.type === 'BURN' || s.type === 'POISON') {
          const dot = Math.round(enemy.maxHp * 0.05);
          enemy.hp  = Math.max(0, enemy.hp - dot);
          if (enemy.hp <= 0) this._onEnemyDeath(enemy);
        }
        s.duration -= 1;
        if (s.duration <= 0) toRemove.push(s);
      }
      enemy.statusEffects = enemy.statusEffects.filter((s) => !toRemove.includes(s));
      // 임시 버프 초기화
      delete enemy.tempDefBonus;
      delete enemy.tempAtkBonus;
    }
  }

  // ================================================================
  // 턴 큐 진행
  // ================================================================
  _advanceTurn() {
    this._turnQueue.shift();
    if (this._turnQueue.length === 0) {
      // 주기 종료 → 상태이상 틱 → 다음 주기
      this._tickStatusEffects();
      this._cycle++;
      this._refillQueue();
    }
    // GDD 13.1: 다음 유닛이 플레이어면 턴 시작 처리 (AP 복원 + 자동 1장 드로우)
    const nextId = this.currentUnit();
    if (nextId) {
      const ps       = usePlayerStore.getState();
      const isPlayer = ps.players.some((p) => p.id === nextId && p.hp > 0);
      if (isPlayer) {
        ps.resetAP(nextId);   // AP = DEX 값으로 복원
        ps.drawCards(nextId, 1); // 자동 1장 드로우
      }
    }
  }

  // 다음 주기 큐 채우기
  _refillQueue() {
    this._turnQueue = this._initiative?.nextCycle() ?? [];
    // 죽은 유닛 제거
    const deadEnemies  = new Set(this._enemies.filter((e) => e.hp <= 0).map((e) => e.id));
    const deadPlayers  = new Set(
      usePlayerStore.getState().players.filter((p) => p.hp <= 0).map((p) => p.id),
    );
    this._turnQueue = this._turnQueue.filter(
      (id) => !deadEnemies.has(id) && !deadPlayers.has(id),
    );
  }

  // ================================================================
  // 승패 판정
  // ================================================================
  _checkBattleEnd() {
    const livingEnemies = this._enemies.filter((e) => e.hp > 0);
    const livingPlayers = usePlayerStore.getState().players.filter((p) => p.hp > 0);

    if (livingEnemies.length === 0) {
      this._endCombat('WIN');
    } else if (livingPlayers.length === 0) {
      this._endCombat('LOSE');
    }
  }

  _endCombat(outcome) {
    this._started = false;
    const store   = useGameStore.getState();
    store.exitBattle();

    if (outcome === 'LOSE') {
      this._pushLog('💔 전투 패배');
      store.triggerGameOver('PARTY_WIPED');
    } else {
      this._pushLog('🎉 전투 승리!');
      // 경험치 / 골드 보상은 외부(WorldMapScene)에서 처리
    }
  }

  // ================================================================
  // 유닛 조회 (플레이어 or 적)
  // ================================================================
  _getUnit(unitId) {
    const enemy = this._enemies.find((e) => e.id === unitId);
    if (enemy) return enemy;
    const player = usePlayerStore.getState().getPlayer(unitId);
    return player ?? null;
  }

  // ── 로그 추가 (최근 20개 유지) ───────────────────────────────
  _pushLog(msg) {
    this._log.push(msg);
    if (this._log.length > 20) this._log.shift();
    useGameStore.getState().addBattleLog(msg);
  }

  // ── 외부용 상태 스냅샷 ───────────────────────────────────────
  snapshot() {
    return {
      cycle:     this._cycle,
      turnQueue: [...this._turnQueue],
      current:   this.currentUnit(),
      enemies:   this._enemies.map((e) => ({ ...e })),
      log:       [...this._log],
    };
  }
}