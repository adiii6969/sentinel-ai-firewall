/* ============================================================
   SENTINEL — main.js
   Shared across landing / login / register / dashboard
   ============================================================ */

/* ---------- Auth guard ----------
   Protected pages are plain <body> (no "marketing" class, used by the
   public landing/login/register pages). Redirect to login if no session. */
(function authGuard(){
  if(document.body.classList.contains('marketing')) return;
  if(typeof SentinelAPI === 'undefined') return;
  if(!SentinelAPI.getToken()) window.location.href = 'login.html';
})();

/* ---------- Theme (persist for the session only — no backend) ---------- */
const SENTINEL_THEMES = ['dark', 'light', 'slate'];
(function initTheme(){
  const saved = sessionStorage.getItem('sentinel_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', SENTINEL_THEMES.includes(saved) ? saved : 'light');
})();

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = SENTINEL_THEMES[(SENTINEL_THEMES.indexOf(current) + 1) % SENTINEL_THEMES.length];
  document.documentElement.setAttribute('data-theme', next);
  sessionStorage.setItem('sentinel_theme', next);
}

/* ---------- Toast notifications ---------- */
const TOAST_ICONS = {
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>',
  danger:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
  warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 12v4"/></svg>'
};

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function showToast(type, title, msg, duration){
  let stack = document.getElementById('toastStack');
  if(!stack){
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.id = 'toastStack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <div class="toast-icon ${type}">${TOAST_ICONS[type] || TOAST_ICONS.info}</div>
    <div>
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(msg)}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss">&times;</button>`;
  stack.appendChild(el);
  const remove = () => { el.classList.add('out'); setTimeout(()=> el.remove(), 300); };
  el.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, duration || 4200);
}

/* ---------- Password visibility toggles ---------- */
document.querySelectorAll('.toggle-pw').forEach(btn=>{
  btn.addEventListener('click', function(){
    const target = document.getElementById(this.dataset.target);
    if(!target) return;
    target.type = target.type === 'password' ? 'text' : 'password';
  });
});

/* ---------- Hero pipeline demo animation (landing page) ---------- */
(function heroPipeline(){
  const wrap = document.getElementById('heroPipeline');
  if(!wrap) return;
  const steps = wrap.querySelectorAll('.pstep');
  const verdict = document.getElementById('heroVerdict');
  let i = 0;

  function run(){
    steps.forEach(s => s.classList.remove('active','done'));
    if(verdict) verdict.classList.remove('show');
    i = 0;
    tick();
  }
  function tick(){
    if(i > 0) steps[i-1].classList.add('done');
    if(i < steps.length){
      steps[i].classList.add('active');
      i++;
      setTimeout(tick, 650);
    } else {
      setTimeout(()=> verdict && verdict.classList.add('show'), 300);
      setTimeout(run, 3400);
    }
  }
  run();
})();

/* ---------- Simple scroll reveal for feature cards on landing ---------- */
(function scrollReveal(){
  const cards = document.querySelectorAll('.feature-card, .flow-node');
  if(!cards.length || !('IntersectionObserver' in window)) return;
  cards.forEach(c=>{ c.style.opacity = 0; c.style.transform = 'translateY(14px)'; c.style.transition = 'opacity .5s ease, transform .5s ease'; });
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.style.opacity = 1;
        entry.target.style.transform = 'translateY(0)';
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  cards.forEach(c => io.observe(c));
})();

/* ---------- Cursor-reactive ambient background glow ---------- */
(function cursorGlow(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(matchMedia('(hover: none)').matches) return; // skip on touch devices
  let mx = window.innerWidth/2, my = window.innerHeight/2, cx = mx, cy = my;
  document.documentElement.style.setProperty('--cx', mx+'px');
  document.documentElement.style.setProperty('--cy', my+'px');
  window.addEventListener('mousemove', (e)=>{ mx = e.clientX; my = e.clientY; }, { passive:true });
  (function loop(){
    cx += (mx - cx) * 0.08;
    cy += (my - cy) * 0.08;
    document.documentElement.style.setProperty('--cx', cx+'px');
    document.documentElement.style.setProperty('--cy', cy+'px');
    requestAnimationFrame(loop);
  })();
  document.addEventListener('mousemove', (e)=>{
    const el = e.target.closest('.card, .kpi-card, .feature-card, .vendor-card');
    if(!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', (e.clientX - r.left) + 'px');
    el.style.setProperty('--spot-y', (e.clientY - r.top) + 'px');
  }, { passive:true });
})();

/* ---------- Landing page: contiant-style motion (marquee, tilt, cycling headline) ---------- */
(function landingMotion(){
  if(!document.body.classList.contains('marketing')) return;

  /* seamless logo marquee: duplicate row once so translateX(-50%) loops cleanly */
  const strip = document.querySelector('.strip-row');
  if(strip) strip.insertAdjacentHTML('beforeend', strip.innerHTML);

  /* cursor tilt-parallax on the hero pipeline card */
  const hero = document.querySelector('.hero');
  if(hero && matchMedia('(hover: hover)').matches){
    hero.addEventListener('mousemove', (e)=>{
      const r = hero.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      hero.style.setProperty('--tilt-x', (px * 8).toFixed(2) + 'deg');
      hero.style.setProperty('--tilt-y', (py * -8).toFixed(2) + 'deg');
    }, { passive:true });
    hero.addEventListener('mouseleave', ()=>{
      hero.style.setProperty('--tilt-x', '0deg');
      hero.style.setProperty('--tilt-y', '0deg');
    });
  }

  /* cycling value-prop word, contiant-style rotating headline */
  const cycle = document.getElementById('heroCycle');
  if(cycle){
    const phrases = ['before AI spends.', 'not after the fact.', 'in real time.', 'on every payment.'];
    let i = 0;
    setInterval(()=>{
      i = (i + 1) % phrases.length;
      cycle.style.opacity = 0;
      setTimeout(()=>{ cycle.textContent = phrases[i]; cycle.style.opacity = 1; }, 250);
    }, 2600);
    cycle.style.transition = 'opacity .25s var(--ease)';
    cycle.style.display = 'inline-block';
  }
})();

/* ---------- Landing/auth navbar theme toggle button ---------- */
(function navThemeToggle(){
  const THEME_ICONS = {
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    slate: '<path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.3-2A5 5 0 0 0 6 18h11.5Z"/>',
    dark:  '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>'
  };
  function syncIcons(){
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    document.querySelectorAll('.theme-toggle-icon').forEach(icon=>{
      icon.innerHTML = THEME_ICONS[theme] || THEME_ICONS.dark;
    });
    document.querySelectorAll('.theme-toggle-btn').forEach(btn=>{
      btn.setAttribute('title', 'Theme: ' + theme + ' (click to change)');
    });
  }
  document.querySelectorAll('.theme-toggle-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{ toggleTheme(); syncIcons(); });
  });
  syncIcons();
})();

/* ---------- Pipeline step grid: staggered pop-in on scroll ---------- */
(function flowGridReveal(){
  const nodes = document.querySelectorAll('.flow-grid .flow-node');
  if(!nodes.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      const el = entry.target;
      const i = [...nodes].indexOf(el);
      setTimeout(()=> el.classList.add('in-view'), (i % 4) * 90 + Math.floor(i / 4) * 140);
      io.unobserve(el);
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -40px 0px' });
  nodes.forEach(n => io.observe(n));
})();
