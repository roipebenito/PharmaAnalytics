'use strict';

/* ============================================================
   LAYER 1 OF 3 — PRESENTATION (outer layer)
   ------------------------------------------------------------
   Owns everything the user sees:
     • page templates, shell, sidebar and hero
     • product cards, tables, modals and receipt markup
     • the sales/profit chart and toast messages
   This layer reads application state and calls application use
   cases. It never talks to localStorage or the PDF writer directly.
   Depends on: Layer 2 (application / domain).
   ============================================================ */

/* ---------- view helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'}[c]));
const m = n => '₱' + Number(n).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const toast = t => { const e = $('#toast'); if (!e) return; e.textContent = t; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 3000); };

const MED_IMAGES = [
  ['assets/meds/generic.svg', 'Generic medicine'],
  ['assets/meds/paracetamol.svg', 'Paracetamol (example)'],
  ['assets/meds/amoxicillin.svg', 'Amoxicillin (example)'],
  ['assets/meds/vitamin-c.svg', 'Vitamin C (example)'],
  ['assets/meds/ibuprofen.svg', 'Ibuprofen (example)'],
  ['assets/meds/cough-syrup.svg', 'Cough syrup (example)'],
  ['assets/meds/loratadine.svg', 'Loratadine (example)']
];

const ICONS = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  inventory: '<path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z"/><path d="m3 8.5 9 5.5 9-5.5"/><path d="M12 14v7"/>',
  requests: '<path d="M9 4h6l1 3H8l1-3Z"/><path d="M6 5H4v16h16V5h-2"/><path d="m8.5 13 2.5 2.5 4.5-5"/>',
  sales: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  receipts: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  accounts: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.2 3.2 0 0 1 0 7M17.5 14.2A5.8 5.8 0 0 1 21 20"/>',
  pos: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.4 11.2h11.2L21 7H6"/>',
  export: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v3h16v-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
  logout: '<path d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3"/><path d="m17 6 3 3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  trend: '<path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5"/><path d="M12 18h.01"/>',
  peso: '<circle cx="12" cy="12" r="9"/><path d="M8.5 7.5h4.2a3 3 0 0 1 0 6H8.5v3"/><path d="M7.5 11h6"/>',
  package: '<path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z"/><path d="m3 8.5 9 5.5 9-5.5"/><path d="M12 14v7"/>',
  inbox: '<path d="M4 4h16v16H4z"/><path d="M4 13h5l1.5 3h3L15 13h5"/>',
  store: '<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>'
};

function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
}

function initials(name) {
  const s = String(name || '').trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
  return s || 'U';
}

function pageHero(title, sub, action = '', note = '') {
  return `<section class="hero">
    <div class="hero-glow"></div>
    <div class="hero-content">
      <div class="hero-copy"><h2>${title}</h2><p>${sub}</p></div>
      ${action ? `<div class="hero-actions">${action}</div>` : ''}
    </div>
    ${note ? `<div class="hero-note">${icon('info')}<span>${note}</span></div>` : ''}
  </section>`;
}

function statCard(label, value, tone = '', iconName = 'trend', hint = '', valueTone = tone) {
  return `<div class="stat-card">
    <div class="stat-top"><span class="stat-icon ${tone}">${icon(iconName)}</span><span>${label}</span></div>
    <div class="stat-value ${valueTone}">${value}</div>
    ${hint ? `<div class="stat-hint">${hint}</div>` : ''}
  </div>`;
}

function emptyState(text, iconName = 'inbox') {
  return `<div class="empty"><span class="empty-icon">${icon(iconName)}</span><p>${text}</p></div>`;
}

function cardHead(title, sub = '', right = '') {
  return `<div class="card-head"><div><b>${title}</b>${sub ? `<div class="mut">${sub}</div>` : ''}</div>${right}</div>`;
}

/* ============================================================
   Authentication pages
   ============================================================ */
/* Floating bubble texture for the purple auth panel. Decorative only — the
   layer ignores pointer events so it never blocks the form or the mascot. */
function heroBubbles() {
  return `<div class="bubbles" aria-hidden="true">${'<span class="bubble"></span>'.repeat(14)}</div>`;
}

/* The mascot lives here instead of a CSS pseudo-element so it can be hovered. */
const heroMascot = () => '<div class="mascot" aria-hidden="true"></div>';

/* Short introduction shown in the lower corner of the purple panel,
   alongside the mascot on every sign-in screen. */
const mascotIntro = () => `<div class="mascot-intro">
      <b>Dr. Axo</b>
      <p>Dr. Axo is a bright, curious axolotl with a big smile and an even bigger love for discovery—always ready to wave hello and turn complex ideas into something simple and fun.</p>
    </div>`;

/* The one entry screen: pick your own saved data or a sample workspace.
   Nothing else on this screen changes data until a choice is made. */
function startPage() {
  const mine = peekData('mine') || {};
  const demo = peekData('demo') || {};
  const mySession = peekSession('mine');
  const demoSession = peekSession('demo');
  const myAcc = mySession ? (mine.accounts || []).find(a => a.email === mySession.email) : null;
  const demoAcc = demoSession ? (demo.accounts || []).find(a => a.email === demoSession.email) : null;
  const myTitle = myAcc ? 'My data — continue as ' + myAcc.name : (mine.accounts || []).length ? 'My data — sign in' : 'My data — set up my pharmacy';
  const mySub = myAcc
    ? 'Back to ' + myAcc.email + ' and everything you saved in this browser.'
    : (mine.accounts || []).length
      ? 'Sign in to your own accounts, inventory, sales and records.'
      : 'Create roi as the first owner, then add your own products and sales.';
  const demoTitle = demoAcc ? 'Demo data — continue as ' + demoAcc.name : 'Demo data — choose a role';
  const demoSub = demoAcc
    ? 'Same sample workspace — pick any role below to open it as that user.'
    : 'Realistic sample sales, inventory, requests, receipts and accounts. Pick a role to open it as.';
  const roleChips = [
    ['creator', 'Owner', 'roi.creator@gmail.com', '1234'],
    ['admin', 'Admin', 'Ana.admin@gmail.com', 'admin123'],
    ['staff', 'Staff', 'Bea.staff@gmail.com', 'staff123']
  ].map(x => {
    const acc = (demo.accounts || []).find(a => a.role === x[0]) || {email: x[2], password: x[3]};
    return `<button type="button" class="role-chip" data-act="startdemo" data-role="${x[0]}"><b>${x[1]}</b><span>${esc(acc.email)}</span><code>${esc(acc.password || x[3])}</code></button>`;
  }).join('');
  return `<div id="login">
  ${heroMascot()}
  <section class="auth-hero">
    ${heroBubbles()}
    <div class="auth-brand"><img class="auth-logo" src="assets/logo.png" alt="PharmaAnalytics"></div>
    <div class="auth-copy">
      <span class="eyebrow">Welcome to PharmaAnalytics</span>
      <h1>Track Sales.<br>Discover Insights.<br>Grow Smarter.</h1>
      <p>Manage sales, monitor medicine inventory, and track pharmacy performance—all in one platform. First, choose which workspace to open.</p>
    </div>
    ${mascotIntro()}
  </section>
  <section class="auth-form"><div class="auth-card">
    <div class="eyebrow">Choose your workspace</div>
    <h2>My data or demo data?</h2>
    <p class="mut">Just choosing — nothing gets replaced or deleted.</p>
    <div class="start-choices">
      <button type="button" class="start-choice mine" data-act="mydata">
        <span class="start-ico">${icon('store')}</span>
        <span class="start-copy"><b>${esc(myTitle)}</b><span>${esc(mySub)}</span></span>
        <span class="start-tag keep">My workspace</span>
        <span class="start-arrow">→</span>
      </button>
      <div class="start-choice demo-card">
        <span class="start-ico">${icon('layers')}</span>
        <span class="start-copy"><b>${esc(demoTitle)}</b><span>${esc(demoSub)}</span></span>
        <span class="start-tag sample">Sample workspace</span>
        <div class="role-chips">${roleChips}</div>
      </div>
    </div>
    <div class="note">Both workspaces are saved separately in this browser. Switching between them never deletes or overwrites either one.</div>
  </div></section>
</div>`;
}

function setupPage() {
  const n = FIRST_OWNER;
  return `<div id="login">
  ${heroMascot()}
  <section class="auth-hero">
    ${heroBubbles()}
    <div class="auth-brand"><img class="auth-logo" src="assets/logo.png" alt="PharmaAnalytics"></div>
    <div class="auth-copy">
      <span class="eyebrow">First-time setup</span>
      <h1>One owner first.<br>Every account in order.</h1>
      <p>Set up the first owner: <b>roi</b>. The owner has full admin access, manages every account, and can add <b>chynne</b> and <b>kyla</b> as owners later from Accounts.</p>
    </div>
    <div class="role-strip">
      <div><b>Full</b><span>Analytics, inventory &amp; approvals</span></div>
      <div><b>Accounts</b><span>Create and remove every account</span></div>
      <div><b>Receipts</b><span>Send receipts and see who received them</span></div>
    </div>
    ${mascotIntro()}
  </section>
  <section class="auth-form"><div class="auth-card">
    <button type="button" class="back-link" data-act="back">${icon('back')} Back to workspace choice</button>
    <div class="eyebrow">First-time setup</div>
    <h2>Create the first owner.</h2>
    <p class="mut">The owner account starts with the password <b>1234</b>. You can change it any time from Change password in the sidebar.</p>
    <form id="cf">
      <div class="creator-list"><div class="creator-row">
        <span class="creator-num">1</span>
        <div class="creator-copy"><b>${n.charAt(0).toUpperCase() + n.slice(1)}</b><span>First owner</span></div>
        <input id="cf-em-0" type="email" value="${n}.creator@gmail.com" readonly aria-label="${n} owner email">
        <code class="pw-val">1234</code>
      </div></div>
      <div class="err" id="cf-er"></div>
      <button class="btn btn-block">Create owner account</button>
    </form>
    <div class="note">Owner email is fixed to <b>roi.creator@gmail.com</b>. It starts with the password <b>1234</b> — change it from the sidebar whenever you like. Existing inventory and sales in this browser are kept.</div>
  </div></section>
</div>`;
}

