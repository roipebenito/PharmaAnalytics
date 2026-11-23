'use strict';

/* ============================================================
   COMPOSITION ROOT — bootstrap
   ------------------------------------------------------------
   The only file that knows all three layers exist. It wires
   browser events to application use cases, asks the
   presentation layer to render, and hydrates the app on load.

   Load order in index.html:
     1. js/data.js          (inner  — storage/exports)
     2. js/business.js   (middle — rules/use cases)
     3. js/presentation.js  (outer  — screens/markup)
     4. js/app.js                   (this file)
   ============================================================ */

const go = v => { S.view = v; render(); };

/* ============================================================
   Click actions
   ============================================================ */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const d = t.dataset, a = d.act;

  if (a === 'close') {
    if (e.target.closest('.modal') && !t.matches('button')) return;
    if (S.share) { S.share = null; render(); return; }
    S.modal = null; S.stockModal = null; S.addModal = false; S.prodReqModal = false;
    S.addPrefill = null; S.pendingStockApproval = null;
    S.stockMode = 'adjust'; S.stockName = ''; S.accModal = false; S.accCreator = null;
    S.pwModal = null;
    render();
  }
  else if (a === 'go') { if (d.v === 'sales') openSales(); else go(d.v); }
  else if (a === 'back') { S.view = 'start'; render(); }
  else if (a === 'out') {
    if (!(await askConfirm('Sign out of this account?', {title: 'Sign out?', okLabel: 'Sign out'}))) return;
    clearSession();
    S.role = null; S.user = ''; S.email = ''; S.cart = {};
    S.receipt = null; S.share = null; S.accModal = false; S.accCreator = null; S.prodReqModal = false;
    S.pwModal = null; S.showPasswords = false;
    S.view = 'start';
    render();
  }
  else if (a === 'mydata') {
    try {
      const data = await loadState('mine');
      applyData(data || {});
      const session = loadSession();
      const acc = session ? accountByEmail(session.email) : null;
      if (acc && ['creator', 'admin', 'staff'].includes(acc.role)) signIn(acc);
      else {
        if (session) clearSession();
        S.view = S.accounts.some(x => x.role === 'creator') ? 'login' : 'setup';
      }
      render();
    } catch (err) { toast(err.message); }
  }
  else if (a === 'startdemo') {
    try {
      const wanted = d.role;
      const data = await loadState('demo');
      applyData(data || {});
      const session = loadSession();
      const acc = session ? accountByEmail(session.email) : null;
      let chosen = acc && ['creator', 'admin', 'staff'].includes(acc.role) && (!wanted || acc.role === wanted) ? acc : null;
      if (!chosen) {
        if (session) clearSession();
        /* Saved demo data always wins: reopen it instead of rebuilding it. */
        let savedAccounts = (data && data.accounts) || [];
        if (!savedAccounts.length) {
          await doLoadDemoData();
          savedAccounts = S.accounts;
        }
        chosen = savedAccounts.find(x => x.role === wanted)
          || savedAccounts.find(x => x.role === 'creator')
          || savedAccounts[0];
        if (chosen) signIn(chosen);
      }
      render();
      const noun = data ? 'opened' : 'created';
      toast(`Demo workspace ${noun} as ${chosen ? roleLabel(chosen.role) : 'owner'} — your own data is untouched`);
    } catch (err) { toast(err.message); }
  }
  else if (a === 'exp') {
    if (S.view === 'sales' && S.report) downloadCSV(S.report.rows, 'sales-report.csv');
    else downloadCSV(S.sales.map(s => ({id: s.id, date: fmtDate(s.ts), time: fmtTime(s.ts), itemText: s.itemText, pay: s.pay, by: s.by, byEmail: s.byEmail || '', total: s.total, st: s.st})), 'sales.csv');
    toast('Report exported');
  }
  else if (a === 'add') { S.cart[d.id] = (S.cart[d.id] || 0) + 1; const y = scrollY; render(); scrollTo(0, y); }
  else if (a === 'q') { const n = (S.cart[d.id] || 0) + Number(d.d); n > 0 ? S.cart[d.id] = n : delete S.cart[d.id]; const y = scrollY; render(); scrollTo(0, y); }
  else if (a === 'pay') { S.pay = d.p; const y = scrollY; render(); scrollTo(0, y); }
  else if (a === 'cat') { S.cat = d.c; render(); }
  else if (a === 'rm') { S.modal = d.id; render(); }
  else if (a === 'tab') { S.tab = d.t; S.sel = (S.requests.find(r => r.st === d.t) || {}).id || ''; render(); }
  else if (a === 'pick') { S.sel = d.id; render(); }
  else if (a === 'invfilter') { S.invFilter = d.f; render(); }
  else if (a === 'restock') { S.stockMode = 'adjust'; S.stockModal = Number(d.id); S.stockName = ''; render(); }
  else if (a === 'reqstock') { const p = S.products.find(x => x.id === Number(d.id)); S.stockMode = 'request'; S.stockModal = Number(d.id); S.stockName = p ? p.name : ''; render(); }
  else if (a === 'reqstockall') { S.stockMode = 'request'; S.stockModal = null; S.stockName = ''; render(); }
  else if (a === 'newprod') { S.addModal = true; S.prodReqModal = false; S.addPrefill = null; S.pendingStockApproval = null; render(); }
  else if (a === 'newprodreq') { S.prodReqModal = true; S.addModal = false; S.addPrefill = null; S.pendingStockApproval = null; render(); }
  else if (a === 'newaccount') { S.accModal = true; S.accCreator = null; render(); }
  else if (a === 'addcreator') { S.accModal = true; S.accCreator = d.name; render(); }
  else if (a === 'changepw') { S.pwModal = 'self'; render(); }
  else if (a === 'editpw') { S.pwModal = d.email; render(); }
  else if (a === 'togglepw') { S.showPasswords = !S.showPasswords; render(); }
  else if (a === 'delacc') {
    const email = d.email;
    if (!(await askConfirm('Remove the account ' + email + '? They will no longer be able to sign in.', {title: 'Remove account?', okLabel: 'Remove account', danger: true}))) return;
    try {
      await doRemoveAccount(email);
      render();
      toast('Account removed');
    } catch (err) { toast(err.message); }
  }
  else if (a === 'anarange') {
    S.anaRange = d.r;
    if (d.r === 'custom' && !S.anaFrom) {
      const f = new Date(); f.setDate(f.getDate() - 29);
      S.anaFrom = dayKey(f.getTime()); S.anaTo = todayStr;
    }
    render();
  }
  else if (a === 'anadates') {
    const from = $('#ana-from') ? $('#ana-from').value : '';
    const to = $('#ana-to') ? $('#ana-to').value : '';
    if (!from || !to) { toast('Choose both a start and an end date.'); return; }
    if (from > to) { toast('The start date must be on or before the end date.'); return; }
    S.anaFrom = from; S.anaTo = to; render();
    toast('Analytics: ' + from + ' to ' + to);
  }
  else if (a === 'repperiod') openSales(d.p, defaultRepValue(d.p));
  else if (a === 'repgo') { const el = $('#rep-val'); openSales(S.repPeriod, el ? el.value : S.repValue); }
  else if (a === 'done') {
    const rows = cartRows();
    if (!rows.length) return;
    const isCash = (S.pay || 'Cash') === 'Cash';
    const raw = $('#tn') ? $('#tn').value.trim() : '';
    const cashIn = isCash && raw !== '' ? Number(raw) : null;
    if (cashIn != null && !(cashIn >= cartTotal())) { toast('Amount tendered is less than the total due.'); return; }
    const tendered = isCash ? (cashIn == null ? cartTotal() : cashIn) : null;
    if (!(await askConfirm('Complete this sale for ' + m(cartTotal()) + '? Stock will be deducted immediately.', {title: 'Complete sale?', okLabel: 'Complete sale'}))) return;
    t.disabled = true; t.textContent = 'Completing…';
    try {
      const id = await doSale(tendered);
      S.receipt = {type: 'sale', id};
      render();
      toast('Sale ' + id + ' completed');
    } catch (err) { toast(err.message); render(); }
  }
  else if (a === 'receipt') { S.receipt = {type: 'sale', id: d.id}; S.share = null; render(); }
  else if (a === 'delivery') { S.receipt = {type: 'delivery', id: d.id}; S.share = null; render(); }
  else if (a === 'viewshare') {
    const sh = S.shares.find(x => x.id === d.id);
    if (!sh) return;
    S.receipt = {type: sh.kind, id: sh.ref, shareId: sh.id};
    S.share = null;
    render();
  }
  else if (a === 'sharereceipt') {
    if (S.role !== 'creator' || !S.receipt) return;
    S.share = {kind: S.receipt.type, id: S.receipt.id};
    render();
  }
  else if (a === 'closereceipt') {
    if (e.target.closest('.receipt') && !t.matches('button')) return;
    S.receipt = null; S.share = null; render();
  }
  else if (a === 'printreceipt') { window.print(); }
  else if (a === 'pdfreceipt') {
    const ref = S.receipt;
    if (!ref) return;
    if (ref.type === 'delivery') {
      const dl = S.deliveries.find(x => x.id === ref.id);
      if (!dl) return;
      downloadBlob(buildDeliveryPDF(dl), 'delivery-' + dl.id + '.pdf');
      toast('Delivery PDF downloaded');
    } else {
      const sale = S.sales.find(x => x.id === ref.id);
      if (!sale) return;
      downloadBlob(buildReceiptPDF(sale), 'receipt-' + sale.id + '.pdf');
      toast('PDF receipt downloaded');
    }
  }
  else if (a === 'dec') {
    if (!(await askConfirm((d.d === 'approved' ? 'Approve' : 'Reject') + ' removal request ' + (d.id || S.sel) + '? ' + (d.d === 'approved' ? 'The sale will be removed and stock returned.' : 'The sale will stay active.'), {title: 'Review removal request', okLabel: d.d === 'approved' ? 'Approve removal' : 'Reject removal', danger: d.d === 'rejected'}))) return;
    t.disabled = true;
    try {
      await doDecideRequest(d.id || S.sel, d.d);
      S.tab = 'pending';
      S.sel = (S.requests.find(x => x.st === 'pending') || {}).id || '';
      render();
      toast(d.d === 'approved' ? 'Removal approved' : 'Removal rejected');
    } catch (err) { toast(err.message); t.disabled = false; }
  }
  else if (a === 'stkdec') {
    if (!(await askConfirm((d.d === 'approved' ? 'Approve' : 'Reject') + ' stock request ' + d.id + '? ' + (d.d === 'approved' ? 'The units will be added to inventory and a delivery receipt created.' : 'No stock will change.'), {title: 'Review stock request', okLabel: d.d === 'approved' ? 'Approve stock' : 'Reject stock', danger: d.d === 'rejected'}))) return;
    const req = S.stockRequests.find(r => r.id === d.id);
    const missing = req && d.d === 'approved' && !S.products.some(p =>
      (req.productId != null && p.id === req.productId) ||
      p.name.toLowerCase() === String(req.item).toLowerCase());
    if (missing) {
      S.addPrefill = {name: req.item, stock: req.qty};
      S.pendingStockApproval = req.id;
      if (S.role === 'creator') {
        S.addModal = true; S.prodReqModal = false;
        toast('Add this medicine to inventory to approve the request');
      } else {
        S.prodReqModal = true; S.addModal = false;
        toast('This medicine needs owner approval before stock can be added');
      }
      render();
      return;
    }
    t.disabled = true;
    try {
      await doDecideStock(d.id, d.d);
      render();
      toast(d.d === 'approved' ? 'Stock approved — delivery receipt created' : 'Stock request rejected');
    } catch (err) { toast(err.message); t.disabled = false; }
  }
  else if (a === 'prdec') {
    const req = S.productRequests.find(r => r.id === d.id);
    if (!req) return;
    if (!(await askConfirm((d.d === 'approved' ? 'Approve' : 'Reject') + ' the new medicine request for ' + req.name + '? ' + (d.d === 'approved' ? 'It will be added to inventory with ' + req.stock + ' units.' : 'Nothing will be added.'), {title: 'Review medicine request', okLabel: d.d === 'approved' ? 'Approve & add' : 'Reject request', danger: d.d === 'rejected'}))) return;
    t.disabled = true;
    try {
      await doDecideProduct(d.id, d.d);
      render();
      toast(d.d === 'approved' ? 'Medicine approved and added to inventory' : 'Medicine request rejected');
    } catch (err) { toast(err.message); t.disabled = false; }
  }
});

