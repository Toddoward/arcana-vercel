// ============================================================
// src/ui/screens/LobbyScreen.jsx
// 로비 화면 — ui_prototype.html panel-layout 디자인 적용
// GDD §4.3 / §6.4 / §6.8
// ============================================================

import { useState } from 'react';
import { C, F, CLIP, T, cornerStyle } from '../theme.js';
import { Button } from '../common/Modal.jsx';
import { CLASS, CLASS_BASE_STATS } from '../../constants/constants.js';

// ── 클래스 메타데이터 ─────────────────────────────────────
const CLASS_LIST = [
  { id: CLASS.FIGHTER, label: 'Fighter', icon: '⚔️',  desc: '근접 전사. 높은 STR/CON.',   color: '#e05c3a', bg: 'rgba(224,92,58,0.15)'  },
  { id: CLASS.WIZARD,  label: 'Wizard',  icon: '🔮',  desc: '마법사. 높은 INT/WIS.',       color: '#5b8dd9', bg: 'rgba(91,141,217,0.15)' },
  { id: CLASS.CLERIC,  label: 'Cleric',  icon: '✝️',  desc: '성직자. 회복 + 지원.',        color: '#f0c040', bg: 'rgba(240,192,64,0.15)' },
  { id: CLASS.ROGUE,   label: 'Rogue',   icon: '🗡️', desc: '도적. 높은 DEX/LUK.',        color: '#4db87a', bg: 'rgba(77,184,122,0.15)' },
  { id: CLASS.BARD,    label: 'Bard',    icon: '🎵',  desc: '음유시인. 버프/디버프 전문.', color: '#c47fd5', bg: 'rgba(196,127,213,0.15)'},
];

const STAT_KEYS  = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'LUK'];
const BONUS_POOL = 6;

// ── 섹션 헤더 ─────────────────────────────────────────────
function SectionHeader({ title, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
      <div style={T.label}>{title}</div>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg, ${C.border}, transparent)` }}/>
      {right && <span style={{ fontSize:12, color:C.dim, fontStyle:'italic', fontFamily:F.body }}>{right}</span>}
    </div>
  );
}

// ── 코너 오너먼트 ─────────────────────────────────────────
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

// ── 파티 슬롯 ─────────────────────────────────────────────
function PartySlot({ player, isMe, isHost: slotIsHost }) {
  const cls = CLASS_LIST.find((c) => c.id === player?.classType);
  const filled = !!player;
  return (
    <div style={{
      background:  filled
        ? `linear-gradient(160deg, ${C.raised} 0%, ${C.deep} 100%)`
        : C.deep,
      border:      `1px solid ${slotIsHost && filled ? C.goldDim : filled ? C.muted : C.border}`,
      padding:     '16px 12px',
      textAlign:   'center',
      position:    'relative',
      minHeight:   100,
      display:     'flex',
      flexDirection:'column',
      alignItems:  'center',
      justifyContent:'center',
      gap:         6,
      clipPath:    CLIP.sm,
    }}>
      {filled ? (
        <>
          <div style={{
            width:48, height:48, borderRadius:'50%',
            background:  cls?.bg ?? C.surface,
            border:      `2px solid ${slotIsHost ? C.goldDim : C.muted}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20,
          }}>{cls?.icon ?? '?'}</div>
          <div style={{ fontFamily:F.body, fontSize:13, color:C.light }}>{player.playerName}</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'center' }}>
            {slotIsHost && (
              <span style={{
                fontFamily:F.ui, fontSize:8, letterSpacing:'0.3em',
                padding:'2px 6px', border:`1px solid ${C.goldDim}`, color:C.gold,
                textTransform:'uppercase',
              }}>HOST</span>
            )}
            {isMe && (
              <span style={{
                fontFamily:F.ui, fontSize:8, letterSpacing:'0.3em',
                padding:'2px 6px', border:`1px solid #4080c0`, color:'#80c0ff',
                textTransform:'uppercase',
              }}>YOU</span>
            )}
            {player.ready && (
              <span style={{
                fontFamily:F.ui, fontSize:8, letterSpacing:'0.3em',
                padding:'2px 6px', border:`1px solid ${C.greenDim}`, color:C.green,
                textTransform:'uppercase',
              }}>READY</span>
            )}
          </div>
          {!player.ready && (
            <div style={{ fontSize:10, color:C.muted, fontStyle:'italic', fontFamily:F.body }}>준비 중...</div>
          )}
        </>
      ) : (
        <div style={{ color:C.muted, fontStyle:'italic', fontSize:12, fontFamily:F.body }}>대기 중…</div>
      )}
    </div>
  );
}

