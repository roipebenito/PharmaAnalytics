'use strict';

/* ============================================================
   LAYER 2 OF 3 — APPLICATION / DOMAIN (middle layer)
   ------------------------------------------------------------
   Owns the rules of the pharmacy:
     • accounts, roles and creator roster
     • the live application state and its selectors
     • sales, stock, removal, receipt-sharing and account use cases
     • day / month / year reporting
   This layer never builds HTML and never opens the database
   directly. Persistence is requested through Layer 3.
   Depends on: Layer 3 (data & integration).
   ============================================================ */

/* ---------- account rules ---------- */
/* Work emails must be name.creator@domain, name.admin@domain, or name.staff@domain. */
const EMAIL_RULE = /^([a-z0-9][a-z0-9._%+-]*)\.(creator|admin|staff)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;
const emailRole = email => {
  const mm = String(email || '').trim().match(EMAIL_RULE);
  return mm ? mm[2].toLowerCase() : null;
};
const emailName = email => {
  const mm = String(email || '').trim().match(EMAIL_RULE);
  if (!mm) return '';
  const parts = mm[1].split(/[._-]+/).filter(Boolean);
  const name = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  return name || ({creator: 'Creator', admin: 'Admin', staff: 'Staff'}[mm[2].toLowerCase()] || 'User');
};
/* The system allows exactly three creator accounts, all on gmail:
   roi.creator@gmail.com, chynne.creator@gmail.com, kyla.creator@gmail.com. */
const CREATOR_NAMES = ['roi', 'chynne', 'kyla'];
const EMAIL_DOMAIN = 'gmail.com';
/* Every owner starts with this temporary password and can change it any time
   from the sidebar. It is not a secure password — it is only a starting value. */
const DEFAULT_CREATOR_PASSWORD = '1234';
const creatorName = email => {
  const mm = String(email || '').trim().match(EMAIL_RULE);
  return mm && mm[2].toLowerCase() === 'creator' ? mm[1].toLowerCase() : null;
};
const emailDomain = email => {
  const mm = String(email || '').trim().match(EMAIL_RULE);
  return mm ? mm[3].toLowerCase() : null;
};
const roleLabel = r => r === 'creator' ? 'Owner' : r === 'admin' ? 'Admin' : r === 'staff' ? 'Staff' : 'User';
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const COST_RATE = 0.6; // assumed cost when a product has no recorded cost
const LOW_STOCK = 10;
const STATE_VERSION = 3;
const FIRST_OWNER = 'roi';
/* Analytics ranges shown on the owner / admin overview. */
const ANALYTICS_RANGES = [['week', 'Weekly'], ['month', 'Monthly'], ['quarter', 'Quarterly'], ['half', 'Half a year'], ['year', 'Yearly'], ['custom', 'Custom dates']];
const defaultRepValue = p => p === 'day' ? todayStr : p === 'month' ? todayStr.slice(0, 7) : p === 'year' ? todayStr.slice(0, 4) : '';

/* ---------- application state ---------- */
const S = {
  view: 'login', role: null, user: '', email: '',
  cat: 'All', q: '', invQ: '', invFilter: 'all', cart: {}, pay: 'Cash',
  tab: 'pending', sel: '', modal: null, stockModal: null, stockMode: 'adjust', stockName: '', addModal: false,
  addPrefill: null, pendingStockApproval: null,
  receipt: null, share: null, accModal: false, accCreator: null,
  pwModal: null, showPasswords: false,
  repPeriod: 'month', repValue: '', report: null,
  anaRange: 'month', anaFrom: '', anaTo: '', prodReqModal: false,
  products: [], sales: [], requests: [], stockRequests: [],
  productRequests: [], dailySales: [],
  accounts: [], deliveries: [], shares: [],
  counters: {sale: 1000, request: 0, stockReq: 0, product: 0, productReq: 0, dailySale: 0, account: 0, delivery: 0, share: 0},
  lowStock: LOW_STOCK
};

function freshData() {
  return {
    products: [], sales: [], requests: [], stockRequests: [],
    productRequests: [], dailySales: [],
    accounts: [], deliveries: [], shares: [],
    counters: {sale: 1000, request: 0, stockReq: 0, product: 0, productReq: 0, dailySale: 0, account: 0, delivery: 0, share: 0}
  };
}

function migrateState(data) {
  data = data || {};
  // Future schema changes: bump STATE_VERSION and add migration steps here.
  if (data.v == null || data.v < 1) {
    // v0 -> v1: ensure counters exists
    if (!data.counters) data.counters = {};
  }
  if (data.v == null || data.v < 2) {
    // v1 -> v2: owner passwords were introduced so existing data stays reachable.
  }
  if (data.v == null || data.v < 3) {
    // v2 -> v3: every owner now starts with the temporary password 1234.
    // Accounts awaiting the old first-sign-in setup are activated with it.
    (Array.isArray(data.accounts) ? data.accounts : []).forEach(a => {
      if (a && a.role === 'creator') {
        a.password = DEFAULT_CREATOR_PASSWORD;
        delete a.pwPending;
      }
    });
  }
  data.v = STATE_VERSION;
  return data;
}

function applyData(data) {
  data = migrateState(data || {});
  S.products = Array.isArray(data.products) ? data.products : [];
  S.sales = Array.isArray(data.sales) ? data.sales : [];
  S.requests = Array.isArray(data.requests) ? data.requests : [];
  S.stockRequests = Array.isArray(data.stockRequests) ? data.stockRequests : [];
  S.productRequests = Array.isArray(data.productRequests) ? data.productRequests : [];
  S.dailySales = Array.isArray(data.dailySales) ? data.dailySales : [];
  S.accounts = Array.isArray(data.accounts) ? data.accounts : [];
  S.deliveries = Array.isArray(data.deliveries) ? data.deliveries : [];
  S.shares = Array.isArray(data.shares) ? data.shares : [];
  const base = freshData().counters;
  S.counters = Object.assign(base, data.counters || {});
}

