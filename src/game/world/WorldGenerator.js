// ============================================================
// src/game/world/WorldGenerator.js
// 절차적 월드맵 생성
// 파이프라인:
//  [1] fBm 노이즈 생성
//  [2] Square Gradient 합성 → 단일 아일랜드 마스크
//  [3] 적응형 Threshold 탐색 (경계 타일 예측 기반) → 단일 컴포넌트 육지 확정
//  [4] 최소 이격 조건으로 N개 centroid 랜덤 배치
//  [5] 섬 edge + 무게중심 기반 Castle / Dragon centroid 배치
//      Castle : edge 타일 → 무게중심 방향 CASTLE_MARGIN 이동 → 랜덤 선택
//      Dragon : 반대편 edge 타일 → 무게중심 방향 DRAGON_MARGIN 이동 → 성에서 가장 먼 것
//      나머지 centroid → 성 거리 비율 기반(B안) 바이옴 배정
//  [6] Voronoi 분할 (경계 지터 포함) → 타일별 바이옴 확정
//  [7] 바이옴별 가중치 테이블 → 타일 타입 배치
//      Dragon Nest 바이옴 내 BOSS 타일 1개 배치 = 드래곤 스폰 위치
// ============================================================
import { HexGrid } from './HexGrid.js';
import { TILE, BIOME } from '../../constants/constants.js';

// ================================================================
// ★ WORLD GENERATION CONFIG — 여기서 모든 수치를 조정하세요 ★
// ================================================================

// ── 맵 크기 ──────────────────────────────────────────────────────
const WORLD_COLS          = 60;   // 가로 타일 수
const WORLD_ROWS          = 60;   // 세로 타일 수

// ── 노이즈 파라미터 ───────────────────────────────────────────────
const NOISE_OCTAVES       = 6;    // 옥타브 수 (높을수록 해안선이 복잡해짐)
const NOISE_PERSISTENCE   = 0.1;  // 고주파 옥타브 감쇠율 (0~1)
const NOISE_LACUNARITY    = 2.0;  // 옥타브당 주파수 배율
const NOISE_SCALE         = 0.2;  // 전체 노이즈 스케일 (작을수록 섬이 커짐)

// ── 아일랜드 형태 ─────────────────────────────────────────────────
const GRADIENT_STRENGTH   = 1.3;  // Square gradient 강도 (높을수록 섬이 작아짐)

// ── 적응형 육지 면적 제어 ─────────────────────────────────────────
// LAND_THRESHOLD 고정값 대신 비율 범위로 제어
// → 맵 크기가 바뀌어도 항상 일정 비율의 육지가 생성됨
const MIN_LAND_RATIO      = 0.35; // 육지 타일 비율 하한 (전체의 35%)
const MAX_LAND_RATIO      = 0.55; // 육지 타일 비율 상한 (전체의 55%)
const MAX_ITER            = 15;   // 적응형 threshold 최대 반복 횟수

// ── 바이옴 Voronoi ────────────────────────────────────────────────
const BIOME_CENTROID_COUNT = 18;  // 전체 centroid 수 (성·둥지 제외한 일반 centroid)
const MIN_CENTROID_DIST    = 3;   // centroid 간 최소 이격 거리 (타일 단위)
const CASTLE_MARGIN        = 3;   // 섬 해안에서 성 centroid까지의 거리 (타일 단위)
const DRAGON_MARGIN        = 3;   // 섬 해안에서 드래곤 둥지 centroid까지의 거리 (타일 단위)
const BIOME_BORDER_JITTER  = 0.9; // 바이옴 경계 지터 강도 (0 = 직선)

// ── 타일 배치 ─────────────────────────────────────────────────────
const VILLAGE_MIN_DIST     = 4;   // 마을 간 최소 이격 거리 (타일 단위)

// ================================================================

