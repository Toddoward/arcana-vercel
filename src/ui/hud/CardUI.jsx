// ============================================================
// src/ui/hud/CardUI.jsx
// 단일 카드 비주얼 + 드래그/선택 이벤트
//
// GDD: §4.5(카드 비주얼 구성요소) §10.2(AP코스트) §10.3(effectType)
//
// 의존:
//   CardEffect.js  — getCardById, EFFECT_TYPE, CARD_CATEGORY
//   constants.js   — ELEMENT
// ============================================================

import { getCardById, EFFECT_TYPE, CARD_CATEGORY } from '../../game/battle/CardEffect.js';

// ── 카드 분류별 테두리 색 (GDD §4.5) ─────────────────────────
const BORDER_COLOR = {
  ATTACK:  '#c83030',  // 공격 = 빨강
  BUFF:    '#c8a040',  // 버프 = 골드
  PASSIVE: '#8040c0',  // 패시브 = 보라
  ACTION:  '#2080c0',  // 행동 = 파랑
};

// effectType → 분류
function getCardClass(effectType) {
  if ([EFFECT_TYPE.SLASH, EFFECT_TYPE.PIERCE, EFFECT_TYPE.BURST, EFFECT_TYPE.FOCUS].includes(effectType))
    return 'ATTACK';
  if ([EFFECT_TYPE.EMPOWER, EFFECT_TYPE.GUARD, EFFECT_TYPE.HASTE, EFFECT_TYPE.REGEN].includes(effectType))
    return 'BUFF';
  if ([EFFECT_TYPE.COUNTER, EFFECT_TYPE.BARRIER, EFFECT_TYPE.TAUNT].includes(effectType))
    return 'PASSIVE';
  return 'ACTION';
}

// effectType → 아이콘
const EFFECT_ICON = {
  SLASH:   '⚔️', PIERCE: '🗡️', BURST: '💥', FOCUS: '✨',
  EMPOWER: '💪', GUARD:  '🛡️', HASTE: '💨', REGEN: '💚',
  DRAW:    '🃏', SENSE:  '👁️',
  COUNTER: '↩️', BARRIER:'🔮', TAUNT: '📣',
};

// 속성 → 뱃지 색/이모지
const ELEMENT_BADGE = {
  FIRE:      { emoji: '🔥', color: '#e05c2a' },
  ICE:       { emoji: '❄️', color: '#6ec4e8' },
  LIGHTNING: { emoji: '⚡', color: '#f5d84a' },
  DARK:      { emoji: '🌑', color: '#a060d0' },
};

// 카드 크기
const CARD_W = 90;
const CARD_H = 128;

