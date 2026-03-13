// ============================================================
// src/ui/common/QuestInteractionModal.jsx
// 퀘스트 목표 타일 상호작용 모달 (GDD §25)
//
// 표시:
//   퀘스트 이름 / 현재 목표 / 진행도
//   완료 버튼 (조건 충족 시) 또는 진행 상태 표시
//   실패 시 붉은 경고 표시
//
// props:
//   quest   { questId, name, desc, progress, target, completed, reward, failed? }
//   onClose () => void
// ============================================================

import React           from 'react';
import { usePlayerStore } from '../../stores/playerStore.js';
import { useGameStore }   from '../../stores/gameStore.js';
import { useUiStore }     from '../../stores/uiStore.js';
import { QUEST_STATUS }   from '../../game/data/quests.js';

// ── 스타일 ────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 600, pointerEvents: 'auto',
  },
  panel: {
    background: '#1a1a2e',
    border: '1px solid #4a6fa5',
    borderRadius: 14,
    padding: '28px 32px',
    width: 420,
    maxHeight: '80vh',
    overflowY: 'auto',
    color: '#d0c8b0',
    fontFamily: 'serif',
    boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 18, borderBottom: '1px solid #2a3a5a', paddingBottom: 14,
  },
  title:    { fontSize: 18, fontWeight: 'bold', color: '#f0c870' },
  subtitle: { fontSize: 12, color: '#6688aa', marginTop: 4 },
  closeBtn: { background: 'none', border: 'none', color: '#8899bb', fontSize: 22, cursor: 'pointer' },

  section:     { marginBottom: 18 },
  sectionTitle:{ fontSize: 11, color: '#6688aa', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  desc:        { fontSize: 14, color: '#aabbcc', lineHeight: 1.6 },

  progressBar: { height: 12, background: '#1e2a3e', border: '1px solid #2a3a5a', borderRadius: 6, overflow: 'hidden', marginTop: 8 },
  progressFill:{ height: '100%', background: '#4a8fdd', borderRadius: 6, transition: 'width 0.4s' },
  progressText:{ fontSize: 12, color: '#6688aa', marginTop: 6, textAlign: 'right' },

  rewardBox: {
    background: '#1e2a1e', border: '1px solid #2a4a2a',
    borderRadius: 8, padding: '10px 16px', marginBottom: 18,
  },
  rewardTitle: { fontSize: 12, color: '#44aa66', marginBottom: 6 },
  rewardRow:   { display: 'flex', gap: 16, flexWrap: 'wrap' },
  rewardItem:  { fontSize: 14, color: '#a0cc80', fontWeight: 'bold' },

  failedBox: {
    background: '#2a1a1a', border: '1px solid #6a2a2a',
    borderRadius: 8, padding: '12px 16px', marginBottom: 18,
    color: '#dd4444', fontSize: 14, lineHeight: 1.5,
  },

  btnRow:  { display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 },
  btnComplete: {
    background: 'linear-gradient(135deg, #2a6a3a, #1a4a2a)',
    border: '1px solid #3a8a4a', borderRadius: 8,
    color: '#88ffaa', fontSize: 15, fontWeight: 'bold',
    padding: '10px 32px', cursor: 'pointer',
  },
  btnClose: {
    background: '#2a2a4a', border: '1px solid #4a4a7a',
    borderRadius: 8, color: '#aabbcc', fontSize: 14,
    padding: '10px 28px', cursor: 'pointer',
  },
  btnDisabled: {
    background: '#1a1a2a', border: '1px solid #2a2a4a',
    borderRadius: 8, color: '#3a4a5a', fontSize: 14,
    padding: '10px 28px', cursor: 'not-allowed',
  },
  statusComplete: { color: '#44dd77', fontWeight: 'bold', fontSize: 15, textAlign: 'center', marginBottom: 16 },
};

// ── 보상 수령 헬퍼 ───────────────────────────────────────────
function collectReward(quest, playerId) {
  const ps = usePlayerStore.getState();
  const gs = useGameStore.getState();
  if (quest.reward?.exp)  ps.addExp(playerId, quest.reward.exp);
  if (quest.reward?.gold) ps.addGold(playerId, quest.reward.gold);
  ps.completeQuest(playerId, quest.questId);
  gs.advanceQuestStage?.(quest.questId);
}

// ============================================================
export function QuestInteractionModal({ quest, onClose }) {
  const localId  = usePlayerStore((s) => s.localPlayerId);
  const player   = usePlayerStore((s) => s.players.find((p) => p.id === s.localPlayerId));

  if (!quest) return null;

  const isCompleted = quest.completed;
  const isFailed    = quest.failed;
  const progress    = quest.progress ?? 0;
  const target      = quest.target;
  const progressPct = target != null ? Math.min(100, (progress / target) * 100) : 0;
  const canComplete = isCompleted && !isFailed;

  function handleComplete() {
    collectReward(quest, localId);
    useUiStore.getState().clearQuestInteraction?.();
    onClose?.();
  }

  return (
    <div style={S.overlay}>
      <div style={S.panel}>

        {/* 헤더 */}
        <div style={S.header}>
          <div>
            <div style={S.title}>📋 {quest.name ?? quest.questId}</div>
            <div style={S.subtitle}>퀘스트 상호작용</div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 실패 경고 */}
        {isFailed && (
          <div style={S.failedBox}>
            ❌ 이 퀘스트는 실패했습니다.<br />
            목표 마을이 드래곤에 의해 전소되거나 기한이 초과됐습니다.
          </div>
        )}

        {/* 목표 설명 */}
        <div style={S.section}>
          <div style={S.sectionTitle}>목표</div>
          <div style={S.desc}>{quest.desc ?? '목표 없음'}</div>

          {/* 진행도 바 */}
          {target != null && (
            <>
              <div style={S.progressBar}>
                <div style={{ ...S.progressFill, width: `${progressPct}%` }} />
              </div>
              <div style={S.progressText}>
                {progress} / {target}
                {isCompleted ? ' ✓ 목표 달성!' : ''}
              </div>
            </>
          )}
          {target == null && isCompleted && (
            <div style={{ ...S.progressText, color: '#44cc66', textAlign: 'left', marginTop: 8 }}>
              ✓ 목표 달성!
            </div>
          )}
        </div>

        {/* 보상 정보 */}
        {quest.reward && (
          <div style={S.rewardBox}>
            <div style={S.rewardTitle}>⭐ 퀘스트 보상</div>
            <div style={S.rewardRow}>
              {quest.reward.exp  && <span style={S.rewardItem}>EXP +{quest.reward.exp}</span>}
              {quest.reward.gold && <span style={S.rewardItem}>Gold +{quest.reward.gold}</span>}
              {quest.reward.item && <span style={S.rewardItem}>🎁 아이템</span>}
              {quest.reward.unlock && <span style={S.rewardItem}>🔓 다음 퀘스트 해금</span>}
            </div>
          </div>
        )}

        {/* 완료 표시 */}
        {canComplete && (
          <div style={S.statusComplete}>✨ 퀘스트를 완료할 수 있습니다!</div>
        )}

        {/* 버튼 */}
        <div style={S.btnRow}>
          {!isFailed && canComplete && (
            <button style={S.btnComplete} onClick={handleComplete}>
              🏆 보상 수령
            </button>
          )}
          {!isFailed && !canComplete && (
            <button style={S.btnDisabled} disabled>
              아직 완료되지 않음
            </button>
          )}
          <button style={S.btnClose} onClick={onClose}>닫기</button>
        </div>

      </div>
    </div>
  );
}
