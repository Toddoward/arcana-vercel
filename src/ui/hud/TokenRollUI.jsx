// ============================================================
// src/ui/hud/TokenRollUI.jsx
// 토큰 굴림 시각화 — 6개 토큰 / DP 소모 슬라이더 / 확률 미리보기
//
// GDD: §12.1(토큰 굴림) §12.3(DP 소모)
//      §5.2(속성 상성 → 확률 보정)
//
// 의존:
//   TokenRoll.js   — TokenRoll.computeRate({ stat, element, defElement })
//   playerStore.js — dp (현재 DP)
//   constants.js   — TOKEN (토큰 수 = 6 고정)
// ============================================================

import { useState, useMemo } from 'react';
import { TokenRoll }         from '../../game/battle/TokenRoll.js';

// GDD §12.1: 토큰 수 고정 6개
const TOKEN_COUNT = 6;

// ================================================================
// Props:
//   result     — TokenRoll.roll() 결과 { tokens, successes, rate }
//                null이면 대기 상태
//   stat       — 굴림에 사용되는 스탯 수치
//   attackElem — 공격 속성 (ELEMENT.* | null)
//   defElem    — 방어 속성 (ELEMENT.* | null)
//   maxDP      — 현재 보유 DP
//   onConfirm  — (dpSpend: number) => void  굴림 확정
//   onClose    — () => void
// ================================================================
export function TokenRollUI({
  result      = null,
  stat        = 5,
  attackElem  = null,
  defElem     = null,
  maxDP       = 0,
  onConfirm,
  onClose,
}) {
  const [dpSpend, setDpSpend] = useState(0);

  // 확률 미리보기 (GDD §12.1)
  const previewRate = useMemo(() => {
    return TokenRoll.computeRate({
      stat,
      attackElem,
      defElem,
      dpSpend,
    });
  }, [stat, attackElem, defElem, dpSpend]);

  // 결과 토큰 표시 (굴림 후)
  const displayTokens = result
    ? result.tokens                      // [true/false × 6]
    : Array(TOKEN_COUNT).fill(null);     // null = 대기 상태

  const successCount = result?.successes ?? 0;

  return (
    <div style={{
      position:       'fixed',
      bottom:         200,
      left:           '50%',
      transform:      'translateX(-50%)',
      width:          320,
      background:     'rgba(10,12,20,0.95)',
      border:         '1px solid #3a4060',
      borderRadius:   8,
      padding:        '16px 20px',
      zIndex:         300,
      fontFamily:     "'Cinzel', serif",
      boxShadow:      '0 8px 32px #000c',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: '#c8a040', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
          TOKEN ROLL
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#607080', cursor: 'pointer', fontSize: 16 }}
        >
          ✕
        </button>
      </div>

      {/* 속성 상성 표시 */}
      {(attackElem || defElem) && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, fontSize: 11, color: '#8090a0' }}>
          {attackElem && <span>공격: {attackElem}</span>}
          {defElem    && <span>방어: {defElem}</span>}
        </div>
      )}

      {/* 6개 토큰 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
        {displayTokens.map((v, i) => {
          const isSuccess = v === true;
          const isFail    = v === false;
          const isPending = v === null;

          return (
            <div
              key={i}
              style={{
                width:        40,
                height:       40,
                borderRadius: '50%',
                background:   isPending ? '#1a2030'
                            : isSuccess ? 'radial-gradient(circle, #c8a040, #806020)'
                            : 'radial-gradient(circle, #2a3040, #1a2030)',
                border:       isPending ? '2px solid #2a3040'
                            : isSuccess ? '2px solid #e0c060'
                            : '2px solid #303848',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                fontSize:     18,
                boxShadow:    isSuccess ? '0 0 8px #c8a04066' : 'none',
                transition:   'all 0.2s ease',
              }}
            >
              {isPending ? '·' : isSuccess ? '✦' : '✕'}
            </div>
          );
        })}
      </div>

      {/* 굴림 결과 */}
      {result && (
        <div style={{
          textAlign:    'center',
          marginBottom: 12,
          fontSize:     13,
          color:        successCount > 0 ? '#c8a040' : '#c05050',
          fontWeight:   700,
        }}>
          {successCount > 0
            ? `성공 ${successCount} / ${TOKEN_COUNT}`
            : '실패 — 효과 없음'}
        </div>
      )}

      {/* 확률 미리보기 */}
      {!result && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#8090a0', fontSize: 11 }}>토큰당 성공 확률</span>
            <span style={{ color: '#c8a040', fontSize: 12, fontWeight: 700 }}>
              {Math.round(previewRate * 100)}%
            </span>
          </div>
          {/* 확률 바 */}
          <div style={{ background: '#1a2030', borderRadius: 3, height: 6 }}>
            <div style={{
              width:        `${previewRate * 100}%`,
              height:       '100%',
              background:   previewRate >= 0.7 ? '#4cba4c'
                          : previewRate >= 0.5 ? '#c8a040'
                          : '#c05050',
              borderRadius: 3,
              transition:   'width 0.2s',
            }} />
          </div>
        </div>
      )}

      {/* DP 소모 슬라이더 (GDD §12.3) */}
      {!result && maxDP > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#8090a0', fontSize: 11 }}>DP 소모 (확정 성공)</span>
            <span style={{ color: '#e0c840', fontSize: 12, fontWeight: 700 }}>
              {dpSpend} / {maxDP}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={maxDP}
            value={dpSpend}
            onChange={(e) => setDpSpend(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#e0c840', cursor: 'pointer' }}
          />
          {dpSpend > 0 && (
            <div style={{ fontSize: 10, color: '#a09040', textAlign: 'right' }}>
              토큰 {dpSpend}개 확정 성공
            </div>
          )}
        </div>
      )}

      {/* 버튼 */}
      {!result ? (
        <button
          onClick={() => onConfirm?.(dpSpend)}
          style={{
            width:        '100%',
            padding:      '8px 0',
            background:   'linear-gradient(135deg, #3a2a10, #6a4a20)',
            border:       '1px solid #c8a040',
            borderRadius: 4,
            color:        '#e8d080',
            fontSize:     13,
            fontFamily:   "'Cinzel', serif",
            fontWeight:   700,
            cursor:       'pointer',
            letterSpacing: 1,
          }}
        >
          굴림 확정
        </button>
      ) : (
        <button
          onClick={onClose}
          style={{
            width:        '100%',
            padding:      '8px 0',
            background:   '#1a2030',
            border:       '1px solid #3a4060',
            borderRadius: 4,
            color:        '#8090a0',
            fontSize:     12,
            fontFamily:   "'Cinzel', serif",
            cursor:       'pointer',
          }}
        >
          닫기
        </button>
      )}
    </div>
  );
}
