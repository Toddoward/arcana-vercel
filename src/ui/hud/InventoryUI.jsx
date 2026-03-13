// ============================================================
// src/ui/hud/InventoryUI.jsx
// 2D 그리드 인벤토리 — 아이템 배치 / 장비 슬롯 / 소모품 사용
//
// GDD: §7.1(2D 그리드 10×6, 확장 150G/300G/500G 2칸씩)
//      §7.2(아이템 크기 소/중/대/초대형) §7.3(소모품)
//      §9.4(전투 중 장비 교체)
//
// 의존:
//   Modal.jsx       — Modal 래퍼
//   playerStore.js  — inventory, equipment, gold
//   DeckBuilder.js  — equipSwap (전투 중 장비 교체)
// ============================================================

import { useState } from 'react';
import { Modal, Button } from '../common/Modal.jsx';
import { usePlayerStore } from '../../stores/playerStore.js';

// 셀 크기 (px)
const CELL = 44;
// 초기 그리드 크기 (GDD §7.1: 10×6)
const BASE_COLS = 10;
const BASE_ROWS = 6;

// 아이템 크기 → 점유 칸 수 (GDD §7.2)
const ITEM_SIZE_COLS = { small: 1, medium: 2, large: 2, xlarge: 3 };
const ITEM_SIZE_ROWS = { small: 1, medium: 2, large: 3, xlarge: 3 };

// 장비 슬롯 목록 (우측 장비창용)
const EQUIP_SLOTS = [
  { key: 'HELM',      label: '머리'   },
  { key: 'CHEST',     label: '상의'   },
  { key: 'PANTS',     label: '바지'   },
  { key: 'BOOTS',     label: '신발'   },
  { key: 'GLOVES',    label: '장갑'   },
  { key: 'WEAPON_R',  label: '오른손' },
  { key: 'WEAPON_L',  label: '왼손'   },
  { key: 'RING',      label: '반지'   },
  { key: 'NECKLACE',  label: '목걸이' },
  { key: 'CLOAK',     label: '망토'   },
];

// ── 그리드 셀 ─────────────────────────────────────────────────
function GridCell({ item, isOccupied, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width:        CELL,
        height:       CELL,
        border:       '1px solid #1e2838',
        background:   isOccupied ? 'rgba(40,56,80,0.4)' : 'rgba(10,14,22,0.6)',
        borderRadius: 2,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        cursor:       item ? 'pointer' : 'default',
        fontSize:     18,
        position:     'relative',
        boxSizing:    'border-box',
      }}
    >
      {item?.icon ?? ''}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export function InventoryUI({ playerId, inBattle = false, onClose }) {
  const player = usePlayerStore((s) => s.players.find((p) => p.id === playerId));
  const [selectedItem, setSelectedItem] = useState(null);
  const [tooltip,      setTooltip]      = useState(null);

  if (!player) return null;

  const inventory  = player.inventory  ?? [];
  const equipment  = player.equipment  ?? {};
  const expansion  = player.invExpansion ?? 0;  // 0/1/2/3 단계
  const cols       = BASE_COLS;
  const rows       = BASE_ROWS + expansion * 2;
  const totalCells = cols * rows;

  // 그리드 셀 배열 구성 (아이템 → 점유 셀 마킹)
  const grid = Array(totalCells).fill(null);
  for (const item of inventory) {
    if (item.gridPos == null) continue;
    const { x, y } = item.gridPos;
    const itemCols = ITEM_SIZE_COLS[item.size] ?? 1;
    const itemRows = ITEM_SIZE_ROWS[item.size] ?? 1;
    for (let dy = 0; dy < itemRows; dy++) {
      for (let dx = 0; dx < itemCols; dx++) {
        const idx = (y + dy) * cols + (x + dx);
        if (idx < totalCells) grid[idx] = { ...item, isOrigin: dy === 0 && dx === 0 };
      }
    }
  }

  return (
    <Modal title="인벤토리" onClose={onClose} width={760}>
      <div style={{ display: 'flex', gap: 16 }}>

        {/* ── 좌측: 그리드 ───────────────────────────── */}
        <div>
          <div style={{
            display:             'grid',
            gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
            gap:                 2,
          }}>
            {grid.map((item, idx) => (
              <GridCell
                key={idx}
                item={item?.isOrigin ? item : null}
                isOccupied={!!item}
                onClick={() => item?.isOrigin && setSelectedItem(item)}
              />
            ))}
          </div>

          {/* 골드 표시 */}
          <div style={{ marginTop: 10, color: '#c8a040', fontSize: 12, fontFamily: "'Cinzel', serif" }}>
            💰 {player.gold ?? 0} G
          </div>
        </div>

        {/* ── 우측: 장비 슬롯 + 선택 아이템 정보 ────── */}
        <div style={{ minWidth: 160 }}>
          <div style={{ color: '#c8a040', fontSize: 11, marginBottom: 8, fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>
            EQUIPMENT
          </div>
          {EQUIP_SLOTS.map(({ key, label }) => {
            const equipped = equipment[key];
            return (
              <div
                key={key}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          6,
                  marginBottom: 4,
                  background:   'rgba(20,28,40,0.6)',
                  border:       '1px solid #2a3848',
                  borderRadius: 3,
                  padding:      '4px 8px',
                  cursor:       equipped ? 'pointer' : 'default',
                }}
                onClick={() => equipped && setSelectedItem(equipped)}
              >
                <span style={{ color: '#607080', fontSize: 10, minWidth: 36, fontFamily: "'Cinzel', serif" }}>
                  {label}
                </span>
                <span style={{ color: equipped ? '#c0c8d0' : '#303848', fontSize: 11 }}>
                  {equipped?.icon ?? ''} {equipped?.name ?? '—'}
                </span>
              </div>
            );
          })}

          {/* 선택 아이템 정보 */}
          {selectedItem && (
            <div style={{
              marginTop:    12,
              background:   'rgba(10,14,22,0.8)',
              border:       '1px solid #3a4060',
              borderRadius: 4,
              padding:      '10px 12px',
            }}>
              <div style={{ color: '#c8a040', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                {selectedItem.icon} {selectedItem.name}
              </div>
              <div style={{ color: '#8090a0', fontSize: 10, marginBottom: 6, lineHeight: 1.5 }}>
                {selectedItem.description ?? ''}
              </div>

              {/* 소모품 사용 버튼 (GDD §7.3) */}
              {selectedItem.type === 'consumable' && (
                <Button
                  variant="primary"
                  style={{ width: '100%', marginBottom: 4 }}
                  onClick={() => {
                    // playerStore.useConsumable(playerId, selectedItem.id)
                    setSelectedItem(null);
                  }}
                >
                  사용
                </Button>
              )}

              {/* 장비 착용 / 전투 중 교체 */}
              {selectedItem.equipSlot && (
                <Button
                  variant="secondary"
                  style={{ width: '100%' }}
                  onClick={() => {
                    // inBattle → DeckBuilder.equipSwap 호출
                    // else → playerStore.equip(playerId, selectedItem.id)
                    setSelectedItem(null);
                  }}
                >
                  {inBattle ? '교체 (AP 소모)' : '착용'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
