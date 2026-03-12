// ============================================================
// src/game/world/WorldGenerator.js
// 절차적 월드맵 생성
// 파이프라인:
//  [1] fBm 노이즈 생성
//  [2] Square Gradient 합성 → 단일 아일랜드 마스크
//  [3] Threshold → 육지 타일 확정
//  [4] 최소 이격 조건으로 N개 centroid 랜덤 배치
//  [5] 왕국 성 centroid 1개 랜덤 선택
//      가장 먼 centroid → 드래곤 둥지
//      나머지 → 성 거리 비율 기반(B안) 바이옴 배정
//  [6] Voronoi 분할 (경계 지터 포함) → 타일별 바이옴 확정
//  [7] 바이옴별 가중치 테이블 → 타일 타입 배치
//  [8] 드래곤 스폰 → 성에서 최원거리 육지 타일
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
const NOISE_PERSISTENCE   = 0.55;  // 고주파 옥타브 감쇠율 (0~1)
const NOISE_LACUNARITY    = 1.0;  // 옥타브당 주파수 배율
const NOISE_SCALE         = 0.15; // 전체 노이즈 스케일 (작을수록 섬이 커짐)

// ── 아일랜드 형태 ─────────────────────────────────────────────────
const GRADIENT_STRENGTH   = 1.3;  // Square gradient 강도 (높을수록 섬이 작아짐)
const LAND_THRESHOLD      = 0.02; // 이 값 이상인 타일만 육지 (높일수록 육지 면적 감소)