function loginPage() {
  return `<div id="login">
  ${heroMascot()}
  <section class="auth-hero">
    ${heroBubbles()}
    <div class="auth-brand"><img class="auth-logo" src="assets/logo.png" alt="PharmaAnalytics"></div>
    <div class="auth-copy">
      <span class="eyebrow">Three-layer pharmacy system</span>
      <h1>Track Sales.<br>Discover Insights.<br>Grow Smarter.</h1>
      <p>Manage sales, monitor medicine inventory, and track pharmacy performance—all in one platform. Gain valuable insights and make smarter business decisions with PharmaAnalytics.</p>
    </div>
    ${mascotIntro()}
  </section>
  <section class="auth-form"><div class="auth-card">
    <button type="button" class="back-link" data-act="back">${icon('back')} Back to workspace choice</button>
    <div class="eyebrow">Your pharmacy workspace</div>
    <h2>Welcome back.</h2>
    <p class="mut">Sign in with the account your owner created for you.</p>
    <form id="lf">
      <label>Work email<input id="em" type="email" placeholder="roi.creator@gmail.com" required autofocus></label>
      <label>Password<input id="pw" type="password" placeholder="Your account password" required></label>
      <div class="err" id="er"></div>
      <button class="btn btn-block">Sign in</button>
    </form>
    <div class="note">Roles come from the email suffix: <b>.creator</b> (owner), <b>.admin</b>, or <b>.staff</b>. Owners start with the password <b>1234</b> and can change it from Change password in the sidebar. All data is saved in this browser.</div>
  </div></section>
</div>`;
}

/* ============================================================
   Shell
   ============================================================ */
const titles = {admin: 'Analytics overview', pos: 'Point of sale', inventory: 'Inventory', requests: 'Removal requests', sales: 'Sales records', daily: 'Daily sales', receipts: 'Receipts', accounts: 'Accounts'};
const NAV_ICONS = {admin: 'overview', pos: 'pos', inventory: 'inventory', requests: 'requests', sales: 'sales', daily: 'inbox', receipts: 'receipts', accounts: 'accounts'};

function shell(active, body) {
  const adminish = isAdminRole();
  const creator = S.role === 'creator';
  const nav = creator
    ? [['admin', 'Overview'], ['inventory', 'Inventory'], ['requests', 'Removal requests'], ['sales', 'Sales records'], ['daily', 'Daily sales'], ['receipts', 'Receipts'], ['accounts', 'Accounts']]
    : adminish
      ? [['admin', 'Overview'], ['inventory', 'Inventory'], ['requests', 'Removal requests'], ['sales', 'Sales records'], ['daily', 'Daily sales'], ['receipts', 'Receipts']]
      : [['pos', 'Point of sale'], ['inventory', 'Inventory'], ['daily', 'Daily sales'], ['receipts', 'Receipts']];
  const badge = v => {
    if (v === 'requests' && adminish && pend()) return `<span class="pill">${pend()}</span>`;
    if (v === 'inventory' && adminish && pendStock()) return `<span class="pill">${pendStock()}</span>`;
    if (v === 'receipts' && receivedShares().length) return `<span class="pill">${receivedShares().length}</span>`;
    return '';
  };
  const title = active === 'admin' && creator ? 'Owner overview' : (titles[active] || 'Workspace');
  return `<div id="app"><aside class="sidebar">
    <div class="brand"><img class="brand-logo" src="assets/logo.png" alt="PharmaAnalytics"></div>
    <nav class="nav-list"><div class="nav-label">Workspace</div>
      ${nav.map(([v, l]) => `<button class="nav ${v === active ? 'on' : ''}" data-act="go" data-v="${v}">${icon(NAV_ICONS[v], 'nav-icon')}<span>${l}</span>${badge(v)}</button>`).join('')}
    </nav>
    <div class="userbox">
      <div class="user-row"><div class="avatar">${initials(S.user)}</div><div class="user-meta"><b>${esc(S.user)}</b><span>${roleLabel(S.role)}</span><small>${esc(S.email)}</small></div></div>
      ${getDataMode() === 'mine'
        ? `<button class="signout switch-data" data-act="startdemo">${icon('layers')} Open demo data</button>`
        : `<button class="signout switch-data" data-act="mydata">${icon('store')} Back to my data</button>`}
      <button class="signout" data-act="changepw">${icon('key')} Change password</button>
      <button class="signout" data-act="out">${icon('logout')} Sign out</button>
    </div>
  </aside>
  <main>
    <div class="topbar">
      <div class="crumb"><span class="crumb-dot"></span><span>Main branch</span><span class="sep">/</span><b>${esc(title)}</b></div>
      <div class="top-actions"><span class="live-dot"></span><span class="pill role ${creator ? 'gold' : ''}">${roleLabel(S.role)}</span></div>
    </div>
    ${body}
  </main></div>`;
}

/* ============================================================
   Dashboard
   ============================================================ */
