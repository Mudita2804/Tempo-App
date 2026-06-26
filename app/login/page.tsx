'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  }

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: '#f7f4ef', padding: '80px 40px',
    }}>
      <div style={{ width: 420, maxWidth: '100%' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 52 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: '#3f9d5f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 18,
          }}>T</div>
          <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em' }}>Tempo</div>
        </div>

        <h1 style={{ fontSize: 29, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 10px' }}>
          Welcome to Tempo
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: '#6b655c', margin: '0 0 38px' }}>
          Your AI food &amp; movement coach. Sign in to keep your goals and logs synced across all your devices.
        </p>

        {/* Google button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            border: '1.5px solid #ece6dc', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? '#f3efe8' : '#fff',
            color: '#211e1a', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 600,
            padding: '15px 20px', borderRadius: 13,
            boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            opacity: loading ? 0.75 : 1,
            transition: 'opacity .15s',
          }}
        >
          {/* Google "G" logo */}
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12.5, color: '#aaa297', marginTop: 18, lineHeight: 1.5 }}>
          No password needed. We use Google to keep your account secure.
        </p>
      </div>
    </div>
  );
}
