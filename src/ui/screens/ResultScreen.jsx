// ============================================================
// src/ui/screens/ResultScreen.jsx
// 전투 결과 화면 — 승리 / 패배 / 게임오버
// GDD §6.6(경험치 곡선) §22.2(골드) §16.2(게임오버)
// — ui_prototype.html 디자인 시스템 적용
// ============================================================

import { C, F, CLIP, T, cornerStyle } from '../theme.js';
import { Button } from '../common/Modal.jsx';

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

// ── 구분선 장식 ───────────────────────────────────────────
function OrnamentDivider() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, margin:'4px 0' }}>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg, transparent, ${C.border})` }}/>
      <span style={{ color:C.goldDim, fontSize:12 }}>✦</span>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg, ${C.border}, transparent)` }}/>
    </div>
  );
}

// ── 보상 항목 ─────────────────────────────────────────────
function RewardItem({ icon, value, label, color }) {
  return (
    <div style={{ textAlign:'center', flex:1 }}>
      <div style={{ fontSize:26, marginBottom:4 }}>{icon}</div>
      <div style={{ fontFamily:F.ui, fontSize:20, fontWeight:700, color }}>{value}</div>
      <div style={{ fontFamily:F.ui, fontSize:9, color:C.dim, letterSpacing:'0.3em', textTransform:'uppercase', marginTop:3 }}>{label}</div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export function ResultScreen({ result, rewards, reason, onContinue, onRetry, onMainMenu }) {
  const isWin      = result === 'WIN';
  const isGameOver = result === 'GAME_OVER';
  const isLose     = result === 'LOSE';

  const cfg = isGameOver
    ? { title:'GAME OVER', sub:'모험이 끝났습니다.',     icon:'💀', color:C.ruby,   glow:'rgba(192,57,43,0.3)',  bg:'rgba(139,26,46,0.06)' }
    : isWin
    ? { title:'VICTORY',   sub:'전투에서 승리하였습니다.', icon:'🏆', color:C.gold,   glow:'rgba(201,168,76,0.3)', bg:C.goldGlow2 }
    : { title:'DEFEAT',    sub:'전투에서 패배하였습니다.', icon:'☠️', color:C.silver,  glow:'rgba(144,144,168,0.2)', bg:'rgba(30,28,40,0.4)' };

  return (
    <div style={{
      position:'fixed', inset:0,
      background:'rgba(4,3,8,0.92)',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      zIndex:600, fontFamily:F.body,
    }}>
      <CornerOrnament pos="tl"/>
      <CornerOrnament pos="tr"/>
      <CornerOrnament pos="bl"/>
      <CornerOrnament pos="br"/>

      {/* 메인 패널 */}
      <div style={{
        width:480,
        background:`linear-gradient(160deg, ${C.deep} 70%, ${C.abyss} 100%)`,
        border:`1px solid ${C.border}`,
        clipPath:CLIP.lg,
        boxShadow:`0 0 80px ${cfg.glow}, 0 24px 64px rgba(0,0,0,0.8)`,
        overflow:'hidden',
        animation:'fadeInUp 0.5s ease',
      }}>

        {/* 헤더 배너 */}
        <div style={{
          background:cfg.bg,
          borderBottom:`1px solid ${C.border}`,
          padding:'32px 28px 24px',
          textAlign:'center',
          position:'relative',
        }}>
          {/* 글로우 효과 */}
          <div style={{
            position:'absolute', inset:0,
            background:`radial-gradient(ellipse 60% 80% at 50% 0%, ${cfg.glow}, transparent 70%)`,
            pointerEvents:'none',
          }}/>
          <div style={{ fontSize:52, marginBottom:12, filter:`drop-shadow(0 0 16px ${cfg.glow})` }}>
            {cfg.icon}
          </div>
          <div style={{
            fontFamily:    F.title,
            fontSize:      36,
            fontWeight:    700,
            color:         cfg.color,
            letterSpacing: '0.08em',
            textShadow:    `0 0 40px ${cfg.glow}, 0 2px 4px rgba(0,0,0,0.8)`,
            marginBottom:  8,
          }}>
            {cfg.title}
          </div>
          <div style={{ ...T.italic, fontSize:14 }}>
            {reason ?? cfg.sub}
          </div>
        </div>

        {/* 보상 섹션 (승리 시) */}
        {isWin && rewards && (
          <div style={{ padding:'24px 28px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:18 }}>
              <div style={{ ...T.label, marginBottom:0 }}>획득 보상</div>
              <div style={{ flex:1, height:1, background:`linear-gradient(90deg, ${C.border}, transparent)` }}/>
            </div>

            {/* EXP / GOLD */}
            <div style={{
              display:'flex',
              background:C.deep, border:`1px solid ${C.border}`,
              clipPath:CLIP.md,
              marginBottom: rewards.items?.length > 0 ? 14 : 0,
            }}>
              <RewardItem icon="✨" value={`+${rewards.exp}`}  label="EXP"  color={C.goldBright}/>
              <div style={{ width:1, background:C.border, margin:'16px 0' }}/>
              <RewardItem icon="💰" value={`+${rewards.gold}`} label="GOLD" color={C.gold}/>
            </div>

            {/* 획득 아이템 */}
            {rewards.items?.length > 0 && (
              <>
                <OrnamentDivider/>
                <div style={{ marginTop:12 }}>
                  <div style={{ ...T.label, marginBottom:10 }}>획득 아이템</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {rewards.items.map((item, i) => (
                      <div key={i} style={{
                        background:C.surface, border:`1px solid ${C.border}`,
                        clipPath:CLIP.sm,
                        padding:'5px 12px',
                        display:'flex', alignItems:'center', gap:6,
                      }}>
                        <span style={{ fontSize:14 }}>{item.icon}</span>
                        <span style={{ fontFamily:F.body, fontSize:12, color:C.text }}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 패배 메시지 */}
        {isLose && (
          <div style={{ padding:'24px 28px', textAlign:'center' }}>
            <div style={{ ...T.italic, fontSize:14, lineHeight:1.8, color:C.dim }}>
              파티가 쓰러졌습니다.<br/>
              체력을 회복하고 다시 도전하세요.
            </div>
          </div>
        )}

        {/* 버튼 영역 */}
        <div style={{
          display:'flex', justifyContent:'center', gap:10,
          padding:'18px 28px 24px',
          borderTop:`1px solid ${C.border}`,
          background:C.goldGlow2,
        }}>
          {isWin && (
            <Button variant="primary" style={{ minWidth:150 }} onClick={onContinue}>
              모험 계속 ›
            </Button>
          )}
          {(isLose || isGameOver) && (
            <Button variant="danger" style={{ minWidth:130 }} onClick={onRetry}>
              {isGameOver ? '처음부터' : '재도전'}
            </Button>
          )}
          <Button variant="ghost" onClick={onMainMenu}>
            메인 메뉴
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(20px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