// ================================================================
// Props:
//   instance   — { instanceId, cardId }  (playerStore.hand 항목)
//   isSelected — boolean
//   isDisabled — boolean (AP 부족 등)
//   isHovered  — boolean
//   offsetX    — 부채꼴 X 오프셋 (HandUI에서 계산)
//   offsetY    — 부채꼴 Y 오프셋
//   rotate     — 회전 각도 (deg)
//   onMouseEnter, onMouseLeave
//   onMouseDown — 드래그 시작 (HandUI에서 처리)
//   onClick     — 포인트&클릭 선택
// ================================================================
export default function CardUI({
  instance,
  isSelected  = false,
  isDisabled  = false,
  isHovered   = false,
  offsetX     = 0,
  offsetY     = 0,
  rotate      = 0,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onClick,
}) {
  const cardDef = getCardById(instance?.cardId);
  if (!cardDef) return null;

  const cardClass   = getCardClass(cardDef.effectType);
  const borderColor = BORDER_COLOR[cardClass] ?? '#404050';
  const elemBadge   = ELEMENT_BADGE[cardDef.element];
  const tierLabel   = cardDef.tier === 1 ? 'I' : cardDef.tier === 2 ? 'II' : 'III';

  // 호버/선택 시 위로 부상 (GDD §4.5)
  const liftY  = isHovered ? -22 : isSelected ? -30 : 0;
  const scaleV = isHovered ? 1.08 : isSelected ? 1.12 : 1;

  const style = {
    position:        'absolute',
    width:           CARD_W,
    height:          CARD_H,
    left:            offsetX - CARD_W / 2,
    bottom:          -offsetY,
    transform:       `rotate(${rotate}deg) translateY(${liftY}px) scale(${scaleV})`,
    transformOrigin: 'bottom center',
    transition:      'transform 0.15s ease',
    cursor:          isDisabled ? 'not-allowed' : 'grab',
    userSelect:      'none',
    opacity:         isDisabled ? 0.45 : 1,
    zIndex:          isSelected || isHovered ? 200 : 10,
  };

  const innerStyle = {
    width:        '100%',
    height:       '100%',
    borderRadius: 6,
    background:   'linear-gradient(160deg, #1a1e2e 60%, #0e1018 100%)',
    border:       `2px solid ${borderColor}`,
    boxShadow:    isSelected
      ? `0 0 16px ${borderColor}88, 0 4px 12px #000a`
      : `0 2px 8px #0008`,
    display:      'flex',
    flexDirection:'column',
    alignItems:   'center',
    overflow:     'hidden',
    position:     'relative',
  };

  // 상단 테두리 색상 강조 (GDD §4.5)
  const topBarStyle = {
    width:      '100%',
    height:     4,
    background: borderColor,
    flexShrink: 0,
  };

  return (
    <div
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <div style={innerStyle}>
        {/* 상단 색상 바 */}
        <div style={topBarStyle} />

        {/* AP 코스트 (우상단, 원형) */}
        <div style={{
          position:     'absolute',
          top:          8,
          right:        8,
          width:        22,
          height:       22,
          borderRadius: '50%',
          background:   '#0e1a2a',
          border:       '1px solid #4ab8e0',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     12,
          fontWeight:   700,
          color:        '#4ab8e0',
          fontFamily:   "'Cinzel', serif",
          zIndex:       2,
        }}>
          {cardDef.apCost}
        </div>

        {/* 티어 (좌상단) */}
        <div style={{
          position:  'absolute',
          top:       8,
          left:      8,
          fontSize:  9,
          color:     '#8090a0',
          fontFamily:"'Cinzel', serif",
        }}>
          {tierLabel}
        </div>

        {/* 중앙 아이콘 */}
        <div style={{
          flex:           1,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       32,
          paddingTop:     8,
        }}>
          {EFFECT_ICON[cardDef.effectType] ?? '❓'}
        </div>

        {/* 카드 정보 (하단) */}
        <div style={{
          width:      '100%',
          background: 'rgba(0,0,0,0.5)',
          padding:    '4px 6px 6px',
          borderTop:  '1px solid #2a3040',
        }}>
          {/* 카드 이름 */}
          <div style={{
            fontSize:    10,
            fontWeight:  700,
            color:       '#e8d8a0',
            fontFamily:  "'Cinzel', serif",
            textAlign:   'center',
            lineHeight:  1.2,
            marginBottom:2,
            whiteSpace:  'nowrap',
            overflow:    'hidden',
            textOverflow:'ellipsis',
          }}>
            {cardDef.name}
          </div>

          {/* 카드 타입 (이탈릭) */}
          <div style={{
            fontSize:  9,
            color:     '#708090',
            fontStyle: 'italic',
            textAlign: 'center',
            fontFamily:"'EB Garamond', serif",
          }}>
            {cardClass.charAt(0) + cardClass.slice(1).toLowerCase()}
          </div>

          {/* 속성 뱃지 (우하단) */}
          {elemBadge && (
            <div style={{
              position:  'absolute',
              bottom:    6,
              right:     6,
              fontSize:  13,
              title:     cardDef.element,
            }}>
              {elemBadge.emoji}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { CARD_W, CARD_H };
