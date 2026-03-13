// ============================================================
// src/ui/hud/HandUI.jsx
// 카드 핸드 — 부채꼴(Fan) 호 정렬 + 드래그&드롭 + 포인트&클릭
//
// GDD: §4.5(카드 핸드 UI 전체) §10.4(핸드 시스템)
//      §10.2(AP 코스트) §10.1(패시브 카드 필드 등록)
//
// 의존:
//   CardUI.jsx     — 단일 카드 렌더링
//   CardEffect.js  — getCardById, CARD_CATEGORY
//   playerStore.js — hand[], currentAP
//   CombatEngine   — useCard(playerId, instanceId, targetId)
//                    registerPassive(playerId, instanceId)
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import CardUI, { CARD_W, CARD_H } from './CardUI.jsx';
import { getCardById, CARD_CATEGORY } from '../../game/deck/CardEffect.js';
import { usePlayerStore } from '../../stores/playerStore.js';

// ── 부채꼴 레이아웃 계산 (GDD §4.5) ──────────────────────────
function computeFanLayout(cardCount) {
  if (cardCount === 0) return [];

  // 카드 수에 따라 반지름·각도 자동 계산
  const BASE_RADIUS  = 420;
  const MAX_SPREAD   = 60;  // 전체 부채꼴 각도 (deg)
  const MIN_GAP      = 4;   // 최소 카드 간격 각도

  const spread   = Math.min(MAX_SPREAD, (cardCount - 1) * 10);
  const angleGap = cardCount > 1 ? spread / (cardCount - 1) : 0;
  const startAng = -spread / 2;

  return Array.from({ length: cardCount }, (_, i) => {
    const angleDeg = startAng + angleGap * i;
    const angleRad = (angleDeg * Math.PI) / 180;

    // 호의 중심은 화면 하단 중앙 아래쪽 (반지름만큼 내려간 가상 원점)
    const x = Math.sin(angleRad) * BASE_RADIUS;
    const y = BASE_RADIUS - Math.cos(angleRad) * BASE_RADIUS;

    return { x, y: -y, rotate: angleDeg };
  });
}

// ── 카드 → 타겟 필요 여부 판단 ────────────────────────────────
function needsTarget(cardDef) {
  if (!cardDef) return false;
  // 광역(BURST), 패시브(COUNTER/BARRIER/TAUNT), 자신(REGEN/GUARD/HASTE/EMPOWER/DRAW/SENSE)
  // 는 즉시 사용 or 필드 등록
  const noTarget = ['BURST', 'EMPOWER', 'GUARD', 'HASTE', 'REGEN', 'DRAW', 'SENSE',
                    'COUNTER', 'BARRIER', 'TAUNT'];
  return !noTarget.includes(cardDef.effectType);
}

