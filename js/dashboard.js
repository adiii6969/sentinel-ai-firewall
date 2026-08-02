/* ============================================================
   SENTINEL — dashboard.js
   App state, view routing, dummy data, and all widget wiring
   ============================================================ */

/* ---------------- Dummy data ---------------- */
const VENDORS = [
  { name:'Amazon AWS',     cat:'Cloud infrastructure', rep:95, status:'Approved', color:'#FF9900', tx:6 },
  { name:'Microsoft Azure',cat:'Cloud infrastructure', rep:90, status:'Approved', color:'#0078D4', tx:4 },
  { name:'Google Cloud',   cat:'Cloud infrastructure', rep:88, status:'Approved', color:'#4285F4', tx:3 },
  { name:'Stripe',         cat:'Payments',             rep:93, status:'Approved', color:'#635BFF', tx:9 },
  { name:'OpenAI',         cat:'AI / API services',    rep:91, status:'Approved', color:'#10A37F', tx:5 },
  { name:'DigitalOcean',   cat:'Cloud infrastructure', rep:82, status:'Approved', color:'#0080FF', tx:2 },
  { name:'Twilio',         cat:'Messaging',            rep:78, status:'Pending',  color:'#F22F46', tx:1 },
  { name:'Zapier',         cat:'Automation',           rep:65, status:'Pending',  color:'#FF4F00', tx:0 },
  { name:'Unknown Vendor', cat:'Unverified wallet',    rep:20, status:'Blocked',  color:'#EF4444', tx:0 }
];

const TRANSACTIONS = [
  { id:'TX-88213', vendor:'Amazon AWS',      amount:120.00, risk:24, status:'Approved', time:'12:45', wallet:'0xABCD…1234' },
  { id:'TX-88212', vendor:'Unknown Vendor',  amount:500.00, risk:88, status:'Blocked',  time:'12:44', wallet:'0x9F1a…77bE' },
  { id:'TX-88211', vendor:'Stripe',          amount:64.20,  risk:12, status:'Approved', time:'12:42', wallet:'0xABCD…1234' },
  { id:'TX-88210', vendor:'OpenAI',          amount:212.40, risk:35, status:'Approved', time:'12:38', wallet:'0xABCD…1234' },
  { id:'TX-88209', vendor:'Twilio',          amount:340.00, risk:58, status:'Review',   time:'12:31', wallet:'0xABCD…1234' },
  { id:'TX-88208', vendor:'Google Cloud',    amount:98.75,  risk:19, status:'Approved', time:'12:20', wallet:'0xABCD…1234' },
  { id:'TX-88207', vendor:'Microsoft Azure', amount:410.00, risk:41, status:'Approved', time:'11:58', wallet:'0xABCD…1234' },
  { id:'TX-88206', vendor:'DigitalOcean',    amount:56.00,  risk:22, status:'Approved', time:'11:45', wallet:'0xABCD…1234' },
  { id:'TX-88205', vendor:'Zapier',          amount:150.00, risk:63, status:'Review',   time:'11:30', wallet:'0xABCD…1234' },
  { id:'TX-88204', vendor:'Unknown Vendor',  amount:900.00, risk:92, status:'Blocked',  time:'11:12', wallet:'0x2Fbc…41Ac' }
];

const AUDIT = TRANSACTIONS.map((t,i)=>({
  ...t,
  hash: '0x' + (7+i).toString(16).padEnd(4,'a') + '3f' + i + '…' + (98+i) + 'd' + i,
  block: 18456789 + i
}));

const ADVISOR = [
  { title:'Increase daily spending limit', reason:'Usage has hit 80% of the daily cap three days running — agents may stall before end of day.', action:'Review limit', priority:'medium', icon:'up' },
  { title:'Remove inactive vendor', reason:'"Zapier" hasn\u2019t received a payment in 45 days and remains on the allowlist.', action:'Remove vendor', priority:'low', icon:'trash' },
  { title:'Session key expiring soon', reason:'Wallet session key sk_live_wallet_01 expires in 2 hours.', action:'Rotate key', priority:'high', icon:'key' },
  { title:'High-risk transaction detected', reason:'A $500 request to an unlisted wallet scored 88/100 and was blocked automatically.', action:'Review transaction', priority:'high', icon:'alert' },
  { title:'Vendor reputation decreased', reason:'Twilio\u2019s reputation score dropped from 84 to 78 after a delayed settlement.', action:'View vendor', priority:'medium', icon:'down' },
  { title:'Spending anomaly detected', reason:'Transaction frequency to Google Cloud increased 3x versus the 7-day average.', action:'Investigate', priority:'medium', icon:'alert' }
];

const NOTIFICATIONS = [
  { type:'success', text:'Payment to <b>Amazon AWS</b> approved — $120.00', time:'12:45 PM' },
  { type:'danger',  text:'Payment to <b>Unknown Vendor</b> blocked — $500.00', time:'12:44 PM' },
  { type:'warning', text:'Risk score increased for agent <b>proc-agent-02</b>', time:'12:40 PM' },
  { type:'danger',  text:'Kill switch auto-triggered by risk engine', time:'11:12 AM' },
  { type:'info',    text:'New vendor <b>Twilio</b> added to allowlist', time:'10:58 AM' },
  { type:'success', text:'Payment to <b>Stripe</b> approved — $64.20', time:'10:40 AM' },
  { type:'info',    text:'Monthly limit updated by <b>admin</b>', time:'09:15 AM' }
];

const SYSTEM_STATUS = [
  { name:'AI Firewall', ok:true },
  { name:'Kill Switch', ok:true },
  { name:'Auto Freeze', ok:true },
  { name:'Monitoring', ok:true }
];

let killswitchFrozen = false;

/* ---------------- Live data hydration ----------------
   If a real session exists (SentinelAPI + token), replace the dummy
   arrays above with real backend data IN PLACE (same array references,
   so every render function below needs zero changes). Falls back to
   the dummy demo data above if unauthenticated or the API is unreachable. */
