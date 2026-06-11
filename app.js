// Trading Journal Web — SPA logic (Dashboard / Trades / Add-Edit / Analytics / Accounts)

// ── Constants (same as Flask + iOS versions) ─────────────────────────────────
const CONFLUENCES = ['iFVG', 'FVG', 'SMT', 'BOS', 'CISD', '50% Fib'];
const CF_COLORS = {
  'iFVG': '#4A90D9', 'FVG': '#5BAD6F', 'SMT': '#C0584F',
  'BOS': '#D4834A', 'CISD': '#9E5BAD', '50% Fib': '#D4C24A',
};
const MARKET_CONDITIONS = ['Bullish Trend', 'Bearish Trend', 'Range', 'Consolidation', 'Distribution', 'Accumulation', 'N/A'];
const MARKET_CATALYSTS = ['NY Open', 'London Open', 'Asian Session', 'News Event', 'NFP', 'FOMC', 'CPI', 'Manipulation', 'Liquidity Grab', 'NDOG', 'NWOG', 'Session Killzone', 'N/A'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── State ────────────────────────────────────────────────────────────────────
const S = {
  trades: [],        // all entries, newest first
  accounts: [],
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth() + 1,
  filters: { outcome: '', direction: '', type: '', q: '' },
  presetDate: null,  // date preset when adding from the day modal
  balAccount: null,  // account being balance-updated
  charts: [],
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;
const money = (v) => `${v > 0 ? '+' : v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;
const moneyPlain = (v) => `$${Number(v).toFixed(2)}`;
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
// chart click-to-open is desktop-only: on touch screens the first tap shows the tooltip
const isDesktopPointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function loadState() {
  S.trades = DB.allTrades();
  S.accounts = DB.allAccounts();
}

// Same formulas as iOS + Flask: WR = wins/(wins+losses), BEs excluded
function calcStats(trades) {
  const tr = trades.filter(t => t.entry_type === 'trade');
  const total = tr.length;
  const zero = { total: 0, wins: 0, losses: 0, be: 0, win_rate: 0, be_rate: 0, total_pnl: 0, avg_win: 0, avg_loss: 0, profit_factor: 0, best: 0, worst: 0, avg_r: 0, total_r: 0 };
  if (!total) return zero;
  const wins = tr.filter(t => t.outcome === 'Profit').length;
  const losses = tr.filter(t => t.outcome === 'Loss').length;
  const be = tr.filter(t => t.outcome === 'Break Even').length;
  const pnls = tr.filter(t => t.net_pnl != null).map(t => t.net_pnl);
  const wp = pnls.filter(p => p > 0), lp = pnls.filter(p => p < 0);
  const gp = wp.reduce((a, b) => a + b, 0), gl = Math.abs(lp.reduce((a, b) => a + b, 0));
  const wl = wins + losses;
  const rVals = tr.filter(t => t.net_r != null).map(t => t.net_r);
  return {
    total, wins, losses, be,
    win_rate: wl ? r1(100 * wins / wl) : 0,
    be_rate: r1(100 * be / total),
    total_pnl: r2(pnls.reduce((a, b) => a + b, 0)),
    avg_win: wp.length ? r2(gp / wp.length) : 0,
    avg_loss: lp.length ? r2(lp.reduce((a, b) => a + b, 0) / lp.length) : 0,
    profit_factor: gl ? r2(gp / gl) : 0,
    best: pnls.length ? r2(Math.max(...pnls)) : 0,
    worst: pnls.length ? r2(Math.min(...pnls)) : 0,
    avg_r: r2(rVals.reduce((a, b) => a + b, 0) / total),
    total_r: r2(rVals.reduce((a, b) => a + b, 0)),
  };
}

// trade-tracked → starting + P&L · manual → typed equity · else starting (same as iOS)
function accountDisplay(acc) {
  const trades = S.trades.filter(t => t.account_name === acc.name);
  const stats = calcStats(trades);
  let actual = acc.balance, profit = 0;
  if (stats.total > 0) { actual = acc.balance + stats.total_pnl; profit = stats.total_pnl; }
  else if (acc.equity > 0) { actual = acc.equity; profit = acc.equity - acc.balance; }
  const profitPct = acc.balance > 0 ? profit / acc.balance * 100 : 0;
  const hasTarget = (acc.target_pct || 0) > 0;
  const progress = hasTarget ? Math.min(Math.max(profitPct / acc.target_pct, 0), 1) : 0;
  return { trades, stats, actual, profit, profitPct, hasTarget, progress };
}

// ── Boot / auth ──────────────────────────────────────────────────────────────
function setLoginStatus(msg, isErr) {
  const el = document.getElementById('loginStatus');
  el.textContent = msg;
  el.className = 'login-status' + (isErr ? ' err' : '');
}

async function waitForLibs() {
  for (let i = 0; i < 100; i++) {
    if (window.google?.accounts?.oauth2 && window.initSqlJs) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Failed to load Google sign-in. Check your connection.');
}

window.addEventListener('load', async () => {
  try {
    await waitForLibs();
    if (CONFIG.CLIENT_ID.startsWith('PASTE')) {
      setLoginStatus('Setup needed: web OAuth client ID is not configured yet.', true);
      document.getElementById('signInBtn').style.opacity = 0.4;
      return;
    }
    Drive.init();
    if (Drive.token) await enterApp(); // session still valid → skip login
  } catch (e) {
    setLoginStatus(e.message, true);
  }
});

async function signIn() {
  try {
    setLoginStatus('Opening Google sign-in…');
    Drive.init();
    try { await Drive.requestToken(''); }
    catch (e) { await Drive.requestToken('consent'); }
    await enterApp();
  } catch (e) {
    setLoginStatus('Sign-in failed: ' + e.message, true);
  }
}

async function enterApp() {
  setLoginStatus('Loading your journal from Drive…');
  let bytes = null;
  try {
    bytes = await Drive.download();
  } catch (e) {
    setLoginStatus('Could not load journal.db: ' + e.message, true);
    return;
  }
  await DB.init(bytes);
  loadState();
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = '';
  document.getElementById('syncPill').style.display = 'flex';
  setSync(bytes ? 'ok' : 'pending', bytes ? syncedLabel() : 'no remote DB yet');
  if (!location.hash || location.hash === '#') location.hash = '#dashboard';
  renderRoute();
}

// ── Sync ─────────────────────────────────────────────────────────────────────
let syncTimer = null;
const syncedLabel = () => 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function setSync(state, text) {
  const pill = document.getElementById('syncPill');
  pill.className = state;
  const icons = { ok: 'bi-check-circle', syncing: 'bi-arrow-repeat', error: 'bi-exclamation-circle', pending: 'bi-cloud-arrow-up' };
  document.getElementById('syncIcon').className = 'bi ' + (icons[state] || 'bi-icloud');
  document.getElementById('syncText').textContent = text;
}

// After each local change: wait a beat (batch rapid edits), then pull+merge+push
function scheduleSync() {
  setSync('pending', 'Saving…');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(false), 1200);
}

async function syncNow(manual) {
  clearTimeout(syncTimer);
  setSync('syncing', 'Syncing…');
  try {
    Drive.fileId = null; // re-resolve so a DB created elsewhere is found
    const remote = await Drive.download();
    if (remote) DB.merge(remote);
    await Drive.upload(DB.export());
    loadState();
    setSync('ok', syncedLabel());
    if (manual) renderRoute();
  } catch (e) {
    setSync('error', 'Sync failed — tap to retry');
    console.error('Sync error:', e);
  }
}

// ── Routing ──────────────────────────────────────────────────────────────────
window.addEventListener('hashchange', renderRoute);

function renderRoute() {
  if (!DB.db) return;
  destroyCharts();
  const h = location.hash || '#dashboard';
  let tab = 'dashboard';
  if (h.startsWith('#edit-')) { renderForm(parseInt(h.slice(6), 10)); tab = 'trades'; }
  else if (h === '#add') { renderForm(null); tab = 'trades'; }
  else if (h === '#trades') { renderTrades(); tab = 'trades'; }
  else if (h === '#analytics') { renderAnalytics(); tab = 'analytics'; }
  else if (h === '#accounts') { renderAccounts(); tab = 'accounts'; }
  else renderDashboard();
  document.querySelectorAll('.tabbar a[data-tab]').forEach(a =>
    a.classList.toggle('active', a.dataset.tab === tab));
  window.scrollTo(0, 0);
}

function destroyCharts() {
  S.charts.forEach(c => { try { c.destroy(); } catch (e) {} });
  S.charts = [];
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Dashboard ────────────────────────────────────────────────────────────────
function monthCal(y, m) { // Monday-first weeks like Python calendar.monthcalendar
  const days = new Date(y, m, 0).getDate();
  let col = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const weeks = [];
  let week = new Array(7).fill(0);
  for (let d = 1; d <= days; d++) {
    week[col] = d;
    if (++col === 7) { weeks.push(week); week = new Array(7).fill(0); col = 0; }
  }
  if (week.some(x => x)) weeks.push(week);
  return weeks;
}

function calNav(delta) {
  let m = S.calMonth + delta, y = S.calYear;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  S.calMonth = m; S.calYear = y;
  renderDashboard();
}

function calToday() {
  S.calYear = new Date().getFullYear();
  S.calMonth = new Date().getMonth() + 1;
  renderDashboard();
}

function renderDashboard() {
  const stats = calcStats(S.trades);
  const y = S.calYear, m = S.calMonth;
  const prefix = `${y}-${String(m).padStart(2, '0')}`;
  const monthTrades = S.trades.filter(t => t.trade_date.startsWith(prefix));

  const dayTrades = {};
  for (const t of monthTrades) {
    const day = parseInt(t.trade_date.split('-')[2], 10);
    (dayTrades[day] = dayTrades[day] || []).push(t);
  }
  const dayPnl = {};
  for (const [day, ts] of Object.entries(dayTrades)) {
    dayPnl[day] = r2(ts.filter(t => t.entry_type === 'trade').reduce((a, t) => a + (t.net_pnl || 0), 0));
  }
  const monthTotal = r2(Object.values(dayPnl).reduce((a, b) => a + b, 0));
  const mtr = monthTrades.filter(t => t.entry_type === 'trade');
  const mWins = mtr.filter(t => t.outcome === 'Profit').length;
  const mLosses = mtr.filter(t => t.outcome === 'Loss').length;
  const mWr = (mWins + mLosses) ? r1(100 * mWins / (mWins + mLosses)) : null;
  const mRVals = mtr.filter(t => t.net_r != null).map(t => t.net_r);
  const mTotalR = mRVals.length ? r2(mRVals.reduce((a, b) => a + b, 0)) : null;

  const today = new Date();
  const weeks = monthCal(y, m);

  let calCells = ['Mon','Tue','Wed','Thu','Fri'].map(d => `<div class="cal-hdr">${d}</div>`).join('');
  for (const week of weeks) {
    for (const day of week.slice(0, 5)) {
      if (!day) { calCells += '<div class="cal-day empty"></div>'; continue; }
      const ts = dayTrades[day] || [];
      const pnl = dayPnl[day] || 0;
      const isToday = today.getFullYear() === y && today.getMonth() + 1 === m && today.getDate() === day;
      const hasReal = ts.some(t => t.entry_type === 'trade');
      let bg = '';
      if (ts.length) bg = pnl > 0 ? 'has-profit' : pnl < 0 ? 'has-loss' : hasReal ? 'has-be' : 'has-journal';
      const dateStr = `${prefix}-${String(day).padStart(2, '0')}`;
      let inner = `<div class="cal-day-num">${day}</div>`;
      if (ts.length) {
        if (pnl !== 0) inner += `<div class="cal-pnl ${pnl > 0 ? 'pos' : 'neg'}">${pnl > 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(0)}</div>`;
        inner += '<div class="cal-dots">' + ts.map(t => {
          if (t.entry_type === 'journal') return '<span class="cal-dot journal"></span>';
          const cls = t.outcome === 'Profit' ? 'profit' : t.outcome === 'Loss' ? 'loss' : 'be';
          return `<span class="cal-dot ${cls}"></span>`;
        }).join('') + '</div>';
      }
      calCells += `<div class="cal-day ${isToday ? 'today' : ''} ${bg}" onclick="openDayModal('${dateStr}')">${inner}</div>`;
    }
  }

  const accCards = S.accounts.map(acc => {
    const d = accountDisplay(acc);
    return `<div class="card card-sm">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <i class="bi bi-building" style="color:var(--blue)"></i>
        <span style="font-weight:700;">${esc(acc.name)}</span>
        <span style="font-size:.65rem;background:var(--surface2);padding:1px 7px;border-radius:10px;color:var(--muted);">${esc(acc.acc_type)}</span>
      </div>
      <div style="font-size:.8rem;color:var(--muted);">
        Balance: <span style="color:var(--text);font-weight:600;">${d.actual ? moneyPlain(d.actual) : '—'}</span>
        ${d.profit !== 0 ? `<span class="${d.profit > 0 ? 'text-green' : 'text-red'}" style="font-weight:600;"> (${money(d.profit)})</span>` : ''}
      </div>
    </div>`;
  }).join('');

  document.getElementById('view').innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">Dashboard</h1>
      <div class="page-sub">${MONTH_NAMES[m - 1]} ${y}</div>
    </div>
    <a href="#add" class="btn-tj btn-primary-tj"><i class="bi bi-plus-lg"></i> New Entry</a>
  </div>

  <div class="stats-row">
    <div class="card card-sm">
      <div class="card-title">Total P&L</div>
      <div class="stat-value ${stats.total_pnl >= 0 ? 'text-green' : 'text-red'}">${money(stats.total_pnl)}</div>
      <div class="stat-sub">${stats.total} trades</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Win Rate</div>
      <div class="stat-value ${stats.win_rate >= 50 ? 'text-green' : 'text-red'}">${stats.win_rate}%</div>
      <div class="stat-sub">${stats.wins}W · ${stats.losses}L · ${stats.be}BE</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Total R</div>
      <div class="stat-value ${stats.total_r >= 0 ? 'text-green' : 'text-red'}">${stats.total_r > 0 ? '+' : ''}${stats.total_r.toFixed(1)}R</div>
      <div class="stat-sub">Avg R ${stats.avg_r}R</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Profit Factor</div>
      <div class="stat-value ${stats.profit_factor >= 1 ? 'text-green' : 'text-red'}">${stats.profit_factor}</div>
      <div class="stat-sub">Best ${moneyPlain(stats.best)} · Worst ${moneyPlain(stats.worst)}</div>
    </div>
  </div>

  <div class="card" style="padding:20px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <div class="cal-nav">
        <button class="btn-tj btn-ghost" style="padding:5px 10px;" onclick="calNav(-1)"><i class="bi bi-chevron-left"></i></button>
        <span class="cal-month">${MONTH_NAMES[m - 1]} ${y}</span>
        <button class="btn-tj btn-ghost" style="padding:5px 10px;" onclick="calNav(1)"><i class="bi bi-chevron-right"></i></button>
        <button class="btn-tj btn-ghost" style="padding:5px 10px;font-size:.78rem;" onclick="calToday()">Today</button>
      </div>
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px 16px;font-size:.78rem;color:var(--muted);">
        <span>${MONTH_NAMES[m - 1]} total:
          <span class="${monthTotal >= 0 ? 'text-green' : 'text-red'}" style="font-weight:700;">${money(monthTotal)}</span></span>
        ${mWr != null ? `<span>WR: <span class="${mWr >= 50 ? 'text-green' : 'text-red'}" style="font-weight:700;">${mWr}%</span></span>` : ''}
        ${mTotalR != null ? `<span>Total R: <span class="${mTotalR >= 0 ? 'text-green' : 'text-red'}" style="font-weight:700;">${mTotalR}R</span></span>` : ''}
      </div>
    </div>
    <div class="cal-grid">${calCells}</div>
  </div>

  ${S.accounts.length ? `<div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">${accCards}</div>` : ''}
  <div style="height:20px;"></div>`;
}

// highlightId: when opened from an equity-curve point, that trade is marked + scrolled to
function openDayModal(dateStr, highlightId) {
  const ts = S.trades.filter(t => t.trade_date === dateStr)
    .sort((a, b) => (a.trade_time || '').localeCompare(b.trade_time || ''));
  document.getElementById('dayModalTitle').textContent = dateStr;
  let html;
  if (!ts.length) {
    html = '<div class="no-data">No entries for this day.</div>';
  } else {
    html = ts.map(t => {
      const pnlColor = t.net_pnl > 0 ? 'var(--green)' : t.net_pnl < 0 ? 'var(--red)' : 'var(--muted)';
      const oc = t.outcome === 'Profit' ? 'badge-profit' : t.outcome === 'Loss' ? 'badge-loss' : 'badge-be';
      const pnl = t.net_pnl != null ? (t.net_pnl >= 0 ? '+' : '') + t.net_pnl.toFixed(2) : '—';
      return `<div id="dayTrade_${t.id}" class="${t.id === highlightId ? 'day-row-highlight' : ''}" style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            ${t.entry_type === 'journal' ? '<span class="badge-outcome badge-journal">Journal</span>' : '<span class="badge-outcome badge-trade">Trade</span>'}
            ${t.outcome ? `<span class="badge-outcome ${oc}">${esc(t.outcome)}</span>` : ''}
            ${t.symbol ? `<span style="font-weight:700;font-size:.85rem;">${esc(t.symbol)}</span>` : ''}
          </div>
          <div style="font-size:.8rem;color:var(--muted);">${esc(t.trade_time || '')} ${t.direction ? '· ' + esc(t.direction) : ''}</div>
          ${t.notes ? `<div style="font-size:.8rem;color:var(--muted);margin-top:4px;font-style:italic;">"${esc(t.notes.substring(0, 100))}${t.notes.length > 100 ? '…' : ''}"</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:1rem;font-weight:800;color:${pnlColor};">$${pnl}</div>
          ${t.net_r != null ? `<div style="font-size:.75rem;color:var(--muted);">${t.net_r}R</div>` : ''}
          <a href="#edit-${t.id}" class="btn-edit-sm" style="margin-top:6px;" onclick="closeModal('dayModalBackdrop')"><i class="bi bi-pencil"></i></a>
        </div>
      </div>`;
    }).join('');
    html += `<div style="margin-top:12px;">
      <a href="#add" class="btn-tj btn-primary-tj" style="font-size:.78rem;" onclick="S.presetDate='${dateStr}';closeModal('dayModalBackdrop')"><i class="bi bi-plus"></i> Add entry</a>
    </div>`;
  }
  document.getElementById('dayModalBody').innerHTML = html;
  document.getElementById('dayModalBackdrop').classList.add('open');
  if (highlightId != null) {
    setTimeout(() => {
      document.getElementById('dayTrade_' + highlightId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
  }
}

// ── Trades ───────────────────────────────────────────────────────────────────
function setFilter(key, val) {
  const f = S.filters;
  if (key === 'all') { f.outcome = ''; f.direction = ''; f.type = ''; }
  else f[key] = f[key] === val ? '' : val;
  renderTrades();
}

function setSearch(q) { S.filters.q = q; renderTradeList(); }

function filteredTrades() {
  const f = S.filters;
  return S.trades.filter(t => {
    if (f.outcome && t.outcome !== f.outcome) return false;
    if (f.direction && t.direction !== f.direction) return false;
    if (f.type && t.entry_type !== f.type) return false;
    if (f.q) {
      const q = f.q.toLowerCase();
      if (!(t.symbol || '').toLowerCase().includes(q) &&
          !(t.notes || '').toLowerCase().includes(q) &&
          !(t.title || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function tradeCardHTML(t) {
  if (t.entry_type === 'journal') {
    return `<div class="trade-card is-journal">
      <div class="tc-header">
        <span class="badge-outcome badge-journal"><i class="bi bi-journal-text"></i> Journal</span>
        <span class="tc-date">${esc(t.trade_date)}${t.trade_time ? ' · ' + esc(t.trade_time) : ''}</span>
      </div>
      ${t.notes ? `<div class="tc-note">${esc(t.notes.substring(0, 220))}${t.notes.length > 220 ? '…' : ''}</div>` : ''}
      <div class="tc-actions">
        <a href="#edit-${t.id}" class="btn-edit-sm"><i class="bi bi-pencil"></i> Edit</a>
        <button class="btn-danger-sm" onclick="delTrade(${t.id})"><i class="bi bi-trash"></i></button>
      </div>
    </div>`;
  }
  const links = (t.chart_links || []).map(l =>
    `<a href="${esc(l)}" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:none;font-size:.85rem;" title="Open chart"><i class="bi bi-graph-up-arrow"></i></a>`).join('');
  const confs = (t.confluences || []).map(c => {
    const col = CF_COLORS[c] || '#8e8e93';
    return `<span class="tag" style="background:${col}22;color:${col};">${esc(c)}</span>`;
  }).join('');
  return `<div class="trade-card">
    <div class="tc-header">
      <div class="tc-left-head">
        <span class="tc-symbol">${esc(t.symbol || '—')}</span>
        ${t.direction === 'Long' ? '<span class="badge-outcome badge-long" style="font-size:.68rem;padding:2px 8px;">▲ Long</span>'
        : t.direction === 'Short' ? '<span class="badge-outcome badge-short" style="font-size:.68rem;padding:2px 8px;">▼ Short</span>' : ''}
        ${links}
      </div>
      <span class="tc-date">${esc(t.trade_date)}${t.trade_time ? ' · ' + esc(t.trade_time) : ''}</span>
    </div>
    <div class="tc-body">
      <div class="tc-tags">
        ${t.outcome === 'Profit' ? '<span class="badge-outcome badge-profit" style="font-size:.68rem;">Profit</span>'
        : t.outcome === 'Loss' ? '<span class="badge-outcome badge-loss" style="font-size:.68rem;">Loss</span>'
        : t.outcome === 'Break Even' ? '<span class="badge-outcome badge-be" style="font-size:.68rem;">BE</span>' : ''}
        ${confs}
        ${t.fits_plan ? '<span style="font-size:.65rem;color:var(--green);font-weight:700;">✓ Plan</span>' : ''}
      </div>
      <div class="tc-pnl-block">
        ${t.net_pnl != null ? `<div class="tc-pnl ${t.net_pnl > 0 ? 'text-green' : t.net_pnl < 0 ? 'text-red' : ''}">${money(t.net_pnl)}</div>` : ''}
        ${t.net_r != null ? `<div class="tc-r">${t.net_r}R</div>` : ''}
      </div>
    </div>
    ${t.notes ? `<div class="tc-note">${esc(t.notes.substring(0, 200))}${t.notes.length > 200 ? '…' : ''}</div>` : ''}
    <div class="tc-actions">
      <a href="#edit-${t.id}" class="btn-edit-sm"><i class="bi bi-pencil"></i> Edit</a>
      <button class="btn-danger-sm" onclick="delTrade(${t.id})"><i class="bi bi-trash"></i></button>
    </div>
  </div>`;
}

function renderTradeList() {
  const trades = filteredTrades();
  const stats = calcStats(trades);
  document.getElementById('tradeCount').textContent = `${trades.length} entries`;
  document.getElementById('statStrip').innerHTML = `
    <div><span>Win Rate</span> <strong class="${stats.win_rate >= 50 ? 'text-green' : 'text-red'}">${stats.win_rate}%</strong></div>
    <div><span>BE Rate</span> <strong>${stats.be_rate}%</strong></div>
    <div><span>Total P&L</span> <strong class="${stats.total_pnl >= 0 ? 'text-green' : 'text-red'}">${money(stats.total_pnl)}</strong></div>
    <div><span>Profit Factor</span> <strong>${stats.profit_factor}</strong></div>
    <div><span>Avg Win</span> <strong class="text-green">${moneyPlain(stats.avg_win)}</strong></div>
    <div><span>Avg Loss</span> <strong class="text-red">${moneyPlain(stats.avg_loss)}</strong></div>
    <div><span>W / L / BE</span> <strong>${stats.wins} / ${stats.losses} / ${stats.be}</strong></div>
    <div><span>Avg R</span> <strong>${stats.avg_r}R</strong></div>`;
  document.getElementById('tradeCards').innerHTML = trades.length
    ? trades.map(tradeCardHTML).join('')
    : '<div class="no-data">No entries found. <a href="#add" style="color:var(--blue);">Add your first trade →</a></div>';
}

function renderTrades() {
  const f = S.filters;
  const pill = (active, cls, label, onclick) =>
    `<button class="filt-btn ${active ? cls : ''}" onclick="${onclick}">${label}</button>`;

  document.getElementById('view').innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">Trade Log</h1>
      <div class="page-sub" id="tradeCount"></div>
    </div>
    <a href="#add" class="btn-tj btn-primary-tj"><i class="bi bi-plus-lg"></i> New Entry</a>
  </div>

  <div class="equity-mini" id="equityMiniWrap">
    <div class="equity-mini-header">
      <span class="equity-mini-label">Equity Curve</span>
      <a href="#analytics" style="font-size:.72rem;color:var(--blue);text-decoration:none;">Full analytics →</a>
    </div>
    <div style="position:relative;height:90px;"><canvas id="miniEquity"></canvas></div>
  </div>

  <div class="filter-bar">
    ${pill(!f.outcome && !f.direction && !f.type, 'active', 'All', "setFilter('all')")}
    ${pill(f.outcome === 'Profit', 'active-profit', '✓ Profit', "setFilter('outcome','Profit')")}
    ${pill(f.outcome === 'Loss', 'active-loss', '✗ Loss', "setFilter('outcome','Loss')")}
    ${pill(f.outcome === 'Break Even', 'active-be', '— BE', "setFilter('outcome','Break Even')")}
    ${pill(f.direction === 'Long', 'active-long', '▲ Long', "setFilter('direction','Long')")}
    ${pill(f.direction === 'Short', 'active-short', '▼ Short', "setFilter('direction','Short')")}
    ${pill(f.type === 'journal', 'active-journal', '📓 Journal', "setFilter('type','journal')")}
  </div>
  <div style="margin-bottom:14px;">
    <input type="text" class="form-control-tj" placeholder="🔍  Search symbol, notes…" value="${esc(f.q)}"
           oninput="setSearch(this.value)" style="font-size:.82rem;padding:7px 11px;">
  </div>

  <div class="stat-strip" id="statStrip"></div>
  <div class="trade-cards" id="tradeCards"></div>
  <div style="height:20px;"></div>`;

  renderTradeList();
  drawMiniEquity();
}

function delTrade(id) {
  if (!confirm('Delete this entry?')) return;
  DB.deleteTrade(id);
  loadState();
  scheduleSync();
  renderRoute();
}

function equityData() {
  const tr = S.trades.filter(t => t.entry_type === 'trade')
    .slice()
    .sort((a, b) => (a.trade_date + (a.trade_time || '')).localeCompare(b.trade_date + (b.trade_time || '')));
  let eq = 0, peak = 0, maxDd = 0;
  return {
    points: tr.map(t => {
      eq += t.net_pnl || 0;
      peak = Math.max(peak, eq);
      const dd = peak - eq;
      maxDd = Math.max(maxDd, dd);
      return { id: t.id, date: t.trade_date, time: t.trade_time || '', eq: r2(eq), pnl: t.net_pnl || 0, out: t.outcome || '', sym: t.symbol || '', dd: r2(dd) };
    }),
    get peak() { return r2(peak); },
    get maxDd() { return r2(maxDd); },
  };
}

function equityGradientPlugin(eqData, dsIndex) {
  return {
    id: 'equityGradient',
    afterLayout(chart) {
      const ds = chart.data.datasets[dsIndex];
      const { ctx, chartArea: { top, bottom }, scales: { y } } = chart;
      const zeroY = Math.min(Math.max(y.getPixelForValue(0), top), bottom);
      const ratio = (zeroY - top) / (bottom - top);
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      if (ratio <= 0.01) { g.addColorStop(0, 'rgba(248,81,73,0.22)'); g.addColorStop(1, 'rgba(248,81,73,0)'); }
      else if (ratio >= 0.99) { g.addColorStop(0, 'rgba(63,185,80,0.22)'); g.addColorStop(1, 'rgba(63,185,80,0)'); }
      else {
        g.addColorStop(0, 'rgba(63,185,80,0.22)');
        g.addColorStop(Math.max(ratio - 0.01, 0), 'rgba(63,185,80,0.04)');
        g.addColorStop(ratio, 'rgba(0,0,0,0)');
        g.addColorStop(Math.min(ratio + 0.01, 1), 'rgba(248,81,73,0.04)');
        g.addColorStop(1, 'rgba(248,81,73,0.22)');
      }
      ds.backgroundColor = g;
      const lastEq = eqData.length ? eqData[eqData.length - 1].eq : 0;
      ds.borderColor = lastEq >= 0 ? '#3fb950' : '#f85149';
    },
  };
}

function drawMiniEquity() {
  const canvas = document.getElementById('miniEquity');
  const eq = equityData().points;
  if (!eq.length) { document.getElementById('equityMiniWrap').style.display = 'none'; return; }
  const lastEq = eq[eq.length - 1].eq;
  S.charts.push(new Chart(canvas, {
    type: 'line',
    plugins: [equityGradientPlugin(eq, 1)],
    data: {
      labels: eq.map(d => d.date),
      datasets: [
        { data: eq.map(() => 0), borderColor: 'rgba(139,148,158,0.3)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0 },
        { label: 'Equity', data: eq.map(d => d.eq), borderColor: lastEq >= 0 ? '#3fb950' : '#f85149',
          backgroundColor: 'transparent', fill: true, tension: 0.35, borderWidth: 2,
          pointRadius: 2.5, pointHoverRadius: 5,
          pointBackgroundColor: eq.map(d => d.out === 'Profit' ? '#3fb950' : d.out === 'Loss' ? '#f85149' : '#8b949e'),
          pointBorderColor: '#161b22', pointBorderWidth: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      // desktop: click a point → open that day's preview modal, hovered trade highlighted
      onClick: (e, els) => {
        if (!isDesktopPointer() || !els.length) return;
        const d = eq[els[0].index];
        if (d) openDayModal(d.date, d.id);
      },
      onHover: (e, els) => {
        if (isDesktopPointer()) e.native.target.style.cursor = els.length ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1, padding: 10,
          titleColor: '#e6edf3', bodyColor: '#8b949e',
          callbacks: {
            title: ctx => { const d = eq[ctx[0].dataIndex]; return (d.sym ? d.sym + ' · ' : '') + d.date; },
            label: ctx => {
              if (ctx.datasetIndex === 0) return null;
              const d = eq[ctx.dataIndex];
              return [' $' + ctx.raw.toFixed(2), ' ' + (d.pnl >= 0 ? '+' : '') + '$' + d.pnl.toFixed(2) + ' (' + d.out + ')'];
            },
          },
        },
      },
      scales: { x: { display: false }, y: { display: false, grid: { display: false } } },
    },
  }));
}

// ── Add / Edit form ──────────────────────────────────────────────────────────
const F = { entryType: 'trade', outcome: '', direction: '', confs: new Set(), editId: null };

function renderForm(editId) {
  const t = editId != null ? S.trades.find(x => x.id === editId) : null;
  if (editId != null && !t) { location.hash = '#trades'; return; }
  F.editId = editId;
  F.entryType = t ? t.entry_type : 'trade';
  F.outcome = t ? t.outcome : '';
  F.direction = t ? t.direction : '';
  F.confs = new Set(t ? t.confluences : []);

  const accNames = S.accounts.map(a => a.name);
  const presetDate = S.presetDate; S.presetDate = null;

  const confBtns = CONFLUENCES.map((c, i) => {
    const col = CF_COLORS[c] || '#8b949e';
    const sel = F.confs.has(c);
    return `<div class="conf-btn ${sel ? 'selected' : ''}" id="confBtn_${i}"
      style="border-color:${col};${sel ? `background:${col};color:#fff` : `color:${col}`}"
      onclick="toggleConf(${i},'${esc(c)}','${col}')">${esc(c)}</div>`;
  }).join('');

  const linkRows = (t && t.chart_links.length ? t.chart_links : ['']).map(l => `
    <div class="link-row" style="display:flex;gap:6px;margin-bottom:6px;">
      <input type="url" name="chart_links" class="form-control-tj" value="${esc(l)}" placeholder="https://www.tradingview.com/x/…">
      <button type="button" onclick="this.parentElement.remove()" class="btn-danger-sm" style="padding:8px 10px;font-size:.85rem;">✕</button>
    </div>`).join('');

  document.getElementById('view').innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">${t ? 'Edit Entry' : 'New Entry'}</h1>
      ${t ? `<div class="page-sub">${esc(t.trade_date)}</div>` : ''}
    </div>
    <a href="#trades" class="btn-tj btn-ghost"><i class="bi bi-arrow-left"></i> Back</a>
  </div>

  <div class="card" style="max-width:780px;">
    <div class="type-tabs">
      <button type="button" class="type-tab ${F.entryType === 'trade' ? 'active' : ''}" id="tabTrade" onclick="setType('trade')"><i class="bi bi-graph-up-arrow"></i> Trade</button>
      <button type="button" class="type-tab ${F.entryType === 'journal' ? 'active' : ''}" id="tabJournal" onclick="setType('journal')"><i class="bi bi-journal-text"></i> Journal</button>
    </div>

    <div class="form-grid">
      <div>
        <label class="form-label-tj">Date</label>
        <input type="date" id="fDate" class="form-control-tj" value="${t ? t.trade_date : (presetDate || todayStr())}">
      </div>
      <div>
        <label class="form-label-tj">Time (optional)</label>
        <input type="time" id="fTime" class="form-control-tj" value="${t ? t.trade_time : ''}">
      </div>
      <div class="full">
        <label class="form-label-tj">Title</label>
        <input type="text" id="fTitle" class="form-control-tj" value="${esc(t ? t.title : 'New Trade')}" placeholder="e.g. NQ Long — NY Open">
      </div>

      <div class="full" id="tradeFields" style="${F.entryType === 'journal' ? 'display:none' : ''}">
        <div class="form-grid">
          <div>
            <label class="form-label-tj">Symbol</label>
            <input type="text" id="fSymbol" class="form-control-tj" value="${esc(t ? t.symbol : '')}" placeholder="NQ, ES, EURUSD…" style="text-transform:uppercase;">
          </div>
          <div>
            <label class="form-label-tj">Account</label>
            <select id="fAccount" class="form-control-tj">
              ${accNames.map(a => `<option value="${esc(a)}" ${t && t.account_name === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
            </select>
          </div>
          <div class="full">
            <label class="form-label-tj">Outcome</label>
            <div class="outcome-row">
              <div class="outcome-opt ${F.outcome === 'Profit' ? 'selected-profit' : ''}" data-o="Profit" onclick="setOutcome('Profit')">Profit</div>
              <div class="outcome-opt ${F.outcome === 'Loss' ? 'selected-loss' : ''}" data-o="Loss" onclick="setOutcome('Loss')">Loss</div>
              <div class="outcome-opt ${F.outcome === 'Break Even' ? 'selected-be' : ''}" data-o="Break Even" onclick="setOutcome('Break Even')">Break Even</div>
            </div>
          </div>
          <div>
            <label class="form-label-tj">Net P&L ($)</label>
            <input type="number" step="0.01" id="fPnl" class="form-control-tj" value="${t && t.net_pnl != null ? t.net_pnl : ''}" placeholder="e.g. 215.50 or -98.75" oninput="autoR()">
          </div>
          <div>
            <label class="form-label-tj">$ Risk</label>
            <input type="number" step="0.01" id="fRisk" class="form-control-tj" value="${t && t.risk_amount != null ? t.risk_amount : ''}" placeholder="e.g. 100" oninput="autoR()">
          </div>
          <div>
            <label class="form-label-tj">Net R <span style="font-weight:400;color:var(--muted);font-size:.72rem;">(auto-calc if blank)</span></label>
            <input type="number" step="0.01" id="fNetR" class="form-control-tj" value="${t && t.net_r != null ? t.net_r : ''}" placeholder="auto">
          </div>
          <div>
            <label class="form-label-tj">Direction</label>
            <div class="dir-row">
              <div class="dir-opt ${F.direction === 'Long' ? 'sel-long' : ''}" data-d="Long" onclick="setDir('Long')">▲ Long</div>
              <div class="dir-opt ${F.direction === 'Short' ? 'sel-short' : ''}" data-d="Short" onclick="setDir('Short')">▼ Short</div>
              <div class="dir-opt ${F.direction === 'N/A' ? 'sel-na' : ''}" data-d="N/A" onclick="setDir('N/A')">N/A</div>
            </div>
          </div>
          <div class="full">
            <label class="form-label-tj">Confluences</label>
            <div class="conf-grid">${confBtns}</div>
          </div>
          <div>
            <label class="form-label-tj">Market Condition</label>
            <select id="fCondition" class="form-control-tj">
              <option value="">— Select —</option>
              ${MARKET_CONDITIONS.map(mc => `<option value="${esc(mc)}" ${t && t.market_condition === mc ? 'selected' : ''}>${esc(mc)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label-tj">Market Catalyst</label>
            <select id="fCatalyst" class="form-control-tj">
              <option value="">— Select —</option>
              ${MARKET_CATALYSTS.map(mc => `<option value="${esc(mc)}" ${t && t.market_catalyst === mc ? 'selected' : ''}>${esc(mc)}</option>`).join('')}
            </select>
          </div>
          <div class="full" style="display:flex;align-items:center;gap:10px;padding:6px 0;">
            <input type="checkbox" id="fFitsPlan" ${t && t.fits_plan ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;accent-color:var(--green);">
            <label for="fFitsPlan" style="cursor:pointer;font-weight:600;font-size:.87rem;">Fits Plan / Followed Rules</label>
          </div>
        </div>
      </div>

      <div class="full">
        <label class="form-label-tj">Chart Links (TradingView)</label>
        <div id="linksWrap">${linkRows}</div>
        <button type="button" onclick="addLink()" class="btn-tj btn-ghost" style="font-size:.78rem;margin-top:4px;"><i class="bi bi-plus"></i> Add link</button>
      </div>

      <div class="full">
        <label class="form-label-tj">Notes / Reflection</label>
        <textarea id="fNotes" class="form-control-tj" rows="4" placeholder="What happened? What did you do well? What to improve?">${esc(t ? t.notes : '')}</textarea>
      </div>
    </div>

    <hr class="divider">
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <a href="#trades" class="btn-tj btn-ghost">Cancel</a>
      ${t ? `<button class="btn-tj" style="background:rgba(248,81,73,.15);color:var(--red);" onclick="delTrade(${t.id})"><i class="bi bi-trash"></i> Delete</button>` : ''}
      <button class="btn-tj btn-primary-tj" onclick="saveEntry()"><i class="bi bi-check-lg"></i> ${t ? 'Save Changes' : 'Save Entry'}</button>
    </div>
  </div>
  <div style="height:20px;"></div>`;
}

function setType(ty) {
  F.entryType = ty;
  document.getElementById('tabTrade').classList.toggle('active', ty === 'trade');
  document.getElementById('tabJournal').classList.toggle('active', ty === 'journal');
  document.getElementById('tradeFields').style.display = ty === 'journal' ? 'none' : '';
}

function setOutcome(o) {
  F.outcome = o;
  document.querySelectorAll('.outcome-opt').forEach(el => {
    el.className = 'outcome-opt';
    if (el.dataset.o === o) {
      el.classList.add(o === 'Profit' ? 'selected-profit' : o === 'Loss' ? 'selected-loss' : 'selected-be');
    }
  });
}

function setDir(d) {
  F.direction = d;
  document.querySelectorAll('.dir-opt').forEach(el => {
    el.className = 'dir-opt';
    if (el.dataset.d === d) {
      el.classList.add(d === 'Long' ? 'sel-long' : d === 'Short' ? 'sel-short' : 'sel-na');
    }
  });
}

function toggleConf(i, name, color) {
  const btn = document.getElementById('confBtn_' + i);
  if (F.confs.has(name)) {
    F.confs.delete(name);
    btn.classList.remove('selected');
    btn.style.background = '';
    btn.style.color = color;
  } else {
    F.confs.add(name);
    btn.classList.add('selected');
    btn.style.background = color;
    btn.style.color = '#fff';
  }
}

function autoR() {
  const pnl = parseFloat(document.getElementById('fPnl').value);
  const risk = parseFloat(document.getElementById('fRisk').value);
  const rInput = document.getElementById('fNetR');
  if (!isNaN(pnl) && !isNaN(risk) && risk !== 0 && !rInput.value) {
    rInput.placeholder = (pnl / risk).toFixed(2) + 'R (auto)';
  }
}

function addLink() {
  const wrap = document.getElementById('linksWrap');
  const row = document.createElement('div');
  row.className = 'link-row';
  row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;';
  row.innerHTML = `<input type="url" name="chart_links" class="form-control-tj" placeholder="https://www.tradingview.com/x/…">
    <button type="button" onclick="this.parentElement.remove()" class="btn-danger-sm" style="padding:8px 10px;font-size:.85rem;">✕</button>`;
  wrap.appendChild(row);
  row.querySelector('input').focus();
}

function saveEntry() {
  const num = (id) => { const v = document.getElementById(id).value; return v === '' ? null : parseFloat(v); };
  const pnl = num('fPnl');
  const risk = num('fRisk');
  let netR = num('fNetR');
  if (pnl != null && risk && netR == null) netR = r2(pnl / risk);
  const links = [...document.querySelectorAll('#linksWrap input')].map(i => i.value.trim()).filter(Boolean);
  const t = {
    trade_date: document.getElementById('fDate').value || todayStr(),
    trade_time: document.getElementById('fTime').value || '',
    entry_type: F.entryType,
    title: document.getElementById('fTitle').value || 'New Trade',
    symbol: (document.getElementById('fSymbol')?.value || '').toUpperCase(),
    direction: F.entryType === 'trade' ? F.direction : '',
    outcome: F.entryType === 'trade' ? F.outcome : '',
    net_pnl: F.entryType === 'trade' ? pnl : null,
    risk_amount: F.entryType === 'trade' ? risk : null,
    net_r: F.entryType === 'trade' ? netR : null,
    account_name: document.getElementById('fAccount')?.value || (S.accounts[0]?.name || ''),
    confluences: F.entryType === 'trade' ? [...F.confs] : [],
    market_condition: document.getElementById('fCondition')?.value || '',
    market_catalyst: document.getElementById('fCatalyst')?.value || '',
    fits_plan: !!document.getElementById('fFitsPlan')?.checked,
    notes: document.getElementById('fNotes').value || '',
    chart_links: links,
  };
  if (F.editId != null) DB.updateTrade(F.editId, t);
  else DB.addTrade(t);
  loadState();
  scheduleSync();
  location.hash = '#trades';
}

// ── Analytics ────────────────────────────────────────────────────────────────
function renderAnalytics() {
  const stats = calcStats(S.trades);
  const eqd = equityData();
  const eq = eqd.points;
  const peak = eqd.peak, maxDd = eqd.maxDd;
  const tr = S.trades.filter(t => t.entry_type === 'trade');

  // monthly (chronological)
  const monthly = {};
  for (const t of tr) {
    const m = t.trade_date.slice(0, 7);
    monthly[m] = r2((monthly[m] || 0) + (t.net_pnl || 0));
  }
  const mLabels = Object.keys(monthly).sort();
  const mVals = mLabels.map(k => monthly[k]);

  // day of week
  const dowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const dowPnl = [0, 0, 0, 0, 0];
  for (const t of tr) {
    const d = new Date(t.trade_date + 'T12:00:00');
    const wd = (d.getDay() + 6) % 7;
    if (wd < 5) dowPnl[wd] = r2(dowPnl[wd] + (t.net_pnl || 0));
  }

  document.getElementById('view').innerHTML = `
  <div class="page-header"><h1 class="page-title">Analytics</h1></div>

  <div class="analytics-grid">
    <div class="card card-sm">
      <div class="card-title">Win Rate</div>
      <div class="stat-value ${stats.win_rate >= 50 ? 'text-green' : 'text-red'}">${stats.win_rate}%</div>
      <div class="stat-sub">${stats.wins}W · ${stats.losses}L · ${stats.be}BE</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Total P&L</div>
      <div class="stat-value ${stats.total_pnl >= 0 ? 'text-green' : 'text-red'}">${money(stats.total_pnl)}</div>
      <div class="stat-sub">${stats.total} trades · ${stats.total_r > 0 ? '+' : ''}${stats.total_r}R total</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Profit Factor</div>
      <div class="stat-value ${stats.profit_factor >= 1 ? 'text-green' : 'text-red'}">${stats.profit_factor}</div>
      <div class="stat-sub">Avg Win ${moneyPlain(stats.avg_win)}</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Peak / Max DD</div>
      <div class="stat-value text-green">${moneyPlain(peak)}</div>
      <div class="stat-sub text-red">DD: -${moneyPlain(maxDd).slice(1)}</div>
    </div>
  </div>

  <div class="chart-row-full">
    <div class="chart-card" style="padding:20px 20px 14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <div>
          <div class="chart-title" style="margin-bottom:2px;">Equity Curve</div>
          <div style="font-size:.78rem;color:var(--muted);">
            ${stats.total} trades · Peak <span style="color:var(--green);font-weight:700;">${moneyPlain(peak)}</span>
            · Max Drawdown <span style="color:var(--red);font-weight:700;">-${moneyPlain(maxDd).slice(1)}</span>
          </div>
        </div>
      </div>
      <div style="position:relative;height:280px;"><canvas id="equityChart"></canvas></div>
    </div>
  </div>

  <div class="chart-row-2">
    <div class="chart-card">
      <div class="chart-title">Monthly P&L</div>
      <canvas id="monthlyChart" height="160"></canvas>
    </div>
    <div class="chart-card">
      <div class="chart-title">Outcome Distribution</div>
      <canvas id="pieChart" height="160"></canvas>
    </div>
  </div>

  <div class="chart-row-full">
    <div class="chart-card">
      <div class="chart-title">P&L by Day of Week</div>
      <canvas id="dowChart" height="90"></canvas>
    </div>
  </div>
  <div style="height:20px;"></div>`;

  Chart.defaults.color = '#8b949e';
  Chart.defaults.borderColor = '#30363d';
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  if (eq.length) {
    const lastEq = eq[eq.length - 1].eq;
    S.charts.push(new Chart(document.getElementById('equityChart'), {
      type: 'line',
      plugins: [equityGradientPlugin(eq, 1)],
      data: {
        labels: eq.map(d => d.date + (d.time ? ' ' + d.time : '')),
        datasets: [
          { data: eq.map(() => 0), borderColor: 'rgba(139,148,158,0.35)', borderWidth: 1, borderDash: [5, 4], pointRadius: 0, fill: false, tension: 0, order: 2 },
          { label: 'Equity', data: eq.map(d => d.eq), borderColor: lastEq >= 0 ? '#3fb950' : '#f85149',
            backgroundColor: 'transparent', fill: true, tension: 0.35, borderWidth: 2.5,
            pointRadius: 4, pointHoverRadius: 8,
            pointBackgroundColor: eq.map(d => d.out === 'Profit' ? '#3fb950' : d.out === 'Loss' ? '#f85149' : '#8b949e'),
            pointBorderColor: '#0d1117', pointBorderWidth: 1.5, order: 1 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        // desktop: click a point → open that day's preview modal, hovered trade highlighted
        onClick: (e, els) => {
          if (!isDesktopPointer() || !els.length) return;
          const d = eq[els[0].index];
          if (d) openDayModal(d.date, d.id);
        },
        onHover: (e, els) => {
          if (isDesktopPointer()) e.native.target.style.cursor = els.length ? 'pointer' : 'default';
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1, padding: 12,
            titleColor: '#e6edf3', bodyColor: '#8b949e',
            callbacks: {
              title: ctx => { const d = eq[ctx[0].dataIndex]; return (d.sym ? d.sym + '  ·  ' : '') + d.date + (d.time ? ' ' + d.time : ''); },
              label: ctx => {
                if (ctx.datasetIndex === 0) return null;
                const d = eq[ctx.dataIndex];
                return [
                  ' Equity:   $' + ctx.raw.toFixed(2),
                  ' P&L:      ' + (d.pnl >= 0 ? '+' : '') + '$' + d.pnl.toFixed(2),
                  ' Outcome:  ' + (d.out || '—'),
                  d.dd > 0 ? ' Drawdown: -$' + d.dd.toFixed(2) : null,
                ].filter(Boolean);
              },
            },
          },
        },
        scales: {
          x: { grid: { color: 'rgba(48,54,61,0.6)' }, ticks: { maxTicksLimit: 10, maxRotation: 0, font: { size: 11 } }, border: { display: false } },
          y: { grid: { color: 'rgba(48,54,61,0.6)' }, ticks: { callback: v => '$' + v, font: { size: 11 } }, border: { display: false } },
        },
      },
    }));
  }

  S.charts.push(new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: {
      labels: mLabels,
      datasets: [{ label: 'P&L', data: mVals, backgroundColor: mVals.map(v => v >= 0 ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)'), borderRadius: 4 }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#30363d' }, ticks: { callback: v => '$' + v } } },
    },
  }));

  S.charts.push(new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    data: {
      labels: ['Profit', 'Loss', 'Break Even'],
      datasets: [{ data: [stats.wins, stats.losses, stats.be], backgroundColor: ['rgba(63,185,80,0.8)', 'rgba(248,81,73,0.8)', 'rgba(139,148,158,0.5)'], borderWidth: 0 }],
    },
    options: { plugins: { legend: { position: 'right', labels: { boxWidth: 10, padding: 14 } } }, cutout: '68%' },
  }));

  S.charts.push(new Chart(document.getElementById('dowChart'), {
    type: 'bar',
    data: {
      labels: dowLabels,
      datasets: [{ label: 'P&L', data: dowPnl, backgroundColor: dowPnl.map(v => v >= 0 ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)'), borderRadius: 4 }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#30363d' }, ticks: { callback: v => '$' + v } } },
    },
  }));
}

// ── Accounts ─────────────────────────────────────────────────────────────────
function renderAccounts() {
  const cards = S.accounts.map(acc => {
    const d = accountDisplay(acc);
    const s = d.stats;
    const recent = d.trades.slice(0, 5);

    let balanceBlock;
    if (s.total > 0) {
      balanceBlock = `<div style="font-size:1.5rem;font-weight:800;">${moneyPlain(d.actual)}
        <span style="font-size:.85rem;font-weight:700;" class="${d.profit >= 0 ? 'text-green' : 'text-red'}">${money(d.profit)}</span></div>
        <div style="font-size:.75rem;color:var(--muted);">Starting ${moneyPlain(acc.balance)}</div>`;
    } else if (acc.equity > 0) {
      balanceBlock = `<div style="font-size:1.5rem;font-weight:800;">${moneyPlain(acc.equity)}
        <span style="font-size:.85rem;font-weight:700;" class="${d.profit >= 0 ? 'text-green' : 'text-red'}">${money(d.profit)}</span></div>
        <div style="font-size:.75rem;color:var(--muted);">Starting ${moneyPlain(acc.balance)} · manually updated</div>`;
    } else {
      balanceBlock = `<div style="font-size:1.5rem;font-weight:800;">${moneyPlain(acc.balance)}</div>
        <div style="font-size:.75rem;color:var(--muted);">Starting balance</div>`;
    }

    let progressBar = '';
    if (d.hasTarget) {
      const color = d.profit < 0 ? 'var(--red)' : d.progress >= 1 ? 'var(--green)' : 'var(--blue)';
      progressBar = `
      <div style="margin:10px 0 4px;">
        <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--muted);">
          <span class="${d.profit >= 0 ? 'text-green' : 'text-red'}" style="font-weight:700;">${d.profitPct >= 0 ? '+' : ''}${d.profitPct.toFixed(2)}%</span>
          <span>Target ${acc.target_pct}%</span>
        </div>
        <div class="acc-progress-track">
          <div class="acc-progress-fill" style="width:${(d.progress * 100).toFixed(1)}%;background:${color};"></div>
        </div>
      </div>`;
    }

    const updateBtn = s.total === 0
      ? `<button class="btn-edit-sm" onclick="openBalanceModal(${acc.id})"><i class="bi bi-pencil-square"></i> Balance</button>`
      : '';

    const recentRows = recent.map(t => {
      if (t.entry_type === 'journal') {
        return `<div style="background:var(--surface2);border-radius:10px;padding:10px 14px;border-left:3px solid var(--purple);display:flex;justify-content:space-between;">
          <span class="badge-outcome badge-journal" style="font-size:.68rem;">Journal</span>
          <span style="font-size:.75rem;color:var(--muted);">${esc(t.trade_date)}</span></div>`;
      }
      return `<div style="background:var(--surface2);border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:800;">${esc(t.symbol || '—')}</span>
          ${t.outcome === 'Profit' ? '<span class="badge-outcome badge-profit" style="font-size:.65rem;">Profit</span>'
          : t.outcome === 'Loss' ? '<span class="badge-outcome badge-loss" style="font-size:.65rem;">Loss</span>'
          : t.outcome === 'Break Even' ? '<span class="badge-outcome badge-be" style="font-size:.65rem;">BE</span>' : ''}
          <span style="font-size:.72rem;color:var(--muted);">${esc(t.trade_date)}</span>
        </div>
        <div style="text-align:right;">
          ${t.net_pnl != null ? `<span style="font-weight:800;font-size:.9rem;" class="${t.net_pnl > 0 ? 'text-green' : t.net_pnl < 0 ? 'text-red' : ''}">${money(t.net_pnl)}</span>` : ''}
          ${t.net_r != null ? `<span style="font-size:.72rem;color:var(--muted);"> ${t.net_r}R</span>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div class="card" style="margin-bottom:16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;background:var(--surface2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">
            <i class="bi bi-building" style="color:var(--blue);"></i>
          </div>
          <div>
            <div style="font-size:1.05rem;font-weight:800;">${esc(acc.name)}</div>
            <span style="font-size:.68rem;background:${acc.acc_type === 'Live' ? 'rgba(63,185,80,.15)' : 'rgba(88,166,255,.15)'};
              color:${acc.acc_type === 'Live' ? 'var(--green)' : 'var(--blue)'};
              padding:2px 8px;border-radius:10px;font-weight:700;">${esc(acc.acc_type)}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          ${updateBtn}
          <button class="btn-danger-sm" onclick="delAccount(${acc.id}, '${esc(acc.name)}')"><i class="bi bi-trash"></i></button>
        </div>
      </div>

      ${balanceBlock}
      ${progressBar}

      ${s.total > 0 ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0;">
        <div class="card card-sm" style="margin:0;">
          <div class="card-title">Win Rate</div>
          <div class="stat-value ${s.win_rate >= 50 ? 'text-green' : 'text-red'}" style="font-size:1.4rem;">${s.win_rate}%</div>
          <div class="stat-sub">${s.wins}W · ${s.losses}L · ${s.be}BE</div>
        </div>
        <div class="card card-sm" style="margin:0;">
          <div class="card-title">Total P&L</div>
          <div class="stat-value ${s.total_pnl >= 0 ? 'text-green' : 'text-red'}" style="font-size:1.4rem;">${money(s.total_pnl)}</div>
          <div class="stat-sub">${s.total} trades</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px;">
        ${[['Profit Factor', s.profit_factor, ''], ['Avg Win', moneyPlain(s.avg_win), 'text-green'], ['Avg Loss', moneyPlain(s.avg_loss), 'text-red'], ['Avg R', s.avg_r + 'R', s.avg_r >= 0 ? 'text-green' : 'text-red'], ['Best Trade', moneyPlain(s.best), 'text-green'], ['Worst Trade', moneyPlain(s.worst), 'text-red']].map(([label, val, cls], i, arr) =>
          `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;${i < arr.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
            <span style="font-size:.85rem;color:var(--muted);">${label}</span>
            <span style="font-size:.9rem;font-weight:700;" class="${cls}">${val}</span>
          </div>`).join('')}
      </div>
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:10px;">Recent Trades</div>
      <div style="display:flex;flex-direction:column;gap:8px;">${recentRows}</div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('view').innerHTML = `
  <div class="page-header">
    <h1 class="page-title">Accounts</h1>
    <div style="display:flex;gap:8px;">
      <button class="btn-tj btn-ghost" onclick="signOutApp()" title="Sign out"><i class="bi bi-box-arrow-right"></i></button>
      <button class="btn-tj btn-primary-tj" onclick="document.getElementById('accModalBackdrop').classList.add('open')">
        <i class="bi bi-plus-lg"></i> New Account
      </button>
    </div>
  </div>
  ${S.accounts.length ? cards : '<div class="no-data">No accounts yet.</div>'}
  <div style="height:20px;"></div>`;
}

function saveNewAccount() {
  const name = document.getElementById('accName').value.trim();
  if (!name) return;
  if (S.accounts.some(a => a.name === name)) { alert(`Account "${name}" already exists.`); return; }
  DB.addAccount({
    name,
    balance: parseFloat(document.getElementById('accBalance').value) || 0,
    equity: 0,
    acc_type: document.getElementById('accType').value,
    target_pct: parseFloat(document.getElementById('accTarget').value) || 0,
  });
  closeModal('accModalBackdrop');
  document.getElementById('accName').value = '';
  document.getElementById('accBalance').value = '';
  document.getElementById('accTarget').value = '';
  loadState();
  scheduleSync();
  renderAccounts();
}

function delAccount(id, name) {
  if (!confirm(`Delete account ${name}? Trades will not be deleted.`)) return;
  DB.deleteAccount(id);
  loadState();
  scheduleSync();
  renderAccounts();
}

// Manual balance update — only offered for accounts with no trade entries
// (same guard as the iOS app so trade-tracked balances can't be corrupted)
function openBalanceModal(id) {
  const acc = S.accounts.find(a => a.id === id);
  if (!acc) return;
  const trades = S.trades.filter(t => t.account_name === acc.name && t.entry_type === 'trade');
  if (trades.length > 0) { alert('This account has trade entries — its balance is calculated from trades.'); return; }
  S.balAccount = acc;
  document.getElementById('balModalTitle').textContent = acc.name;
  document.getElementById('balInput').value = acc.equity > 0 ? acc.equity : '';
  balPreview();
  document.getElementById('balModalBackdrop').classList.add('open');
  setTimeout(() => document.getElementById('balInput').focus(), 100);
}

function balPreview() {
  const acc = S.balAccount;
  if (!acc) return;
  const v = parseFloat(document.getElementById('balInput').value);
  const el = document.getElementById('balProfit');
  if (isNaN(v)) { el.textContent = `Starting balance: ${moneyPlain(acc.balance)}`; return; }
  const profit = v - acc.balance;
  el.innerHTML = `Profit vs starting (${moneyPlain(acc.balance)}): <span class="${profit >= 0 ? 'text-green' : 'text-red'}" style="font-weight:700;">${money(profit)}</span>`;
}

function saveBalance() {
  const acc = S.balAccount;
  const v = parseFloat(document.getElementById('balInput').value);
  if (!acc || isNaN(v)) return;
  DB.updateAccountEquity(acc.id, v);
  closeModal('balModalBackdrop');
  S.balAccount = null;
  loadState();
  scheduleSync();
  renderAccounts();
}

function signOutApp() {
  if (!confirm('Sign out of Google Drive?')) return;
  Drive.signOut();
  location.reload();
}
