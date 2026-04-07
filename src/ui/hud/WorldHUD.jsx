// ============================================================
// src/ui/hud/WorldHUD.jsx
// 월드맵 전용 HUD — 상단 바 / 드래곤 추적기 / 하단 액션 바
//
// GDD: §4.4(월드맵 HUD) §19.4(긴장감 설계 — 드래곤 경고)
//      §4.6(저장 시스템 UI)
//
// 의존:
//   gameStore.js  — worldTurn, dragonPos, dragonThreat, castlePos, partyPos
//   uiStore.js    — openInventory, openCharacter, openQuest
// ============================================================

import { useGameStore }   from '../../stores/gameStore.js';
import { usePlayerStore } from '../../stores/playerStore.js';
import { useUiStore }     from '../../stores/uiStore.js';

// 위협도 → 색상 (GDD §19.4)
function threatColor(threat) {
  if (threat >= 3) return '#e03030';   // 위험
  if (threat >= 2) return '#e09030';   // 경계
  if (threat >= 1) return '#e0c040';   // 주의
  return '#4080c0';                     // 안전
}

export function WorldHUD({ onEndTurn, onSave }) {
  const worldTurn          = useGameStore((s) => s.worldTurn);
  const dragonPos          = useGameStore((s) => s.dragonPos);
  const dragonThreat       = useGameStore((s) => s.dragonThreat ?? 0);
  const castlePos          = useGameStore((s) => s.castlePos);
  const partyPos           = useGameStore((s) => s.partyPos);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex ?? 0);
  const players            = usePlayerStore((s) => s.players);
  const currentPlayer      = players[currentPlayerIndex];
  const currentPlayerName  = currentPlayer?.name ?? `Player ${currentPlayerIndex + 1}`;
  const currentAP          = currentPlayer?.currentAP ?? 0;

  const openInventory = useUiStore((s) => s.openInventory);
  const openCharacter = useUiStore((s) => s.openCharacter);
  const openQuest     = useUiStore((s) => s.openQuest);

  const tColor = threatColor(dragonThreat);

  // 드래곤 거리 (간단한 hex 맨해튼 거리)
  const dragonDist = (dragonPos && partyPos)
    ? Math.abs(dragonPos.x - partyPos.x) + Math.abs(dragonPos.y - partyPos.y)
    : null;

  return (
    <>
      {/* ── 상단 바 ────────────────────────────────────────── */}
      <div style={{
        position:     'fixed',
        top:          0,
        left:         0,
        right:        0,
        height:       48,
        background:   'rgba(6,8,14,0.92)',
        borderBottom: '1px solid #2a3040',
        display:      'flex',
        alignItems:   'center',
        padding:      '0 16px',
        zIndex:       200,
        fontFamily:   "'Cinzel', serif",
        gap:          16,
        pointerEvents:'auto',
      }}>
        {/* 턴 카운터 + 현재 플레이어 */}
        <div style={{ color: '#c8a040', fontSize: 13, fontWeight: 700, minWidth: 80 }}>
          Turn {worldTurn ?? 1}
        </div>
        <div style={{ color: '#80c0e0', fontSize: 12, fontWeight: 600 }}>
          {currentPlayerName}의 턴
        </div>
        <div style={{ color: '#60d080', fontSize: 12, fontWeight: 600 }}>
          ⚡ {currentAP} AP
        </div>

        {/* 마일스톤 진행 바 (placeholder) */}
        <div style={{ flex: 1, padding: '0 12px' }}>
          <div style={{ height: 4, background: '#1a2030', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width:      '35%', // TODO: gameStore.questProgress
              height:     '100%',
              background: 'linear-gradient(90deg, #4060c0, #6080e0)',
              borderRadius: 2,
            }} />
          </div>
          <div style={{ fontSize: 9, color: '#607080', marginTop: 2, textAlign: 'center' }}>
            MAIN QUEST
          </div>
        </div>

        {/* 드래곤 위협 경고 */}
        <div style={{
          display:     'flex',
          alignItems:  'center',
          gap:         6,
          color:       tColor,
          fontSize:    12,
          fontWeight:  700,
          border:      `1px solid ${tColor}44`,
          borderRadius: 4,
          padding:     '3px 8px',
          background:  `${tColor}11`,
          minWidth:    120,
        }}>
          <span style={{ fontSize: 16 }}>🐉</span>
          <span>
            {dragonThreat >= 3 ? '위험!' : dragonThreat >= 2 ? '경계' : dragonThreat >= 1 ? '주의' : '안전'}
            {dragonDist !== null && ` (${dragonDist}칸)`}
          </span>
        </div>

        {/* 저장 버튼 (GDD §4.6) */}
        <button
          onClick={onSave}
          title="수동 저장"
          style={{
            background:   'none',
            border:       '1px solid #3a4050',
            borderRadius: 4,
            color:        '#607080',
            fontSize:     13,
            padding:      '4px 10px',
            cursor:       'pointer',
            fontFamily:   "'Cinzel', serif",
          }}
        >
          💾
        </button>
      </div>

      {/* ── 우측 정보 패널 — 드래곤 추적기 ─────────────────── */}
      <div style={{
        position:     'fixed',
        top:          60,
        right:        12,
        width:        160,
        background:   'rgba(10,12,20,0.88)',
        border:       '1px solid #2a3040',
        borderRadius: 6,
        padding:      '10px 12px',
        zIndex:       100,
        fontFamily:   "'Cinzel', serif",
        pointerEvents:'auto',
      }}>
        <div style={{ color: '#c8a040', fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>
          🐉 DRAGON
        </div>
        <div style={{ fontSize: 11, color: '#8090a0', marginBottom: 4 }}>
          위치: {dragonPos ? `(${dragonPos.x}, ${dragonPos.y})` : '—'}
        </div>
        <div style={{ fontSize: 11, color: '#8090a0', marginBottom: 4 }}>
          성:   {castlePos ? `(${castlePos.x}, ${castlePos.y})` : '—'}
        </div>
        <div style={{ fontSize: 11, color: tColor, fontWeight: 700 }}>
          위협: {'★'.repeat(dragonThreat)}{'☆'.repeat(Math.max(0, 4 - dragonThreat))}
        </div>

        {/* 예상 경로 점선 (시각화는 WorldMapScene SVG에서 담당) */}
        <div style={{ fontSize: 9, color: '#405060', marginTop: 8, lineHeight: 1.4 }}>
          이동 경로는<br />지도에 점선으로<br />표시됩니다
        </div>
      </div>

      {/* ── 하단 액션 바 ──────────────────────────────────── */}
      <div style={{
        position:     'fixed',
        bottom:       0,
        left:         0,
        right:        0,
        height:       56,
        background:   'rgba(6,8,14,0.92)',
        borderTop:    '1px solid #2a3040',
        display:      'flex',
        alignItems:   'center',
        justifyContent:'center',
        gap:          12,
        zIndex:       200,
        pointerEvents:'auto',
      }}>
        {[
          { label: '🎒 인벤토리', onClick: openInventory },
          { label: '👤 캐릭터',   onClick: openCharacter },
          { label: '📜 퀘스트',   onClick: openQuest },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            style={{
              background:   'rgba(20,28,40,0.9)',
              border:       '1px solid #3a4860',
              borderRadius: 4,
              color:        '#a0b8c8',
              fontSize:     12,
              fontFamily:   "'Cinzel', serif",
              padding:      '7px 18px',
              cursor:       'pointer',
              letterSpacing: 0.5,
            }}
          >
            {label}
          </button>
        ))}

        {/* 턴 종료 (자동 저장 포함) */}
        <button
          onClick={onEndTurn}
          style={{
            background:   'linear-gradient(135deg, #2a1800, #5a3800)',
            border:       '1px solid #c8a040',
            borderRadius: 4,
            color:        '#e8d080',
            fontSize:     13,
            fontFamily:   "'Cinzel', serif",
            fontWeight:   700,
            padding:      '7px 22px',
            cursor:       'pointer',
            letterSpacing: 1,
          }}
        >
          턴 종료 ▶
        </button>
      </div>
    </>
  );
}
