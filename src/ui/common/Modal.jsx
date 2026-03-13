// ============================================================
// src/ui/common/Modal.jsx
// 공용 모달 — 다크 판타지 클립-코너 패널 스타일
//
// GDD: §4.2(디자인 방향 — 클립코너 다이아몬드 컷 패널, 골드 강조)
// ============================================================

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ title, children, onClose, width = 480 }) {
  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      background: 'rgba(0,0,0,0.72)',
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex:     500,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{
        width,
        background:  'linear-gradient(160deg, #0e1018 80%, #0a0c14 100%)',
        border:      '1px solid #3a4060',
        borderRadius: 6,
        boxShadow:   '0 16px 48px #000e, 0 0 0 1px #c8a04022',
        overflow:    'hidden',
        fontFamily:  "'Cinzel', serif",
      }}>
        {/* 헤더 */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          borderBottom:   '1px solid #2a3040',
          padding:        '12px 18px',
          background:     'rgba(200,160,64,0.06)',
        }}>
          <span style={{ color: '#c8a040', fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>
            {title}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border:     'none',
                color:      '#607080',
                fontSize:   18,
                cursor:     'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 본문 */}
        <div style={{ padding: '16px 18px', color: '#c0c8d0', fontSize: 13 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────
// variant: 'primary' | 'secondary' | 'danger'
export function Button({ children, onClick, variant = 'secondary', disabled = false, style = {} }) {
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #3a2a10, #6a4a20)',
      border:     '1px solid #c8a040',
      color:      '#e8d080',
    },
    secondary: {
      background: 'rgba(20,28,40,0.9)',
      border:     '1px solid #3a4860',
      color:      '#a0b8c8',
    },
    danger: {
      background: 'rgba(40,10,10,0.9)',
      border:     '1px solid #c03030',
      color:      '#e08080',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant],
        borderRadius: 4,
        padding:      '8px 20px',
        fontSize:     12,
        fontFamily:   "'Cinzel', serif",
        fontWeight:   700,
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.45 : 1,
        letterSpacing: 0.5,
        transition:   'opacity 0.15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}