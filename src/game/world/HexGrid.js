// ============================================================
// src/game/world/HexGrid.js
// Hex 그리드 좌표계 + 이웃 탐색 + A* 경로탐색
// Offset 좌표계 사용 (odd-r / 홀수 행 오프셋)
// ============================================================
import { WORLD, TILE } from '../../constants/constants.js';

// ── Hex 방향 벡터 (odd-r offset) ─────────────────────────────
// 짝수 행(even row) 이웃 6방향
const EVEN_DIRS = [
  [+1,  0], [+1, -1], [ 0, -1],
  [-1,  0], [ 0, +1], [+1, +1],
];
// 홀수 행(odd row) 이웃 6방향
const ODD_DIRS = [
  [+1,  0], [ 0, -1], [-1, -1],
  [-1,  0], [-1, +1], [ 0, +1],
];

// ── 이동 불가 타일 ────────────────────────────────────────────
const BLOCKED_TILES = new Set([
  // 현재 설계상 모든 타일은 이동 가능
  // 추후 산악/절벽 타일 추가 시 여기에 등록
]);

// ── HexGrid 클래스 ────────────────────────────────────────────
export class HexGrid {
  /**
   * @param {number} cols  가로 타일 수 (기본 WORLD.COLS = 25)
   * @param {number} rows  세로 타일 수 (기본 WORLD.ROWS = 25)
   */
  constructor(cols = WORLD.COLS, rows = WORLD.ROWS) {
    this.cols  = cols;
    this.rows  = rows;
    // tiles: Map<'x,y', TileData>
    // TileData: { x, y, type, biome, entities: [] }
    this.tiles = new Map();
  }

  // ── 타일 등록 ────────────────────────────────────────────
  setTile(x, y, data) {
    this.tiles.set(this._key(x, y), { x, y, ...data });
  }

  getTile(x, y) {
    return this.tiles.get(this._key(x, y)) ?? null;
  }

  hasTile(x, y) {
    return this.tiles.has(this._key(x, y));
  }

  updateTile(x, y, patch) {
    const tile = this.getTile(x, y);
    if (!tile) return;
    this.tiles.set(this._key(x, y), { ...tile, ...patch });
  }

  // ── 이웃 좌표 6개 반환 ────────────────────────────────────
  neighbors(x, y) {
    const dirs = y % 2 === 0 ? EVEN_DIRS : ODD_DIRS;
    return dirs
      .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
      .filter(({ x: nx, y: ny }) =>
        nx >= 0 && nx < this.cols &&
        ny >= 0 && ny < this.rows &&
        this.hasTile(nx, ny),
      );
  }

  // ── 이동 가능한 이웃만 ────────────────────────────────────
  walkableNeighbors(x, y) {
    return this.neighbors(x, y).filter(({ x: nx, y: ny }) => {
      const t = this.getTile(nx, ny);
      return t && !BLOCKED_TILES.has(t.type);
    });
  }

  // ── Hex 거리 계산 (cube 좌표 변환 후 거리) ────────────────
  distance(x1, y1, x2, y2) {
    const [ax, ay, az] = this._toCube(x1, y1);
    const [bx, by, bz] = this._toCube(x2, y2);
    return Math.max(
      Math.abs(ax - bx),
      Math.abs(ay - by),
      Math.abs(az - bz),
    );
  }

  // ── A* 경로탐색 ──────────────────────────────────────────
  /**
   * @param {number} sx  시작 x
   * @param {number} sy  시작 y
   * @param {number} ex  목표 x
   * @param {number} ey  목표 y
   * @param {boolean} ignoreBlocked  드래곤 전용: 블로킹 무시
   * @returns {Array<{x,y}>}  경로 좌표 배열 (시작 제외, 목표 포함) | null (경로 없음)
   */
  findPath(sx, sy, ex, ey, ignoreBlocked = false) {
    if (sx === ex && sy === ey) return [];

    const startKey = this._key(sx, sy);
    const endKey   = this._key(ex, ey);

    // 우선순위 큐 대신 간단한 정렬 배열 사용 (625 타일 규모에서 충분)
    const open   = new Map(); // key → node
    const closed = new Set();
    const cameFrom = new Map();

    const h = (x, y) => this.distance(x, y, ex, ey);

    open.set(startKey, { x: sx, y: sy, g: 0, f: h(sx, sy) });

    while (open.size > 0) {
      // f값 최소 노드 추출
      let current = null;
      let minF    = Infinity;
      for (const node of open.values()) {
        if (node.f < minF) { minF = node.f; current = node; }
      }

      if (current.x === ex && current.y === ey) {
        return this._reconstructPath(cameFrom, endKey);
      }

      const curKey = this._key(current.x, current.y);
      open.delete(curKey);
      closed.add(curKey);

      const nbrs = ignoreBlocked
        ? this.neighbors(current.x, current.y)
        : this.walkableNeighbors(current.x, current.y);

      for (const { x: nx, y: ny } of nbrs) {
        const nKey = this._key(nx, ny);
        if (closed.has(nKey)) continue;

        const tentativeG = current.g + 1;
        const existing   = open.get(nKey);

        if (!existing || tentativeG < existing.g) {
          cameFrom.set(nKey, curKey);
          const node = { x: nx, y: ny, g: tentativeG, f: tentativeG + h(nx, ny) };
          open.set(nKey, node);
        }
      }
    }

    return null; // 경로 없음
  }

  // ── 경로 역추적 ───────────────────────────────────────────
  _reconstructPath(cameFrom, endKey) {
    const path = [];
    let cur = endKey;
    while (cameFrom.has(cur)) {
      const [x, y] = cur.split(',').map(Number);
      path.unshift({ x, y });
      cur = cameFrom.get(cur);
    }
    return path;
  }

  // ── 특정 타입 타일 전체 조회 ──────────────────────────────
  getTilesByType(type) {
    const result = [];
    for (const tile of this.tiles.values()) {
      if (tile.type === type) result.push(tile);
    }
    return result;
  }

  // ── 특정 좌표 주변 N칸 이내 타일 조회 ────────────────────
  getTilesWithinRange(cx, cy, range) {
    const result = [];
    for (const tile of this.tiles.values()) {
      if (this.distance(cx, cy, tile.x, tile.y) <= range) {
        result.push(tile);
      }
    }
    return result;
  }

  // ── 직렬화 (세이브 데이터용) ──────────────────────────────
  serialize() {
    return {
      cols:  this.cols,
      rows:  this.rows,
      tiles: Array.from(this.tiles.values()),
    };
  }

  static deserialize(data) {
    const grid = new HexGrid(data.cols, data.rows);
    data.tiles.forEach((t) => grid.setTile(t.x, t.y, t));
    return grid;
  }

  // ── 내부 유틸 ─────────────────────────────────────────────
  _key(x, y)  { return `${x},${y}`; }

  // offset → cube 좌표 변환 (odd-r)
  _toCube(x, y) {
    const cx = x - (y - (y & 1)) / 2;
    const cz = y;
    const cy = -cx - cz;
    return [cx, cy, cz];
  }
}