// ── B안: 거리 비율별 바이옴 가중치 ───────────────────────────────
// ratio = dist(centroid, castle) / max_dist  (0~1)
// 성에서 멀수록 위험한 바이옴 가중치 상승
const DISTANCE_BIOME_TABLE = [
  // { maxRatio, weights: [{ biome, w }] }
  {
    maxRatio: 0.35,
    weights: [
      { biome: BIOME.PLAINS,    w: 70 },
      { biome: BIOME.SNOWFIELD, w: 20 },
      { biome: BIOME.FOREST,    w: 10 },
    ],
  },
  {
    maxRatio: 0.65,
    weights: [
      { biome: BIOME.FOREST,    w: 40 },
      { biome: BIOME.SNOWFIELD, w: 35 },
      { biome: BIOME.PLAINS,    w: 25 },
    ],
  },
  {
    maxRatio: 0.85,
    weights: [
      { biome: BIOME.VOLCANO,   w: 45 },
      { biome: BIOME.FOREST,    w: 35 },
      { biome: BIOME.SNOWFIELD, w: 20 },
    ],
  },
  {
    maxRatio: 1.0,
    weights: [
      { biome: BIOME.VOLCANO,   w: 60 },
      { biome: BIOME.FOREST,    w: 40 },
    ],
  },
];

// ── 바이옴별 타일 타입 가중치 ─────────────────────────────────────
const BIOME_TILE_WEIGHTS = {
  [BIOME.CASTLE]: [
    // 성 바이옴(안전구역) — 모두 빈 타일
    { type: TILE.EMPTY, w: 100 },
  ],
  [BIOME.PLAINS]: [
    { type: TILE.EMPTY,        w: 60 },
    { type: TILE.ENEMY,        w: 20 },
    { type: TILE.VILLAGE,      w: 12 },
    { type: TILE.DUNGEON,      w:  5 },
    { type: TILE.QUEST,        w:  2 },
    { type: TILE.RANDOM_EVENT, w:  1 },
  ],
  [BIOME.FOREST]: [
    { type: TILE.EMPTY,        w: 55 },
    { type: TILE.ENEMY,        w: 25 },
    { type: TILE.DUNGEON,      w: 10 },
    { type: TILE.QUEST,        w:  7 },
    { type: TILE.RANDOM_EVENT, w:  3 },
  ],
  [BIOME.SNOWFIELD]: [
    { type: TILE.EMPTY,        w: 58 },
    { type: TILE.ENEMY,        w: 22 },
    { type: TILE.DUNGEON,      w:  8 },
    { type: TILE.VILLAGE,      w:  8 },
    { type: TILE.QUEST,        w:  4 },
  ],
  [BIOME.VOLCANO]: [
    { type: TILE.EMPTY,        w: 50 },
    { type: TILE.ENEMY,        w: 35 },
    { type: TILE.DUNGEON,      w: 10 },
    { type: TILE.QUEST,        w:  5 },
  ],
  [BIOME.DRAGON_NEST]: [
    { type: TILE.EMPTY,        w: 40 },
    { type: TILE.ENEMY,        w: 50 },
    { type: TILE.DUNGEON,      w: 10 },
  ],
};

// ── 바이옴별 속성 (전투/상태이상 연산에 사용) ─────────────────────
export const BIOME_ELEMENT = {
  [BIOME.CASTLE]:      'NEUTRAL',
  [BIOME.PLAINS]:      'NEUTRAL',
  [BIOME.FOREST]:      'DARK',
  [BIOME.SNOWFIELD]:   'ICE',
  [BIOME.VOLCANO]:     'FIRE',
  [BIOME.DRAGON_NEST]: 'FIRE',
};

// ── WorldGenerator 클래스 ─────────────────────────────────────────
export class WorldGenerator {
  /**
   * @param {number} seed  난수 시드 — 동일 시드 → 동일 맵 재현
   */
  constructor(seed = Date.now()) {
    this._seed = seed >>> 0;
    this._rng  = this._makeLCG(this._seed);
  }

