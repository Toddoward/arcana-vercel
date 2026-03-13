// ============================================================
// src/ui/screens/ResultScreen.jsx
// 전투 결과 화면 — 승리 / 패배 / 게임오버
//
// GDD: §6.6(경험치 곡선 100×n^1.5) §22.2(골드 획득)
//      §16.2(게임오버 조건)
//
// 의존:
//   Modal.jsx — Button
//   playerStore.js — addExp, addGold (호출은 WorldMapScene에서)
// ============================================================

import { Button } from '../common/Modal.jsx';

// ================================================================
// Props:
//   result   — 'WIN' | 'LOSE' | 'GAME_OVER'
//   rewards  — { exp: number, gold: number, items: [] }
//   reason   — string (게임오버 사유)
//   onContinue — () => void  (월드맵으로 복귀)
//   onRetry    — () => void  (재시작, GAME_OVER 시)
//   onMainMenu — () => void
// ================================================================
export default function ResultScreen({ result, rewards, reason, onContinue, onRetry, onMainMenu }) {
  const isWin      = result === 'WIN';
  const isGameOver = result === 'GAME_OVER';

  const titleText  = isGameOver ? 'GAME OVER'
                   : isWin     ? 'VICTORY'
                   :             'DEFEAT';
  const titleColor = isGameOver ? '#c03030'
                   : isWin     ? '#c8a040'
                   :             '#8090a0';
  const titleIcon  = isGameOver ? '💀' : isWin ? '🏆' : '☠️';

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     'rgba(0,0,0,0.88)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         600,
      fontFamily:     "'Cinzel', serif",
    }}>
      {/* 타이틀 */}
      <div style={{ fontSize: 48, marginBottom: 8 }}>{titleIcon}</div>
      <div style={{
        fontSize:      32,
        color:         titleColor,
        fontWeight:    700,
        letterSpacing: 4,
        marginBottom:  isGameOver ? 12 : 24,
        textShadow:    `0 0 24px ${titleColor}55`,
      }}>
        {titleText}
      </div>

      {/* 게임오버 사유 */}
      {isGameOver && reason && (
        <div style={{ color: '#8090a0', fontSize: 13, marginBottom: 24 }}>{reason}</div>
      )}

      {/* 보상 (승리 시) */}
      {isWin && rewards && (
        <div style={{
          background:   'rgba(10,14,22,0.9)',
          border:       '1px solid #3a4060',
          borderRadius: 6,
          padding:      '16px 32px',
          marginBottom: 24,
          textAlign:    'center',
          minWidth:     240,
        }}>
          <div style={{ color: '#8090a0', fontSize: 11, marginBottom: 10, letterSpacing: 2 }}>REWARDS</div>
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 2 }}>✨</div>
              <div style={{ fontSize: 18, color: '#c8a040', fontWeight: 700 }}>+{rewards.exp}</div>
              <div style={{ fontSize: 10, color: '#607080' }}>EXP</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 2 }}>💰</div>
              <div style={{ fontSize: 18, color: '#c8a040', fontWeight: 700 }}>+{rewards.gold}</div>
              <div style={{ fontSize: 10, color: '#607080' }}>GOLD</div>
            </div>
          </div>

          {/* 획득 아이템 */}
          {rewards.items?.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid #2a3040', paddingTop: 10 }}>
              <div style={{ fontSize: 10, color: '#607080', marginBottom: 6 }}>획득 아이템</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {rewards.items.map((item, i) => (
                  <span key={i} style={{
                    background:   'rgba(20,30,50,0.8)',
                    border:       '1px solid #2a3848',
                    borderRadius: 3,
                    padding:      '3px 8px',
                    fontSize:     11,
                    color:        '#a0b0c0',
                  }}>
                    {item.icon} {item.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: 10 }}>
        {isWin && (
          <Button variant="primary" style={{ minWidth: 140, fontSize: 13, padding: '10px 0' }} onClick={onContinue}>
            모험 계속 ▶
          </Button>
        )}
        {isGameOver && (
          <Button variant="danger" style={{ minWidth: 140 }} onClick={onRetry}>
            처음부터
          </Button>
        )}
        <Button variant="secondary" onClick={onMainMenu}>
          메인 메뉴
        </Button>
      </div>
    </div>
  );
}