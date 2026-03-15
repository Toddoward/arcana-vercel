// ============================================================
// src/ui/screens/MainMenuScreen.jsx
// 메인 메뉴 — ui_prototype.html 디자인 시스템 적용
// GDD §4.3(아웃게임 UI 흐름) §4.2(다크 판타지 디자인)
// ============================================================

import { useState } from 'react';
import { C, F, CLIP, BG, T, cornerStyle } from '../theme.js';

// ── 코너 오너먼트 SVG ────────────────────────────────────
function CornerOrnament({ pos }) {
  return (
    <svg style={cornerStyle(pos)} viewBox="0 0 120 120" fill="none">
      <path d="M0 0 L120 0 L0 120 Z" fill="rgba(201,168,76,0.05)"/>
      <path d="M0 0 L60 0 L0 60" stroke="rgba(201,168,76,0.3)" strokeWidth="1" fill="none"/>
      <path d="M8 0 L8 80 M0 8 L80 8" stroke="rgba(201,168,76,0.15)" strokeWidth="0.5"/>
      <circle cx="8" cy="8" r="3" stroke="rgba(201,168,76,0.4)" strokeWidth="1" fill="none"/>
    </svg>
  );
}

// ── 메뉴 버튼 ────────────────────────────────────────────
function MenuBtn({ icon, label, desc, onClick, disabled, danger }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:    'relative',
        padding:     '18px 24px',
        background:  hovered && !disabled
          ? `linear-gradient(135deg, rgba(201,168,76,0.08), transparent)`
          : `linear-gradient(135deg, ${C.surface} 0%, ${C.deep} 100%)`,
        border:      `1px solid ${hovered && !disabled ? C.goldDim : C.border}`,
        borderTopColor: hovered && !disabled ? C.muted : undefined,
        color:       disabled ? C.muted
          : hovered ? (danger ? '#ff8080' : C.goldBright)
          : C.light,
        fontFamily:  F.ui,
        fontSize:    13,
        fontWeight:  600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        cursor:      disabled ? 'not-allowed' : 'pointer',
        transition:  'all 0.25s ease',
        textAlign:   'left',
        clipPath:    CLIP.md,
        opacity:     disabled ? 0.45 : 1,
        transform:   hovered && !disabled ? 'translateX(2px)' : 'none',
        boxShadow:   hovered && !disabled
          ? `-4px 0 20px rgba(201,168,76,0.12), inset 0 0 20px rgba(201,168,76,0.04)`
          : 'none',
      }}
    >
      <span style={{ display: 'block', fontSize: 20, marginBottom: 6, opacity: 0.7 }}>{icon}</span>
      <span style={{ display: 'block', fontSize: 13 }}>{label}</span>
      <span style={{
        display:     'block',
        fontFamily:  F.body,
        fontSize:    11,
        fontWeight:  400,
        letterSpacing: '0.05em',
        color:       disabled ? C.muted : hovered ? C.dim : C.dim,
        marginTop:   4,
        textTransform: 'none',
      }}>{desc}</span>
    </button>
  );
}

