/* ============================================================
   SENTINEL — risk.js
   Animated circular risk gauge (pure SVG) + factor breakdown
   ============================================================ */

const RISK_FACTORS = [
  { label: 'Vendor reputation', value: 8 },
  { label: 'Spending amount', value: 14 },
  { label: 'Transaction frequency', value: 11 },
  { label: 'Payment history', value: 6 },
  { label: 'Unknown wallet', value: 3 },
  { label: 'Prompt injection signals', value: 19 },
  { label: 'Behavioral anomaly', value: 11 }
];

/* Weight profiles used to break a transaction's single risk score down
   into the 7 named factors, so every payment in the queue gets its own
   coherent, non-random explanation instead of one static breakdown. */
const RISK_WEIGHT_PROFILES = {
  flagged: { 'Vendor reputation':0.24, 'Spending amount':0.14, 'Transaction frequency':0.09,
             'Payment history':0.05, 'Unknown wallet':0.24, 'Prompt injection signals':0.16, 'Behavioral anomaly':0.08 },
  normal:  { 'Vendor reputation':0.08, 'Spending amount':0.30, 'Transaction frequency':0.20,
             'Payment history':0.10, 'Unknown wallet':0.03, 'Prompt injection signals':0.09, 'Behavioral anomaly':0.20 }
};

/**
 * Derives a per-factor breakdown for a single transaction so the bars
 * always sum to that transaction's actual risk score.
 */
function computeFactorsForTx(tx){
  const profile = (tx.status === 'Blocked' || /unknown/i.test(tx.vendor)) ? RISK_WEIGHT_PROFILES.flagged : RISK_WEIGHT_PROFILES.normal;
  const labels = Object.keys(profile);
  let running = 0;
  const factors = labels.map((label, i) => {
    const isLast = i === labels.length - 1;
    const raw = isLast ? (tx.risk - running) : Math.round(tx.risk * profile[label]);
    running += isLast ? 0 : raw;
    return { label, value: Math.max(0, raw) };
  });
  return factors;
}

function decisionForScore(score){
  if(score < 40) return { label:'Approved automatically', cls:'success', icon:'✓' };
  if(score < 70) return { label:'Held for human review', cls:'warning', icon:'⏸' };
  return { label:'Blocked before execution', cls:'danger', icon:'✕' };
}

function explainForFactors(factors, score){
  const top = factors.slice().sort((a,b)=>b.value-a.value)[0];
  const decision = decisionForScore(score);
  if(score < 40){
    return `Score stays low mainly on ${top.label.toLowerCase()} — no single factor raised enough concern to pause this payment.`;
  }
  return `Score driven up mainly by ${top.label.toLowerCase()} (+${top.value} pts) — ${decision.label.toLowerCase()} as a result.`;
}

function riskColor(score){
  if(score < 40) return getCssVar('--success');
  if(score < 70) return getCssVar('--warning');
  return getCssVar('--danger');
}
function riskLabel(score){
  if(score < 40) return 'Low risk';
  if(score < 70) return 'Medium risk';
  return 'High risk';
}
function getCssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#2563EB';
}

/**
 * Renders an animated circular gauge into the given container element id.
 * score: 0-100
 */
function renderGauge(containerId, score, opts){
  const el = document.getElementById(containerId);
  if(!el) return;
  opts = opts || {};
  const size = opts.size || 180;
  const stroke = opts.stroke || 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = opts.color || riskColor(score);
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const cx = size / 2, cy = size / 2;
  const ticks = opts.ticks !== undefined ? opts.ticks : [40, 70];
  const tickR1 = r - stroke/2 - 2, tickR2 = r + stroke/2 + 2;
  const ticksSvg = ticks.map(t => {
    const angle = (-90 + (t/100)*360) * Math.PI / 180;
    const x1 = cx + tickR1 * Math.cos(angle), y1 = cy + tickR1 * Math.sin(angle);
    const x2 = cx + tickR2 * Math.cos(angle), y2 = cy + tickR2 * Math.sin(angle);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(11,16,32,0.9)" stroke-width="2"/>`;
  }).join('');

  el.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(148,163,184,0.12)" stroke-width="${stroke}"/>
      <circle id="${containerId}-arc" cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c}"
        transform="rotate(-90 ${cx} ${cy})"
        style="transition: stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1);"/>
      ${ticksSvg}
    </svg>
    <div class="gauge-center">
      <div class="gauge-score">${Math.round(score)}<span>/100</span></div>
      <div class="gauge-label">RISK SCORE</div>
    </div>`;

  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      const arc = document.getElementById(containerId + '-arc');
      if(arc) arc.style.strokeDashoffset = c - c * pct;
    });
  });
}

function renderRiskFactors(containerId, factors){
  const el = document.getElementById(containerId);
  if(!el) return;
  const max = Math.max(...factors.map(f=>f.value)) * 1.3 || 1;
  const barColor = v => v >= 15 ? 'var(--danger)' : v >= 8 ? 'var(--warning)' : 'var(--success)';
  el.innerHTML = factors.slice().sort((a,b)=>b.value-a.value).map(f => `
    <div class="gf-row">
      <span class="gf-label">${f.label}</span>
      <div class="gf-bar"><i style="width:${Math.min(100,(f.value/max)*100)}%;background:${barColor(f.value)}"></i></div>
      <span class="gf-val">${f.value}</span>
    </div>
  `).join('');
}

function badgeStyleFor(score){
  if(score < 40) return 'background:rgba(34,197,94,0.14);color:var(--success);';
  if(score < 70) return 'background:rgba(245,158,11,0.14);color:var(--warning);';
  return 'background:rgba(239,68,68,0.14);color:var(--danger);';
}