function capitalize(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function txStatusLabel(status){
  return { approved:'Approved', blocked:'Blocked', rejected:'Blocked', pending:'Review', frozen:'Review', flagged:'Review' }[status] || capitalize(status);
}
function fmtTime(iso){
  try{ return new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }
  catch{ return ''; }
}
function shortId(id, prefix){
  return prefix + '-' + (id || '').replace(/-/g,'').slice(0,5).toUpperCase();
}
function iconForRecommendation(title){
  const t = (title || '').toLowerCase();
  if(t.includes('increase')) return 'up';
  if(t.includes('remove')) return 'trash';
  if(t.includes('key') || t.includes('session')) return 'key';
  if(t.includes('dropped') || t.includes('decrease')) return 'down';
  return 'alert';
}

/* True once we've successfully talked to the API this session. While this
   is true, every render function must treat empty arrays as "this account
   genuinely has nothing yet" and show an empty state — NOT fall back to
   the dummy demo arrays above. The dummy arrays are only ever shown before
   this flips true (a split second on page load) or if the API is fully
   unreachable, so a real session never regresses to fake data once we know
   the real, possibly-empty, truth. */
let SENTINEL_LIVE = false;

async function hydrateFromAPI(){
  if(typeof SentinelAPI === 'undefined' || !SentinelAPI.getToken()) return; // logged out — nothing to hydrate
  try{
    const [vendors, txPage, auditPage, recs, notifs, agents, summary] = await Promise.all([
      SentinelAPI.vendors(),
      SentinelAPI.transactions({ page_size: 50 }),
      SentinelAPI.auditLogs({ page_size: 50 }),
      SentinelAPI.recommendations(true),
      SentinelAPI.notifications(),
      SentinelAPI.agents().catch(() => []),
      SentinelAPI.dashboardSummary().catch(() => null),
    ]);
    window.SENTINEL_AGENTS = agents;

    VENDORS.length = 0;
    VENDORS.push(...vendors.map(v => ({
      id: v.id, name: v.name, cat: v.category || '', rep: v.reputation_score ?? 50,
      status: capitalize(v.status), color: v.color || '#6366F1', tx: 0,
    })));

    TRANSACTIONS.length = 0;
    TRANSACTIONS.push(...(txPage.items || []).map(t => ({
      id: shortId(t.id, 'TX'), vendor: t.vendors?.name || 'Unknown Vendor', amount: parseFloat(t.amount),
      risk: t.risk_score || 0, status: txStatusLabel(t.status), time: fmtTime(t.created_at),
      wallet: t.wallet_id ? ('0x' + t.wallet_id.replace(/-/g,'').slice(0,4) + '…' + t.wallet_id.slice(-4)) : '—',
      raw: t.created_at || null, // kept for real chart bucketing, never shown directly
    })));

    AUDIT.length = 0;
    AUDIT.push(...(auditPage.items || []).map(a => ({
      id: shortId(a.entity_id || a.id, 'TX'), vendor: a.action, amount: 0, risk: 0,
      status: 'Approved', time: fmtTime(a.created_at), wallet: '—',
      hash: a.hash, block: a.block_number || 0,
    })));

    // Always mirror recommendations exactly, including the empty case — a
    // brand-new account with nothing to flag should show "all clear", not
    // the demo advisor tips.
    ADVISOR.length = 0;
    ADVISOR.push(...recs.map(r => ({
      id: r.id, recType: r.rec_type || null,
      title: r.title, reason: r.reason, action: r.suggested_action,
      priority: r.priority, icon: iconForRecommendation(r.title),
    })));

    NOTIFICATIONS.length = 0;
    NOTIFICATIONS.push(...notifs.map(n => ({ id: n.id, type: n.type, text: n.text, time: fmtTime(n.created_at), read: n.read })));

    if(summary){
      window.SENTINEL_SUMMARY = summary;
      if(Array.isArray(summary.system_status)){
        SYSTEM_STATUS.length = 0;
        SYSTEM_STATUS.push(...summary.system_status);
      }
    }

    SENTINEL_LIVE = true;
  }catch(err){
    console.warn('[SENTINEL] live data unavailable, showing demo data —', err.message);
  }
}

/* ---------------- Init ----------------
   SENTINEL now ships as a set of standalone pages (dashboard.html,
   firewall.html, limits.html, vendors.html, risk.html, killswitch.html,
   audit.html, advisor.html, analytics.html, notifications.html,
   settings.html, transactions.html) that all share this one script file.
   Each page only contains the markup for its own feature, so every
   init step below is wrapped defensively: a missing element on a given
   page must never throw and blank out the rest of the page. */
document.addEventListener('DOMContentLoaded', async () => {
  await hydrateFromAPI();
  applyLiveKPIs();
  const username = sessionStorage.getItem('sentinel_username') || 'admin';
  const display = username.replace(/[._]/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
  const welcomeEl = document.getElementById('welcomeHeading');
  if(welcomeEl) welcomeEl.textContent = 'Welcome, ' + display;
  const nameChip = document.getElementById('userNameChip');
  if(nameChip) nameChip.textContent = display;
  const avatar = document.getElementById('userAvatar');
  if(avatar) avatar.textContent = display.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  updateThemeIcon();

  const steps = [
    initSidebarNav, initMobileSidebar, initCounters, initGauges,
    initRiskEngineView, initCharts, initTransactionsTable, initVendorGrid,
    initAuditTable, initAdvisor, initNotifications, initSystemStatus,
    initKillSwitch, initLimitsView, initFreezeHistory, initFirewallSimulator,
    initModals, initMisc
  ];
  steps.forEach(fn => {
    try{ fn(); }
    catch(err){ console.warn('[SENTINEL] skipped', fn.name, '—', err.message); }
  });

  showToast('info', 'Firewall active', 'Monitoring all agent wallets in real time.');

  if(typeof SentinelAPI !== 'undefined' && SentinelAPI.getToken()){
    SentinelAPI.connectWS((msg) => {
      if(msg.channel === 'notifications' && msg.data){
        showToast(msg.data.type, 'Live update', msg.data.text.replace(/<[^>]+>/g, ''));
        NOTIFICATIONS.unshift({ id: msg.data.id, type: msg.data.type, text: msg.data.text, time: fmtTime(msg.data.created_at), read: msg.data.read });
        refreshNotificationViews();
        try{ initFreezeHistory(); }catch(e){}
      }
      if(msg.channel === 'killswitch' && msg.data){
        showToast(msg.data.is_active ? 'danger' : 'success', 'Kill switch',
          msg.data.is_active ? 'AI spending has been frozen.' : 'AI spending resumed.');
        if(typeof setKillSwitch === 'function') setKillSwitch(!!msg.data.is_active);
      }
      if(msg.channel === 'transactions' && msg.data){
        // A firewall decision happened elsewhere — refresh from the API so
        // every open tab/page shows the same list without a manual reload.
        SentinelAPI.transactions({ page_size: 50 }).then(txPage => {
          TRANSACTIONS.length = 0;
          TRANSACTIONS.push(...(txPage.items || []).map(t => ({
            id: shortId(t.id, 'TX'), vendor: t.vendors?.name || 'Unknown Vendor', amount: parseFloat(t.amount),
            risk: t.risk_score || 0, status: txStatusLabel(t.status), time: fmtTime(t.created_at),
            wallet: t.wallet_id ? ('0x' + t.wallet_id.replace(/-/g,'').slice(0,4) + '…' + t.wallet_id.slice(-4)) : '—',
          })));
          refreshTransactionViews();
        }).catch(() => {});
      }
      if(msg.channel === 'vendors' && msg.data){
        const { action, vendor, vendor_id } = msg.data;
        if(action === 'deleted'){
          const idx = VENDORS.findIndex(v => v.id === vendor_id);
          if(idx !== -1) VENDORS.splice(idx, 1);
        } else if(vendor){
          const mapped = { id: vendor.id, name: vendor.name, cat: vendor.category || '', rep: vendor.reputation_score ?? 50,
            status: capitalize(vendor.status), color: vendor.color || '#6366F1', tx: 0 };
          const idx = VENDORS.findIndex(v => v.id === vendor.id);
          if(idx !== -1) VENDORS[idx] = mapped; else VENDORS.push(mapped);
        }
        if(typeof drawVendors === 'function') drawVendors();
      }
      if(msg.channel === 'limits' && msg.data){
        setLimitField('maxTxInput','maxTxRange', msg.data.per_transaction);
        setLimitField('dailyLimitInput','dailyLimitRange', msg.data.daily);
        setLimitField('monthlyLimitInput','monthlyLimitRange', msg.data.monthly);
        updateUsageBars(msg.data);
      }
    });
  }
});

/* ---------------- Sidebar / cross-page routing ----------------
   Navigation is now real <a href="…"> links between standalone pages
   (each nav item's href matches its data-view, e.g. href="firewall.html").
   We just need to (a) highlight whichever item matches the current page
   and (b) keep switchView() working as a navigation helper for the many
   in-page buttons/links that call switchView('killswitch') etc. */
function initSidebarNav(){
  const file = (location.pathname.split('/').pop() || 'dashboard.html').replace('.html','') || 'dashboard';
  document.querySelectorAll('.nav-item[data-view]').forEach(item=>{
    item.classList.toggle('active', item.dataset.view === file);
  });
  const logout = document.getElementById('logoutBtn');
  if(logout) logout.addEventListener('click', (e)=>{
    e.preventDefault();
    if(typeof SentinelAPI !== 'undefined') SentinelAPI.clearSession();
    sessionStorage.removeItem('sentinel_username');
    showToast('info','Logged out','Redirecting to the login page…');
    setTimeout(()=> window.location.href = 'login.html', 700);
  });
}
function switchView(view){
  window.location.href = view + '.html';
}

function initMobileSidebar(){
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('sidebarScrim');
  document.getElementById('menuToggle').addEventListener('click', ()=>{
    sidebar.classList.add('open'); scrim.classList.add('show');
  });
  scrim.addEventListener('click', closeMobileSidebar);
}
function closeMobileSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarScrim').classList.remove('show');
}

/* ---------------- Counter animations ---------------- */
function initCounters(){
  document.querySelectorAll('.kpi-value[data-count]').forEach(el=>{
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix !== undefined ? el.dataset.suffix : '';
    const isDecimal = target % 1 !== 0;
    const duration = 1000;
    const start = performance.now();
    function step(now){
      const p = Math.min(1, (now-start)/duration);
      const eased = 1 - Math.pow(1-p, 3);
      const val = target * eased;
      el.textContent = prefix + (isDecimal ? val.toFixed(2) : Math.round(val).toLocaleString()) + suffix;
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* ---------------- Live KPI wiring ----------------
   dashboard.html ships with baked-in data-count values so the counters
   still look right in demo mode; when we have live data we overwrite
   those attributes before initCounters() reads and animates them. */
function applyLiveKPIs(){
  const summary = window.SENTINEL_SUMMARY;
  if(!summary || !summary.analytics) return;
  const a = summary.analytics;
  const set = (id, count) => {
    const el = document.getElementById(id);
    if(el && count !== undefined && count !== null) el.dataset.count = count;
  };
  set('kpiTodaySpend', a.today_spend);
  set('kpiApprovedToday', a.approved_today);
  set('kpiBlockedToday', a.blocked_today);
  set('kpiAvgRisk', a.avg_risk_score);

  const agents = window.SENTINEL_AGENTS || [];
  const activeCount = agents.filter(ag => ag.status === 'active').length;
  set('kpiActiveAgentsValue', summary.active_agents_count ?? activeCount);
  const delta = document.getElementById('kpiActiveAgentsDelta');
  if(delta) delta.textContent = `of ${summary.total_agents_count ?? agents.length} total`;
}

/* ---------------- Gauges ---------------- */
function initGauges(){
  const summary = window.SENTINEL_SUMMARY;
  const score = (summary && summary.analytics && summary.analytics.avg_risk_score) || (SENTINEL_LIVE ? 0 : 72);
  renderGauge('dashGauge', score);
  const dashBadge = document.getElementById('dashGaugeBadge');
  if(dashBadge){ dashBadge.textContent = riskLabel(score); dashBadge.setAttribute('style', badgeStyleFor(score)); }

  renderGauge('securityGauge', 91, { color: getComputedStyleVar('--success'), ticks: [] });
}
function getComputedStyleVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

/* ---------------- Risk Engine: interactive decision queue ---------------- */
function initRiskEngineView(){
  const queue = document.getElementById('riskQueue');
  if(!queue) return;
  if(!TRANSACTIONS.length){
    queue.innerHTML = '<p class="text-secondary" style="padding:16px 4px;">No transactions yet — once your agents make a payment, it\u2019ll show up here for risk review.</p>';
    const gaugeSub = document.getElementById('riskGaugeSub');
    renderGauge('riskGauge', 0);
    const badge = document.getElementById('riskGaugeBadge');
    if(badge){ badge.textContent = riskLabel(0); badge.setAttribute('style', badgeStyleFor(0)); }
    if(gaugeSub) gaugeSub.textContent = 'No transactions scored yet';
    const explain = document.getElementById('riskExplain');
    if(explain) explain.textContent = 'Nothing to explain yet — this fills in as soon as your first transaction is scored.';
    const factorsEl = document.getElementById('riskFactors');
    if(factorsEl) factorsEl.innerHTML = '';
    const band = document.getElementById('riskDecision');
    if(band){ band.className = 'decision-band'; band.innerHTML = ''; }
    return;
  }
  queue.innerHTML = TRANSACTIONS.slice(0, 6).map(t => `
    <button class="rq-item" data-id="${t.id}" role="option">
      <div class="rq-vendor">${t.vendor}</div>
      <div class="rq-meta"><span>$${t.amount.toFixed(2)}</span><span class="rq-score" style="color:${riskColor(t.risk)}">${t.risk}/100</span></div>
    </button>
  `).join('');
  queue.querySelectorAll('.rq-item').forEach(btn => {
    btn.addEventListener('click', () => selectRiskTx(btn.dataset.id));
  });
  // Default to a "held for review" case if one exists so the view shows the
  // full decision range; otherwise just show the most recent transaction.
  const defaultTx = TRANSACTIONS.find(t => t.status === 'Review') || TRANSACTIONS[0];
  selectRiskTx(defaultTx.id);
}

function selectRiskTx(id){
  const tx = TRANSACTIONS.find(t => t.id === id);
  if(!tx) return;

  document.querySelectorAll('.rq-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));

  const factors = computeFactorsForTx(tx);
  const decision = decisionForScore(tx.risk);

  renderGauge('riskGauge', tx.risk);
  const badge = document.getElementById('riskGaugeBadge');
  badge.textContent = riskLabel(tx.risk);
  badge.setAttribute('style', badgeStyleFor(tx.risk));
  document.getElementById('riskGaugeSub').textContent = `${tx.vendor} · $${tx.amount.toFixed(2)} · ${tx.id}`;
  document.getElementById('riskExplain').textContent = explainForFactors(factors, tx.risk);

  const band = document.getElementById('riskDecision');
  band.className = 'decision-band ' + decision.cls;
  band.innerHTML = `<span class="db-icon">${decision.icon}</span><span>${decision.label}</span>`;

  renderRiskFactors('riskFactors', factors);
}

/* ---------------- Chart data derivation (real, from live state) ----------------
   All of these read from TRANSACTIONS / VENDORS / window.SENTINEL_SUMMARY,
   which by the time initCharts() runs already hold this account's real
   (possibly empty) data. Every helper degrades to zeros/empty for a fresh
   account instead of inventing numbers. */
function lastNDayLabels(n){
  const labels = [], keys = [];
  const now = new Date();
  for(let i=n-1;i>=0;i--){
    const d = new Date(now); d.setDate(now.getDate()-i);
    labels.push(d.toLocaleDateString([], { month:'short', day:'numeric' }));
    keys.push(d.toDateString());
  }
  return { labels, keys };
}
function txDayBuckets(n){
  const { labels, keys } = lastNDayLabels(n);
  const approved = new Array(n).fill(0), blocked = new Array(n).fill(0);
  TRANSACTIONS.forEach(t=>{
    if(!t.raw) return;
    const key = new Date(t.raw).toDateString();
    const idx = keys.indexOf(key);
    if(idx === -1) return;
    if(t.status === 'Approved') approved[idx]++;
    else if(t.status === 'Blocked') blocked[idx]++;
  });
  return { labels, approved, blocked };
}
function txStatusCounts(){
  return {
    approved: TRANSACTIONS.filter(t=>t.status==='Approved').length,
    review: TRANSACTIONS.filter(t=>t.status==='Review').length,
    blocked: TRANSACTIONS.filter(t=>t.status==='Blocked').length,
  };
}
function blockedReasonCounts(){
  const reasons = { 'High risk':0, 'Unknown vendor':0, 'Policy':0, 'Other':0 };
  TRANSACTIONS.filter(t=>t.status==='Blocked').forEach(t=>{
    if(t.vendor === 'Unknown Vendor') reasons['Unknown vendor']++;
    else if(t.risk >= 70) reasons['High risk']++;
    else if(t.risk >= 40) reasons['Policy']++;
    else reasons['Other']++;
  });
  return reasons;
}
function topVendorsBySpend(limit){
  const totals = {};
  TRANSACTIONS.forEach(t=>{ totals[t.vendor] = (totals[t.vendor]||0) + (t.amount||0); });
  return Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0, limit)
    .map(([vendor, amount])=>({ vendor, amount: Math.round(amount) }));
}
function weekOfMonthBuckets(){
  const totals = [0,0,0,0];
  const now = new Date();
  TRANSACTIONS.forEach(t=>{
    if(!t.raw) return;
    const d = new Date(t.raw);
    if(d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
    const week = Math.min(3, Math.floor((d.getDate()-1)/7));
    totals[week]++;
  });
  return totals;
}
function hourOfDayBuckets(){
  const slots = ['12a','3a','6a','9a','12p','3p','6p','9p'];
  const totals = new Array(8).fill(0);
  TRANSACTIONS.forEach(t=>{
    if(!t.raw) return;
    const h = new Date(t.raw).getHours();
    totals[Math.floor(h/3)]++;
  });
  return { slots, totals };
}
function categorySpendSegments(){
  const catByVendor = {};
  VENDORS.forEach(v=>{ catByVendor[v.name] = v.cat || 'Uncategorized'; });
  const totals = {};
  TRANSACTIONS.forEach(t=>{
    const cat = catByVendor[t.vendor] || 'Uncategorized';
    totals[cat] = (totals[cat]||0) + (t.amount||0);
  });
  const palette = [cssVar('--primary'), cssVar('--accent'), cssVar('--success'), cssVar('--warning'), cssVar('--danger')];
  return Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([label, value], i)=>({ label, value: Math.round(value), color: palette[i % palette.length] }));
}

/* ---------------- Charts ---------------- */
function initCharts(){
  if(SENTINEL_LIVE){ initLiveCharts(); return; }
  initDemoCharts();
}

/* Real charts, built entirely from this account's live data. A fresh
   account with nothing yet will correctly render flat/empty charts rather
   than the demo numbers. */
function initLiveCharts(){
  const summary = window.SENTINEL_SUMMARY;
  const analytics = (summary && summary.analytics) || {};

  const { labels, approved, blocked } = txDayBuckets(14);
  const seriesConfig = () => [
    { data: approved.length ? approved : [0], color: cssVar('--success') || '#22C55E' },
    { data: blocked.length ? blocked : [0], color: cssVar('--danger') || '#EF4444' },
  ];
  renderLineChart('chartSpendTrend', seriesConfig());
  renderLineChart('chartOverviewTrend', seriesConfig());

  renderBarChart('chartMonthlyUsage', ['W1','W2','W3','W4'], weekOfMonthBuckets(), cssVar('--primary'));

  const reasons = blockedReasonCounts();
  renderBarChart('chartBlocked', Object.keys(reasons), Object.values(reasons), cssVar('--danger'));

  const counts = txStatusCounts();
  const total = counts.approved + counts.review + counts.blocked;
  const donutSegs = total ? [
    { value: counts.approved, color: cssVar('--success') },
    { value: counts.review,  color: cssVar('--warning') },
    { value: counts.blocked, color: cssVar('--danger') },
  ] : [{ value: 1, color: 'rgba(148,163,184,0.25)' }];
  renderDonutChart('chartRiskDist', donutSegs, { value: String(total), label:'payments' });
  renderDonutChart('chartRiskDist2', donutSegs, { value: String(total), label:'payments' });
  renderHBarChart('chartOverviewStatus', ['Approved','Review','Blocked'], [counts.approved, counts.review, counts.blocked], cssVar('--primary'));

  const topVendors = topVendorsBySpend(5);
  if(topVendors.length){
    renderHBarChart('chartTopVendors', topVendors.map(v=>v.vendor), topVendors.map(v=>v.amount), cssVar('--primary'));
  } else {
    renderHBarChart('chartTopVendors', [], [], cssVar('--primary'));
  }

  const catSegs = categorySpendSegments();
  const monthlySpend = analytics.monthly_spend ?? 0;
  renderDonutChart('chartOverviewCategory',
    catSegs.length ? catSegs.map(c=>({ value:c.value, color:c.color })) : [{ value:1, color:'rgba(148,163,184,0.25)' }],
    { value: '$' + monthlySpend.toLocaleString(), label:'this month' });

  const { slots, totals } = hourOfDayBuckets();
  renderBarChart('chartOverviewPeak', slots, totals, cssVar('--accent'));

  let t;
  window.addEventListener('resize', ()=>{
    clearTimeout(t);
    t = setTimeout(()=>{
      renderLineChart('chartSpendTrend', seriesConfig());
      renderLineChart('chartOverviewTrend', seriesConfig());
      renderHBarChart('chartOverviewStatus', ['Approved','Review','Blocked'], [counts.approved, counts.review, counts.blocked], cssVar('--primary'));
      renderDonutChart('chartOverviewCategory',
        catSegs.length ? catSegs.map(c=>({ value:c.value, color:c.color })) : [{ value:1, color:'rgba(148,163,184,0.25)' }],
        { value: '$' + monthlySpend.toLocaleString(), label:'this month' });
      renderBarChart('chartOverviewPeak', slots, totals, cssVar('--accent'));
      const analyticsView = document.getElementById('view-analytics');
      if(analyticsView && analyticsView.classList.contains('active')){
        renderLineChart('chartAnalyticsSpend', seriesConfig());
        renderBarChart('chartMonthlyUsage', ['W1','W2','W3','W4'], weekOfMonthBuckets(), cssVar('--primary'));
        renderBarChart('chartBlocked', Object.keys(reasons), Object.values(reasons), cssVar('--danger'));
        renderDonutChart('chartRiskDist2', donutSegs, { value: String(total), label:'payments' });
        if(topVendors.length) renderHBarChart('chartTopVendors', topVendors.map(v=>v.vendor), topVendors.map(v=>v.amount), cssVar('--primary'));
      }
    }, 250);
  });

  renderLineChart('chartAnalyticsSpend', seriesConfig());
}

/* Demo-only fallback (unauthenticated preview or API completely
   unreachable). Never used once we have a real, hydrated session. */
function initDemoCharts(){
  const days = ['Jul 18','19','20','21','22','23','24','25','26','27','28','29','30','31'];
  const approved = [14,16,12,18,20,15,19,22,17,21,24,20,23,24];
  const blocked  = [2,1,3,1,0,2,1,2,3,1,2,1,2,3];
  const seriesConfig = () => [
    { data: approved, color: cssVar('--success') || '#22C55E' },
    { data: blocked,  color: cssVar('--danger')  || '#EF4444' }
  ];
  renderLineChart('chartSpendTrend', seriesConfig());
  renderLineChart('chartAnalyticsSpend', seriesConfig());

  renderBarChart('chartMonthlyUsage', ['W1','W2','W3','W4'], [18,24,29,30], cssVar('--primary'));
  renderBarChart('chartBlocked', ['High risk','Unknown vendor','Policy','Limit'], [6,4,2,1], cssVar('--danger'));

  const donutSegs = [
    { value:24, color: cssVar('--success') },
    { value:3,  color: cssVar('--warning') },
    { value:3,  color: cssVar('--danger') }
  ];
  renderDonutChart('chartRiskDist', donutSegs, { value:'30', label:'payments' });
  renderDonutChart('chartRiskDist2', donutSegs, { value:'30', label:'payments' });

  renderHBarChart('chartTopVendors', ['Stripe','Amazon AWS','OpenAI','Azure','Google Cloud'], [4820,3960,2870,2210,1640], cssVar('--primary'));

  /* ---- Stripe-style "payments overview" strip on the dashboard ---- */
  renderLineChart('chartOverviewTrend', seriesConfig());
  renderHBarChart('chartOverviewStatus', ['Approved','Review','Blocked'], [24, 5, 3], cssVar('--primary'));
  const categorySegs = [
    { value:38, color: cssVar('--primary') },
    { value:26, color: cssVar('--accent') },
    { value:22, color: cssVar('--success') },
    { value:14, color: cssVar('--warning') }
  ];
  renderDonutChart('chartOverviewCategory', categorySegs, { value:'$15.2k', label:'this month' });
  renderBarChart('chartOverviewPeak', ['12a','3a','6a','9a','12p','3p','6p','9p'], [3,1,2,9,14,18,11,6], cssVar('--accent'));

  // re-render on resize (debounced)
  let t;
  window.addEventListener('resize', ()=>{
    clearTimeout(t);
    t = setTimeout(()=>{
      renderLineChart('chartSpendTrend', seriesConfig());
      renderLineChart('chartOverviewTrend', seriesConfig());
      renderHBarChart('chartOverviewStatus', ['Approved','Review','Blocked'], [24, 5, 3], cssVar('--primary'));
      renderDonutChart('chartOverviewCategory', categorySegs, { value:'$15.2k', label:'this month' });
      renderBarChart('chartOverviewPeak', ['12a','3a','6a','9a','12p','3p','6p','9p'], [3,1,2,9,14,18,11,6], cssVar('--accent'));
      const analyticsView = document.getElementById('view-analytics');
      if(analyticsView && analyticsView.classList.contains('active')){
        renderLineChart('chartAnalyticsSpend', seriesConfig());
        renderBarChart('chartMonthlyUsage', ['W1','W2','W3','W4'], [18,24,29,30], cssVar('--primary'));
        renderBarChart('chartBlocked', ['High risk','Unknown vendor','Policy','Limit'], [6,4,2,1], cssVar('--danger'));
        renderDonutChart('chartRiskDist2', donutSegs, { value:'30', label:'payments' });
        renderHBarChart('chartTopVendors', ['Stripe','Amazon AWS','OpenAI','Azure','Google Cloud'], [4820,3960,2870,2210,1640], cssVar('--primary'));
      }
    }, 250);
  });
}

/* ---------------- Transactions table ---------------- */
function statusBadge(status){
  const map = { Approved:'success', Blocked:'danger', Review:'warning', Completed:'success' };
  return `<span class="badge ${map[status]||'neutral'}">${status}</span>`;
}
function renderTxRows(list){
  return list.map(t => `
    <tr>
      <td class="cell-mono">${t.id}</td>
      <td>${t.vendor}</td>
      <td class="mono">$${t.amount.toFixed(2)}</td>
      <td><span style="color:${t.risk>=70?'var(--danger)':t.risk>=40?'var(--warning)':'var(--success)'};font-family:var(--font-mono);font-weight:700;">${t.risk}</span></td>
      <td>${statusBadge(t.status)}</td>
      <td class="cell-mono">${t.time}</td>
    </tr>`).join('');
}
function renderDashRecentTable(){
  const dashTable = document.getElementById('dashRecentTable');
  if(dashTable){
    dashTable.innerHTML = `<thead><tr><th>Tx ID</th><th>Vendor</th><th>Amount</th><th>Risk</th><th>Status</th><th>Time</th></tr></thead>
      <tbody>${renderTxRows(TRANSACTIONS.slice(0,6))}</tbody>`;
  }
}
function drawTxTable(){
  const txTable = document.getElementById('txTable');
  const txSearch = document.getElementById('txSearch');
  if(!txTable || !txSearch) return;
  const q = txSearch.value.toLowerCase();
  const active = document.querySelector('.filter-chip.active[data-fx]')?.dataset.fx || 'all';
  let list = TRANSACTIONS.filter(t => (t.vendor.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)));
  if(active !== 'all') list = list.filter(t => t.status === active);
  txTable.innerHTML = `<thead><tr><th>Tx ID</th><th>Vendor</th><th>Amount</th><th>Risk</th><th>Status</th><th>Time</th></tr></thead>
    <tbody>${list.length ? renderTxRows(list) : '<tr><td colspan="6" class="text-secondary" style="padding:24px;text-align:center;">No transactions match your search.</td></tr>'}</tbody>`;
}
function refreshTransactionViews(){
  renderDashRecentTable();
  drawTxTable();
}
function initTransactionsTable(){
  renderDashRecentTable();

  const txTable = document.getElementById('txTable');
  const txSearch = document.getElementById('txSearch');
  if(!txTable || !txSearch) return;
  txSearch.addEventListener('input', drawTxTable);
  document.querySelectorAll('.filter-chip[data-fx]').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      document.querySelectorAll('.filter-chip[data-fx]').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      drawTxTable();
    });
  });
  drawTxTable();
}