// ── 구분선 장식 ───────────────────────────────────────────
function OrnamentDivider() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, margin:'4px 0' }}>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg, transparent, ${C.border})` }}/>
      <span style={{ color:C.goldDim, fontSize:14 }}>✦</span>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg, ${C.border}, transparent)` }}/>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export function MainMenuScreen({ onNewGame, onJoinGame, onContinue, onSettings }) {
  const [nickname,  setNickname]  = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [showJoin,  setShowJoin]  = useState(false);
  const [showSaves, setShowSaves] = useState(false);
  const [saves,     setSaves]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('arcana_saves') || '[]'); }
    catch { return []; }
  });

  const canProceed = nickname.trim().length > 0;

  return (
    <div style={{
      position:   'relative',
      minHeight:  '100vh',
      overflow:   'hidden',
      display:    'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: F.body,
      color:      C.text,
      userSelect: 'none',
    }}>

      {/* ── 배경 레이어 ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: BG.gradient,
      }}/>
      <div style={{
        position:        'fixed', inset: 0, zIndex: 0,
        backgroundImage: BG.noise,
        opacity:         0.4,
        pointerEvents:   'none',
      }}/>

      {/* ── 코너 오너먼트 ── */}
      <CornerOrnament pos="tl"/>
      <CornerOrnament pos="tr"/>
      <CornerOrnament pos="bl"/>
      <CornerOrnament pos="br"/>

      {/* ── 콘텐츠 ── */}
      <div style={{
        position:      'relative',
        zIndex:        2,
        width:         '100%',
        maxWidth:      680,
        padding:       '40px 20px',
        display:       'grid',
        gridTemplateRows: 'auto 1fr auto',
        gap:           40,
        minHeight:     '80vh',
        justifyItems:  'center',
        boxSizing:     'border-box',
      }}>

        {/* ── 타이틀 블록 ── */}
        <div style={{ textAlign:'center', position:'relative', width:'100%' }}>
          <div style={{ ...T.eyebrow, marginBottom: 16 }}>Chronicles of the</div>

          {/* 타이틀 이미지 */}
          <img
            src="/assets/images/title.png"
            alt="ARCANA"
            style={{
              width:        480,
              maxWidth:     '90vw',
              marginBottom: 0,
              filter:       `drop-shadow(0 0 40px rgba(201,168,76,0.4)) drop-shadow(0 0 80px rgba(201,168,76,0.15))`,
              userSelect:   'none',
              display:      'block',
              margin:       '0 auto',
            }}
          />
          {/* 타이틀 하단 구분선 */}
          <div style={{
            width:      '70%', height: 1, margin: '20px auto 0',
            background: `linear-gradient(90deg, transparent, ${C.goldDim}, transparent)`,
          }}/>
          <div style={{ ...T.italic, marginTop: 16, fontSize: 15 }}>
            어둠이 왕국을 삼키기 전에, 모험은 시작되어야 한다.
          </div>
        </div>

        {/* ── 메뉴 버튼 그룹 ── */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, width:'100%' }}>
          <div style={{
            display:             'grid',
            gridTemplateColumns: '1fr 1fr',
            gap:                 12,
            width:               '100%',
            maxWidth:            600,
          }}>
            <MenuBtn
              icon="⚔️" label="새로운 모험 만들기"
              desc="파티를 결성하고 모험을 이끈다"
              disabled={!canProceed}
              onClick={() => onNewGame?.({ nickname: nickname.trim() })}
            />
            <MenuBtn
              icon="🗺️" label="모험 참가하기"
              desc="초대 코드로 파티에 합류한다"
              disabled={!canProceed}
              onClick={() => setShowJoin((v) => !v)}
            />
            <MenuBtn
              icon="📜" label="지난 모험 일지"
              desc="저장된 모험을 이어서 진행한다"
              disabled={!canProceed}
              onClick={() => setShowSaves((v) => !v)}
            />
            <MenuBtn
              icon="⚙️" label="설정"
              desc="오디오, 화면, 게임플레이 설정"
              danger
              onClick={onSettings}
            />
          </div>

          {/* 참가 코드 인라인 입력 */}
          {showJoin && (
            <div style={{
              display:    'flex',
              gap:        8,
              alignItems: 'center',
              padding:    '12px 16px',
              background: C.deep,
              border:     `1px solid ${C.border}`,
              width:      '100%',
              maxWidth:   600,
              clipPath:   CLIP.sm,
              boxSizing:  'border-box',
            }}>
              <span style={{ ...T.label, marginBottom:0, whiteSpace:'nowrap', fontSize:10 }}>참여 코드</span>
              <input
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="6자리 코드 입력"
                maxLength={6}
                autoFocus
                style={{
                  flex:          1,
                  padding:       '10px 14px',
                  background:    C.abyss,
                  border:        `1px solid ${C.border}`,
                  borderBottom:  `1px solid ${C.muted}`,
                  color:         C.light,
                  fontFamily:    F.ui,
                  fontSize:      18,
                  letterSpacing: '0.4em',
                  textAlign:     'center',
                  outline:       'none',
                  clipPath:      CLIP.sm,
                }}
              />
              <button
                disabled={joinInput.length !== 6}
                onClick={() => onJoinGame?.({ nickname: nickname.trim(), code: joinInput })}
                style={{
                  padding:     '10px 18px',
                  background:  joinInput.length === 6
                    ? `linear-gradient(180deg, #3a2a08, #1e1604)`
                    : C.surface,
                  border:      `1px solid ${joinInput.length === 6 ? C.goldDim : C.border}`,
                  color:       joinInput.length === 6 ? C.goldBright : C.muted,
                  fontFamily:  F.ui,
                  fontSize:    11,
                  letterSpacing: '0.15em',
                  cursor:      joinInput.length === 6 ? 'pointer' : 'not-allowed',
                  clipPath:    CLIP.sm,
                }}
              >
                참가
              </button>
              <button
                onClick={() => { setShowJoin(false); setJoinInput(''); }}
                style={{
                  padding:    '10px 14px',
                  background: 'transparent',
                  border:     `1px solid ${C.muted}`,
                  color:      C.dim,
                  fontFamily: F.ui,
                  fontSize:   11,
                  cursor:     'pointer',
                  clipPath:   CLIP.sm,
                }}
              >
                취소
              </button>
            </div>
          )}

          {/* 세이브 목록 */}
          {showSaves && (
            <div style={{
              width:     '100%', maxWidth: 600,
              background: C.abyss,
              border:    `1px solid ${C.border}`,
              clipPath:  CLIP.md,
              overflow:  'hidden',
            }}>
              <div style={{
                padding:      '10px 20px',
                borderBottom: `1px solid ${C.border}`,
                ...T.label, marginBottom: 0,
              }}>
                저장된 모험
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', padding: '8px' }}>
                {saves.length === 0 ? (
                  <div style={{ ...T.italic, textAlign:'center', padding:'20px 0', fontSize:13 }}>
                    저장된 모험이 없습니다
                  </div>
                ) : saves.map((save, i) => (
                  <div
                    key={i}
                    onClick={() => onContinue?.({ nickname: nickname.trim(), saveData: save })}
                    style={{
                      display:        'flex',
                      justifyContent: 'space-between',
                      alignItems:     'center',
                      padding:        '10px 14px',
                      marginBottom:   4,
                      background:     C.deep,
                      border:         `1px solid ${C.border}`,
                      clipPath:       CLIP.sm,
                      cursor:         'pointer',
                      transition:     'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = C.goldDim;
                      e.currentTarget.style.background  = C.surface;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.background  = C.deep;
                    }}
                  >
                    <div>
                      <div style={{ fontFamily:F.ui, fontSize:12, color:C.light, letterSpacing:'0.08em' }}>
                        {save.name ?? `세이브 ${i + 1}`}
                      </div>
                      <div style={{ ...T.italic, fontSize:11, marginTop:2 }}>
                        Turn {save.worldTurn ?? '?'} — {save.date ?? ''}
                      </div>
                    </div>
                    <span style={{ color:C.gold, fontSize:11, fontFamily:F.ui }}>이어서 ▶</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 닉네임 입력 ── */}
        <div style={{ width:'100%', maxWidth:600, display:'flex', flexDirection:'column', gap:8 }}>
          <OrnamentDivider/>
          <div style={{ ...T.label, marginBottom: 0 }}>모험가의 이름</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={16}
              placeholder="닉네임을 입력하세요"
              style={{
                flex:          1,
                padding:       '12px 16px',
                background:    C.abyss,
                border:        `1px solid ${C.border}`,
                borderBottom:  `1px solid ${C.muted}`,
                color:         C.light,
                fontFamily:    F.body,
                fontSize:      16,
                outline:       'none',
                clipPath:      CLIP.sm,
                transition:    'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = C.goldDim;
                e.target.style.boxShadow   = `0 0 0 1px rgba(201,168,76,0.2), inset 0 0 12px rgba(201,168,76,0.04)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = C.border;
                e.target.style.boxShadow   = 'none';
              }}
            />
          </div>
        </div>
      </div>

      {/* ── 하단 버전 태그 ── */}
      <div style={{
        position:    'fixed', bottom:12, left:16,
        fontFamily:  F.ui, fontSize:10,
        letterSpacing: '0.2em', color:C.muted,
        zIndex:      3,
      }}>
        ARCANA v0.1 — DECK BUILDING CO-OP
      </div>
    </div>
  );
}