function chart(rows = liveSales()) {
  const W = 680, H = 230, pad = 18;
  if (rows.length < 2) {
    return `<div class="chart-empty">${icon('trend')}<p>No trend yet. The chart fills in after two completed sales.</p></div>`;
  }
  /* Plot sales PER DAY, not a running total, so quiet days, slow weeks and
     closures show as real dips instead of a line that only ever climbs. */
  const byDay = new Map();
  rows.forEach(s => {
    const day = new Date(s.ts);
    const key = day.getFullYear() + '-' + day.getMonth() + '-' + day.getDate();
    let row = byDay.get(key);
    if (!row) {
      row = {date: new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime(), sales: 0, profit: 0, count: 0, label: ''};
      byDay.set(key, row);
    }
    row.sales += Number(s.total);
    row.profit += Number(s.total) - saleCost(s);
    row.count += 1;
    row.label = s.id;
  });
  const days = [...byDay.values()].sort((a, b) => a.date - b.date);
  /* Fill days with no sales at zero so downtimes are visible on the chart. */
  const STEP = 86400000;
  const pts = [];
  days.forEach((d, i) => {
    if (i) {
      const gap = Math.round((d.date - days[i - 1].date) / STEP);
      for (let g = 1; g < gap; g++) {
        pts.push({date: days[i - 1].date + g * STEP, sales: 0, profit: 0, count: 0, label: ''});
      }
    }
    pts.push(d);
  });
  const max = Math.max(...pts.map(p => p.sales), 1);
  /* A single picked day still draws one centred point instead of dividing by zero. */
  const x = i => pts.length === 1 ? W / 2 : pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = v => H - pad - (v / max) * (H - pad * 2);
  const line = k => pts.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  /* Hover data: each point carries its own date and that day's totals. */
  const hover = pts.map((p, i) => ({
    x: Number(x(i).toFixed(1)), sy: Number(y(p.sales).toFixed(1)), py: Number(y(p.profit).toFixed(1)),
    date: fmtDate(p.date),
    time: p.count ? p.count + (p.count === 1 ? ' sale' : ' sales') : 'Closed — no sales',
    sale: m(p.sales), profit: m(p.profit), id: p.count ? p.label : 'No sales recorded'
  }));
  const area = `${x(0).toFixed(1)},${(H - pad).toFixed(1)} ${line('sales')} ${x(pts.length - 1).toFixed(1)},${(H - pad).toFixed(1)}`;
  const grid = [0, 1, 2, 3].map(i => {
    const yy = pad + (i / 3) * (H - pad * 2);
    return `<line x1="${pad}" x2="${W - pad}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="#ece8f6" stroke-dasharray="4 6"/>`;
  }).join('');
  const last = pts[pts.length - 1];
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily sales and net profit by day" data-points="${esc(JSON.stringify(hover))}">
    <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#895eb8" stop-opacity=".28"/><stop offset="1" stop-color="#895eb8" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <polygon points="${area}" fill="url(#chartFill)"/>
    <polyline fill="none" stroke="#895eb8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${line('sales')}"/>
    <polyline fill="none" stroke="#53ca92" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${line('profit')}"/>
    <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(last.sales).toFixed(1)}" r="4.5" fill="#895eb8" stroke="#fff" stroke-width="2"/>
    <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(last.profit).toFixed(1)}" r="4.5" fill="#53ca92" stroke="#fff" stroke-width="2"/>
    <g class="chart-guide" visibility="hidden">
      <line class="guide-line" y1="${pad}" y2="${H - pad}" stroke="#895eb8" stroke-width="1" stroke-dasharray="3 4"/>
      <circle class="guide-sales" r="5.5" fill="#895eb8" stroke="#fff" stroke-width="2"/>
      <circle class="guide-profit" r="5.5" fill="#53ca92" stroke="#fff" stroke-width="2"/>
    </g>
  </svg>`;
}

function admin() {
  const creator = S.role === 'creator';
  const r = S.requests.find(x => x.st === 'pending');
  const money = [['Cost of goods', rangeCost()], ['Removed sales', rangeRemoved()], ['Net profit', rangeProfit()]];
  const top = Math.max(...money.map(x => x[1]), 1);
  const admins = S.accounts.filter(a => a.role === 'admin');
  const adminRows = admins.map(a => {
    const mine = rangeLive().filter(s => String(s.byEmail || '').toLowerCase() === a.email.toLowerCase());
    const total = mine.reduce((x, s) => x + Number(s.total), 0);
    const approvals = S.deliveries.filter(d => String(d.approvedByEmail || '').toLowerCase() === a.email.toLowerCase() && inAnalyticsRange(d.ts)).length;
    const reviews = S.requests.filter(x => String(x.decidedByEmail || '').toLowerCase() === a.email.toLowerCase() && inAnalyticsRange(x.decidedTs || x.ts)).length;
    return `<div class="activity-row">
      <div class="avatar sm">${initials(a.name)}</div>
      <div class="activity-main"><b>${esc(a.name)}</b><span class="mut">${esc(a.email)}</span></div>
      <div class="activity-stats"><b>${m(total)}</b><span>${mine.length} sales · ${approvals} deliveries · ${reviews} removals</span></div>
    </div>`;
  }).join('');
  const creatorCards = creator ? `<div class="dash-grid">
    <div class="card">
      ${cardHead('Admin accounts', 'Every admin is a separate account, so activity is always traceable.', '<button class="btn ghost sm" data-act="go" data-v="accounts">Manage accounts</button>')}
      ${admins.length ? adminRows : emptyState('No admin accounts yet. Create one from Accounts.', 'accounts')}
      <div class="note-line">Each admin has a different email, so sales and delivery approvals show exactly who did what.</div>
    </div>
    <div class="card">
      ${cardHead('Receipt sharing', 'Only owners can send receipts.', '<button class="btn ghost sm" data-act="go" data-v="receipts">Open receipts</button>')}
      <div class="summary-row"><span>Sent by you</span><b>${S.shares.filter(x => String(x.fromEmail || '').toLowerCase() === S.email.toLowerCase()).length}</b></div>
      <div class="summary-row"><span>All shared receipts</span><b>${S.shares.length}</b></div>
      <div class="summary-row"><span>Accounts on the system</span><b>${S.accounts.length}</b></div>
      <div class="note-line">Recipients see <b>From → To</b> on every shared receipt.</div>
    </div>
  </div>` : '';
  const dateFields = S.anaRange !== 'custom' ? '' : `<div class="date-range">
      <label>From <input type="date" id="ana-from" value="${esc(S.anaFrom || '')}" max="${esc(S.anaTo || todayStr)}"></label>
      <span class="date-arrow">→</span>
      <label>To <input type="date" id="ana-to" value="${esc(S.anaTo || '')}" min="${esc(S.anaFrom || '')}" max="${todayStr}"></label>
      <button class="btn sm" data-act="anadates">Apply dates</button>
    </div>`;
  const rangePicker = `<div class="card analytics-card">
    <div class="filter-row">
      <div><b>Analytics range</b><div class="mut">Showing <b>${esc(analyticsLabel())}</b> · ${esc(analyticsRangeText())}</div></div>
      <div class="chips" style="margin:0">${ANALYTICS_RANGES.map(([k, l]) => `<button class="chip ${S.anaRange === k ? 'on' : ''}" data-act="anarange" data-r="${k}">${l}</button>`).join('')}</div>
    </div>
    ${dateFields}
  </div>`;
  const approvedValue = rangeRemovedRequests().reduce((a, x) => a + Number(x.amt), 0);
  const pendingValue = rangePendingRequests().reduce((a, x) => a + Number(x.amt), 0);
  const resolved = S.requests.filter(x => x.st !== 'pending' && inAnalyticsRange(x.decidedTs || x.ts)).length;
  return shell('admin', `
    ${pageHero(
      creator ? 'Owner overview' : 'Pharmacy performance',
      creator ? 'Monitor overall pharmacy performance, review sales and profit summaries, manage accounts, and oversee daily operations in one place.' : 'See what you earned, what you spent, and where stock was lost.',
      `<button class="btn hero-btn" data-act="exp">${icon('export')} Export</button>`,
      creator ? 'Owner access: full admin tools, plus the only role that can add or remove accounts and share receipts.' : 'Financial charts and profit reports are visible to administrators only.'
    )}
    ${rangePicker}
    <div class="stats">
      ${statCard('Total sales', m(rangeTotal()), '', 'peso', `${analyticsLabel()} totals`)}
      ${statCard('Net profit', m(rangeProfit()), 'green', 'trend', `${analyticsLabel()} totals`, 'black')}
      ${statCard('Removed sales', m(rangeRemoved()), 'red', 'trash', `${analyticsLabel()} totals`, 'black')}
      ${statCard('Transactions', String(rangeLive().length), 'purple', 'receipts', `${analyticsLabel()} totals`)}
    </div>
    <div class="dash-grid">
      <div class="card chart-card">
        ${cardHead('Sales &amp; net profit', `Per day, with quiet days and closures · ${analyticsLabel()}`, '<div class="legend"><span class="lg sales">Sales</span><span class="lg profit">Net profit</span></div>')}
        <div class="chart-wrap">${chart(rangeLive())}<div id="chart-tip" class="chart-tip"></div></div>
      </div>
      <div class="card">
        ${cardHead('Where the money went', 'Costs, removals and profit')}
        ${money.map(([l, v], i) => `<div class="money-row"><div class="row"><span>${l}</span><b>${m(v)}</b></div><div class="money-bar"><i class="${i === 2 ? 'green' : ''}" style="width:${Math.max(0, Math.round(v / top * 100))}%"></i></div></div>`).join('')}
        <div class="note-line">Net profit uses recorded product cost, or ${Math.round(COST_RATE * 100)}% of price when no cost is recorded.</div>
      </div>
    </div>
    <div class="dash-grid">
      <div class="card">
        ${cardHead('Removal requests', 'Staff requests waiting for review', `<span class="pill amb">${pend()} pending</span>`)}
        ${r ? `<div class="request-preview">
          <div><b>${esc(r.id)} · Sale ${esc(r.sale)}</b><div class="mut">${esc(r.by)}${r.byEmail ? ' · ' + esc(r.byEmail) : ''} · ${esc(r.reason)} · ${m(r.amt)}</div></div>
          <button class="btn sm" data-act="go" data-v="requests">Review requests</button>
        </div>` : emptyState('No requests waiting. New ones from staff appear here.', 'requests')}
      </div>
      <div class="card">
        ${cardHead('Removal summary', `Approved and pending values · ${analyticsLabel()}`)}
        <div class="summary-row"><span>Approved removals</span><b>${m(approvedValue)}</b></div>
        <div class="summary-row"><span>Pending review</span><b>${m(pendingValue)}</b></div>
        <div class="summary-row"><span>Resolved requests</span><b>${resolved}</b></div>
      </div>
    </div>
    ${creatorCards}`);
}

/* ============================================================
   Point of sale
   ============================================================ */
function grid() {
  const q = S.q.toLowerCase();
  if (!S.products.length) return `<div class="empty wide">${icon('package')}<p>No medicines yet. An administrator can add them from Inventory.</p></div>`;
  const list = S.products.filter(p => (S.cat === 'All' || p.category === S.cat) && p.name.toLowerCase().includes(q));
  if (!list.length) return `<div class="empty wide">${icon('search')}<p>No medicines match. Try a different name or category.</p></div>`;
  return list.map(p => {
    const b = stockState(p);
    return `<div class="prod">
      <div class="medimg"><img src="${esc(p.image)}" alt="${esc(p.name)} pack" loading="lazy"></div>
      <div class="prod-body">
        <div class="prod-title"><b>${esc(p.name)}</b><span class="pill ${b.cls}">${b.label}</span></div>
        <div class="mut">${esc(p.category)}</div>
        <div class="prod-foot"><span class="price">${m(p.price)}</span><button class="btn sm" data-act="add" data-id="${p.id}" ${p.stock > 0 ? '' : 'disabled'}>Add</button></div>
      </div>
    </div>`;
  }).join('');
}

function sale() {
  const rows = cartRows(), t = cartTotal();
  return `<div class="card sale-card">
    ${cardHead('Current sale', rows.length ? `${rows.length} item${rows.length === 1 ? '' : 's'} in the cart` : 'Nothing added yet', `<span class="pill">${rows.length}</span>`)}
    ${rows.length ? rows.map(r => `<div class="sale-line">
      <div><b>${esc(r.name)}</b><div class="mut">${m(r.price)} each</div></div>
      <div class="q"><button data-act="q" data-id="${r.id}" data-d="-1" aria-label="Decrease">−</button><input class="q-num" data-id="${r.id}" type="number" min="1" step="1" value="${r.q}" aria-label="Quantity for ${esc(r.name)}" title="Click and type a quantity"><button data-act="q" data-id="${r.id}" data-d="1" aria-label="Increase">+</button></div>
      <b>${m(r.price * r.q)}</b>
    </div>`).join('') : `<div class="empty small">${icon('pos')}<p>Add medicines from the catalog to start a sale.</p></div>`}
    <div class="sale-total"><span>Total due</span><b>${m(t)}</b></div>
    <div class="seg">${['Cash','Card','Mobile'].map(x => `<button data-act="pay" data-p="${x}" class="${S.pay === x ? 'on' : ''}">${x}</button>`).join('')}</div>
    <label>Amount tendered<input id="tn" type="number" min="0" step="0.01" placeholder="0.00"></label>
    <div class="row change-row"><span class="mut">Change due</span><b id="ch" class="change">₱0.00</b></div>
    <button class="btn btn-block" data-act="done" ${rows.length ? '' : 'disabled'}>Complete sale · ${m(t)}</button>
  </div>`;
}

function pos() {
  const cats = ['All', ...new Set(S.products.map(p => p.category))];
  const recent = S.sales.length ? S.sales.map(s => `<tr><td><b>${esc(s.id)}</b></td><td>${esc(fmtTime(s.ts))}</td><td>${esc(s.itemText)}</td><td>${m(s.total)}</td><td><div class="acts" style="justify-content:flex-end;flex-wrap:wrap;gap:6px"><button class="btn ghost sm" data-act="receipt" data-id="${esc(s.id)}">Receipt</button>${s.st === 'ok' ? `<button class="btn red sm" data-act="rm" data-id="${esc(s.id)}">Request removal</button>` : `<span class="pill ${s.st === 'pending' ? 'amb' : 'red'}">${s.st === 'pending' ? 'Removal pending' : 'Removed'}</span>`}</div></td></tr>`).join('') : '<tr><td colspan="5" class="mut">No sales yet. Completed sales appear here.</td></tr>';
  return shell('pos', `
    ${pageHero('Point of sale', 'Search and select medicines, process customer purchases, choose payment methods, and complete sales transactions.')}
    <div class="pos">
      <div class="pos-main">
        <div class="card">
          <div class="input-wrap">${icon('search')}<input id="sq" placeholder="Search medicine name" value="${esc(S.q)}"></div>
          <div class="chips">${cats.map(c => `<button class="chip ${S.cat === c ? 'on' : ''}" data-act="cat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
          <div class="grid" id="gr">${grid()}</div>
        </div>
        <div class="card" style="margin-top:16px">
          ${cardHead('Your recent sales', 'Receipts and removal requests stay available here.', `<span class="pill">${S.sales.length}</span>`)}
          <div class="table-wrap"><table><tr><th>Sale</th><th>Time</th><th>Items</th><th>Total</th><th></th></tr>${recent}</table></div>
        </div>
      </div>
      ${sale()}
    </div>`);
}