/* ---------------- Vendors ---------------- */
function starString(rep){
  const stars = Math.round(rep/20);
  return '★'.repeat(stars) + `<span class="off">${'★'.repeat(5-stars)}</span>`;
}
function vendorBadgeClass(status){ return status==='Approved'?'success':status==='Pending'?'warning':'danger'; }

function renderVendorCards(list){
  const grid = document.getElementById('vendorGrid');
  if(!list.length){ grid.innerHTML = '<p class="text-secondary" style="padding:24px;">No vendors match your search.</p>'; return; }
  grid.innerHTML = list.map(v => `
    <div class="vendor-card">
      <div class="vendor-card-top">
        <div class="vendor-logo" style="background:${v.color}">${v.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
        <div><div class="vc-name">${v.name}</div><div class="vc-cat">${v.cat}</div></div>
      </div>
      <div class="vendor-score-row">
        <span class="stars">${starString(v.rep)}</span>
        <span class="mono" style="font-size:12px;color:var(--text-secondary);">${v.rep}/100</span>
      </div>
      <div class="flex-between">
        <span class="badge ${vendorBadgeClass(v.status)}">${v.status}</span>
        <div class="vendor-card-actions">
          <button class="link-icon-btn" title="View" onclick="showToast('info','${v.name}','${v.tx} payments this month · reputation ${v.rep}/100')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
          </button>
          <button class="link-icon-btn" title="Remove" onclick="removeVendor('${v.name}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>
    </div>`).join('');
}
async function removeVendor(name){
  const idx = VENDORS.findIndex(v=>v.name===name);
  if(idx === -1) return;
  const vendor = VENDORS[idx];
  if(typeof SentinelAPI !== 'undefined' && SentinelAPI.getToken() && vendor.id){
    try{ await SentinelAPI.deleteVendor(vendor.id); }
    catch(err){ showToast('danger','Could not remove vendor', err.message); return; }
  }
  VENDORS.splice(idx,1);
  drawVendors();
  showToast('warning','Vendor removed', name + ' was removed from the allowlist.');
}
function drawVendors(){
  const search = document.getElementById('vendorSearch');
  if(!search || !document.getElementById('vendorGrid')) return;
  const q = search.value.toLowerCase();
  const active = document.querySelector('.filter-chip.active[data-vfx]')?.dataset.vfx || 'all';
  let list = VENDORS.filter(v => v.name.toLowerCase().includes(q));
  if(active !== 'all') list = list.filter(v => v.status === active);
  renderVendorCards(list);
}
function initVendorGrid(){
  if(!document.getElementById('vendorGrid')) return;
  drawVendors();
  const search = document.getElementById('vendorSearch');
  if(search) search.addEventListener('input', drawVendors);
  document.querySelectorAll('.filter-chip[data-vfx]').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      document.querySelectorAll('.filter-chip[data-vfx]').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      drawVendors();
    });
  });
}

