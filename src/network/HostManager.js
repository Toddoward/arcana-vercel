// ============================================================
// src/network/HostManager.js
// 호스트 전용 — 게임 상태 권위 / 참여코드 발급 / 호스트 마이그레이션
//
// GDD: §2.5 네트워크 구조, 호스트 마이그레이션
//      §4.3 로비 시스템 (6자리 코드, Ready, 게임 시작)
//
// 의존:
//   PeerManager.js — 전송 레이어
//   SyncManager.js — 상태 브로드캐스트
//   gameStore.js   — playerCount 갱신
//   playerStore.js — 플레이어 목록 갱신
//
// 역할:
//   - 호스트만 실행. 클라이언트는 이 파일을 사용하지 않음
//   - 액션 수신 → 처리 → 결과 브로드캐스트
//   - 호스트 마이그레이션 자가 선언 (joinedAt 기준 결정론적 선출)
// ============================================================

import { PeerManager, MSG } from './PeerManager.js';
import { useGameStore }    from '../stores/gameStore.js';
import { usePlayerStore }  from '../stores/playerStore.js';

// 참여코드 길이 (GDD §2.5: 6자리)
const CODE_LENGTH = 6;
// 2순위 피어 미러링 간격 ms
const MIRROR_INTERVAL_MS = 2_000;

// ================================================================
export class HostManager {
  /**
   * @param {PeerManager} peerManager
   */
  constructor(peerManager) {
    this._pm           = peerManager;
    this._isHost       = false;
    this._joinCode     = null;
    this._lobby        = new Map(); // peerId → { peerId, playerName, ready, joinedAt, isMirror }
    this._mirrorPeerId = null;  // 2순위 피어 ID
    this._mirrorTimer  = null;
    this._actionQueue  = [];    // 처리 대기 액션 큐
    this._onGameStart  = null;  // () => void 콜백
  }

  // ================================================================
  // 호스트 초기화 — 참여코드 발급 + 핸들러 등록
  //
  // @param {string} hostPlayerName
  // @returns {{ joinCode: string, peerId: string }}
  // ================================================================
  async becomeHost(hostPlayerName) {
    this._isHost   = true;
    this._joinCode = this._generateCode();

    // 호스트 자신을 로비에 등록
    this._lobby.set(this._pm.myPeerId, {
      peerId:     this._pm.myPeerId,
      playerName: hostPlayerName,
      ready:      false,
      joinedAt:   Date.now(),
      isMirror:   false,
    });

    this._registerHandlers();
    this._startMirrorLoop();

    useGameStore.getState().setPlayerCount(1);

    return { joinCode: this._joinCode, peerId: this._pm.myPeerId };
  }

  // ================================================================
  // 이어하기 호스트 초기화
  // ================================================================
  async becomeHostContinue(hostPlayerName) {
    return this.becomeHost(hostPlayerName);
  }

  // ================================================================
  // 게임 시작 콜백 등록
  // ================================================================
  onGameStart(fn) {
    this._onGameStart = fn;
  }

  // ================================================================
  // 강제 게임 시작 (모든 플레이어 Ready 상태일 때 방장 호출)
  // ================================================================
  startGame() {
    if (!this._isHost) return;
    const players = [...this._lobby.values()].map((p) => ({
      peerId:     p.peerId,
      playerName: p.playerName,
    }));
    this._pm.broadcast(MSG.GAME_START, { players });
    this._onGameStart?.({ players });
  }

  get joinCode() { return this._joinCode; }
  get isHost()   { return this._isHost; }
  get lobbyList() { return [...this._lobby.values()]; }

