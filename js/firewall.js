/* ============================================================
   SENTINEL — firewall.js
   Firewall Rules management: create/list/toggle/delete
   allowed_categories / time_restriction / frequency_limit rules.
   Only active on firewall.html (all lookups are defensive).
   ============================================================ */
let FIREWALL_RULES = [];

function ruleConfigSummary(rule) {
  const cfg = rule.config || {};
  if (rule.rule_type === 'allowed_categories') {
    return `Allowed categories: ${(cfg.categories || []).join(', ') || '—'}`;
  }
  if (rule.rule_type === 'time_restriction') {
    return `Payments allowed ${String(cfg.start_hour ?? 0).padStart(2, '0')}:00–${String(cfg.end_hour ?? 24).padStart(2, '0')}:00 UTC`;
  }
  if (rule.rule_type === 'frequency_limit') {
    return `Max ${cfg.max_count ?? '—'} requests per ${cfg.window_seconds ?? 60}s`;
  }
  return JSON.stringify(cfg);
}

function ruleTypeLabel(type) {
  return { allowed_categories: 'Allowed categories', time_restriction: 'Time restriction', frequency_limit: 'Frequency limit' }[type] || type;
}

function renderRuleConfigFields(type) {
  const el = document.getElementById('ruleConfigFields');
  if (!el) return;
  if (type === 'allowed_categories') {
    el.innerHTML = `<label class="text-secondary" style="font-size:13px;">Allowed vendor categories (comma-separated)</label>
      <input type="text" id="cfgCategories" placeholder="Cloud infrastructure, Payments, AI / API services">`;
  } else if (type === 'time_restriction') {
    el.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      <div><label class="text-secondary" style="font-size:13px;">Start hour (UTC, 0-23)</label><input type="number" id="cfgStartHour" min="0" max="23" value="13"></div>
      <div><label class="text-secondary" style="font-size:13px;">End hour (UTC, 1-24)</label><input type="number" id="cfgEndHour" min="1" max="24" value="21"></div>
    </div>`;
  } else if (type === 'frequency_limit') {
    el.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      <div><label class="text-secondary" style="font-size:13px;">Max requests</label><input type="number" id="cfgMaxCount" min="1" value="5"></div>
      <div><label class="text-secondary" style="font-size:13px;">Per window (seconds)</label><input type="number" id="cfgWindowSeconds" min="1" value="60"></div>
    </div>`;
  }
}

function buildRuleConfig(type) {
  if (type === 'allowed_categories') {
    const raw = document.getElementById('cfgCategories')?.value || '';
    return { categories: raw.split(',').map(s => s.trim()).filter(Boolean) };
  }
  if (type === 'time_restriction') {
    return {
      start_hour: parseInt(document.getElementById('cfgStartHour')?.value ?? '0', 10),
      end_hour: parseInt(document.getElementById('cfgEndHour')?.value ?? '24', 10),
    };
  }
  if (type === 'frequency_limit') {
    return {
      max_count: parseInt(document.getElementById('cfgMaxCount')?.value ?? '5', 10),
      window_seconds: parseInt(document.getElementById('cfgWindowSeconds')?.value ?? '60', 10),
    };
  }
  return {};
}

async function loadFirewallRules() {
  const list = document.getElementById('rulesList');
  if (!list) return; // not on this page
  if (typeof SentinelAPI === 'undefined' || !SentinelAPI.getToken()) {
    list.innerHTML = '<p class="text-secondary" style="padding:16px;">Log in to manage firewall rules.</p>';
    return;
  }
  try { FIREWALL_RULES = await SentinelAPI.firewallRules(); }
  catch (err) { showToast && showToast('danger', 'Could not load rules', err.message); FIREWALL_RULES = []; }
  renderFirewallRules();
}

function renderFirewallRules() {
  const list = document.getElementById('rulesList');
  if (!list) return;
  if (!FIREWALL_RULES.length) {
    list.innerHTML = '<p class="text-secondary" style="padding:16px;">No firewall rules yet — every transaction only goes through risk + limit checks. Add a rule to restrict categories, hours, or frequency.</p>';
    return;
  }
  list.innerHTML = FIREWALL_RULES.map(r => `
    <div class="limit-row" data-rule-id="${r.id}">
      <div class="limit-top">
        <span class="lt-name">${r.name} <span class="badge ${r.enabled ? 'success' : 'neutral'}">${ruleTypeLabel(r.rule_type)}</span></span>
        <span style="display:flex; gap:8px;">
          <button class="btn btn-ghost btn-sm rule-toggle-btn">${r.enabled ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-ghost btn-sm rule-delete-btn">Delete</button>
        </span>
      </div>
      <p class="text-secondary" style="font-size:13px; margin:4px 0 0;">${ruleConfigSummary(r)}</p>
    </div>`).join('');

  list.querySelectorAll('.rule-toggle-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = e.target.closest('[data-rule-id]').dataset.ruleId;
    const rule = FIREWALL_RULES.find(r => r.id === id);
    try {
      await SentinelAPI.updateFirewallRule(id, { enabled: !rule.enabled });
      showToast('success', 'Rule updated', `"${rule.name}" is now ${!rule.enabled ? 'enabled' : 'disabled'}.`);
      loadFirewallRules();
    } catch (err) { showToast('danger', 'Update failed', err.message); }
  }));

  list.querySelectorAll('.rule-delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = e.target.closest('[data-rule-id]').dataset.ruleId;
    const rule = FIREWALL_RULES.find(r => r.id === id);
    if (!confirm(`Delete rule "${rule.name}"? This can't be undone.`)) return;
    try {
      await SentinelAPI.deleteFirewallRule(id);
      showToast('info', 'Rule deleted', `"${rule.name}" was removed.`);
      loadFirewallRules();
    } catch (err) { showToast('danger', 'Delete failed', err.message); }
  }));
}

