/* ============================================================
   SENTINEL — oauth.js
   Google sign-in via Supabase Auth. Requires:
     1. Google enabled as a provider in Supabase (Authentication ->
        Providers -> Google), with your own Google Cloud OAuth client.
     2. window.SENTINEL_SUPABASE_URL and window.SENTINEL_SUPABASE_ANON_KEY
        set below (safe to expose — same as any client-side Supabase app).
   No backend secret is needed for this flow: the FastAPI backend never
   sees your Google client secret, it only verifies the Supabase session
   token like any other login.
   ============================================================ */
window.SENTINEL_SUPABASE_URL = window.SENTINEL_SUPABASE_URL || '';
window.SENTINEL_SUPABASE_ANON_KEY = window.SENTINEL_SUPABASE_ANON_KEY || '';

const SentinelOAuth = (() => {
  let client = null;
  function getClient() {
    if (client) return client;
    if (!window.SENTINEL_SUPABASE_URL || !window.SENTINEL_SUPABASE_ANON_KEY) return null;
    if (typeof window.supabase === 'undefined') return null; // CDN script not loaded
    client = window.supabase.createClient(window.SENTINEL_SUPABASE_URL, window.SENTINEL_SUPABASE_ANON_KEY);
    return client;
  }

  async function signInWithGoogle() {
    const sb = getClient();
    if (!sb) {
      showToast && showToast('warning', 'Google sign-in not configured',
        'Set SENTINEL_SUPABASE_URL / SENTINEL_SUPABASE_ANON_KEY in js/oauth.js and enable Google in Supabase first.');
      return;
    }
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  }

  // Call on page load of login.html / register.html. If Supabase just
  // redirected back with a session in the URL, finish the login: ask our
  // backend to provision a profile/org (first time only) and store the
  // session the same way email/password login does.
  async function handleRedirect() {
    const sb = getClient();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    const session = data && data.session;
    if (!session) return;

    try {
      const res = await fetch((window.SENTINEL_API_BASE || 'http://localhost:8000/api/v1') + '/auth/oauth-complete', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token },
      });
      if (!res.ok) throw new Error('Could not complete Google sign-in');
      const user = await res.json();
      SentinelAPI.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user,
      });
      sessionStorage.setItem('sentinel_username', user.full_name || user.email.split('@')[0]);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showToast && showToast('danger', 'Google sign-in failed', err.message);
    }
  }

  return { signInWithGoogle, handleRedirect };
})();
