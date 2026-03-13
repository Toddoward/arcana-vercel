// ============================================================
// src/game/data/quests.js
// 퀘스트 데이터 — 튜토리얼(3단계) + 메인 퀘스트(4단계)
//
// GDD: §24.8(튜토리얼 퀘스트) §25(메인 퀘스트 마일스톤 4단계)
//
// 의존:
//   enemies.js — QUEST_BOSS_IDS
//   gameStore.js — questProgress 필드로 현재 단계 추적
// ============================================================

// 퀘스트 상태
export const QUEST_STATUS = {
  LOCKED:      'LOCKED',       // 미해금
  ACTIVE:      'ACTIVE',       // 진행 중
  COMPLETED:   'COMPLETED',    // 완료
  SKIPPED:     'SKIPPED',      // 스킵 (튜토리얼 전용)
};

// 퀘스트 타입
export const QUEST_TYPE = {
  TUTORIAL:    'TUTORIAL',
  MAIN:        'MAIN',
};

// ================================================================
// 튜토리얼 퀘스트 (GDD §24.8)
// ================================================================
export const TUTORIAL_QUEST = {
  id:    'tutorial',
  type:  QUEST_TYPE.TUTORIAL,
  name:  '모험가의 첫 걸음',
  desc:  '왕국 성 바이옴 내에서 기본 조작을 익힙니다.',

  // GDD §24.8: 스킵 가능 — 보상 없음 + 드래곤 유예 턴 감소
  skippable: true,

  chains: [
    {
      id:    'tutorial_1',
      step:  1,
      name:  '배달부의 첫 심부름',
      desc:  '성 존 내 지정 마을까지 아이템을 배달하세요.',
      // GDD §24.8: 월드맵 이동 / 턴 소비 / 배달 실패 조건 학습
      objective: {
        type:       'REACH_TILE',
        targetType: 'VILLAGE',
        biome:      'CASTLE_ZONE',
      },
      reward: { exp: 50, gold: 20 },
      teachConcepts: ['월드맵 이동', '턴 소비', '배달 실패 조건'],
    },
    {
      id:    'tutorial_2',
      step:  2,
      name:  '첫 전투의 세례',
      desc:  '마을에서 사냥 퀘스트를 받아 적 타일에서 전투하세요.',
      // GDD §24.8: 전투 기본 / 카드 사용 / AP 시스템 학습
      objective: {
        type:    'WIN_BATTLE',
        biome:   'CASTLE_ZONE',
        count:   1,
      },
      reward: { exp: 80, gold: 30 },
      teachConcepts: ['전투 기본', '카드 사용', 'AP 시스템'],
    },
    {
      id:    'tutorial_3',
      step:  3,
      name:  '던전의 첫 발걸음',
      desc:  '성 존 내 던전에 입장해 첫 번째 노드를 클리어하세요.',
      // GDD §24.8: 던전 노드 구조 / 보상 체계 학습
      objective: {
        type:    'CLEAR_DUNGEON_NODE',
        biome:   'CASTLE_ZONE',
        nodeIdx: 0,
      },
      reward: { exp: 100, gold: 40 },
      teachConcepts: ['던전 노드 구조', '보상 체계'],
    },
  ],

  // GDD §24.8: 스킵 선택 시 드래곤 유예 턴 감소
  skipPenalty: {
    dragonGraceTurnReduction: 3,
  },
};