/* State-change boundary: mutate S via a patch, then re-render.
   Prefer this over direct S.x = ...; render() in new code. */
function setState(patch) {
  if (typeof patch === 'function') patch(S);
  else if (patch && typeof patch === 'object') Object.assign(S, patch);
  if (typeof render === 'function') render();
  return S;
}

/* The application layer owns the shape of a persisted snapshot.
   Layer 3 only stores whatever object it receives. */
function snapshotState() {
  return {
    v: STATE_VERSION,
    products: S.products,
    sales: S.sales,
    requests: S.requests,
    stockRequests: S.stockRequests,
    productRequests: S.productRequests,
    dailySales: S.dailySales,
    accounts: S.accounts,
    deliveries: S.deliveries,
    shares: S.shares,
    counters: S.counters
  };
}

async function saveData() {
  await saveState(snapshotState());
}

/* ---------- selectors ---------- */
const pend = () => S.requests.filter(r => r.st === 'pending').length;
const pendStock = () => S.stockRequests.filter(r => r.st === 'pending').length;
const cartRows = () => Object.entries(S.cart).map(([id, q]) => { const p = S.products.find(x => x.id === Number(id)); return p ? {...p, q} : null; }).filter(Boolean);
const cartTotal = () => cartRows().reduce((a, r) => a + Number(r.price) * r.q, 0);
const liveSales = () => S.sales.filter(s => s.st !== 'removed');
const totalSales = () => liveSales().reduce((a, s) => a + Number(s.total), 0);
const saleCost = s => s.cogs != null ? Number(s.cogs) : Number(s.total) * COST_RATE;
const totalCost = () => liveSales().reduce((a, s) => a + saleCost(s), 0);
const netProfit = () => liveSales().reduce((a, s) => a + Number(s.total) - saleCost(s), 0);
const totalRemoved = () => S.requests.filter(r => r.st === 'approved').reduce((a, r) => a + Number(r.amt), 0);
const pendingAmount = () => S.requests.filter(r => r.st === 'pending').reduce((a, r) => a + Number(r.amt), 0);
const stockState = p => p.stock <= 0
  ? {cls: 'red', label: 'Out of stock'}
  : p.stock <= S.lowStock
    ? {cls: 'amb', label: 'Low stock · ' + p.stock}
    : {cls: 'grn', label: 'In stock · ' + p.stock};
const isAdminRole = () => S.role === 'admin' || S.role === 'creator';
const accountByEmail = email => S.accounts.find(a => String(a.email || '').toLowerCase() === String(email || '').toLowerCase());
const receivedShares = () => S.shares.filter(x => String(x.toEmail || '').toLowerCase() === String(S.email || '').toLowerCase());
const deliveryForRequest = id => S.deliveries.find(d => d.requestId === id);

/* ---------- analytics range selectors (owner + admin overview) ---------- */
function analyticsStart(range = S.anaRange) {
  if (range === 'custom') return S.anaFrom ? new Date(S.anaFrom + 'T00:00:00').getTime() : 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === 'week') d.setDate(d.getDate() - 6);
  else {
    const months = {month: 1, quarter: 3, half: 6, year: 12}[range] || 1;
    d.setMonth(d.getMonth() - months);
  }
  return d.getTime();
}
function analyticsEnd() {
  if (S.anaRange !== 'custom' || !S.anaTo) return Infinity;
  return new Date(S.anaTo + 'T23:59:59.999').getTime();
}
const inAnalyticsRange = ts => Number(ts) >= analyticsStart() && Number(ts) <= analyticsEnd();
const analyticsLabel = () => (ANALYTICS_RANGES.find(x => x[0] === S.anaRange) || ANALYTICS_RANGES[1])[1];
const analyticsRangeText = () => S.anaRange === 'custom'
  ? (S.anaFrom || '…') + ' to ' + (S.anaTo || '…')
  : 'from ' + fmtDate(analyticsStart());
const rangeSales = () => S.sales.filter(s => inAnalyticsRange(s.ts));
const rangeLive = () => rangeSales().filter(s => s.st !== 'removed');
const rangeTotal = () => rangeLive().reduce((a, s) => a + Number(s.total), 0);
const rangeCost = () => rangeLive().reduce((a, s) => a + saleCost(s), 0);
const rangeProfit = () => rangeTotal() - rangeCost();
const rangeRemoved = () => rangeSales().filter(s => s.st === 'removed').reduce((a, s) => a + Number(s.total), 0);
const rangeRemovedRequests = () => S.requests.filter(r => r.st === 'approved' && inAnalyticsRange(r.decidedTs || r.ts));
const rangePendingRequests = () => S.requests.filter(r => r.st === 'pending' && inAnalyticsRange(r.ts));

/* ---------- permissions ---------- */
function requireAdmin() {
  if (!isAdminRole()) throw new Error('Only administrators or an owner can change inventory.');
}
function requireCreator() {
  if (S.role !== 'creator') throw new Error('Only an owner can manage accounts, approve products or share receipts.');
}

