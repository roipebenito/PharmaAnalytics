# PharmaAnalytics — HTML / CSS / JavaScript

A pharmacy management app built with **plain HTML, CSS and JavaScript**.
No PHP, no server, no install. All data is saved in the browser's own local
store — **`localStorage`** (the app's "localdb"). Everything stays on this
computer; nothing is sent anywhere.

Currency: **Philippine peso (₱)**.

Three roles work together: the **owner** owns the system and manages accounts,
**admins** run the business, and **staff** handle sales and submit daily sales.

The interface uses a purple / lavender dashboard theme: a gradient sidebar, a
lavender page background, white rounded cards, a purple page banner, and green
for positive money values.

---

## Architecture — the three-layer onion

The code is split into three explicit layers. Dependencies only point **inward**:
the presentation layer may call the application layer, and the application layer
may call the data layer. The inner layers never import or call the outer ones.

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1 — PRESENTATION            js/presentation.js   │
│  Pages, shell, sidebar, forms, cards, tables, modals,   │
│  receipts, chart and toast. Reads state, calls use      │
│  cases, never touches localStorage or the PDF writer.   │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │  LAYER 2 — APPLICATION / DOMAIN  js/business.js │   │
│   │  Accounts, roles, permissions, live state,      │   │
│   │  selectors, sales, stock, removals, product     │   │
│   │  approvals, daily sales, receipt sharing,
analytics ranges and day/month/year reporting.             │   │
│   │                                                 │   │
│   │   ┌─────────────────────────────────────────┐   │   │
│   │   │  LAYER 3 — DATA / INTEGRATION  js/data.js │   │   │
│   │   │  localStorage repository ("localdb"),    │   │   │
│   │   │  session storage, CSV export,            │   │   │
│   │   │  dependency-free PDF writer, date and    │   │   │
│   │   │  number primitives.                      │   │   │
│   │   └─────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
              js/app.js — composition root / bootstrap
```

- **Layer 3 — data & integration** (`src/data/data.js`): the only code that
  reads/writes localStorage (the "localdb"), restores the session, builds CSV
  files and writes PDF bytes. It knows nothing about HTML.
- **Layer 2 — application / domain** (`src/business/business.js`): the rules of
  the pharmacy. It owns the application state `S`, the owner roster, email and
  role rules, permissions, all use cases (`doSale`, `doRequestStock`,
  `doDecideStock`, `doCreateAccount`, `doShareReceipt`, …) and reporting. It
  persists through Layer 3.
- **Layer 1 — presentation** (`src/presentation/presentation.js`): renders every
  screen and modal from state, and calls Layer 2 use cases. It contains no
  storage code and no business rules.
- **Composition root** (`src/app.js`): wires DOM events to the layers and boots
  the app (load state → restore session → render).

---

## Run it

**Easiest:** double-click `index.html`.

Because the store is just `localStorage`, it works from `file://` as well as
from a web server. If you prefer a local web server, run any static server in
this folder, for example:

```
php -S 127.0.0.1:8080 -t .
```

then open http://127.0.0.1:8080/ in your browser.

(You can also use any static server you already have — Python, VS Code Live
Server, XAMPP/Apache, etc.)

---

## First-time setup

Every time you open the app while signed out, one screen asks you to choose
**My data** or **Demo data** — nothing else is a surprise. **My data** opens
your own saved workspace (or creates the first owner if you have none):

| Owner email | Name |
| --- | --- |
| `roi.creator@gmail.com` | Roi |

- Setup creates roi with the password **`1234`** — no password to type. Sign in
  with `roi.creator@gmail.com` / `1234`, then change it whenever you like from
  **Change password** in the sidebar.
- The owner email is **fixed** to `roi.creator@gmail.com` and must use **@gmail.com**.
- Later, from **Accounts**, the first owner adds **chynne.creator@gmail.com**
  and **kyla.creator@gmail.com** as owners. Each also starts with password
  **`1234`** and changes it themselves from the sidebar.
- These three are the only owner accounts in the system. They cannot be added
  twice or removed.
- After setup, an owner can add admin and staff accounts from **Accounts**.

---

## Demo data (see everything)

The **My data or demo data?** screen is the only way in. Pick **My data** for
your own accounts and records, or pick one of the three **role buttons** under
**Demo data** (Owner, Admin or Staff) to open the realistic sample workspace as
that user. **Nothing is replaced or deleted** — each workspace has its own
storage key, so you can switch between them any time and keep working where you
left off. The first demo choice creates the samples; after that it reopens the
same demo workspace as whichever role you pick.

Once you are signed in, the sidebar has a one-click switch: **Open demo data**
while you are in your own workspace, or **Back to my data** while you are in the
sample. It opens the other workspace directly — no sign-out or confirm needed,
and neither workspace is changed.

| Area | Sample content |
| --- | --- |
| Accounts | Three owners (roi, chynne, kyla), three admins and five staff |
| Inventory | 16 medicines with pharmacy-scale ₱ prices (₱130–₱1,500), including low-stock and out-of-stock items |
| Sales | ~455 transactions across the past year — 4 pending and 4 removed, usually ₱9,000–₱40,000 each, with modest day-to-day variation and a handful of closed days |
| Removal requests | 10 examples: pending, approved and rejected |
| Inventory requests | 9 stock requests (new medicines and restocks) with pending and reviewed examples |
| Product requests | 7 proposals: pending, approved and rejected |
| Daily sales | 14 staff submissions of roughly ₱40,000–₱120,000 each |
| Receipts | 4 delivery receipts and 12 shared sale/delivery receipts |
| Analytics | Sales shown **per day** across weeks, months, quarters and the past year, with gentle, realistic peaks and dips (quiet days and a few closures) instead of a line that only rises. Monthly sales ≈ ₱1.4M, yearly ≈ ₱8.8M |

Hover over the **Sales &amp; net profit** chart on the overview to see the exact
date, how many sales happened that day (or that it was closed), and that day's
sales and net-profit totals.

Sample logins:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `roi.creator@gmail.com` | `1234` |
| Admin | `Ana.admin@gmail.com` | `admin123` |
| Staff | `Bea.staff@gmail.com` | `staff123` |

The other owners also use `1234`; the other admins (`Ben` and `Mika`) use
`admin123` and the other staff (`Ben`, `Cara`, `Dino` and `Eve`) use `staff123`.
An owner can reveal or reset admin/staff passwords from **Accounts**, and
everyone can change their own from **Change password**.

---

## Sign in

Accounts are stored in this browser. The role comes from the email address,
which must be in the form **`name.role@gmail.com`**:

| Email example | Role | Sees |
| --- | --- | --- |
| `roi.creator@gmail.com`, `chynne.creator@gmail.com`, `kyla.creator@gmail.com` | Owner | Everything admins do, plus Accounts, product approvals and receipt sharing |
| `Ana.admin@gmail.com` (`name.admin@gmail.com`) | Admin | Overview, Inventory, Removal requests, Sales records, Daily sales, Receipts |
| `Ben.staff@gmail.com` (`name.staff@gmail.com`) | Staff | Point of sale, Inventory, Daily sales, Receipts |

- The word **`.creator`** (owner), **`.admin`** or **`.staff`** must come just
  before the `@`.
- All work emails must use **@gmail.com**.
- The name in front is shown in the app: `Ben.staff@gmail.com` signs in as
  **Ben**.
- An email without a valid role suffix is rejected.
- **Every account signs in with a password**, including owners.
- **All three owners start with the password `1234`.** There is no forced first-
  sign-in step — each owner changes it whenever they want from **Change password**
  in the sidebar. Admins and staff get the password the owner typed when creating
  them.
- Any signed-in user can change their own password from **Change password** in
  the sidebar (current password required). An owner can set a new password for
  an **admin or staff** account from **Accounts** without knowing the old one.
  Owners can see their own password but cannot see or change another owner's
  password.
- The email must belong to an account the owner created. Removed accounts can
  no longer sign in.
- The session is remembered in this browser until you press **Sign out**.

---

## What each role can do

### Owner
- **Everything an admin can do** (overview, inventory, approvals, sales,
  exports) — the owner passes the same admin checks.
- **Accounts** — the only role that can add or remove accounts:
  - Create `.admin` and `.staff` accounts and set their passwords here. Add the
    other `.creator` (owner) accounts too — each new owner starts with password
    **`1234`** and changes it from their own sidebar (all work emails must use
    **@gmail.com**).
  - See every registered account, its role, when it was created and who created
    it.
  - See **their own** password and every **admin/staff** password with a
    **Show passwords / Hide passwords** toggle, and use **Change** on an
    admin/staff row to reset it. Another owner's row shows **Private** instead —
    owners cannot see or change each other's passwords. Each owner changes only
    their own password from the sidebar.
  - Remove any admin or staff account. Removing an account blocks that person
    from signing in, while their past sales, requests and approvals stay in the
    records with their email.
  - The owner roster is fixed at **roi**, **chynne** and **kyla**
    (`@gmail.com`). Owner accounts are protected and cannot be removed.
- **Product approvals** — admins propose new medicines with a picture and a
  stock quantity; only an owner can approve or reject them. Approved products
  are added to inventory immediately. Owners may also add medicines directly.
- **Receipt sharing** — open any sale or delivery receipt and press
  **Send receipt** to send it to an admin or staff account, with an optional
  note. The record shows **From → To** for both sender and recipient.
- **Owner overview** — includes a per-admin activity card (sales, deliveries
  approved, removals reviewed) and a receipt-sharing summary.

### Admin
- **Overview** — total sales, net profit, removed sales, transaction count,
  sales/profit chart, removal summary, CSV export, plus an analytics range
  filter: **Weekly, Monthly, Quarterly, Half a year, Yearly or Custom dates**.
  Choosing **Custom dates** shows From/To date pickers — set any range (even a
  single day) and press **Apply dates** to update every figure and the chart.
- **Inventory** — add medicines with an uploaded photo or an illustration
  (name, category, price ₱, cost ₱, opening stock), adjust stock up/down, and
  approve or reject staff stock requests. Admins use **Request medicine**:
  the owner must approve the product and its stock before it is stored.
- **Removal requests** — review staff requests to remove a sale. Approving
  returns the sold units to stock and removes the sale from reports.
- **Sales records** — filter by **Day**, **Month**, **Year**, or **All time**,
  see totals, cost of goods, profit, average sale, removed sales, a breakdown
  (by day / month / year) and every transaction. Export to CSV.
- **Daily sales** — review the end-of-day summaries submitted by staff.
- **Receipts** — see every delivery receipt in the system and the receipts the
  owner shared with them. Admins cannot send receipts.
- **Change password** — update your own password from the sidebar by entering
  your current password and a new one.

### Staff
- **Point of sale** — search by name or category, add medicines to the cart,
  then change a quantity by clicking the number and typing a new value (or use
  the − / + buttons). Typing **0** removes that line. Choose Cash / Card /
  Mobile, enter amount tendered, and complete the sale (stock is deducted
  automatically). A receipt appears after every sale with **Print** and
  **Save PDF**.
- **Inventory** — view live stock, low-stock and out-of-stock counts, and send
  a **stock request** when new units arrive. Staff can pick a medicine from the
  list **or type the name of a medicine that is not in inventory yet**. Stock
  only changes after an admin or the owner approves.
- **Daily sales** — submit one summary per date (date, total sales, number of
  transactions, note). It is saved to the database with your name and email.
- Request removal of a mistaken sale (goes to an admin for approval).
- **Receipts** — see receipts the owner shared with them and the delivery
  receipts for their own stock requests.
- **Change password** — update your own password from the sidebar by entering
  your current password and a new one.

---

## Receipts

### Sale receipt
Shown right after a sale and available from **Sales records** and the POS sale
list. It records:

- receipt number (`SL-1001`, …), payment method, date and time;
- every item, quantity and amount;
- **Sold by** — the staff name and email who completed the sale;
- tendered amount and change.

Buttons: **Print**, **Save PDF**, and (owner only) **Send receipt**.

### Delivery receipt
Created automatically when an admin or the owner approves a staff stock
request. It records:

- receipt number (`DL-001`, …) and the stock request number (`STK-001`, …);
- the medicine and quantity received;
- **Requested by** — the staff name and email;
- **Approved by** — the admin or owner name and email.

If the request is for a medicine that is not in inventory, approving it opens
the add-medicine form prefilled with the requested name and quantity, then
creates the delivery receipt without adding the stock twice.

### Sharing receipts
Only the owner can share. The owner picks an admin or staff recipient and
an optional note. The recipient sees the receipt in **Receipts** with a
**Shared receipt · From → To** banner, including both names and emails.

### PDF receipts
PDFs are generated in the browser with no external library. PDF base fonts
cannot draw the ₱ symbol, so amounts inside the PDF read `PHP 1,234.50`.

---

## Accounts and "every admin is different"

The owner roster is fixed: **roi.creator@gmail.com**, **chynne.creator@gmail.com**
and **kyla.creator@gmail.com**. Chynne and kyla are added from the Accounts page
once the first owner is signed in. Admins and staff are created there too and
must use **@gmail.com** with a `.admin` or `.staff` suffix.

Every account has its own unique email, so the app can always tell people
apart:

- Each sale stores `by` (name) and `byEmail`.
- Each removal and stock decision stores `decidedBy` / `decidedByEmail`.
- Each delivery receipt stores `requestedBy` / `requestedByEmail` and
  `approvedBy` / `approvedByEmail`.
- Each shared receipt stores `fromName` / `fromEmail` and `toName` / `toEmail`.
- Each product request and daily sales submission stores `by` / `byEmail`.

That is why two admins with different emails produce separate activity in the
owner overview and separate names on receipts.

---

## Where the data lives

There are **two completely separate workspaces**. Choosing one never changes
or deletes the other.

| What | Where |
| --- | --- |
| My data — products, sales, requests, accounts, receipts, counters | `localStorage` key `pharma_state` — the whole workspace as one JSON value |
| My data — signed-in user | `localStorage` key `pharma_user` |
| Demo data — same records, separate sample workspace | `localStorage` key `pharma_demo_state` |
| Demo data — signed-in user | `localStorage` key `pharma_demo_user` |
| Fallback when localStorage is blocked | `sessionStorage` with the same keys (lasts until the tab closes) |

You can see it in the browser: **F12 → Application → Local Storage → the page
URL**. The values are plain JSON, so the "database" is easy to inspect, copy
or delete.

Everything is stored in **your** browser on **this** computer. Nothing is sent
anywhere. Opening the app in a different browser or on a different computer
starts with an empty inventory and a new first-time setup.

### Upgrading from the older version
If you used a previous build, your products, sales and requests are kept.

- Data stored by the old IndexedDB build is moved into `pharma_state`
  automatically the first time the new build loads; the old database is then
  removed.
- Old installs with no owner yet create the first owner (roi) with password
  **`1234`**; existing inventory and sales then appear.
- **All owner accounts in an older install are reset to `1234`** when this build
  loads, so every owner can sign in and change their password. Products, sales,
  requests and every admin/staff password are kept.
- If only one owner exists, the Accounts page shows buttons to add the missing
  owners, who each start with password **`1234`**.

### Reset all data

Open the app, then in the browser console (F12) run:

```js
localStorage.removeItem('pharma_state');
localStorage.removeItem('pharma_user');
localStorage.removeItem('pharma_demo_state');
localStorage.removeItem('pharma_demo_user');
sessionStorage.removeItem('pharma_state');
sessionStorage.removeItem('pharma_user');
sessionStorage.removeItem('pharma_demo_state');
sessionStorage.removeItem('pharma_demo_user');
location.reload();
```

Or clear the site data for this page in your browser settings.

---

## Files

```
pharma-html/
  index.html                  page shell and layer load order
  styles.css                  purple / lavender dashboard theme
  src/data/data.js            inner layer: localStorage, sessions, CSV, PDF
  src/business/business.js    middle layer: rules, state, use cases, reports
  src/presentation/presentation.js  outer layer: pages, shell, cards, modals, receipts
  src/app.js                  composition root: events and boot
  assets/meds/*.svg           medicine images (7 built-in illustrations)
  README.md                   this file
```

## Notes

- No demo products, sales or requests are included — the app starts empty
  except for the first owner account (`roi.creator@gmail.com`). Chynne and kyla
  are added later from Accounts.
- Sale IDs look like `SL-1001`, removal requests `REQ-001`, stock requests
  `STK-001`, product requests `PR-001`, daily sales `DS-001`, delivery receipts
  `DL-001`, shared receipts `SHR-001`.
- Essential actions (sales, approvals, account/product changes, daily sales and
  receipt sharing) ask for confirmation in a styled verification card that
  matches the Owner overview before anything is saved.
- Amounts are formatted with `toLocaleString('en-PH')`, so they show as
  `₱1,234.50`.
- When a product has no recorded cost, profit calculations assume a cost of
  60% of the selling price. Products added from the Inventory form always have
  a real cost.

### Security note (local demo)
Every account, including owners, uses a password that the user can change at
any time or that an owner can reset for an admin or staff account from Accounts.
All owners start with the widely known password **`1234`** and should change it
from the sidebar right away. Owner passwords are private: owners cannot see or
change each other's passwords, and change only their own from the sidebar.
Passwords are stored in this
browser's database in plain form so the app can work with no server, and an
owner can deliberately reveal admin and staff passwords on the Accounts page.
This is fine for a local demo or school project, but it is **not production-grade
security**. Do not reuse important passwords, and do not use this build for real
patient or financial data without adding a proper backend with hashed passwords.
