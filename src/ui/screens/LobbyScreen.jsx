// ============================================================
// src/ui/screens/LobbyScreen.jsx
// 로비 화면 — 참여코드 / 파티 슬롯 / 캐릭터 생성(신규) or 선택(이어하기)
// GDD §4.3 / §6.4 / §6.8
// ============================================================

import { useState } from 'react';
import { Button } from '../common/Modal.jsx';
import { CLASS, CLASS_BASE_STATS } from '../../constants/constants.js';

const CLASS_LIST = [
  { id: CLASS.FIGHTER, label: 'Fighter', icon: '⚔️',  desc: '근접 전사. 높은 STR/CON.',   color: '#e05030' },
  { id: CLASS.WIZARD,  label: 'Wizard',  icon: '🔮',  desc: '마법사. 높은 INT/WIS.',       color: '#6060e0' },
  { id: CLASS.CLERIC,  label: 'Cleric',  icon: '✝️',  desc: '성직자. 회복 + 지원.',        color: '#e0c030' },
  { id: CLASS.ROGUE,   label: 'Rogue',   icon: '🗡️', desc: '도적. 높은 DEX/LUK.',        color: '#40b060' },
  { id: CLASS.BARD,    label: 'Bard',    icon: '🎵',  desc: '음유시인. 버프/디버프 전문.', color: '#c040c0' },
];

const STAT_KEYS  = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'LUK'];
const BONUS_POOL = 6;

const S = {
  card: {
    background:   'rgba(14, 20, 36, 0.92)',
    border:       '1px solid #2a3858',
    borderRadius: 8,
    padding:      '18px 20px',
  },
  label: { fontSize: 10, color: '#6080a0', letterSpacing: 2, marginBottom: 5, fontFamily: "'Cinzel', serif" },
  input: {
    width: '100%', background: '#080e1a', border: '1px solid #2a3858',
    borderRadius: 4, padding: '7px 11px', color: '#e8d8a0',
    fontSize: 13, fontFamily: "'Cinzel', serif", boxSizing: 'border-box', outline: 'none',
  },
  miniBtn: {
    background: 'rgba(30,40,58,0.8)', border: '1px solid #2a3848',
    borderRadius: 3, color: '#8090a0', width: 22, height: 22,
    cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
  },
};