/* ============================================================
   Inventory + stock requests
   ============================================================ */
function stockRequestsCard() {
  if (isAdminRole()) {
    const pending = S.stockRequests.filter(r => r.st === 'pending');
    return `<div class="card" style="margin-top:16px">
      ${cardHead('Stock addition requests', 'Staff additions appear here for verification.', `<span class="pill ${pending.length ? 'amb' : ''}">${pending.length} pending</span>`)}
      ${pending.length ? pending.map(r => `<div class="request-row">
        <div><b>${esc(r.item)}</b>${r.productId == null ? ' <span class="pill amb">New</span>' : ''}<div class="mut">${esc(r.by)}${r.byEmail ? ' · ' + esc(r.byEmail) : ''} · +${r.qty} units · ${esc(relTime(r.ts))}</div>${r.note ? `<div class="mut">“${esc(r.note)}”</div>` : ''}</div>
        <div class="acts"><button class="btn red sm" data-act="stkdec" data-id="${esc(r.id)}" data-d="rejected">Reject</button><button class="btn sm" data-act="stkdec" data-id="${esc(r.id)}" data-d="approved">Approve</button></div>
      </div>`).join('') : emptyState('No stock requests waiting. Staff additions appear here for verification.', 'inventory')}
      <div class="note-line">Approved deliveries are saved as delivery receipts. <button class="link-btn" data-act="go" data-v="receipts">View receipts</button></div>
    </div>`;
  }
  const mine = S.stockRequests.filter(r => r.byEmail ? String(r.byEmail).toLowerCase() === S.email.toLowerCase() : r.by === S.user);
  return `<div class="card" style="margin-top:16px">
    ${cardHead('Your stock requests', 'An admin or the owner verifies every addition before stock changes.', mine.some(r => r.st === 'pending') ? `<span class="pill amb">${mine.filter(r => r.st === 'pending').length} pending</span>` : '')}
    ${mine.length ? mine.map(r => {
      const dl = deliveryForRequest(r.id);
      return `<div class="request-row">
        <div><b>${esc(r.item)} · +${r.qty}</b><div class="mut">${esc(relTime(r.ts))}${r.note ? ' · ' + esc(r.note) : ''}</div>${r.st !== 'pending' && r.decidedBy ? `<div class="mut">${r.st === 'approved' ? 'Approved' : 'Rejected'} by ${esc(r.decidedBy)}${r.decidedByEmail ? ' · ' + esc(r.decidedByEmail) : ''}</div>` : ''}</div>
        <div class="acts">${dl ? `<button class="btn ghost sm" data-act="delivery" data-id="${esc(dl.id)}">Delivery receipt</button>` : ''}<span class="pill ${r.st === 'pending' ? 'amb' : r.st === 'approved' ? 'grn' : 'red'}">${r.st === 'pending' ? 'Waiting for admin' : esc(r.st)}</span></div>
      </div>`;
    }).join('') : emptyState('No requests yet. When new units arrive, use “Request stock” on a medicine.', 'inventory')}
  </div>`;
}

function productRequestsCard() {
  if (S.role === 'creator') {
    const pending = S.productRequests.filter(r => r.st === 'pending');
    const history = S.productRequests.filter(r => r.st !== 'pending').slice(0, 4);
    return `<div class="card" style="margin-top:16px">
      ${cardHead('New medicine requests', 'Admins propose a product and its stock; an owner approves before it is stored.', `<span class="pill ${pending.length ? 'amb' : ''}">${pending.length} pending</span>`)}
      ${pending.length ? pending.map(r => `<div class="request-row">
        <div class="req-prod"><img src="${esc(r.image || 'assets/meds/generic.svg')}" alt="" class="req-thumb"><div><b>${esc(r.name)}</b><div class="mut">${esc(r.category)} · ${m(r.price)} · ${m(r.cost)} cost · <b>${r.stock} units</b></div><div class="mut">Requested by ${esc(r.by)}${r.byEmail ? ' · ' + esc(r.byEmail) : ''} · ${esc(relTime(r.ts))}</div>${r.note ? `<div class="mut">“${esc(r.note)}”</div>` : ''}</div></div>
        <div class="acts"><button class="btn red sm" data-act="prdec" data-id="${esc(r.id)}" data-d="rejected">Reject</button><button class="btn sm" data-act="prdec" data-id="${esc(r.id)}" data-d="approved">Approve &amp; add</button></div>
      </div>`).join('') : emptyState('No medicine requests waiting. Admin requests appear here for approval.', 'inventory')}
      ${history.length ? `<div class="note-line">Recently reviewed: ${history.map(r => `${esc(r.name)} (${esc(r.st)})`).join(' · ')}</div>` : ''}
    </div>`;
  }
  if (S.role !== 'admin') return '';
  const mine = S.productRequests.filter(r => String(r.byEmail || '').toLowerCase() === String(S.email || '').toLowerCase());
  return `<div class="card" style="margin-top:16px">
    ${cardHead('Your medicine requests', 'An owner must approve each request before the product is added.', mine.some(r => r.st === 'pending') ? `<span class="pill amb">${mine.filter(r => r.st === 'pending').length} pending</span>` : '')}
    ${mine.length ? mine.map(r => `<div class="request-row">
      <div class="req-prod"><img src="${esc(r.image || 'assets/meds/generic.svg')}" alt="" class="req-thumb"><div><b>${esc(r.name)}</b><div class="mut">${esc(r.category)} · ${r.stock} units · ${esc(relTime(r.ts))}</div>${r.note ? `<div class="mut">“${esc(r.note)}”</div>` : ''}${r.st !== 'pending' && r.decidedBy ? `<div class="mut">${r.st === 'approved' ? 'Approved' : 'Rejected'} by ${esc(r.decidedBy)}</div>` : ''}</div></div>
      <span class="pill ${r.st === 'pending' ? 'amb' : r.st === 'approved' ? 'grn' : 'red'}">${esc(r.st)}</span>
    </div>`).join('') : emptyState('No requests yet. Use “Request medicine” to propose a new product.', 'inventory')}
    <div class="note-line">Approved requests are added to inventory by the owner with the stock quantity you requested.</div>
  </div>`;
}

function invGrid(rows) {
  if (!S.products.length) return `<div class="empty wide">${icon('inventory')}<p>Inventory is empty. An administrator can add medicines with the “Add medicine” button.</p></div>`;
  if (!rows.length) return `<div class="empty wide">${icon('search')}<p>No medicines match this filter.</p></div>`;
  const max = Math.max(...S.products.map(p => Number(p.stock)), 1);
  return rows.map(p => {
    const b = stockState(p), cls = p.stock <= 0 ? 'out' : p.stock <= S.lowStock ? 'low' : '';
    const pct = Math.max(0, Math.min(100, Math.round(p.stock / max * 100)));
    return `<div class="prod inv-card">
      <div class="medimg big"><img src="${esc(p.image)}" alt="${esc(p.name)} pack" loading="lazy"></div>
      <div class="prod-body">
        <div class="prod-title"><b>${esc(p.name)}</b><span class="pill ${b.cls}">${b.label}</span></div>
        <div class="mut">${esc(p.category)} · ${m(p.price)} each</div>
        <div class="stockbar"><i class="${cls}" style="width:${pct}%"></i></div>
        <div class="row mut"><span>Reorder level ${S.lowStock}</span><b>${p.stock} units</b></div>
        <div class="row mut"><span>Value at cost</span><b>${m(p.stock * (p.cost != null ? p.cost : p.price * COST_RATE))}</b></div>
        ${isAdminRole() ? `<button class="btn ghost sm" data-act="restock" data-id="${p.id}">Adjust stock</button>` : `<button class="btn sm" data-act="reqstock" data-id="${p.id}">Request stock</button>`}
      </div>
    </div>`;
  }).join('');
}