/* ---------------- Audit trail ---------------- */
function initAuditTable(){
  const table = document.getElementById('auditTable');
  if(!table) return;
  if(!AUDIT.length){
    table.innerHTML = `<thead><tr><th>Tx ID</th><th>Wallet</th><th>Timestamp</th><th>Hash</th><th>Status</th><th>Explorer</th></tr></thead>
      <tbody><tr><td colspan="6" class="text-secondary" style="padding:24px;text-align:center;">No audit entries yet — every approved, blocked and reviewed payment will be logged here.</td></tr></tbody>`;
    return;
  }
  table.innerHTML = `<thead><tr><th>Tx ID</th><th>Wallet</th><th>Timestamp</th><th>Hash</th><th>Status</th><th>Explorer</th></tr></thead>
    <tbody>${AUDIT.map(a => `
      <tr>
        <td class="cell-mono">${a.id}</td>
        <td class="cell-mono">${a.wallet}</td>
        <td class="cell-mono">Today, ${a.time}</td>
        <td class="cell-mono">${a.hash}</td>
        <td>${statusBadge(a.status==='Review'?'Review':a.status)}</td>
        <td><a class="link-icon-btn" title="View on explorer" onclick="showToast('info','Explorer (demo)','Block ${a.block} · ${a.hash}')" style="display:inline-flex;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v7H3V3h7"/></svg>
        </a></td>
      </tr>`).join('')}</tbody>`;
}
function exportData(format, section){
  showToast('success', 'Export started', `Generating ${format.toUpperCase()} for ${section}… this is a UI-only demo.`);
}