  // ================================================================
  // 호스트 마이그레이션 자가 선언
  // 호스트 연결 끊김 감지 후 결정론적 선출 알고리즘 결과로 자신이
  // 신규 호스트임을 판단했을 때 외부(SyncManager)에서 호출
  //
  // GDD §2.5: joinedAt 가장 이른 피어 = 신규 호스트
  // ================================================================
  async declareSelfAsHost(myPlayerName) {
    this._isHost   = true;
    this._joinCode = this._generateCode(); // 새 코드 발급 불필요하지만 내부 일관성용

    this._lobby.set(this._pm.myPeerId, {
      peerId:     this._pm.myPeerId,
      playerName: myPlayerName,
      ready:      true,
      joinedAt:   Date.now(),
      isMirror:   false,
    });

    this._registerHandlers();
    this._startMirrorLoop();

    // 나머지 피어에게 마이그레이션 선언
    this._pm.broadcast(MSG.HOST_MIGRATE, {
      newHostId: this._pm.myPeerId,
    });
  }

  destroy() {
    clearInterval(this._mirrorTimer);
    this._isHost = false;
  }

  // ================================================================
  // 내부: 메시지 핸들러 등록
  // ================================================================
  _registerHandlers() {
    // 참가 요청
    this._pm.on(MSG.LOBBY_JOIN, ({ payload, from }) => {
      this._handleJoin(from, payload);
    });

    // Ready 상태 변경
    this._pm.on(MSG.PLAYER_READY, ({ payload, from }) => {
      const entry = this._lobby.get(from);
      if (entry) {
        entry.ready = payload.ready;
        this._broadcastLobbyState();
      }
    });

    // 클라이언트 액션
    this._pm.on(MSG.ACTION, ({ payload, from }) => {
      this._actionQueue.push({ ...payload, from });
    });

    // 피어 연결 해제 감지
    this._pm.onDisconnect((peerId) => {
      this._handlePeerLeave(peerId);
    });
  }

  // ── 참가 처리 ─────────────────────────────────────────────────
  _handleJoin(peerId, payload) {
    if (this._lobby.has(peerId)) return;

    const entry = {
      peerId,
      playerName: payload.playerName ?? `Player_${peerId.slice(0, 4)}`,
      ready:      false,
      joinedAt:   payload.joinedAt ?? Date.now(),
      isMirror:   false,
    };
    this._lobby.set(peerId, entry);

    // 2순위 피어 갱신 (joinedAt 기준 2번째)
    this._updateMirrorPeer();

    // playerCount 갱신
    useGameStore.getState().setPlayerCount(this._lobby.size);

    // 로비 상태 전체 브로드캐스트
    this._broadcastLobbyState();
  }

  // ── 피어 퇴장 처리 ────────────────────────────────────────────
  _handlePeerLeave(peerId) {
    this._lobby.delete(peerId);
    this._updateMirrorPeer();
    useGameStore.getState().setPlayerCount(this._lobby.size);
    this._broadcastLobbyState();
  }

  // ── 로비 상태 브로드캐스트 ─────────────────────────────────────
  _broadcastLobbyState() {
    const lobbyList = [...this._lobby.values()];
    this._pm.broadcast(MSG.LOBBY_STATE, { lobbyList });
  }

  // ── 2순위 피어(백업 호스트) 갱신 ─────────────────────────────
  _updateMirrorPeer() {
    const sorted = [...this._lobby.values()]
      .filter((p) => p.peerId !== this._pm.myPeerId)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    this._mirrorPeerId = sorted[0]?.peerId ?? null;
  }

  // ── 2순위 피어 미러링 루프 ────────────────────────────────────
  // GDD §2.5: 2순위 피어가 항상 호스트 상태 실시간 미러링
  _startMirrorLoop() {
    clearInterval(this._mirrorTimer);
    this._mirrorTimer = setInterval(() => {
      if (!this._mirrorPeerId) return;
      const snapshot = {
        gameStore:   useGameStore.getState().getSnapshot(),
        playerStore: usePlayerStore.getState().getSnapshot(),
      };
      this._pm.send(this._mirrorPeerId, MSG.MIRROR_SNAPSHOT, snapshot);
    }, MIRROR_INTERVAL_MS);
  }

  // ── 참여코드 생성 (대문자+숫자 6자리) ─────────────────────────
  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // ================================================================
  // 액션 큐에서 다음 액션 꺼내기 (SyncManager가 매 틱 호출)
  // ================================================================
  dequeueAction() {
    return this._actionQueue.shift() ?? null;
  }
}