/* ---------- sales report (day / month / year / all) ---------- */
function salesReport(period, value) {
  period = ['day', 'month', 'year', 'all'].includes(period) ? period : 'month';
  if (period === 'day') value = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : defaultRepValue('day');
  else if (period === 'month') value = /^\d{4}-\d{2}$/.test(value) ? value : defaultRepValue('month');
  else if (period === 'year') value = /^\d{4}$/.test(value) ? value : defaultRepValue('year');
  else value = '';

  const rows = S.sales.slice().sort((a, b) => b.ts - a.ts);
  const inPeriod = rows.filter(s => {
    if (period === 'day') return dayKey(s.ts) === value;
    if (period === 'month') return dayKey(s.ts).slice(0, 7) === value;
    if (period === 'year') return dayKey(s.ts).slice(0, 4) === value;
    return true;
  });

  const live = inPeriod.filter(s => s.st !== 'removed');
  const removed = inPeriod.filter(s => s.st === 'removed');
  const gross = live.reduce((a, s) => a + Number(s.total), 0);
  const cogs = live.reduce((a, s) => a + Number(s.cogs || 0), 0);
  const removedValue = removed.reduce((a, s) => a + Number(s.total), 0);

  const reportRows = inPeriod.map(s => ({
    id: s.id, date: fmtDate(s.ts), time: fmtTime(s.ts), itemText: s.itemText,
    total: Number(s.total), cogs: Number(s.cogs || 0), pay: s.pay, by: s.by, byEmail: s.byEmail || '', st: s.st
  }));

  const breakdown = [];
  if (period !== 'day') {
    const len = period === 'month' ? 10 : period === 'year' ? 7 : 4;
    const groups = {};
    live.forEach(s => {
      const key = dayKey(s.ts).slice(0, len);
      if (!groups[key]) groups[key] = {key, total: 0, count: 0};
      groups[key].total += Number(s.total);
      groups[key].count++;
    });
    Object.keys(groups).sort().forEach(k => {
      const g = groups[k];
      let label;
      if (period === 'month') label = new Date(g.key + 'T00:00:00').toLocaleDateString('en-PH', {month: 'short', day: 'numeric'});
      else if (period === 'year') label = new Date(g.key + '-01T00:00:00').toLocaleDateString('en-PH', {month: 'short', year: 'numeric'});
      else label = g.key;
      breakdown.push({label, total: round2(g.total), count: g.count});
    });
  }

  return {
    period, value,
    summary: {
      transactions: live.length,
      gross: round2(gross),
      cogs: round2(cogs),
      profit: round2(gross - cogs),
      average: live.length ? round2(gross / live.length) : 0,
      removedCount: removed.length,
      removedValue: round2(removedValue)
    },
    rows: reportRows,
    breakdown
  };
}

/* ---------- session use case ---------- */
function signIn(acc) {
  S.role = acc.role;
  S.user = acc.name || emailName(acc.email);
  S.email = acc.email;
  saveSession({email: acc.email, role: acc.role, name: S.user});
  S.view = acc.role === 'staff' ? 'pos' : 'admin';
  S.cart = {};
  S.receipt = null;
  S.share = null;
  S.accModal = false;
  S.accCreator = null;
}

/* ============================================================
   Use cases — every write goes through this layer.
   ============================================================ */
async function doSale(tendered) {
  const rows = cartRows();
  if (!rows.length) throw new Error('Add at least one medicine to the sale.');
  for (const r of rows) {
    const p = S.products.find(x => x.id === r.id);
    if (!p) throw new Error('A medicine in the cart no longer exists.');
    if (r.q < 1) throw new Error('Quantities must be at least 1.');
    if (p.stock < r.q) throw new Error(`${p.name} only has ${p.stock} in stock.`);
  }
  let total = 0, cogs = 0;
  rows.forEach(r => {
    const p = S.products.find(x => x.id === r.id);
    total += Number(p.price) * r.q;
    cogs += (p.cost != null ? Number(p.cost) : Number(p.price) * COST_RATE) * r.q;
    p.stock = Number(p.stock) - r.q;
  });
  const id = 'SL-' + (++S.counters.sale);
  const totalR = round2(total);
  const tenderedR = tendered == null ? null : round2(tendered);
  const changeR = tenderedR == null ? null : round2(Math.max(0, tenderedR - totalR));
  S.sales.unshift({
    id,
    ts: Date.now(),
    items: rows.map(r => ({id: r.id, name: r.name, price: Number(r.price), qty: r.q})),
    itemText: rows.map(r => `${r.name} × ${r.q}`).join(', '),
    total: totalR,
    cogs: round2(cogs),
    tendered: tenderedR,
    change: changeR,
    pay: S.pay || 'Cash',
    by: S.user,
    byEmail: S.email,
    st: 'ok'
  });
  S.cart = {};
  await saveData();
  return id;
}

/* Staff submit an end-of-day sales summary; it is stored in the database. */
async function doSubmitDailySales(input) {
  if (S.role !== 'staff') throw new Error('Only staff can submit daily sales.');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || '')) ? String(input.date) : todayStr;
  if (S.dailySales.some(x => x.date === date && String(x.byEmail || '').toLowerCase() === String(S.email || '').toLowerCase())) {
    throw new Error('You already submitted daily sales for ' + date + '.');
  }
  const total = Number(input.total);
  const transactions = Math.trunc(Number(input.transactions));
  if (!(total >= 0)) throw new Error('Total sales cannot be negative.');
  if (!(transactions >= 0)) throw new Error('Transactions cannot be negative.');
  const id = 'DS-' + String(++S.counters.dailySale).padStart(3, '0');
  S.dailySales.unshift({
    id, date, total: round2(total), transactions,
    note: String(input.note || '').trim().slice(0, 200),
    by: S.user, byEmail: S.email, ts: Date.now()
  });
  await saveData();
  return id;
}

async function doRequestRemoval(saleId, reason, note) {
  const sale = S.sales.find(s => s.id === saleId);
  if (!sale) throw new Error('Sale not found.');
  if (sale.st !== 'ok') throw new Error('This sale already has a removal request.');
  const id = 'REQ-' + String(++S.counters.request).padStart(3, '0');
  S.requests.unshift({
    id, sale: saleId, by: S.user, byEmail: S.email, item: sale.itemText, amt: Number(sale.total),
    reason: reason || 'Other', note: (note || '').trim(), st: 'pending', ts: Date.now()
  });
  sale.st = 'pending';
  await saveData();
  return id;
}

