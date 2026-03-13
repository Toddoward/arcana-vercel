// ============================================================
// src/game/data/enemies.js
// 적 데이터 — 일반 적 / 중간 보스 / 레드 드래곤
//
// GDD: §24.5(적 템플릿 6종) §26(중간보스 메커니즘) §27(레드 드래곤)
//
// 의존:
//   EnemyAI.js  — ENEMY_TYPE (type 필드 반드시 일치)
//   constants.js — ELEMENT, STATUS
//
// ENEMY_TYPE ↔ GDD §24.5 매핑:
//   SMALL   = 소형 (HP 낮음, DEX 높음)
//   DEFAULT = 중형 (균형형, 단일 강공격)
//   LARGE   = 대형 (HP 높음, 광역 공격)
//   MAGIC   = 마법형 (원거리 마법, 버프)
//   SUPPORT = 지원형 (아군 버프/힐)
//   BOSS    = 특수형 / 보스 (분열/소환/변신 + 중간보스/최종보스)
// ============================================================

import { ENEMY_TYPE } from '../battle/EnemyAI.js';
import { ELEMENT, STATUS } from '../../constants/constants.js';

// ================================================================
// 적 데이터 구조:
// {
//   id:         string    — 고유 ID
//   name:       string    — 표시 이름
//   icon:       string    — 이모지 아이콘
//   type:       ENEMY_TYPE.*  — AI 행동 패턴 결정
//   hp:         number    — 최대 HP
//   atk:        number    — 공격력
//   def:        number    — 방어력
//   magDef:     number    — 마법 방어력
//   dex:        number    — 이니셔티브/AP 기준
//   element:    ELEMENT.* | null — 속성
//   position:   'FRONT'|'BACK'  — 기본 포지션
//   expReward:  number    — 처치 시 경험치 (GDD §6.6)
//   goldReward: number    — 처치 시 골드
//   special:    object    — 보스 전용 특수 행동 정의
// }
// ================================================================

// ── 일반 적 (GDD §24.5 템플릿 기반) ──────────────────────────

