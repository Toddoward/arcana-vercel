// ============================================================
// constants.js
// GDD_master.md 기반 전체 수치 데이터 집결 파일
// 모든 게임 로직 파일은 이 파일을 import해서 사용한다.
// ============================================================

// ─────────────────────────────────────────
// 1. 게임 전반 설정
// ─────────────────────────────────────────
export const GAME = {
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 1,
  LOBBY_CODE_LENGTH: 6,
  HOST_HEARTBEAT_TIMEOUT_MS: 3000, // 호스트 탈주 감지 타임아웃
};

// ─────────────────────────────────────────
// 2. 씬 식별자
// ─────────────────────────────────────────
export const SCENE = {
  MAIN_MENU:        'MAIN_MENU',
  LOBBY:            'LOBBY',
  CHARACTER_SELECT: 'CHARACTER_SELECT',
  WORLD_MAP:        'WORLD_MAP',
  BATTLE:           'BATTLE',
  DUNGEON:          'DUNGEON',
  RESULT:           'RESULT',
};

// ─────────────────────────────────────────
// 3. 클래스 식별자
// ─────────────────────────────────────────
export const CLASS = {
  FIGHTER: 'FIGHTER',
  WIZARD:  'WIZARD',
  CLERIC:  'CLERIC',
  ROGUE:   'ROGUE',
  BARD:    'BARD',
};

// ─────────────────────────────────────────
// 4. 클래스별 초기 스탯 (총합 30 균등)
// ─────────────────────────────────────────
export const CLASS_BASE_STATS = {
  [CLASS.FIGHTER]: { STR: 8, DEX: 4, CON: 8, INT: 2, WIS: 2, LUK: 4 },
  [CLASS.WIZARD]:  { STR: 2, DEX: 5, CON: 3, INT: 9, WIS: 7, LUK: 4 },
  [CLASS.CLERIC]:  { STR: 4, DEX: 4, CON: 5, INT: 4, WIS: 9, LUK: 4 },
  [CLASS.ROGUE]:   { STR: 5, DEX: 9, CON: 5, INT: 3, WIS: 3, LUK: 5 },
  [CLASS.BARD]:    { STR: 3, DEX: 6, CON: 4, INT: 4, WIS: 4, LUK: 9 },
};

// 캐릭터 생성 시 자유 배분 포인트
export const CHARACTER_CREATION_FREE_POINTS = 6;

// ─────────────────────────────────────────
// 5. 클래스별 레벨업 자동 스탯 증가량
// ─────────────────────────────────────────
export const CLASS_LEVEL_STAT_GROWTH = {
  [CLASS.FIGHTER]: { STR: 2, DEX: 1, CON: 2, INT: 0, WIS: 0, LUK: 0 },
  [CLASS.WIZARD]:  { STR: 0, DEX: 1, CON: 0, INT: 2, WIS: 1, LUK: 1 },
  [CLASS.CLERIC]:  { STR: 1, DEX: 0, CON: 1, INT: 1, WIS: 2, LUK: 0 },
  [CLASS.ROGUE]:   { STR: 1, DEX: 2, CON: 1, INT: 0, WIS: 0, LUK: 1 },
  [CLASS.BARD]:    { STR: 0, DEX: 1, CON: 1, INT: 1, WIS: 1, LUK: 2 },
};

// ─────────────────────────────────────────
// 6. HP 공식
//    maxHP = HP_BASE + CON × HP_PER_CON
// ─────────────────────────────────────────
export const HP = {
  BASE:       20,
  PER_CON:    5,
};
// 예: Fighter CON 8 → 20 + 8×5 = 60 HP

// ─────────────────────────────────────────
// 7. AP 공식
//    전투 AP = DEX 수치 그대로 (1:1)
// ─────────────────────────────────────────
export const AP = {
  DEX_MULTIPLIER: 1, // AP = DEX × 1
};

// ─────────────────────────────────────────
// 8. 전투 이니셔티브 — Bresenham 누적 방식
//    기준: DEX 5 = 1주기 1회 행동
// ─────────────────────────────────────────
export const INITIATIVE = {
  BASE_DEX:       5,   // 1주기 1회 기준 DEX
  ACCUMULATE_DIV: 5,   // 누적값 = DEX / BASE_DEX (소수점 누적)
};

// ─────────────────────────────────────────
// 9. 경험치 곡선
//    필요 EXP(레벨 n) = EXP_BASE × n^EXP_EXPONENT
// ─────────────────────────────────────────
export const EXP = {
  BASE:     100,
  EXPONENT: 1.5,
  // 레벨 1→2: 141, 5→6: 670, 10→11: 1581
};

