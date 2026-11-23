'use strict';

/* ============================================================
   LAYER 3 OF 3 — DATA & INTEGRATION (inner layer)
   ------------------------------------------------------------
   Owns everything that talks to the outside world:
     • localStorage repository ("localdb") with sessionStorage fallback
     • session persistence
     • schema defaults and migration-friendly hydration
     • date/number primitives shared by the app
     • CSV export and the dependency-free PDF writer
   This layer never renders HTML and never reads the UI store.
   Depends on: browser APIs only.
   ============================================================ */

/* ---------- date + number primitives ---------- */
const pad2 = n => String(n).padStart(2, '0');
const bootDate = new Date();
const todayStr = `${bootDate.getFullYear()}-${pad2(bootDate.getMonth() + 1)}-${pad2(bootDate.getDate())}`;
const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const fmtDate = ts => new Date(ts).toLocaleDateString('en-PH', {month: 'short', day: 'numeric', year: 'numeric'});
const fmtTime = ts => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const relTime = ts => dayKey(ts) === dayKey(Date.now()) ? 'Today, ' + fmtTime(ts) : fmtDate(ts) + ', ' + fmtTime(ts);

/* ---------- storage: browser localStorage ("localdb") ----------
   Two independent workspaces live side by side: "my data" and "demo data".
   Each has its own state key and session key, so choosing one never touches
   the other. sessionStorage is only a fallback for browsers that block
   localStorage (some file:// privacy modes). */
const LS_STATE = 'pharma_state';
const LS_SESSION = 'pharma_user';
const LS_DEMO_STATE = 'pharma_demo_state';
const LS_DEMO_SESSION = 'pharma_demo_user';
let dataMode = 'mine';

const stateKey = () => dataMode === 'demo' ? LS_DEMO_STATE : LS_STATE;
const sessionKey = () => dataMode === 'demo' ? LS_DEMO_SESSION : LS_SESSION;
function setDataMode(mode) { dataMode = mode === 'demo' ? 'demo' : 'mine'; }
function getDataMode() { return dataMode; }

/* Read a workspace without switching to it — used by the choice screen. */
function peekData(mode) {
  const raw = lsGet(mode === 'demo' ? LS_DEMO_STATE : LS_STATE);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function peekSession(mode) {
  const raw = lsGet(mode === 'demo' ? LS_DEMO_SESSION : LS_SESSION);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { try { return sessionStorage.getItem(key); } catch { return null; } }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); return; } catch { try { sessionStorage.setItem(key, value); } catch { /* ignore */ } }
}
function lsRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}

/* Older builds kept state in IndexedDB. Move it across once so switching to
   localStorage does not strand anyone's saved work, then drop the old store. */
async function migrateLegacyIDB() {
  if (lsGet(LS_STATE) || !('indexedDB' in window)) return;
  try {
    const value = await new Promise((resolve, reject) => {
      const req = indexedDB.open('pharma_analytics', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv');
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const get = db.transaction('kv', 'readonly').objectStore('kv').get('state');
        get.onsuccess = () => { db.close(); resolve(get.result); };
        get.onerror = () => { db.close(); reject(get.error); };
      };
    });
    if (value) lsSet(LS_STATE, JSON.stringify(value));
  } catch { /* nothing saved in the old store */ }
  try { indexedDB.deleteDatabase('pharma_analytics'); } catch { /* ignore */ }
}

