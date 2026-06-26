import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/strava/callback?code=...
 * Exchanges the OAuth code for access/refresh tokens.
 *
 * TODO (production):
 *  1. Persist { accessToken, refreshToken, expiresAt, athleteId } against the user.
 *  2. Pull recent activities from GET /api/v3/athlete/activities and map each to an
 *     Entry { type:'activity', kcal: <calories>, durationMin, source:'strava' }.
 *  3. DEDUPE: if a voice/manual activity already covers the same session (match on
 *     time window + activity type), merge into one entry and keep Strava's numbers.
 *  4. Register a webhook (push subscription) so future activities sync automatically.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const base = process.env.NEXT_PUBLIC_BASE_URL || url.origin;

  if (error || !code) {
    return NextResponse.redirect(`${base}/?strava=denied`);
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Strava env not configured' }, { status: 500 });
  }

  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json({ error: 'token exchange failed', detail }, { status: 502 });
    }
    // const tokens = await r.json();
    // TODO: persist tokens + run initial activity sync (see notes above).
    return NextResponse.redirect(`${base}/?strava=connected`);
  } catch (e) {
    return NextResponse.json({ error: 'token exchange exception', detail: String(e) }, { status: 502 });
  }
}
