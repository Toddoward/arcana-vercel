// ============================================================
// src/game/battle/Initiative.js
// 전투 이니셔티브 — Bresenham 누적 방식
//
// 원리:
//   기준: DEX 5 = 1주기 1회 행동 (베이스라인)
//   각 유닛은 매 주기 (DEX / 5)를 누적기에 더함
//   누적기 >= 1 이 되면 그 주기에 행동권 획득 → 누적기에서 1.0 차감
//
// 예시 (DEX 4, 7, 9, 5):
//   주기 1: acc [0.8, 1.4→행동, 1.8→행동, 1.0→행동]
//   주기 2: acc [1.6→행동, 0.9, 1.6→행동, 1.0→행동]
//   ...
// ============================================================

const BASE_DEX = 5; // DEX 5 = 1주기 1행동 기준

export class Initiative {
  /**
   * 유닛 배열로 이니셔티브 관리자 초기화
   * @param {Array<{ id: string, dex: number, isPlayer: boolean }>} units
   */
  constructor(units) {
    // 누적기 맵: unitId → 누적값 (0~1 미만 유지)
    this._accumulators = new Map();
    this._units        = units;

    // 초기 누적기: 동점 방지를 위해 DEX 기반 작은 오프셋 추가
    for (const u of units) {
      // 높은 DEX일수록 첫 주기 행동 우선 → 작은 선행 값 부여
      this._accumulators.set(u.id, (u.dex / BASE_DEX) * 0.01);
    }
  }

  // ================================================================
  // 한 주기(Cycle) 실행 → 행동 순서 배열 반환
  //
  // @returns {Array<string>} 이번 주기에 행동하는 unitId 목록 (순서 포함)
  //   - 단일 유닛이 여러 번 등장 가능 (DEX가 매우 높을 때)
  //   - 동일 주기 내 등장 순서: DEX 높은 순 → 동점 시 등록 순
  // ================================================================
  nextCycle() {
    const actionsThisCycle = []; // { id, order }

    for (const u of this._units) {
      let acc = (this._accumulators.get(u.id) ?? 0) + u.dex / BASE_DEX;

      // 누적기가 1 이상일 때마다 행동 추가
      while (acc >= 1.0) {
        actionsThisCycle.push({ id: u.id, dex: u.dex });
        acc -= 1.0;
      }

      this._accumulators.set(u.id, acc);
    }

    // DEX 내림차순 정렬 (같은 DEX면 등록 순 유지 — stable sort)
    actionsThisCycle.sort((a, b) => b.dex - a.dex);

    return actionsThisCycle.map((a) => a.id);
  }

  // ================================================================
  // 유닛 제거 (사망/도주)
  // ================================================================
  removeUnit(unitId) {
    this._accumulators.delete(unitId);
    this._units = this._units.filter((u) => u.id !== unitId);
  }

  // ================================================================
  // DEX 변경 시 반영 (디버프/버프)
  // ================================================================
  updateDex(unitId, newDex) {
    const unit = this._units.find((u) => u.id === unitId);
    if (unit) unit.dex = newDex;
  }

  // ================================================================
  // 현재 누적기 스냅샷 (디버그용)
  // ================================================================
  snapshot() {
    return Object.fromEntries(this._accumulators);
  }
}
