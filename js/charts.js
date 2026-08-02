/* ============================================================
   SENTINEL — charts.js
   Minimal canvas chart renderers. No chart libraries used.
   ============================================================ */

function makeCanvas(container){
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(rect.width, 260);
  const h = container.classList.contains('short') ? 160 : (rect.height || 220);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}

function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

/* ---------- Dual line chart (approved vs blocked) ---------- */
function renderLineChart(containerId, series){
  const container = document.getElementById(containerId);
  if(!container) return;
  const { ctx, w, h } = makeCanvas(container);
  const padL = 34, padR = 10, padT = 14, padB = 24;
  const plotW = w - padL - padR, plotH = h - padT - padB;

  const allVals = series.flatMap(s => s.data);
  const max = Math.max(...allVals, 0) * 1.2 || 1; // avoid divide-by-zero on an all-zero dataset
  const n = Math.max(series[0].data.length, 1);

  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
  ctx.lineWidth = 1;
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = cssVar('--text-secondary') || '#94A3B8';
  for(let i=0;i<=3;i++){
    const y = padT + (plotH/3)*i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w-padR, y); ctx.stroke();
    const val = Math.round(max - (max/3)*i);
    ctx.fillText(val, 2, y+3);
  }

  series.forEach(s=>{
    ctx.beginPath();
    s.data.forEach((v,i)=>{
      const x = padL + (plotW/(n-1))*i;
      const y = padT + plotH - (v/max)*plotH;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // gradient fill
    const grad = ctx.createLinearGradient(0,padT,0,padT+plotH);
    grad.addColorStop(0, s.color + '33');
    grad.addColorStop(1, s.color + '00');
    ctx.lineTo(padL+plotW, padT+plotH);
    ctx.lineTo(padL, padT+plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // dots
    s.data.forEach((v,i)=>{
      const x = padL + (plotW/(n-1))*i;
      const y = padT + plotH - (v/max)*plotH;
      ctx.beginPath(); ctx.arc(x,y,2.6,0,Math.PI*2); ctx.fillStyle = s.color; ctx.fill();
    });
  });
}

/* ---------- Donut chart ---------- */
function renderDonutChart(containerId, segments, centerLabel){
  const container = document.getElementById(containerId);
  if(!container) return;
  const { ctx, w, h } = makeCanvas(container);
  const cx = w/2, cy = h/2;
  const r = Math.min(w,h)/2 - 12;
  const inner = r * 0.62;
  const rawTotal = segments.reduce((a,s)=>a+s.value,0);
  const total = rawTotal || 1;
  const segs = rawTotal ? segments : [{ value:1, color:'rgba(148,163,184,0.2)' }];
  let start = -Math.PI/2;

  ctx.clearRect(0,0,w,h);
  segs.forEach(seg=>{
    const angle = (seg.value/total) * Math.PI*2;
    ctx.beginPath();
    ctx.arc(cx,cy,r,start,start+angle);
    ctx.arc(cx,cy,inner,start+angle,start,true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    start += angle;
  });

  if(centerLabel){
    ctx.fillStyle = cssVar('--text') || '#F8FAFC';
    ctx.font = '700 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(centerLabel.value, cx, cy - 2);
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = cssVar('--text-secondary') || '#94A3B8';
    ctx.fillText(centerLabel.label, cx, cy + 14);
    ctx.textAlign = 'left';
  }
}

/* ---------- Bar chart (vertical) ---------- */
function renderBarChart(containerId, labels, data, color){
  const container = document.getElementById(containerId);
  if(!container) return;
  const { ctx, w, h } = makeCanvas(container);
  const padL = 30, padR = 10, padT = 14, padB = 26;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  if(!data.length){ ctx.clearRect(0,0,w,h); return; }
  const max = Math.max(...data, 0) * 1.2 || 1;
  const gap = 10;
  const barW = (plotW - gap*(data.length-1)) / data.length;

  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = cssVar('--text-secondary') || '#94A3B8';
  for(let i=0;i<=3;i++){
    const y = padT + (plotH/3)*i;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(w-padR,y); ctx.stroke();
  }

  data.forEach((v,i)=>{
    const x = padL + i*(barW+gap);
    const barH = (v/max)*plotH;
    const y = padT + plotH - barH;
    const grad = ctx.createLinearGradient(0,y,0,padT+plotH);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '55');
    ctx.fillStyle = grad;
    roundRectPath(ctx, x, y, barW, barH, 5);
    ctx.fill();
    ctx.fillStyle = cssVar('--text-secondary') || '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x+barW/2, h-8);
  });
  ctx.textAlign = 'left';
}

/* ---------- Horizontal bar chart (top vendors) ---------- */
function renderHBarChart(containerId, labels, data, color){
  const container = document.getElementById(containerId);
  if(!container) return;
  const { ctx, w, h } = makeCanvas(container);
  ctx.clearRect(0,0,w,h);
  if(!data.length){
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = cssVar('--text-secondary') || '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', w/2, h/2);
    ctx.textAlign = 'left';
    return;
  }
  const padL = 90, padR = 46, padT = 10;
  const rowH = (h - padT*2) / data.length;
  const max = Math.max(...data, 0) * 1.15 || 1;

  ctx.font = '11px Inter, sans-serif';
  data.forEach((v,i)=>{
    const y = padT + i*rowH + rowH*0.24;
    const barH = rowH*0.52;
    const barW = ((w-padL-padR)/max)*v;
    ctx.fillStyle = cssVar('--text-secondary') || '#94A3B8';
    ctx.textAlign = 'right';
    ctx.fillText(labels[i], padL-10, y+barH*0.75);
    const grad = ctx.createLinearGradient(padL,0,padL+barW,0);
    grad.addColorStop(0, color);
    grad.addColorStop(1, cssVar('--accent') || '#7C3AED');
    ctx.fillStyle = grad;
    roundRectPath(ctx, padL, y, barW, barH, 5);
    ctx.fill();
    ctx.fillStyle = cssVar('--text') || '#F8FAFC';
    ctx.textAlign = 'left';
    ctx.fillText('$' + v.toLocaleString(), padL+barW+8, y+barH*0.75);
  });
}

function roundRectPath(ctx, x, y, w, h, r){
  r = Math.min(r, w/2, Math.max(h/2,1));
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}