/* Uses the uploaded photo when one is chosen, otherwise the selected illustration. */
async function productImage() {
  const file = $('#np-upload') && $('#np-upload').files && $('#np-upload').files[0];
  if (file) return readImageAsDataURL(file);
  return $('#np-img') ? $('#np-img').value : 'assets/meds/generic.svg';
}

/* ============================================================
   Form submissions
   ============================================================ */
document.addEventListener('submit', async e => {
  const form = e.target;
  if (!['cf', 'lf', 'af', 'shf', 'rf', 'sf', 'nf', 'prf', 'dsf', 'pwf'].includes(form.id)) return;
  e.preventDefault();

  if (form.id === 'cf') {
    const er = $('#cf-er');
    try {
      if (!(await askConfirm('Create the first owner account roi.creator@gmail.com with the password 1234?', {title: 'Create first owner', okLabel: 'Create owner'}))) return;
      await doSetupCreators();
      render();
      toast('First owner account created');
    } catch (err) { er.textContent = err.message; }
  }
  else if (form.id === 'lf') {
    try {
      const acc = authenticate($('#em').value, $('#pw').value);
      render();
      toast('Signed in as ' + roleLabel(acc.role));
    } catch (err) { $('#er').textContent = err.message; }
  }
  else if (form.id === 'af') {
    try {
      const email = $('#ac-em').value.trim();
      const owner = emailRole(email) === 'creator';
      const pw = owner || !$('#ac-pw') ? '' : $('#ac-pw').value;
      const cp = owner || !$('#ac-cp') ? '' : $('#ac-cp').value;
      if (pw !== cp) throw new Error('Passwords do not match.');
      const message = owner
        ? 'Create the owner account ' + email + ' with the password 1234? They can change it from the sidebar.'
        : 'Create the account ' + email + ' with this password? Share the password with them after setup.';
      if (!(await askConfirm(message, {title: 'Create account?', okLabel: 'Create account'}))) return;
      await doCreateAccount(email, pw);
      S.accModal = false;
      S.accCreator = null;
      render();
      toast('Account created for ' + email);
    } catch (err) {
      const er = $('#ac-er');
      if (er) er.textContent = err.message;
      else toast(err.message);
    }
  }
  else if (form.id === 'pwf') {
    try {
      const next = $('#pw-new').value;
      const confirm = $('#pw-confirm').value;
      const self = S.pwModal === 'self';
      const who = self ? 'your account' : S.pwModal;
      if (!(await askConfirm(self
        ? 'Change your password? You will need the new one the next time you sign in.'
        : 'Set a new password for ' + who + '? Share it with them after saving.',
        {title: 'Change password?', okLabel: 'Change password'}))) return;
      if (self) await doChangePassword($('#pw-current').value, next, confirm);
      else await doSetAccountPassword(S.pwModal, next, confirm);
      S.pwModal = null;
      render();
      toast(self ? 'Password changed' : 'Password updated for ' + who);
    } catch (err) {
      const er = $('#pw-er');
      if (er) er.textContent = err.message;
      else toast(err.message);
    }
  }
  else if (form.id === 'shf') {
    if (!S.share) return;
    try {
      if (!(await askConfirm('Send receipt ' + S.share.id + ' to ' + $('#sh-to').selectedOptions[0].text + '?', {title: 'Send receipt?', okLabel: 'Send receipt'}))) return;
      const shareId = await doShareReceipt(S.share.kind, S.share.id, $('#sh-to').value, $('#sh-note').value);
      const receipt = S.receipt;
      S.share = null;
      if (receipt) receipt.shareId = shareId;
      render();
      toast('Receipt sent');
    } catch (err) { toast(err.message); }
  }
  else if (form.id === 'rf') {
    try {
      if (!(await askConfirm('Send a removal request for sale ' + S.modal + '? The sale will stay until an admin or owner reviews it.', {title: 'Request sale removal', okLabel: 'Send request'}))) return;
      await doRequestRemoval(S.modal, $('#rs').value, $('#nt').value);
      S.modal = null; render();
      toast('Removal request sent to admin');
    } catch (err) { toast(err.message); }
  }
  else if (form.id === 'sf') {
    const qty = Math.trunc(Number($('#sqty').value)) || 0;
    try {
      if (S.stockMode === 'request') {
        const name = $('#sr-med') ? $('#sr-med').value : '';
        if (!(await askConfirm('Send a stock request for ' + name + ' — ' + qty + ' units? Stock changes only after verification.', {title: 'Request stock', okLabel: 'Send request'}))) return;
        await doRequestStock(S.stockModal, name, qty, ($('#snote') || {}).value || '');
        toast('Stock request sent — waiting for admin verification');
      } else {
        if (!(await askConfirm('Adjust stock by ' + qty + ' units? The inventory changes immediately.', {title: 'Adjust stock?', okLabel: 'Adjust stock'}))) return;
        await doAdjustStock(S.stockModal, qty);
        toast('Stock updated');
      }
      S.stockModal = null; S.stockMode = 'adjust'; S.stockName = ''; render();
    } catch (err) { toast(err.message); }
  }
  else if (form.id === 'nf') {
    try {
      const image = await productImage();
      const input = {
        name: $('#np-name').value, category: $('#np-cat').value,
        price: Number($('#np-price').value), cost: Number($('#np-cost').value),
        stock: Number($('#np-stock').value), image
      };
      if (!(await askConfirm('Add ' + input.name + ' to inventory with ' + input.stock + ' units? Verify the picture and prices first.', {title: 'Add medicine?', okLabel: 'Add medicine'}))) return;
      await doAddProduct(input);
      const approveId = S.pendingStockApproval;
      S.addModal = false; S.addPrefill = null; S.pendingStockApproval = null;
      if (approveId) {
        await doDecideStock(approveId, 'approved', false);
        render();
        toast('Medicine added and delivery receipt created');
      } else {
        render();
        toast('Medicine added to inventory');
      }
    } catch (err) { toast(err.message); }
  }
  else if (form.id === 'prf') {
    try {
      const image = await productImage();
      const input = {
        name: $('#np-name').value, category: $('#np-cat').value,
        price: Number($('#np-price').value), cost: Number($('#np-cost').value),
        stock: Number($('#np-stock').value), image, note: $('#pr-note').value,
        stockApproval: S.pendingStockApproval || null
      };
      if (!(await askConfirm('Send ' + input.name + ' for owner approval with ' + input.stock + ' units? It will not be added until approved.', {title: 'Request medicine', okLabel: 'Send request'}))) return;
      const id = await doRequestProduct(input);
      S.prodReqModal = false; S.addPrefill = null; S.pendingStockApproval = null;
      render();
      toast('Request ' + id + ' sent to the owner');
    } catch (err) { toast(err.message); }
  }
  else if (form.id === 'dsf') {
    try {
      const input = {
        date: $('#ds-date').value, total: Number($('#ds-total').value),
        transactions: Number($('#ds-tx').value), note: $('#ds-note').value
      };
      if (!(await askConfirm('Submit daily sales for ' + input.date + ' — ' + m(input.total) + ' across ' + input.transactions + ' transactions?', {title: 'Submit daily sales?', okLabel: 'Submit sales'}))) return;
      const id = await doSubmitDailySales(input);
      render();
      toast('Daily sales ' + id + ' submitted');
    } catch (err) {
      const er = $('#ds-er');
      if (er) er.textContent = err.message;
      else toast(err.message);
    }
  }
});