/* ---------------- AI Advisor ---------------- */
const ADVISOR_ICONS = {
  up: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  down: '<path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.5 12.5 21 2M18 5l3 3M15 8l2 2"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'
};
function initAdvisor(){
  const el = document.getElementById('advisorList');
  if(!el) return;
  if(!ADVISOR.length){
    el.innerHTML = '<p class="text-secondary" style="padding:24px;">No recommendations yet — the advisor learns from your transaction and vendor activity, so check back once your agents start transacting.</p>';
    return;
  }
  el.innerHTML = ADVISOR.map(a => `
    <div class="advisor-item" data-rec-id="${a.id || ''}">
      <div class="advisor-icon" style="background:${a.priority==='high'?'rgba(239,68,68,0.14)':a.priority==='medium'?'rgba(245,158,11,0.14)':'rgba(37,99,235,0.14)'};color:${a.priority==='high'?'var(--danger)':a.priority==='medium'?'var(--warning)':'var(--primary)'}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ADVISOR_ICONS[a.icon]}</svg>
      </div>
      <div class="advisor-body">
        <div class="advisor-top"><span class="advisor-title">${a.title}</span><span class="priority-tag ${a.priority}">${a.priority}</span></div>
        <div class="advisor-reason">${a.reason}</div>
        <div class="advisor-foot">
          <span class="advisor-action">${a.action}</span>
          ${a.id ? `
          <span class="advisor-buttons">
            ${a.recType ? `<button type="button" class="btn-small btn-primary" onclick="applyAdvisorRec('${a.id}')">Apply</button>` : ''}
            <button type="button" class="btn-small" onclick="dismissAdvisorRec('${a.id}')">Dismiss</button>
          </span>` : ''}
        </div>
      </div>
    </div>`).join('');
}
async function applyAdvisorRec(id){
  try{
    await SentinelAPI.applyRecommendation(id);
    showToast('success', 'Applied', 'The recommendation was applied.');
    const recs = await SentinelAPI.recommendations();
    ADVISOR.length = 0;
    ADVISOR.push(...recs.map(r => ({ id: r.id, recType: r.rec_type || null, title: r.title, reason: r.reason, action: r.suggested_action, priority: r.priority, icon: iconForRecommendation(r.title) })));
    initAdvisor();
  }catch(err){
    showToast('danger', 'Could not apply', err.message || 'Something went wrong.');
  }
}
async function dismissAdvisorRec(id){
  try{
    await SentinelAPI.dismissRecommendation(id);
    const el = document.querySelector(`.advisor-item[data-rec-id="${id}"]`);
    if(el) el.remove();
  }catch(err){
    showToast('danger', 'Could not dismiss', err.message || 'Something went wrong.');
  }
}

