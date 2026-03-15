// ============================================================
// src/ui/screens/CharacterSelectScreen.jsx
// 캐릭터 생성(신규) / 캐릭터 선택(이어하기) 화면
// GDD §4.3 / §6.1 / §6.2 / §6.4
// — ui_prototype.html 디자인 시스템 적용
// ============================================================

import { useState, useMemo } from 'react';
import { C, F, CLIP, T, cornerStyle } from '../theme.js';
import { Button } from '../common/Modal.jsx';
import {
  CLASS, CLASS_BASE_STATS,
  CHARACTER_CREATION_FREE_POINTS, HP,
} from '../../constants/constants.js';

// ── 클래스 메타 ───────────────────────────────────────────
const CLASS_META = {
  [CLASS.FIGHTER]: { label:'Fighter', icon:'⚔️', desc:'물리 전투·탱킹 특화. 헤비 아머와 도발로 파티를 지킨다.', primary:['STR','CON'], color:'#e05c3a', bg:'rgba(224,92,58,0.15)' },
  [CLASS.WIZARD]:  { label:'Wizard',  icon:'🔮', desc:'강력한 마법 공격. INT가 높을수록 폭발적인 데미지.',       primary:['INT','WIS'], color:'#5b8dd9', bg:'rgba(91,141,217,0.15)' },
  [CLASS.CLERIC]:  { label:'Cleric',  icon:'✝️', desc:'힐·버프·부활 마법. WIS 집중으로 파티 생존을 책임진다.',  primary:['WIS','CON'], color:'#f0c040', bg:'rgba(240,192,64,0.15)' },
  [CLASS.ROGUE]:   { label:'Rogue',   icon:'🗡️',desc:'높은 DEX로 선제 공격과 회피. 빠르고 날카롭게.',         primary:['DEX','LUK'], color:'#4db87a', bg:'rgba(77,184,122,0.15)' },
  [CLASS.BARD]:    { label:'Bard',    icon:'🎵', desc:'파티 전체 버프와 LUK 기반 서포트. 전투 외 이점도 크다.', primary:['LUK','DEX'], color:'#c47fd5', bg:'rgba(196,127,213,0.15)' },
};

const STAT_KEYS  = ['STR','DEX','CON','INT','WIS','LUK'];
const STAT_LABEL = { STR:'힘', DEX:'민첩', CON:'체력', INT:'지력', WIS:'지혜', LUK:'행운' };