async function doDecideRequest(requestId, decision) {
  requireAdmin();
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Unknown decision.');
  const req = S.requests.find(r => r.id === requestId);
  if (!req) throw new Error('Removal request not found.');
  if (req.st !== 'pending') throw new Error('This request was already reviewed.');
  req.st = decision;
  req.decidedBy = S.user;
  req.decidedByEmail = S.email;
  req.decidedTs = Date.now();
  const sale = S.sales.find(s => s.id === req.sale);
  if (sale) {
    if (decision === 'approved') {
      sale.st = 'removed';
      (sale.items || []).forEach(line => {
        const p = S.products.find(x => x.id === line.id);
        if (p) p.stock = Number(p.stock) + Number(line.qty);
      });
    } else {
      sale.st = 'ok';
    }
  }
  await saveData();
}

/* Shared validation + record creation for a new medicine. */
function validateProduct(input) {
  const name = String(input.name || '').trim();
  const category = String(input.category || '').trim();
  if (!name || !category) throw new Error('Medicine name and category are required.');
  if (name.length > 80 || category.length > 40) throw new Error('Name or category is too long.');
  const price = Number(input.price);
  const cost = Number(input.cost);
  const stock = Math.trunc(Number(input.stock));
  if (!(price > 0)) throw new Error('Price must be greater than zero.');
  if (!(cost >= 0)) throw new Error('Cost cannot be negative.');
  if (!(stock >= 0)) throw new Error('Stock cannot be negative.');
  if (S.products.some(p => p.name.toLowerCase() === name.toLowerCase())) throw new Error('That medicine is already in the inventory.');
  let image = String(input.image || '').trim();
  // Built-in illustrations are relative paths; uploaded photos are data URLs.
  if (!/^assets\/meds\/[A-Za-z0-9._-]+$/.test(image) && !/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(image)) {
    image = 'assets/meds/generic.svg';
  }
  return {name, category, price: round2(price), cost: round2(cost), stock, image};
}
function addProductRecord(v) {
  const id = ++S.counters.product;
  const product = {id, name: v.name, category: v.category, price: v.price, cost: v.cost, stock: v.stock, image: v.image};
  S.products.push(product);
  return product;
}

async function doAddProduct(input) {
  requireAdmin();
  addProductRecord(validateProduct(input));
  await saveData();
}

/* Admins propose a new medicine; an owner must approve it before it is stored. */
async function doRequestProduct(input) {
  if (S.role !== 'admin') throw new Error('Only an admin can request a new medicine. An owner must approve it first.');
  const v = validateProduct(input);
  const id = 'PR-' + String(++S.counters.productReq).padStart(3, '0');
  S.productRequests.unshift({
    id, ...v, note: String(input.note || '').trim().slice(0, 200),
    stockApproval: input.stockApproval || null,
    by: S.user, byEmail: S.email, st: 'pending', ts: Date.now()
  });
  await saveData();
  return id;
}

async function doDecideProduct(requestId, decision) {
  requireCreator();
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Unknown decision.');
  const req = S.productRequests.find(r => r.id === requestId);
  if (!req) throw new Error('Product request not found.');
  if (req.st !== 'pending') throw new Error('This request was already reviewed.');
  if (decision === 'approved') {
    // Re-validate at approval time: the medicine may have been added already.
    addProductRecord(validateProduct(req));
    req.productId = S.products[S.products.length - 1].id;
  }
  req.st = decision;
  req.decidedBy = S.user;
  req.decidedByEmail = S.email;
  req.decidedTs = Date.now();
  await saveData();
  // If this request came from a staff stock addition, approving the product
  // also approves that stock request (the opening stock already has the units).
  if (decision === 'approved' && req.stockApproval) {
    const stockReq = S.stockRequests.find(r => r.id === req.stockApproval);
    if (stockReq && stockReq.st === 'pending') await doDecideStock(stockReq.id, 'approved', false);
  }
}

async function doAdjustStock(productId, amount) {
  requireAdmin();
  if (!amount) throw new Error('Enter a non-zero amount.');
  const p = S.products.find(x => x.id === productId);
  if (!p) throw new Error('Medicine not found.');
  if (Number(p.stock) + amount < 0) throw new Error('Stock cannot go below zero.');
  p.stock = Number(p.stock) + amount;
  await saveData();
}

async function doRequestStock(productId, name, qty, note) {
  if (S.role !== 'staff') throw new Error('Only staff can send stock requests.');
  const qtyN = Math.trunc(Number(qty));
  if (!(qtyN >= 1)) throw new Error('Enter how many units arrived.');
  let p = productId != null ? S.products.find(x => x.id === productId) : null;
  const typed = String(name || '').trim();
  if (!p && typed) p = S.products.find(x => x.name.toLowerCase() === typed.toLowerCase());
  if (!p && !typed) throw new Error('Choose a medicine or type its name.');
  if (!p && typed.length > 80) throw new Error('Medicine name is too long.');
  const id = 'STK-' + String(++S.counters.stockReq).padStart(3, '0');
  S.stockRequests.unshift({
    id, productId: p ? p.id : null, item: p ? p.name : typed, qty: qtyN, by: S.user, byEmail: S.email,
    note: (note || '').trim(), st: 'pending', ts: Date.now()
  });
  await saveData();
  return id;
}