/* ---------------- Notifications ---------------- */
const NOTIF_ICON = {
  success: '<path d="m20 6-11 11-5-5"/>',
  danger: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 12v4"/>'
};
function feedHtml(items){
  if(!items.length) return '<p class="text-secondary" style="padding:16px 4px;">Nothing here yet.</p>';
  return items.map(n => `
    <div class="feed-item">
      <div class="feed-dot" style="background:${n.type==='success'?'rgba(34,197,94,0.14)':n.type==='danger'?'rgba(239,68,68,0.14)':n.type==='warning'?'rgba(245,158,11,0.14)':'rgba(37,99,235,0.14)'};color:${n.type==='success'?'var(--success)':n.type==='danger'?'var(--danger)':n.type==='warning'?'var(--warning)':'var(--primary)'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${NOTIF_ICON[n.type]}</svg>
      </div>
      <div><div class="feed-text">${n.text}</div><div class="feed-time">${n.time}</div></div>
    </div>`).join('');
}
function refreshNotificationViews(){
  const dashFeed = document.getElementById('dashFeed');
  if(dashFeed) dashFeed.innerHTML = feedHtml(NOTIFICATIONS.slice(0,5));
  const fullList = document.getElementById('notifFullList');
  if(fullList) fullList.innerHTML = feedHtml(NOTIFICATIONS);
  const navBadge = document.getElementById('notifNavBadge');
  if(navBadge){
    const unreadCount = NOTIFICATIONS.filter(n => !n.read).length;
    navBadge.textContent = unreadCount;
    navBadge.classList.toggle('hidden', unreadCount === 0);
  }
}
function initNotifications(){
  refreshNotificationViews();
  const markAllBtn = document.getElementById('markAllReadBtn');
  if(markAllBtn) markAllBtn.addEventListener('click', async ()=>{
    if(typeof SentinelAPI !== 'undefined' && SentinelAPI.getToken()){
      const unread = NOTIFICATIONS.filter(n => n.id && !n.read);
      await Promise.allSettled(unread.map(n => SentinelAPI.markNotificationRead(n.id)));
      unread.forEach(n => n.read = true);
    }
    const navBadge = document.getElementById('notifNavBadge');
    if(navBadge) navBadge.classList.add('hidden');
    showToast('success','All caught up','Notifications marked as read.');
  });
}