  // ================================================================
  // 메인 생성
  // @returns {{ grid, castlePos: {x,y}, dragonSpawn: {x,y} }}
  //   dragonSpawn = Dragon Nest 바이옴 내 BOSS 타일 위치
  // ================================================================
  generate() {
    const grid = new HexGrid(WORLD_COLS, WORLD_ROWS);

    // ── [1~3] 노이즈 + gradient → 육지 마스크 → 타일 등록 ────────
    const landMask = this._generateLandMask();
    for (let y = 0; y < WORLD_ROWS; y++) {
      for (let x = 0; x < WORLD_COLS; x++) {
        if (landMask[y][x]) {
          grid.setTile(x, y, {
            type:     TILE.EMPTY,
            biome:    BIOME.PLAINS,
            entities: [],
          });
        }
      }
    }

    // ── [4] centroid 배치 ─────────────────────────────────────────
    const centroids = this._placeCentroids(grid);
    if (centroids.length < 3) {
      console.warn('[WorldGenerator] centroid 부족 — 맵 재생성 권장');
    }

    // ── [5] Castle / Dragon centroid 배치 + 나머지 바이옴 배정 ────
    const { castlePos } = this._assignSpecialCentroids(centroids, grid);

    // ── [6] Voronoi 분할 → 타일별 바이옴 확정 ────────────────────
    this._assignVoronoiBiomes(grid, centroids);

    // 성 타일 배치
    grid.updateTile(castlePos.x, castlePos.y, {
      type:  TILE.CASTLE,
      biome: BIOME.CASTLE,
    });

    // ── [7] 바이옴별 타일 타입 배치 ──────────────────────────────
    this._placeBiomeTiles(grid, castlePos);

    // 드래곤 둥지 바이옴 내 BOSS 타일 배치 → 위치가 드래곤 스폰 지점
    const dragonSpawn = this._placeBossTile(grid);

    return { grid, castlePos, dragonSpawn };
  }

  // ================================================================
  // [1~3] fBm 노이즈 + Square Gradient → 적응형 Threshold → 육지 마스크
  //
  // 전략: 고정 threshold 대신 경계 타일의 finalValue를 이용해
  //       목표 육지 비율(MIN~MAX_LAND_RATIO)이 될 threshold를 예측 탐색.
  //       BFS로 최대 단일 컴포넌트를 확인하므로 고립 섬 없이 수렴.
  // ================================================================
  _generateLandMask() {
    const finalValues = this._computeFinalValues();
    return this._adaptiveThreshold(finalValues);
  }

  // ── [1~2] 전체 타일 finalValue 계산 ─────────────────────────────
  _computeFinalValues() {
    const vals = Array.from({ length: WORLD_ROWS }, () =>
      new Array(WORLD_COLS).fill(0),
    );
    for (let y = 0; y < WORLD_ROWS; y++) {
      for (let x = 0; x < WORLD_COLS; x++) {
        const nx       = x / WORLD_COLS;
        const ny       = y / WORLD_ROWS;
        const noiseVal = this._fbm(nx, ny);
        const gx       = Math.abs(nx - 0.5) * 2;
        const gy       = Math.abs(ny - 0.5) * 2;
        const gradient = Math.max(gx, gy);
        vals[y][x]     = noiseVal - gradient * GRADIENT_STRENGTH;
      }
    }
    return vals;
  }

