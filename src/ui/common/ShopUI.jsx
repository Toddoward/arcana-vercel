// ============================================================
// src/ui/common/ShopUI.jsx
// 마을 상점 UI
//
// GDD: §21(마을 시스템 — 상점·여관·대장간·퀘스트 수주)
//      §22(경제 시스템 — 티어별 가격)
//      §23(소모품 6종)
//      §24.1~24.4(장비 티어/무기/방어구/악세사리)
//
// props:
//   tab          'shop' | 'inn' | 'forge' | 'quest'  (기본 'shop')
//   onClose      () => void
//
// store 연결:
//   playerStore  — players[0] (리더 기준 골드/인벤토리/장비)
//   gameStore    — questStage (마일스톤 → 상점 티어 결정)
// ============================================================

import React, { useState, useMemo } from 'react';
import { usePlayerStore } from '../../stores/playerStore.js';
import { useGameStore }   from '../../stores/gameStore.js';
import { Modal, Button }  from './Modal.jsx';

// ── 탭 정의 ─────────────────────────────────────────────────
const TABS = [
  { key: 'shop',  label: '⚔️ 상점'  },
  { key: 'inn',   label: '🍺 여관'  },
  { key: 'forge', label: '🔨 대장간' },
  { key: 'quest', label: '📋 의뢰판' },
];

// ── 소모품 재고 (GDD §23, §22.3 가격) ───────────────────────
const CONSUMABLES = [
  { id: 'potion_s',        name: '포션 (소)',       icon: '🧪', price:  20, effect: 'HP 소량 회복',         size: [1,1] },
  { id: 'potion_l',        name: '포션 (대)',       icon: '🧴', price:  50, effect: 'HP 대량 회복',         size: [1,1] },
  { id: 'dp_crystal',      name: 'DP 크리스탈',    icon: '💎', price:  80, effect: 'DP 전량 회복',         size: [1,1] },
  { id: 'antidote',        name: '해독제',          icon: '🌿', price:  30, effect: '상태이상 1개 해제',   size: [1,1] },
  { id: 'revival_scroll',  name: '부활 스크롤',    icon: '📜', price: 200, effect: '사망 플레이어 부활',   size: [1,2] },
  { id: 'teleport_scroll', name: '텔레포트 스크롤',icon: '🌀', price: 150, effect: '월드맵 임의 타일 이동', size: [1,2] },
];

// ── 장비 재고 (마일스톤 tier별) ──────────────────────────────
// tier: 0~1 → T1, 2~3 → T2, 4 → T3
const WEAPONS_BY_TIER = {
  T1: [
    { id: 'iron_sword',  name: '철검',     icon: '⚔️',  slot: 'WEAPON_R', price:  60, desc: 'STR+1 / Fire 속성 카드 +1장' },
    { id: 'iron_shield', name: '철 방패',  icon: '🛡️',  slot: 'WEAPON_L', price:  55, desc: 'DEF+2 / Ice 속성 카드 +1장'  },
    { id: 'dagger',      name: '단검',     icon: '🗡️',  slot: 'WEAPON_R', price:  50, desc: 'DEX+1 / Lightning 카드 +1장' },
    { id: 'staff',       name: '지팡이',   icon: '🪄',  slot: 'WEAPON_R', price:  65, desc: 'INT+1 / Fire 속성 카드 +1장' },
    { id: 'holy_book',   name: '성서',     icon: '📖',  slot: 'WEAPON_L', price:  55, desc: 'WIS+1 / Ice 속성 카드 +1장'  },
    { id: 'lute',        name: '류트',     icon: '🎸',  slot: 'WEAPON_R', price:  55, desc: 'LUK+1 / Lightning 카드 +1장' },
  ],
  T2: [
    { id: 'flame_sword',  name: '화염검',    icon: '🔥',  slot: 'WEAPON_R', price: 180, desc: 'STR+3 / Fire 강화 카드 +2장' },
    { id: 'frost_staff',  name: '서리 지팡이',icon: '❄️', slot: 'WEAPON_R', price: 200, desc: 'INT+3 / Ice 강화 카드 +2장'  },
    { id: 'shadow_blade', name: '그림자 검', icon: '🌑',  slot: 'WEAPON_R', price: 190, desc: 'DEX+3 / Dark 카드 +2장'      },
  ],
  T3: [
    { id: 'dragon_slayer', name: '용살검',   icon: '🐲', slot: 'WEAPON_R', price: 500, desc: 'STR+6 / Fire×Dark 혼합 카드 +3장' },
    { id: 'arcane_staff',  name: '비전 지팡이',icon:'✨', slot: 'WEAPON_R', price: 550, desc: 'INT+6 / 전 속성 카드 +2장씩'       },
  ],
};

