// ============================================================
// api/signal.js
// Vercel Serverless Function — PeerJS 시그널 릴레이 (GDD §2.0)
//
// PeerJS 클라우드 서버 불안정 시 폴백용 자체 시그널링 엔드포인트.
//
// 프로토콜:
//   POST /api/signal  { type, from, to, payload }
//     → 수신자(to) 큐에 메시지 추가
//     → 200 { ok: true }
//
//   GET  /api/signal?peerId=<id>
//     → 해당 peer로 쌓인 메시지 전부 반환 후 큐 비움
//     → 200 { messages: [...] }
//
// 제약:
//   - Vercel Serverless는 인스턴스 간 메모리를 공유하지 않으므로
//     실제 운영 시 Vercel KV (Redis) 로 교체 권장.
//     개발/소규모 플레이에서는 단일 인스턴스로 정상 동작.
//   - 메시지 TTL: 30초 초과 시 자동 정리
// ============================================================

/** @type {Map<string, Array<{msg: object, ts: number}>>} */
const queue = new Map();
const MSG_TTL_MS = 30_000;

/** 오래된 메시지 정리 */
function prune() {
  const now = Date.now();
  for (const [peerId, msgs] of queue.entries()) {
    const fresh = msgs.filter((m) => now - m.ts < MSG_TTL_MS);
    if (fresh.length === 0) queue.delete(peerId);
    else queue.set(peerId, fresh);
  }
}

/**
 * Vercel Serverless 핸들러
 * @param {import('@vercel/node').VercelRequest}  req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default function handler(req, res) {
  // CORS — 같은 도메인 or localhost
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  prune();

  // ── POST: 메시지 송신 ──────────────────────────────────────
  if (req.method === 'POST') {
    const { type, from, to, payload } = req.body ?? {};
    if (!type || !from || !to) {
      return res.status(400).json({ ok: false, error: 'Missing type / from / to' });
    }

    const entry = { type, from, to, payload: payload ?? null, ts: Date.now() };
    if (!queue.has(to)) queue.set(to, []);
    queue.get(to).push({ msg: entry, ts: entry.ts });

    return res.status(200).json({ ok: true });
  }

  // ── GET: 메시지 수신 ──────────────────────────────────────
  if (req.method === 'GET') {
    const { peerId } = req.query;
    if (!peerId) {
      return res.status(400).json({ ok: false, error: 'Missing peerId' });
    }

    const msgs = (queue.get(peerId) ?? []).map((m) => m.msg);
    queue.delete(peerId);     // 반환 후 큐 비움

    return res.status(200).json({ ok: true, messages: msgs });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