/* ---------------- System status ---------------- */
function initSystemStatus(){
  const el = document.getElementById('systemStatusList');
  if(!el) return;
  el.innerHTML = SYSTEM_STATUS.map(s => `
    <div class="flex-between" style="padding:11px 0;border-bottom:1px solid var(--card-border);">
      <span style="font-size:13.5px;">${s.name}</span>
      <span class="badge ${s.ok?'success':'danger'}">${s.ok?'Active':'Frozen'}</span>
    </div>`).join('');
}

/* ---------------- Kill switch ---------------- */
function setKillSwitch(frozen){
  killswitchFrozen = frozen;
  const card = document.getElementById('killswitchCard');
  const btn = document.getElementById('ksBtn');
  const label = document.getElementById('ksBtnLabel');
  const badge = document.getElementById('ksBadge');
  const badgeText = document.getElementById('ksBadgeText');
  const heading = document.getElementById('ksHeading');
  const sub = document.getElementById('ksSub');
  const mini = document.getElementById('miniKsBadge');
  const miniText = document.getElementById('miniKsBadgeText');
  const sideDot = document.getElementById('sidebarStatusDot');
  const sideText = document.getElementById('sidebarStatusText');

  if(card) card.classList.toggle('frozen', frozen);
  if(btn) btn.classList.toggle('is-frozen', frozen);
  if(label) label.textContent = frozen ? 'UNFREEZE' : 'FREEZE ALL';
  if(badge){ badge.classList.toggle('active', !frozen); badge.classList.toggle('frozen', frozen); }
  if(badgeText) badgeText.textContent = frozen ? 'FROZEN' : 'ACTIVE';
  if(heading) heading.textContent = frozen ? 'All agent activity is frozen' : 'All systems operational';
  if(sub) sub.textContent = frozen
    ? 'Transactions, wallet access and session keys are disabled until you unfreeze.'
    : 'Your agents are transacting normally within policy. Press freeze to instantly stop all wallet activity.';
  if(mini){ mini.classList.toggle('active', !frozen); mini.classList.toggle('frozen', frozen); }
  if(miniText) miniText.textContent = frozen ? 'FROZEN' : 'FIREWALL ACTIVE';
  if(sideDot) sideDot.style.background = frozen ? 'var(--danger)' : 'var(--success)';
  if(sideText) sideText.textContent = frozen ? 'Kill switch engaged · frozen' : 'Firewall active · 0 threats';

  document.querySelectorAll('.ks-action-item').forEach(i => i.classList.toggle('checked', frozen));
  SYSTEM_STATUS[1].ok = !frozen;
  initSystemStatus();
}
async function initKillSwitch(){
  const btn = document.getElementById('ksBtn');
  if(!btn) return;

  if(typeof SentinelAPI !== 'undefined' && SentinelAPI.getToken()){
    try{
      const state = await SentinelAPI.killswitchState();
      setKillSwitch(!!state.is_active);
    }catch(err){ /* keep default UI state if this fails */ }
  }

  btn.addEventListener('click', async ()=>{
    if(killswitchFrozen){
      await callToggleKillswitch(false, null);
      setKillSwitch(false);
      showToast('success','Firewall unfrozen','Agents may resume transacting within policy.');
    } else {
      openKsModal();
    }
  });
}
async function callToggleKillswitch(isActive, reason){
  if(typeof SentinelAPI === 'undefined' || !SentinelAPI.getToken()) return;
  try{ await SentinelAPI.toggleKillswitch(isActive, reason); }
  catch(err){ showToast('danger','Kill switch update failed', err.message); }
}

/* Freeze / kill-switch history — derived from real notifications that
   mention the kill switch or an auto-freeze, so a brand-new account starts
   with an honest "no events yet" state instead of fabricated history. */
function initFreezeHistory(){
  const el = document.getElementById('freezeHistory');
  if(!el) return;
  const items = NOTIFICATIONS.filter(n => /kill switch|freeze|frozen/i.test(n.text || ''))
    .map(n => ({ text: n.text, time: n.time, type: n.type }));
  el.innerHTML = items.length ? feedHtml(items)
    : '<p class="text-secondary" style="padding:16px 4px;">No freeze events yet — this account hasn\u2019t triggered or used the kill switch.</p>';
}

/* ---------------- Limits editor ---------------- */
function updateUsageBars(limits){
  if(!document.getElementById('limitBarTx')) return; // not on limits.html
  const summary = window.SENTINEL_SUMMARY;
  const todaySpend = (summary && summary.analytics && summary.analytics.today_spend) || 0;
  const monthlySpend = (summary && summary.analytics && summary.analytics.monthly_spend) || 0;
  const largestTxToday = TRANSACTIONS.reduce((max, t) => Math.max(max, t.amount || 0), 0);

  const rows = [
    { used: largestTxToday, cap: limits.per_transaction, usageEl: 'limitUsageTx', barEl: 'limitBarTx' },
    { used: todaySpend, cap: limits.daily, usageEl: 'limitUsageDaily', barEl: 'limitBarDaily' },
    { used: monthlySpend, cap: limits.monthly, usageEl: 'limitUsageMonthly', barEl: 'limitBarMonthly' },
  ];
  rows.forEach(({ used, cap, usageEl, barEl }) => {
    if(!cap) return;
    const pct = Math.min(100, (used / cap) * 100);
    const usage = document.getElementById(usageEl);
    const bar = document.getElementById(barEl);
    if(usage){
      const foot = usage.closest('.limit-row')?.querySelector('.limit-foot');
      usage.textContent = `$${used.toFixed(2)} / $${cap.toLocaleString()}`;
      if(foot) foot.innerHTML = `<span>${pct.toFixed(1)}% used</span><span>Remaining $${Math.max(0, cap - used).toFixed(2)}</span>`;
    }
    if(bar){
      bar.style.width = pct + '%';
      bar.classList.toggle('warn', pct >= 75);
    }
  });
}
async function initLimitsView(){
  if(!document.getElementById('saveLimitsBtn')) return;
  linkRangeInput('maxTxRange','maxTxInput');
  linkRangeInput('dailyLimitRange','dailyLimitInput');
  linkRangeInput('monthlyLimitRange','monthlyLimitInput');

  let currentLimits = null;
  if(typeof SentinelAPI !== 'undefined' && SentinelAPI.getToken()){
    try{
      currentLimits = await SentinelAPI.limits();
      setLimitField('maxTxInput','maxTxRange', currentLimits.per_transaction);
      setLimitField('dailyLimitInput','dailyLimitRange', currentLimits.daily);
      setLimitField('monthlyLimitInput','monthlyLimitRange', currentLimits.monthly);
      updateUsageBars(currentLimits);
    }catch(err){ /* keep the default demo values shown in the markup */ }
  }

  document.getElementById('saveLimitsBtn').addEventListener('click', async ()=>{
    if(typeof SentinelAPI !== 'undefined' && SentinelAPI.getToken()){
      try{
        const updated = await SentinelAPI.updateLimits({
          per_transaction: parseFloat(document.getElementById('maxTxInput').value) || undefined,
          daily: parseFloat(document.getElementById('dailyLimitInput').value) || undefined,
          monthly: parseFloat(document.getElementById('monthlyLimitInput').value) || undefined,
        });
        updateUsageBars(updated);
      }catch(err){ showToast('danger','Could not save limits', err.message); return; }
    }
    showToast('success','Limits saved','New spending limits are now enforced on the firewall.');
  });
}
function setLimitField(textId, rangeId, value){
  if(value === null || value === undefined) return;
  const text = document.getElementById(textId);
  const range = document.getElementById(rangeId);
  if(text) text.value = value;
  if(range) range.value = value;
}
function linkRangeInput(rangeId, textId){
  const range = document.getElementById(rangeId);
  const text = document.getElementById(textId);
  if(!range || !text) return;
  range.addEventListener('input', ()=> text.value = range.value);
  text.addEventListener('input', ()=>{
    const v = parseInt(text.value.replace(/[^\d]/g,''), 10);
    if(!isNaN(v)) range.value = v;
  });
}

