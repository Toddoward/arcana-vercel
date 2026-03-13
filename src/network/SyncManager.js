// ============================================================
// src/network/SyncManager.js
// 상태 동기화 — 스냅샷 브로드캐스트 / 호스트 마이그레이션 감지 / 클라이언트 액션 전송
//
// GDD: §2.5 (호스트-클라이언트 구조, 호스트 마이그레이션, P2P 메시)
//
// 의존:
//   PeerManager.js  — MSG 타입, 전송 레이어
//   HostManager.js  — 호스트 전용 로직
//   gameStore.js    — getSnapshot / applySnapshot / setPlayerCount
//   playerStore.js  — getSnapshot / applySnapshot
//
// 역할:
//   [호스트]  매 턴 종료 → STATE_SNAPSHOT 브로드캐스트
//   [클라이언트]  STATE_SNAPSHOT 수신 → 로컬 스토어 적용
//                 ACTION 전송 (호스트에게)
//   [공통]  HOST_MIGRATE 수신 → joinedAt 기준 결정론적 선출
// ============================================================

import { MSG }            from './PeerManager.js';
import { useGameStore }   from '../stores/gameStore.js';
import { usePlayerStore } from '../stores/playerStore.js';

// 호스트 마이그레이션 결정 지연 (ms) — 모든 피어가 동시에 실행
const MIGRATION_DECIDE_MS = 200;

// ================================================================
export class SyncManager {
  /**
   * @param {import('./PeerManager.js').PeerManager}  peerManager
   * @param {import('./HostManager.js').HostManager}  hostManager
   * @param {object} options
   * @param {string}   options.myPeerId
   * @param {string}   options.myPlayerName
   * @param {number}   options.myJoinedAt   — 로비 입장 timestamp
   * @param {Function} options.onBecomeHost  — () => void  신규 호스트가 됐을 때 콜백
   */
  constructor(peerManager, hostManager, options = {}) {
    this._pm            = peerManager;
    this._hm            = hostManager;
    this._myPeerId      = options.myPeerId      ?? peerManager.myPeerId;
    this._myPlayerName  = options.myPlayerName  ?? 'Player';
    this._myJoinedAt    = options.myJoinedAt    ?? Date.now();
    this._onBecomeHost  = options.onBecomeHost  ?? (() => {});

    // 알려진 피어 목록: peerId → { joinedAt }
    this._peers = new Map();
    this._peers.set(this._myPeerId, { joinedAt: this._myJoinedAt });

    this._hostPeerId    = null;   // 현재 호스트 peerId (null = 자신이 호스트)
    this._migrationTimer = null;

    this._registerHandlers();
  }

  // ================================================================
  // 현재 자신이 호스트인지 여부
  // ================================================================
  get isHost() {
    return this._hm?.isHost ?? false;
  }

  // ================================================================
  // [호스트 전용] 턴 종료 시 전체 상태 스냅샷 브로드캐스트
  // CombatEngine._advanceTurn() 또는 WorldMapScene.endTurn() 에서 호출
  // ================================================================
  broadcastSnapshot() {
    if (!this.isHost) return;

    const snapshot = {
      game:    useGameStore.getState().getSnapshot(),
      players: usePlayerStore.getState().getSnapshot(),
      ts:      Date.now(),
    };
    this._pm.broadcast(MSG.STATE_SNAPSHOT, snapshot);
  }

  // ================================================================
  // [클라이언트 전용] 플레이어 액션을 호스트에게 전송
  //
  // @param {object} action  { type, payload }
  //   예시: { type: 'USE_CARD', payload: { cardInstanceId, targetId } }
  //         { type: 'END_TURN' }
  //         { type: 'EQUIP_SWAP', payload: { oldItemId, newItemId } }
  // ================================================================
  sendAction(action) {
    if (this.isHost) {
      // 호스트는 직접 큐에 삽입 (자기 자신 액션)
      this._hm?.dequeueAction && this._processLocalAction(action);
      return;
    }
    if (!this._hostPeerId) {
      console.warn('[SyncManager] sendAction: 호스트 peerId 미설정');
      return;
    }
    this._pm.send(this._hostPeerId, MSG.ACTION, {
      ...action,
      from:     this._myPeerId,
      sentAt:   Date.now(),
    });
  }

