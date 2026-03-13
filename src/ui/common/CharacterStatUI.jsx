// ============================================================
// src/ui/common/CharacterStatUI.jsx
// 캐릭터 정보 패널 (GDD §6.1~6.3)
//
// 표시 항목:
//   클래스 아이콘/이름, 레벨, EXP 진행바
//   스탯 6종 (기본값 + 버프/디버프 수정치)
//   HP / AP / DP 게이지
//   상태이상 배지
//   장비 슬롯 요약
// ============================================================

import React from 'react';
import { usePlayerStore } from '../../stores/playerStore.js';
import { CLASS, STATUS }  from '../../constants/constants.js';

// ── 클래스 메타 ───────────────────────────────────────────────
const CLASS_META = {
  [CLASS.FIGHTER]: { label: '파이터', icon: '⚔️' },
  [CLASS.WIZARD]:  { label: '위자드', icon: '🔮' },
  [CLASS.CLERIC]:  { label: '클레릭', icon: '✨' },
  [CLASS.ROGUE]:   { label: '로그',   icon: '🗡️' },
  [CLASS.BARD]:    { label: '바드',   icon: '🎵' },
};

const STAT_LABEL = { STR:'힘', DEX:'민첩', CON:'체력', INT:'지력', WIS:'지혜', LUK:'행운' };

const STATUS_LABEL = {
  [STATUS.BURN]:      { label: '화상', color: '#ff6600' },
  [STATUS.POISON]:    { label: '독',   color: '#44bb44' },
  [STATUS.FREEZE]:    { label: '빙결', color: '#88ddff' },
  [STATUS.STUN]:      { label: '기절', color: '#ffdd00' },
  [STATUS.SHOCK]:     { label: '감전', color: '#ffee22' },
  [STATUS.CONFUSION]: { label: '착란', color: '#cc44ff' },
  [STATUS.CURSE]:     { label: '저주', color: '#7700bb' },
};