// 몬스터별 경험치 지급량
export const MONSTER_EXP = {
  SMALL:       20,
  MEDIUM:      40,
  LARGE:       70,
  MAGIC:       60,
  SUPPORT:     60,
  SPECIAL:     60,
  BOSS_MID:   300,
  BOSS_FINAL: 1000,
};

// Bard 파티 경험치 보너스 (배율)
export const BARD_EXP_BONUS = 1.20; // +20%

// ─────────────────────────────────────────
// 10. 토큰 굴림 시스템
// ─────────────────────────────────────────
export const TOKEN = {
  BASE_COUNT:       6,     // 기본 토큰 수
  BASE_SUCCESS_RATE: 0.60, // 기본 성공 확률 60%
  // 보정 공식: rate = BASE + (관련 스탯 - STAT_BASE) × STAT_RATE_PER_POINT
  STAT_BASE:           5,
  STAT_RATE_PER_POINT: 0.02, // 스탯 1 당 ±2%
  MIN_RATE:            0.20, // 최솟값 클램프
  MAX_RATE:            0.95, // 최댓값 클램프
};

// DP (Deterministic Point)
export const DP = {
  DEFAULT_MAX:   5,
  UPGRADED_MAX:  8,
  UPGRADE_COST:  200, // 골드
};

// ─────────────────────────────────────────
// 11. 카드 AP 코스트 기준
// ─────────────────────────────────────────
export const CARD_COST = {
  SMALL:    1, // 드로우, 소형 버프, 1회성 패시브 등록
  MEDIUM:   2, // 단일 공격, 중형 버프, 지속 패시브 등록
  LARGE:    3, // 강공격, 광역 공격, 복합 효과 카드
  ULTIMATE: 4, // 부활(Cleric), 전체 버프, 고급 디버프
};

// ─────────────────────────────────────────
// 12. 카드 데미지 공식
//    물리: STR × ATK_STR_MULT + 티어 보정
//    마법: INT × ATK_INT_MULT + 티어 보정
//    집중(Focus): INT × FOCUS_INT_MULT + 티어 보정
// ─────────────────────────────────────────
export const CARD_DAMAGE = {
  ATK_STR_MULT:   1.5,
  ATK_INT_MULT:   1.5,
  FOCUS_INT_MULT: 2.5,
  PIERCE_DEF_IGNORE: 0.30, // 관통 — 방어력 30% 무시

  // 티어별 고정 보정값
  TIER_BONUS: {
    T1: 5,
    T2: 10,
    T3: 15,
  },
};

// ─────────────────────────────────────────
// 13. 핸드 시스템
// ─────────────────────────────────────────
export const HAND = {
  INIT_DRAW:    5,  // 전투 시작 시 초기 드로우 수
  AUTO_DRAW:    1,  // 매 턴 자동 드로우 수
  MAX_SIZE:    12,  // 핸드 최대 보유 장수
};

// ─────────────────────────────────────────
// 14. 속성 시스템
// ─────────────────────────────────────────
export const ELEMENT = {
  FIRE:      'FIRE',
  ICE:       'ICE',
  LIGHTNING: 'LIGHTNING',
  DARK:      'DARK',
  NEUTRAL:   'NEUTRAL',
};

// 상성 관계: key 속성이 value 배열 속성에 강함
export const ELEMENT_STRONG_AGAINST = {
  [ELEMENT.FIRE]:      [ELEMENT.ICE,       ELEMENT.LIGHTNING],
  [ELEMENT.ICE]:       [ELEMENT.FIRE,      ELEMENT.DARK],
  [ELEMENT.LIGHTNING]: [ELEMENT.ICE,       ELEMENT.DARK],
  [ELEMENT.DARK]:      [ELEMENT.FIRE,      ELEMENT.LIGHTNING],
};

// 약점 관계: key 속성이 value 속성에 약함
export const ELEMENT_WEAK_AGAINST = {
  [ELEMENT.FIRE]:      ELEMENT.DARK,
  [ELEMENT.ICE]:       ELEMENT.LIGHTNING,
  [ELEMENT.LIGHTNING]: ELEMENT.FIRE,
  [ELEMENT.DARK]:      ELEMENT.ICE,
};

// 상성 적용 수치
export const ELEMENT_BONUS = {
  STRONG_ROLL_BONUS:      0.20,  // 굴림 확률 +20%
  STRONG_STATUS_BONUS:    0.15,  // 추가 상태이상 확률 +15%
  WEAK_ROLL_PENALTY:     -0.10,  // 굴림 확률 -10%
};