// ── 섹션 헤더 ─────────────────────────────────────────────
function SectionHeader({ title, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14 }}>
      <div style={{ ...T.label, marginBottom:0 }}>{title}</div>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg, ${C.border}, transparent)` }}/>
      {right && <span style={{ fontSize:11, color:C.dim, fontStyle:'italic', fontFamily:F.body }}>{right}</span>}
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

// ── 메인 컴포넌트 ─────────────────────────────────────────
export function CharacterSelectScreen({
  mode       = 'create',
  saveSlot   = null,
  playerId   = 'p1',
  takenChars = [],
  onConfirm,
  onCancel,
}) {
  // CREATE 상태
  const [selectedClass, setSelectedClass] = useState(CLASS.FIGHTER);
  const [charName,      setCharName]      = useState('');
  const [freePoints,    setFreePoints]    = useState(CHARACTER_CREATION_FREE_POINTS);
  const [bonusStats,    setBonusStats]    = useState(Object.fromEntries(STAT_KEYS.map((k) => [k,0])));
  const [nameError,     setNameError]     = useState('');

  // CONTINUE 상태
  const savedChars = useMemo(() => mode !== 'continue' || !saveSlot ? [] : saveSlot.players ?? [], [mode, saveSlot]);
  const [selectedSavedChar, setSelectedSavedChar] = useState(null);

  const meta       = CLASS_META[selectedClass];
  const baseStats  = CLASS_BASE_STATS[selectedClass] ?? {};
  const finalStats = Object.fromEntries(STAT_KEYS.map((k) => [k, (baseStats[k]??0) + bonusStats[k]]));
  const previewHP  = (HP?.BASE ?? 20) + finalStats.CON * (HP?.PER_CON ?? 5);
  const previewAP  = finalStats.DEX;

  const addPoint = (stat) => {
    if (freePoints <= 0) return;
    setBonusStats((s) => ({ ...s, [stat]: s[stat]+1 }));
    setFreePoints((p) => p-1);
  };
  const subPoint = (stat) => {
    if (bonusStats[stat] <= 0) return;
    setBonusStats((s) => ({ ...s, [stat]: s[stat]-1 }));
    setFreePoints((p) => p+1);
  };
  const handleClassSelect = (cls) => {
    setSelectedClass(cls);
    setBonusStats(Object.fromEntries(STAT_KEYS.map((k) => [k,0])));
    setFreePoints(CHARACTER_CREATION_FREE_POINTS);
  };

  const handleCreateConfirm = () => {
    const name = charName.trim();
    if (!name) { setNameError('캐릭터 이름을 입력해주세요.'); return; }
    setNameError('');
    onConfirm?.({ id:playerId, name, classType:selectedClass, bonusStats, finalStats });
  };

  const handleContinueConfirm = () => {
    if (!selectedSavedChar) return;
    onConfirm?.({ ...selectedSavedChar, id:playerId });
  };

  return (
    <div style={{
      position:'fixed', inset:0,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(4,3,8,0.88)',
      zIndex:100, fontFamily:F.body,
    }}>
      <CornerOrnament pos="tl"/>
      <CornerOrnament pos="tr"/>
      <CornerOrnament pos="bl"/>
      <CornerOrnament pos="br"/>

      <div style={{
        width:560, maxHeight:'90vh',
        background:`linear-gradient(160deg, ${C.deep} 80%, ${C.abyss} 100%)`,
        border:`1px solid ${C.border}`,
        clipPath:CLIP.lg,
        boxShadow:`0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px ${C.goldGlow2}`,
        display:'flex', flexDirection:'column',
        overflow:'hidden',
      }}>

        {/* 헤더 */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'14px 24px',
          borderBottom:`1px solid ${C.border}`,
          background:C.goldGlow2,
          flexShrink:0,
        }}>
          <div style={{ ...T.label, marginBottom:0, fontSize:12, letterSpacing:'0.25em' }}>
            {mode === 'create' ? '⚔️  캐릭터 생성' : '📜  캐릭터 선택'}
          </div>
          <button onClick={onCancel} style={{
            background:'none', border:'none', color:C.muted,
            fontSize:16, cursor:'pointer', transition:'color 0.15s',
          }}
            onMouseEnter={(e) => e.currentTarget.style.color = C.text}
            onMouseLeave={(e) => e.currentTarget.style.color = C.muted}
          >✕</button>
        </div>

        {/* 본문 */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:24 }}>

          {/* ── CREATE 모드 ── */}
          {mode === 'create' && (<>

            {/* 직업 선택 */}
            <div>
              <SectionHeader title="직업 선택"/>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:10 }}>
                {Object.entries(CLASS_META).map(([cls, m]) => {
                  const sel = selectedClass === cls;
                  return (
                    <button key={cls} onClick={() => handleClassSelect(cls)} style={{
                      background: sel ? m.bg : C.deep,
                      border:     `1px solid ${sel ? m.color : C.border}`,
                      clipPath:   CLIP.sm,
                      padding:    '14px 10px',
                      display:    'flex', flexDirection:'column', alignItems:'center', gap:8,
                      cursor:     'pointer', transition:'all 0.2s',
                    }}>
                      <div style={{ width:44, height:44, borderRadius:4, background: sel ? m.bg : C.surface, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{m.icon}</div>
                      <div style={{ fontFamily:F.ui, fontSize:10, fontWeight:600, letterSpacing:'0.15em', color: sel ? C.light : C.muted, textTransform:'uppercase' }}>{m.label}</div>
                      <div style={{ fontFamily:F.ui, fontSize:9, color: sel ? m.color : C.muted, letterSpacing:'0.1em' }}>{m.primary.join(' / ')}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ ...T.italic, fontSize:13, lineHeight:1.6 }}>{meta.desc}</div>
            </div>

            {/* 캐릭터 이름 */}
            <div>
              <SectionHeader title="캐릭터 이름"/>
              <input
                value={charName} onChange={(e) => { setCharName(e.target.value); setNameError(''); }}
                maxLength={16} placeholder="이름 입력 (최대 16자)"
                style={{
                  width:'100%', padding:'11px 16px',
                  background:C.abyss, border:`1px solid ${nameError ? C.ruby : C.border}`,
                  borderBottom:`1px solid ${nameError ? C.ruby : C.muted}`,
                  color:C.light, fontFamily:F.body, fontSize:16,
                  outline:'none', clipPath:CLIP.sm, boxSizing:'border-box',
                  transition:'border-color 0.2s',
                }}
                onFocus={(e) => { if (!nameError) { e.target.style.borderColor = C.goldDim; e.target.style.boxShadow = `0 0 0 1px rgba(201,168,76,0.2)`; } }}
                onBlur={(e)  => { e.target.style.borderColor = nameError ? C.ruby : C.border; e.target.style.boxShadow = 'none'; }}
              />
              {nameError && <div style={{ color:C.ruby, fontSize:12, marginTop:6, fontFamily:F.body }}>{nameError}</div>}
            </div>

            {/* 스탯 배분 */}
            <div>
              <SectionHeader
                title="스탯 배분"
                right={freePoints > 0 ? `잔여 ${freePoints}pt` : '✓ 배분 완료'}
              />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {STAT_KEYS.map((k) => {
                  const isPrimary = meta.primary.includes(k);
                  return (
                    <div key={k} style={{
                      background:C.deep, border:`1px solid ${isPrimary ? meta.color+'44' : C.border}`,
                      clipPath:CLIP.sm, padding:'8px 12px',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                    }}>
                      <span style={{
                        fontFamily:F.ui, fontSize:11,
                        color: isPrimary ? meta.color : C.dim,
                        minWidth:40,
                      }}>
                        {STAT_LABEL[k]}{isPrimary && ' ★'}
                      </span>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <button onClick={() => subPoint(k)} disabled={bonusStats[k]<=0} style={{
                          width:24, height:24, background:C.surface,
                          border:`1px solid ${C.border}`, color:C.muted,
                          cursor: bonusStats[k]>0 ? 'pointer' : 'default',
                          fontSize:14, lineHeight:1, padding:0,
                        }}>−</button>
                        <span style={{ fontFamily:F.ui, fontSize:14, color:C.light, minWidth:40, textAlign:'center' }}>
                          {baseStats[k]??0}
                          {bonusStats[k]>0 && <span style={{ color:C.green }}> +{bonusStats[k]}</span>}
                        </span>
                        <button onClick={() => addPoint(k)} disabled={freePoints<=0} style={{
                          width:24, height:24, background:C.surface,
                          border:`1px solid ${C.border}`, color:C.muted,
                          cursor: freePoints>0 ? 'pointer' : 'default',
                          fontSize:14, lineHeight:1, padding:0,
                        }}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 미리보기 */}
            <div>
              <SectionHeader title="캐릭터 미리보기"/>
              <div style={{
                display:'flex', gap:0,
                background:C.deep, border:`1px solid ${C.border}`,
                clipPath:CLIP.md,
              }}>
                {[
                  { label:'최대 HP', value:previewHP, color:C.green },
                  { label:'전투 AP', value:previewAP, color:'#4090e0' },
                  { label:'DP',      value:5,          color:C.gold },
                ].map((item, i) => (
                  <div key={i} style={{
                    flex:1, textAlign:'center', padding:'14px 0',
                    borderLeft: i>0 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <div style={{ fontFamily:F.ui, fontSize:22, fontWeight:700, color:item.color }}>{item.value}</div>
                    <div style={{ fontFamily:F.ui, fontSize:10, color:C.dim, letterSpacing:'0.2em', marginTop:4, textTransform:'uppercase' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>)}

          {/* ── CONTINUE 모드 ── */}
          {mode === 'continue' && (
            <div>
              <SectionHeader title="캐릭터 선택" right="중복 선택 불가"/>
              {savedChars.length === 0 ? (
                <div style={{ ...T.italic, textAlign:'center', padding:'32px 0', fontSize:14 }}>
                  저장된 캐릭터가 없습니다.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {savedChars.map((ch) => {
                    const taken  = takenChars.includes(ch.name);
                    const sel    = selectedSavedChar?.name === ch.name;
                    const m      = CLASS_META[ch.classType ?? ch.className];
                    return (
                      <button key={ch.name} disabled={taken}
                        onClick={() => !taken && setSelectedSavedChar(ch)}
                        style={{
                          display:'flex', alignItems:'center', gap:16,
                          background: sel ? m?.bg ?? C.surface : C.deep,
                          border:     `1px solid ${sel ? (m?.color ?? C.goldDim) : C.border}`,
                          clipPath:   CLIP.sm,
                          padding:    '14px 18px',
                          cursor:     taken ? 'not-allowed' : 'pointer',
                          textAlign:  'left', transition:'all 0.2s',
                          opacity:    taken ? 0.4 : 1, position:'relative',
                        }}>
                        <div style={{ width:44, height:44, borderRadius:4, background:m?.bg ?? C.surface, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>{m?.icon ?? '?'}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:F.ui, fontWeight:600, fontSize:14, color:C.light, letterSpacing:'0.08em' }}>{ch.name}</div>
                          <div style={{ fontFamily:F.body, fontSize:12, color:m?.color ?? C.muted, fontStyle:'italic', marginTop:3 }}>
                            {m?.label ?? ch.className} Lv.{ch.level ?? 1}
                          </div>
                        </div>
                        {taken && (
                          <span style={{ fontFamily:F.ui, fontSize:9, letterSpacing:'0.2em', padding:'3px 8px', border:`1px solid ${C.ruby}`, color:C.ruby, textTransform:'uppercase' }}>TAKEN</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{
          display:'flex', justifyContent:'flex-end', gap:10,
          padding:'14px 28px',
          borderTop:`1px solid ${C.border}`,
          background:C.goldGlow2,
          flexShrink:0,
        }}>
          <Button variant="ghost" onClick={onCancel}>취소</Button>
          <Button
            variant="primary"
            disabled={mode === 'continue' && !selectedSavedChar}
            onClick={mode === 'create' ? handleCreateConfirm : handleContinueConfirm}
          >
            확인
          </Button>
        </div>
      </div>
    </div>
  );
}