async function doDecideStock(requestId, decision, addUnits = true) {
  requireAdmin();
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Unknown decision.');
  const req = S.stockRequests.find(r => r.id === requestId);
  if (!req) throw new Error('Stock request not found.');
  if (req.st !== 'pending') throw new Error('This stock request was already reviewed.');
  const p = req.productId != null
    ? S.products.find(x => x.id === req.productId)
    : S.products.find(x => x.name.toLowerCase() === String(req.item).toLowerCase());
  if (decision === 'approved') {
    if (!p) throw new Error('Add this medicine to inventory before approving the request.');
    if (addUnits) p.stock = Number(p.stock) + Number(req.qty);
  }
  req.st = decision;
  req.decidedBy = S.user;
  req.decidedByEmail = S.email;
  req.decidedTs = Date.now();
  if (decision === 'approved') {
    const id = 'DL-' + String(++S.counters.delivery).padStart(3, '0');
    S.deliveries.unshift({
      id,
      requestId: req.id,
      productId: p ? p.id : null,
      item: p ? p.name : req.item,
      qty: Number(req.qty),
      note: req.note || '',
      requestedBy: req.by || 'Staff',
      requestedByEmail: req.byEmail || '',
      approvedBy: S.user,
      approvedByEmail: S.email,
      ts: Date.now()
    });
  }
  await saveData();
}

async function doCreateAccount(email, password) {
  requireCreator();
  email = String(email || '').trim();
  const role = emailRole(email);
  if (!role) throw new Error('Use a .admin, .staff, or allowed .creator email address.');
  if (emailDomain(email) !== EMAIL_DOMAIN) throw new Error('Work emails must use @gmail.com.');
  if (role === 'creator') {
    const local = creatorName(email);
    if (!CREATOR_NAMES.includes(local)) throw new Error('Only roi.creator@gmail.com, chynne.creator@gmail.com and kyla.creator@gmail.com are allowed as owners.');
    if (email.toLowerCase() !== `${local}.creator@gmail.com`) throw new Error(`The ${local} owner must use ${local}.creator@gmail.com.`);
    if (S.accounts.some(a => a.role === 'creator' && creatorName(a.email) === local)) throw new Error(`${local}.creator already exists.`);
    if (S.accounts.filter(a => a.role === 'creator').length >= CREATOR_NAMES.length) throw new Error('All three owner accounts already exist.');
  }
  if (accountByEmail(email)) throw new Error('An account with that email already exists.');
  /* Owners always start with 1234; they change it themselves from the sidebar.
     Admins and staff use the password set here. */
  if (role !== 'creator' && String(password || '').length < 4) throw new Error('Password must be at least 4 characters.');
  S.accounts.push({
    email, role, name: emailName(email),
    password: role === 'creator' ? DEFAULT_CREATOR_PASSWORD : String(password),
    createdAt: Date.now(), createdBy: S.email
  });
  await saveData();
  return email;
}

async function doRemoveAccount(email) {
  requireCreator();
  const acc = accountByEmail(email);
  if (!acc) throw new Error('Account not found.');
  if (acc.role === 'creator') throw new Error('Creator accounts cannot be removed.');
  if (String(acc.email).toLowerCase() === S.email.toLowerCase()) throw new Error('You cannot remove your own account.');
  S.accounts = S.accounts.filter(a => String(a.email).toLowerCase() !== String(acc.email).toLowerCase());
  await saveData();
}

/* ---------- password changes ---------- */
/* Any signed-in user can change their own password after proving the old one. */
async function doChangePassword(current, next, confirm) {
  const acc = accountByEmail(S.email);
  if (!acc) throw new Error('Your account no longer exists. Ask an owner to restore it.');
  if (String(current || '') !== String(acc.password || '')) throw new Error('Current password is incorrect.');
  const pw = String(next || '');
  if (pw.length < 4) throw new Error('New password must be at least 4 characters.');
  if (pw !== String(confirm || '')) throw new Error('New passwords do not match.');
  if (pw === String(acc.password || '')) throw new Error('Choose a password different from your current one.');
  acc.password = pw;
  await saveData();
}

/* An owner can reset an admin or staff password without knowing the old one.
   Owner passwords stay private: an owner can only change their own password,
   through doChangePassword in the sidebar. */
async function doSetAccountPassword(email, next, confirm) {
  requireCreator();
  const acc = accountByEmail(email);
  if (!acc) throw new Error('Account not found.');
  if (acc.role === 'creator') throw new Error('Owner passwords are private. Each owner changes their own password from the sidebar.');
  const pw = String(next || '');
  if (pw.length < 4) throw new Error('Password must be at least 4 characters.');
  if (pw !== String(confirm || '')) throw new Error('Passwords do not match.');
  acc.password = pw;
  await saveData();
}

async function doShareReceipt(kind, refId, toEmail, note) {
  requireCreator();
  if (!['sale', 'delivery'].includes(kind)) throw new Error('Unknown receipt type.');
  const rec = kind === 'sale' ? S.sales.find(s => s.id === refId) : S.deliveries.find(d => d.id === refId);
  if (!rec) throw new Error('Receipt not found.');
  const to = accountByEmail(toEmail);
  if (!to) throw new Error('Choose a recipient account.');
  if (!['admin', 'staff'].includes(to.role)) throw new Error('Receipts can be sent to admin or staff accounts.');
  if (String(to.email).toLowerCase() === S.email.toLowerCase()) throw new Error('Choose another account.');
  const id = 'SHR-' + String(++S.counters.share).padStart(3, '0');
  S.shares.unshift({
    id, kind, ref: refId,
    fromName: S.user, fromEmail: S.email,
    toName: to.name, toEmail: to.email,
    note: String(note || '').trim().slice(0, 200),
    ts: Date.now()
  });
  await saveData();
  return id;
}

/* ---------- first-time setup + authentication use cases ---------- */
/* First-time setup creates only the first owner (roi). The other owners are
   added later from Accounts, just like any other account. */
async function doSetupCreators() {
  const email = `${FIRST_OWNER}.creator@gmail.com`;
  if (accountByEmail(email)) throw new Error(email + ' is already registered.');
  const owner = {
    email, role: 'creator', name: emailName(email),
    password: DEFAULT_CREATOR_PASSWORD, createdAt: Date.now(), createdBy: 'First-time setup'
  };
  S.accounts.push(owner);
  await saveData();
  signIn(owner);
  return owner;
}