const ARMOR_BY_TIER = {
  T1: [
    { id: 'leather_helm',  name: '가죽 투구', icon: '🪖', slot: 'HELM',  price:  45, desc: 'CON+1' },
    { id: 'iron_chest',    name: '철갑 흉갑', icon: '🦺', slot: 'CHEST', price:  70, desc: 'CON+2 / DEF+2' },
    { id: 'cloth_robe',    name: '마법사 로브',icon:'👘', slot: 'CHEST', price:  60, desc: 'INT+1 / magDEF+2' },
  ],
  T2: [
    { id: 'steel_helm',    name: '강철 투구', icon: '⛑️', slot: 'HELM',  price: 160, desc: 'CON+2 / STR+1' },
    { id: 'mage_robe',     name: '현자의 로브',icon:'🧙', slot: 'CHEST', price: 180, desc: 'INT+3 / WIS+2'  },
  ],
};

const ACCESSORIES_BY_TIER = {
  T1: [
    { id: 'str_ring',    name: '힘의 반지',   icon: '💍', slot: 'RING',     price:  80, desc: 'STR+2' },
    { id: 'luk_ring',    name: '행운의 반지', icon: '💍', slot: 'RING',     price:  80, desc: 'LUK+2' },
    { id: 'resist_neck', name: '저항 목걸이', icon: '📿', slot: 'NECKLACE', price:  90, desc: '상태이상 저항+10%' },
    { id: 'ap_cloak',    name: 'AP 망토',     icon: '🧣', slot: 'CLOAK',    price: 100, desc: 'DEX+1 / AP+1' },
  ],
};

// ── 가격표: DP 업그레이드 / 인벤토리 확장 (GDD §21) ─────────
const DP_UPGRADES   = [6, 7, 8];           // 현재 5 → 최대 8
const INV_EXPANSION = [150, 300, 500];     // 단계별 비용

