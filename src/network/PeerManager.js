// ============================================================
// src/network/PeerManager.js
// PeerJS WebRTC 연결 관리 — 피어 생성 / 연결 / 메시지 송수신
//
// GDD: §2.5 네트워크 구조 (호스트-클라이언트 + P2P 메시 하이브리드)
//
// 역할:
//   - PeerJS Peer 인스턴스 생성 및 수명 관리
//   - 피어 간 DataConnection 관리 (연결/해제/재연결)
//   - 메시지 직렬화/역직렬화 및 수신 라우팅
//   - heartbeat 송수신 (3초 무응답 → 연결 끊김 감지)
//
// 사용 패턴:
//   HostManager / SyncManager 에서 PeerManager를 통해 통신
//   직접 게임 로직 없음 — 순수 전송 레이어
// ============================================================

// heartbeat 무응답 임계값 (GDD §2.5)
const HEARTBEAT_INTERVAL_MS = 1_500;
const HEARTBEAT_TIMEOUT_MS  = 3_000;

// 메시지 타입 상수
export const MSG = {
  // 시스템
  HEARTBEAT:        'HEARTBEAT',
  HEARTBEAT_ACK:    'HEARTBEAT_ACK',
  PEER_LIST:        'PEER_LIST',       // 호스트 → 전체: 현재 연결 피어 목록

  // 로비
  LOBBY_JOIN:       'LOBBY_JOIN',      // 참가자 → 호스트: 참가 요청
  LOBBY_STATE:      'LOBBY_STATE',     // 호스트 → 전체: 로비 상태 브로드캐스트
  PLAYER_READY:     'PLAYER_READY',    // 참가자 → 호스트: Ready 상태 변경
  GAME_START:       'GAME_START',      // 호스트 → 전체: 게임 시작

  // 게임 동기화
  STATE_SNAPSHOT:   'STATE_SNAPSHOT',  // 호스트 → 전체: 전체 상태 스냅샷
  ACTION:           'ACTION',          // 클라이언트 → 호스트: 플레이어 액션
  ACTION_RESULT:    'ACTION_RESULT',   // 호스트 → 전체: 액션 처리 결과

  // 호스트 마이그레이션
  HOST_MIGRATE:     'HOST_MIGRATE',    // 신규 호스트 자가 선언
  MIRROR_SNAPSHOT:  'MIRROR_SNAPSHOT', // 호스트 → 2순위 피어: 상태 미러링
};

// ================================================================
export class PeerManager {
  constructor() {
    this._peer        = null;   // PeerJS Peer 인스턴스
    this._myPeerId    = null;
    this._connections = new Map(); // peerId → DataConnection
    this._handlers    = new Map(); // MSG.* → Set<callback>

    // heartbeat 타이머
    this._hbSendTimers = new Map(); // peerId → intervalId
    this._hbWatchTimers = new Map(); // peerId → timeoutId
    this._lastHbAt     = new Map(); // peerId → timestamp

    this._onDisconnect = null; // (peerId) => void 콜백
  }

  // ================================================================
  // 초기화 — PeerJS Peer 생성
  //
  // @param {string|null} peerId  null이면 PeerJS 서버가 랜덤 ID 부여
  // @returns {Promise<string>}   할당된 peerId
  // ================================================================
  async init(peerId = null) {
    return new Promise((resolve, reject) => {
      // PeerJS는 CDN 또는 npm 'peerjs' 패키지에서 로드된 전역 Peer 사용
      const PeerClass = (typeof Peer !== 'undefined') ? Peer : null;
      if (!PeerClass) {
        reject(new Error('PeerJS 라이브러리가 로드되지 않았습니다.'));
        return;
      }

      this._peer = peerId ? new PeerClass(peerId) : new PeerClass();

      this._peer.on('open', (id) => {
        this._myPeerId = id;
        resolve(id);
      });

      this._peer.on('connection', (conn) => {
        this._registerConnection(conn);
      });

      this._peer.on('error', (err) => {
        console.error('[PeerManager] error:', err);
        reject(err);
      });

      this._peer.on('disconnected', () => {
        // PeerJS 서버 연결 끊김 → 재연결 시도
        this._peer.reconnect();
      });
    });
  }

  // ================================================================
  // 특정 피어에 연결 (클라이언트 → 호스트 또는 메시 연결)
  //
  // @param {string} targetPeerId
  // @returns {Promise<void>}
  // ================================================================
  async connect(targetPeerId) {
    if (this._connections.has(targetPeerId)) return;

    return new Promise((resolve, reject) => {
      const conn = this._peer.connect(targetPeerId, { reliable: true });

      conn.on('open', () => {
        this._registerConnection(conn);
        resolve();
      });

      conn.on('error', (err) => {
        console.error('[PeerManager] connect error:', err);
        reject(err);
      });
    });
  }