// ── 바이옴 Voronoi ────────────────────────────────────────────────
const BIOME_CENTROID_COUNT = 18;  // 전체 centroid 수 (성·둥지 포함)
const MIN_CENTROID_DIST    = 3;   // centroid 간 최소 이격 거리 (타일 단위)
const CASTLE_MARGIN        = 2;   // 성 centroid 선택 시 맵 외곽 최소 이격
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
            biome:    BIOME.PLAINS, // 임시값 — Voronoi 단계에서 덮어씀
            entities: [],
          });
        }
      }
    }

    // ── [4] centroid 배치 ─────────────────────────────────────────
    const centroids = this._placeCentroids(grid);

    // centroid가 너무 적게 생성된 경우 fallback (맵이 너무 작을 때)
    if (centroids.length < 3) {
      console.warn('[WorldGenerator] centroid 부족 — 맵 재생성 권장');
    }

    // ── [5] 왕국 성 / 드래곤 둥지 / 나머지 바이옴 배정 ───────────
    const { castlePos } = this._assignSpecialCentroids(centroids);

    // ── [6] Voronoi 분할 → 타일별 바이옴 확정 ────────────────────
    this._assignVoronoiBiomes(grid, centroids);

    // 성 타일 배치 (centroid 위치)
    grid.updateTile(castlePos.x, castlePos.y, {
      type:  TILE.CASTLE,
      biome: BIOME.CASTLE,
    });

    // ── [7] 바이옴별 타일 타입 배치 ──────────────────────────────
    this._placeBiomeTiles(grid, castlePos);

    // 드래곤 둥지 바이옴 내 보스 타일 1개
    this._placeBossTile(grid);

    // ── [8] 드래곤 스폰 → 성에서 최원거리 육지 타일 ──────────────
    const dragonSpawn = this._findDragonSpawn(grid, castlePos);

    return { grid, castlePos, dragonSpawn };
  }

  // ================================================================
  // [1~3] fBm 노이즈 + Square Gradient → 육지 마스크
  // ================================================================
  _generateLandMask() {
    const mask = Array.from({ length: WORLD_ROWS }, () =>
      new Array(WORLD_COLS).fill(false),
    );

    for (let y = 0; y < WORLD_ROWS; y++) {
      for (let x = 0; x < WORLD_COLS; x++) {
        // 정규화 좌표 (0~1)
        const nx = x / WORLD_COLS;
        const ny = y / WORLD_ROWS;

        // fBm 노이즈값 계산
        const noiseVal = this._fbm(nx, ny);

        // Square gradient: 중심(0.5, 0.5) 기준 Chebyshev 거리
        const gx       = Math.abs(nx - 0.5) * 2; // 0~1
        const gy       = Math.abs(ny - 0.5) * 2; // 0~1
        const gradient  = Math.max(gx, gy);       // Chebyshev → 사각형 형태

        // gradient 합성: 중앙은 거의 그대로, 외곽은 크게 감소
        const finalVal  = noiseVal - gradient * GRADIENT_STRENGTH;

        mask[y][x] = finalVal >= LAND_THRESHOLD;
      }
    }

    return mask;
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
  // [3.5] Flood Fill — 최대 연결 컴포넌트만 남기고 고립 타일 제거
  // 단일 섬 보장
  // ================================================================
  _keepLargestComponent(grid) {
    const visited    = new Set();
    const components = [];

    for (const tile of grid.tiles.values()) {
      const key = grid._key(tile.x, tile.y);
      if (visited.has(key)) continue;

      // BFS
      const component = [];
      const queue     = [tile];
      visited.add(key);

      while (queue.length > 0) {
        const cur = queue.shift();
        component.push(cur);
        for (const nb of grid.neighbors(cur.x, cur.y)) {
          const nk = grid._key(nb.x, nb.y);
          if (!visited.has(nk)) {
            visited.add(nk);
            queue.push(grid.getTile(nb.x, nb.y));
          }
        }
      }
      components.push(component);
    }

    // 가장 큰 컴포넌트만 유지
    if (components.length <= 1) return;
    components.sort((a, b) => b.length - a.length);
    for (let i = 1; i < components.length; i++) {
      for (const t of components[i]) {
        grid.tiles.delete(grid._key(t.x, t.y));
      }
    }
  }

  // ================================================================
  // 육지 타일 위에 최소 이격 조건으로 BIOME_CENTROID_COUNT개 배치
  // ================================================================
  _placeCentroids(grid) {
    // ── [3.5] Flood Fill → 최대 연결 컴포넌트만 유지 ──────────
    this._keepLargestComponent(grid);

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
  // [5] 왕국 성 / 드래곤 둥지 / 나머지 centroid 바이옴 배정
  // ================================================================
  _assignSpecialCentroids(centroids) {
    if (centroids.length === 0) {
      return { castlePos: { x: Math.floor(WORLD_COLS / 2), y: Math.floor(WORLD_ROWS / 2) } };
    }

    // ── 왕국 성: 외곽 너무 가장자리는 제외하고 랜덤 선택 ─────────
    const castleCandidates = centroids.filter(
      (c) =>
        c.x >= CASTLE_MARGIN &&
        c.x < WORLD_COLS - CASTLE_MARGIN &&
        c.y >= CASTLE_MARGIN &&
        c.y < WORLD_ROWS - CASTLE_MARGIN,
    );

    // 후보가 없으면 전체 centroid에서 선택
    const pool         = castleCandidates.length > 0 ? castleCandidates : centroids;
    const castleIdx    = Math.floor(this._rng() * pool.length);
    const castleCentroid = pool[castleIdx];
    castleCentroid.biome = BIOME.CASTLE;
    const castlePos    = { x: castleCentroid.x, y: castleCentroid.y };

    // ── 드래곤 둥지: 성에서 가장 먼 centroid ──────────────────────
    let maxDist   = -1;
    let nestCentroid = null;

    for (const c of centroids) {
      if (c === castleCentroid) continue;
      const d = Math.hypot(c.x - castlePos.x, c.y - castlePos.y);
      if (d > maxDist) { maxDist = d; nestCentroid = c; }
    }

    if (nestCentroid) nestCentroid.biome = BIOME.DRAGON_NEST;

    // ── 나머지: B안 — 거리 비율 기반 바이옴 배정 ─────────────────
    for (const c of centroids) {
      if (c.biome === BIOME.CASTLE || c.biome === BIOME.DRAGON_NEST) continue;

      const dist  = Math.hypot(c.x - castlePos.x, c.y - castlePos.y);
      const ratio = maxDist > 0 ? dist / maxDist : 0;

      c.biome = this._biomeByDistanceRatio(ratio);
    }

    return { castlePos };
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

  // ── 드래곤 둥지 바이옴 내 보스 타일 1개 ─────────────────────
  _placeBossTile(grid) {
    const candidates = Array.from(grid.tiles.values()).filter(
      (t) => t.biome === BIOME.DRAGON_NEST && t.type === TILE.EMPTY,
    );
    if (candidates.length === 0) return;

    const pick = candidates[Math.floor(this._rng() * candidates.length)];
    grid.updateTile(pick.x, pick.y, { type: TILE.BOSS });
  }

  // ================================================================
  // [8] 드래곤 스폰 → 성에서 최원거리 육지 타일
  // ================================================================
  _findDragonSpawn(grid, castlePos) {
    let maxDist = -1;
    let best    = null;
    const ties  = [];

    for (const tile of grid.tiles.values()) {
      if (tile.type === TILE.CASTLE) continue;
      const d = Math.hypot(tile.x - castlePos.x, tile.y - castlePos.y);
      if (d > maxDist) {
        maxDist = d;
        ties.length = 0;
        ties.push(tile);
      } else if (d === maxDist) {
        ties.push(tile);
      }
    }

    if (ties.length > 0) {
      best = ties[Math.floor(this._rng() * ties.length)];
    }

    return best ? { x: best.x, y: best.y } : { x: 0, y: 0 };
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