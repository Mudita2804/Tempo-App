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

type MobileTab = Screen | 'coach';

const MOBILE_NAV: Array<{ id: MobileTab; label: string; icon: React.ReactNode }> = [
  {
    id: 'today', label: 'Today',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'trends', label: 'Trends',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'coach', label: 'Coach',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'foods', label: 'Foods',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    ),
  },
  {
    id: 'settings', label: 'Settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

export function AppShell() {
  const screen     = useStore(s => s.screen);
  const setScreen  = useStore(s => s.setScreen);
  const profile    = useStore(s => s.profile);
  const activeGoal = useStore(s => s.activeGoal);
  const isMobile   = useIsMobile();

  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [mobileTab,   setMobileTab]   = useState<MobileTab>('today');

  const g   = activeGoal();
  const fmt = (n: number) => Math.round(n).toLocaleString();

  function navigate(id: Screen) {
    setScreen(id);
    setSelectedId(null);
  }

  function navigateMobile(tab: MobileTab) {
    setMobileTab(tab);
    if (tab !== 'coach') {
      setScreen(tab as Screen);
    }
    setSelectedId(null);
  }

  // ── Mobile layout ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', background: '#f7f4ef', overflow: 'hidden' }}>

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {mobileTab === 'coach' ? (
            <CoachRail />
          ) : screen === 'today' ? (
            <Today onSelectEntry={setSelectedId} />
          ) : screen === 'trends' ? (
            <Trends />
          ) : screen === 'foods' ? (
            <Foods onSelectEntry={setSelectedId} />
          ) : screen === 'settings' ? (
            <Settings />
          ) : null}
        </div>

        {/* Bottom nav */}
        <div style={{
          display: 'flex', background: '#fff',
          borderTop: '1px solid #ece6dc',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          flexShrink: 0,
        }}>
          {MOBILE_NAV.map(({ id, label, icon }) => {
            const active = mobileTab === id;
            return (
              <button
                key={id}
                onClick={() => navigateMobile(id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 3, padding: '10px 4px', border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  color: active ? '#3f9d5f' : '#aaa297',
                  fontFamily: 'inherit',
                }}
              >
                {icon}
                <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, letterSpacing: '0.02em' }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Slide-over */}
        <SlideOver selectedId={selectedId} onClose={() => setSelectedId(null)} />
      </div>
    );
  }

  // ── Desktop layout ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: '#f7f4ef', overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{
        width: 222, flexShrink: 0, background: '#fff',
        borderRight: '1px solid #ece6dc', display: 'flex', flexDirection: 'column',
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

      {/* Main content */}
      {screen === 'today' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Today onSelectEntry={setSelectedId} />
          <CoachRail />
        </div>
      )}
      {screen === 'trends'   && <Trends />}
      {screen === 'foods'    && <Foods onSelectEntry={setSelectedId} />}
      {screen === 'settings' && <Settings />}

      {/* Slide-over */}
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
