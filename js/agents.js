/* ============================================================
   SENTINEL — agents.js
   AI Agent Management + Wallets. Pulls live data from the backend;
   no hardcoded arrays. Requires api.js to be loaded first.
   ============================================================ */
let AGENTS = [];
let WALLETS = [];

function agentBadgeClass(status){ return status === 'active' ? 'success' : status === 'frozen' ? 'danger' : 'warning'; }
function walletBadgeClass(status){ return status === 'active' ? 'success' : status === 'frozen' ? 'danger' : 'warning'; }
function riskBadgeClass(score){ return score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'success'; }
function fmtWhen(iso){
  if(!iso) return 'never';
  const d = new Date(iso);
  if(isNaN(d)) return 'never';
  return d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function shortAddr(addr){ return addr && addr.length > 12 ? addr.slice(0,6) + '…' + addr.slice(-4) : (addr || '—'); }

/* ---------------- Agents ---------------- */
async function loadAgents(){
  if(typeof SentinelAPI === 'undefined' || !SentinelAPI.getToken()){
    document.getElementById('agentGrid') && (document.getElementById('agentGrid').innerHTML =
      '<p class="text-secondary" style="padding:24px;">Log in to see live agents.</p>');
    return;
  }
  try{ AGENTS = await SentinelAPI.agents(); }
  catch(err){ showToast && showToast('danger', 'Could not load agents', err.message); AGENTS = []; }
  drawAgents();
}

function renderAgentCards(list){
  const grid = document.getElementById('agentGrid');
  if(!grid) return;
  if(!list.length){ grid.innerHTML = '<p class="text-secondary" style="padding:24px;">No agents match. Register your first agent to get started.</p>'; return; }
  grid.innerHTML = list.map(a => `
    <div class="vendor-card" data-agent-id="${a.id}" style="cursor:pointer;">
      <div class="vendor-card-top">
        <div class="vendor-logo" style="background:${a.status==='active'?'#10B981':a.status==='frozen'?'#EF4444':'#6B7280'}">${(a.name||'?').slice(0,2).toUpperCase()}</div>
        <div><div class="vc-name">${a.name}</div><div class="vc-cat">${a.wallets?.length || 0} wallet${(a.wallets?.length||0)===1?'':'s'} · last active ${fmtWhen(a.last_activity_at)}</div></div>
      </div>
      <div class="vendor-score-row">
        <span>Risk score: <b>${a.risk_score ?? 0}</b></span>
        <span class="badge ${riskBadgeClass(a.risk_score ?? 0)}">${(a.risk_score ?? 0) >= 70 ? 'High' : (a.risk_score ?? 0) >= 40 ? 'Medium' : 'Low'}</span>
      </div>
      <div class="vendor-score-row">
        <span>Total spent: <b>$${(a.total_spent ?? 0).toFixed(2)}</b> · ${a.transaction_count ?? 0} tx</span>
        <span class="badge ${agentBadgeClass(a.status)}">${a.status}</span>
      </div>
    </div>`).join('');
  grid.querySelectorAll('[data-agent-id]').forEach(card => {
    card.addEventListener('click', () => openAgentDetail(card.dataset.agentId));
  });
}

function drawAgents(){
  const search = document.getElementById('agentSearch');
  if(!search) return;
  const active = document.querySelector('#view-agents .filter-chip.active');
  const filter = active ? active.dataset.afx : 'all';
  const q = search.value.trim().toLowerCase();
  let list = AGENTS.filter(a => a.name.toLowerCase().includes(q));
  if(filter !== 'all') list = list.filter(a => a.status === filter);
  renderAgentCards(list);
}

function initAgentsPage(){
  if(!document.getElementById('agentGrid')) return;
  loadAgents();
  const search = document.getElementById('agentSearch');
  if(search) search.addEventListener('input', drawAgents);
  document.querySelectorAll('#view-agents .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#view-agents .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      drawAgents();
    });
  });

  const addBtn = document.getElementById('addAgentBtn');
  const modal = document.getElementById('agentModal');
  if(addBtn && modal){
    addBtn.addEventListener('click', () => modal.classList.add('show'));
    document.getElementById('closeAgentModal')?.addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('cancelAgentModal')?.addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('confirmAgentModal')?.addEventListener('click', async () => {
      const name = document.getElementById('newAgentName').value.trim();
      if(!name){ showToast('warning', 'Name required', 'Give the agent a name first.'); return; }
      try{
        await SentinelAPI.createAgent({ name });
        modal.classList.remove('show');
        document.getElementById('newAgentName').value = '';
        showToast('success', 'Agent registered', `${name} is now active with a fresh session key.`);
        loadAgents();
      }catch(err){ showToast('danger', 'Could not register agent', err.message); }
    });
  }

  const detailModal = document.getElementById('agentDetailModal');
  document.getElementById('closeAgentDetailModal')?.addEventListener('click', () => detailModal.classList.remove('show'));
}