// ── 캐릭터 생성 폼 ─────────────────────────────────────────
function CharacterCreateForm({ onConfirm, initialName = '' }) {
  const [name,    setName]    = useState(initialName);
  const [classId, setClassId] = useState('');
  const [bonus,   setBonus]   = useState({ STR:0, DEX:0, CON:0, INT:0, WIS:0, LUK:0 });

  const baseClass  = CLASS_LIST.find((c) => c.id === classId);
  const baseStats  = classId ? (CLASS_BASE_STATS[classId] ?? {}) : null;
  const usedPoints = Object.values(bonus).reduce((s, v) => s + v, 0);
  const remaining  = BONUS_POOL - usedPoints;

  const adjust = (key, delta) => {
    if (!classId) return;
    const next = (bonus[key] ?? 0) + delta;
    if (next < 0 || (delta > 0 && remaining <= 0)) return;
    setBonus((p) => ({ ...p, [key]: next }));
  };

  const finalStats = STAT_KEYS.reduce((acc, k) => ({
    ...acc, [k]: (baseStats?.[k] ?? 0) + (bonus[k] ?? 0),
  }), {});

  const maxHP    = classId ? 20 + finalStats.CON * 5 : '—';
  const initAP   = classId ? finalStats.DEX : '—';
  const canConfirm = name.trim().length > 0 && classId && remaining === 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* 캐릭터 이름 */}
      <div>
        <SectionHeader title="캐릭터 이름"/>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          maxLength={16} placeholder="이름을 입력하세요..."
          style={{
            width:'100%', padding:'11px 16px',
            background:C.abyss, border:`1px solid ${C.border}`,
            borderBottom:`1px solid ${C.muted}`,
            color:C.light, fontFamily:F.body, fontSize:16,
            outline:'none', clipPath:CLIP.sm, boxSizing:'border-box',
          }}
          onFocus={(e) => { e.target.style.borderColor = C.goldDim; e.target.style.boxShadow = `0 0 0 1px rgba(201,168,76,0.2)`; }}
          onBlur={(e)  => { e.target.style.borderColor = C.border;  e.target.style.boxShadow = 'none'; }}
        />
      </div>

      {/* 직업 선택 */}
      <div>
        <SectionHeader title="직업 선택" right="필수"/>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
          {CLASS_LIST.map((c) => {
            const sel = classId === c.id;
            return (
              <button key={c.id}
                onClick={() => { setClassId(c.id); setBonus({ STR:0,DEX:0,CON:0,INT:0,WIS:0,LUK:0 }); }}
                style={{
                  background:  sel ? c.bg : C.deep,
                  border:      `1px solid ${sel ? c.color : C.border}`,
                  clipPath:    CLIP.sm,
                  padding:     '14px 10px',
                  textAlign:   'center',
                  cursor:      'pointer',
                  display:     'flex',
                  flexDirection:'column',
                  alignItems:  'center',
                  gap:         8,
                  transition:  'all 0.2s',
                }}>
                <div style={{ width:44, height:44, borderRadius:4, background: sel ? c.bg : C.surface, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{c.icon}</div>
                <div style={{ fontFamily:F.ui, fontSize:10, fontWeight:600, letterSpacing:'0.15em', color: sel ? C.light : C.muted, textTransform:'uppercase' }}>{c.label}</div>
              </button>
            );
          })}
        </div>
        {baseClass
          ? <div style={{ ...T.italic, fontSize:12, marginTop:8 }}>{baseClass.desc}</div>
          : <div style={{ fontFamily:F.body, fontSize:11, color:'#805040', marginTop:8, fontStyle:'italic' }}>※ 직업을 먼저 선택하세요.</div>
        }
      </div>

      {/* 스탯 배분 */}
      <div style={{ opacity: classId ? 1 : 0.35 }}>
        <SectionHeader
          title="스탯 배분"
          right={remaining > 0 ? `잔여 ${remaining}pt` : '✓ 배분 완료'}
        />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
          {STAT_KEYS.map((k) => (
            <div key={k} style={{
              background:C.deep, border:`1px solid ${C.border}`,
              clipPath:CLIP.sm, padding:'7px 10px',
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <span style={{ fontFamily:F.ui, fontSize:10, color:C.dim }}>{k}</span>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <button onClick={() => adjust(k,-1)} disabled={!classId} style={{
                  width:22, height:22, background:C.surface,
                  border:`1px solid ${C.border}`, color:C.muted,
                  cursor: classId ? 'pointer' : 'default',
                  fontSize:14, lineHeight:1, padding:0,
                }}>−</button>
                <span style={{ fontFamily:F.ui, fontSize:13, color:C.light, minWidth:22, textAlign:'center' }}>
                  {classId ? finalStats[k] : '—'}
                </span>
                <button onClick={() => adjust(k,1)} disabled={!classId} style={{
                  width:22, height:22, background:C.surface,
                  border:`1px solid ${C.border}`, color:C.muted,
                  cursor: classId ? 'pointer' : 'default',
                  fontSize:14, lineHeight:1, padding:0,
                }}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ ...T.italic, fontSize:11, marginTop:8 }}>
          최대 HP: {maxHP} &nbsp;/&nbsp; 초기 AP: {initAP}
        </div>
      </div>

      <Button variant="primary" disabled={!canConfirm} style={{ width:'100%' }}
        onClick={() => {
          const base = CLASS_BASE_STATS[classId] ?? {};
          const bonusStats = Object.fromEntries(Object.entries(finalStats).map(([k,v]) => [k, v-(base[k]??0)]));
          onConfirm({ id:`p_${Date.now()}`, name:name.trim(), classType:classId, bonusStats, finalStats });
        }}>
        ✓ 캐릭터 확정
      </Button>
    </div>
  );
}

// ── 메인 로비 스크린 ──────────────────────────────────────
export function LobbyScreen({
  mode = 'new', joinCode, lobbyList = [], myPeerId, isHost,
  savedCharacters = [], initialNickname = '',
  onReady, onStartGame, onLeave,
}) {
  const [codeCopied,       setCodeCopied]       = useState(false);
  const [selectedSaveChar, setSelectedSaveChar] = useState(null);

  const myEntry  = lobbyList.find((p) => p.peerId === myPeerId);
  const amIReady = myEntry?.ready ?? false;
  const allReady = lobbyList.length > 0 && lobbyList.every((p) => p.ready);
  const readyCount = lobbyList.filter((p) => p.ready).length;

  const copyCode = () => {
    navigator.clipboard?.writeText(joinCode).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const myEntry_cls = CLASS_LIST.find((c) => c.id === myEntry?.classType);

  return (
    <div style={{
      position:'relative', minHeight:'100vh',
      overflow:'hidden', fontFamily:F.body, color:C.text,
    }}>
      {/* 배경 */}
      <div style={{ position:'fixed', inset:0, zIndex:0, background:`radial-gradient(ellipse 80% 60% at 50% 0%, rgba(60,30,80,0.35) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 20% 80%, rgba(90,20,30,0.2) 0%, transparent 60%), ${C.void}` }}/>
      <CornerOrnament pos="tl"/><CornerOrnament pos="tr"/>
      <CornerOrnament pos="bl"/><CornerOrnament pos="br"/>

      {/* 콘텐츠 래퍼 */}
      <div style={{
        position:'relative', zIndex:2,
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        minHeight:'100vh', padding:'40px 20px', boxSizing:'border-box',
      }}>
        <div style={{
          width:'100%', maxWidth:1000,
          display:'grid', gridTemplateColumns:'260px 1fr',
          border:`1px solid ${C.border}`,
          background:C.abyss,
          position:'relative',
          animation:'fadeIn 0.4s ease',
        }}>
          {/* 패널 분할선 */}
          <div style={{
            position:'absolute', left:260, top:0, bottom:0, width:1,
            background:`linear-gradient(180deg, transparent, ${C.border} 20%, ${C.border} 80%, transparent)`,
          }}/>

          {/* ── 좌측 네비 ── */}
          <div style={{ display:'flex', flexDirection:'column' }}>
            <div style={{
              padding:'20px 24px 16px',
              borderBottom:`1px solid ${C.border}`,
              display:'flex', flexDirection:'column', gap:4,
            }}>
              <div style={T.label}>{mode === 'new' ? '파티 결성' : '이어하기'}</div>
              <div style={{ ...T.italic, fontSize:13 }}>
                {mode === 'new' ? '다른 모험가를 기다리는 중' : '캐릭터를 선택하세요'}
              </div>
            </div>

            <button onClick={onLeave} style={{
              padding:'16px 24px',
              background:'transparent', border:'none',
              borderBottom:`1px solid ${C.border}`,
              color:C.muted, fontFamily:F.body,
              fontSize:13, textAlign:'left',
              cursor:'pointer', fontStyle:'italic',
              transition:'all 0.2s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'transparent'; }}
            >← 메인으로</button>

            <div style={{ flex:1 }}/>

            {/* 게임 시작 / 준비 상태 */}
            <div style={{ padding:'16px 24px', borderTop:`1px solid ${C.border}` }}>
              {isHost ? (
                <>
                  <div style={{ fontSize:11, color:C.muted, fontStyle:'italic', lineHeight:1.6, fontFamily:F.body, marginBottom:12 }}>
                    모든 플레이어가 준비되면<br/>게임을 시작할 수 있습니다.
                  </div>
                  <Button variant="primary" disabled={!allReady} style={{ width:'100%' }} onClick={onStartGame}>
                    {allReady ? '게임 시작 ›' : '대기 중...'}
                  </Button>
                </>
              ) : amIReady ? (
                <div style={{ fontSize:12, color:C.green, fontStyle:'italic', fontFamily:F.body, lineHeight:1.6 }}>
                  ✓ 준비 완료<br/>방장의 시작을 기다리는 중...
                </div>
              ) : (
                <div style={{ fontSize:11, color:C.muted, fontStyle:'italic', fontFamily:F.body }}>
                  캐릭터를 확정하면<br/>준비 완료 처리됩니다.
                </div>
              )}
            </div>
          </div>

          {/* ── 우측 콘텐츠 ── */}
          <div style={{ display:'flex', flexDirection:'column' }}>
            <div style={{ flex:1, padding:'28px 32px', display:'flex', flexDirection:'column', gap:28 }}>

              {/* 참여 코드 */}
              {joinCode && (
                <div>
                  <SectionHeader title="참여 코드"/>
                  <div style={{
                    background:C.deep, border:`1px solid ${C.border}`,
                    padding:'20px 24px', display:'flex',
                    alignItems:'center', justifyContent:'space-between', gap:16,
                    clipPath:CLIP.md,
                  }}>
                    <div>
                      <div style={{ fontFamily:F.ui, fontSize:9, letterSpacing:'0.4em', color:C.dim, marginBottom:6, textTransform:'uppercase' }}>이 코드를 공유하세요</div>
                      <div style={{ fontFamily:F.ui, fontSize:28, fontWeight:700, color:C.gold, letterSpacing:'0.4em', textShadow:`0 0 20px rgba(201,168,76,0.3)` }}>{joinCode}</div>
                    </div>
                    <button onClick={copyCode} style={{
                      padding:'10px 18px',
                      background:  codeCopied ? 'rgba(80,192,96,0.1)' : C.surface,
                      border:      `1px solid ${codeCopied ? C.greenDim : C.border}`,
                      color:       codeCopied ? C.green : C.gold,
                      fontFamily:  F.ui, fontSize:11, letterSpacing:'0.15em',
                      cursor:'pointer', clipPath:CLIP.sm, transition:'all 0.2s',
                    }}>
                      {codeCopied ? '✓ 복사됨' : '📋 복사'}
                    </button>
                  </div>
                </div>
              )}

              {/* 파티 현황 */}
              <div>
                <SectionHeader title="파티 현황" right={`${lobbyList.length} / 4명`}/>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                  {[0,1,2,3].map((i) => {
                    const p = lobbyList[i];
                    return <PartySlot key={i} player={p} isMe={p?.peerId === myPeerId} isHost={p?.isHost}/>;
                  })}
                </div>
              </div>

              {/* 캐릭터 생성 or 확정 후 상세 */}
              {!amIReady ? (
                <div>
                  <SectionHeader title={mode === 'new' ? '캐릭터 생성' : '캐릭터 선택'}/>
                  {mode === 'new' ? (
                    <CharacterCreateForm initialName={initialNickname} onConfirm={(d) => onReady?.(d)}/>
                  ) : (
                    <div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:16 }}>
                        {savedCharacters.map((ch) => {
                          const taken = lobbyList.some((p) => p.charId === ch.id && p.peerId !== myPeerId);
                          const cls   = CLASS_LIST.find((c) => c.id === ch.classType);
                          const sel   = selectedSaveChar?.id === ch.id;
                          return (
                            <button key={ch.id} disabled={taken} onClick={() => setSelectedSaveChar(ch)} style={{
                              background:  sel ? cls?.bg ?? C.surface : C.deep,
                              border:      `1px solid ${sel ? (cls?.color ?? C.goldDim) : C.border}`,
                              clipPath:    CLIP.sm,
                              padding:     '14px 10px', textAlign:'center',
                              cursor:      taken ? 'not-allowed' : 'pointer',
                              display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                              opacity: taken ? 0.35 : 1, position:'relative',
                            }}>
                              <div style={{ width:44, height:44, borderRadius:4, background:cls?.bg ?? C.surface, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{cls?.icon}</div>
                              <div style={{ fontFamily:F.ui, fontSize:10, fontWeight:600, letterSpacing:'0.15em', color:C.light, textTransform:'uppercase' }}>{cls?.label}</div>
                              <div style={{ fontFamily:F.body, fontSize:11, color:C.goldDim, fontStyle:'italic' }}>Lv. {ch.level ?? 1}</div>
                              {taken && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F.ui, fontSize:9, color:C.ruby, letterSpacing:'0.2em' }}>TAKEN</div>}
                            </button>
                          );
                        })}
                      </div>
                      <Button variant="primary" disabled={!selectedSaveChar} style={{ width:'100%' }}
                        onClick={() => onReady?.({ savedChar: selectedSaveChar })}>
                        선택 완료
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* 확정 후 내 캐릭터 상세 */
                <div>
                  <SectionHeader title="내 캐릭터"/>
                  <div style={{
                    background:C.deep, border:`1px solid ${myEntry_cls?.color ?? C.border}`,
                    clipPath:CLIP.md, padding:'20px 24px',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
                      <div style={{ width:60, height:60, borderRadius:4, background:myEntry_cls?.bg ?? C.surface, border:`2px solid ${myEntry_cls?.color ?? C.muted}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>
                        {myEntry_cls?.icon ?? '?'}
                      </div>
                      <div>
                        <div style={{ fontFamily:F.ui, fontSize:18, fontWeight:700, color:C.light, letterSpacing:'0.05em' }}>{myEntry?.playerName}</div>
                        <div style={{ fontFamily:F.ui, fontSize:11, color:myEntry_cls?.color ?? C.muted, marginTop:4, letterSpacing:'0.2em', textTransform:'uppercase' }}>{myEntry_cls?.label}</div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
                      {STAT_KEYS.map((k) => (
                        <div key={k} style={{
                          background:C.surface, border:`1px solid ${C.border}`,
                          clipPath:CLIP.sm, padding:'6px 10px',
                          display:'flex', justifyContent:'space-between',
                        }}>
                          <span style={{ fontFamily:F.ui, fontSize:10, color:C.dim }}>{k}</span>
                          <span style={{ fontFamily:F.ui, fontSize:13, color:C.light }}>{myEntry?.finalStats?.[k] ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ ...T.italic, fontSize:11, marginBottom:16 }}>
                      최대 HP: {myEntry?.finalStats ? 20 + myEntry.finalStats.CON * 5 : '—'} &nbsp;/&nbsp; 초기 AP: {myEntry?.finalStats?.DEX ?? '—'}
                    </div>
                    <Button variant="ghost" style={{ width:'100%', fontSize:11 }} onClick={() => onReady?.(null)}>
                      ↩ 준비 취소 / 직업 변경
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 액션 바 */}
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'14px 32px', borderTop:`1px solid ${C.border}`,
              background:`linear-gradient(0deg, ${C.deep} 0%, transparent 100%)`,
            }}>
              <div style={{ fontSize:12, color:C.muted, fontFamily:F.body }}>
                <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:C.green, boxShadow:`0 0 6px ${C.green}`, marginRight:6, verticalAlign:'middle' }}/>
                {allReady ? '모든 플레이어 준비 완료' : `${readyCount} / ${Math.max(lobbyList.length,1)}명 준비 완료`}
              </div>
              {isHost && (
                <Button variant="primary" disabled={!allReady} onClick={onStartGame}>
                  게임 시작 ›
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
