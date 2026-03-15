// ============================================================
// src/ui/theme.js
// Arcana 디자인 시스템 — ui_prototype.html 기반 공통 토큰
//
// 사용법:
//   import { C, F, CLIP, BG, btns, inputs, T } from '../theme.js';
//   style={{ background: C.abyss, fontFamily: F.body }}
// ============================================================

// ── 색상 팔레트 ──────────────────────────────────────────────
export const C = {
  void:        '#07070a',
  abyss:       '#0d0c12',
  deep:        '#131118',
  surface:     '#1c1922',
  raised:      '#252230',
  border:      '#2e2a3a',
  muted:       '#4a4560',
  dim:         '#6b6480',
  text:        '#c8c0d8',
  light:       '#e8e0f0',
  bright:      '#f5f0ff',
  gold:        '#c9a84c',
  goldDim:     '#8a6f2e',
  goldBright:  '#f0cc6a',
  goldGlow:    'rgba(201,168,76,0.15)',
  goldGlow2:   'rgba(201,168,76,0.08)',
  crimson:     '#8b1a2e',
  crimsonDim:  '#5a1020',
  ruby:        '#c0392b',
  arcane:      '#6a3fa0',
  arcaneDim:   '#3d2060',
  silver:      '#9090a8',
  green:       '#50c060',
  greenDim:    '#306040',
};

// ── 폰트 ────────────────────────────────────────────────────
export const F = {
  title:  "'Cinzel Decorative', 'Cinzel', serif",
  ui:     "'Cinzel', serif",
  body:   "'EB Garamond', Georgia, serif",
};

// Google Fonts URL (index.html <head>에 추가 필요)
export const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap';

// ── clip-path 잘린 모서리 (크기별) ─────────────────────────
export const CLIP = {
  sm:  'polygon(0 0, calc(100% - 8px) 0,  100% 8px,  100% 100%, 8px  100%, 0 calc(100% - 8px))',
  md:  'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
  lg:  'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
};

// ── 배경 레이어 스타일 (position:fixed, inset:0, z-index:0) ─
export const BG = {
  // 메인 그라디언트 배경
  gradient: [
    'radial-gradient(ellipse 80% 60% at 50% 0%,  rgba(60,30,80,0.35) 0%, transparent 70%)',
    'radial-gradient(ellipse 40% 40% at 20% 80%, rgba(90,20,30,0.2)  0%, transparent 60%)',
    'radial-gradient(ellipse 30% 50% at 80% 20%, rgba(40,20,80,0.2)  0%, transparent 60%)',
    C.void,
  ].join(', '),

  // fractalNoise 텍스처 SVG (data URI)
  noise: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
};

// ── 코너 오너먼트 SVG paths ──────────────────────────────────
export const CORNER_SVG = `
<path d="M0 0 L120 0 L0 120 Z" fill="rgba(201,168,76,0.05)"/>
<path d="M0 0 L60 0 L0 60" stroke="rgba(201,168,76,0.3)" stroke-width="1" fill="none"/>
<path d="M8 0 L8 80 M0 8 L80 8" stroke="rgba(201,168,76,0.15)" stroke-width="0.5"/>
`;

// 코너 오너먼트 컴포넌트용 위치 스타일
export const cornerStyle = (pos) => {
  const base = { position:'fixed', width:120, height:120, opacity:0.18, pointerEvents:'none', zIndex:1 };
  const map = {
    tl: { top:0, left:0 },
    tr: { top:0, right:0, transform:'scaleX(-1)' },
    bl: { bottom:0, left:0, transform:'scaleY(-1)' },
    br: { bottom:0, right:0, transform:'scale(-1,-1)' },
  };
  return { ...base, ...map[pos] };
};

// ── 공통 컴포넌트 스타일 객체 ────────────────────────────────

// rune-input
export const runeInput = (overrides = {}) => ({
  width:       '100%',
  padding:     '11px 16px',
  background:  C.abyss,
  border:      `1px solid ${C.border}`,
  borderBottom:`1px solid ${C.muted}`,
  color:       C.light,
  fontFamily:  F.body,
  fontSize:    16,
  outline:     'none',
  clipPath:    CLIP.sm,
  boxSizing:   'border-box',
  transition:  'border-color 0.2s, box-shadow 0.2s',
  ...overrides,
});