  // ================================================================
  // 피어 목록 갱신 (HostManager → PEER_LIST 수신 또는 로비 참가 시)
  // ================================================================
  updatePeerList(peers) {
    // peers: [{ peerId, joinedAt }, ...]
    this._peers.clear();
    for (const p of peers) {
      this._peers.set(p.peerId, { joinedAt: p.joinedAt });
    }
  }

  // ================================================================
  // 호스트 peerId 설정 (로비 참가 성공 후 클라이언트에서 호출)
  // ================================================================
  setHostPeerId(hostPeerId) {
    this._hostPeerId = hostPeerId;
  }

  destroy() {
    clearTimeout(this._migrationTimer);
  }

  // ================================================================
  // 내부: 메시지 핸들러 등록
  // ================================================================
  _registerHandlers() {
    // 스냅샷 수신 → 로컬 스토어 적용 (클라이언트만)
    this._pm.on(MSG.STATE_SNAPSHOT, ({ payload }) => {
      if (this.isHost) return; // 호스트는 자신이 권위
      useGameStore.getState().applySnapshot(payload.game);
      usePlayerStore.getState().applySnapshot(payload.players);
    });

    // 미러 스냅샷 수신 (2순위 피어만 해당)
    this._pm.on(MSG.MIRROR_SNAPSHOT, ({ payload }) => {
      // 2순위 피어가 백업 상태 유지
      useGameStore.getState().applySnapshot(payload.gameStore);
      usePlayerStore.getState().applySnapshot(payload.playerStore);
    });

    // 피어 목록 수신
    this._pm.on(MSG.PEER_LIST, ({ payload }) => {
      this.updatePeerList(payload.peers ?? []);
    });

    // 호스트 마이그레이션 선언 수신
    this._pm.on(MSG.HOST_MIGRATE, ({ payload }) => {
      // 신규 호스트가 이미 선언함 → 승인하고 호스트 peerId 갱신
      const newHostId = payload.newHostId;
      if (newHostId !== this._myPeerId) {
        this._hostPeerId = newHostId;
      }
    });

    // 피어 연결 끊김 → 호스트 마이그레이션 감지
    this._pm.onDisconnect((peerId) => {
      this._onPeerDisconnect(peerId);
    });
  }

  // ── 피어 연결 끊김 처리 ───────────────────────────────────────
  _onPeerDisconnect(peerId) {
    this._peers.delete(peerId);

    const disconnectedIsHost = peerId === this._hostPeerId;
    if (!disconnectedIsHost) return;

    // 호스트가 끊겼음 — 결정론적 선출 시작
    // GDD §2.5: joinedAt 가장 이른 피어가 신규 호스트
    clearTimeout(this._migrationTimer);
    this._migrationTimer = setTimeout(() => {
      this._electNewHost();
    }, MIGRATION_DECIDE_MS);
  }

  _electNewHost() {
    // 살아있는 피어 중 joinedAt 가장 이른 피어 = 신규 호스트
    const sorted = [...this._peers.entries()]
      .sort(([, a], [, b]) => a.joinedAt - b.joinedAt);

    if (sorted.length === 0) return;
    const [newHostId] = sorted[0];

    if (newHostId === this._myPeerId) {
      // 내가 신규 호스트
      this._hostPeerId = null;
      this._hm?.declareSelfAsHost(this._myPlayerName);
      this._onBecomeHost();
    } else {
      // 다른 피어가 호스트가 됨 — HOST_MIGRATE 수신 대기
      this._hostPeerId = newHostId;
    }
  }

  // ── 호스트 자신의 액션 직접 처리 (로컬) ──────────────────────
  _processLocalAction(action) {
    // 호스트는 액션을 바로 처리 후 broadcastSnapshot
    // 실제 처리는 CombatEngine / WorldMapScene 에서 담당
    // 여기서는 큐에 삽입만 (HostManager.dequeueAction()으로 처리)
    console.debug('[SyncManager] host local action:', action.type);
  }
}