// ================================================================
// 메인 퀘스트 (GDD §25 — 마일스톤 4단계)
// ================================================================
export const MAIN_QUESTS = [

  // ── 1단계: 징조 ──────────────────────────────────────────
  {
    id:    'main_1',
    type:  QUEST_TYPE.MAIN,
    stage: 1,
    name:  '징조',
    desc:  '드래곤의 저주가 마을에 퍼지기 시작했다. 와이번을 처치하라.',

    objective: {
      type:    'DEFEAT_BOSS',
      bossId:  'wyvern',
      // GDD §25: 특정 지역 랜덤 스폰 → 적 AI 턴마다 이동
      spawnRule: {
        type:   'RANDOM_REGION',
        moves:  true,  // 매 적 AI 턴 이동
      },
    },

    unlockCondition: {
      type:    'QUEST_COMPLETE',
      questId: 'tutorial',  // 튜토리얼 완료 or 스킵 후 해금
    },

    reward: {
      exp:   300,
      gold:  100,
      unlock: 'main_2',
    },

    stageNarrative: '마을 상인들의 얼굴에 공포가 가득하다. "저 산 너머에서 날아왔습니다... 불을 뿜는 뱀이..."',
  },

  // ── 2단계: 추적 ──────────────────────────────────────────
  {
    id:    'main_2',
    type:  QUEST_TYPE.MAIN,
    stage: 2,
    name:  '추적',
    desc:  '고대 유물 3개를 수집하라. 각각 골렘, 리치, 그리핀이 수호하고 있다.',

    // GDD §25: 아이코닉 보스 3종 모두 처치
    objective: {
      type:     'DEFEAT_ALL_BOSSES',
      bossIds:  ['golem', 'lich', 'griffin'],
      collected: [],  // 처치 시마다 추가
      spawnRule: {
        type:  'RANDOM_REGION',
        moves: true,
      },
    },

    unlockCondition: {
      type:    'QUEST_COMPLETE',
      questId: 'main_1',
    },

    reward: {
      exp:    800,
      gold:   250,
      items:  ['ancient_relic'],  // 스토리 아이템
      unlock: 'main_3',
    },

    stageNarrative: '고대 기록에 따르면, 드래곤을 봉인하려면 세 개의 유물이 필요하다.',
  },

  // ── 3단계: 봉인 해제 ─────────────────────────────────────
  {
    id:    'main_3',
    type:  QUEST_TYPE.MAIN,
    stage: 3,
    name:  '봉인 해제',
    desc:  '드래곤 둥지의 봉인을 해제하기 위해 드래곤나이트를 처치하라.',

    objective: {
      type:   'DEFEAT_BOSS',
      bossId: 'dragon_knight',
      spawnRule: {
        type:  'RANDOM_REGION',
        moves: true,
      },
    },

    unlockCondition: {
      type:    'QUEST_COMPLETE',
      questId: 'main_2',
    },

    reward: {
      exp:    1200,
      gold:   400,
      unlock: 'main_4',
    },

    stageNarrative: '유물을 손에 쥐자 드래곤 둥지의 방향이 느껴진다. 하지만 기사가 길을 막고 있다.',
  },

  // ── 4단계: 결전 ──────────────────────────────────────────
  {
    id:    'main_4',
    type:  QUEST_TYPE.MAIN,
    stage: 4,
    name:  '결전',
    desc:  '레드 드래곤의 둥지 던전을 공략하거나, 월드맵에서 강제 전투로 최종 보스를 처치하라.',

    // GDD §25: 던전 공략 or 월드맵 강제 전투
    objective: {
      type:    'DEFEAT_BOSS',
      bossId:  'red_dragon',
      spawnRule: {
        type:  'FIXED_NEST',  // 드래곤 네스트 고정 위치 (GDD §19.1)
        moves: false,
      },
      alternativeRoute: {
        type:  'WORLD_MAP_FORCED_BATTLE',
        desc:  '드래곤이 성에 도달하기 전 월드맵에서 가로막기',
      },
    },

    unlockCondition: {
      type:    'QUEST_COMPLETE',
      questId: 'main_3',
    },

    reward: {
      type:    'ENDING',
      exp:     0,
      gold:    999,
    },

    stageNarrative: '마침내 드래곤의 둥지 앞에 섰다. 모든 파티가 준비를 마쳤다.',
  },
];

// ================================================================
// 공개 API
// ================================================================

/** 퀘스트 ID로 조회 */
export function getQuestById(id) {
  if (id === 'tutorial') return TUTORIAL_QUEST;
  return MAIN_QUESTS.find((q) => q.id === id) ?? null;
}

/** 현재 메인 퀘스트 단계 반환
 * @param {object} questProgress  gameStore.questProgress
 * @returns {object|null} 현재 활성 메인 퀘스트
 */
export function getActiveMainQuest(questProgress = {}) {
  for (const quest of MAIN_QUESTS) {
    const status = questProgress[quest.id] ?? QUEST_STATUS.LOCKED;
    if (status === QUEST_STATUS.ACTIVE) return quest;
  }
  return null;
}

/** 튜토리얼 완료/스킵 여부 판별 */
export function isTutorialDone(questProgress = {}) {
  const s = questProgress['tutorial'];
  return s === QUEST_STATUS.COMPLETED || s === QUEST_STATUS.SKIPPED;
}

/** 퀘스트 보상 목록 (UI 표시용) */
export function getQuestRewardSummary(questId) {
  const q = getQuestById(questId);
  if (!q) return null;
  const r = q.reward ?? q.chains?.reduce((acc, c) => ({
    exp:  (acc.exp  ?? 0) + (c.reward?.exp  ?? 0),
    gold: (acc.gold ?? 0) + (c.reward?.gold ?? 0),
  }), {});
  return r;
}
