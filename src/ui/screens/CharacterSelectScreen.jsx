// ============================================================
// src/ui/screens/CharacterSelectScreen.jsx
// 캐릭터 생성(신규) / 캐릭터 선택(이어하기) 화면
//
// GDD: §4.3(아웃게임 UI 흐름) §6.1(클래스 5종) §6.2(초기 스탯)
//      §6.4(캐릭터 생성: 직업 선택 + 이름 + 스탯 6포인트 배분)
//
// props:
//   mode         'create' | 'continue'
//   saveSlot     세이브 데이터 (mode='continue' 시 필수)
//   playerId     이 클라이언트의 플레이어 식별자
//   takenChars   string[]  — 다른 플레이어가 이미 선택한 캐릭터 이름 목록
//   onConfirm    (characterData) => void
//   onCancel     () => void
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  CLASS,
  CLASS_BASE_STATS,
  CHARACTER_CREATION_FREE_POINTS,
  HP,
} from '../../constants/constants.js';

// ── 클래스 메타 (아이콘, 설명, 주력 스탯) ──────────────────
const CLASS_META = {
  [CLASS.FIGHTER]: {
    label: '파이터',   icon: '⚔️',
    desc:  '물리 전투·탱킹 특화. 헤비 아머와 도발로 파티를 지킨다.',
    primary: ['STR', 'CON'],
  },
  [CLASS.WIZARD]: {
    label: '위자드',   icon: '🔮',
    desc:  '강력한 마법 공격. INT가 높을수록 폭발적인 데미지.',
    primary: ['INT', 'WIS'],
  },
  [CLASS.CLERIC]: {
    label: '클레릭',   icon: '✨',
    desc:  '힐·버프·부활 마법. WIS 집중으로 파티 생존을 책임진다.',
    primary: ['WIS', 'CON'],
  },
  [CLASS.ROGUE]: {
    label: '로그',     icon: '🗡️',
    desc:  '높은 DEX로 선제 공격과 회피. 빠르고 날카롭게.',
    primary: ['DEX', 'LUK'],
  },
  [CLASS.BARD]: {
    label: '바드',     icon: '🎵',
    desc:  '파티 전체 버프와 LUK 기반 서포트. 전투 외 이점도 크다.',
    primary: ['LUK', 'DEX'],
  },
};

const STAT_KEYS  = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'LUK'];
const STAT_LABEL = { STR:'힘', DEX:'민첩', CON:'체력', INT:'지력', WIS:'지혜', LUK:'행운' };

// ── 헬퍼 ────────────────────────────────────────────────────
function calcMaxHP(con) { return HP.BASE + con * HP.PER_CON; }

