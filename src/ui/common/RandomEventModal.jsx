// ============================================================
// src/ui/common/RandomEventModal.jsx
// 랜덤 이벤트 모달 (GDD §18.6)
//
// 6종 랜덤 이벤트 표시 + 스탯 기반 TokenRoll 판정 UI
//
//   상인 조우(LUK) / 저주받은 보물(STR) / 여행자(WIS)
//   야영지(CON)    / 고대 비문(INT)    / 도적단(DEX)
//
// props:
//   event  { id, label, stat, type, success }
//   onClose () => void
// ============================================================

import React, { useState } from 'react';
import { usePlayerStore }             from '../../stores/playerStore.js';
import { useGameStore }               from '../../stores/gameStore.js';
import { TokenRoll }                  from '../../game/battle/TokenRoll.js';

// ── 이벤트 메타 (아이콘, 성공/실패 결과 텍스트, 보상) ─────────
const EVENT_META = {
  merchant: {
    icon: '🛒',
    desc: '길가에서 신비로운 상인을 만났다. 특별 상품을 보여준다.',
    statLabel: '행운(LUK)',
    successText: '거래 성사! 상인은 희귀 아이템을 싸게 팔았다.',
    failText:    '상인은 의심스러운 눈빛을 보내며 떠났다.',
    successReward: { gold: 30, item: true },
    failReward:    {},
  },
  chest: {
    icon: '📦',
    desc: '빛나는 보물상자가 발견됐다. 하지만 무언가 이상하다...',
    statLabel: '힘(STR)',
    successText: '함정을 부숴버렸다! 보물을 획득했다.',
    failText:    '함정이 발동! 독 가스가 뿜어져 나왔다. 독 상태이상.',
    successReward: { gold: 50, item: true },
    failReward:    { status: 'POISON' },
  },
  traveler: {
    icon: '🧭',
    desc: '길 잃은 여행자를 발견했다. 그는 무언가를 알고 있는 것 같다.',
    statLabel: '지혜(WIS)',
    successText: '그의 말에서 귀중한 정보를 얻었다.',
    failText:    '여행자는 엉뚱한 길을 알려주고 사라졌다.',
    successReward: { questHint: true, exp: 60 },
    failReward:    {},
  },
  campfire: {
    icon: '🔥',
    desc: '아늑한 야영지를 발견했다. 쉬어 갈 수 있을 것 같다.',
    statLabel: '체력(CON)',
    successText: '충분히 휴식했다. HP가 회복됐다.',
    failText:    '야영지에서 쉬다가 습격을 받아 피해를 입었다.',
    successReward: { healPct: 0.3 },
    failReward:    { damagePct: 0.1 },
  },
  inscription: {
    icon: '📜',
    desc: '고대 비문이 새겨진 석판이 있다. 해독할 수 있을까?',
    statLabel: '지력(INT)',
    successText: '비문의 의미를 해독했다. 임시 버프를 획득했다!',
    failText:    '해독에 실패해 저주가 발동됐다. 임시 스탯 감소.',
    successReward: { tempBuff: { WIS: 2, INT: 2 }, buffDuration: 3 },
    failReward:    { tempBuff: { WIS: -1, INT: -1 }, buffDuration: 2 },
  },
  bandits: {
    icon: '⚔️',
    desc: '도적단이 앞길을 막아섰다. 빠르게 대응해야 한다!',
    statLabel: '민첩(DEX)',
    successText: '선제 공격으로 도적들을 물리쳤다! 전리품을 획득.',
    failText:    '도적에게 기습당했다! 전투에 불리하게 진입한다.',
    successReward: { gold: 40, exp: 80 },
    failReward:    { debuff: { DEX: -2 }, duration: 2 },
  },
};

const STAT_MAP = { luk: 'LUK', str: 'STR', wis: 'WIS', con: 'CON', int: 'INT', dex: 'DEX' };

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
    width: 440,
    maxHeight: '85vh',
    overflowY: 'auto',
    color: '#d0c8b0',
    fontFamily: 'serif',
    boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
    textAlign: 'center',
  },
  icon:     { fontSize: 52, marginBottom: 10 },
  title:    { fontSize: 22, fontWeight: 'bold', color: '#f0c870', marginBottom: 8 },
  desc:     { fontSize: 14, color: '#8899bb', lineHeight: 1.6, marginBottom: 18 },
  statBadge:{ display: 'inline-block', padding: '3px 14px', borderRadius: 20, background: '#2a3a5a', color: '#88aacc', fontSize: 13, marginBottom: 20 },

  rollBtn: {
    background: 'linear-gradient(135deg, #2a4a8a, #1a2a5a)',
    border: '1px solid #4a7acc', borderRadius: 8,
    color: '#f0e8c0', fontSize: 16, fontWeight: 'bold',
    padding: '12px 36px', cursor: 'pointer',
    transition: 'all 0.2s', marginBottom: 20,
  },

  diceRow: { display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  die: (success) => ({
    width: 42, height: 42, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 'bold',
    background: success ? '#1a3a2a' : '#2a1a1a',
    border: `2px solid ${success ? '#44cc66' : '#cc4444'}`,
    color: success ? '#44cc66' : '#cc4444',
  }),

  resultBox: (success) => ({
    background: success ? 'rgba(40,100,60,0.25)' : 'rgba(100,30,30,0.25)',
    border: `1px solid ${success ? '#2a6a3a' : '#6a2a2a'}`,
    borderRadius: 10, padding: '14px 20px', marginBottom: 20,
  }),
  resultTitle: (success) => ({
    fontSize: 18, fontWeight: 'bold',
    color: success ? '#44dd77' : '#dd4444',
    marginBottom: 6,
  }),
  resultText: { fontSize: 13, color: '#c0b890', lineHeight: 1.5 },
  rewardLine: { fontSize: 12, color: '#aa9060', marginTop: 8 },

  closeBtn: {
    background: '#2a2a4a', border: '1px solid #4a4a7a',
    borderRadius: 8, color: '#aabbcc', fontSize: 14,
    padding: '8px 28px', cursor: 'pointer',
  },
};