/* ---------------- Firewall simulator ---------------- */
function initFirewallSimulator(){
  const pipeline = document.getElementById('firewallPipeline');
  const btn = document.getElementById('simulatePaymentBtn');
  if(!pipeline || !btn) return;
  const steps = pipeline.querySelectorAll('.pf-step');
  const scenarios = [
    { vendor:'Amazon AWS', amount:120, outcome:'approved', reviewText:'Not required', outcomeText:'Approved & recorded' },
    { vendor:'Unknown Vendor', amount:500, outcome:'blocked', reviewText:'Escalated', outcomeText:'Blocked — unverified vendor' },
    { vendor:'Twilio', amount:340, outcome:'review', reviewText:'Pending owner approval', outcomeText:'Held for review' }
  ];
  let running = false;
  btn.addEventListener('click', ()=>{
    if(running) return;
    running = true;
    btn.disabled = true;
    const s = scenarios[Math.floor(Math.random()*scenarios.length)];
    document.getElementById('fwReqDetail').textContent = `Agent → ${s.vendor} · $${s.amount.toFixed(2)}`;
    document.getElementById('fwReviewDetail').textContent = s.reviewText;
    document.getElementById('fwOutcomeDetail').textContent = 'Evaluating…';
    steps.forEach(st => st.style.borderColor = '');
    let i = 0;
    const total = s.outcome === 'blocked' ? 4 : steps.length;
    function tick(){
      if(i < total){
        steps[i].style.borderColor = 'rgba(37,99,235,0.5)';
        steps[i].style.background = 'rgba(37,99,235,0.08)';
        i++;
        setTimeout(tick, 320);
      } else {
        const color = s.outcome === 'blocked' ? 'var(--danger)' : s.outcome === 'review' ? 'var(--warning)' : 'var(--success)';
        document.getElementById('fwOutcomeDetail').textContent = s.outcomeText;
        document.getElementById('fwOutcomeDetail').style.color = color;
        if(s.outcome === 'blocked'){
          showToast('danger','Payment blocked', `${s.vendor} · $${s.amount.toFixed(2)} — risk too high.`);
        } else if(s.outcome === 'review'){
          showToast('warning','Sent for review', `${s.vendor} · $${s.amount.toFixed(2)} needs owner approval.`);
        } else {
          showToast('success','Payment approved', `${s.vendor} · $${s.amount.toFixed(2)} recorded on-chain.`);
        }
        btn.disabled = false;
        running = false;
      }
    }
    tick();
  });
}

/* ---------------- Modals ---------------- */
function openModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
function openKsModal(){ openModal('ksModal'); }

function initModals(){
  // vendor modal (only present on vendors.html)
  if(document.getElementById('vendorModal')){
    document.getElementById('addVendorBtn').addEventListener('click', ()=> openModal('vendorModal'));
    document.getElementById('closeVendorModal').addEventListener('click', ()=> closeModal('vendorModal'));
    document.getElementById('cancelVendorModal').addEventListener('click', ()=> closeModal('vendorModal'));
    document.getElementById('confirmVendorModal').addEventListener('click', async ()=>{
      const name = document.getElementById('newVendorName').value.trim();
      const cat = document.getElementById('newVendorCat').value.trim() || 'Uncategorized';
      if(!name){ showToast('warning','Vendor name required','Please enter a vendor name.'); return; }
      const palette = ['#2563EB','#7C3AED','#22C55E','#F59E0B','#0EA5E9'];
      const color = palette[Math.floor(Math.random()*palette.length)];
      let newVendor = { name, cat, rep: 50, status:'Pending', color, tx:0 };
      if(typeof SentinelAPI !== 'undefined' && SentinelAPI.getToken()){
        try{
          const created = await SentinelAPI.createVendor({ name, category: cat, status: 'pending', color });
          newVendor = { id: created.id, name: created.name, cat: created.category || cat, rep: 50, status:'Pending', color, tx:0 };
        }catch(err){ showToast('danger','Could not add vendor', err.message); return; }
      }
      VENDORS.unshift(newVendor);
      drawVendors();
      closeModal('vendorModal');
      document.getElementById('newVendorName').value = '';
      document.getElementById('newVendorCat').value = '';
      showToast('info','Vendor pending review', name + ' was added and awaits reputation verification.');
    });
  }

  // kill switch modal (only present on killswitch.html)
  if(document.getElementById('ksModal')){
    document.getElementById('closeKsModal').addEventListener('click', ()=> closeModal('ksModal'));
    document.getElementById('cancelKsModal').addEventListener('click', ()=> closeModal('ksModal'));
    document.getElementById('confirmKsModal').addEventListener('click', async ()=>{
      closeModal('ksModal');
      await callToggleKillswitch(true, 'Manually engaged from dashboard');
      setKillSwitch(true);
      showToast('danger','Kill switch engaged','All agent wallets and session keys are frozen.');
    });
  }

  document.querySelectorAll('.modal-overlay').forEach(ov=>{
    ov.addEventListener('click', (e)=>{ if(e.target === ov) ov.classList.remove('show'); });
  });
}

/* ---------------- Misc: theme icon, search shortcut, profile save ---------------- */
function updateThemeIcon(){
  const icon = document.getElementById('themeIcon');
  const btn = document.getElementById('themeToggleBtn');
  if(!icon) return;
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const ICONS = {
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    slate: '<path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.3-2A5 5 0 0 0 6 18h11.5Z"/>',
    dark:  '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>'
  };
  icon.innerHTML = ICONS[theme] || ICONS.light;
  if(btn) btn.setAttribute('aria-label', 'Theme: ' + theme + ' (click to change)');
}
function initMisc(){
  const themeBtn = document.getElementById('themeToggleBtn');
  if(themeBtn) themeBtn.addEventListener('click', ()=>{ toggleTheme(); updateThemeIcon(); setTimeout(()=>{ try{initGauges();}catch(e){} try{initCharts();}catch(e){} }, 60); });

  const bell = document.getElementById('bellBtn');
  if(bell) bell.addEventListener('click', ()=> switchView('notifications'));

  const exportBtn = document.getElementById('exportOverviewBtn');
  if(exportBtn) exportBtn.addEventListener('click', ()=> exportData('pdf','overview'));

  const saveProfileBtn = document.getElementById('saveProfileBtn');
  if(saveProfileBtn) saveProfileBtn.addEventListener('click', ()=>{
    const name = document.getElementById('settingsName').value.trim() || 'Admin';
    const nameChip = document.getElementById('userNameChip');
    const welcome = document.getElementById('welcomeHeading');
    const avatar = document.getElementById('userAvatar');
    if(nameChip) nameChip.textContent = name;
    if(welcome) welcome.textContent = 'Welcome, ' + name;
    if(avatar) avatar.textContent = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    showToast('success','Profile updated','Your changes have been saved.');
  });

  document.addEventListener('keydown', (e)=>{
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k'){
      const search = document.getElementById('globalSearch');
      if(search){ e.preventDefault(); search.focus(); }
    }
  });
}