function inventory() {
  const a = isAdminRole(), creator = S.role === 'creator', q = S.invQ.toLowerCase();
  const rows = S.products.filter(p => p.name.toLowerCase().includes(q) && (S.invFilter === 'all' || (S.invFilter === 'low' && p.stock > 0 && p.stock <= S.lowStock) || (S.invFilter === 'out' && p.stock <= 0)));
  const units = S.products.reduce((x, p) => x + Number(p.stock), 0);
  const value = S.products.reduce((x, p) => x + Number(p.stock) * (p.cost != null ? Number(p.cost) : Number(p.price) * COST_RATE), 0);
  const low = S.products.filter(p => p.stock > 0 && p.stock <= S.lowStock).length;
  const out = S.products.filter(p => p.stock <= 0).length;
  return shell('inventory', `
    ${pageHero('Inventory',
      'Manage medicine records, monitor stock levels, identify low or out-of-stock products, and review stock requests.',
      creator ? `<button class="btn hero-btn" data-act="newprod">${icon('plus')} Add medicine</button>` : a ? `<button class="btn hero-btn" data-act="newprodreq">${icon('plus')} Request medicine</button>` : `<button class="btn hero-btn" data-act="reqstockall">${icon('plus')} Request stock</button>`)}
    <div class="stats">
      ${statCard('Medicines', S.products.length, 'purple', 'inventory', 'Active products')}
      ${statCard('Units in stock', units, '', 'package', 'Across all medicines')}
      ${statCard('Low stock', low, 'amber', 'alert', `At or below ${S.lowStock} units`)}
      ${statCard('Out of stock', out, 'red', 'alert', 'Needs restocking')}
    </div>
    <div class="card">
      <div class="filter-row">
        <div class="input-wrap">${icon('search')}<input id="iq" placeholder="Search inventory" value="${esc(S.invQ)}"></div>
        <div class="chips" style="margin:0">${[['all','All'],['low','Low stock'],['out','Out of stock']].map(([k, l]) => `<button class="chip ${S.invFilter === k ? 'on' : ''}" data-act="invfilter" data-f="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="note-line">Inventory value at cost: <b>${m(value)}</b> · Low-stock level: ${S.lowStock} units</div>
    </div>
    <div class="grid" id="inv-grid" style="margin-top:16px">${invGrid(rows)}</div>
    ${productRequestsCard()}
    ${stockRequestsCard()}`);
}

/* ============================================================
   Removal requests
   ============================================================ */
function requests() {
  const list = S.requests.filter(r => r.st === S.tab);
  const r = S.requests.find(x => x.id === S.sel) || list[0];
  const cls = {pending: 'amb', approved: 'grn', rejected: 'red'};
  return shell('requests', `
    ${pageHero('Removal requests', 'Review staff requests to remove incorrect sales, approve or reject requests, and keep inventory and sales records accurate.')}
    <div class="req">
      <div class="card">
        <div class="tabs">${['pending','approved','rejected'].map(t => `<button class="chip ${S.tab === t ? 'on' : ''}" data-act="tab" data-t="${t}">${t[0].toUpperCase() + t.slice(1)} (${S.requests.filter(x => x.st === t).length})</button>`).join('')}</div>
        ${list.length ? list.map(x => `<button class="item ${r && r.id === x.id ? 'on' : ''}" data-act="pick" data-id="${esc(x.id)}"><b>${esc(x.id)} · Sale ${esc(x.sale)}</b><b>${m(x.amt)}</b><span class="mut">${esc(x.by)}${x.byEmail ? ' · ' + esc(x.byEmail) : ''} · ${esc(x.reason)}</span><span class="pill ${cls[x.st]}">${esc(x.st)}</span></button>`).join('') : emptyState('Nothing here yet.', 'requests')}
      </div>
      <div class="card">${r ? `<div class="row"><b>${esc(r.id)}</b><span class="pill ${cls[r.st]}">${esc(r.st)}</span></div><div class="mut">${esc(relTime(r.ts))} · ${esc(r.by)}${r.byEmail ? ' · ' + esc(r.byEmail) : ''}</div><div class="total">${m(r.amt)}</div><div>${esc(r.item)}</div>
        <div class="box"><b>Reason: ${esc(r.reason)}</b><div class="mut" style="margin-top:4px">${esc(r.note || 'No note added.')}</div></div>
        ${r.st !== 'pending' && r.decidedBy ? `<div class="mut" style="margin-bottom:8px">Reviewed by ${esc(r.decidedBy)}${r.decidedByEmail ? ' · ' + esc(r.decidedByEmail) : ''}</div>` : ''}
        ${r.st === 'pending' ? `<div class="acts"><button class="btn red" data-act="dec" data-id="${esc(r.id)}" data-d="rejected">Reject request</button><button class="btn" data-act="dec" data-id="${esc(r.id)}" data-d="approved">Approve removal</button></div>` : ''}` : emptyState('Select a request to review it.', 'requests')}</div>
    </div>`);
}

/* ============================================================
   Sales records
   ============================================================ */
function salesPage() {
  const p = S.repPeriod;
  const val = S.repValue || defaultRepValue(p);
  const r = S.report;
  const s = r ? r.summary : null;
  const label = {day: 'Day', month: 'Month', year: 'Year', all: 'All time'}[p] || 'Month';
  const input = p === 'day'
    ? `<input id="rep-val" type="date" value="${esc(val)}">`
    : p === 'month'
      ? `<input id="rep-val" type="month" value="${esc(val)}">`
      : p === 'year'
        ? `<input id="rep-val" type="number" min="2000" max="2100" step="1" value="${esc(val)}">`
        : '';
  const statusCls = st => st === 'ok' ? 'grn' : st === 'pending' ? 'amb' : 'red';
  const breakdownTitle = p === 'month' ? 'day' : p === 'year' ? 'month' : 'year';
  return shell('sales', `
    ${pageHero('Sales records', 'View completed transactions, filter sales by day, month, or year, and review revenue, costs, and profit summaries.', `<button class="btn hero-btn" data-act="exp">${icon('export')} Export</button>`)}
    <div class="card">
      <div class="filter-row">
        <div class="chips" style="margin:0">${[['day','Day'],['month','Month'],['year','Year'],['all','All time']].map(([k, l]) => `<button class="chip ${p === k ? 'on' : ''}" data-act="repperiod" data-p="${k}">${l}</button>`).join('')}</div>
        ${input}
        ${p !== 'all' ? `<button class="btn sm" data-act="repgo">Show ${label.toLowerCase()}</button>` : ''}
      </div>
      <div class="note-line">${r ? `Showing <b>${esc(r.value || label)}</b> · ${s.transactions} transaction${s.transactions === 1 ? '' : 's'}` : 'Choose a period and press Show.'}</div>
    </div>
    ${s ? `<div class="stats six">
      ${statCard('Transactions', s.transactions, 'purple', 'receipts')}
      ${statCard('Gross sales', m(s.gross), '', 'peso')}
      ${statCard('Cost of goods', m(s.cogs), 'amber', 'package')}
      ${statCard('Net profit', m(s.profit), 'green', 'trend', '', 'green-deep')}
      ${statCard('Average sale', m(s.average), '', 'trend')}
      ${statCard('Removed sales', m(s.removedValue), 'red', 'trash', '', 'red-deep')}
    </div>` : ''}
    ${r && r.breakdown.length ? `<div class="card" style="margin-top:16px">
      ${cardHead(`Breakdown by ${breakdownTitle}`, 'Grouped sales for the selected period')}
      <div class="table-wrap"><table><tr><th>${breakdownTitle[0].toUpperCase() + breakdownTitle.slice(1)}</th><th>Sales</th><th>Transactions</th></tr>
      ${r.breakdown.map(b => `<tr><td>${esc(b.label)}</td><td>${m(b.total)}</td><td>${b.count}</td></tr>`).join('')}</table></div>
    </div>` : ''}
    ${r ? `<div class="card" style="margin-top:16px">
      ${cardHead('Transactions', 'Every sale in the selected period', `<span class="pill">${r.rows.length}</span>`)}
      <div class="table-wrap"><table><tr><th>Sale</th><th>Date</th><th>Time</th><th>Items</th><th>Payment</th><th>Staff</th><th>Total</th><th>Status</th><th>Receipt</th></tr>
      ${r.rows.length ? r.rows.map(x => `<tr><td><b>${esc(x.id)}</b></td><td>${esc(x.date)}</td><td>${esc(x.time)}</td><td>${esc(x.itemText)}</td><td>${esc(x.pay)}</td><td>${esc(x.by)}${x.byEmail ? `<div class="mut">${esc(x.byEmail)}</div>` : ''}</td><td>${m(x.total)}</td><td><span class="pill ${statusCls(x.st)}">${esc(x.st)}</span></td><td><button class="btn ghost sm" data-act="receipt" data-id="${esc(x.id)}">View</button></td></tr>`).join('') : '<tr><td colspan="9" class="mut">No sales recorded for this period.</td></tr>'}</table></div>
    </div>` : ''}`);
}

function openSales(period = S.repPeriod, value = S.repValue) {
  const p = ['day', 'month', 'year', 'all'].includes(period) ? period : 'month';
  S.view = 'sales';
  S.repPeriod = p;
  S.repValue = value || defaultRepValue(p);
  S.report = salesReport(p, S.repValue);
  render();
}

/* ============================================================
   Daily sales submissions (staff) / review (owner + admin)
   ============================================================ */
function dailySalesPage() {
  const staff = S.role === 'staff';
  const rows = staff
    ? S.dailySales.filter(x => String(x.byEmail || '').toLowerCase() === String(S.email || '').toLowerCase())
    : S.dailySales.slice();
  const mineToday = staff && rows.some(x => x.date === todayStr);
  const total = rows.reduce((a, x) => a + Number(x.total), 0);
  const txs = rows.reduce((a, x) => a + Number(x.transactions), 0);
  const table = rows.length ? `<div class="table-wrap"><table>
    <tr><th>Submission</th><th>Date</th><th>Staff</th><th>Transactions</th><th>Total sales</th><th>Note</th><th>Submitted</th></tr>
    ${rows.map(x => `<tr><td><b>${esc(x.id)}</b></td><td>${esc(x.date)}</td><td>${esc(x.by)}<div class="mut">${esc(x.byEmail || '')}</div></td><td>${x.transactions}</td><td><b>${m(x.total)}</b></td><td>${x.note ? esc(x.note) : '<span class="mut">—</span>'}</td><td>${esc(relTime(x.ts))}</td></tr>`).join('')}
  </table></div>` : emptyState(staff ? 'No submissions yet. Submit today’s sales below.' : 'No daily sales have been submitted yet.', 'inbox');
  const form = staff ? `<div class="card">
    ${cardHead('Submit today’s sales', 'One summary per staff member per date. Saved to the database.')}
    ${mineToday ? `<div class="banner">You already submitted daily sales for <b>${esc(todayStr)}</b>. You can submit for another date below.</div>` : ''}
    <form id="dsf" class="daily-form">
      <div class="two"><label>Sales date<input id="ds-date" type="date" value="${esc(todayStr)}" required></label><label>Total sales (₱)<input id="ds-total" type="number" min="0" step="0.01" placeholder="0.00" required></label></div>
      <div class="two"><label>Number of transactions<input id="ds-tx" type="number" min="0" step="1" value="0" required></label><label>Note (optional)<input id="ds-note" maxlength="200" placeholder="Shift, register, remarks"></label></div>
      <div class="note">Verify the figures before submitting. The submission is stored with your name, email and the date.</div>
      <div class="err" id="ds-er"></div>
      <div class="acts"><button class="btn">Submit daily sales</button></div>
    </form>
  </div>` : '';
  return shell('daily', `
    ${pageHero('Daily sales', 'Monitor daily sales submissions from staff, review reported transactions, and track submitted sales totals.')}
    <div class="stats">
      ${statCard('Submissions', String(rows.length), 'purple', 'inbox', staff ? 'By you' : 'All staff')}
      ${statCard('Transactions', String(txs), '', 'receipts', 'Reported')}
      ${statCard('Reported sales', m(total), '', 'peso', 'Across submissions')}
      ${statCard('Latest date', rows.length ? esc(rows[0].date) : '—', '', 'trend', 'Most recent')}
    </div>
    ${form}
    <div class="card" style="margin-top:16px">
      ${cardHead(staff ? 'Your submissions' : 'All submissions', staff ? 'Your saved daily sales records.' : 'Daily sales records from every staff account.', `<span class="pill">${rows.length}</span>`)}
      ${table}
    </div>`);
}

/* ============================================================
   Receipts
   ============================================================ */
function shareBannerHTML(share) {
  if (!share) return '';
  return `<div class="rc-share"><b>Shared receipt</b><div>${esc(share.fromName)} → ${esc(share.toName)}</div><div class="mut">${esc(share.fromEmail)} → ${esc(share.toEmail)}</div>${share.note ? `<div class="mut">“${esc(share.note)}”</div>` : ''}</div>`;
}

function receiptHTML(s, share) {
  const items = Array.isArray(s.items) && s.items.length
    ? s.items
    : [{name: s.itemText || 'Sale', price: Number(s.total), qty: 1}];
  const tendered = s.tendered != null ? Number(s.tendered) : null;
  const change = s.change != null ? Number(s.change) : null;
  const status = s.st === 'removed'
    ? '<div class="rc-status removed">Removed · stock returned</div>'
    : s.st === 'pending'
      ? '<div class="rc-status pending">Removal pending admin review</div>'
      : '';
  return `<div class="ov" data-act="closereceipt"><div class="modal receipt" role="dialog" aria-modal="true" aria-label="Receipt ${esc(s.id)}">
    <div class="rc-head">
      <div class="rc-brand"><img src="assets/hero-icons/receipts-logo.png?v=1" alt="Official Receipts" class="rc-logo"></div>
      <div class="rc-title">Official receipt</div>
    </div>
    ${shareBannerHTML(share)}
    ${status}
    <div class="rc-meta">
      <div><span class="mut">Receipt no.</span><b>${esc(s.id)}</b></div>
      <div><span class="mut">Payment</span><b>${esc(s.pay)}</b></div>
      <div><span class="mut">Date</span><span>${esc(fmtDate(s.ts))}</span></div>
      <div><span class="mut">Time</span><span>${esc(fmtTime(s.ts))}</span></div>
      <div><span class="mut">Sold by</span><b>${esc(s.by)}</b>${s.byEmail ? `<div class="mut">${esc(s.byEmail)}</div>` : ''}</div>
      <div><span class="mut">Items</span><span>${items.reduce((a, it) => a + Number(it.qty), 0)}</span></div>
    </div>
    <table class="rc-items"><tr><th>Item</th><th class="num">Qty</th><th class="num">Amount</th></tr>
      ${items.map(it => `<tr><td>${esc(it.name)}<div class="mut">${m(it.price)} each</div></td><td class="num">${esc(it.qty)}</td><td class="num">${m(Number(it.price) * Number(it.qty))}</td></tr>`).join('')}
    </table>
    <div class="rc-totals">
      <div class="row rc-grand"><span>Total</span><b>${m(s.total)}</b></div>
      ${tendered != null ? `<div class="row"><span>Tendered</span><b>${m(tendered)}</b></div>` : ''}
      ${change != null ? `<div class="row"><span>Change</span><b>${m(change)}</b></div>` : ''}
    </div>
    <div class="rc-foot">Thank you for your purchase!<div class="mut">Keep this receipt for your records.</div></div>
    <div class="acts rc-actions">
      <button type="button" class="btn ghost" data-act="closereceipt">Close</button>
      ${S.role === 'creator' ? '<button type="button" class="btn ghost" data-act="sharereceipt">Send receipt</button>' : ''}
      <button type="button" class="btn ghost" data-act="pdfreceipt">Save PDF</button>
      <button type="button" class="btn" data-act="printreceipt">Print</button>
    </div>
  </div></div>`;
}

function deliveryReceiptHTML(d, share) {
  return `<div class="ov" data-act="closereceipt"><div class="modal receipt" role="dialog" aria-modal="true" aria-label="Delivery receipt ${esc(d.id)}">
    <div class="rc-head">
      <div class="rc-brand"><img src="assets/hero-icons/receipts-logo.png?v=1" alt="Official Receipts" class="rc-logo"></div>
      <div class="rc-title">Delivery receipt</div>
    </div>
    ${shareBannerHTML(share)}
    <div class="rc-status ok">Stock addition approved</div>
    <div class="rc-meta">
      <div><span class="mut">Receipt no.</span><b>${esc(d.id)}</b></div>
      <div><span class="mut">Request</span><b>${esc(d.requestId || '—')}</b></div>
      <div><span class="mut">Date</span><span>${esc(fmtDate(d.ts))}</span></div>
      <div><span class="mut">Time</span><span>${esc(fmtTime(d.ts))}</span></div>
      <div><span class="mut">Requested by</span><b>${esc(d.requestedBy)}</b><div class="mut">${esc(d.requestedByEmail || '')}</div></div>
      <div><span class="mut">Approved by</span><b>${esc(d.approvedBy)}</b><div class="mut">${esc(d.approvedByEmail || '')}</div></div>
    </div>
    <table class="rc-items"><tr><th>Item</th><th class="num">Qty</th></tr>
      <tr><td>${esc(d.item)}${d.note ? `<div class="mut">${esc(d.note)}</div>` : ''}</td><td class="num">${esc(d.qty)}</td></tr>
    </table>
    <div class="rc-foot">Delivery approved and added to stock.<div class="mut">This receipt records who requested and who approved the delivery.</div></div>
    <div class="acts rc-actions">
      <button type="button" class="btn ghost" data-act="closereceipt">Close</button>
      ${S.role === 'creator' ? '<button type="button" class="btn ghost" data-act="sharereceipt">Send receipt</button>' : ''}
      <button type="button" class="btn ghost" data-act="pdfreceipt">Save PDF</button>
      <button type="button" class="btn" data-act="printreceipt">Print</button>
    </div>
  </div></div>`;
}

function receiptsPage() {
  const creator = S.role === 'creator';
  const adminish = isAdminRole();
  const shares = (creator ? S.shares : S.shares.filter(x => String(x.toEmail || '').toLowerCase() === S.email.toLowerCase()))
    .slice().sort((a, b) => b.ts - a.ts);
  const deliveries = (adminish ? S.deliveries : S.deliveries.filter(d => String(d.requestedByEmail || '').toLowerCase() === S.email.toLowerCase()))
    .slice().sort((a, b) => b.ts - a.ts);
  const shareRows = shares.map(x => `<tr><td><b>${esc(x.ref)}</b><div class="mut">${x.kind === 'sale' ? 'Sale' : 'Delivery'}</div></td><td>${esc(x.fromName)}<div class="mut">${esc(x.fromEmail)}</div></td><td>${esc(x.toName)}<div class="mut">${esc(x.toEmail)}</div></td><td>${x.note ? esc(x.note) : '<span class="mut">—</span>'}</td><td>${esc(relTime(x.ts))}</td><td><button class="btn ghost sm" data-act="viewshare" data-id="${esc(x.id)}">View</button></td></tr>`).join('');
  const deliveryRows = deliveries.map(d => `<tr><td><b>${esc(d.id)}</b></td><td>${esc(d.item)}</td><td>${esc(d.qty)}</td><td>${esc(d.requestedBy)}<div class="mut">${esc(d.requestedByEmail || '')}</div></td><td>${esc(d.approvedBy)}<div class="mut">${esc(d.approvedByEmail || '')}</div></td><td>${esc(relTime(d.ts))}</td><td><button class="btn ghost sm" data-act="delivery" data-id="${esc(d.id)}">View</button></td></tr>`).join('');
  const pageSub = 'View sales and delivery receipts, share transaction records with staff, and track who sent and received each receipt.';
  return shell('receipts', `
    ${pageHero('Receipts', pageSub)}
    <div class="card">
      ${cardHead('Shared receipts', 'From → To is kept on every shared record.', `<span class="pill">${shares.length}</span>`)}
      ${shares.length ? `<div class="table-wrap"><table><tr><th>Receipt</th><th>From</th><th>To</th><th>Note</th><th>When</th><th></th></tr>${shareRows}</table></div>` : emptyState(creator ? 'No receipts sent yet. Open a sale or delivery receipt and press “Send receipt”.' : 'No receipts have been shared with you yet.', 'receipts')}
    </div>
    <div class="card" style="margin-top:16px">
      ${cardHead('Delivery receipts', 'Created when an admin or the owner approves a staff stock request.', `<span class="pill">${deliveries.length}</span>`)}
      ${deliveries.length ? `<div class="table-wrap"><table><tr><th>Receipt</th><th>Medicine</th><th>Qty</th><th>Requested by</th><th>Approved by</th><th>When</th><th></th></tr>${deliveryRows}</table></div>` : emptyState('No delivery receipts yet.', 'receipts')}
    </div>
    <div class="note" style="margin-top:16px">Only an owner can send receipts. Recipients see the sender and recipient on every shared receipt.</div>`);
}

/* ============================================================
   Accounts
   ============================================================ */
function accountsPage() {
  if (S.role !== 'creator') return admin();
  const admins = S.accounts.filter(a => a.role === 'admin').length;
  const staff = S.accounts.filter(a => a.role === 'staff').length;
  const creators = S.accounts.filter(a => a.role === 'creator').length;
  const missing = CREATOR_NAMES.filter(n => !S.accounts.some(a => a.role === 'creator' && creatorName(a.email) === n));
  /* Each owner can see their own password (with the toggle) but never another
     owner's. Admin/staff passwords are visible to every owner. No Change button
     is offered on owner rows — owners change their own from the sidebar. */
  const pwCell = a => {
    const otherOwner = a.role === 'creator' && String(a.email).toLowerCase() !== String(S.email).toLowerCase();
    if (otherOwner) return '<span class="mut">Private</span>';
    return S.showPasswords
      ? `<code class="pw-val">${esc(a.password || '—')}</code>`
      : '<span class="pw-mask">••••••••</span>';
  };
  const accActions = a => a.role === 'creator'
    ? '<span class="mut">Protected</span>'
    : `<div class="acts"><button class="btn ghost sm" data-act="editpw" data-email="${esc(a.email)}">Change</button><button class="btn red sm" data-act="delacc" data-email="${esc(a.email)}">Remove</button></div>`;
  return shell('accounts', `
    ${pageHero('Accounts', 'Create and manage user accounts, assign access roles, and control who can access the pharmacy system.', `<button class="btn hero-btn" data-act="newaccount">${icon('plus')} Add account</button>`)}
    ${missing.length ? `<div class="banner">Owner roster: <b>roi</b>, <b>chynne</b>, <b>kyla</b>. Missing: ${missing.map(n => `<button class="btn sm" data-act="addcreator" data-name="${n}">Add ${n}.creator</button>`).join(' ')}</div>` : ''}
    <div class="stats">
      ${statCard('All accounts', S.accounts.length, 'purple', 'accounts', 'Owners, admins and staff')}
      ${statCard('Admins', admins, '', 'accounts', 'Business managers')}
      ${statCard('Staff', staff, 'green', 'accounts', 'Sales and stock requests')}
      ${statCard('Owners', `${creators} / ${CREATOR_NAMES.length}`, 'amber', 'accounts', 'Protected accounts')}
    </div>
    <div class="card">
      ${cardHead('Registered accounts', 'Owners can see and reset passwords for admin and staff accounts. Owner passwords stay private. Removing an account blocks sign-in; past records keep their email.', `<div class="acts"><button class="btn ghost sm" data-act="togglepw">${S.showPasswords ? 'Hide passwords' : 'Show passwords'}</button><span class="pill">${S.accounts.length}</span></div>`)}
      <div class="table-wrap"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Password</th><th>Created</th><th>Created by</th><th></th></tr>
      ${S.accounts.map(a => `<tr><td><b>${esc(a.name)}</b></td><td>${esc(a.email)}</td><td><span class="pill ${a.role === 'creator' ? 'gold' : a.role === 'admin' ? '' : 'grn'}">${roleLabel(a.role)}</span></td><td>${pwCell(a)}</td><td>${a.createdAt ? esc(fmtDate(a.createdAt)) : '<span class="mut">—</span>'}</td><td>${esc(a.createdBy || '—')}</td><td>${accActions(a)}</td></tr>`).join('')}
      </table></div>
      <div class="note-line">Every owner starts with the password <b>1234</b>. An owner can see <b>their own</b> password and every <b>admin/staff</b> password with <b>Show passwords</b>, but other owners' passwords stay <b>Private</b>. Each owner changes their own password from the sidebar; an owner can <b>Change</b> only admin/staff passwords here. Removing an account blocks that person from signing in; their past sales, requests, and approvals stay in the records with their email. The three owner accounts cannot be removed.</div>
    </div>
    <div class="note" style="margin-top:16px">Owner emails are fixed to <b>roi.creator@gmail.com</b>, <b>chynne.creator@gmail.com</b> and <b>kyla.creator@gmail.com</b>. Add chynne and kyla here when ready — each starts with password <b>1234</b> and can change it from the sidebar. Admins and staff use <b>.admin</b> or <b>.staff</b> emails; all work emails must use <b>@gmail.com</b>, and their passwords are set when you create them. Owners can see and change only admin/staff passwords here; owner passwords stay private. Passwords are stored in this browser for this local demo.</div>`);
}

/* ============================================================
   Modals
   ============================================================ */
function modalHead(title, sub = '') {
  return `<div class="modal-head"><div><h3>${title}</h3>${sub ? `<div class="mut">${sub}</div>` : ''}</div><button type="button" class="icon-btn" data-act="close" aria-label="Close">×</button></div>`;
}

/* Styled verification dialog — the same purple "island" card language as the
   Owner overview, used instead of the browser's native confirm popup.
   Resolves true when the user confirms, false on Cancel/Escape/backdrop. */
function askConfirm(message, opts = {}) {
  return new Promise(resolve => {
    const previous = document.getElementById('confirm-ov');
    if (previous) previous.remove();
    const title = opts.title || 'Verify action';
    const okLabel = opts.okLabel || 'Confirm';
    const cancelLabel = opts.cancelLabel || 'Cancel';
    const danger = !!opts.danger;
    const ov = document.createElement('div');
    ov.id = 'confirm-ov';
    ov.className = 'confirm-ov';
    ov.innerHTML = `
      <div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="confirm-top">
          <div class="confirm-mark ${danger ? 'danger' : ''}"><img src="assets/verify-icon.png?v=3" alt=""></div>
          <div class="confirm-heading">
            <span class="eyebrow">Verification</span>
            <h3 id="confirm-title">${esc(title)}</h3>
          </div>
        </div>
        <p class="confirm-message">${esc(message)}</p>
        <div class="confirm-note">${icon('info')}<span>${danger ? 'This cannot be undone from this screen.' : 'This action takes effect immediately.'}</span></div>
        <div class="confirm-actions">
          <button type="button" class="btn ghost" id="confirm-no">${esc(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'red' : ''}" id="confirm-yes">${esc(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);

    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      ov.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = e => {
      if (e.key === 'Escape') done(false);
      if (e.key === 'Enter') done(true);
    };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if (e.target === ov) done(false); });
    ov.querySelector('#confirm-no').addEventListener('click', () => done(false));
    const yes = ov.querySelector('#confirm-yes');
    yes.addEventListener('click', () => done(true));
    yes.focus();
  });
}