// ============================================================
export function CharacterSelectScreen({
  mode       = 'create',
  saveSlot   = null,
  playerId   = 'p1',
  takenChars = [],
  onConfirm,
  onCancel,
}) {
  // ── CREATE 모드 상태 ────────────────────────────────────
  const [selectedClass, setSelectedClass] = useState(CLASS.FIGHTER);
  const [charName, setCharName]           = useState('');
  const [freePoints, setFreePoints]       = useState(CHARACTER_CREATION_FREE_POINTS);
  const [bonusStats, setBonusStats]       = useState(
    Object.fromEntries(STAT_KEYS.map((k) => [k, 0]))
  );
  const [nameError, setNameError]         = useState('');

  // ── CONTINUE 모드 상태 ──────────────────────────────────
  const savedChars = useMemo(() => {
    if (mode !== 'continue' || !saveSlot) return [];
    return saveSlot.players ?? [];
  }, [mode, saveSlot]);
  const [selectedSavedChar, setSelectedSavedChar] = useState(null);

  // ── 현재 최종 스탯 계산 ────────────────────────────────
  const baseStats   = CLASS_BASE_STATS[selectedClass] ?? {};
  const finalStats  = Object.fromEntries(
    STAT_KEYS.map((k) => [k, (baseStats[k] ?? 0) + bonusStats[k]])
  );
  const previewHP   = calcMaxHP(finalStats.CON);
  const previewAP   = finalStats.DEX;

  // ── 포인트 배분 ────────────────────────────────────────
  const addPoint = (stat) => {
    if (freePoints <= 0) return;
    setBonusStats((s) => ({ ...s, [stat]: s[stat] + 1 }));
    setFreePoints((p) => p - 1);
  };
  const subPoint = (stat) => {
    if (bonusStats[stat] <= 0) return;
    setBonusStats((s) => ({ ...s, [stat]: s[stat] - 1 }));
    setFreePoints((p) => p + 1);
  };

  // 클래스 변경 시 보너스 초기화
  const handleClassSelect = (cls) => {
    setSelectedClass(cls);
    setBonusStats(Object.fromEntries(STAT_KEYS.map((k) => [k, 0])));
    setFreePoints(CHARACTER_CREATION_FREE_POINTS);
  };

  // ── 확인 (CREATE) ──────────────────────────────────────
  const handleCreateConfirm = () => {
    const name = charName.trim();
    if (!name) { setNameError('캐릭터 이름을 입력해주세요.'); return; }
    if (name.length > 16) { setNameError('이름은 16자 이하여야 합니다.'); return; }
    setNameError('');

    onConfirm?.({
      id:        playerId,
      name,
      className: selectedClass,
      level:     1,
      exp:       0,
      gold:      100,
      stats:     Object.fromEntries(STAT_KEYS.map((k) => [k.toLowerCase(), finalStats[k]])),
      maxHp:     previewHP,
      currentHp: previewHP,
      currentAP: previewAP,
      dp:        5,
      maxDp:     5,
      inventory: [],
      equipment: {},
      statusEffects: [],
      deck:      [],
      hand:      [],
      discard:   [],
      field:     [],
    });
  };

  // ── 확인 (CONTINUE) ────────────────────────────────────
  const handleContinueConfirm = () => {
    if (!selectedSavedChar) return;
    onConfirm?.({ ...selectedSavedChar, id: playerId });
  };

  // ============================================================
  // 렌더
  // ============================================================
  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>

        {/* 헤더 */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            {mode === 'create' ? '⚔️ 캐릭터 생성' : '📜 캐릭터 선택'}
          </h2>
          <button style={styles.closeBtn} onClick={onCancel}>✕</button>
        </div>

        {/* ── CREATE 모드 ──────────────────────────────── */}
        {mode === 'create' && (
          <div style={styles.body}>

            {/* 클래스 선택 */}
            <Section title="직업 선택">
              <div style={styles.classGrid}>
                {Object.entries(CLASS_META).map(([cls, meta]) => (
                  <button
                    key={cls}
                    style={{
                      ...styles.classCard,
                      ...(selectedClass === cls ? styles.classCardActive : {}),
                    }}
                    onClick={() => handleClassSelect(cls)}
                  >
                    <span style={styles.classIcon}>{meta.icon}</span>
                    <span style={styles.classLabel}>{meta.label}</span>
                    <span style={styles.classPrimary}>
                      {meta.primary.join(' / ')}
                    </span>
                  </button>
                ))}
              </div>
              <p style={styles.classDesc}>{CLASS_META[selectedClass].desc}</p>
            </Section>

            {/* 캐릭터 이름 */}
            <Section title="캐릭터 이름">
              <input
                style={styles.input}
                placeholder="이름 입력 (최대 16자)"
                value={charName}
                maxLength={16}
                onChange={(e) => { setCharName(e.target.value); setNameError(''); }}
              />
              {nameError && <p style={styles.errorText}>{nameError}</p>}
            </Section>

            {/* 스탯 배분 */}
            <Section title={`스탯 배분 — 남은 포인트: ${freePoints}`}>
              <div style={styles.statGrid}>
                {STAT_KEYS.map((k) => {
                  const isPrimary = CLASS_META[selectedClass].primary.includes(k);
                  return (
                    <div key={k} style={styles.statRow}>
                      <span style={{
                        ...styles.statName,
                        color: isPrimary ? '#c9a84c' : '#a090b0',
                      }}>
                        {STAT_LABEL[k]}
                        {isPrimary && ' ★'}
                      </span>
                      <button
                        style={styles.statBtn}
                        onClick={() => subPoint(k)}
                        disabled={bonusStats[k] <= 0}
                      >−</button>
                      <span style={styles.statVal}>
                        {baseStats[k] ?? 0}
                        {bonusStats[k] > 0 && (
                          <span style={{ color: '#60c080' }}> +{bonusStats[k]}</span>
                        )}
                      </span>
                      <button
                        style={styles.statBtn}
                        onClick={() => addPoint(k)}
                        disabled={freePoints <= 0}
                      >+</button>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* 미리보기 */}
            <Section title="캐릭터 미리보기">
              <div style={styles.previewRow}>
                <PreviewBadge label="최대 HP" value={previewHP} color="#60c080" />
                <PreviewBadge label="전투 AP" value={previewAP} color="#4090e0" />
                <PreviewBadge label="DP"      value={5}          color="#c9a84c" />
              </div>
            </Section>

          </div>
        )}

        {/* ── CONTINUE 모드 ─────────────────────────────── */}
        {mode === 'continue' && (
          <div style={styles.body}>
            <Section title="캐릭터 선택">
              {savedChars.length === 0 ? (
                <p style={{ color: '#806070', textAlign: 'center', padding: 20 }}>
                  저장된 캐릭터가 없습니다.
                </p>
              ) : (
                <div style={styles.savedList}>
                  {savedChars.map((ch) => {
                    const taken = takenChars.includes(ch.name);
                    const active = selectedSavedChar?.name === ch.name;
                    return (
                      <button
                        key={ch.name}
                        disabled={taken}
                        style={{
                          ...styles.savedCard,
                          ...(active ? styles.savedCardActive : {}),
                          ...(taken ? styles.savedCardTaken : {}),
                        }}
                        onClick={() => !taken && setSelectedSavedChar(ch)}
                      >
                        <span style={styles.savedIcon}>
                          {CLASS_META[ch.className]?.icon ?? '?'}
                        </span>
                        <div style={styles.savedInfo}>
                          <span style={styles.savedName}>{ch.name}</span>
                          <span style={styles.savedSub}>
                            {CLASS_META[ch.className]?.label ?? ch.className}
                            {' '}Lv.{ch.level ?? 1}
                          </span>
                        </div>
                        {taken && (
                          <span style={styles.takenBadge}>선택됨</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* 하단 버튼 */}
        <div style={styles.footer}>
          <button style={styles.btnSecondary} onClick={onCancel}>취소</button>
          <button
            style={{
              ...styles.btnPrimary,
              opacity: (mode === 'continue' && !selectedSavedChar) ? 0.4 : 1,
            }}
            onClick={mode === 'create' ? handleCreateConfirm : handleContinueConfirm}
            disabled={mode === 'continue' && !selectedSavedChar}
          >
            확인
          </button>
        </div>

      </div>
    </div>
  );
}

// ── 보조 컴포넌트 ────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ color: '#c9a84c', fontSize: 13, letterSpacing: 1, marginBottom: 8 }}>
        ▸ {title}
      </p>
      {children}
    </div>
  );
}

function PreviewBadge({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#807090' }}>{label}</div>
    </div>
  );
}

// ── 스타일 ───────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(4,3,8,0.88)',
    zIndex: 100,
  },
  panel: {
    width: 480, maxHeight: '90vh',
    background: '#0e0c16',
    border: '1px solid rgba(200,168,76,0.35)',
    borderRadius: 12,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(200,168,76,0.2)',
    background: 'rgba(200,168,76,0.06)',
    flexShrink: 0,
  },
  title: {
    color: '#c9a84c', fontSize: 20, margin: 0,
    fontFamily: "'Cinzel', serif",
  },
  closeBtn: {
    background: 'none', border: 'none',
    color: '#806070', fontSize: 18, cursor: 'pointer',
    padding: '2px 6px',
  },
  body: {
    flex: 1, overflowY: 'auto',
    padding: '20px 24px',
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 12,
    padding: '14px 24px',
    borderTop: '1px solid rgba(200,168,76,0.15)',
    flexShrink: 0,
  },
  // 클래스 선택
  classGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
    marginBottom: 10,
  },
  classCard: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,168,76,0.2)',
    borderRadius: 8, padding: '8px 4px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    cursor: 'pointer', color: '#a090b0', fontSize: 12,
    transition: 'all 0.15s',
  },
  classCardActive: {
    background: 'rgba(200,168,76,0.15)',
    border: '1px solid rgba(200,168,76,0.6)',
    color: '#e8dfc8',
  },
  classIcon:    { fontSize: 22 },
  classLabel:   { fontWeight: 600, color: 'inherit' },
  classPrimary: { fontSize: 10, color: '#c9a84c', opacity: 0.8 },
  classDesc: {
    color: '#8070a0', fontSize: 13, lineHeight: 1.5, margin: 0,
  },
  // 이름 입력
  input: {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(200,168,76,0.25)', borderRadius: 6,
    color: '#e8dfc8', fontSize: 15, padding: '8px 12px',
    outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Cinzel', serif",
  },
  errorText: { color: '#e05050', fontSize: 12, margin: '4px 0 0' },
  // 스탯 배분
  statGrid: { display: 'flex', flexDirection: 'column', gap: 6 },
  statRow: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  statName: { width: 52, fontSize: 13, fontWeight: 600 },
  statBtn: {
    width: 26, height: 26,
    background: 'rgba(200,168,76,0.12)', border: '1px solid rgba(200,168,76,0.25)',
    borderRadius: 4, color: '#c9a84c', fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  },
  statVal: { width: 60, textAlign: 'center', color: '#e8dfc8', fontSize: 15, fontWeight: 600 },
  // 미리보기
  previewRow: {
    display: 'flex', gap: 12,
    background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 0',
  },
  // 이어하기 목록
  savedList: { display: 'flex', flexDirection: 'column', gap: 8 },
  savedCard: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,168,76,0.2)',
    borderRadius: 8, padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
    color: '#e8dfc8',
  },
  savedCardActive: {
    background: 'rgba(200,168,76,0.12)',
    border: '1px solid rgba(200,168,76,0.55)',
  },
  savedCardTaken: { opacity: 0.4, cursor: 'not-allowed' },
  savedIcon: { fontSize: 28 },
  savedInfo: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  savedName: { fontWeight: 700, fontSize: 15 },
  savedSub:  { color: '#907090', fontSize: 13 },
  takenBadge: {
    background: 'rgba(200,100,80,0.25)', border: '1px solid rgba(200,100,80,0.4)',
    borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#e09080',
  },
  // 버튼
  btnPrimary: {
    background: 'linear-gradient(135deg, #c9a84c, #a07830)',
    border: 'none', borderRadius: 6, padding: '9px 26px',
    color: '#0e0c16', fontWeight: 700, fontSize: 14, cursor: 'pointer',
    fontFamily: "'Cinzel', serif",
  },
  btnSecondary: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,168,76,0.2)',
    borderRadius: 6, padding: '9px 20px', color: '#a090b0',
    fontSize: 14, cursor: 'pointer',
  },
};