  // ── [3] 경계 타일 예측 기반 적응형 Threshold 탐색 ───────────────
  // 매 반복에서:
  //   · 육지 부족 → 외부 경계 타일(컴포넌트에 인접한 바다)을 내림차순 정렬
  //                 → needed번째 값으로 T 직접 예측 (T를 그 값 직하단으로)
  //   · 육지 초과 → 내부 경계 타일(컴포넌트 가장자리 육지)을 오름차순 정렬
  //                 → excess번째 값으로 T 직접 예측 (T를 그 값 직상단으로)
  // 연결성 오차(인접 섬 합류 등)가 있어도 방향이 단조라 빠르게 수렴.
  _adaptiveThreshold(finalValues) {
    const TOTAL     = WORLD_COLS * WORLD_ROWS;
    const targetMin = Math.ceil(MIN_LAND_RATIO  * TOTAL);
    const targetMax = Math.floor(MAX_LAND_RATIO * TOTAL);
    const targetMid = (MIN_LAND_RATIO + MAX_LAND_RATIO) / 2;

    // 초기 T: 전체 값 정렬 후 목표 중앙 비율 percentile 사용
    const allVals = [];
    for (let y = 0; y < WORLD_ROWS; y++)
      for (let x = 0; x < WORLD_COLS; x++)
        allVals.push(finalValues[y][x]);
    allVals.sort((a, b) => a - b);
    let T = allVals[Math.floor((1 - targetMid) * allVals.length)];

    let bestMask      = null;
    let bestRatioDiff = Infinity;

    for (let iter = 0; iter < MAX_ITER; iter++) {
      // 후보 육지 집합
      const candidates = new Set();
      for (let y = 0; y < WORLD_ROWS; y++)
        for (let x = 0; x < WORLD_COLS; x++)
          if (finalValues[y][x] >= T) candidates.add(`${x},${y}`);

      // BFS → 최대 컴포넌트 + 내외부 경계 타일
      const { component, externalBoundary, internalBoundary } =
        this._largestComponentWithBoundary(finalValues, candidates);

      const size  = component.size;
      const ratio = size / TOTAL;
      const diff  = Math.abs(ratio - targetMid);

      // 목표 중앙값에 가장 가까운 결과를 fallback으로 보존
      if (diff < bestRatioDiff) {
        bestRatioDiff = diff;
        bestMask      = this._componentToMask(component);
      }

      // 수렴 판정
      if (size >= targetMin && size <= targetMax) break;

      if (size < targetMin) {
        // 육지 부족 → T 낮춤
        // 외부 경계 타일을 finalValue 내림차순 정렬,
        // needed번째 타일의 값 직하단으로 T 설정
        const needed = targetMin - size;
        externalBoundary.sort((a, b) => b.val - a.val);
        const idx = Math.min(needed - 1, externalBoundary.length - 1);
        if (externalBoundary.length === 0 || idx < 0) break;
        T = externalBoundary[idx].val - 1e-9;
      } else {
        // 육지 초과 → T 높임
        // 내부 경계 타일을 finalValue 오름차순 정렬,
        // excess번째 타일의 값 직상단으로 T 설정
        const excess = size - targetMax;
        internalBoundary.sort((a, b) => a.val - b.val);
        const idx = Math.min(excess - 1, internalBoundary.length - 1);
        if (internalBoundary.length === 0 || idx < 0) break;
        T = internalBoundary[idx].val + 1e-9;
      }
    }

    return bestMask ?? Array.from({ length: WORLD_ROWS }, () =>
      new Array(WORLD_COLS).fill(false),
    );
  }

  // ── 최대 연결 컴포넌트 BFS + 내외부 경계 타일 수집 ──────────────
  // externalBoundary: 컴포넌트에 인접한 바다 타일 목록 { val }
  // internalBoundary: 바다와 인접한 컴포넌트 가장자리 타일 목록 { val }
  _largestComponentWithBoundary(finalValues, candidates) {
    const visited     = new Set();
    let bestComponent = new Set();
    let bestExternal  = [];
    let bestInternal  = [];

    for (const startKey of candidates) {
      if (visited.has(startKey)) continue;

      const [sx, sy]  = startKey.split(',').map(Number);
      const component = new Set();
      const extMap    = new Map(); // nk → val (외부 경계 중복 방지)
      const intList   = [];       // 내부 경계 { val }
      const queue     = [[sx, sy]];
      component.add(startKey);
      visited.add(startKey);

      while (queue.length > 0) {
        const [x, y]     = queue.shift();
        let   onBoundary = false;

        for (const [nx, ny] of this._gridNeighbors(x, y)) {
          // 맵 외곽도 경계로 취급
          if (nx < 0 || nx >= WORLD_COLS || ny < 0 || ny >= WORLD_ROWS) {
            onBoundary = true;
            continue;
          }
          const nk = `${nx},${ny}`;
          if (candidates.has(nk)) {
            if (!visited.has(nk)) {
              visited.add(nk);
              component.add(nk);
              queue.push([nx, ny]);
            }
          } else {
            // 외부 경계 타일 등록 (중복 제거)
            onBoundary = true;
            if (!extMap.has(nk)) extMap.set(nk, finalValues[ny][nx]);
          }
        }

        // 이 타일이 바다와 인접 → 내부 경계 등록
        if (onBoundary) intList.push({ val: finalValues[y][x] });
      }

      if (component.size > bestComponent.size) {
        bestComponent = component;
        bestExternal  = Array.from(extMap.values()).map((val) => ({ val }));
        bestInternal  = intList;
      }
    }

    return {
      component:        bestComponent,
      externalBoundary: bestExternal,
      internalBoundary: bestInternal,
    };
  }

