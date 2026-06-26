'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from './components/AppShell';
import { Onboarding } from './components/Onboarding';

export default function Page() {
  const screen = useStore(s => s.screen);
  const initialized = useStore(s => s.initialized);
  const initFromSupabase = useStore(s => s.initFromSupabase);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) void initFromSupabase(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) void initFromSupabase(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!initialized) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f7f4ef', fontFamily: 'Hanken Grotesk, sans-serif',
      }}>
        <div style={{ fontSize: 15, color: '#8a8478' }}>Loading…</div>
      </div>
    );
  }

  return screen === 'onboarding' ? <Onboarding /> : <AppShell />;
}