function accountModal() {
  const missingCreator = S.accCreator || '';
  const prefill = missingCreator ? `${missingCreator}.creator@gmail.com` : '';
  return `<div class="ov" data-act="close"><form class="modal" id="af" role="dialog" aria-modal="true" aria-label="Add account">
    ${modalHead(missingCreator ? 'Add missing owner' : 'Add account', missingCreator ? `Create the ${missingCreator}.creator account. The owner roster is roi, chynne and kyla.` : 'Only an owner can add accounts. The email suffix sets the role.')}
    <label>Work email<input id="ac-em" type="email" maxlength="120" placeholder="Ana.admin@gmail.com" value="${esc(prefill)}" ${missingCreator ? 'readonly' : ''} required autofocus></label>
    <div class="note" id="ac-rolehint">${missingCreator ? `This will create the <b>${missingCreator}.creator@gmail.com</b> owner account.` : 'Use <b>name.creator@gmail.com</b> for an owner (roi, chynne or kyla), <b>name.admin@gmail.com</b> for admin or <b>name.staff@gmail.com</b> for staff.'}</div>
    <div id="ac-pw-fields" ${missingCreator ? 'class="hide"' : ''}>
      <label>Password<input id="ac-pw" type="password" minlength="4" placeholder="At least 4 characters" ${missingCreator ? '' : 'required'}></label>
      <label>Confirm password<input id="ac-cp" type="password" minlength="4" placeholder="Repeat the password" ${missingCreator ? '' : 'required'}></label>
      <div class="note">Admins and staff sign in with this password — set it here and share it with them. All work emails must use <b>@gmail.com</b>.</div>
    </div>
    <div class="note" id="ac-owner-note" ${missingCreator ? '' : 'class="hide"'}>An owner starts with the password <b>1234</b> and can change it from the sidebar. You cannot see or change it.</div>
    <div class="err" id="ac-er"></div>
    <div class="acts"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn">Create account</button></div>
  </form></div>`;
}