  // ── 컴포넌트 Set → 2D boolean 마스크 ─────────────────────────────
  _componentToMask(component) {
    const mask = Array.from({ length: WORLD_ROWS }, () =>
      new Array(WORLD_COLS).fill(false),
    );
    for (const key of component) {
      const [x, y] = key.split(',').map(Number);
      mask[y][x]   = true;
    }
    return mask;
  }

  // ── 마스크 단계 인접 타일 (4방향) ────────────────────────────────
  _gridNeighbors(x, y) {
    return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
  }

  // ── fBm (fractional Brownian motion) ─────────────────────────
  _fbm(nx, ny) {
    let value     = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxVal    = 0;

    for (let i = 0; i < NOISE_OCTAVES; i++) {
      value  += this._valueNoise(nx * frequency * NOISE_SCALE * WORLD_COLS,
                                  ny * frequency * NOISE_SCALE * WORLD_ROWS) * amplitude;
      maxVal += amplitude;
      amplitude *= NOISE_PERSISTENCE;
      frequency *= NOISE_LACUNARITY;
    }

    return value / maxVal; // 0~1로 정규화
  }

  // ── Value Noise (해시 기반 gradient 근사) ─────────────────────
  // Simplex/Perlin 없이 외부 의존성 없이 동작하는 인라인 구현
  _valueNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    // Smoothstep 보간
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    const n00 = this._hash2(ix,     iy);
    const n10 = this._hash2(ix + 1, iy);
    const n01 = this._hash2(ix,     iy + 1);
    const n11 = this._hash2(ix + 1, iy + 1);