async function loadState(mode) {
  if (mode) setDataMode(mode);
  if (dataMode === 'mine') await migrateLegacyIDB();
  const raw = lsGet(stateKey());
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function saveState(snapshot) {
  lsSet(stateKey(), JSON.stringify(snapshot));
}

function loadSession() {
  const raw = lsGet(sessionKey());
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
const saveSession = user => lsSet(sessionKey(), JSON.stringify(user));
const clearSession = () => lsRemove(sessionKey());

/* ---------- export adapters ---------- */
/* Read a chosen product photo into a storable data URL. */
function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return; }
    if (!/^image\//.test(file.type)) { reject(new Error('Choose an image file.')); return; }
    if (Number(file.size) > 2 * 1024 * 1024) { reject(new Error('Photo is too large. Choose one under 2 MB.')); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.readAsDataURL(file);
  });
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function downloadCSV(rows, filename) {
  const head = ['Sale', 'Date', 'Time', 'Items', 'Payment', 'Staff', 'Staff email', 'Total', 'Status'];
  const quote = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [head.join(',')].concat(rows.map(r => [r.id, r.date, r.time, r.itemText, r.pay, r.by, r.byEmail || '', r.total, r.st].map(quote).join(',')));
  downloadBlob(new Blob([lines.join('\n')], {type: 'text/csv;charset=utf-8'}), filename);
}

/* Build a small PDF receipt with no external library.
   PDF base-14 fonts cannot draw ₱, so amounts read "PHP 1,234.50" in the PDF. */
function pdfClean(t) {
  return String(t == null ? '' : t)
    .replace(/₱/g, 'PHP ')
    .replace(/×/g, 'x')
    .replace(/[—–]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}
function pdfMoney(n) {
  return 'PHP ' + Number(n).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
function pdfFromLines(lines, minH) {
  const mm = v => v * 2.83465;
  const W = mm(80), margin = mm(7);
  let contentH = 0;
  lines.forEach(l => { contentH += (l.gap || 0) + (l.kind === 'rule' ? 7 : l.size * 1.3); });
  const H = Math.max(mm(minH), contentH + margin * 2);
  const escPDF = t => '(' + pdfClean(t).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')';
  const widthOf = (t, size, bold) => pdfClean(t).length * size * (bold ? 0.56 : 0.5);
  const ops = [];
  let y = H - margin;
  lines.forEach(l => {
    if (l.gap) y -= l.gap;
    if (l.kind === 'rule') {
      y -= 3;
      ops.push(`0.6 w 0.6 G ${margin.toFixed(2)} ${y.toFixed(2)} m ${(W - margin).toFixed(2)} ${y.toFixed(2)} l S 0 G`);
      y -= 4;
      return;
    }
    y -= l.size * 1.3;
    const draw = (t, align, bold) => {
      let x = margin;
      const w = widthOf(t, l.size, bold);
      if (align === 'center') x = (W - w) / 2;
      else if (align === 'right') x = W - margin - w;
      ops.push(`BT /${bold ? 'F2' : 'F1'} ${l.size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm ${escPDF(t)} Tj ET`);
    };
    if (l.kind === 'pair') { draw(l.l, 'left', l.bold); draw(l.r, 'right', l.bold); }
    else draw(l.t, l.align, l.bold);
  });

  const content = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(off => { pdf += String(off).padStart(10, '0') + ' 00000 n \n'; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xFF;
  return new Blob([bytes], {type: 'application/pdf'});
}

function buildReceiptPDF(s) {
  const items = Array.isArray(s.items) && s.items.length
    ? s.items
    : [{name: s.itemText || 'Sale', price: Number(s.total), qty: 1}];
  const tendered = s.tendered != null ? Number(s.tendered) : null;
  const change = s.change != null ? Number(s.change) : null;
  const lines = [];
  const text = (t, size, bold, align, gap) => lines.push({kind: 'text', t, size, bold, align, gap: gap || 0});
  const pair = (l, r, size, bold, gap) => lines.push({kind: 'pair', l, r, size, bold, gap: gap || 0});
  const rule = () => lines.push({kind: 'rule'});

  text('Main branch', 8, false, 'center', 2);
  text('OFFICIAL RECEIPT', 8, true, 'center', 6);
  rule();
  text('Receipt no.: ' + s.id, 8, false, 'left', 5);
  text('Date: ' + fmtDate(s.ts) + '  ' + fmtTime(s.ts), 8, false, 'left', 1);
  text('Sold by: ' + s.by + (s.byEmail ? ' (' + s.byEmail + ')' : ''), 8, false, 'left', 1);
  text('Payment: ' + s.pay, 8, false, 'left', 1);
  if (s.st === 'removed') text('REMOVED - STOCK RETURNED', 8, true, 'center', 5);
  else if (s.st === 'pending') text('REMOVAL PENDING ADMIN REVIEW', 8, true, 'center', 5);
  rule();
  text('ITEM / QTY', 7, true, 'left', 5);
  items.forEach(it => {
    pair(it.name, pdfMoney(Number(it.price) * Number(it.qty)), 8, false, 3);
    text('   ' + it.qty + ' x ' + pdfMoney(it.price), 7, false, 'left', 1);
  });
  rule();
  pair('Total', pdfMoney(s.total), 10, true, 5);
  if (tendered != null) pair('Tendered', pdfMoney(tendered), 8, false, 1);
  if (change != null) pair('Change', pdfMoney(change), 8, false, 1);
  rule();
  text('Thank you for your purchase!', 8, false, 'center', 6);
  text('Keep this receipt for your records.', 7, false, 'center', 1);
  return pdfFromLines(lines, 120);
}

function buildDeliveryPDF(d) {
  const lines = [];
  const text = (t, size, bold, align, gap) => lines.push({kind: 'text', t, size, bold, align, gap: gap || 0});
  const pair = (l, r, size, bold, gap) => lines.push({kind: 'pair', l, r, size, bold, gap: gap || 0});
  const rule = () => lines.push({kind: 'rule'});

  text('Main branch', 8, false, 'center', 2);
  text('DELIVERY RECEIPT', 8, true, 'center', 6);
  rule();
  text('Receipt no.: ' + d.id, 8, false, 'left', 5);
  text('Date: ' + fmtDate(d.ts) + '  ' + fmtTime(d.ts), 8, false, 'left', 1);
  text('Requested by: ' + d.requestedBy + (d.requestedByEmail ? ' (' + d.requestedByEmail + ')' : ''), 8, false, 'left', 1);
  text('Approved by: ' + d.approvedBy + (d.approvedByEmail ? ' (' + d.approvedByEmail + ')' : ''), 8, false, 'left', 1);
  rule();
  text('ITEM / QTY', 7, true, 'left', 5);
  pair(d.item, d.qty + ' units', 8, false, 3);
  if (d.note) text('Note: ' + String(d.note).slice(0, 70), 7, false, 'left', 3);
  rule();
  text('STOCK ADDITION APPROVED', 8, true, 'center', 6);
  text('This receipt records who requested and who approved the delivery.', 7, false, 'center', 1);
  return pdfFromLines(lines, 100);
}
