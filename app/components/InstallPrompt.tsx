'use client';

import { useEffect, useRef, useState } from 'react';

const DISMISS_KEY = 'tempo-install-dismissed-at';
const DISMISS_DAYS = 30;

/* Chrome fires this before showing its mini-infobar; not in TS lib.dom */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<'hidden' | 'android' | 'ios'>('hidden');

  useEffect(() => {
    // Already running as an installed app — never show.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 3600 * 1000) return;

    // iOS Safari has no install event — show manual instructions.
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setMode('ios');
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setMode('android');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (mode === 'hidden') return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setMode('hidden');
  };

  const install = async () => {
    const ev = deferredRef.current;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice; // accepted or not, don't nag again this cycle
    dismiss();
  };

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 40,
      background: '#fff', border: '1px solid #ece6dc', borderRadius: 14,
      boxShadow: '0 6px 24px rgba(0,0,0,.12)',
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, background: '#3f9d5f', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: 19,
      }}>T</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#211e1a' }}>
          Add Tempo to your home screen
        </div>
        <div style={{ fontSize: 12.5, color: '#8a8478', lineHeight: 1.4 }}>
          {mode === 'ios'
            ? 'Tap the Share button, then "Add to Home Screen".'
            : 'Log meals in one tap — no browser needed.'}
        </div>
      </div>

      {mode === 'android' && (
        <button
          onClick={install}
          style={{
            background: '#3f9d5f', color: '#fff', border: 'none',
            borderRadius: 9, padding: '9px 14px', flexShrink: 0,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Install
        </button>
      )}

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: '#f3efe8', border: 'none', borderRadius: 8,
          width: 28, height: 28, cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b655c" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
    </div>
  );
}