/* Self-service password change, or an owner setting a new password for an account. */
function passwordModal() {
  const target = S.pwModal;
  const self = target === 'self';
  const acc = self ? null : S.accounts.find(a => String(a.email).toLowerCase() === String(target).toLowerCase());
  if (!self && !acc) return '';
  return `<div class="ov" data-act="close"><form class="modal" id="pwf" role="dialog" aria-modal="true" aria-label="Change password">
    ${modalHead(self ? 'Change your password' : 'Change account password', self ? 'Enter your current password, then choose a new one.' : `Set a new password for ${esc(acc.name)} (${esc(acc.email)}). Share it with them after saving.`)}
    ${self ? '<label>Current password<input id="pw-current" type="password" placeholder="Your current password" required autofocus></label>' : `<div class="box"><b>${esc(acc.name)}</b><div class="mut">${esc(acc.email)} · ${roleLabel(acc.role)}</div></div>`}
    <label>New password<input id="pw-new" type="password" minlength="4" placeholder="At least 4 characters" ${self ? '' : 'autofocus'} required></label>
    <label>Confirm new password<input id="pw-confirm" type="password" minlength="4" placeholder="Repeat the new password" required></label>
    <div class="note">${self ? 'You will use the new password the next time you sign in. Your current session stays active.' : 'The new password takes effect immediately — the old one will no longer work.'} Passwords are stored in this browser for this local demo.</div>
    <div class="err" id="pw-er"></div>
    <div class="acts"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn">Change password</button></div>
  </form></div>`;
}

