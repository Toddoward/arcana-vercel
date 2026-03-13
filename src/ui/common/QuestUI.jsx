// ============================================================
// src/ui/common/QuestUI.jsx
// 퀘스트 현황 패널 (GDD §25)
//
// 표시 항목:
//   메인 퀘스트 마일스톤 4단계 진행 상황
//   수주 퀘스트 목록 (플레이어의 activeQuests)
//   퀘스트별 목표 / 보상
// ============================================================

import React, { useState }  from 'react';
import { useGameStore }      from '../../stores/gameStore.js';
import { usePlayerStore }    from '../../stores/playerStore.js';
import { MAIN_QUESTS, QUEST_STATUS } from '../../game/data/quests.js';

// ── 스타일 ────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 500, pointerEvents: 'auto',
  },
  panel: {
    background: '#1a1a2e',
    border: '1px solid #4a6fa5',
    borderRadius: 12,
    padding: '24px 28px',
    width: 460,
    maxHeight: '85vh',
    overflowY: 'auto',
    color: '#d0c8b0',
    fontFamily: 'serif',
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 18, borderBottom: '1px solid #2a3a5a', paddingBottom: 12,
  },
  title:    { fontSize: 20, fontWeight: 'bold', color: '#f0c870' },
  closeBtn: { background: 'none', border: 'none', color: '#8899bb', fontSize: 22, cursor: 'pointer' },

  tabs: { display: 'flex', gap: 2, marginBottom: 16 },
  tab: (active) => ({
    flex: 1, padding: '8px 0', textAlign: 'center', cursor: 'pointer',
    fontSize: 13, borderRadius: 6, border: 'none',
    background: active ? '#2a4a7a' : '#1a2a3a',
    color: active ? '#f0c870' : '#6688aa',
    transition: 'all 0.2s',
  }),

  section:     { marginBottom: 14 },
  sectionTitle:{ fontSize: 11, color: '#6688aa', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },

  // 마일스톤 타임라인
  timeline: { position: 'relative', paddingLeft: 24 },
  tlLine:   { position: 'absolute', left: 9, top: 6, bottom: 6, width: 2, background: '#2a3a5a' },
  tlItem:   (status) => ({
    position: 'relative', marginBottom: 14, paddingLeft: 8,
    opacity: status === QUEST_STATUS.LOCKED ? 0.4 : 1,
  }),
  tlDot:    (status) => ({
    position: 'absolute', left: -20, top: 4,
    width: 12, height: 12, borderRadius: '50%',
    background: status === QUEST_STATUS.COMPLETED ? '#44cc66'
               : status === QUEST_STATUS.ACTIVE   ? '#f0c040'
               : '#2a3a5a',
    border: '2px solid ' + (status === QUEST_STATUS.ACTIVE ? '#f0c040' : 'transparent'),
    zIndex: 1,
  }),
  tlName: (status) => ({
    fontSize: 14, fontWeight: 'bold',
    color: status === QUEST_STATUS.COMPLETED ? '#44cc66'
         : status === QUEST_STATUS.ACTIVE    ? '#f0c870'
         : '#4a5a7a',
    marginBottom: 3,
  }),
  tlDesc:   { fontSize: 12, color: '#7a8899', lineHeight: 1.5 },
  tlReward: { fontSize: 11, color: '#aa9060', marginTop: 4 },
  tlBadge:  (status) => ({
    display: 'inline-block', padding: '1px 8px', borderRadius: 8, fontSize: 11,
    background: status === QUEST_STATUS.COMPLETED ? '#1a4a2a'
               : status === QUEST_STATUS.ACTIVE   ? '#3a3a1a'
               : '#1a1a2a',
    color: status === QUEST_STATUS.COMPLETED ? '#44cc66'
         : status === QUEST_STATUS.ACTIVE    ? '#f0c040'
         : '#4a5a6a',
    marginLeft: 8,
  }),

  // 수주 퀘스트 카드
  qCard: {
    background: '#1e2a3e', border: '1px solid #2a3a5a',
    borderRadius: 8, padding: '10px 14px', marginBottom: 10,
  },
  qName:     { fontSize: 14, fontWeight: 'bold', color: '#e0c870', marginBottom: 4 },
  qDesc:     { fontSize: 12, color: '#8899aa', lineHeight: 1.5, marginBottom: 6 },
  qProgress: { fontSize: 12, color: '#6688aa' },
  qReward:   { fontSize: 11, color: '#aa9060', marginTop: 4 },
  qEmpty:    { color: '#4a5a6a', fontSize: 13, textAlign: 'center', padding: '20px 0' },
};