/* ============================================================
   Live inputs
   ============================================================ */
document.addEventListener('change', async e => {
  if (e.target.id === 'rep-val') openSales(S.repPeriod, e.target.value);
  if (e.target.id === 'np-img') { const p = $('#np-preview'); if (p) p.src = e.target.value; }
  if (e.target.id === 'np-upload' && e.target.files && e.target.files[0]) {
    const p = $('#np-preview');
    if (p) p.src = URL.createObjectURL(e.target.files[0]);
  }
  /* Cart quantity typed directly into the number between the − and + buttons. */
  if (e.target.matches && e.target.matches('.q-num')) {
    const id = e.target.dataset.id;
    const n = Math.trunc(Number(e.target.value));
    const y = scrollY;
    if (!Number.isFinite(n) || n < 1) delete S.cart[id];
    else S.cart[id] = n;
    /* change fires on blur — defer the redraw so a button the user just
       clicked (e.g. Complete sale) is still in the DOM for its click event. */
    setTimeout(() => { render(); scrollTo(0, y); }, 0);
  }
});

/* Clicking the number selects it, so typing a new quantity replaces it at once. */
document.addEventListener('focusin', e => {
  if (e.target.matches && e.target.matches('.q-num')) e.target.select();
});

/* Enter applies a typed quantity immediately (change alone waits for blur). */
document.addEventListener('keydown', e => {
  if (e.target.matches && e.target.matches('.q-num') && e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'sq') { S.q = e.target.value; $('#gr').innerHTML = grid(); }
  if (e.target.id === 'iq') {
    S.invQ = e.target.value;
    const rows = S.products.filter(p => p.name.toLowerCase().includes(S.invQ.toLowerCase()) && (S.invFilter === 'all' || (S.invFilter === 'low' && p.stock > 0 && p.stock <= S.lowStock) || (S.invFilter === 'out' && p.stock <= 0)));
    $('#inv-grid').innerHTML = invGrid(rows);
  }
  if (e.target.id === 'tn') { const c = +e.target.value - cartTotal(); $('#ch').textContent = m(c > 0 ? c : 0); }
  if (e.target.id === 'ac-em') {
    const hint = $('#ac-rolehint');
    if (!hint) return;
    const role = emailRole(e.target.value);
    const domain = emailDomain(e.target.value);
    hint.innerHTML = domain && domain !== EMAIL_DOMAIN
      ? 'Work emails must use <b>@gmail.com</b>.'
      : role === 'creator'
        ? 'Owner emails are fixed to <b>roi.creator@gmail.com</b>, <b>chynne.creator@gmail.com</b> and <b>kyla.creator@gmail.com</b>.'
        : role === 'admin'
          ? 'This will create an <b>admin</b> account.'
          : role === 'staff'
            ? 'This will create a <b>staff</b> account.'
            : 'Use <b>name.admin@gmail.com</b> or <b>name.staff@gmail.com</b>.';
    /* Owners start with 1234, so hide the set-password fields when the email
       names an owner, even if the modal opened as "Add account". */
    const owner = role === 'creator';
    const pwFields = $('#ac-pw-fields');
    const ownerNote = $('#ac-owner-note');
    if (pwFields) pwFields.classList.toggle('hide', owner);
    if (ownerNote) ownerNote.classList.toggle('hide', !owner);
    ['ac-pw', 'ac-cp'].forEach(id => {
      const input = $('#' + id);
      if (input) input.required = !owner;
    });
  }
});