export const ENEMIES = {

  // ── 소형 (SMALL) ─────────────────────────────────────────
  goblin: {
    id: 'goblin', name: '고블린', icon: '👺',
    type:     ENEMY_TYPE.SMALL,
    hp: 30,  atk: 6,  def: 2,  magDef: 1,  dex: 8,
    element:  null,
    position: 'FRONT',
    expReward: 15, goldReward: 5,
    special:  null,
  },

  rat_swarm: {
    id: 'rat_swarm', name: '쥐떼', icon: '🐀',
    type:     ENEMY_TYPE.SMALL,
    hp: 20,  atk: 4,  def: 1,  magDef: 1,  dex: 10,
    element:  ELEMENT.DARK,
    position: 'FRONT',
    expReward: 10, goldReward: 3,
    special:  null,
  },

  kobold: {
    id: 'kobold', name: '코볼트', icon: '🦎',
    type:     ENEMY_TYPE.SMALL,
    hp: 35,  atk: 7,  def: 3,  magDef: 2,  dex: 9,
    element:  null,
    position: 'FRONT',
    expReward: 18, goldReward: 6,
    special:  null,
  },

  // ── 중형 (DEFAULT) ────────────────────────────────────────
  orc_warrior: {
    id: 'orc_warrior', name: '오크 전사', icon: '👹',
    type:     ENEMY_TYPE.DEFAULT,
    hp: 70,  atk: 12, def: 6,  magDef: 3,  dex: 5,
    element:  null,
    position: 'FRONT',
    expReward: 30, goldReward: 12,
    special:  null,
  },

  skeleton: {
    id: 'skeleton', name: '스켈레톤', icon: '💀',
    type:     ENEMY_TYPE.DEFAULT,
    hp: 55,  atk: 10, def: 4,  magDef: 5,  dex: 5,
    element:  ELEMENT.DARK,
    position: 'FRONT',
    expReward: 25, goldReward: 8,
    special:  null,
  },

  bandit: {
    id: 'bandit', name: '산적', icon: '🗡️',
    type:     ENEMY_TYPE.DEFAULT,
    hp: 60,  atk: 11, def: 5,  magDef: 2,  dex: 6,
    element:  null,
    position: 'FRONT',
    expReward: 28, goldReward: 15,
    special:  null,
  },

  // ── 대형 (LARGE) ──────────────────────────────────────────
  troll: {
    id: 'troll', name: '트롤', icon: '🧌',
    type:     ENEMY_TYPE.LARGE,
    hp: 140, atk: 18, def: 8,  magDef: 4,  dex: 3,
    element:  null,
    position: 'FRONT',
    expReward: 55, goldReward: 22,
    special:  null,
  },

  ogre: {
    id: 'ogre', name: '오거', icon: '🦍',
    type:     ENEMY_TYPE.LARGE,
    hp: 160, atk: 20, def: 10, magDef: 3,  dex: 2,
    element:  null,
    position: 'FRONT',
    expReward: 65, goldReward: 28,
    special:  null,
  },

  stone_giant: {
    id: 'stone_giant', name: '석상 거인', icon: '🗿',
    type:     ENEMY_TYPE.LARGE,
    hp: 180, atk: 22, def: 14, magDef: 6,  dex: 2,
    element:  ELEMENT.ICE,
    position: 'FRONT',
    expReward: 80, goldReward: 35,
    special:  null,
  },

  // ── 마법형 (MAGIC) ────────────────────────────────────────
  dark_mage: {
    id: 'dark_mage', name: '암흑 마법사', icon: '🧙',
    type:     ENEMY_TYPE.MAGIC,
    hp: 45,  atk: 15, def: 2,  magDef: 8,  dex: 6,
    element:  ELEMENT.DARK,
    position: 'BACK',
    expReward: 40, goldReward: 18,
    special:  null,
  },

  fire_imp: {
    id: 'fire_imp', name: '화염 임프', icon: '🔥',
    type:     ENEMY_TYPE.MAGIC,
    hp: 38,  atk: 13, def: 1,  magDef: 6,  dex: 7,
    element:  ELEMENT.FIRE,
    position: 'BACK',
    expReward: 35, goldReward: 14,
    special:  null,
  },

  frost_witch: {
    id: 'frost_witch', name: '서리 마녀', icon: '❄️',
    type:     ENEMY_TYPE.MAGIC,
    hp: 50,  atk: 16, def: 2,  magDef: 9,  dex: 5,
    element:  ELEMENT.ICE,
    position: 'BACK',
    expReward: 45, goldReward: 20,
    special:  null,
  },

  // ── 지원형 (SUPPORT) ──────────────────────────────────────
  goblin_shaman: {
    id: 'goblin_shaman', name: '고블린 샤먼', icon: '🍄',
    type:     ENEMY_TYPE.SUPPORT,
    hp: 40,  atk: 5,  def: 2,  magDef: 7,  dex: 5,
    element:  ELEMENT.DARK,
    position: 'BACK',
    expReward: 35, goldReward: 15,
    special:  null,
  },

  orc_healer: {
    id: 'orc_healer', name: '오크 치료사', icon: '🌿',
    type:     ENEMY_TYPE.SUPPORT,
    hp: 55,  atk: 6,  def: 4,  magDef: 6,  dex: 4,
    element:  null,
    position: 'BACK',
    expReward: 38, goldReward: 16,
    special:  null,
  },

  // ── 특수형 / 중간보스 (BOSS) ─────────────────────────────

  // GDD §25 1단계: 와이번 (HP 300)
  wyvern: {
    id: 'wyvern', name: '와이번', icon: '🐲',
    type:     ENEMY_TYPE.BOSS,
    hp: 300, atk: 20, def: 10, magDef: 8,  dex: 6,
    element:  ELEMENT.LIGHTNING,
    position: 'FRONT',
    expReward: 200, goldReward: 80,
    special: {
      // GDD §26: 독 브레스 / 돌진 / 상승
      actions: [
        {
          id:     'poison_breath',
          label:  '독 브레스',
          // 전체 독 상태이상 부여
          effect: { type: 'STATUS_ALL', status: STATUS.POISON, duration: 2 },
          apCost: 3,
        },
        {
          id:     'charge',
          label:  '돌진',
          // 단일 고데미지
          effect: { type: 'DAMAGE_SINGLE', multiplier: 2.0 },
          apCost: 3,
        },
        {
          id:     'ascend',
          label:  '상승',
          // 1주기 Back열만 공격 가능
          effect: { type: 'POSITION_LOCK', duration: 1 },
          apCost: 2,
        },
      ],
    },
  },

  // GDD §25 2단계: 골렘 (HP 500, 높은 방어력)
  golem: {
    id: 'golem', name: '골렘', icon: '🗿',
    type:     ENEMY_TYPE.BOSS,
    hp: 500, atk: 22, def: 20, magDef: 10, dex: 2,
    element:  null,
    position: 'FRONT',
    expReward: 350, goldReward: 120,
    special: {
      // GDD §26: 바위 던지기 / 방어 태세 / HP 50% 이하 소형 골렘 소환
      actions: [
        {
          id:     'rock_throw',
          label:  '바위 던지기',
          effect: { type: 'DAMAGE_SINGLE_STUN', multiplier: 1.5, stunRate: 0.4 },
          apCost: 3,
        },
        {
          id:     'guard_stance',
          label:  '방어 태세',
          effect: { type: 'SELF_DEF_DOUBLE', duration: 1 },
          apCost: 2,
        },
      ],
      phaseBreak: {
        hpThreshold: 0.5,
        triggered:   false,
        effect: { type: 'SUMMON', summonId: 'mini_golem', count: 2 },
      },
    },
  },

  // GDD §25 2단계: 리치 (HP 280, 높은 공격력)
  lich: {
    id: 'lich', name: '리치', icon: '💀',
    type:     ENEMY_TYPE.BOSS,
    hp: 280, atk: 28, def: 4,  magDef: 14, dex: 5,
    element:  ELEMENT.DARK,
    position: 'BACK',
    expReward: 300, goldReward: 100,
    special: {
      // GDD §26: 이중 저주 / 스켈레톤 소환 / HP 0 도달 시 1회 자동 부활
      actions: [
        {
          id:     'double_curse',
          label:  '이중 저주',
          effect: { type: 'STATUS_SINGLE_MULTI', statuses: [STATUS.CURSE, STATUS.CONFUSION], duration: 2 },
          apCost: 3,
        },
        {
          id:     'summon_skeleton',
          label:  '스켈레톤 소환',
          effect: { type: 'SUMMON', summonId: 'skeleton', count: 2 },
          apCost: 2,
        },
      ],
      revive: {
        // HP 0 도달 시 1회 자동 부활 (이후 방어력 0)
        once:    true,
        hp:      Math.floor(280 * 0.3),
        defAfter: 0,
      },
    },
  },

  // GDD §25 2단계: 그리핀 (HP 380)
  griffin: {
    id: 'griffin', name: '그리핀', icon: '🦅',
    type:     ENEMY_TYPE.BOSS,
    hp: 380, atk: 24, def: 8,  magDef: 7,  dex: 8,
    element:  ELEMENT.LIGHTNING,
    position: 'FRONT',
    expReward: 280, goldReward: 110,
    special: {
      // GDD §26: 급습(DEX 최고 우선) / 바람 폭풍(전체 DEX 감소) / 비행+착지(전체 기절)
      actions: [
        {
          id:     'pounce',
          label:  '급습',
          effect: { type: 'DAMAGE_SINGLE_HIGHEST_DEX', multiplier: 1.8 },
          apCost: 3,
          targetOverride: 'HIGHEST_DEX',
        },
        {
          id:     'windstorm',
          label:  '바람 폭풍',
          effect: { type: 'STATUS_ALL', status: STATUS.CONFUSION, duration: 1,
                    statDebuff: { DEX: -3 } },
          apCost: 2,
        },
        {
          id:     'dive',
          label:  '비행+강하',
          effect: { type: 'UNTARGETABLE_THEN_AOE_STUN', noTargetDuration: 1, stunRate: 0.5 },
          apCost: 4,
        },
      ],
    },
  },

  // GDD §25 3단계: 드래곤나이트 (HP 600)
  dragon_knight: {
    id: 'dragon_knight', name: '드래곤나이트', icon: '🐴',
    type:     ENEMY_TYPE.BOSS,
    hp: 600, atk: 30, def: 15, magDef: 12, dex: 5,
    element:  ELEMENT.FIRE,
    position: 'FRONT',
    expReward: 450, goldReward: 180,
    special: {
      // GDD §26: 화염검(단일+화상) / 돌격(Front열 전체) / HP 30% 이하 분노(+50%)
      actions: [
        {
          id:     'flame_sword',
          label:  '화염검',
          effect: { type: 'DAMAGE_SINGLE_STATUS', multiplier: 1.8, status: STATUS.BURN, duration: 2 },
          apCost: 3,
        },
        {
          id:     'charge_front',
          label:  '돌격',
          effect: { type: 'DAMAGE_ROW', row: 'FRONT', multiplier: 1.2 },
          apCost: 3,
        },
      ],
      phaseBreak: {
        hpThreshold: 0.3,
        triggered:   false,
        effect: { type: 'STAT_BOOST_ALL', percent: 0.5 }, // 전 스탯 +50%
      },
    },
  },

  // GDD §27: 레드 드래곤 (최종보스, 3페이즈)
  red_dragon: {
    id: 'red_dragon', name: '레드 드래곤', icon: '🐉',
    type:     ENEMY_TYPE.BOSS,
    hp: 1200, atk: 35, def: 18, magDef: 15, dex: 6,
    element:  ELEMENT.FIRE,
    position: 'FRONT',
    expReward: 0,    // 최종 보스 — 경험치 대신 엔딩
    goldReward: 999,
    special: {
      phases: [
        // 페이즈 1: HP 100~60%
        {
          hpRange: [0.60, 1.00],
          actions: [
            {
              id:     'breath',
              label:  '브레스',
              effect: { type: 'STATUS_ALL', status: STATUS.BURN, duration: 2 },
              apCost: 3,
            },
            {
              id:     'claw',
              label:  '클로 공격',
              effect: { type: 'DAMAGE_SINGLE', multiplier: 1.5 },
              apCost: 2,
            },
          ],
        },
        // 페이즈 2: HP 60~30% — GDD §27: 비행(모든 플레이어 Back 취급)
        {
          hpRange: [0.30, 0.60],
          onEnter: { type: 'FORCE_ALL_BACK' }, // 모든 플레이어 → Back 포지션
          actions: [
            {
              id:     'fly',
              label:  '비행',
              effect: { type: 'SELF_UNTARGETABLE', duration: 1 },
              apCost: 2,
            },
            {
              id:     'land',
              label:  '착지',
              effect: { type: 'AOE_STUN', stunRate: 0.5 },
              apCost: 3,
            },
          ],
        },
        // 페이즈 3: HP 30~0% — GDD §27: 분노(행동 증가) + 화염 장판
        {
          hpRange: [0.00, 0.30],
          onEnter: { type: 'RAGE', actionCountBonus: 1 },
          actions: [
            {
              id:     'flame_field',
              label:  '화염 장판',
              effect: { type: 'DOT_ALL_IGNORE_POSITION', status: STATUS.BURN, duration: 3 },
              apCost: 4,
            },
            {
              id:     'frenzy_claw',
              label:  '광란의 클로',
              effect: { type: 'DAMAGE_SINGLE', multiplier: 2.0 },
              apCost: 2,
            },
          ],
        },
      ],
    },
  },

  // 소형 골렘 (골렘 소환)
  mini_golem: {
    id: 'mini_golem', name: '소형 골렘', icon: '🪨',
    type:     ENEMY_TYPE.SMALL,
    hp: 60,  atk: 10, def: 8,  magDef: 4,  dex: 3,
    element:  null,
    position: 'FRONT',
    expReward: 25, goldReward: 8,
    special:  null,
  },
};

// ================================================================
// 공개 API
// ================================================================

/** ID로 적 데이터 조회 */
export function getEnemyById(id) {
  return ENEMIES[id] ?? null;
}

/** 바이옴/티어에 맞는 일반 적 목록 반환 (조우 시 랜덤 선택용)
 * @param {'early'|'mid'|'late'} tier
 * @returns {object[]}
 */
export function getEnemyPool(tier = 'early') {
  const pools = {
    early: ['goblin', 'rat_swarm', 'kobold', 'skeleton', 'bandit'],
    mid:   ['orc_warrior', 'dark_mage', 'goblin_shaman', 'troll', 'fire_imp', 'frost_witch'],
    late:  ['ogre', 'stone_giant', 'orc_healer', 'bandit'],
  };
  return (pools[tier] ?? pools.early).map((id) => ENEMIES[id]).filter(Boolean);
}

/** 메인 퀘스트 단계별 중간 보스 ID 반환 (GDD §25) */
export const QUEST_BOSS_IDS = {
  stage1: 'wyvern',
  stage2: ['golem', 'lich', 'griffin'],
  stage3: 'dragon_knight',
  stage4: 'red_dragon',
};