const STATUS_BADGE_TEXT = {
  [QUEST_STATUS.LOCKED]:    '미해금',
  [QUEST_STATUS.ACTIVE]:    '진행 중',
  [QUEST_STATUS.COMPLETED]: '완료',
  [QUEST_STATUS.SKIPPED]:   '스킵',
};

// ============================================================
export function QuestUI({ onClose }) {
  const [tab, setTab]       = useState('main');   // 'main' | 'active'
  const questProgress       = useGameStore((s) => s.questProgress) ?? {};
  const players             = usePlayerStore((s) => s.players);
  const localId             = usePlayerStore((s) => s.localPlayerId);
  const localPlayer         = players.find((p) => p.id === localId);
  const activeQuests        = localPlayer?.activeQuests ?? [];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={S.header}>
          <span style={S.title}>📜 퀘스트</span>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 탭 */}
        <div style={S.tabs}>
          <button style={S.tab(tab === 'main')}   onClick={() => setTab('main')}>메인 퀘스트</button>
          <button style={S.tab(tab === 'active')} onClick={() => setTab('active')}>
            수주 퀘스트 {activeQuests.length > 0 && `(${activeQuests.length})`}
          </button>
        </div>

        {/* 메인 퀘스트 탭 */}
        {tab === 'main' && (
          <div style={S.section}>
            <div style={S.sectionTitle}>마일스톤 진행 현황 (GDD §25)</div>
            <div style={S.timeline}>
              <div style={S.tlLine} />
              {MAIN_QUESTS.map((q) => {
                const status = questProgress[q.id] ?? QUEST_STATUS.LOCKED;
                return (
                  <div key={q.id} style={S.tlItem(status)}>
                    <div style={S.tlDot(status)} />
                    <div>
                      <span style={S.tlName(status)}>{q.stage}단계. {q.name}</span>
                      <span style={S.tlBadge(status)}>{STATUS_BADGE_TEXT[status] ?? status}</span>
                    </div>
                    <div style={S.tlDesc}>{q.desc}</div>

                    {/* 2단계 유물 수집 진행도 */}
                    {q.objective?.type === 'DEFEAT_ALL_BOSSES' && status === QUEST_STATUS.ACTIVE && (
                      <div style={S.tlDesc}>
                        처치: {(q.objective.collected ?? []).join(', ') || '없음'} / 목표: {q.objective.bossIds?.join(', ')}
                      </div>
                    )}

                    <div style={S.tlReward}>
                      보상: {q.reward?.exp ?? 0} EXP · {q.reward?.gold ?? 0} Gold
                      {q.reward?.unlock && ' · 다음 단계 해금'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 수주 퀘스트 탭 */}
        {tab === 'active' && (
          <div style={S.section}>
            {activeQuests.length === 0 ? (
              <div style={S.qEmpty}>수주된 퀘스트가 없습니다.<br />마을이나 NPC에서 퀘스트를 받으세요.</div>
            ) : (
              activeQuests.map((q, i) => (
                <div key={q.questId ?? i} style={S.qCard}>
                  <div style={S.qName}>{q.name ?? q.questId}</div>
                  <div style={S.qDesc}>{q.desc ?? '—'}</div>
                  <div style={S.qProgress}>
                    진행도: {q.progress ?? 0}{q.target != null ? ` / ${q.target}` : ''}
                    {q.completed && ' ✓ 완료'}
                  </div>
                  {q.reward && (
                    <div style={S.qReward}>
                      보상: {q.reward.exp ?? 0} EXP · {q.reward.gold ?? 0} Gold
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
