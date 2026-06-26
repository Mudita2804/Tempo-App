'use client';

import { useState } from 'react';
import { useStore, type Screen } from '@/lib/store';
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

export function AppShell() {
  const screen     = useStore(s => s.screen);
  const setScreen  = useStore(s => s.setScreen);
  const profile    = useStore(s => s.profile);
  const activeGoal = useStore(s => s.activeGoal);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const g   = activeGoal();
  const fmt = (n: number) => Math.round(n).toLocaleString();

  function navigate(id: Screen) {
    setScreen(id);
    setSelectedId(null);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: '#f7f4ef', overflow: 'hidden' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
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
          {NAV_ITEMS.map(({ id, label }) => {
            const active = screen === id;
            return (
              <NavItem key={id} label={label} active={active} onClick={() => navigate(id)} />
            );
          })}
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

      {/* ── Main content area ────────────────────────────────────────────────── */}
      {screen === 'today' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Today onSelectEntry={setSelectedId} />
          <CoachRail />
        </div>
      )}
      {screen === 'trends'   && <Trends />}
      {screen === 'foods'    && <Foods onSelectEntry={setSelectedId} />}
      {screen === 'settings' && <Settings />}

      {/* ── Slide-over ───────────────────────────────────────────────────────── */}
      <SlideOver selectedId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

// ─── Nav item with hover state ────────────────────────────────────────────────

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