// ============================================================
export function ShopUI({ tab: initTab = 'shop', onClose }) {
  const [activeTab, setActiveTab] = useState(initTab);

  // store
  const players     = usePlayerStore((s) => s.players);
  const questStage  = useGameStore((s) => s.questStage);
  const leader      = players[0];
  const gold        = leader?.gold ?? 0;
  const maxDp       = leader?.maxDp ?? 5;
  const invExpanded = leader?.inventoryExpanded ?? 0; // 확장 횟수

  // 현재 티어 결정 (마일스톤 단계 기반)
  const tier = questStage >= 4 ? 'T3' : questStage >= 2 ? 'T2' : 'T1';

  const shopItems = useMemo(() => [
    ...CONSUMABLES,
    ...(WEAPONS_BY_TIER[tier]     ?? []),
    ...(ARMOR_BY_TIER[tier]       ?? []),
    ...(ACCESSORIES_BY_TIER['T1'] ?? []),
  ], [tier]);

  // ── 구매 처리 ──────────────────────────────────────────
  const [msg, setMsg] = useState('');
  const notify = (text, ok = true) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  };

  const handleBuy = (item) => {
    const ps = usePlayerStore.getState();
    if ((leader?.gold ?? 0) < item.price) {
      notify('골드가 부족합니다.', false); return;
    }
    ps.addGold?.(leader.id, -item.price);
    // 인벤토리에 아이템 추가
    ps.addItem?.(leader.id, { ...item, instanceId: `${item.id}_${Date.now()}` });
    notify(`${item.name} 구매 완료!`);
  };

  const handleDpUpgrade = () => {
    const nextDp  = maxDp + 1;
    if (nextDp > 8) { notify('DP가 이미 최대입니다.', false); return; }
    const cost = 200;
    if (gold < cost) { notify('골드가 부족합니다.', false); return; }
    usePlayerStore.getState().addGold?.(leader.id, -cost);
    usePlayerStore.getState().upgradeDp?.(leader.id);
    notify(`DP 최대치 ${nextDp}으로 증가!`);
  };

  const handleInvExpand = () => {
    const cost = INV_EXPANSION[invExpanded] ?? null;
    if (!cost) { notify('인벤토리가 이미 최대 확장 상태입니다.', false); return; }
    if (gold < cost) { notify('골드가 부족합니다.', false); return; }
    usePlayerStore.getState().addGold?.(leader.id, -cost);
    usePlayerStore.getState().expandInventory?.(leader.id);
    notify('인벤토리 2칸 확장!');
  };

  // ── 여관 처리 ──────────────────────────────────────────
  const INN_COST = 50;
  const handleRest = () => {
    if (gold < INN_COST) {
      // 골드 부족 → 소량 골드 소진 + 턴 스킵
      const actual = Math.min(gold, INN_COST);
      usePlayerStore.getState().addGold?.(leader.id, -actual);
      notify(`골드 부족 — ${actual}G 소진 후 소량 회복.`);
    } else {
      usePlayerStore.getState().addGold?.(leader.id, -INN_COST);
      // HP + DP 전량 회복
      for (const p of usePlayerStore.getState().players) {
        usePlayerStore.getState().healFull?.(p.id);
      }
      notify(`${INN_COST}G 지불 — 파티 체력·DP 완전 회복!`);
    }
  };

  // ── 대장간: 선택 장비 강화 ────────────────────────────
  const [forgeItem, setForgeItem]   = useState(null);
  const [forgeTier, setForgeTier]   = useState(1); // +1 / +2 / +3
  const equippedItems = useMemo(() => {
    if (!leader?.equipment) return [];
    return Object.values(leader.equipment).filter(Boolean);
  }, [leader]);

  const forgeCost = (item, tier) => {
    if (!item) return 0;
    const base = item.price ?? 100;
    return Math.round(base * [0.2, 0.5, 1.0][tier - 1]);
  };

  const handleForge = () => {
    if (!forgeItem) { notify('강화할 장비를 선택하세요.', false); return; }
    const cost = forgeCost(forgeItem, forgeTier);
    if (gold < cost) { notify('골드가 부족합니다.', false); return; }
    usePlayerStore.getState().addGold?.(leader.id, -cost);
    usePlayerStore.getState().upgradeEquipment?.(leader.id, forgeItem.slot, forgeTier);
    notify(`${forgeItem.name} +${forgeTier} 강화 완료!`);
    setForgeItem(null);
  };

  // ============================================================
  return (
    <Modal title="마을" onClose={onClose}>

      {/* 탭 바 */}
      <div style={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            style={{ ...styles.tabBtn, ...(activeTab === t.key ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 골드 표시 */}
      <div style={styles.goldBar}>
        <span style={{ color: '#c9a84c', fontSize: 15 }}>💰 {gold.toLocaleString()} G</span>
        {msg && (
          <span style={{
            fontSize: 13, color: msg.includes('부족') ? '#e05050' : '#60c080',
            marginLeft: 12,
          }}>
            {msg}
          </span>
        )}
      </div>

      {/* ── 상점 탭 ──────────────────────────────────────── */}
      {activeTab === 'shop' && (
        <div>
          {/* DP 업그레이드 */}
          <SubSection title="DP 최대치 업그레이드">
            <div style={styles.upgradeRow}>
              <span style={{ color: '#a090b0', fontSize: 13 }}>
                현재 최대 DP: <b style={{ color: '#c9a84c' }}>{maxDp}</b> / 8
              </span>
              {maxDp < 8 ? (
                <Button variant="secondary" onClick={handleDpUpgrade}>
                  +1 DP — 200G
                </Button>
              ) : (
                <span style={{ color: '#507050', fontSize: 13 }}>최대 달성</span>
              )}
            </div>
          </SubSection>

          {/* 인벤토리 확장 */}
          <SubSection title="인벤토리 확장">
            <div style={styles.upgradeRow}>
              <span style={{ color: '#a090b0', fontSize: 13 }}>
                확장 횟수: <b style={{ color: '#c9a84c' }}>{invExpanded}</b> / 3
              </span>
              {invExpanded < 3 ? (
                <Button variant="secondary" onClick={handleInvExpand}>
                  +2칸 — {INV_EXPANSION[invExpanded]}G
                </Button>
              ) : (
                <span style={{ color: '#507050', fontSize: 13 }}>최대 달성</span>
              )}
            </div>
          </SubSection>

          {/* 아이템 목록 */}
          <SubSection title={`아이템 목록 (${tier})`}>
            <div style={styles.itemGrid}>
              {shopItems.map((item) => (
                <div key={item.id} style={styles.itemCard}>
                  <span style={styles.itemIcon}>{item.icon}</span>
                  <div style={styles.itemInfo}>
                    <span style={styles.itemName}>{item.name}</span>
                    <span style={styles.itemDesc}>{item.desc ?? item.effect}</span>
                  </div>
                  <div style={styles.itemRight}>
                    <span style={styles.itemPrice}>{item.price}G</span>
                    <Button
                      variant={gold >= item.price ? 'primary' : 'secondary'}
                      onClick={() => handleBuy(item)}
                    >
                      구매
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </SubSection>
        </div>
      )}

      {/* ── 여관 탭 ──────────────────────────────────────── */}
      {activeTab === 'inn' && (
        <div style={styles.innBody}>
          <div style={styles.innCard}>
            <span style={{ fontSize: 48 }}>🛏️</span>
            <h3 style={{ color: '#c9a84c', margin: '12px 0 6px' }}>여관에서 휴식</h3>
            <p style={{ color: '#806070', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              {INN_COST}G를 지불하고 파티 전체의 HP와 DP를 완전히 회복합니다.<br />
              골드가 부족하면 가진 골드만큼 소진 후 부분 회복합니다.
            </p>
            <Button variant="primary" onClick={handleRest}>
              휴식 ({INN_COST}G)
            </Button>
          </div>
        </div>
      )}

      {/* ── 대장간 탭 ────────────────────────────────────── */}
      {activeTab === 'forge' && (
        <div>
          <SubSection title="강화할 장비 선택">
            {equippedItems.length === 0 ? (
              <p style={{ color: '#604050', fontSize: 13 }}>장착 중인 장비가 없습니다.</p>
            ) : (
              <div style={styles.itemGrid}>
                {equippedItems.map((item) => (
                  <button
                    key={item.id}
                    style={{
                      ...styles.itemCard,
                      border: forgeItem?.id === item.id
                        ? '1px solid #c9a84c' : '1px solid rgba(200,168,76,0.2)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setForgeItem(item)}
                  >
                    <span style={styles.itemIcon}>{item.icon}</span>
                    <div style={styles.itemInfo}>
                      <span style={styles.itemName}>{item.name}</span>
                      <span style={styles.itemDesc}>{item.slot}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SubSection>

          {forgeItem && (
            <SubSection title="강화 등급 선택">
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {[1, 2, 3].map((t) => (
                  <button
                    key={t}
                    style={{
                      ...styles.tierBtn,
                      ...(forgeTier === t ? styles.tierBtnActive : {}),
                    }}
                    onClick={() => setForgeTier(t)}
                  >
                    +{t}<br />
                    <span style={{ fontSize: 11 }}>{forgeCost(forgeItem, t)}G</span>
                  </button>
                ))}
              </div>
              <div style={{ color: '#806070', fontSize: 12, marginBottom: 12 }}>
                +1: 수치 10% / +2: 25% / +3: 50% + 속성 효과 강화
              </div>
              <Button variant="primary" onClick={handleForge}>
                강화 실행 — {forgeCost(forgeItem, forgeTier)}G
              </Button>
            </SubSection>
          )}
        </div>
      )}

      {/* ── 의뢰판 탭 ────────────────────────────────────── */}
      {activeTab === 'quest' && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#604050' }}>
          <span style={{ fontSize: 40 }}>📋</span>
          <p style={{ marginTop: 12, fontSize: 14 }}>
            퀘스트 시스템은 다음 업데이트에서 활성화됩니다.
          </p>
        </div>
      )}

    </Modal>
  );
}

// ── 보조 컴포넌트 ────────────────────────────────────────────
function SubSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ color: '#c9a84c', fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>
        ▸ {title}
      </p>
      {children}
    </div>
  );
}

// ── 스타일 ───────────────────────────────────────────────────
const styles = {
  tabBar: {
    display: 'flex', borderBottom: '1px solid rgba(200,168,76,0.2)',
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1, background: 'none', border: 'none',
    color: '#705060', fontSize: 13, padding: '10px 4px',
    cursor: 'pointer', borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
  },
  tabBtnActive: {
    color: '#c9a84c', borderBottom: '2px solid #c9a84c',
  },
  goldBar: {
    display: 'flex', alignItems: 'center',
    marginBottom: 16, padding: '8px 4px',
    borderBottom: '1px solid rgba(200,168,76,0.12)',
  },
  upgradeRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '10px 14px',
  },
  itemGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  itemCard: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,168,76,0.15)',
    borderRadius: 8, padding: '10px 14px',
  },
  itemIcon:  { fontSize: 24, flexShrink: 0 },
  itemInfo:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  itemName:  { color: '#e8dfc8', fontSize: 14, fontWeight: 600 },
  itemDesc:  { color: '#806070', fontSize: 12 },
  itemRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  itemPrice: { color: '#c9a84c', fontSize: 13, fontWeight: 700 },
  innBody: {
    display: 'flex', justifyContent: 'center', padding: '24px 0',
  },
  innCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,168,76,0.2)',
    borderRadius: 12, padding: '28px 40px',
  },
  tierBtn: {
    flex: 1, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(200,168,76,0.2)',
    borderRadius: 6, padding: '10px 4px',
    color: '#a090b0', cursor: 'pointer', textAlign: 'center', fontSize: 14,
    lineHeight: 1.6,
  },
  tierBtnActive: {
    background: 'rgba(200,168,76,0.15)',
    border: '1px solid rgba(200,168,76,0.55)',
    color: '#e8dfc8',
  },
};
