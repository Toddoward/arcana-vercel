// ============================================================
// src/game/world/DragonAI.js
// 레드 드래곤 월드맵 이동 AI
// - 매 적 AI 턴: 경로상 가장 가까운 마을 → 왕국 성 순서로 목표 선정
// - 이동: A* 70% / 랜덤 이탈 30%
// - 마을 도착 시: 소각 처리 + 다음 목표 갱신
// ============================================================
import { TILE, WORLD } from '../../constants/constants.js';
import { useGameStore }   from '../../stores/gameStore.js';
import { usePlayerStore } from '../../stores/playerStore.js';
import { useUIStore }     from '../../stores/uiStore.js';

// 왕국 성 좌표 (상수에서 직접 참조)
const CASTLE_POS = { x: WORLD.CASTLE_X, y: WORLD.CASTLE_Y };

export class DragonAI {
  /**
   * @param {HexGrid} grid  월드맵 HexGrid 참조
   */
  constructor(grid) {
    this._grid = grid;
  }

  // ── 그리드 교체 (월드맵 재생성 시) ──────────────────────
  setGrid(grid) {
    this._grid = grid;
  }

  // ── 메인 — 드래곤 1턴 처리 ───────────────────────────────
  /**
   * useGameStore 상태를 읽어 드래곤 이동 + 이벤트 처리
   * @returns {{ moved: boolean, burnedVillage: {x,y}|null, gameOver: boolean }}
   */
  tick() {
    const gameState   = useGameStore.getState();
    const dragonAlive = gameState.dragonAlive;
    const dragonPos   = gameState.dragonPos;

    if (!dragonAlive || !dragonPos) {
      return { moved: false, burnedVillage: null, gameOver: false };
    }

    // ── 목표 선정 ─────────────────────────────────────────
    const target = this._selectTarget(dragonPos, gameState.burnedVillages);

    // ── 다음 칸 결정 (A* 70% / 랜덤 30%) ─────────────────
    const nextPos = this._decideNextStep(dragonPos, target);
    if (!nextPos) {
      return { moved: false, burnedVillage: null, gameOver: false };
    }

    // ── 이동 적용 ─────────────────────────────────────────
    useGameStore.getState().setDragonPos(nextPos);
    useGameStore.getState().setDragonTarget(target);

    // ── 이동 후 이벤트 처리 ───────────────────────────────
    const arrivedTile = this._grid.getTile(nextPos.x, nextPos.y);
    let burnedVillage = null;
    let gameOver      = false;

    if (arrivedTile) {
      // 마을 도달 → 소각
      if (arrivedTile.type === TILE.VILLAGE) {
        burnedVillage = { x: nextPos.x, y: nextPos.y };
        useGameStore.getState().burnVillage(nextPos.x, nextPos.y);
        this._grid.updateTile(nextPos.x, nextPos.y, { type: TILE.VILLAGE_BURNED });
        this._evictPlayersFromTile(nextPos.x, nextPos.y);
        this._failDeliveryQuests(nextPos.x, nextPos.y);
        useUIStore.getState().addToast(
          `🔥 드래곤이 마을을 불태웠습니다! (${nextPos.x}, ${nextPos.y})`,
          'error',
        );
      }

      // 왕국 성 도달 → 게임오버
      if (arrivedTile.type === TILE.CASTLE) {
        gameOver = true;
        useGameStore.getState().triggerGameOver('DRAGON_REACHED_CASTLE');
        useUIStore.getState().addToast(
          '🐉 드래곤이 왕국에 도달했습니다! 게임 오버.',
          'error',
        );
      }
    }

    return { moved: true, burnedVillage, gameOver };
  }

  // ── 목표 타일 선정 ────────────────────────────────────────
  /**
   * 1. 드래곤 → 성 방향 경로상에 소각되지 않은 마을이 있으면 → 가장 가까운 마을
   * 2. 없으면 → 왕국 성
   */
  _selectTarget(dragonPos, burnedVillages) {
    // 드래곤은 모든 타일 통과 가능 (ignoreBlocked: true)
    const pathToCastle = this._grid.findPath(
      dragonPos.x, dragonPos.y,
      CASTLE_POS.x, CASTLE_POS.y,
      true,
    );

    if (!pathToCastle || pathToCastle.length === 0) {
      return CASTLE_POS;
    }

    const burnedSet = new Set(
      burnedVillages.map((v) => `${v.x},${v.y}`),
    );

    for (const step of pathToCastle) {
      const tile = this._grid.getTile(step.x, step.y);
      if (
        tile?.type === TILE.VILLAGE &&
        !burnedSet.has(`${step.x},${step.y}`)
      ) {
        return { x: step.x, y: step.y };
      }
    }

    return CASTLE_POS;
  }

  // ── 다음 스텝 결정 ────────────────────────────────────────
  _decideNextStep(from, target) {
    // 30% 확률로 랜덤 이탈
    if (Math.random() < 0.30) {
      const neighbors = this._grid.neighbors(from.x, from.y);
      if (neighbors.length > 0) {
        return neighbors[Math.floor(Math.random() * neighbors.length)];
      }
    }

    // 70% — A* 최단경로 1칸 이동
    const path = this._grid.findPath(
      from.x, from.y,
      target.x, target.y,
      true,
    );

    if (path && path.length > 0) {
      return path[0];
    }

    // 경로 없음 → target에 가장 가까운 이웃 선택
    const neighbors = this._grid.neighbors(from.x, from.y);
    if (neighbors.length === 0) return null;

    let best     = null;
    let bestDist = Infinity;
    for (const nb of neighbors) {
      const d = this._grid.distance(nb.x, nb.y, target.x, target.y);
      if (d < bestDist) { bestDist = d; best = nb; }
    }
    return best;
  }

  // ── 마을 소각 시 해당 타일의 플레이어 강제 이동 ─────────
  _evictPlayersFromTile(tx, ty) {
    const playerState = usePlayerStore.getState();
    const players     = playerState.players;

    players.forEach((player) => {
      if (player.tileX !== tx || player.tileY !== ty) return;

      const options = this._grid
        .neighbors(tx, ty)
        .filter(({ x, y }) => {
          const t = this._grid.getTile(x, y);
          return t && t.type === TILE.EMPTY;
        });

      if (options.length > 0) {
        const dest = options[Math.floor(Math.random() * options.length)];
        playerState.movePlayer(player.id, dest.x, dest.y);
        useUIStore.getState().addToast(
          `${player.name}이(가) 드래곤 공격으로 인근으로 이동했습니다.`,
          'warn',
        );
      }
    });
  }

  // ── 배달 퀘스트 실패 처리 ─────────────────────────────────
  _failDeliveryQuests(burnedX, burnedY) {
    const playerState = usePlayerStore.getState();
    const players     = playerState.players;

    players.forEach((player) => {
      player.activeQuests.forEach((quest) => {
        if (
          quest.type === 'DELIVERY' &&
          !quest.completed &&
          quest.targetX === burnedX &&
          quest.targetY === burnedY
        ) {
          playerState.failQuest(player.id, quest.questId);
          useUIStore.getState().addToast(
            `배달 퀘스트 실패: 목표 마을이 소각되었습니다.`,
            'error',
          );
        }
      });
    });
  }

  // ── 드래곤 처치 처리 ──────────────────────────────────────
  onDragonDefeated() {
    useGameStore.getState().setDragonAlive(false);
    useUIStore.getState().addToast(
      '🏆 레드 드래곤을 처치했습니다!',
      'info',
    );
  }
}