/* ============================================================
   Chart hover — exact date and values under the cursor
   ============================================================ */
document.addEventListener('mousemove', e => {
  const tip = $('#chart-tip');
  const svg = e.target.closest ? e.target.closest('.chart-svg') : null;
  if (!svg) {
    if (tip) tip.style.display = 'none';
    document.querySelectorAll('.chart-guide').forEach(g => g.setAttribute('visibility', 'hidden'));
    return;
  }
  if (!svg._hoverPoints) {
    try { svg._hoverPoints = JSON.parse(svg.dataset.points || '[]'); }
    catch { svg._hoverPoints = []; }
  }
  const pts = svg._hoverPoints;
  if (!pts.length || !tip) return;
  const rect = svg.getBoundingClientRect();
  const vbX = ((e.clientX - rect.left) / rect.width) * 680;
  let best = 0, distance = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const diff = Math.abs(pts[i].x - vbX);
    if (diff < distance) { distance = diff; best = i; }
  }
  const p = pts[best];
  const guide = svg.querySelector('.chart-guide');
  if (guide) {
    guide.setAttribute('visibility', 'visible');
    const line = guide.querySelector('.guide-line');
    line.setAttribute('x1', p.x); line.setAttribute('x2', p.x);
    const salesDot = guide.querySelector('.guide-sales');
    salesDot.setAttribute('cx', p.x); salesDot.setAttribute('cy', p.sy);
    const profitDot = guide.querySelector('.guide-profit');
    profitDot.setAttribute('cx', p.x); profitDot.setAttribute('cy', p.py);
  }
  tip.innerHTML = `<div class="tip-date">${esc(p.date)} · ${esc(p.time)}</div>`
    + `<div class="tip-row"><span class="tip-sales">Sales</span><b>${esc(p.sale)}</b></div>`
    + `<div class="tip-row"><span class="tip-profit">Net profit</span><b>${esc(p.profit)}</b></div>`
    + `<div class="tip-id">${esc(p.id)}</div>`;
  const wrap = svg.parentElement;
  const wr = wrap.getBoundingClientRect();
  tip.style.display = 'block';
  tip.style.left = Math.max(4, Math.min(wr.width - tip.offsetWidth - 4, e.clientX - wr.left + 14)) + 'px';
  tip.style.top = Math.max(4, e.clientY - wr.top - tip.offsetHeight - 12) + 'px';
});

/* ============================================================
   Auth hero bubbles — gentle parallax following the cursor
   ============================================================ */
document.addEventListener('mousemove', e => {
  const hero = e.target.closest ? e.target.closest('.auth-hero') : null;
  if (!hero) return;
  const r = hero.getBoundingClientRect();
  hero.style.setProperty('--bx', (((e.clientX - r.left) / r.width) - .5) * 22 + 'px');
  hero.style.setProperty('--by', (((e.clientY - r.top) / r.height) - .5) * 22 + 'px');
});

/* ============================================================
   Boot
   ============================================================ */
(function boot() {
  /* Open on the choice screen only. The choice handler loads the selected
     workspace from its own store — neither workspace is changed by opening. */
  S.view = 'start';
  render();
})();