// ── 보상 적용 헬퍼 ───────────────────────────────────────────
function applyReward(reward, player, ps, gs) {
  if (!reward || !player) return;
  if (reward.gold)      ps.addGold(player.id, reward.gold);
  if (reward.exp)       ps.addExp(player.id, reward.exp);
  if (reward.healPct)   ps.healPlayer(player.id, Math.round((player.maxHp ?? 0) * reward.healPct));
  if (reward.damagePct) ps.damagePlayer(player.id, Math.round((player.maxHp ?? 0) * reward.damagePct));
  if (reward.status)    ps.addStatus(player.id, reward.status, 2);
  if (reward.tempBuff) {
    Object.entries(reward.tempBuff).forEach(([k, v]) =>
      ps.applyStatModifier(player.id, k, v)
    );
  }
  if (reward.debuff) {
    Object.entries(reward.debuff).forEach(([k, v]) =>
      ps.applyStatModifier(player.id, k, v)
    );
  }
}

// ============================================================
export function RandomEventModal({ event, onClose }) {
  const [phase, setPhase]     = useState('intro');   // 'intro' | 'rolling' | 'result'
  const [dice,  setDice]      = useState([]);
  const [roll,  setRoll]      = useState(null);

  const gs     = useGameStore.getState();
  const player = usePlayerStore((s) => s.players.find((p) => p.id === s.localPlayerId));

  const meta    = EVENT_META[event?.id] ?? {
    icon: '❓', desc: event?.label ?? '', statLabel: event?.stat ?? '',
    successText: '성공!', failText: '실패.',
    successReward: {}, failReward: {},
  };

  const statKey  = STAT_MAP[(event?.stat ?? '').toLowerCase()] ?? 'LUK';
  const statVal  = player?.stats?.[statKey] ?? 5;
  const success  = roll ? roll.successes > 0 : false;

  function handleRoll() {
    setPhase('rolling');
    const result = TokenRoll.roll({ stat: statVal });
    setTimeout(() => {
      setDice(result.dice ?? []);
      setRoll(result);
      setPhase('result');

      // 보상 즉시 적용
      const reward = result.successes > 0 ? meta.successReward : meta.failReward;
      applyReward(reward, player, usePlayerStore.getState(), gs);
    }, 600);
  }

  const rewardText = (r) => {
    const parts = [];
    if (r?.gold)     parts.push(`${r.gold} Gold`);
    if (r?.exp)      parts.push(`${r.exp} EXP`);
    if (r?.healPct)  parts.push(`HP +${Math.round(r.healPct * 100)}%`);
    if (r?.damagePct) parts.push(`HP -${Math.round(r.damagePct * 100)}%`);
    if (r?.status)   parts.push(`${r.status} 부여`);
    if (r?.tempBuff) parts.push('임시 버프');
    if (r?.debuff)   parts.push('임시 디버프');
    return parts.join(' · ') || '없음';
  };

  return (
    <div style={S.overlay}>
      <div style={S.panel}>

        <div style={S.icon}>{meta.icon}</div>
        <div style={S.title}>{event?.label ?? '랜덤 이벤트'}</div>
        <div style={S.desc}>{meta.desc}</div>
        <div style={S.statBadge}>판정 스탯: {meta.statLabel} ({statVal})</div>

        {/* 인트로 — 굴림 버튼 */}
        {phase === 'intro' && (
          <button style={S.rollBtn} onClick={handleRoll}>
            🎲 토큰 굴리기
          </button>
        )}

        {/* 굴림 중 */}
        {phase === 'rolling' && (
          <div style={{ color: '#f0c040', fontSize: 18, marginBottom: 20 }}>굴리는 중...</div>
        )}

        {/* 결과 */}
        {phase === 'result' && roll && (
          <>
            {/* 주사위 */}
            <div style={S.diceRow}>
              {dice.map((d, i) => (
                <div key={i} style={S.die(d)}>
                  {d ? '✓' : '✗'}
                </div>
              ))}
            </div>

            <div style={S.resultBox(success)}>
              <div style={S.resultTitle(success)}>
                {success ? '성공!' : '실패!'} ({roll.successes}/{roll.total} 성공)
              </div>
              <div style={S.resultText}>
                {success ? meta.successText : meta.failText}
              </div>
              <div style={S.rewardLine}>
                적용된 보상: {rewardText(success ? meta.successReward : meta.failReward)}
              </div>
            </div>

            <button style={S.closeBtn} onClick={onClose}>확인</button>
          </>
        )}

      </div>
    </div>
  );
}
