// ============================================================
// src/ui/screens/LobbyScreen.jsx
// 로비 화면 — 참여코드 / 파티 슬롯 / 캐릭터 생성(신규) or 선택(이어하기)
//
// GDD: §4.3(아웃게임 UI 흐름) — 신규 로비 / 이어하기 로비
//      §6.4(캐릭터 생성: 직업+닉네임+스탯 6포인트 배분)
//      §6.8(파티 구성 제한: 동일 직업 중복 허용)
//
// 의존:
//   HostManager.js — joinCode, lobbyList, startGame()
//   SyncManager.js — sendAction (PLAYER_READY)
//   playerStore.js — initPlayer
//   constants.js   — CLASS, CLASS_BASE_STATS
// ============================================================

import { useState } from 'react';
import { Button } from '../common/Modal.jsx';

// 클래스 정보 (GDD §6.1, §6.2)
const CLASS_LIST = [
  { id: 'Fighter', label: 'Fighter', icon: '⚔️',
    desc: '근접 전사. 높은 STR/CON, 낮은 INT.',
    stats: { STR:8, DEX:4, INT:2, WIS:4, CON:8, LUK:4 } },
  { id: 'Wizard',  label: 'Wizard',  icon: '🔮',
    desc: '마법사. 높은 INT, 낮은 STR/CON.',
    stats: { STR:2, DEX:5, INT:9, WIS:7, CON:3, LUK:4 } },
  { id: 'Rogue',   label: 'Rogue',   icon: '🗡️',
    desc: '도적. 높은 DEX/LUK, 균형형.',
    stats: { STR:5, DEX:9, INT:4, WIS:3, CON:4, LUK:5 } },
  { id: 'Cleric',  label: 'Cleric',  icon: '✝️',
    desc: '성직자. 회복 + 지원 역할.',
    stats: { STR:4, DEX:4, INT:5, WIS:9, CON:6, LUK:2 } },
  { id: 'Bard',    label: 'Bard',    icon: '🎵',
    desc: '음유시인. 버프/디버프 전문.',
    stats: { STR:4, DEX:6, INT:5, WIS:6, CON:4, LUK:5 } },
];

const STAT_KEYS  = ['STR', 'DEX', 'INT', 'WIS', 'CON', 'LUK'];
const BONUS_POOL = 6; // GDD §6.4: 스탯 배분 6포인트