// ─────────────────────────────────────────
// 15. 상태이상
// ─────────────────────────────────────────
export const STATUS = {
  POISON:     'POISON',
  BURN:       'BURN',
  FREEZE:     'FREEZE',
  STUN:       'STUN',
  SHOCK:      'SHOCK',    // 감전
  CONFUSION:  'CONFUSION',// 착란
  CURSE:      'CURSE',    // 스탯 저주
};

// 상태이상 속성 연계
export const STATUS_ELEMENT = {
  [STATUS.BURN]:      ELEMENT.FIRE,
  [STATUS.FREEZE]:    ELEMENT.ICE,
  [STATUS.SHOCK]:     ELEMENT.LIGHTNING,
  [STATUS.CONFUSION]: ELEMENT.DARK,
  [STATUS.CURSE]:     ELEMENT.DARK,
};

// 지속 데미지 (독/화상): 피격자 최대 HP의 5%
export const DOT_DAMAGE_RATE = 0.05;

// 감전 전파: 1회 전파 (연쇄 무한 전파 없음)
export const SHOCK_PROPAGATION_COUNT = 1;

// ─────────────────────────────────────────
// 16. 전투 포지션
// ─────────────────────────────────────────
export const POSITION = {
  FRONT: 'FRONT',
  BACK:  'BACK',
};

// 클래스별 기본 포지션
export const CLASS_DEFAULT_POSITION = {
  [CLASS.FIGHTER]: POSITION.FRONT,
  [CLASS.CLERIC]:  POSITION.FRONT,
  [CLASS.WIZARD]:  POSITION.BACK,
  [CLASS.ROGUE]:   POSITION.BACK,
  [CLASS.BARD]:    POSITION.BACK,
};

// 포지션 변경 AP 코스트
export const POSITION_CHANGE_COST = 1;

// ─────────────────────────────────────────
// 17. 솔로 플레이 스케일링
// ─────────────────────────────────────────
export const SOLO_SCALING = {
  1: 0.60,
  2: 0.75,
  3: 0.90,
  4: 1.00,
};

// ─────────────────────────────────────────
// 18. 인벤토리
// ─────────────────────────────────────────
export const INVENTORY = {
  INIT_COLS: 10,
  INIT_ROWS:  6,  // 초기 60칸
  EXPAND_COLS_PER_UPGRADE: 2,
  EXPAND_COSTS: [150, 300, 500], // 단계별 골드 비용
};

// 아이템 점유 크기 (칸 수)
export const ITEM_SIZE = {
  RING:         1,
  NECKLACE:     2,
  CONSUMABLE:   1,
  GLOVES:       2,
  BOOTS:        2,
  HELM:         3,
  DAGGER:       3,
  CHEST:        5,
  PANTS:        4,
  CLOAK:        4,
  ONE_HAND:     5,
  SHIELD:       4,
  GREATSWORD:   7,
  BOW:          6,
  STAFF:        6,
  HOLY_BOOK:    4,
  MACE:         5,
  LUTE:         6,
  HEAVY_CHEST:  8,
};

// ─────────────────────────────────────────
// 19. 경제 — 골드 드롭 범위
// ─────────────────────────────────────────
export const GOLD_DROP = {
  SMALL:    { MIN: 5,   MAX: 15  },
  MEDIUM:   { MIN: 15,  MAX: 30  },
  LARGE:    { MIN: 30,  MAX: 60  },
  BOSS_MID: { MIN: 150, MAX: 250 },
};

// ─────────────────────────────────────────
// 20. 상점 가격
// ─────────────────────────────────────────
export const SHOP_PRICE = {
  EQUIP: {
    T1: { MIN: 50,  MAX: 100  },
    T2: { MIN: 150, MAX: 300  },
    T3: { MIN: 400, MAX: 800  },
  },
  CONSUMABLE: {
    POTION_SMALL:    20,
    POTION_LARGE:    50,
    DP_CRYSTAL:      80,
    ANTIDOTE:        30,
    REVIVE_SCROLL:  200,
    // 텔레포트 스크롤은 상점 미판매 (던전 드롭 전용)
  },
};

// ─────────────────────────────────────────
// 21. 장비 강화 비용 및 수치 상승
//    비용: 장비 구매가 × 배율
//    수치: 카드 기본값 × (1 + 상승률)
// ─────────────────────────────────────────
export const ENHANCE = {
  COST_RATE:  { '+1': 0.20, '+2': 0.50, '+3': 1.00 },
  STAT_BONUS: { '+1': 0.10, '+2': 0.25, '+3': 0.50 },
  // +3에서 속성 효과 강화 추가 적용
};

