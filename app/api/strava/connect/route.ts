import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/strava/connect
 * Redirects the user to Strava's OAuth consent screen.
 * Requires STRAVA_CLIENT_ID and STRAVA_REDIRECT_URI in env.
 */
export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Strava env not configured (STRAVA_CLIENT_ID / STRAVA_REDIRECT_URI)' },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  });

  return NextResponse.redirect(`https://www.strava.com/oauth/authorize?${params.toString()}`);
}