// ── 캐릭터 생성 폼 ────────────────────────────────────────────
function CharacterCreateForm({ onConfirm }) {
  const [name,      setName]      = useState('');
  const [classId,   setClassId]   = useState('Fighter');
  const [bonus,     setBonus]     = useState({ STR:0, DEX:0, INT:0, WIS:0, CON:0, LUK:0 });

  const baseClass   = CLASS_LIST.find((c) => c.id === classId);
  const usedPoints  = Object.values(bonus).reduce((s, v) => s + v, 0);
  const remaining   = BONUS_POOL - usedPoints;

  const adjustStat = (key, delta) => {
    const next = (bonus[key] ?? 0) + delta;
    if (next < 0 || (delta > 0 && remaining <= 0)) return;
    setBonus((prev) => ({ ...prev, [key]: next }));
  };

  const finalStats = STAT_KEYS.reduce((acc, k) => ({
    ...acc,
    [k]: (baseClass?.stats[k] ?? 5) + (bonus[k] ?? 0),
  }), {});

  const maxHP = 20 + finalStats.CON * 5; // GDD §6.3

  const canConfirm = name.trim().length > 0 && remaining === 0;

  return (
    <div style={{ fontFamily: "'Cinzel', serif", color: '#c0c8d0' }}>
      {/* 닉네임 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#8090a0', marginBottom: 4 }}>캐릭터 이름</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          placeholder="이름 입력..."
          style={{
            width:        '100%',
            background:   '#0e1420',
            border:       '1px solid #3a4060',
            borderRadius: 3,
            padding:      '6px 10px',
            color:        '#e8d8a0',
            fontSize:     13,
            fontFamily:   "'Cinzel', serif",
            boxSizing:    'border-box',
          }}
        />
      </div>

      {/* 직업 선택 (GDD §6.8: 동일 직업 중복 허용) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#8090a0', marginBottom: 4 }}>직업 선택</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CLASS_LIST.map((c) => (
            <button
              key={c.id}
              onClick={() => setClassId(c.id)}
              style={{
                background:   classId === c.id ? 'rgba(200,160,64,0.15)' : 'rgba(20,28,40,0.8)',
                border:       `1px solid ${classId === c.id ? '#c8a040' : '#2a3848'}`,
                borderRadius: 4,
                color:        classId === c.id ? '#e8d080' : '#8090a0',
                padding:      '5px 10px',
                cursor:       'pointer',
                fontSize:     11,
                fontFamily:   "'Cinzel', serif",
              }}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        {baseClass && (
          <div style={{ fontSize: 10, color: '#607080', marginTop: 4 }}>{baseClass.desc}</div>
        )}
      </div>

      {/* 스탯 배분 (GDD §6.4: 6포인트) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#8090a0' }}>스탯 배분</span>
          <span style={{ fontSize: 11, color: remaining > 0 ? '#c8a040' : '#60a060' }}>
            잔여 {remaining}pt
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {STAT_KEYS.map((k) => (
            <div key={k} style={{
              background:   'rgba(10,14,22,0.6)',
              border:       '1px solid #1e2838',
              borderRadius: 3,
              padding:      '4px 6px',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 10, color: '#607080', minWidth: 28 }}>{k}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => adjustStat(k, -1)} style={miniBtn}>−</button>
                <span style={{ fontSize: 12, color: '#e8d8a0', minWidth: 20, textAlign: 'center' }}>
                  {finalStats[k]}
                </span>
                <button onClick={() => adjustStat(k, 1)} style={miniBtn}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#607080', marginTop: 6 }}>
          최대 HP: {maxHP} / 초기 AP: {finalStats.DEX}
        </div>
      </div>

      <Button
        variant="primary"
        disabled={!canConfirm}
        style={{ width: '100%' }}
        onClick={() => onConfirm({ name: name.trim(), classId, stats: finalStats })}
      >
        캐릭터 확정
      </Button>
    </div>
  );
}

const miniBtn = {
  background:   'rgba(30,40,58,0.8)',
  border:       '1px solid #2a3848',
  borderRadius: 2,
  color:        '#8090a0',
  width:        18,
  height:       18,
  cursor:       'pointer',
  fontSize:     12,
  lineHeight:   1,
  padding:      0,
};

// ── 메인 로비 스크린 ──────────────────────────────────────────
export default function LobbyScreen({
  mode,              // 'new' | 'continue'
  joinCode,          // string | null (null이면 참가자)
  lobbyList = [],    // [{ peerId, playerName, ready }]
  myPeerId,
  isHost,
  savedCharacters = [],  // 이어하기 전용: 세이브 캐릭터 목록
  onReady,           // (characterData) => void
  onStartGame,       // 호스트 전용
  onLeave,
}) {
  const [showCreate,      setShowCreate]      = useState(false);
  const [selectedSaveChar, setSelectedSaveChar] = useState(null);

  const allReady      = lobbyList.length > 0 && lobbyList.every((p) => p.ready);
  const myEntry       = lobbyList.find((p) => p.peerId === myPeerId);
  const amIReady      = myEntry?.ready ?? false;

  return (
    <div style={{
      minHeight:   '100vh',
      background:  'radial-gradient(ellipse at center, #0e1428 0%, #060810 100%)',
      display:     'flex',
      flexDirection: 'column',
      alignItems:  'center',
      justifyContent: 'center',
      fontFamily:  "'Cinzel', serif",
      color:       '#c0c8d0',
    }}>
      <div style={{ fontSize: 22, color: '#c8a040', fontWeight: 700, marginBottom: 24, letterSpacing: 2 }}>
        {mode === 'new' ? '⚔ 새로운 모험' : '📜 이어하기'}
      </div>

      {/* 참여코드 표시 (방장) */}
      {joinCode && (
        <div style={{
          background:   'rgba(200,160,64,0.08)',
          border:       '1px solid #c8a04044',
          borderRadius: 6,
          padding:      '10px 24px',
          marginBottom: 20,
          textAlign:    'center',
        }}>
          <div style={{ fontSize: 10, color: '#8090a0', marginBottom: 4, letterSpacing: 2 }}>참여 코드</div>
          <div style={{ fontSize: 28, color: '#e8d080', fontWeight: 700, letterSpacing: 8 }}>{joinCode}</div>
        </div>
      )}

      {/* 파티 슬롯 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[0, 1, 2, 3].map((i) => {
          const p = lobbyList[i];
          return (
            <div key={i} style={{
              width:        120,
              height:       80,
              background:   p ? 'rgba(20,30,50,0.8)' : 'rgba(10,14,22,0.4)',
              border:       `1px solid ${p?.ready ? '#60a060' : p ? '#3a4860' : '#1e2838'}`,
              borderRadius: 4,
              display:      'flex',
              flexDirection:'column',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          4,
            }}>
              {p ? (
                <>
                  <div style={{ fontSize: 13, color: '#c0c8d0' }}>{p.playerName}</div>
                  <div style={{ fontSize: 10, color: p.ready ? '#60c060' : '#8090a0' }}>
                    {p.ready ? '✓ 준비 완료' : '준비 중...'}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#303848' }}>— 빈 슬롯 —</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 캐릭터 생성 or 선택 */}
      {!amIReady && (
        <div style={{ width: 360, marginBottom: 16 }}>
          {mode === 'new' ? (
            <CharacterCreateForm
              onConfirm={(charData) => onReady?.(charData)}
            />
          ) : (
            /* 이어하기: 캐릭터 이름 단위 선택 (GDD §4.3 이어하기 로비) */
            <div>
              <div style={{ fontSize: 11, color: '#8090a0', marginBottom: 8 }}>캐릭터 선택</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {savedCharacters.map((ch) => {
                  const taken = lobbyList.some((p) => p.charId === ch.id && p.peerId !== myPeerId);
                  return (
                    <button
                      key={ch.id}
                      disabled={taken}
                      onClick={() => setSelectedSaveChar(ch)}
                      style={{
                        background:   selectedSaveChar?.id === ch.id
                                        ? 'rgba(200,160,64,0.15)'
                                        : 'rgba(20,28,40,0.8)',
                        border:       `1px solid ${selectedSaveChar?.id === ch.id ? '#c8a040' : '#2a3848'}`,
                        borderRadius: 4,
                        color:        taken ? '#303848' : '#c0c8d0',
                        padding:      '8px 12px',
                        cursor:       taken ? 'not-allowed' : 'pointer',
                        textAlign:    'left',
                        fontFamily:   "'Cinzel', serif",
                        display:      'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{ch.name}</span>
                      <span style={{ color: '#607080', fontSize: 10 }}>
                        {ch.className} Lv.{ch.level}
                        {taken && ' (사용 중)'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <Button
                variant="primary"
                disabled={!selectedSaveChar}
                style={{ width: '100%' }}
                onClick={() => onReady?.({ savedChar: selectedSaveChar })}
              >
                선택 완료
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 준비 완료 표시 */}
      {amIReady && !isHost && (
        <div style={{ color: '#60c060', fontSize: 14, marginBottom: 16 }}>
          ✓ 준비 완료 — 방장의 게임 시작을 기다리는 중...
        </div>
      )}

      {/* 게임 시작 버튼 (호스트 전용) */}
      {isHost && (
        <Button
          variant="primary"
          disabled={!allReady}
          style={{ minWidth: 160, marginBottom: 8 }}
          onClick={onStartGame}
        >
          {allReady ? '▶ 게임 시작' : '모든 플레이어 준비 대기 중...'}
        </Button>
      )}

      {/* 나가기 */}
      <Button variant="secondary" onClick={onLeave} style={{ fontSize: 11 }}>
        로비 나가기
      </Button>
    </div>
  );
}