async function openAgentDetail(agentId){
  const modal = document.getElementById('agentDetailModal');
  if(!modal) return;
  let a;
  try{ a = await SentinelAPI.getAgent(agentId); }
  catch(err){ showToast('danger', 'Could not load agent', err.message); return; }
  if(!a) return;
  document.getElementById('agentDetailName').textContent = a.name;
  const wallets = (a.wallets || []).map(w => `<li>${shortAddr(w.address)} · ${w.chain} · <span class="badge ${walletBadgeClass(w.status)}" style="font-size:10px;">${w.status}</span></li>`).join('') || '<li>No wallets yet</li>';
  const history = (a.spending_history || []).slice(0, 8).map(t => `<li>$${parseFloat(t.amount).toFixed(2)} — ${t.status} · ${fmtWhen(t.created_at)}</li>`).join('') || '<li>No transactions yet</li>';
  document.getElementById('agentDetailBody').innerHTML = `
    <p><b>Status:</b> <span class="badge ${agentBadgeClass(a.status)}">${a.status}</span></p>
    <p><b>Session key:</b> <code style="font-size:11px;">${a.session_key || '—'}</code></p>
    <p><b>Risk score:</b> ${a.risk_score ?? 0} · <b>Last activity:</b> ${fmtWhen(a.last_activity_at)}</p>
    <p><b>Total spent:</b> $${(a.total_spent ?? 0).toFixed(2)} across ${a.transaction_count ?? 0} transactions</p>
    <p><b>Wallets</b></p><ul>${wallets}</ul>
    <p><b>Recent spending history</b></p><ul>${history}</ul>`;
  const freezeBtn = document.getElementById('toggleAgentFreezeBtn');
  freezeBtn.textContent = a.status === 'frozen' ? 'Unfreeze agent' : 'Freeze agent';
  freezeBtn.onclick = async () => {
    try{
      if(a.status === 'frozen') await SentinelAPI.unfreezeAgent(a.id);
      else await SentinelAPI.freezeAgent(a.id, 'Frozen from dashboard');
      showToast(a.status === 'frozen' ? 'success' : 'danger', a.status === 'frozen' ? 'Agent unfrozen' : 'Agent frozen',
        a.status === 'frozen' ? `${a.name} can transact again.` : `${a.name} and its wallets are frozen.`);
      modal.classList.remove('show');
      loadAgents();
    }catch(err){ showToast('danger', 'Action failed', err.message); }
  };
  document.getElementById('rotateAgentKeyBtn').onclick = async () => {
    try{
      const updated = await SentinelAPI.rotateAgentKey(a.id);
      showToast('info', 'Session key rotated', 'The old key is no longer valid.');
      document.getElementById('agentDetailBody').querySelector('code').textContent = updated.session_key;
    }catch(err){ showToast('danger', 'Could not rotate key', err.message); }
  };
  modal.classList.add('show');
}

/* ---------------- Wallets ---------------- */
async function loadWallets(){
  if(typeof SentinelAPI === 'undefined' || !SentinelAPI.getToken()){
    document.getElementById('walletGrid') && (document.getElementById('walletGrid').innerHTML =
      '<p class="text-secondary" style="padding:24px;">Log in to see live wallets.</p>');
    return;
  }
  try{ WALLETS = await SentinelAPI.wallets(); }
  catch(err){ showToast && showToast('danger', 'Could not load wallets', err.message); WALLETS = []; }
  drawWallets();
}

