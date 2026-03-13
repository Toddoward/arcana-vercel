// ============================================================
// src/ui/hud/HPBar.jsx
// 파티 현황 패널 — HP바 / AP토큰 / DP토큰 / 상태이상 뱃지
//
// GDD: §4.4(공통 HUD 요소 - 좌측 파티 현황 패널)
//      §6.3(maxHP = 20 + CON×5) §8.2(AP=DEX)
//      §12.3(DP) §14.1(상태이상 7종)
//
// 의존:
//   playerStore.js — players[] (hp, maxHp, currentAP, dp, statusEffects)
// ============================================================

import { usePlayerStore } from '../../stores/playerStore.js';

// 상태이상 → 표시 뱃지 매핑 (GDD §14.1)
const STATUS_BADGE = {
  BURN:      { label: '🔥', color: '#e05c2a', title: '화상' },
  POISON:    { label: '☠️', color: '#6abf4b', title: '독' },
  FREEZE:    { label: '❄️', color: '#6ec4e8', title: '빙결' },
  SHOCK:     { label: '⚡', color: '#f5d84a', title: '감전' },
  STUN:      { label: '💫', color: '#c8a0e0', title: '기절' },
  CONFUSION: { label: '🌀', color: '#e08ac8', title: '착란' },
  CURSE:     { label: '💀', color: '#8c4a9e', title: '저주' },
};

// 클래스 → 아이콘
const CLASS_ICON = {
  Fighter: '⚔️', Wizard: '🔮', Rogue: '🗡️', Cleric: '✝️', Bard: '🎵',
};

// ── 단일 플레이어 HP 패널 ─────────────────────────────────────
function PlayerPanel({ player, isActive }) {
  const hpPct   = Math.max(0, Math.min(1, player.hp / player.maxHp));
  const hpColor = hpPct > 0.5 ? '#4cba4c'
                : hpPct > 0.25 ? '#e0a020'
                : '#c83030';

  // AP 토큰 표시 (GDD §8.2 AP=DEX, 최대 AP=DEX값)
  const maxAP = player.stats?.DEX ?? player.currentAP;
  const apTokens = Array.from({ length: Math.min(maxAP, 10) }, (_, i) => (
    <span
      key={i}
      style={{
        display:      'inline-block',
        width:        10,
        height:       10,
        borderRadius: '50%',
        background:   i < player.currentAP ? '#4ab8e0' : '#2a3a4a',
        margin:       '0 1px',
        border:       '1px solid #1a2a38',
      }}
    />
  ));

  // DP 토큰 (GDD §12.3)
  const maxDP  = 3;
  const dpTokens = Array.from({ length: maxDP }, (_, i) => (
    <span
      key={i}
      style={{
        display:      'inline-block',
        width:        10,
        height:       10,
        borderRadius: '50%',
        background:   i < (player.dp ?? 0) ? '#e0c840' : '#2a2a1a',
        margin:       '0 1px',
        border:       '1px solid #38380a',
      }}
    />
  ));

  return (
    <div style={{
      background:   isActive ? 'rgba(255,200,80,0.07)' : 'rgba(10,12,18,0.85)',
      border:       `1px solid ${isActive ? '#c8a040' : '#2a3040'}`,
      borderRadius: 4,
      padding:      '6px 8px',
      marginBottom: 6,
      fontFamily:   "'Cinzel', serif",
    }}>
      {/* 이름 + 클래스 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: '#e8d8a0', fontSize: 12, fontWeight: 700 }}>
          {CLASS_ICON[player.className] ?? '👤'} {player.name}
        </span>
        <span style={{ color: '#8090a0', fontSize: 10 }}>Lv.{player.level ?? 1}</span>
      </div>

      {/* HP 바 */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#a0b0b0', fontSize: 10 }}>HP</span>
          <span style={{ color: hpColor, fontSize: 10, fontWeight: 700 }}>
            {player.hp} / {player.maxHp}
          </span>
        </div>
        <div style={{ background: '#1a2030', borderRadius: 2, height: 6, overflow: 'hidden' }}>
          <div style={{
            width:      `${hpPct * 100}%`,
            height:     '100%',
            background: hpColor,
            transition: 'width 0.3s ease',
            borderRadius: 2,
          }} />
        </div>
      </div>

      {/* AP + DP 토큰 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
        <div>
          <span style={{ color: '#6090a0', fontSize: 9, marginRight: 3 }}>AP</span>
          {apTokens}
        </div>
        <div>
          <span style={{ color: '#807030', fontSize: 9, marginRight: 3 }}>DP</span>
          {dpTokens}
        </div>
      </div>

      {/* 상태이상 뱃지 */}
      {player.statusEffects?.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {player.statusEffects.map((s, i) => {
            const badge = STATUS_BADGE[s.type] ?? { label: '?', color: '#888', title: s.type };
            return (
              <span
                key={i}
                title={`${badge.title} (${s.duration}주기)`}
                style={{
                  background:   badge.color + '33',
                  border:       `1px solid ${badge.color}`,
                  borderRadius: 3,
                  padding:      '1px 4px',
                  fontSize:     10,
                  color:        badge.color,
                }}
              >
                {badge.label} {s.duration}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 파티 현황 패널 (좌측 HUD) ─────────────────────────────────
export default function HPBar({ activePlayerId = null }) {
  const players = usePlayerStore((s) => s.players);

  if (!players.length) return null;

  return (
    <div style={{
      position:  'fixed',
      top:       60,
      left:      12,
      width:     180,
      zIndex:    100,
      pointerEvents: 'none',
    }}>
      <div style={{
        color:       '#c8a040',
        fontSize:    11,
        fontFamily:  "'Cinzel Decorative', serif",
        marginBottom: 6,
        letterSpacing: 1,
      }}>
        ⚔ PARTY
      </div>
      {players.map((p) => (
        <PlayerPanel
          key={p.id}
          player={p}
          isActive={p.id === activePlayerId}
        />
      ))}
    </div>
  );
}