function shareModal() {
  const ref = S.share;
  if (!ref) return '';
  const rec = ref.kind === 'sale' ? S.sales.find(x => x.id === ref.id) : S.deliveries.find(x => x.id === ref.id);
  if (!rec) return '';
  const recipients = S.accounts.filter(a => a.role !== 'creator' && String(a.email).toLowerCase() !== S.email.toLowerCase());
  const summary = ref.kind === 'sale'
    ? `${esc(rec.itemText || 'Sale')} · ${m(rec.total)}`
    : `${esc(rec.item)} · ${esc(rec.qty)} units · approved by ${esc(rec.approvedBy)}`;
  return `<div class="ov" data-act="close"><form class="modal" id="shf" role="dialog" aria-modal="true" aria-label="Send receipt">
    ${modalHead('Send receipt', `Send ${esc(rec.id)} to an admin or staff account. The record keeps the sender and recipient.`)}
    <div class="box"><b>${esc(rec.id)}</b><div class="mut">${summary}</div></div>
    <div class="mut">From: <b style="color:var(--ink)">${esc(S.user)}</b> · ${esc(S.email)}</div>
    <label>Send to<select id="sh-to" ${recipients.length ? 'required' : 'disabled'}>${recipients.length ? recipients.map(a => `<option value="${esc(a.email)}">${esc(a.name)} — ${esc(a.email)} (${roleLabel(a.role)})</option>`).join('') : '<option value="">No admin or staff accounts yet</option>'}</select></label>
    <label>Note (optional)<textarea id="sh-note" rows="2" maxlength="200" placeholder="Why are you sending this receipt?"></textarea></label>
    <div class="note">The recipient sees this in Receipts with “From → To”. Only an owner can send receipts.</div>
    <div class="acts"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn" ${recipients.length ? '' : 'disabled'}>Send receipt</button></div>
  </form></div>`;
}

/* Picture comes first when adding a product: upload a photo or pick an illustration. */
function picturePicker(pf = {}) {
  const chosen = pf.image || 'assets/meds/generic.svg';
  const uploaded = /^data:image\//i.test(chosen);
  return `<div class="pic-picker">
    <div class="pic-preview"><img id="np-preview" src="${esc(chosen)}" alt="Product picture preview"><span>Picture preview</span></div>
    <div class="pic-controls">
      <label>Upload a photo<input id="np-upload" type="file" accept="image/*"></label>
      <label>Or choose an illustration<select id="np-img">${uploaded ? `<option value="${esc(chosen)}">Current photo</option>` : ''}${MED_IMAGES.map(([v, l]) => `<option value="${v}" ${v === chosen ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="mut">JPG, PNG or GIF up to 2 MB. The photo is saved with the product.</div>
    </div>
  </div>`;
}

function modal() {
  if (S.share) return shareModal();
  if (S.pwModal) return passwordModal();
  if (S.receipt) {
    const ref = S.receipt;
    const share = ref.shareId ? S.shares.find(x => x.id === ref.shareId) : null;
    if (ref.type === 'delivery') {
      const d = S.deliveries.find(x => x.id === ref.id);
      if (d) return deliveryReceiptHTML(d, share);
    } else {
      const s = S.sales.find(x => x.id === ref.id);
      if (s) return receiptHTML(s, share);
    }
    S.receipt = null;
  }
  if (S.accModal) return accountModal();
  if (S.addModal) {
    const pf = S.addPrefill || {};
    const approving = S.pendingStockApproval != null;
    return `<div class="ov" data-act="close"><form class="modal" id="nf" role="dialog" aria-modal="true" aria-label="Add medicine">
      ${modalHead(approving ? 'Add requested medicine' : 'Add medicine', approving ? `This approves the staff stock request for <b>${esc(pf.name || '')}</b>. Set the price and category, then save.` : 'Owners can add medicines directly. New medicines appear on the POS and inventory immediately.')}
      ${picturePicker(pf)}
      <label>Medicine name<input id="np-name" maxlength="80" placeholder="e.g. Paracetamol 500 mg" value="${esc(pf.name || '')}" required autofocus></label>
      <label>Category<input id="np-cat" maxlength="40" placeholder="e.g. Pain relief" required></label>
      <div class="two"><label>Price (₱)<input id="np-price" type="number" min="0.01" step="0.01" value="5.00" required></label><label>Cost (₱)<input id="np-cost" type="number" min="0" step="0.01" value="3.00" required></label></div>
      <label>Opening stock (units to store)<input id="np-stock" type="number" min="0" step="1" value="${pf.stock != null ? Number(pf.stock) : 0}" required></label>
      <div class="note">${approving ? 'The opening stock above is the quantity the staff requested. The request is approved and a delivery receipt is created when you save.' : 'Verify the picture, price, cost and stock before saving. Staff cannot add medicines or change stock.'}</div>
      <div class="acts"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn">${approving ? 'Add & approve request' : 'Add to inventory'}</button></div>
    </form></div>`;
  }
  if (S.prodReqModal) {
    const pf = S.addPrefill || {};
    return `<div class="ov" data-act="close"><form class="modal" id="prf" role="dialog" aria-modal="true" aria-label="Request new medicine">
      ${modalHead('Request new medicine', 'An owner reviews and approves before this product is added to inventory.')}
      ${picturePicker(pf)}
      <label>Medicine name<input id="np-name" maxlength="80" placeholder="e.g. Paracetamol 500 mg" value="${esc(pf.name || '')}" required autofocus></label>
      <label>Category<input id="np-cat" maxlength="40" placeholder="e.g. Pain relief" required></label>
      <div class="two"><label>Price (₱)<input id="np-price" type="number" min="0.01" step="0.01" value="5.00" required></label><label>Cost (₱)<input id="np-cost" type="number" min="0" step="0.01" value="3.00" required></label></div>
      <label>How many units should it store?<input id="np-stock" type="number" min="0" step="1" value="${pf.stock != null ? Number(pf.stock) : 0}" required></label>
      <label>Reason / note for the owner<textarea id="pr-note" rows="2" maxlength="200" placeholder="Why is this product needed?"></textarea></label>
      <div class="note">This does not add the product yet. It is saved as a request with your name and waits for owner approval.</div>
      <div class="acts"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn">Send for owner approval</button></div>
    </form></div>`;
  }
  if (S.stockMode === 'request' || S.stockModal != null) {
    const req = S.stockMode === 'request';
    const p = S.stockModal != null ? S.products.find(x => x.id === S.stockModal) : null;
    if (!req && !p) return '';
    const prefill = S.stockName || (p ? p.name : '');
    const options = S.products.map(x => `<option value="${esc(x.name)}">${x.stock} in stock</option>`).join('');
    return `<div class="ov" data-act="close"><form class="modal" id="sf" role="dialog" aria-modal="true" aria-label="${req ? 'Request stock' : 'Adjust stock'}">
      ${modalHead(req ? 'Request stock addition' : 'Adjust stock', req ? (p ? `${esc(p.name)} currently has <b>${p.stock}</b> units.` : 'Choose a medicine from the list, or type the name of the medicine you need.') : `${esc(p.name)} currently has <b>${p.stock}</b> units.`)}
      ${req ? `<label>Medicine<input id="sr-med" list="stock-med-list" maxlength="80" placeholder="Type or choose a medicine" value="${esc(prefill)}" required autofocus><datalist id="stock-med-list">${options}</datalist></label>` : ''}
      <label>${req ? (isAdminRole() ? 'Units Sent' : 'Units Requested') : 'Change in units'}<input id="sqty" type="number" step="1" value="10" ${req ? 'min="1"' : ''} required></label>
      ${req ? '<label>Note for the admin<textarea id="snote" rows="2" placeholder="Delivery reference, supplier, or what happened"></textarea></label>' : '<div class="note">Positive numbers add stock; negative numbers write off damaged or expired units.</div>'}
      <div class="note">${req ? 'This does not change stock yet. An admin or the owner verifies the delivery before it is added. If the medicine is new, they add it to inventory first.' : 'Admin changes take effect immediately.'}</div>
      <div class="acts"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn">${req ? 'Send for verification' : 'Save stock'}</button></div>
    </form></div>`;
  }
  const s = S.sales.find(x => x.id === S.modal);
  if (!s) return '';
  return `<div class="ov" data-act="close"><form class="modal" id="rf" role="dialog" aria-modal="true" aria-label="Request sale removal">
    ${modalHead('Request sale removal', 'An admin or the owner will review this before anything changes.')}
    <div class="box"><b>${esc(s.id)}</b> · ${esc(s.itemText)}<div class="row"><span class="mut">${esc(fmtTime(s.ts))}</span><b>${m(s.total)}</b></div></div>
    <label>Reason for removal<select id="rs"><option>Duplicate entry</option><option>Wrong item</option><option>Customer cancelled</option><option>Other</option></select></label>
    <label>Note for the admin<textarea id="nt" rows="3" placeholder="What happened?"></textarea></label>
    <div class="note">The sale stays in your records until an admin or the owner approves.</div>
    <div class="acts"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn">Send removal request</button></div>
  </form></div>`;
}

/* ============================================================
   Render
   ============================================================ */
function render() {
  const views = {start: startPage, setup: setupPage, login: loginPage, admin, pos, requests, inventory, sales: salesPage, daily: dailySalesPage, receipts: receiptsPage, accounts: accountsPage};
  $('#root').innerHTML = (views[S.view] || loginPage)() + (['login', 'setup', 'start'].includes(S.view) ? '' : modal());
  window.scrollTo(0, 0);
}