function initFirewallRulesForm() {
  const addBtn = document.getElementById('addRuleBtn');
  const form = document.getElementById('ruleForm');
  const cancelBtn = document.getElementById('cancelRuleBtn');
  const typeSelect = document.getElementById('ruleType');
  if (!addBtn || !form) return; // not on this page

  addBtn.addEventListener('click', () => {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') renderRuleConfigFields(typeSelect.value);
  });
  cancelBtn.addEventListener('click', () => { form.style.display = 'none'; form.reset(); });
  typeSelect.addEventListener('change', () => renderRuleConfigFields(typeSelect.value));
  renderRuleConfigFields(typeSelect.value);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('ruleName').value.trim();
    const rule_type = typeSelect.value;
    const config = buildRuleConfig(rule_type);
    if (!name) { showToast('warning', 'Name required', 'Give the rule a short descriptive name.'); return; }
    try {
      await SentinelAPI.createFirewallRule({ name, rule_type, config, enabled: true });
      showToast('success', 'Rule created', `"${name}" is now enforced on every transaction.`);
      form.style.display = 'none'; form.reset();
      loadFirewallRules();
    } catch (err) { showToast('danger', 'Could not create rule', err.message); }
  });
}

/* ---------------- Simulate payment request ---------------- */
async function openSimModal() {
  const modal = document.getElementById('simModal');
  if (!modal) return;
  if (typeof SentinelAPI === 'undefined' || !SentinelAPI.getToken()) {
    showToast && showToast('warning', 'Log in first', 'You need an active session to submit a request.');
    return;
  }
  const agentSel = document.getElementById('simAgent');
  const walletSel = document.getElementById('simWallet');
  const vendorSel = document.getElementById('simVendor');
  agentSel.innerHTML = '<option>Loading…</option>';
  walletSel.innerHTML = '<option>Loading…</option>';
  vendorSel.innerHTML = '<option>Loading…</option>';
  modal.classList.add('show');

  try {
    const [agents, wallets, vendors] = await Promise.all([
      SentinelAPI.agents(), SentinelAPI.wallets(), SentinelAPI.vendors(),
    ]);
    agentSel.innerHTML = agents.length
      ? agents.map(a => `<option value="${a.id}">${a.name}</option>`).join('')
      : '<option value="">No agents — create one on the AI Agents page</option>';
    walletSel.innerHTML = wallets.length
      ? wallets.map(w => `<option value="${w.id}">${w.name || w.address}</option>`).join('')
      : '<option value="">No wallets — create one on the Wallets page</option>';
    vendorSel.innerHTML = vendors.length
      ? vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('')
      : '<option value="">No vendors — add one on the Vendors page</option>';
  } catch (err) {
    // Don't leave the selects stuck on "Loading…" forever — make the failure visible
    // and give the person a way to retry without closing/reopening the modal.
    const errOption = `<option value="">Failed to load — click Retry</option>`;
    agentSel.innerHTML = errOption; walletSel.innerHTML = errOption; vendorSel.innerHTML = errOption;
    showToast && showToast('danger', 'Could not load options', err.message);
    let retryBtn = document.getElementById('simRetryBtn');
    if (!retryBtn) {
      retryBtn = document.createElement('button');
      retryBtn.id = 'simRetryBtn';
      retryBtn.type = 'button';
      retryBtn.className = 'btn btn-ghost btn-sm';
      retryBtn.textContent = 'Retry loading';
      retryBtn.style.marginTop = '8px';
      vendorSel.insertAdjacentElement('afterend', retryBtn);
    }
    retryBtn.onclick = openSimModal;
  }
}
function closeSimModal() {
  document.getElementById('simModal')?.classList.remove('show');
}
async function submitSimModal() {
  const agent_id = document.getElementById('simAgent').value;
  const wallet_id = document.getElementById('simWallet').value;
  const vendor_id = document.getElementById('simVendor').value;
  const amount = parseFloat(document.getElementById('simAmount').value);
  if (!agent_id || !wallet_id || !vendor_id) {
    showToast('warning', 'Missing selection', 'Pick an agent, wallet, and vendor first.');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('warning', 'Invalid amount', 'Enter an amount greater than 0.');
    return;
  }
  try {
    const result = await SentinelAPI.submitTransaction({ agent_id, wallet_id, vendor_id, amount, currency: 'USD' });
    closeSimModal();
    showToast('success', 'Request submitted', `Decision: ${result.decision || result.status || 'processed'}.`);
    if (typeof hydrateFromAPI === 'function') hydrateFromAPI();
  } catch (err) {
    showToast('danger', 'Request failed', err.message);
  }
}
function initSimulateModal() {
  const openBtn = document.getElementById('simulatePaymentBtn');
  if (!openBtn) return; // not on this page
  openBtn.addEventListener('click', openSimModal);
  document.getElementById('closeSimModal')?.addEventListener('click', closeSimModal);
  document.getElementById('cancelSimModal')?.addEventListener('click', closeSimModal);
  document.getElementById('confirmSimModal')?.addEventListener('click', submitSimModal);
}

document.addEventListener('DOMContentLoaded', () => {
  initFirewallRulesForm();
  loadFirewallRules();
  initSimulateModal();
});
