'use client';

import { useState } from 'react';
import { useStore, type Screen } from '@/lib/store';
import { useIsMobile } from '@/lib/hooks';
import { Today } from './Today';
import { CoachRail } from './CoachRail';
import { SlideOver } from './SlideOver';
import { Trends } from './Trends';
import { Foods } from './Foods';
import { Settings } from './Settings';

const NAV_ITEMS: Array<{ id: Screen; label: string }> = [
  { id: 'today',    label: 'Today'    },
  { id: 'trends',   label: 'Trends'   },
  { id: 'foods',    label: 'Foods'    },
  { id: 'settings', label: 'Settings' },
];

const MOBILE_TOP_H = 52; // px — height of the mobile top bar

export function AppShell() {
  const screen     = useStore(s => s.screen);
  const setScreen  = useStore(s => s.setScreen);
  const profile    = useStore(s => s.profile);
  const activeGoal = useStore(s => s.activeGoal);
  const isMobile   = useIsMobile();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  // null = use default for current breakpoint; true/false = user override
  const [leftOpen,  setLeftOpen]  = useState<boolean | null>(null);
  const [rightOpen, setRightOpen] = useState<boolean | null>(null);

  // Panels are open by default on desktop, closed on mobile
  const showLeft  = leftOpen  ?? !isMobile;
  const showRight = rightOpen ?? !isMobile;

  const g   = activeGoal();
  const fmt = (n: number) => Math.round(n).toLocaleString();

  function navigate(id: Screen) {
    setScreen(id);
    setSelectedId(null);
    if (isMobile) setLeftOpen(false); // close nav after picking a screen on mobile
  }

  const scrim = (onClick: () => void) => (
    <div
      onClick={onClick}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(33,30,26,.32)',
        zIndex: 48,
      }}
    />
  );

  // ── Sidebar content (shared between desktop inline and mobile overlay) ────────
  const sidebarContent = (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '22px 16px',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 22px' }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, background: '#3f9d5f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0,
        }}>T</div>
        <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>Tempo</div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ id, label }) => (
          <NavItem key={id} label={label} active={screen === id} onClick={() => navigate(id)} />
        ))}
      </nav>

      {/* User chip */}
      <div style={{
        marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 11,
        padding: 10, borderRadius: 12, background: '#f7f4ef',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: '#e0ddd5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, color: '#6b655c', fontSize: 14, flexShrink: 0,
        }}>
          {(profile.name || 'F').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.name}</div>
          <div style={{ fontSize: 12, color: '#8a8478' }}>
            {g.title} · {fmt(g.target)} kcal
          </div>
        </div>
      </div>
    </div>
  );

  // ── Desktop layout ────────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100%', background: '#f7f4ef', overflow: 'hidden' }}>

        {/* Left sidebar */}
        {showLeft && (
          <div style={{
            width: 222, flexShrink: 0, background: '#fff',
            borderRight: '1px solid #ece6dc', position: 'relative',
          }}>
            {sidebarContent}
            {/* Collapse chevron */}
            <button
              onClick={() => setLeftOpen(false)}
              title="Hide navigation"
              style={{
                position: 'absolute', top: '50%', right: -13, transform: 'translateY(-50%)',
                width: 26, height: 26, borderRadius: '50%',
                background: '#fff', border: '1px solid #ece6dc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10, padding: 0,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8a8478" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>
        )}

        {/* Left expand tab (when sidebar hidden) */}
        {!showLeft && (
          <button
            onClick={() => setLeftOpen(true)}
            title="Show navigation"
            style={{
              width: 24, flexShrink: 0, background: '#fff',
              borderRight: '1px solid #ece6dc', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8a8478" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Main content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {screen === 'today' && <Today onSelectEntry={setSelectedId} onOpenCoach={() => setRightOpen(true)} />}
          {screen === 'trends'   && <Trends />}
          {screen === 'foods'    && <Foods onSelectEntry={setSelectedId} />}
          {screen === 'settings' && <Settings />}
        </div>

        {/* Right expand tab (when coach hidden) */}
        {!showRight && (
          <button
            onClick={() => setRightOpen(true)}
            title="Show coach"
            style={{
              width: 24, flexShrink: 0, background: '#fff',
              borderLeft: '1px solid #ece6dc', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8a8478" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* CoachRail */}
        {showRight && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <CoachRail onClose={() => setRightOpen(false)} />
          </div>
        )}

        <SlideOver selectedId={selectedId} onClose={() => setSelectedId(null)} />
      </div>
    );
  }

  // ── Mobile layout ─────────────────────────────────────────────────────────────
  // Use position:fixed for both top bar and main content — same pattern as the
  // CoachRail overlay — because it gives a rock-solid height contract (explicit
  // top/bottom) that works regardless of dvh support or flex height chain quirks.
  return (
    <div style={{ background: '#f7f4ef' }}>

      {/* Mobile top bar — fixed at top */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20,
        height: MOBILE_TOP_H,
        background: '#fff', borderBottom: '1px solid #ece6dc',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
      }}>
        {/* Hamburger — open nav */}
        <button
          onClick={() => setLeftOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3a3530" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="6"  x2="21" y2="6"  />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8, background: '#3f9d5f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 14,
          }}>T</div>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>Tempo</span>
        </div>

        {/* Coach toggle */}
        <button
          onClick={() => setRightOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', position: 'relative' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3a3530" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {/* Green dot — always on indicator */}
          <span style={{
            position: 'absolute', top: 5, right: 5,
            width: 7, height: 7, borderRadius: '50%',
            background: '#3f9d5f', border: '1.5px solid #fff',
          }} />
        </button>
      </div>

      {/* Main content — fixed below top bar, this IS the scroll container.
          position:fixed with top+bottom gives an explicit height without relying
          on dvh units or flex chain propagation. */}
      <div style={{
        position: 'fixed', top: MOBILE_TOP_H, left: 0, right: 0, bottom: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: '#f7f4ef',
      }}>
        {screen === 'today'    && <Today onSelectEntry={setSelectedId} onOpenCoach={() => setRightOpen(true)} />}
        {screen === 'trends'   && <Trends />}
        {screen === 'foods'    && <Foods onSelectEntry={setSelectedId} />}
        {screen === 'settings' && <Settings />}
      </div>

      {/* Left nav overlay */}
      {showLeft && (
        <>
          {scrim(() => setLeftOpen(false))}
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: 260,
            background: '#fff', zIndex: 49,
            animation: 'tslideleft .22s ease',
            boxShadow: '4px 0 24px rgba(0,0,0,.14)',
          }}>
            {/* Close button */}
            <button
              onClick={() => setLeftOpen(false)}
              style={{
                position: 'absolute', top: 14, right: 14,
                background: '#f3efe8', border: 'none', borderRadius: 8,
                width: 32, height: 32, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b655c" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18"/>
              </svg>
            </button>
            {sidebarContent}
          </div>
        </>
      )}

      {/* Right coach overlay */}
      {showRight && (
        <>
          {scrim(() => setRightOpen(false))}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(360px, 92vw)',
            zIndex: 49,
            animation: 'tslideright .22s ease',
            boxShadow: '-4px 0 24px rgba(0,0,0,.14)',
          }}>
            <CoachRail onClose={() => setRightOpen(false)} />
          </div>
        </>
      )}

      <SlideOver selectedId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

// ─── Desktop nav item ─────────────────────────────────────────────────────────

function NavItem({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  const bg    = active ? '#e8f3ec' : hovered ? '#f7f4ef' : 'transparent';
  const color = active ? '#256b3f' : '#6b655c';
  const dot   = active ? '#3f9d5f' : '#d8d1c6';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
        fontSize: 14.5, fontWeight: active ? 600 : 500,
        background: bg, color,
        transition: 'background .12s',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: dot, flexShrink: 0, display: 'inline-block',
      }} />
      {label}
    </div>
  );
}