// ── 캐릭터 생성 폼 ────────────────────────────────────────
function CharacterCreateForm({ onConfirm, initialName = '' }) {
  const [name,    setName]    = useState(initialName);
  const [classId, setClassId] = useState('');
  const [bonus,   setBonus]   = useState({ STR:0, DEX:0, CON:0, INT:0, WIS:0, LUK:0 });

  const baseClass  = CLASS_LIST.find((c) => c.id === classId);
  const baseStats  = baseClass ? (CLASS_BASE_STATS[classId] ?? {}) : null;
  const usedPoints = Object.values(bonus).reduce((s, v) => s + v, 0);
  const remaining  = BONUS_POOL - usedPoints;

  const adjustStat = (key, delta) => {
    if (!classId) return;
    const next = (bonus[key] ?? 0) + delta;
    if (next < 0 || (delta > 0 && remaining <= 0)) return;
    setBonus((prev) => ({ ...prev, [key]: next }));
  };

  const finalStats = STAT_KEYS.reduce((acc, k) => ({
    ...acc, [k]: (baseStats?.[k] ?? 0) + (bonus[k] ?? 0),
  }), {});

  const maxHP    = classId ? 20 + finalStats.CON * 5 : '—';
  const initAP   = classId ? finalStats.DEX : '—';
  const canConfirm = name.trim().length > 0 && classId && remaining === 0;

  return (
    <div style={{ fontFamily: "'Cinzel', serif", color: '#c0c8d0' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={S.label}>캐릭터 이름</div>
        <input style={S.input} value={name} onChange={(e) => setName(e.target.value)}
          maxLength={16} placeholder="이름을 입력하세요..." />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={S.label}>직업 선택 (필수)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CLASS_LIST.map((c) => {
            const sel = classId === c.id;
            return (
              <button key={c.id} onClick={() => { setClassId(c.id); setBonus({ STR:0,DEX:0,CON:0,INT:0,WIS:0,LUK:0 }); }}
                style={{
                  background: sel ? `${c.color}22` : 'rgba(14,20,36,0.8)',
                  border:     `1px solid ${sel ? c.color : '#2a3858'}`,
                  borderRadius: 5, color: sel ? c.color : '#607090',
                  padding: '6px 12px', cursor: 'pointer', fontSize: 11,
                  fontFamily: "'Cinzel', serif", transition: 'all 0.15s',
                }}>
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>
        {baseClass
          ? <div style={{ fontSize: 10, color: '#506080', marginTop: 5 }}>{baseClass.desc}</div>
          : <div style={{ fontSize: 10, color: '#805040', marginTop: 5 }}>※ 직업을 먼저 선택하세요.</div>
        }
      </div>

      <div style={{ marginBottom: 14, opacity: classId ? 1 : 0.35 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={S.label}>스탯 배분</div>
          <span style={{ fontSize: 11, color: remaining > 0 ? '#c8a040' : '#50b060', fontFamily: "'Cinzel', serif" }}>
            {remaining > 0 ? `잔여 ${remaining}pt` : '✓ 배분 완료'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {STAT_KEYS.map((k) => (
            <div key={k} style={{
              background: 'rgba(8,12,22,0.7)', border: '1px solid #1e2838',
              borderRadius: 4, padding: '5px 8px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 10, color: '#5070a0', minWidth: 30 }}>{k}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => adjustStat(k,-1)} style={S.miniBtn} disabled={!classId}>−</button>
                <span style={{ fontSize: 13, color: '#e8d8a0', minWidth: 22, textAlign: 'center' }}>
                  {classId ? finalStats[k] : '—'}
                </span>
                <button onClick={() => adjustStat(k,1)} style={S.miniBtn} disabled={!classId}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#506070', marginTop: 7 }}>
          최대 HP: {maxHP} &nbsp;/&nbsp; 초기 AP: {initAP}
        </div>
      </div>

      <Button variant="primary" disabled={!canConfirm}
        style={{ width: '100%', opacity: canConfirm ? 1 : 0.45 }}
        onClick={() => {
          const base = CLASS_BASE_STATS[classId] ?? {};
          const bonusStats = Object.fromEntries(
            Object.entries(finalStats).map(([k,v]) => [k, v - (base[k] ?? 0)])
          );
          onConfirm({ id:`p_${Date.now()}`, name:name.trim(), classType:classId, bonusStats, finalStats });
        }}>
        ✓ 캐릭터 확정
      </Button>
    </div>
  );
}

// ── 파티 슬롯 카드 ────────────────────────────────────────
function PartySlot({ player, isMe, isHost: slotIsHost }) {
  const cls = CLASS_LIST.find((c) => c.id === player?.classType);
  return (
    <div style={{
      width: 140, minHeight: 110,
      background: player
        ? `linear-gradient(135deg, rgba(14,20,36,0.95), ${cls?.color ?? '#c8a040'}11)`
        : 'rgba(8,12,22,0.5)',
      border: `1px solid ${player?.ready ? '#50b060' : player ? (cls?.color ?? '#3a4860') : '#1a2030'}`,
      borderRadius: 6, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 4,
      padding: '10px 8px', transition: 'border-color 0.2s', position: 'relative',
    }}>
      {slotIsHost && player && (
        <div style={{ position:'absolute', top:5, right:7, fontSize:9, color:'#c8a040', letterSpacing:1 }}>HOST</div>
      )}
      {isMe && player && (
        <div style={{ position:'absolute', top:5, left:7, fontSize:9, color:'#80c0ff', letterSpacing:1 }}>YOU</div>
      )}
      {player ? (
        <>
          <div style={{ fontSize: 22 }}>{cls?.icon ?? '?'}</div>
          <div style={{ fontSize: 12, color: '#d0d8e8', fontWeight: 700, textAlign: 'center' }}>{player.playerName}</div>
          <div style={{ fontSize: 10, color: cls?.color ?? '#8090a0' }}>{cls?.label ?? player.classType}</div>
          <div style={{ fontSize: 10, color: player.ready ? '#50c060' : '#8090a0', marginTop: 2 }}>
            {player.ready ? '✓ 준비 완료' : '준비 중...'}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11, color: '#252d3d', textAlign: 'center' }}>— 빈 슬롯 —</div>
      )}
    </div>
  );
}

// ── 메인 로비 스크린 ──────────────────────────────────────
export function LobbyScreen({
  mode = 'new', joinCode, lobbyList = [], myPeerId, isHost,
  savedCharacters = [], initialNickname = '',
  onReady, onStartGame, onLeave,
}) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [selectedSaveChar, setSelectedSaveChar] = useState(null);

  const myEntry  = lobbyList.find((p) => p.peerId === myPeerId);
  const amIReady = myEntry?.ready ?? false;
  const allReady = lobbyList.length > 0 && lobbyList.every((p) => p.ready);

  const copyCode = () => {
    if (!joinCode) return;
    navigator.clipboard?.writeText(joinCode).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 30%, #0e1830 0%, #060810 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 32, paddingBottom: 32,
      fontFamily: "'Cinzel', serif", color: '#c0c8d0', overflowY: 'auto',
    }}>
      <div style={{ fontSize: 22, color: '#c8a040', fontWeight: 700, letterSpacing: 3, marginBottom: 4 }}>
        {mode === 'new' ? '⚔ 새로운 모험' : '📜 이어하기'}
      </div>
      <div style={{ fontSize: 10, color: '#405060', letterSpacing: 4, marginBottom: 24 }}>LOBBY</div>

      <div style={{
        display: 'flex', gap: 20, alignItems: 'flex-start',
        width: '100%', maxWidth: 900, padding: '0 16px', boxSizing: 'border-box',
      }}>
        {/* ── 좌측 패널 ── */}
        <div style={{ flex: '0 0 340px' }}>

          {/* 참여 코드 */}
          {joinCode && (
            <div style={{ ...S.card, marginBottom: 14, textAlign: 'center' }}>
              <div style={S.label}>참여 코드</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ fontSize: 28, color: '#e8d080', fontWeight: 700, letterSpacing: 10, textShadow: '0 0 20px #c8a04066' }}>
                  {joinCode}
                </div>
                <button onClick={copyCode} style={{
                  background:   codeCopied ? 'rgba(80,180,80,0.15)' : 'rgba(200,160,64,0.1)',
                  border:       `1px solid ${codeCopied ? '#50b060' : '#c8a04044'}`,
                  borderRadius: 4, color: codeCopied ? '#50c060' : '#c8a040',
                  padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontFamily: "'Cinzel', serif",
                }}>
                  {codeCopied ? '✓ 복사됨' : '📋 복사'}
                </button>
              </div>
              <div style={{ fontSize: 9, color: '#304050', marginTop: 6, letterSpacing: 1 }}>
                이 코드를 친구에게 공유하세요
              </div>
            </div>
          )}

          {/* 파티 현황 */}
          <div style={{ ...S.card, marginBottom: 14 }}>
            <div style={{ ...S.label, marginBottom: 12 }}>파티 현황</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[0,1,2,3].map((i) => {
                const p = lobbyList[i];
                return <PartySlot key={i} player={p} isMe={p?.peerId === myPeerId} isHost={p?.isHost} />;
              })}
            </div>
          </div>

          {amIReady && !isHost && (
            <div style={{ ...S.card, textAlign:'center', color:'#50c060', fontSize:13, marginBottom:12 }}>
              ✓ 준비 완료 — 방장의 시작을 기다리는 중...
            </div>
          )}

          {isHost && (
            <Button variant="primary" disabled={!allReady}
              style={{ width:'100%', marginBottom:8, opacity: allReady ? 1 : 0.5 }}
              onClick={onStartGame}>
              {allReady ? '▶ 게임 시작' : '모든 플레이어 준비 대기 중...'}
            </Button>
          )}

          <Button variant="secondary" onClick={onLeave} style={{ width:'100%', fontSize:11 }}>
            ← 로비 나가기
          </Button>
        </div>

        {/* ── 우측 패널 ── */}
        <div style={{ flex: 1 }}>
          {!amIReady ? (
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 14 }}>
                {mode === 'new' ? '캐릭터 생성' : '캐릭터 선택'}
              </div>
              {mode === 'new' ? (
                <CharacterCreateForm
                  initialName={initialNickname}
                  onConfirm={(charData) => onReady?.(charData)}
                />
              ) : (
                <div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                    {savedCharacters.map((ch) => {
                      const taken = lobbyList.some((p) => p.charId === ch.id && p.peerId !== myPeerId);
                      const cls   = CLASS_LIST.find((c) => c.id === ch.classType);
                      const sel   = selectedSaveChar?.id === ch.id;
                      return (
                        <button key={ch.id} disabled={taken} onClick={() => setSelectedSaveChar(ch)}
                          style={{
                            background: sel ? `${cls?.color ?? '#c8a040'}18` : 'rgba(14,20,36,0.8)',
                            border: `1px solid ${sel ? (cls?.color ?? '#c8a040') : '#2a3858'}`,
                            borderRadius: 5, color: taken ? '#2a3040' : '#c0c8d0',
                            padding: '10px 14px', cursor: taken ? 'not-allowed' : 'pointer',
                            textAlign: 'left', fontFamily: "'Cinzel', serif",
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                          <span>{cls?.icon} {ch.name}</span>
                          <span style={{ color: cls?.color ?? '#607080', fontSize: 10 }}>
                            {cls?.label} Lv.{ch.level ?? 1}{taken && ' · 사용 중'}
                          </span>
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
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 14 }}>내 캐릭터</div>
              {myEntry && (() => {
                const cls   = CLASS_LIST.find((c) => c.id === myEntry.classType);
                const stats = myEntry.finalStats ?? {};
                return (
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                      <div style={{ fontSize: 44 }}>{cls?.icon ?? '?'}</div>
                      <div>
                        <div style={{ fontSize:18, color:'#e8d8a0', fontWeight:700 }}>{myEntry.playerName}</div>
                        <div style={{ fontSize:12, color: cls?.color ?? '#8090a0', marginTop:2 }}>{cls?.label}</div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
                      {STAT_KEYS.map((k) => (
                        <div key={k} style={{
                          background:'rgba(8,12,22,0.7)', border:'1px solid #1e2838',
                          borderRadius:4, padding:'5px 8px',
                          display:'flex', justifyContent:'space-between',
                        }}>
                          <span style={{ fontSize:10, color:'#5070a0' }}>{k}</span>
                          <span style={{ fontSize:13, color:'#e8d8a0' }}>{stats[k] ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                    {Object.keys(stats).length > 0 && (
                      <div style={{ fontSize:10, color:'#506070', marginBottom:14 }}>
                        최대 HP: {20 + (stats.CON ?? 0) * 5} &nbsp;/&nbsp; 초기 AP: {stats.DEX ?? '—'}
                      </div>
                    )}
                    <Button variant="secondary" style={{ width:'100%', fontSize:11 }}
                      onClick={() => onReady?.(null)}>
                      ↩ 준비 취소 / 직업 변경
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}