// ================================================================
// Props:
//   playerId   — 이 핸드의 소유자 ID
//   isMyTurn   — boolean: 내 턴 여부 (false면 전체 비활성)
//   onUseCard  — (instanceId, targetId|null) => void
//                CombatEngine.useCard 래퍼
//   onRegisterPassive — (instanceId) => void
//   targets    — [{ id, label, position }]  유효 타겟 목록 (적/아군)
// ================================================================
export default function HandUI({ playerId, isMyTurn, onUseCard, onRegisterPassive, targets = [] }) {
  const hand      = usePlayerStore((s) => s.players.find((p) => p.id === playerId)?.hand ?? []);
  const currentAP = usePlayerStore((s) => s.players.find((p) => p.id === playerId)?.currentAP ?? 0);

  const [hoveredIdx,   setHoveredIdx]   = useState(null);
  const [selectedIdx,  setSelectedIdx]  = useState(null);  // 포인트&클릭 선택 상태
  const [dragging,     setDragging]     = useState(null);  // { instanceId, startX, startY, curX, curY }
  const [dropZone,     setDropZone]     = useState(null);  // 'enemy'|'ally'|'field'|null

  const containerRef = useRef(null);
  const layout = computeFanLayout(hand.length);

  // ESC로 선택 취소
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelectedIdx(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── 포인트&클릭 ───────────────────────────────────────────────
  const handleCardClick = useCallback((idx) => {
    if (!isMyTurn) return;

    const inst    = hand[idx];
    if (!inst) return;
    const cardDef = getCardById(inst.cardId);
    if (!cardDef) return;

    // AP 부족 → 무시
    if (cardDef.apCost > currentAP) return;

    // 패시브 카드 → 필드 등록
    if (cardDef.category === CARD_CATEGORY.PASSIVE) {
      onRegisterPassive?.(inst.instanceId);
      setSelectedIdx(null);
      return;
    }

    // 타겟 불필요 카드 → 즉시 사용
    if (!needsTarget(cardDef)) {
      onUseCard?.(inst.instanceId, null);
      setSelectedIdx(null);
      return;
    }

    // 타겟 필요 → 선택 상태 토글
    if (selectedIdx === idx) {
      setSelectedIdx(null);
    } else {
      setSelectedIdx(idx);
    }
  }, [hand, isMyTurn, currentAP, selectedIdx, onUseCard, onRegisterPassive]);

  // 타겟 클릭 (선택된 카드 사용)
  const handleTargetClick = useCallback((targetId) => {
    if (selectedIdx === null) return;
    const inst = hand[selectedIdx];
    if (!inst) return;
    onUseCard?.(inst.instanceId, targetId);
    setSelectedIdx(null);
  }, [selectedIdx, hand, onUseCard]);

  // ── 드래그&드롭 ───────────────────────────────────────────────
  const handleMouseDown = useCallback((e, idx) => {
    if (!isMyTurn) return;
    const inst    = hand[idx];
    if (!inst) return;
    const cardDef = getCardById(inst.cardId);
    if (!cardDef || cardDef.apCost > currentAP) return;

    setDragging({
      instanceId: inst.instanceId,
      cardDef,
      idx,
      startX: e.clientX,
      startY: e.clientY,
      curX:   e.clientX,
      curY:   e.clientY,
    });
    e.preventDefault();
  }, [hand, isMyTurn, currentAP]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => {
      setDragging((prev) => prev ? { ...prev, curX: e.clientX, curY: e.clientY } : null);
      // 드롭존 감지 (간단한 영역 기반)
      // 실제 구현에서는 Three.js 씬의 유닛 위치와 비교
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const zone = el?.dataset?.dropzone ?? null;
      setDropZone(zone);
    };

    const onUp = (e) => {
      if (dragging) {
        const el   = document.elementFromPoint(e.clientX, e.clientY);
        const zone = el?.dataset?.dropzone;
        const tid  = el?.dataset?.targetid;

        if (zone === 'enemy' || zone === 'ally') {
          onUseCard?.(dragging.instanceId, tid ?? null);
        } else if (zone === 'field' && dragging.cardDef?.category === CARD_CATEGORY.PASSIVE) {
          onRegisterPassive?.(dragging.instanceId);
        }
        // 그 외는 원위치 (아무 것도 안 함)
      }
      setDragging(null);
      setDropZone(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [dragging, onUseCard, onRegisterPassive]);

  // ── 드래그 중 고스트 카드 스타일 ──────────────────────────────
  const ghostStyle = dragging ? {
    position:  'fixed',
    left:      dragging.curX - CARD_W / 2,
    top:       dragging.curY - CARD_H / 2,
    zIndex:    999,
    opacity:   0.85,
    pointerEvents: 'none',
    transform: 'scale(1.1)',
  } : null;

  // ── 선택된 카드에 대한 타겟 하이라이트 오버레이 ───────────────
  const showTargetOverlay = selectedIdx !== null && targets.length > 0;

  return (
    <>
      {/* 핸드 컨테이너 — 화면 하단 중앙 */}
      <div
        ref={containerRef}
        style={{
          position:       'fixed',
          bottom:         0,
          left:           '50%',
          transform:      'translateX(-50%)',
          width:          700,
          height:         180,
          zIndex:         150,
          pointerEvents:  isMyTurn ? 'auto' : 'none',
        }}
      >
        {hand.map((inst, idx) => {
          const { x, y, rotate } = layout[idx] ?? { x: 0, y: 0, rotate: 0 };
          const cardDef  = getCardById(inst.cardId);
          const disabled = !isMyTurn || (cardDef && cardDef.apCost > currentAP);
          const isDraggingThis = dragging?.instanceId === inst.instanceId;

          return (
            <CardUI
              key={inst.instanceId}
              instance={inst}
              isSelected={selectedIdx === idx}
              isHovered={hoveredIdx === idx}
              isDisabled={disabled}
              offsetX={350 + x}   // 컨테이너 중앙(350px) 기준
              offsetY={y}
              rotate={rotate}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onMouseDown={(e) => handleMouseDown(e, idx)}
              onClick={() => handleCardClick(idx)}
            />
          );
        })}
      </div>

      {/* 드래그 고스트 */}
      {dragging && ghostStyle && (
        <div style={ghostStyle}>
          <CardUI
            instance={{ instanceId: dragging.instanceId, cardId: dragging.cardDef?.id }}
            isHovered={false}
            isSelected={false}
            isDisabled={false}
            offsetX={CARD_W / 2}
            offsetY={0}
            rotate={0}
          />
        </div>
      )}

      {/* 타겟 선택 오버레이 (포인트&클릭) */}
      {showTargetOverlay && (
        <div style={{
          position:    'fixed',
          inset:       0,
          zIndex:      140,
          background:  'rgba(0,0,0,0.2)',
          pointerEvents: 'auto',
        }}
          onClick={() => setSelectedIdx(null)} // 빈 곳 클릭 → 취소
        >
          {targets.map((t) => (
            <button
              key={t.id}
              data-dropzone={t.isEnemy ? 'enemy' : 'ally'}
              data-targetid={t.id}
              onClick={(e) => { e.stopPropagation(); handleTargetClick(t.id); }}
              style={{
                position:     'absolute',
                left:         t.screenX ?? '50%',
                top:          t.screenY ?? '50%',
                transform:    'translate(-50%,-50%)',
                background:   t.isEnemy ? 'rgba(200,48,48,0.6)' : 'rgba(48,160,80,0.6)',
                border:       `2px solid ${t.isEnemy ? '#e06060' : '#60e090'}`,
                borderRadius: 4,
                color:        '#fff',
                fontSize:     11,
                fontFamily:   "'Cinzel', serif",
                padding:      '3px 8px',
                cursor:       'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* 패시브 필드 드롭존 표시 (드래그 중) */}
      {dragging?.cardDef?.category === CARD_CATEGORY.PASSIVE && (
        <div
          data-dropzone="field"
          style={{
            position:    'fixed',
            bottom:      185,
            left:        '50%',
            transform:   'translateX(-50%)',
            width:       160,
            height:      50,
            border:      `2px dashed ${dropZone === 'field' ? '#8040c0' : '#40306080'}`,
            borderRadius: 8,
            background:  dropZone === 'field' ? 'rgba(128,64,192,0.2)' : 'transparent',
            display:     'flex',
            alignItems:  'center',
            justifyContent: 'center',
            color:       '#8040c0',
            fontSize:    11,
            fontFamily:  "'Cinzel', serif",
            pointerEvents: 'none',
            zIndex:      145,
            transition:  'all 0.15s',
          }}
        >
          🔮 패시브 등록
        </div>
      )}
    </>
  );
}