  // ================================================================
  // 특정 피어에게 메시지 전송
  //
  // @param {string} targetPeerId
  // @param {string} type   MSG.*
  // @param {object} payload
  // ================================================================
  send(targetPeerId, type, payload = {}) {
    const conn = this._connections.get(targetPeerId);
    if (!conn || !conn.open) {
      console.warn(`[PeerManager] send: ${targetPeerId} 연결 없음`);
      return;
    }
    conn.send(JSON.stringify({ type, payload, from: this._myPeerId, ts: Date.now() }));
  }

  // ================================================================
  // 연결된 모든 피어에게 브로드캐스트
  //
  // @param {string} type
  // @param {object} payload
  // @param {string[]} [excludeIds]  제외할 peerId 목록
  // ================================================================
  broadcast(type, payload = {}, excludeIds = []) {
    for (const [peerId] of this._connections) {
      if (excludeIds.includes(peerId)) continue;
      this.send(peerId, type, payload);
    }
  }

  // ================================================================
  // 메시지 핸들러 등록
  //
  // @param {string}   type  MSG.*
  // @param {Function} fn    ({ type, payload, from, ts }) => void
  // ================================================================
  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(fn);
  }

  off(type, fn) {
    this._handlers.get(type)?.delete(fn);
  }

  // ================================================================
  // 연결 해제 콜백 등록
  // @param {Function} fn  (peerId) => void
  // ================================================================
  onDisconnect(fn) {
    this._onDisconnect = fn;
  }

  // ================================================================
  // 연결된 피어 ID 목록
  // ================================================================
  get connectedPeerIds() {
    return [...this._connections.keys()];
  }

  get myPeerId() {
    return this._myPeerId;
  }

  // ================================================================
  // 종료
  // ================================================================
  destroy() {
    this._stopAllHeartbeats();
    this._peer?.destroy();
    this._connections.clear();
    this._handlers.clear();
  }

  // ================================================================
  // 내부: DataConnection 등록
  // ================================================================
  _registerConnection(conn) {
    const peerId = conn.peer;
    this._connections.set(peerId, conn);

    conn.on('data', (raw) => {
      try {
        const msg = JSON.parse(raw);
        this._route(msg);
      } catch (e) {
        console.error('[PeerManager] data parse error:', e);
      }
    });

    conn.on('close', () => {
      this._handleDisconnect(peerId);
    });

    conn.on('error', () => {
      this._handleDisconnect(peerId);
    });

    this._startHeartbeat(peerId);
  }

  // ── 메시지 라우팅 ─────────────────────────────────────────────
  _route(msg) {
    const { type } = msg;

    // heartbeat 수신 → ACK 즉시 응답
    if (type === MSG.HEARTBEAT) {
      this.send(msg.from, MSG.HEARTBEAT_ACK, {});
      return;
    }
    // heartbeat ACK 수신 → 타임아웃 리셋
    if (type === MSG.HEARTBEAT_ACK) {
      this._resetHbWatch(msg.from);
      return;
    }

    const handlers = this._handlers.get(type);
    if (handlers) {
      for (const fn of handlers) fn(msg);
    }
  }

  // ── heartbeat 시작 ────────────────────────────────────────────
  _startHeartbeat(peerId) {
    // 주기적으로 HEARTBEAT 전송
    const sendId = setInterval(() => {
      this.send(peerId, MSG.HEARTBEAT, {});
    }, HEARTBEAT_INTERVAL_MS);
    this._hbSendTimers.set(peerId, sendId);

    // 타임아웃 감시 시작
    this._resetHbWatch(peerId);
  }

  _resetHbWatch(peerId) {
    clearTimeout(this._hbWatchTimers.get(peerId));
    const id = setTimeout(() => {
      // GDD §2.5: 3초 무응답 → 연결 끊김으로 처리
      this._handleDisconnect(peerId);
    }, HEARTBEAT_TIMEOUT_MS);
    this._hbWatchTimers.set(peerId, id);
  }

  _stopHeartbeat(peerId) {
    clearInterval(this._hbSendTimers.get(peerId));
    clearTimeout(this._hbWatchTimers.get(peerId));
    this._hbSendTimers.delete(peerId);
    this._hbWatchTimers.delete(peerId);
  }

  _stopAllHeartbeats() {
    for (const peerId of this._hbSendTimers.keys()) {
      this._stopHeartbeat(peerId);
    }
  }

  // ── 연결 끊김 처리 ────────────────────────────────────────────
  _handleDisconnect(peerId) {
    this._connections.delete(peerId);
    this._stopHeartbeat(peerId);
    this._onDisconnect?.(peerId);
  }
}
