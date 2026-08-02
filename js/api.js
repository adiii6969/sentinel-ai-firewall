/* ============================================================
   SENTINEL — api.js
   Thin client for the FastAPI backend. No UI logic lives here —
   every page's existing render functions stay untouched; they just
   get real data instead of the hardcoded arrays where wired up.
   ============================================================ */
const SENTINEL_API_BASE =
  window.SENTINEL_API_BASE ||
  'https://sentinalfirewall.netlify.app/';

const SentinelAPI = (() => {
  function getToken() { return localStorage.getItem('sentinel_token'); }
  function setSession(data) {
    if (data.access_token) localStorage.setItem('sentinel_token', data.access_token);
    if (data.refresh_token) localStorage.setItem('sentinel_refresh', data.refresh_token);
    if (data.user) localStorage.setItem('sentinel_user', JSON.stringify(data.user));
  }
  function clearSession() {
    localStorage.removeItem('sentinel_token');
    localStorage.removeItem('sentinel_refresh');
    localStorage.removeItem('sentinel_user');
  }
  function currentUser() {
    try { return JSON.parse(localStorage.getItem('sentinel_user') || 'null'); }
    catch { return null; }
  }

  async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    }

    async function doFetch(hdrs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000); // 15 s timeout
      try {
        const res = await fetch(SENTINEL_API_BASE + path, {
          method, headers: hdrs, body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        return res;
      } catch (err) {
        if (err.name === 'AbortError') throw new Error('Request timed out — the server is taking too long. Please try again.');
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }

    let res;
    try {
      res = await doFetch(headers);
    } catch (networkErr) {
      // Retry once after a short pause before giving up
      await new Promise(r => setTimeout(r, 1200));
      try {
        res = await doFetch(headers);
      } catch (e) {
        throw new Error(e.message || 'Cannot reach the server. Make sure the backend is running on port 8000.');
      }
    }
    // If 401 on an authenticated request, try to silently refresh the token once
    if (res.status === 401 && auth) {
      const refreshed = await _tryRefresh();
      if (refreshed) {
        // Retry original request with the new token
        const retryHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
        try {
          res = await doFetch(retryHeaders);
        } catch (e) {
          throw new Error('Cannot reach the server. Make sure the backend is running on port 8000.');
        }
        if (res.status === 401) { clearSession(); throw new Error('Session expired — please sign in again.'); }
      } else {
        clearSession(); throw new Error('Session expired — please sign in again.');
      }
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      const errMsg = err.message || err.detail || 'Request failed';
      throw new Error(errMsg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function _tryRefresh() {
    const refreshToken = localStorage.getItem('sentinel_refresh');
    if (!refreshToken) return false;
    try {
      const res = await fetch(SENTINEL_API_BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.access_token) { localStorage.setItem('sentinel_token', data.access_token); return true; }
      return false;
    } catch { return false; }
  }

  function connectWS(onMessage) {
    const token = getToken();
    if (!token) return null;
    const wsBase = SENTINEL_API_BASE.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/ws?token=${encodeURIComponent(token)}`);
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { } };
    ws.onopen = () => setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 25000);
    return ws;
  }

  return {
    getToken, setSession, clearSession, currentUser, connectWS,
    signup: (data) => request('/auth/signup', { method: 'POST', body: data, auth: false }),
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
    forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
    me: () => request('/auth/me'),

    dashboardSummary: () => request('/dashboard/summary'),
    analyticsOverview: () => request('/analytics/overview'),

    vendors: () => request('/vendors'),
    createVendor: (data) => request('/vendors', { method: 'POST', body: data }),
    updateVendor: (id, data) => request(`/vendors/${id}`, { method: 'PATCH', body: data }),
    deleteVendor: (id) => request(`/vendors/${id}`, { method: 'DELETE' }),

    transactions: (params = {}) => request('/transactions?' + new URLSearchParams(params)),

    submitTransaction: (data) => request('/firewall/transaction', { method: 'POST', body: data }),
    pendingApprovals: () => request('/firewall/pending'),
    decideTransaction: (id, decision, note) => request(`/firewall/pending/${id}/decide`, { method: 'POST', body: { decision, note } }),

    firewallRules: () => request('/firewall/rules'),
    createFirewallRule: (data) => request('/firewall/rules', { method: 'POST', body: data }),
    updateFirewallRule: (id, data) => request(`/firewall/rules/${id}`, { method: 'PATCH', body: data }),
    deleteFirewallRule: (id) => request(`/firewall/rules/${id}`, { method: 'DELETE' }),

    riskHistory: () => request('/risk/history'),
    riskAlerts: () => request('/risk/alerts'),

    limits: () => request('/limits'),
    updateLimits: (data) => request('/limits', { method: 'PATCH', body: data }),

    killswitchState: () => request('/killswitch'),
    toggleKillswitch: (is_active, reason) => request('/killswitch/toggle', { method: 'POST', body: { is_active, reason } }),

    recommendations: (refresh = false) => request(`/advisor/recommendations${refresh ? '?refresh=true' : ''}`),
    dismissRecommendation: (id) => request(`/advisor/recommendations/${id}/dismiss`, { method: 'POST' }),
    applyRecommendation: (id) => request(`/advisor/recommendations/${id}/apply`, { method: 'POST' }),

    auditLogs: (params = {}) => request('/audit?' + new URLSearchParams(params)),
    verifyAudit: () => request('/audit/verify'),

    notifications: () => request('/notifications'),

    agents: () => request('/agents'),
    getAgent: (id) => request(`/agents/${id}`),
    createAgent: (data) => request('/agents', { method: 'POST', body: data }),
    updateAgent: (id, data) => request(`/agents/${id}`, { method: 'PATCH', body: data }),
    freezeAgent: (id, reason) => request(`/agents/${id}/freeze`, { method: 'POST', body: { reason } }),
    unfreezeAgent: (id) => request(`/agents/${id}/unfreeze`, { method: 'POST' }),
    rotateAgentKey: (id) => request(`/agents/${id}/rotate-key`, { method: 'POST' }),
    deleteAgent: (id) => request(`/agents/${id}`, { method: 'DELETE' }),

    wallets: () => request('/wallets'),
    getWallet: (id) => request(`/wallets/${id}`),
    createWallet: (data) => request('/wallets', { method: 'POST', body: data }),
    updateWallet: (id, data) => request(`/wallets/${id}`, { method: 'PATCH', body: data }),
    freezeWallet: (id) => request(`/wallets/${id}/freeze`, { method: 'POST' }),
    unfreezeWallet: (id) => request(`/wallets/${id}/unfreeze`, { method: 'POST' }),
    deleteWallet: (id) => request(`/wallets/${id}`, { method: 'DELETE' }),
    markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  };
})();
