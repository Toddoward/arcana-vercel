// ============================================================
// src/ui/screens/MainMenuScreen.jsx
// 메인 메뉴 — 닉네임 입력 / 새로운 모험 / 모험 참가 / 지난 모험 일지
//
// GDD: §4.3(아웃게임 UI 흐름 전체) §4.2(다크 판타지 디자인)
// ============================================================

import { useState } from 'react';
import { Button }   from '../common/Modal.jsx';

export default function MainMenuScreen({ onNewGame, onJoinGame, onContinue, onSettings }) {
  const [nickname,   setNickname]   = useState('');
  const [joinInput,  setJoinInput]  = useState('');
  const [showJoin,   setShowJoin]   = useState(false);
  const [showSaves,  setShowSaves]  = useState(false);
  const [saves,      setSaves]      = useState(() => loadSaves());

  function loadSaves() {
    try {
      const raw = localStorage.getItem('arcana_saves');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  const canProceed = nickname.trim().length > 0;

  return (
    <div style={{
      minHeight:       '100vh',
      background:      'radial-gradient(ellipse at 50% 60%, #121830 0%, #06080e 100%)',
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      fontFamily:      "'Cinzel Decorative', serif",
      color:           '#c0c8d0',
      userSelect:      'none',
    }}>
      {/* 타이틀 */}
      <div style={{
        fontSize:      38,
        color:         '#c8a040',
        fontWeight:    700,
        letterSpacing: 4,
        marginBottom:  6,
        textShadow:    '0 0 24px #c8a04066',
      }}>
        ARCANA
      </div>
      <div style={{
        fontSize:      12,
        color:         '#607080',
        letterSpacing: 6,
        marginBottom:  48,
        fontFamily:    "'Cinzel', serif",
      }}>
        DECK · QUEST · SURVIVE
      </div>

      {/* 닉네임 입력 (화면 하단 고정 — 실제로는 중앙 배치) */}
      <div style={{ width: 320, marginBottom: 32 }}>
        <div style={{ fontSize: 10, color: '#8090a0', marginBottom: 6, letterSpacing: 2, fontFamily: "'Cinzel', serif" }}>
          PLAYER NAME
        </div>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={16}
          placeholder="닉네임을 입력하세요"
          style={{
            width:        '100%',
            background:   '#0a0e1a',
            border:       '1px solid #3a4060',
            borderRadius: 4,
            padding:      '10px 14px',
            color:        '#e8d8a0',
            fontSize:     14,
            fontFamily:   "'Cinzel', serif",
            boxSizing:    'border-box',
            outline:      'none',
          }}
        />
      </div>

      {/* 메뉴 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 280, alignItems: 'center' }}>

        {/* 새로운 모험 만들기 */}
        <Button
          variant="primary"
          disabled={!canProceed}
          style={{ width: '100%', fontSize: 13, padding: '11px 0' }}
          onClick={() => onNewGame?.({ nickname: nickname.trim() })}
        >
          ⚔ 새로운 모험 만들기
        </Button>

        {/* 모험 참가하기 (코드 입력 인라인) */}
        <div style={{ width: '100%' }}>
          {!showJoin ? (
            <Button
              variant="secondary"
              disabled={!canProceed}
              style={{ width: '100%', fontSize: 13, padding: '11px 0' }}
              onClick={() => setShowJoin(true)}
            >
              🔗 모험 참가하기
            </Button>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="참여 코드 6자리"
                maxLength={6}
                style={{
                  flex:       1,
                  background: '#0a0e1a',
                  border:     '1px solid #3a4060',
                  borderRadius: 4,
                  padding:    '8px 10px',
                  color:      '#e8d8a0',
                  fontSize:   14,
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: 3,
                  outline:    'none',
                }}
              />
              <Button
                variant="primary"
                disabled={joinInput.length !== 6 || !canProceed}
                onClick={() => onJoinGame?.({ nickname: nickname.trim(), code: joinInput })}
              >
                참가
              </Button>
              <Button variant="secondary" onClick={() => { setShowJoin(false); setJoinInput(''); }}>
                ✕
              </Button>
            </div>
          )}
        </div>

        {/* 지난 모험 일지 */}
        <Button
          variant="secondary"
          disabled={!canProceed}
          style={{ width: '100%', fontSize: 13, padding: '11px 0' }}
          onClick={() => setShowSaves((v) => !v)}
        >
          📜 지난 모험 일지
        </Button>

        {/* 세이브 목록 */}
        {showSaves && (
          <div style={{
            width:        '100%',
            background:   'rgba(10,14,22,0.9)',
            border:       '1px solid #2a3040',
            borderRadius: 4,
            padding:      '10px',
            maxHeight:    200,
            overflowY:    'auto',
          }}>
            {saves.length === 0 ? (
              <div style={{ color: '#405060', fontSize: 11, textAlign: 'center', fontFamily: "'Cinzel', serif" }}>
                저장된 모험이 없습니다
              </div>
            ) : saves.map((save, i) => (
              <div
                key={i}
                style={{
                  display:      'flex',
                  justifyContent: 'space-between',
                  alignItems:   'center',
                  padding:      '6px 8px',
                  marginBottom: 4,
                  background:   'rgba(20,28,40,0.6)',
                  border:       '1px solid #2a3848',
                  borderRadius: 3,
                  cursor:       'pointer',
                }}
                onClick={() => onContinue?.({ nickname: nickname.trim(), saveData: save })}
              >
                <div style={{ fontFamily: "'Cinzel', serif" }}>
                  <div style={{ fontSize: 12, color: '#c0c8d0' }}>{save.name ?? `세이브 ${i + 1}`}</div>
                  <div style={{ fontSize: 10, color: '#607080' }}>
                    Turn {save.worldTurn ?? '?'} — {save.date ?? ''}
                  </div>
                </div>
                <span style={{ color: '#c8a040', fontSize: 11 }}>이어서 ▶</span>
              </div>
            ))}
          </div>
        )}

        {/* 설정 */}
        <Button
          variant="secondary"
          style={{ width: '100%', fontSize: 12, padding: '8px 0', color: '#607080' }}
          onClick={onSettings}
        >
          ⚙ 설정
        </Button>
      </div>

      {/* 하단 크레딧 */}
      <div style={{ position: 'absolute', bottom: 16, fontSize: 9, color: '#2a3040', fontFamily: "'Cinzel', serif", letterSpacing: 2 }}>
        ARCANA — DECK BUILDING CO-OP
      </div>
    </div>
  );
}