const EQUIP_SLOT_LABEL = {
  rightHand: '우수', leftHand: '좌수', head: '모자', chest: '상의',
  pants: '하의', boots: '부츠', gloves: '장갑', ring: '반지',
  necklace: '목걸이', cloak: '망토',
};

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
    width: 420,
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
  classRow: { display: 'flex', alignItems: 'center', gap: 10 },
  icon:  { fontSize: 28 },
  name:  { fontSize: 20, fontWeight: 'bold', color: '#f0c870' },
  level: { fontSize: 13, color: '#8899bb', marginTop: 2 },
  closeBtn: {
    background: 'none', border: 'none', color: '#8899bb',
    fontSize: 22, cursor: 'pointer', padding: '0 4px',
  },

  section:     { marginBottom: 16 },
  sectionTitle:{ fontSize: 12, color: '#6688aa', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },

  expBar:   { height: 8, background: '#2a2a4a', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  expFill:  { height: '100%', background: '#4a8fdd', borderRadius: 4, transition: 'width 0.4s' },
  expText:  { fontSize: 11, color: '#6688aa', textAlign: 'right' },

  statGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' },
  statRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 },
  statKey:  { color: '#8899bb' },
  statVal:  { fontWeight: 'bold', color: '#f0e8c0' },
  statMod:  { fontSize: 11, marginLeft: 4 },

  gaugeBg:  { height: 10, background: '#1a1a2e', border: '1px solid #2a3a5a', borderRadius: 5, overflow: 'hidden', flex: 1 },
  gaugeFg:  { height: '100%', borderRadius: 5, transition: 'width 0.3s' },
  gaugeRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 },
  gaugeLabel:{ width: 28, color: '#8899bb', flexShrink: 0 },
  gaugeNum: { width: 72, textAlign: 'right', color: '#c0b890', fontSize: 12 },

  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  badge:    { padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 'bold' },

  equipGrid:{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' },
  equipSlot:{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #1e2a3a' },
  slotLabel:{ color: '#6688aa' },
  slotItem: { color: '#c0a870', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};

// ── 경험치 필요량 (constants calcRequiredExp와 동일 공식) ─────
function calcRequiredExp(level) { return Math.floor(100 * Math.pow(level, 1.5)); }

// ============================================================
export function CharacterStatUI({ onClose }) {
  const ps     = usePlayerStore((s) => s);
  const player = ps.getLocalPlayer?.() ?? ps.players?.[0];

  if (!player) {
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.panel} onClick={(e) => e.stopPropagation()}>
          <p style={{ color: '#888' }}>캐릭터 데이터 없음</p>
        </div>
      </div>
    );
  }

  const meta      = CLASS_META[player.classType] ?? { label: '???', icon: '❓' };
  const reqExp    = calcRequiredExp(player.level);
  const expPct    = Math.min(1, (player.exp ?? 0) / reqExp) * 100;
  const hpPct     = Math.min(100, ((player.hp ?? 0) / (player.maxHp ?? 1)) * 100);
  const apMax     = player.stats?.DEX ?? 0;
  const apPct     = Math.min(100, ((player.currentAP ?? 0) / Math.max(1, apMax)) * 100);
  const dpPct     = Math.min(100, ((player.dp ?? 0) / (player.maxDp ?? 1)) * 100);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={S.header}>
          <div style={S.classRow}>
            <span style={S.icon}>{meta.icon}</span>
            <div>
              <div style={S.name}>{player.name ?? '이름없음'}</div>
              <div style={S.level}>{meta.label} · Lv.{player.level ?? 1}</div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 경험치 */}
        <div style={S.section}>
          <div style={S.sectionTitle}>경험치</div>
          <div style={S.expBar}>
            <div style={{ ...S.expFill, width: `${expPct}%` }} />
          </div>
          <div style={S.expText}>{player.exp ?? 0} / {reqExp}</div>
        </div>

        {/* 게이지 (HP / AP / DP) */}
        <div style={S.section}>
          <div style={S.sectionTitle}>상태</div>
          {[
            { label: 'HP', pct: hpPct, color: '#e04040', cur: player.hp ?? 0,       max: player.maxHp ?? 0 },
            { label: 'AP', pct: apPct, color: '#4ab8e0', cur: player.currentAP ?? 0, max: apMax },
            { label: 'DP', pct: dpPct, color: '#e0c840', cur: player.dp ?? 0,        max: player.maxDp ?? 0 },
          ].map(({ label, pct, color, cur, max }) => (
            <div key={label} style={S.gaugeRow}>
              <span style={S.gaugeLabel}>{label}</span>
              <div style={S.gaugeBg}>
                <div style={{ ...S.gaugeFg, width: `${pct}%`, background: color }} />
              </div>
              <span style={S.gaugeNum}>{cur} / {max}</span>
            </div>
          ))}
        </div>

        {/* 스탯 */}
        <div style={S.section}>
          <div style={S.sectionTitle}>스탯</div>
          <div style={S.statGrid}>
            {Object.entries(player.stats ?? {}).map(([k, v]) => {
              const mod = player.statModifiers?.[k] ?? 0;
              return (
                <div key={k} style={S.statRow}>
                  <span style={S.statKey}>{STAT_LABEL[k] ?? k}</span>
                  <span style={S.statVal}>
                    {v + mod}
                    {mod !== 0 && (
                      <span style={{ ...S.statMod, color: mod > 0 ? '#66dd66' : '#dd4444' }}>
                        ({mod > 0 ? '+' : ''}{mod})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 상태이상 */}
        {(player.statusEffects?.length > 0) && (
          <div style={S.section}>
            <div style={S.sectionTitle}>상태이상</div>
            <div style={S.badgeRow}>
              {player.statusEffects.map((s, i) => {
                const meta = STATUS_LABEL[s.type] ?? { label: s.type, color: '#888' };
                return (
                  <span
                    key={i}
                    style={{ ...S.badge, background: meta.color + '33', color: meta.color, border: `1px solid ${meta.color}88` }}
                  >
                    {meta.label} {s.duration}턴
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 장비 */}
        <div style={S.section}>
          <div style={S.sectionTitle}>장비</div>
          <div style={S.equipGrid}>
            {Object.entries(player.equipment ?? {}).map(([slot, item]) => (
              <div key={slot} style={S.equipSlot}>
                <span style={S.slotLabel}>{EQUIP_SLOT_LABEL[slot] ?? slot}</span>
                <span style={S.slotItem}>{item?.name ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