    // Bilinear 보간
    return (
      n00 * (1 - ux) * (1 - uy) +
      n10 * ux       * (1 - uy) +
      n01 * (1 - ux) * uy       +
      n11 * ux       * uy
    );
  }

  // ── 정수 좌표 해시 (0~1 반환) ────────────────────────────────
  _hash2(ix, iy) {
    let h = (ix * 1619 + iy * 31337 + this._seed * 1000003) | 0;
    h ^= (h >>> 13);
    h  = (Math.imul(h, 0x9e3779b9)) | 0;
    h ^= (h >>> 11);
    h ^= (h >>> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  }

  // ================================================================
  // [4] centroid 배치
  // 육지 타일 위에 최소 이격 조건으로 BIOME_CENTROID_COUNT개 배치
  // ※ _adaptiveThreshold 에서 이미 단일 컴포넌트를 보장하므로
  //   별도 Flood Fill 불필요
  // ================================================================
  _placeCentroids(grid) {
    const landTiles = Array.from(grid.tiles.values());
    if (landTiles.length === 0) return [];

    const centroids = [];
    const MAX_ATTEMPTS = BIOME_CENTROID_COUNT * 30;
    let   attempts    = 0;

    while (centroids.length < BIOME_CENTROID_COUNT && attempts < MAX_ATTEMPTS) {
      attempts++;
      const candidate = landTiles[Math.floor(this._rng() * landTiles.length)];

      // 기존 centroid들과 최소 이격 검사
      const tooClose = centroids.some(
        (c) => Math.hypot(c.x - candidate.x, c.y - candidate.y) < MIN_CENTROID_DIST,
      );
      if (!tooClose) {
        centroids.push({ x: candidate.x, y: candidate.y, biome: BIOME.PLAINS }); // 임시 바이옴
      }
    }

    return centroids;
  }

  // ================================================================
  // [5] Castle / Dragon centroid 배치 + 나머지 centroid 바이옴 배정
  //
  // Castle  : edge 타일 → 무게중심 방향 CASTLE_MARGIN 이동 → 육지 필터 → 랜덤
  // Dragon  : 반대편 edge 타일 → 무게중심 방향 DRAGON_MARGIN 이동 → 성에서 가장 먼 것
  // Dragon spawn = Dragon centroid 위치 (별도 계산 없음)
  // ================================================================
  _assignSpecialCentroids(centroids, grid) {
    const landTiles = Array.from(grid.tiles.values());

    // ── 섬 무게중심 ────────────────────────────────────────────────
    const cx = landTiles.reduce((s, t) => s + t.x, 0) / landTiles.length;
    const cy = landTiles.reduce((s, t) => s + t.y, 0) / landTiles.length;

    // ── edge 타일: 바다(또는 맵 외곽)와 인접한 육지 타일 ──────────
    const edgeTiles = landTiles.filter((t) =>
      this._gridNeighbors(t.x, t.y).some(([nx, ny]) =>
        nx < 0 || nx >= WORLD_COLS || ny < 0 || ny >= WORLD_ROWS ||
        !grid.getTile(nx, ny),
      ),
    );

    // ── Castle centroid ───────────────────────────────────────────
    // edge 타일 전체 → 무게중심 방향 CASTLE_MARGIN 이동 → 육지 필터 → 랜덤
    const castleCandidates = this._marginCandidates(edgeTiles, cx, cy, CASTLE_MARGIN, grid);
    const castleCentroid   = castleCandidates[Math.floor(this._rng() * castleCandidates.length)];
    castleCentroid.biome   = BIOME.CASTLE;
    centroids.push(castleCentroid);
    const castlePos = { x: castleCentroid.x, y: castleCentroid.y };

    // ── Dragon centroid ───────────────────────────────────────────
    // 성과 반대 방향(무게중심 기준)에 있는 edge 타일 필터
    const toCastleX       = castlePos.x - cx;
    const toCastleY       = castlePos.y - cy;
    const dragonEdgeTiles = edgeTiles.filter(
      (t) => (t.x - cx) * toCastleX + (t.y - cy) * toCastleY < 0,
    );
    // 반대편 후보가 없으면 전체 edge 사용
    const nestPool        = dragonEdgeTiles.length > 0 ? dragonEdgeTiles : edgeTiles;
    const dragonCandidates = this._marginCandidates(nestPool, cx, cy, DRAGON_MARGIN, grid);

    // 후보 중 성에서 가장 먼 것 선택
    const nestCentroid = dragonCandidates.reduce((best, c) =>
      Math.hypot(c.x - castlePos.x, c.y - castlePos.y) >
      Math.hypot(best.x - castlePos.x, best.y - castlePos.y) ? c : best,
    );
    nestCentroid.biome = BIOME.DRAGON_NEST;
    centroids.push(nestCentroid);
    // nestCentroid 위치는 Dragon Nest 바이옴 중심
    // 드래곤 실제 스폰 위치는 이후 _placeBossTile()이 반환하는 BOSS 타일로 결정됨

    // ── 나머지 centroid: B안 거리 비율 기반 바이옴 배정 ───────────
    const maxDist = Math.hypot(nestCentroid.x - castlePos.x, nestCentroid.y - castlePos.y);
    for (const c of centroids) {
      if (c.biome === BIOME.CASTLE || c.biome === BIOME.DRAGON_NEST) continue;
      const dist  = Math.hypot(c.x - castlePos.x, c.y - castlePos.y);
      const ratio = maxDist > 0 ? dist / maxDist : 0;
      c.biome = this._biomeByDistanceRatio(ratio);
    }

    return { castlePos };
  }

  // ── edge 타일 → 무게중심 방향 margin 이동 → 육지 필터 ───────────
  // 여러 edge 타일이 같은 착지 좌표로 수렴할 수 있어 Set으로 중복 제거
  // fallback: 후보 0개면 무게중심에서 가장 가까운 육지 타일 1개 반환
  _marginCandidates(edgeTiles, cx, cy, margin, grid) {
    const seen   = new Set();
    const result = [];

    for (const t of edgeTiles) {
      const dx  = cx - t.x;
      const dy  = cy - t.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;

      const tx  = Math.round(t.x + (dx / len) * margin);
      const ty  = Math.round(t.y + (dy / len) * margin);
      const key = `${tx},${ty}`;

      if (!seen.has(key) && grid.getTile(tx, ty)) {
        seen.add(key);
        result.push({ x: tx, y: ty, biome: BIOME.PLAINS });
      }
    }

    // fallback
    if (result.length === 0) {
      const landTiles = Array.from(grid.tiles.values());
      const closest   = landTiles.reduce((best, t) =>
        Math.hypot(t.x - cx, t.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? t : best,
      );
      result.push({ x: closest.x, y: closest.y, biome: BIOME.PLAINS });
    }

    return result;
  }

  // ── B안: 거리 비율 → 바이옴 선택 ──────────────────────────────
  _biomeByDistanceRatio(ratio) {
    for (const tier of DISTANCE_BIOME_TABLE) {
      if (ratio <= tier.maxRatio) {
        return this._weightedRandom(tier.weights);
      }
    }
    // fallback
    return BIOME.VOLCANO;
  }

  // ================================================================
  // [6] Voronoi 분할 — 각 타일에 가장 가까운 centroid 바이옴 배정
  //     경계 지터: 조회 좌표에 노이즈 오프셋 적용 → 직선 경계 방지
  // ================================================================
  _assignVoronoiBiomes(grid, centroids) {
    if (centroids.length === 0) return;

    for (const tile of grid.tiles.values()) {
      // 지터 오프셋 (해시 기반 — 동일 좌표는 항상 같은 오프셋)
      const jx = (this._hash2(tile.x * 7,  tile.y * 3)  - 0.5) * BIOME_BORDER_JITTER;
      const jy = (this._hash2(tile.x * 11, tile.y * 13) - 0.5) * BIOME_BORDER_JITTER;

      const qx = tile.x + jx;
      const qy = tile.y + jy;

      let minDist = Infinity;
      let best    = centroids[0];

      for (const c of centroids) {
        const d = Math.hypot(qx - c.x, qy - c.y);
        if (d < minDist) { minDist = d; best = c; }
      }

      grid.updateTile(tile.x, tile.y, { biome: best.biome });
    }
  }

  // ================================================================
  // [7] 바이옴별 타일 타입 배치
  // ================================================================
  _placeBiomeTiles(grid, castlePos) {
    for (const tile of grid.tiles.values()) {
      // 성 타일은 건드리지 않음
      if (tile.type === TILE.CASTLE) continue;

      const weights    = BIOME_TILE_WEIGHTS[tile.biome] ?? BIOME_TILE_WEIGHTS[BIOME.PLAINS];
      const chosenType = this._weightedRandom(weights);

      // 마을: VILLAGE_MIN_DIST 이격 보장
      if (chosenType === TILE.VILLAGE) {
        const tooClose = grid.getTilesByType(TILE.VILLAGE)
          .some((v) => Math.hypot(v.x - tile.x, v.y - tile.y) < VILLAGE_MIN_DIST);
        if (tooClose) {
          grid.updateTile(tile.x, tile.y, { type: TILE.EMPTY });
          continue;
        }
      }

      grid.updateTile(tile.x, tile.y, { type: chosenType });
    }
  }

  // ── Dragon Nest 바이옴 내 BOSS 타일 1개 배치 → 위치 반환 (= 드래곤 스폰 지점) ──
  _placeBossTile(grid) {
    const candidates = Array.from(grid.tiles.values()).filter(
      (t) => t.biome === BIOME.DRAGON_NEST && t.type === TILE.EMPTY,
    );
    if (candidates.length === 0) return { x: 0, y: 0 };

    const pick = candidates[Math.floor(this._rng() * candidates.length)];
    grid.updateTile(pick.x, pick.y, { type: TILE.BOSS });
    return { x: pick.x, y: pick.y };
  }

  // ================================================================
  // 유틸
  // ================================================================

  // 가중치 랜덤 선택 — options: [{ biome|type, w }]
  _weightedRandom(options) {
    const total = options.reduce((s, o) => s + (o.w ?? 1), 0);
    let   r     = this._rng() * total;
    for (const opt of options) {
      r -= opt.w ?? 1;
      if (r <= 0) return opt.biome ?? opt.type;
    }
    return options[options.length - 1].biome ?? options[options.length - 1].type;
  }

  // 간이 LCG 난수 생성기 (0~1)
  _makeLCG(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }
}