// ─────────────────────────────────────────
// 22. 월드맵
// ─────────────────────────────────────────
export const WORLD = {
  COLS: 25,
  ROWS: 25,

  // ※ 왕국 성 / 드래곤 네스트 위치는 WorldGenerator가 런타임에 결정
  //   (섬 edge + 무게중심 기반 배치 — CASTLE_MARGIN / DRAGON_MARGIN 참조)
  //   → 게임 시작 후 gameStore.castlePos / dragonSpawn 에서 참조

  // 레드 드래곤 이동 알고리즘 랜덤성
  DRAGON_SHORTEST_PATH_RATE: 0.70, // 최단경로 확률
  DRAGON_RANDOM_RATE:        0.30, // 이탈 확률

  // ※ 바이옴 비율은 WorldGenerator.js DISTANCE_BIOME_TABLE 참조
  //   (Voronoi + 거리 비율 기반 동적 결정 — 고정 퍼센트 없음)
};

// ─────────────────────────────────────────
// 23. 타일 타입
// ─────────────────────────────────────────
export const TILE = {
  EMPTY:          'EMPTY',
  VILLAGE:        'VILLAGE',
  VILLAGE_BURNED: 'VILLAGE_BURNED',
  DUNGEON:        'DUNGEON',
  ENEMY:          'ENEMY',
  QUEST:          'QUEST',
  RANDOM_EVENT:   'RANDOM_EVENT',
  CASTLE:         'CASTLE',
  BOSS:           'BOSS',
};

// ─────────────────────────────────────────
// 24. 던전
// ─────────────────────────────────────────
export const DUNGEON = {
  NODE_MIN:   7,
  NODE_MAX:  15,
  DEPTH_MIN:  3,
  DEPTH_MAX:  5,

  // 노드 타입 비율
  NODE_RATIO: {
    BATTLE:  0.40,
    TREASURE:0.15,
    EVENT:   0.15,
    TRAP:    0.10,
    SHOP:    0.10,
    EMPTY:   0.10,
  },

  // 코어 클리어 실패 페널티 (최대 HP 감소율)
  CORE_FAIL_HP_PENALTY: 0.10,
  CORE_CLEAR_EXP:       200,
};
// ─────────────────────────────────────────
// 25. 바이옴 (WorldGenerator용)
// ─────────────────────────────────────────
export const BIOME = {
  PLAINS:    'PLAINS',
  FOREST:    'FOREST',
  SNOWFIELD: 'SNOWFIELD',
  VOLCANO:   'VOLCANO',
};



// ─────────────────────────────────────────
// 25. 마을 시스템
// ─────────────────────────────────────────
export const INN = {
  // 여관 DP 업그레이드 (5 → 최대 8)
  DP_UPGRADE_MAX_STEPS: 3, // 3단계 = +3 → 최대 8
  DP_UPGRADE_COST_PER_STEP: 200,
};

// ─────────────────────────────────────────
// 26. 레드 드래곤 퀘스트 진행도별 스탯 배율
// ─────────────────────────────────────────
export const DRAGON_DIFFICULTY = {
  STAGE_0: { HP: 3.00, ATK: 3.00, ACTION_MULT: 2.0, STATUS_MULT: 2.0 },
  STAGE_1: { HP: 2.50, ATK: 2.50, ACTION_MULT: 1.5, STATUS_MULT: 1.5 },
  STAGE_2: { HP: 1.75, ATK: 1.75, ACTION_MULT: 1.2, STATUS_MULT: 1.2 },
  STAGE_3: { HP: 1.20, ATK: 1.20, ACTION_MULT: 1.0, STATUS_MULT: 1.0 },
  STAGE_4: { HP: 1.00, ATK: 1.00, ACTION_MULT: 1.0, STATUS_MULT: 1.0 },
};

// ─────────────────────────────────────────
// 27. 중간 보스 기본 스탯
// ─────────────────────────────────────────
export const BOSS_STATS = {
  WYVERN:       { HP: 300, DEF_MULT: 1.0, ATK_MULT: 1.2 },
  GOLEM:        { HP: 500, DEF_MULT: 2.0, ATK_MULT: 1.0 },
  LICH:         { HP: 280, DEF_MULT: 0.8, ATK_MULT: 1.8 },
  GRIFFIN:      { HP: 380, DEF_MULT: 1.0, ATK_MULT: 1.4 },
  DRAGON_KNIGHT:{ HP: 600, DEF_MULT: 1.2, ATK_MULT: 1.5 },
  RED_DRAGON:   { HP: 1000,DEF_MULT: 1.5, ATK_MULT: 2.0 },
};