function renderWalletCards(list){
  const grid = document.getElementById('walletGrid');
  if(!grid) return;
  if(!list.length){ grid.innerHTML = '<p class="text-secondary" style="padding:24px;">No wallets match. Create one and assign it to an agent.</p>'; return; }
  grid.innerHTML = list.map(w => `
    <div class="vendor-card" data-wallet-id="${w.id}">
      <div class="vendor-card-top">
        <div class="vendor-logo" style="background:${w.status==='active'?'#2563EB':w.status==='frozen'?'#EF4444':'#F59E0B'}">${w.chain.slice(0,2).toUpperCase()}</div>
        <div><div class="vc-name">${w.name ? w.name : shortAddr(w.address)}</div><div class="vc-cat">${w.agent_name || 'Unassigned'} · ${w.chain}${w.name ? ' · ' + shortAddr(w.address) : ''}</div></div>
      </div>
      <div class="vendor-score-row">
        <span>Balance: <b>$${parseFloat(w.balance ?? 0).toFixed(2)}</b></span>
        <span class="badge ${walletBadgeClass(w.status)}">${w.status}</span>
      </div>
      <div class="vendor-card-actions">
        <button class="btn btn-ghost btn-sm" data-wallet-toggle="${w.id}" data-status="${w.status}">${w.status === 'frozen' ? 'Unfreeze' : 'Freeze'}</button>
      </div>
    </div>`).join('');
  grid.querySelectorAll('[data-wallet-toggle]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.walletToggle;
      const frozen = btn.dataset.status === 'frozen';
      try{
        if(frozen) await SentinelAPI.unfreezeWallet(id); else await SentinelAPI.freezeWallet(id);
        showToast(frozen ? 'success' : 'danger', frozen ? 'Wallet unfrozen' : 'Wallet frozen', '');
        loadWallets();
      }catch(err){ showToast('danger', 'Action failed', err.message); }
    });
  });
}

function drawWallets(){
  const search = document.getElementById('walletSearch');
  if(!search) return;
  const active = document.querySelector('#view-wallets .filter-chip.active');
  const filter = active ? active.dataset.wfx : 'all';
  const q = search.value.trim().toLowerCase();
  let list = WALLETS.filter(w => (w.address || '').toLowerCase().includes(q) || (w.name || '').toLowerCase().includes(q) || (w.agent_name || '').toLowerCase().includes(q));
  if(filter !== 'all') list = list.filter(w => w.status === filter);
  renderWalletCards(list);
}

function initWalletsPage(){
  if(!document.getElementById('walletGrid')) return;
  loadWallets();
  SentinelAPI.agents().then(a => {
    const sel = document.getElementById('newWalletAgent');
    if(sel) sel.innerHTML = '<option value="">Unassigned</option>' + a.map(ag => `<option value="${ag.id}">${ag.name}</option>`).join('');
  }).catch(() => {});

  const search = document.getElementById('walletSearch');
  if(search) search.addEventListener('input', drawWallets);
  document.querySelectorAll('#view-wallets .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#view-wallets .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      drawWallets();
    });
  });

  const addBtn = document.getElementById('addWalletBtn');
  const modal = document.getElementById('walletModal');
  if(addBtn && modal){
    addBtn.addEventListener('click', () => modal.classList.add('show'));
    document.getElementById('closeWalletModal')?.addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('cancelWalletModal')?.addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('confirmWalletModal')?.addEventListener('click', async () => {
      const name = document.getElementById('newWalletName').value.trim();
      const agent_id = document.getElementById('newWalletAgent').value || null;
      const address = document.getElementById('newWalletAddress').value.trim();
      const chain = document.getElementById('newWalletChain').value || 'ethereum';
      if(!address){ showToast('warning', 'Missing info', 'Enter a wallet address.'); return; }
      try{
        await SentinelAPI.createWallet({ name: name || null, agent_id, address, chain });
        modal.classList.remove('show');
        document.getElementById('newWalletName').value = '';
        document.getElementById('newWalletAddress').value = '';
        showToast('success', 'Wallet created', 'Ready to receive spend approvals.');
        loadWallets();
      }catch(err){ showToast('danger', 'Could not create wallet', err.message); }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try{ initAgentsPage(); }catch(err){ console.warn('[SENTINEL] agents page skipped —', err.message); }
  try{ initWalletsPage(); }catch(err){ console.warn('[SENTINEL] wallets page skipped —', err.message); }
});
