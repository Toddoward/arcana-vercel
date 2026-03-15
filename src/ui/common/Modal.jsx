// ============================================================
// src/ui/common/Modal.jsx
// 공용 모달 + Button — ui_prototype.html rune-btn 스타일 기반
// GDD §4.2 (클립코너 다이아몬드 컷 패널, 골드 강조)
// ============================================================

import { C, F, CLIP, T } from '../theme.js';

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ title, children, onClose, width = 480 }) {
  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     'rgba(0,0,0,0.78)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         500,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{
        width,
        background: `linear-gradient(160deg, ${C.deep} 80%, ${C.abyss} 100%)`,
        border:     `1px solid ${C.border}`,
        clipPath:   CLIP.md,
        boxShadow:  `0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px ${C.goldGlow2}`,
        overflow:   'hidden',
        fontFamily: F.ui,
      }}>
        {/* 헤더 */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          borderBottom:   `1px solid ${C.border}`,
          padding:        '13px 20px',
          background:     C.goldGlow2,
        }}>
          <span style={{ ...T.label, marginBottom: 0, fontSize: 12, letterSpacing: '0.25em' }}>
            {title}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none',
                color:      C.muted, fontSize: 16,
                cursor:     'pointer', lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = C.text}
              onMouseLeave={(e) => e.currentTarget.style.color = C.muted}
            >
              ✕
            </button>
          )}
        </div>

        {/* 본문 */}
        <div style={{ padding: '18px 20px', color: C.text, fontSize: 13, fontFamily: F.body }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────
// variant: 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({ children, onClick, variant = 'secondary', disabled = false, style = {} }) {

  const base = {
    padding:        '11px 22px',
    fontFamily:     F.ui,
    fontSize:       11,
    fontWeight:     600,
    letterSpacing:  '0.15em',
    textTransform:  'uppercase',
    cursor:         disabled ? 'not-allowed' : 'pointer',
    transition:     'all 0.2s',
    whiteSpace:     'nowrap',
    clipPath:       CLIP.sm,
    border:         `1px solid ${C.border}`,
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    opacity:        disabled ? 0.45 : 1,
    pointerEvents:  disabled ? 'none' : 'auto',
  };

  const variants = {
    primary: {
      background:  `linear-gradient(180deg, #3a2a08 0%, #1e1604 100%)`,
      borderColor: C.goldDim,
      color:       C.goldBright,
      padding:     '13px 32px',
      fontSize:    12,
    },
    secondary: {
      background:  `linear-gradient(180deg, ${C.raised} 0%, ${C.surface} 100%)`,
      borderColor: C.border,
      color:       C.gold,
    },
    ghost: {
      background:  'transparent',
      borderColor: C.muted,
      color:       C.dim,
    },
    danger: {
      background:  `linear-gradient(180deg, ${C.crimsonDim} 0%, ${C.abyss} 100%)`,
      borderColor: C.ruby,
      color:       '#ff8080',
    },
  };

  const merged = { ...base, ...(variants[variant] ?? variants.secondary), ...style };

  const handleEnter = (e) => {
    if (disabled) return;
    const el = e.currentTarget;
    if (variant === 'primary') {
      el.style.background = 'linear-gradient(180deg, #4a360c 0%, #2a1e06 100%)';
      el.style.borderColor = C.gold;
      el.style.boxShadow  = `0 0 24px rgba(201,168,76,0.3)`;
      el.style.transform  = 'translateY(-1px)';
    } else if (variant === 'ghost') {
      el.style.borderColor = C.text;
      el.style.color       = C.text;
    } else if (variant === 'danger') {
      el.style.boxShadow = `0 0 12px rgba(192,57,43,0.4)`;
    } else {
      el.style.borderColor = C.goldDim;
      el.style.color       = C.goldBright;
      el.style.boxShadow   = `0 0 12px rgba(201,168,76,0.2)`;
    }
  };

  const handleLeave = (e) => {
    const el = e.currentTarget;
    el.style.background  = merged.background ?? '';
    el.style.borderColor = merged.borderColor ?? C.border;
    el.style.color       = merged.color ?? C.gold;
    el.style.boxShadow   = '';
    el.style.transform   = '';
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={merged}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
    </button>
  );
}