// 리치 자동 부활 HP (부활 후 취약 상태 DEF 0)
export const LICH_REVIVE_HP_RATE = 0.30; // 최대 HP의 30%로 부활

// 골렘 HP 50% 이하 소환 유닛
export const GOLEM_SUMMON_COUNT = 2;

// 드래곤나이트 분노 스탯 배율 (HP 30% 이하)
export const DRAGON_KNIGHT_RAGE_MULT = 1.50;

// ─────────────────────────────────────────
// 28. Bard 유틸리티 보너스
// ─────────────────────────────────────────
export const BARD_BONUS = {
  SHOP_DISCOUNT:   0.10, // 상점 할인 10% (LUK 연계 — 추후 공식 확장)
  DROP_BIAS:       0.15, // 드롭 품질 bias +15%
  EXP_BONUS:       0.20, // 파티 경험치 +20%
};

// ─────────────────────────────────────────
// 29. 프리미티브 렌더링 색상 팔레트
// ─────────────────────────────────────────
export const COLOR = {
  // 클래스
  FIGHTER:  0xE05C3A,
  WIZARD:   0x5B8DD9,
  CLERIC:   0xF0C040,
  ROGUE:    0x4DB87A,
  BARD:     0xC47FD5,

  // 몬스터 템플릿
  MONSTER_SMALL:   0x4488FF,
  MONSTER_MEDIUM:  0x44BB44,
  MONSTER_LARGE:   0xFF4444,
  MONSTER_MAGIC:   0xAA44FF,
  MONSTER_SUPPORT: 0xFFDD00,
  MONSTER_SPECIAL: 0x222222,

  // 속성
  ELEMENT_FIRE:      0xFF6600,
  ELEMENT_ICE:       0x88DDFF,
  ELEMENT_LIGHTNING: 0xFFEE00,
  ELEMENT_DARK:      0x7700BB,
  ELEMENT_NEUTRAL:   0xAAAAAA,

  // 타일
  TILE_EMPTY:          0x7A9E6E,
  TILE_VILLAGE:        0xF5DEB3,
  TILE_VILLAGE_BURNED: 0x3A2A1A,
  TILE_DUNGEON:        0x888888,
  TILE_ENEMY:          0xCC4444,
  TILE_QUEST:          0x44AACC,
  TILE_RANDOM:         0xDDCC55,
  TILE_CASTLE:         0xFFD700,
  TILE_BOSS:           0xFF0066,
};

// ─────────────────────────────────────────
// 30. 상호작용 범위
// ─────────────────────────────────────────
export const INTERACTION_RANGE = 1; // Hex 인접 1칸 이내 (같은 타일 포함)

// ─────────────────────────────────────────
// 31. 유틸리티 — 레벨별 필요 경험치 계산
// ─────────────────────────────────────────
export function calcRequiredExp(level) {
  return Math.floor(EXP.BASE * Math.pow(level, EXP.EXPONENT));
}

// 유틸리티 — 토큰 굴림 성공 확률 계산
export function calcTokenSuccessRate(stat) {
  const rate = TOKEN.BASE_SUCCESS_RATE + (stat - TOKEN.STAT_BASE) * TOKEN.STAT_RATE_PER_POINT;
  return Math.min(TOKEN.MAX_RATE, Math.max(TOKEN.MIN_RATE, rate));
}

// 유틸리티 — 최대 HP 계산
export function calcMaxHP(con) {
  return HP.BASE + con * HP.PER_CON;
}

// 유틸리티 — 카드 물리 데미지 계산
export function calcPhysicalDamage(str, tier) {
  return str * CARD_DAMAGE.ATK_STR_MULT + CARD_DAMAGE.TIER_BONUS[tier];
}

// 유틸리티 — 카드 마법 데미지 계산
export function calcMagicDamage(int, tier) {
  return int * CARD_DAMAGE.ATK_INT_MULT + CARD_DAMAGE.TIER_BONUS[tier];
}

// 유틸리티 — 집중 마법 데미지 계산
export function calcFocusDamage(int, tier) {
  return int * CARD_DAMAGE.FOCUS_INT_MULT + CARD_DAMAGE.TIER_BONUS[tier];
}