function authenticate(email, password) {
  email = String(email || '').trim();
  const role = emailRole(email);
  if (!role) throw new Error('Use a work email with .creator, .admin, or .staff — e.g. Roi.staff@gmail.com');
  const acc = accountByEmail(email);
  if (!acc) throw new Error('No account found for that email. Ask an owner to create one.');
  if (!['creator', 'admin', 'staff'].includes(acc.role)) throw new Error('This account has an invalid role. Ask an owner to fix it.');
  if (!password) throw new Error('Enter your password.');
  if (String(acc.password || '') !== password) throw new Error('Incorrect password.');
  signIn(acc);
  return acc;
}

/* ---------- demo data ---------- */
/* A complete sample workspace so every screen has something to show. It is
   built with the same record shapes the real use cases write, and loading it
   replaces whatever is currently saved in this browser. */
async function doLoadDemoData() {
  const now = Date.now();
  const ago = (days, hours = 0) => now - days * 86400000 - hours * 3600000;

  const account = (email, password, createdBy = 'First-time setup') => ({
    email, role: emailRole(email), name: emailName(email), password,
    createdAt: ago(60), createdBy
  });
  const accounts = [
    account('roi.creator@gmail.com', DEFAULT_CREATOR_PASSWORD),
    account('chynne.creator@gmail.com', DEFAULT_CREATOR_PASSWORD, 'roi.creator@gmail.com'),
    account('kyla.creator@gmail.com', DEFAULT_CREATOR_PASSWORD, 'roi.creator@gmail.com'),
    account('Ana.admin@gmail.com', 'admin123', 'roi.creator@gmail.com'),
    account('Ben.admin@gmail.com', 'admin123', 'roi.creator@gmail.com'),
    account('Mika.admin@gmail.com', 'admin123', 'roi.creator@gmail.com'),
    account('Bea.staff@gmail.com', 'staff123', 'Ana.admin@gmail.com'),
    account('Ben.staff@gmail.com', 'staff123', 'Ana.admin@gmail.com'),
    account('Cara.staff@gmail.com', 'staff123', 'Ana.admin@gmail.com'),
    account('Dino.staff@gmail.com', 'staff123', 'Mika.admin@gmail.com'),
    account('Eve.staff@gmail.com', 'staff123', 'Mika.admin@gmail.com')
  ];

  /* Pharmacy-scale retail prices and costs, so the money shown on every
     screen reflects a real pharmacy's daily takings, not pocket change. */
  const productDefs = [
    ['Paracetamol 500mg', 'Pain relief', 150, 84, 84, 'paracetamol.svg'],
    ['Ibuprofen 400mg', 'Pain relief', 190, 110, 46, 'ibuprofen.svg'],
    ['Amoxicillin 500mg', 'Antibiotic', 370, 210, 8, 'amoxicillin.svg'],
    ['Loratadine 10mg', 'Allergy', 220, 124, 62, 'loratadine.svg'],
    ['Cough Syrup 100ml', 'Cough & cold', 330, 184, 0, 'cough-syrup.svg'],
    ['Vitamin C 500mg', 'Supplement', 280, 156, 33, 'vitamin-c.svg'],
    ['Aspirin 80mg', 'Pain relief', 130, 72, 95, 'generic.svg'],
    ['Metformin 500mg', 'Diabetes', 240, 136, 6, 'generic.svg'],
    ['Cetirizine 10mg', 'Allergy', 190, 106, 41, 'generic.svg'],
    ['Zinc 10mg', 'Supplement', 260, 144, 20, 'generic.svg'],
    ['Omeprazole 20mg', 'Gastro', 350, 196, 27, 'generic.svg'],
    ['Vitamin D3 1000 IU', 'Supplement', 640, 360, 15, 'generic.svg'],
    ['Prednisone 10mg', 'Anti-inflammatory', 160, 90, 72, 'generic.svg'],
    ['Salbutamol inhaler', 'Respiratory', 1380, 780, 4, 'generic.svg'],
    ['Bandage roll', 'First aid', 280, 156, 58, 'generic.svg'],
    ['Digital thermometer', 'Devices', 1500, 840, 9, 'generic.svg']
  ];
  const products = productDefs.map((d, i) => ({
    id: i + 1, name: d[0], category: d[1], price: d[2], cost: d[3], stock: d[4], image: 'assets/meds/' + d[5]
  }));
  const product = id => products.find(p => p.id === id);

  const pays = ['Cash', 'Card', 'Mobile'];
  const sellers = ['Bea.staff@gmail.com', 'Ben.staff@gmail.com', 'Cara.staff@gmail.com', 'Dino.staff@gmail.com', 'Eve.staff@gmail.com'];
  const admins = ['Ana.admin@gmail.com', 'Ben.admin@gmail.com', 'Mika.admin@gmail.com'];
  /* A realistic business rhythm: busy weeks, quiet weeks and a few closed
     days. Analytics then shows real peaks and downtimes, not a flat line. */
  const weekFactor = w => [1.1, 0.9, 1.15, 0.95, 1.05, 0.88][((w % 6) + 6) % 6];
  const CLOSED = [17, 59, 104, 152, 199, 248, 296, 340]; // stock counts / holidays
  const dayFactor = d => {
    if (CLOSED.includes(d)) return 0;
    const rhythm = [0.92, 1.08, 1.14, 1, 0.88, 1.06, 1.12][d % 7];
    return weekFactor(Math.floor(d / 7)) * rhythm;
  };
  const makeSale = (d, i) => {
    const f = dayFactor(d);
    const lineCount = Math.max(1, Math.round(((i % 4) + 2) * Math.min(1.2, Math.max(0.4, f))));
    const lines = [];
    for (let k = 0; k < lineCount; k++) {
      const p = product(((i * 3 + k * 5) % products.length) + 1);
      lines.push({id: p.id, name: p.name, price: p.price, qty: ((i + k * 3) % 10) + 8});
    }
    const total = round2(lines.reduce((a, l) => a + l.price * l.qty, 0));
    const cogs = round2(lines.reduce((a, l) => a + product(l.id).cost * l.qty, 0));
    const tendered = i % 2 === 0 ? Math.ceil(total / 500) * 500 : null;
    const byEmail = sellers[i % sellers.length];
    return {
      id: 'SL-' + (1001 + i), ts: ago(d, 8 + (i % 10)),
      items: lines, itemText: lines.map(l => `${l.name} × ${l.qty}`).join(', '),
      total, cogs, tendered,
      change: tendered == null ? null : round2(tendered - total),
      pay: pays[i % pays.length], by: emailName(byEmail), byEmail, st: 'ok'
    };
  };
  const sales = [];
  /* Every day gets a gentle mix: 0 on the few closed days, 1–2 on quiet days
     and 2–3 on busy ones. The daily chart shows modest, realistic movement. */
  for (let d = 0; d <= 365; d++) {
    const n = Math.round(dayFactor(d) * (d < 35 ? 2.4 : 1.25));
    for (let j = 0; j < n; j++) sales.push(makeSale(d, sales.length));
  }
  const sale = id => sales.find(s => s.id === id);
  ['SL-1004', 'SL-1009', 'SL-1015', 'SL-1022'].forEach(id => { const s = sale(id); if (s) s.st = 'pending'; });
  ['SL-1011', 'SL-1018', 'SL-1027', 'SL-1035'].forEach(id => { const s = sale(id); if (s) s.st = 'removed'; });

  const reviewed = (by, byEmail, days) => ({decidedBy: by, decidedByEmail: byEmail, decidedTs: ago(Math.max(0, days - 1))});
  const removal = (id, ref, st, byEmail, reason, note, days, decided) => {
    const s = sale(ref);
    return {
      id, sale: ref, by: emailName(byEmail), byEmail, item: s.itemText, amt: s.total,
      reason, note, st, ts: ago(days),
      ...(st === 'pending' ? {} : reviewed(decided[0], decided[1], days))
    };
  };
  const requests = [
    removal('REQ-001', 'SL-1004', 'pending', sellers[0], 'Wrong quantity', 'Entered five boxes instead of two.', 1),
    removal('REQ-002', 'SL-1009', 'pending', sellers[1], 'Wrong price', 'Customer was charged the old price.', 2),
    removal('REQ-003', 'SL-1015', 'pending', sellers[3], 'Duplicate entry', 'The same sale was recorded twice.', 3),
    removal('REQ-004', 'SL-1022', 'pending', sellers[4], 'Wrong item', 'Picked the wrong medicine from the catalog.', 5),
    removal('REQ-005', 'SL-1011', 'approved', sellers[2], 'Returned item', 'Customer returned one pack.', 6, ['Ana', 'Ana.admin@gmail.com']),
    removal('REQ-006', 'SL-1018', 'approved', sellers[0], 'Cancelled order', 'Customer cancelled before payment.', 8, ['Roi', 'roi.creator@gmail.com']),
    removal('REQ-007', 'SL-1027', 'approved', sellers[1], 'Wrong quantity', 'Two units were never handed over.', 11, ['Mika', 'Mika.admin@gmail.com']),
    removal('REQ-008', 'SL-1035', 'approved', sellers[4], 'Price correction', 'The discounted price was not applied.', 16, ['Ana', 'Ana.admin@gmail.com']),
    removal('REQ-009', 'SL-1040', 'rejected', sellers[2], 'Changed mind', 'Customer decided to keep the purchase.', 20, ['Roi', 'roi.creator@gmail.com']),
    removal('REQ-010', 'SL-1048', 'rejected', sellers[3], 'Late request', 'Reported too long after the sale.', 45, ['Mika', 'Mika.admin@gmail.com'])
  ];

  const stockReq = (id, productId, item, qty, byEmail, note, st, days, decided) => ({
    id, productId, item, qty, by: emailName(byEmail), byEmail, note, st, ts: ago(days),
    ...(st === 'pending' ? {} : reviewed(decided[0], decided[1], days))
  });
  const stockRequests = [
    stockReq('STK-001', 3, product(3).name, 20, sellers[0], 'New delivery arrived this morning.', 'pending', 1),
    stockReq('STK-002', null, 'Loratadine 5mg', 15, sellers[3], 'New strength — not in inventory yet.', 'pending', 2),
    stockReq('STK-003', 5, product(5).name, 30, sellers[4], 'Supplier restock for cough season.', 'pending', 4),
    stockReq('STK-006', 14, product(14).name, 12, sellers[2], 'Inhalers just arrived.', 'pending', 7),
    stockReq('STK-004', 5, product(5).name, 24, sellers[2], 'Supplier restock.', 'approved', 9, ['Roi', 'roi.creator@gmail.com']),
    stockReq('STK-005', 8, product(8).name, 18, sellers[0], 'Monthly delivery.', 'approved', 6, ['Ana', 'Ana.admin@gmail.com']),
    stockReq('STK-007', 14, product(14).name, 8, sellers[3], 'Emergency refill.', 'approved', 12, ['Mika', 'Mika.admin@gmail.com']),
    stockReq('STK-009', 16, product(16).name, 6, sellers[4], 'New thermometers delivered.', 'approved', 15, ['Roi', 'roi.creator@gmail.com']),
    stockReq('STK-008', 7, product(7).name, 10, sellers[1], 'Extra units are not needed.', 'rejected', 14, ['Ana', 'Ana.admin@gmail.com'])
  ];
  const delivery = (id, ref, p, qty, byEmail, approvedBy, approvedByEmail, days, note) => ({
    id, requestId: ref, productId: p.id, item: p.name, qty, note,
    requestedBy: emailName(byEmail), requestedByEmail: byEmail,
    approvedBy, approvedByEmail, ts: ago(days)
  });
  const deliveries = [
    delivery('DL-001', 'STK-004', product(5), 24, sellers[2], 'Roi', 'roi.creator@gmail.com', 8, 'Supplier restock.'),
    delivery('DL-002', 'STK-005', product(8), 18, sellers[0], 'Ana', 'Ana.admin@gmail.com', 5, 'Monthly delivery.'),
    delivery('DL-003', 'STK-007', product(14), 8, sellers[3], 'Mika', 'Mika.admin@gmail.com', 11, 'Emergency refill.'),
    delivery('DL-004', 'STK-009', product(16), 6, sellers[4], 'Roi', 'roi.creator@gmail.com', 14, 'New thermometers delivered.')
  ];

  const productReq = (id, name, category, price, cost, stock, byEmail, st, days, note, extra = {}) => ({
    id, name, category, price, cost, stock, image: 'assets/meds/generic.svg', note,
    stockApproval: extra.stockApproval || null,
    by: emailName(byEmail), byEmail, st, ts: ago(days),
    ...(st === 'pending' ? {} : {...reviewed(extra.decidedBy, extra.decidedByEmail, days), productId: extra.productId})
  });
  const productRequests = [
    productReq('PR-001', 'Loratadine 5mg', 'Allergy', 95, 53, 15, admins[0], 'pending', 2, 'Matches the pending stock request.', {stockApproval: 'STK-002'}),
    productReq('PR-002', 'Nebulizer mask', 'Respiratory', 380, 210, 10, admins[1], 'pending', 5, 'Often requested by customers.'),
    productReq('PR-003', 'Electrolyte powder', 'Supplement', 150, 82, 24, admins[2], 'pending', 9, 'For the summer demand.'),
    productReq('PR-004', 'Omeprazole 20mg', 'Gastro', 175, 98, 27, admins[0], 'approved', 28, 'Added to inventory.', {decidedBy: 'Roi', decidedByEmail: 'roi.creator@gmail.com', productId: 11}),
    productReq('PR-005', 'Vitamin D3 1000 IU', 'Supplement', 320, 180, 15, admins[1], 'approved', 40, 'Added to inventory.', {decidedBy: 'Ana', decidedByEmail: 'Ana.admin@gmail.com', productId: 12}),
    productReq('PR-006', 'Digital thermometer', 'Devices', 750, 420, 9, admins[2], 'approved', 55, 'Added to inventory.', {decidedBy: 'Roi', decidedByEmail: 'roi.creator@gmail.com', productId: 16}),
    productReq('PR-007', 'Melatonin 3mg', 'Supplement', 240, 130, 10, admins[0], 'rejected', 62, 'Not on the approved list.', {decidedBy: 'Mika', decidedByEmail: 'Mika.admin@gmail.com'})
  ];

  const dailyNotes = [
    'Steady day with several walk-ins.', 'Fewer transactions in the afternoon.',
    'Busy day near closing time.', 'Slow morning, picked up later.',
    'Weekend rush at the main branch.', 'Several large purchases.',
    'Quiet week — well below the usual daily take.', 'Closed for stock count in the morning.',
    'Short staffed in the evening.', 'Stock queries slowed the counter.',
    'Good day for supplements.', 'Public holiday — almost no sales.',
    'New deliveries arrived in the morning.', 'Close to the monthly target.'
  ];
  const dailySales = dailyNotes.map((note, i) => ({
    id: 'DS-' + String(i + 1).padStart(3, '0'), date: dayKey(ago(i)),
    total: 40000 + ((i * 8500) % 80000), transactions: 30 + ((i * 11) % 65),
    note, by: emailName(sellers[i % sellers.length]), byEmail: sellers[i % sellers.length], ts: ago(i, 18)
  }));

  const share = (id, kind, ref, toEmail, note, days) => ({
    id, kind, ref, fromName: 'Roi', fromEmail: 'roi.creator@gmail.com',
    toName: emailName(toEmail), toEmail, note, ts: ago(days)
  });
  const shareDefs = [
    ['sale', 'SL-1001', admins[0], 'Please file this receipt.', 1],
    ['sale', 'SL-1005', sellers[0], 'Copy for your records.', 2],
    ['delivery', 'DL-001', sellers[1], 'Delivery for your reference.', 4],
    ['sale', 'SL-1012', sellers[2], 'Removed sale record.', 6],
    ['delivery', 'DL-002', admins[1], 'Approved delivery.', 5],
    ['sale', 'SL-1018', sellers[3], 'Corrected sale receipt.', 8],
    ['sale', 'SL-1027', admins[2], 'Please review this removal.', 10],
    ['delivery', 'DL-003', sellers[4], 'Inhaler delivery.', 11],
    ['sale', 'SL-1033', sellers[0], 'End-of-day copy.', 13],
    ['sale', 'SL-1041', admins[0], 'Monthly filing.', 18],
    ['delivery', 'DL-004', sellers[2], 'Thermometer delivery.', 15],
    ['sale', 'SL-1052', sellers[4], 'Receipt for your records.', 25]
  ];
  const shares = shareDefs.map((x, i) => share('SHR-' + String(i + 1).padStart(3, '0'), x[0], x[1], x[2], x[3], x[4]));

  applyData({
    v: STATE_VERSION, accounts, products, sales, requests, stockRequests,
    productRequests, dailySales, deliveries, shares,
    counters: {
      sale: 1000 + sales.length, request: 10, stockReq: 9, product: 16, productReq: 7,
      dailySale: 14, account: 11, delivery: 4, share: 12
    }
  });
  await saveData();
  signIn(accounts[0]);
  return accounts[0];
}