// rune-btn base (variant: 'default' | 'primary' | 'ghost' | 'danger')
export const runeBtn = (variant = 'default', overrides = {}) => {
  const base = {
    padding:     '12px 20px',
    background:  `linear-gradient(180deg, ${C.raised} 0%, ${C.surface} 100%)`,
    border:      `1px solid ${C.border}`,
    color:       C.gold,
    fontFamily:  F.ui,
    fontSize:    11,
    fontWeight:  600,
    letterSpacing:'0.15em',
    textTransform:'uppercase',
    cursor:      'pointer',
    transition:  'all 0.2s',
    whiteSpace:  'nowrap',
    clipPath:    CLIP.sm,
    display:     'inline-flex',
    alignItems:  'center',
    justifyContent:'center',
    gap:         6,
  };
  const variants = {
    default: {},
    primary: {
      background:   `linear-gradient(180deg, #3a2a08 0%, #1e1604 100%)`,
      borderColor:  C.goldDim,
      color:        C.goldBright,
      padding:      '14px 32px',
      fontSize:     12,
    },
    ghost: {
      background:   'transparent',
      borderColor:  C.muted,
      color:        C.dim,
    },
    danger: {
      borderColor:  C.ruby,
      color:        '#ff8080',
    },
    disabled: {
      background:   C.deep,
      borderColor:  C.border,
      color:        C.muted,
      cursor:       'not-allowed',
      opacity:      0.5,
    },
  };
  return { ...base, ...(variants[variant] ?? {}), ...overrides };
};

// section-header (제목 + 그라디언트 구분선)
export const sectionHeader = {
  wrapper: { display:'flex', alignItems:'center', gap:16, marginBottom:4 },
  title: {
    fontFamily:    F.ui,
    fontSize:      11,
    letterSpacing: '0.35em',
    color:         C.goldDim,
    textTransform: 'uppercase',
    whiteSpace:    'nowrap',
  },
  line: {
    flex:       1,
    height:     1,
    background: `linear-gradient(90deg, ${C.border}, transparent)`,
  },
};

// panel-layout (좌 nav 260px + 우 content)
export const panelLayout = {
  wrapper: {
    display:    'grid',
    gridTemplateColumns: '260px 1fr',
    width:      '100%',
    minHeight:  '70vh',
    border:     `1px solid ${C.border}`,
    background: C.abyss,
    position:   'relative',
  },
  divider: {
    position:   'absolute',
    left:       260, top:0, bottom:0,
    width:      1,
    background: `linear-gradient(180deg, transparent, ${C.border} 20%, ${C.border} 80%, transparent)`,
  },
  nav: { padding:0, display:'flex', flexDirection:'column' },
  content: { padding:32, display:'flex', flexDirection:'column', gap:24 },
};

// card (일반 패널 박스)
export const card = (overrides = {}) => ({
  background:   C.deep,
  border:       `1px solid ${C.border}`,
  clipPath:     CLIP.md,
  padding:      '20px 24px',
  ...overrides,
});

// slot-badge (HOST / READY)
export const slotBadge = (type) => ({
  fontFamily:    F.ui,
  fontSize:      8,
  letterSpacing: '0.3em',
  padding:       '2px 6px',
  border:        '1px solid',
  textTransform: 'uppercase',
  color:         type === 'host' ? C.gold    : C.green,
  borderColor:   type === 'host' ? C.goldDim : C.greenDim,
});

// ── 타이포그래피 헬퍼 ────────────────────────────────────────
export const T = {
  eyebrow: { fontFamily:F.ui, fontSize:11, letterSpacing:'0.5em', color:C.goldDim, textTransform:'uppercase' },
  heading: { fontFamily:F.title, fontWeight:700, color:C.gold, letterSpacing:'0.05em' },
  label:   { fontFamily:F.ui, fontSize:10, letterSpacing:'0.4em', color:C.goldDim, textTransform:'uppercase' },
  body:    { fontFamily:F.body, fontSize:14, color:C.text },
  italic:  { fontFamily:F.body, fontStyle:'italic', color:C.dim },
  code:    { fontFamily:F.ui, fontSize:28, fontWeight:700, color:C.gold, letterSpacing:'0.4em',
             textShadow:`0 0 20px rgba(201,168,76,0.3)` },
};
