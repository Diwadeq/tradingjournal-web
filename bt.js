// Backtesting workspace — separate SQLite DB (backtest.db on Drive), R-based
// stats, breakdown analytics, TP optimizer and Excel import. Never touches
// journal.db, so practice data can't leak into the real journal.

// ── DB layer (same sync protocol as db.js: uid union-merge + tombstones) ─────
const BTDB = {
  db: null,

  COLS: 'uid, created_at, updated_at, trade_date, trade_time, strategy_name, symbol, direction, result, profit_r, max_rr, mae_r, smt, poi, ifvg_tf, sl_ticks, news, chart_link, notes',

  async init(bytes) {
    await DB.ensureSQL(); // share the sql.js module with the journal DB
    this.db = bytes ? new DB.SQL.Database(bytes) : new DB.SQL.Database();
    this.migrate(this.db);
  },

  migrate(d) {
    d.run(`CREATE TABLE IF NOT EXISTS bt_strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );`);
    d.run(`CREATE TABLE IF NOT EXISTS bt_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT '',
      trade_date TEXT NOT NULL,
      trade_time TEXT DEFAULT '',
      strategy_name TEXT DEFAULT '',
      symbol TEXT DEFAULT '',
      direction TEXT DEFAULT '',
      result TEXT DEFAULT '',
      profit_r REAL,
      max_rr REAL,
      mae_r REAL,
      smt TEXT DEFAULT '',
      poi TEXT DEFAULT '',
      ifvg_tf TEXT DEFAULT '',
      sl_ticks REAL,
      news TEXT DEFAULT '',
      chart_link TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );`);
    d.run(`CREATE TABLE IF NOT EXISTS bt_tombstones (uid TEXT PRIMARY KEY, deleted_at TEXT);`);
    d.run(`CREATE TABLE IF NOT EXISTS bt_strategy_tombstones (name TEXT PRIMARY KEY, deleted_at TEXT);`);
  },

  q(sql, params = []) {
    const out = [];
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free();
    return out;
  },

  run(sql, params = []) { this.db.run(sql, params); },

  export() { return this.db.export(); },

  merge(remoteBytes) {
    let r;
    try { r = new DB.SQL.Database(remoteBytes); } catch (e) { return; }
    try {
      this.migrate(r);
      const rq = (sql) => {
        const out = [];
        try {
          const s = r.prepare(sql);
          while (s.step()) out.push(s.getAsObject());
          s.free();
        } catch (e) { /* table may not exist */ }
        return out;
      };

      for (const t of rq("SELECT uid, deleted_at FROM bt_tombstones WHERE uid IS NOT NULL AND uid != ''")) {
        this.run("INSERT OR IGNORE INTO bt_tombstones (uid, deleted_at) VALUES (?, ?)", [t.uid, t.deleted_at || '']);
      }
      for (const t of rq("SELECT name, deleted_at FROM bt_strategy_tombstones WHERE name IS NOT NULL AND name != ''")) {
        this.run("INSERT OR IGNORE INTO bt_strategy_tombstones (name, deleted_at) VALUES (?, ?)", [t.name, t.deleted_at || '']);
      }

      const localNames = new Set(this.q("SELECT name FROM bt_strategies").map(a => a.name));
      const deadNames = new Set(this.q("SELECT name FROM bt_strategy_tombstones").map(a => a.name));
      for (const a of rq("SELECT name, description, created_at FROM bt_strategies")) {
        if (!localNames.has(a.name) && !deadNames.has(a.name)) {
          this.run("INSERT INTO bt_strategies (name, description, created_at) VALUES (?,?,?)",
            [a.name, a.description || '', a.created_at || '']);
        }
      }
      this.run("DELETE FROM bt_strategies WHERE name IN (SELECT name FROM bt_strategy_tombstones)");

      const localUpdated = {};
      for (const t of this.q("SELECT uid, updated_at FROM bt_trades")) localUpdated[t.uid] = t.updated_at || '';
      for (const t of rq(`SELECT ${this.COLS} FROM bt_trades`)) {
        if (!t.uid) continue;
        const lu = localUpdated[t.uid];
        if (lu === undefined) {
          this.insertRow(t);
        } else if ((t.updated_at || '') > lu) {
          this.run("DELETE FROM bt_trades WHERE uid = ?", [t.uid]);
          this.insertRow(t);
        }
      }
      this.run("DELETE FROM bt_trades WHERE uid IN (SELECT uid FROM bt_tombstones WHERE uid != '')");
    } finally {
      r.close();
    }
  },

  insertRow(t) {
    this.run(`INSERT INTO bt_trades (${this.COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      t.uid, t.created_at || '', t.updated_at || '', t.trade_date || '', t.trade_time || '',
      t.strategy_name || '', t.symbol || '', t.direction || '', t.result || '',
      t.profit_r ?? null, t.max_rr ?? null, t.mae_r ?? null, t.smt || '', t.poi || '', t.ifvg_tf || '',
      t.sl_ticks ?? null, t.news || '', t.chart_link || '', t.notes || '',
    ]);
  },

  allTrades() {
    return this.q("SELECT * FROM bt_trades ORDER BY trade_date DESC, trade_time DESC, created_at DESC");
  },

  hasUid(uid) {
    return this.q("SELECT 1 AS x FROM bt_trades WHERE uid = ? LIMIT 1", [uid]).length > 0;
  },

  addTrade(t, uid) {
    this.run(`INSERT INTO bt_trades (${this.COLS}) VALUES (?, datetime('now'), datetime('now'), ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      uid || crypto.randomUUID(),
      t.trade_date, t.trade_time || '', t.strategy_name || '', t.symbol || '',
      t.direction || '', t.result || '', t.profit_r ?? null, t.max_rr ?? null, t.mae_r ?? null,
      t.smt || '', t.poi || '', t.ifvg_tf || '', t.sl_ticks ?? null,
      t.news || '', t.chart_link || '', t.notes || '',
    ]);
    this.ensureStrategy(t.strategy_name);
  },

  updateTrade(id, t) {
    this.run(`UPDATE bt_trades SET trade_date=?, trade_time=?, strategy_name=?, symbol=?, direction=?, result=?, profit_r=?, max_rr=?, mae_r=?, smt=?, poi=?, ifvg_tf=?, sl_ticks=?, news=?, chart_link=?, notes=?, updated_at=datetime('now') WHERE id=?`, [
      t.trade_date, t.trade_time || '', t.strategy_name || '', t.symbol || '',
      t.direction || '', t.result || '', t.profit_r ?? null, t.max_rr ?? null, t.mae_r ?? null,
      t.smt || '', t.poi || '', t.ifvg_tf || '', t.sl_ticks ?? null,
      t.news || '', t.chart_link || '', t.notes || '',
      id,
    ]);
    this.ensureStrategy(t.strategy_name);
  },

  deleteTrade(id) {
    this.run("INSERT OR IGNORE INTO bt_tombstones (uid, deleted_at) SELECT uid, datetime('now') FROM bt_trades WHERE id = ? AND uid IS NOT NULL AND uid != ''", [id]);
    this.run("DELETE FROM bt_trades WHERE id = ?", [id]);
  },

  allStrategies() {
    return this.q("SELECT * FROM bt_strategies ORDER BY name ASC");
  },

  ensureStrategy(name) {
    if (!name) return;
    this.run("DELETE FROM bt_strategy_tombstones WHERE name = ?", [name]);
    this.run("INSERT OR IGNORE INTO bt_strategies (name) VALUES (?)", [name]);
  },

  deleteStrategy(id) {
    this.run("INSERT OR IGNORE INTO bt_strategy_tombstones (name, deleted_at) SELECT name, datetime('now') FROM bt_strategies WHERE id = ?", [id]);
    this.run("DELETE FROM bt_strategies WHERE id=?", [id]);
  },
};

// ── Constants / state ────────────────────────────────────────────────────────
const BT_SMT = ['1/4hr', '5/15min'];
const BT_POI = ['FVG', 'OB'];
const BT_IFVG = ['1m', '2m', '3m', '5m'];
const BT_NEWS = ['red', 'orange', 'yellow', 'holiday'];
const BT_NEWS_COLORS = { red: 'var(--red)', orange: 'var(--orange)', yellow: 'var(--yellow)', holiday: 'var(--muted)' };

const B = {
  trades: [],
  strategies: [],
  strategy: '',   // dashboard/analytics filter, '' = all
  filters: { result: '', direction: '', strategy: '', q: '' },
  editId: null,
  importWb: null,
  importRows: [],
};

function loadBT() {
  B.trades = BTDB.allTrades();
  B.strategies = BTDB.allStrategies();
}

const fmtR = (v) => `${v > 0 ? '+' : ''}${r2(v)}R`;
const rCls = (v) => v > 0.05 ? 'text-green' : v < -0.05 ? 'text-red' : 'text-muted-tj';

// wins = R > 0.05, losses = R < -0.05, rest BE; WR excludes BE (same as journal)
function btStats(trades) {
  const rs = trades.filter(t => t.profit_r != null).map(t => t.profit_r);
  const zero = { n: 0, wins: 0, losses: 0, be: 0, wr: 0, total: 0, avg: 0, avg_win: 0, avg_loss: 0, pf: 0, max_dd: 0, max_ls: 0, max_ws: 0, best: 0, worst: 0 };
  if (!rs.length) return zero;
  const w = rs.filter(r => r > 0.05), l = rs.filter(r => r < -0.05);
  const gw = w.reduce((a, b) => a + b, 0), gl = Math.abs(l.reduce((a, b) => a + b, 0));
  // streaks + drawdown run oldest → newest
  const chrono = trades.slice().filter(t => t.profit_r != null)
    .sort((a, b) => (a.trade_date + (a.trade_time || '')).localeCompare(b.trade_date + (b.trade_time || '')));
  let eq = 0, peak = 0, maxDd = 0, ls = 0, ws = 0, maxLs = 0, maxWs = 0;
  for (const t of chrono) {
    eq += t.profit_r;
    peak = Math.max(peak, eq);
    maxDd = Math.max(maxDd, peak - eq);
    if (t.profit_r < -0.05) { ls++; ws = 0; }
    else if (t.profit_r > 0.05) { ws++; ls = 0; }
    maxLs = Math.max(maxLs, ls); maxWs = Math.max(maxWs, ws);
  }
  return {
    n: rs.length, wins: w.length, losses: l.length, be: rs.length - w.length - l.length,
    wr: (w.length + l.length) ? r1(100 * w.length / (w.length + l.length)) : 0,
    total: r2(rs.reduce((a, b) => a + b, 0)),
    avg: r2(rs.reduce((a, b) => a + b, 0) / rs.length),
    avg_win: w.length ? r2(gw / w.length) : 0,
    avg_loss: l.length ? r2(-gl / l.length) : 0,
    pf: gl ? r2(gw / gl) : 0,
    max_dd: r2(maxDd), max_ls: maxLs, max_ws: maxWs,
    best: r2(Math.max(...rs)), worst: r2(Math.min(...rs)),
  };
}

function btScoped() {
  return B.strategy ? B.trades.filter(t => t.strategy_name === B.strategy) : B.trades;
}

function btEquity(trades) {
  const tr = trades.filter(t => t.profit_r != null).slice()
    .sort((a, b) => (a.trade_date + (a.trade_time || '')).localeCompare(b.trade_date + (b.trade_time || '')));
  let eq = 0;
  return tr.map(t => {
    eq += t.profit_r;
    return { date: t.trade_date, time: t.trade_time || '', eq: r2(eq), r: t.profit_r, sym: t.symbol || '' };
  });
}

function btStrategySelect(onchange) {
  const names = [...new Set([...B.strategies.map(s => s.name), ...B.trades.map(t => t.strategy_name).filter(Boolean)])].sort();
  if (!names.length) return '';
  return `<select class="form-control-tj" style="width:auto;font-size:.8rem;padding:6px 10px;" onchange="${onchange}">
    <option value="">All strategies</option>
    ${names.map(n => `<option value="${esc(n)}" ${B.strategy === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}
  </select>`;
}

function btSetStrategy(v) { B.strategy = v; renderRoute(); }

// ── Routing ──────────────────────────────────────────────────────────────────
function btRoute(h) {
  let tab = 'bt-dashboard';
  if (h.startsWith('#bt-edit-')) { renderBtForm(parseInt(h.slice(9), 10)); tab = 'bt-trades'; }
  else if (h === '#bt-add') { renderBtForm(null); tab = 'bt-trades'; }
  else if (h === '#bt-trades') { renderBtTrades(); tab = 'bt-trades'; }
  else if (h === '#bt-analytics') { renderBtAnalytics(); tab = 'bt-analytics'; }
  else if (h === '#bt-strategies') { renderBtStrategies(); tab = 'bt-strategies'; }
  else renderBtDashboard();
  document.querySelectorAll('#btTabbar a[data-tab]').forEach(a =>
    a.classList.toggle('active', a.dataset.tab === tab));
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function renderBtDashboard() {
  const trades = btScoped();
  const s = btStats(trades);
  const eq = btEquity(trades);

  const monthly = {};
  for (const t of trades) {
    if (t.profit_r == null) continue;
    const m = t.trade_date.slice(0, 7);
    monthly[m] = r2((monthly[m] || 0) + t.profit_r);
  }
  const mLabels = Object.keys(monthly).sort();
  const recent = trades.slice(0, 8);

  document.getElementById('btView').innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">Backtest Overview <span class="bt-chip">BACKTEST</span></h1>
      <div class="page-sub">${s.n} trades${B.strategy ? ' · ' + esc(B.strategy) : ''}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      ${btStrategySelect('btSetStrategy(this.value)')}
      <a href="#bt-add" class="btn-tj btn-bt"><i class="bi bi-plus-lg"></i> Log Trade</a>
    </div>
  </div>

  <div class="stats-row">
    <div class="card card-sm">
      <div class="card-title">Total R</div>
      <div class="stat-value ${s.total >= 0 ? 'text-green' : 'text-red'}">${fmtR(s.total)}</div>
      <div class="stat-sub">${s.n} trades</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Win Rate</div>
      <div class="stat-value ${s.wr >= 50 ? 'text-green' : 'text-red'}">${s.wr}%</div>
      <div class="stat-sub">${s.wins}W · ${s.losses}L · ${s.be}BE</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Expectancy</div>
      <div class="stat-value ${s.avg >= 0 ? 'text-green' : 'text-red'}">${fmtR(s.avg)}</div>
      <div class="stat-sub">per trade · avg win ${fmtR(s.avg_win)}</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Max Drawdown</div>
      <div class="stat-value text-red">-${s.max_dd}R</div>
      <div class="stat-sub">streaks: ${s.max_ws}W / ${s.max_ls}L</div>
    </div>
  </div>

  ${s.n ? `
  <div class="chart-row-full">
    <div class="chart-card" style="padding:20px 20px 14px;">
      <div class="chart-title" style="margin-bottom:14px;">R Curve</div>
      <div style="position:relative;height:260px;"><canvas id="btEquityChart"></canvas></div>
    </div>
  </div>
  <div class="chart-row-full">
    <div class="chart-card">
      <div class="chart-title">Monthly R</div>
      <canvas id="btMonthlyChart" height="90"></canvas>
    </div>
  </div>
  <div class="card" style="margin-top:16px;">
    <div class="card-title" style="margin-bottom:12px;">Recent Backtest Trades</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${recent.map(t => btRowHTML(t)).join('') || '<div class="no-data">No trades yet.</div>'}
    </div>
  </div>` : `
  <div class="card no-data" style="margin-top:6px;">
    No backtest trades yet.<br><br>
    <a href="#bt-add" class="btn-tj btn-bt"><i class="bi bi-plus-lg"></i> Log your first trade</a>
    &nbsp;or&nbsp;
    <button class="btn-tj btn-ghost" onclick="location.hash='#bt-strategies';setTimeout(btPickFile,300)"><i class="bi bi-file-earmark-excel"></i> Import your Excel backtest</button>
  </div>`}
  <div style="height:20px;"></div>`;

  if (!s.n) return;
  const lastEq = eq.length ? eq[eq.length - 1].eq : 0;
  S.charts.push(new Chart(document.getElementById('btEquityChart'), {
    type: 'line',
    plugins: [equityGradientPlugin(eq, 1)],
    data: {
      labels: eq.map(d => d.date),
      datasets: [
        { data: eq.map(() => 0), borderColor: 'rgba(139,148,158,0.3)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0 },
        { label: 'R', data: eq.map(d => d.eq), borderColor: lastEq >= 0 ? '#3fb950' : '#f85149',
          backgroundColor: 'transparent', fill: true, tension: 0.3, borderWidth: 2,
          pointRadius: eq.length > 120 ? 0 : 2.5, pointHoverRadius: 5,
          pointBackgroundColor: eq.map(d => d.r > 0.05 ? '#3fb950' : d.r < -0.05 ? '#f85149' : '#8b949e'),
          pointBorderColor: '#161b22', pointBorderWidth: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1, padding: 10,
          callbacks: {
            title: ctx => { const d = eq[ctx[0].dataIndex]; return (d.sym ? d.sym + ' · ' : '') + d.date + (d.time ? ' ' + d.time : ''); },
            label: ctx => ctx.datasetIndex === 0 ? null : [` Total: ${ctx.raw.toFixed(2)}R`, ` Trade: ${fmtR(eq[ctx.dataIndex].r)}`],
          },
        },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 9, maxRotation: 0, font: { size: 11 } }, grid: { color: 'rgba(48,54,61,0.6)' }, border: { display: false } },
        y: { ticks: { callback: v => v + 'R', font: { size: 11 } }, grid: { color: 'rgba(48,54,61,0.6)' }, border: { display: false } },
      },
    },
  }));

  S.charts.push(new Chart(document.getElementById('btMonthlyChart'), {
    type: 'bar',
    data: {
      labels: mLabels,
      datasets: [{ data: mLabels.map(k => monthly[k]), backgroundColor: mLabels.map(k => monthly[k] >= 0 ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)'), borderRadius: 4 }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#30363d' }, ticks: { callback: v => v + 'R' } } },
    },
  }));
}

// ── Trade list ───────────────────────────────────────────────────────────────
function btRowHTML(t) {
  const resBadge = t.result === 'TP' ? '<span class="badge-outcome badge-profit">TP</span>'
    : t.result === 'SL' ? '<span class="badge-outcome badge-loss">SL</span>'
    : t.result === 'BE' ? '<span class="badge-outcome badge-be">BE</span>' : '';
  const dirBadge = t.direction === 'Long' ? '<span class="badge-outcome badge-long">▲ Long</span>'
    : t.direction === 'Short' ? '<span class="badge-outcome badge-short">▼ Short</span>' : '';
  const tags = [t.smt && `SMT ${t.smt}`, t.poi, t.ifvg_tf && `iFVG ${t.ifvg_tf}`].filter(Boolean)
    .map(x => `<span class="tag" style="background:rgba(191,90,242,.14);color:var(--purple);">${esc(x)}</span>`).join('');
  const news = t.news ? `<span class="news-dot" style="background:${BT_NEWS_COLORS[t.news] || 'var(--muted)'};" title="${esc(t.news)} news"></span>` : '';
  const link = t.chart_link ? `<a href="${esc(t.chart_link)}" target="_blank" rel="noopener" style="color:var(--blue);font-size:.85rem;" title="Open chart"><i class="bi bi-graph-up-arrow"></i></a>` : '';
  return `<div class="bt-row">
    <div class="bt-row-main">
      <div class="bt-row-head">
        <span style="font-weight:800;">${esc(t.symbol || '—')}</span>
        ${dirBadge} ${resBadge} ${news} ${link}
        <span class="tc-date">${esc(t.trade_date)}${t.trade_time ? ' · ' + esc(t.trade_time) : ''}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;">${tags}
        ${t.strategy_name ? `<span class="tag" style="background:var(--surface2);color:var(--muted);">${esc(t.strategy_name)}</span>` : ''}
      </div>
      ${t.notes ? `<div class="tc-note" style="margin-top:5px;">${esc(t.notes.substring(0, 140))}${t.notes.length > 140 ? '…' : ''}</div>` : ''}
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:1.05rem;font-weight:800;" class="${rCls(t.profit_r ?? 0)}">${t.profit_r != null ? fmtR(t.profit_r) : '—'}</div>
      ${t.max_rr != null || t.mae_r != null ? `<div style="font-size:.7rem;color:var(--muted);">${t.max_rr != null ? 'max ' + r2(t.max_rr) + 'R' : ''}${t.max_rr != null && t.mae_r != null ? ' · ' : ''}${t.mae_r != null ? 'mae ' + r2(t.mae_r) + 'R' : ''}</div>` : ''}
      <a href="#bt-edit-${t.id}" class="btn-edit-sm" style="margin-top:5px;"><i class="bi bi-pencil"></i></a>
    </div>
  </div>`;
}

function btSetFilter(key, val) {
  const f = B.filters;
  if (key === 'all') { f.result = ''; f.direction = ''; }
  else f[key] = f[key] === val ? '' : val;
  renderBtTrades();
}

function btSetSearch(q) { B.filters.q = q; renderBtTradeList(); }
function btSetListStrategy(v) { B.filters.strategy = v; renderBtTradeList(); }

function btFiltered() {
  const f = B.filters;
  return B.trades.filter(t => {
    if (f.result && t.result !== f.result) return false;
    if (f.direction && t.direction !== f.direction) return false;
    if (f.strategy && t.strategy_name !== f.strategy) return false;
    if (f.q) {
      const q = f.q.toLowerCase();
      if (!(t.symbol || '').toLowerCase().includes(q) &&
          !(t.notes || '').toLowerCase().includes(q) &&
          !(t.strategy_name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function renderBtTradeList() {
  const trades = btFiltered();
  const s = btStats(trades);
  document.getElementById('btTradeCount').textContent = `${trades.length} trades`;
  document.getElementById('btStatStrip').innerHTML = `
    <div><span>Win Rate</span> <strong class="${s.wr >= 50 ? 'text-green' : 'text-red'}">${s.wr}%</strong></div>
    <div><span>Total R</span> <strong class="${s.total >= 0 ? 'text-green' : 'text-red'}">${fmtR(s.total)}</strong></div>
    <div><span>Expectancy</span> <strong class="${s.avg >= 0 ? 'text-green' : 'text-red'}">${fmtR(s.avg)}</strong></div>
    <div><span>Profit Factor</span> <strong>${s.pf}</strong></div>
    <div><span>Avg Win</span> <strong class="text-green">${fmtR(s.avg_win)}</strong></div>
    <div><span>Avg Loss</span> <strong class="text-red">${fmtR(s.avg_loss)}</strong></div>
    <div><span>W / L / BE</span> <strong>${s.wins} / ${s.losses} / ${s.be}</strong></div>
    <div><span>Max DD</span> <strong class="text-red">-${s.max_dd}R</strong></div>`;
  document.getElementById('btTradeCards').innerHTML = trades.length
    ? trades.map(btRowHTML).join('')
    : '<div class="no-data">No backtest trades found. <a href="#bt-add" style="color:var(--purple);">Log one →</a></div>';
}

function renderBtTrades() {
  const f = B.filters;
  const names = [...new Set(B.trades.map(t => t.strategy_name).filter(Boolean))].sort();
  const pill = (active, cls, label, onclick) =>
    `<button class="filt-btn ${active ? cls : ''}" onclick="${onclick}">${label}</button>`;

  document.getElementById('btView').innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">Backtest Trades <span class="bt-chip">BACKTEST</span></h1>
      <div class="page-sub" id="btTradeCount"></div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn-tj btn-ghost" onclick="btPickFile()"><i class="bi bi-file-earmark-excel"></i> Import</button>
      <a href="#bt-add" class="btn-tj btn-bt"><i class="bi bi-plus-lg"></i> Log Trade</a>
    </div>
  </div>

  <div class="filter-bar">
    ${pill(!f.result && !f.direction, 'active', 'All', "btSetFilter('all')")}
    ${pill(f.result === 'TP', 'active-profit', '✓ TP', "btSetFilter('result','TP')")}
    ${pill(f.result === 'SL', 'active-loss', '✗ SL', "btSetFilter('result','SL')")}
    ${pill(f.result === 'BE', 'active-be', '— BE', "btSetFilter('result','BE')")}
    ${pill(f.direction === 'Long', 'active-long', '▲ Long', "btSetFilter('direction','Long')")}
    ${pill(f.direction === 'Short', 'active-short', '▼ Short', "btSetFilter('direction','Short')")}
  </div>
  <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
    <input type="text" class="form-control-tj" placeholder="🔍  Search symbol, notes, strategy…" value="${esc(f.q)}"
           oninput="btSetSearch(this.value)" style="font-size:.82rem;padding:7px 11px;flex:1;min-width:200px;">
    ${names.length ? `<select class="form-control-tj" style="width:auto;font-size:.8rem;" onchange="btSetListStrategy(this.value)">
      <option value="">All strategies</option>
      ${names.map(n => `<option value="${esc(n)}" ${f.strategy === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}
    </select>` : ''}
  </div>

  <div class="stat-strip" id="btStatStrip"></div>
  <div style="display:flex;flex-direction:column;gap:8px;" id="btTradeCards"></div>
  <div style="height:20px;"></div>`;

  renderBtTradeList();
}

function btDelTrade(id) {
  if (!confirm('Delete this backtest trade?')) return;
  BTDB.deleteTrade(id);
  loadBT();
  scheduleSync();
  location.hash = '#bt-trades';
  renderRoute();
}

// ── Add / Edit form ──────────────────────────────────────────────────────────
const BF = { direction: '', result: '', editId: null };

function renderBtForm(editId) {
  const t = editId != null ? B.trades.find(x => x.id === editId) : null;
  if (editId != null && !t) { location.hash = '#bt-trades'; return; }
  BF.editId = editId;
  BF.direction = t ? t.direction : '';
  BF.result = t ? t.result : '';

  const names = [...new Set([...B.strategies.map(s => s.name), ...B.trades.map(x => x.strategy_name).filter(Boolean)])].sort();
  const symbols = [...new Set(B.trades.map(x => x.symbol).filter(Boolean))];

  document.getElementById('btView').innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">${t ? 'Edit Backtest Trade' : 'Log Backtest Trade'} <span class="bt-chip">BACKTEST</span></h1>
      ${t ? `<div class="page-sub">${esc(t.trade_date)}</div>` : ''}
    </div>
    <a href="#bt-trades" class="btn-tj btn-ghost"><i class="bi bi-arrow-left"></i> Back</a>
  </div>

  <div class="card" style="max-width:780px;">
    <div class="form-grid">
      <div>
        <label class="form-label-tj">Date</label>
        <input type="date" id="bfDate" class="form-control-tj" value="${t ? t.trade_date : todayStr()}">
      </div>
      <div>
        <label class="form-label-tj">Entry Time</label>
        <input type="time" id="bfTime" class="form-control-tj" value="${t ? t.trade_time : ''}">
      </div>
      <div>
        <label class="form-label-tj">Strategy</label>
        <input type="text" id="bfStrategy" class="form-control-tj" list="bfStrategyList" placeholder="e.g. Leading Index NY Open"
               value="${esc(t ? t.strategy_name : (B.strategy || names[0] || ''))}">
        <datalist id="bfStrategyList">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      </div>
      <div>
        <label class="form-label-tj">Symbol</label>
        <input type="text" id="bfSymbol" class="form-control-tj" list="bfSymbolList" value="${esc(t ? t.symbol : '')}" placeholder="NQ, ES…" style="text-transform:uppercase;">
        <datalist id="bfSymbolList">${['NQ', 'ES', ...symbols].filter((v, i, a) => a.indexOf(v) === i).map(s => `<option value="${esc(s)}">`).join('')}</datalist>
      </div>
      <div>
        <label class="form-label-tj">Direction</label>
        <div class="dir-row">
          <div class="dir-opt ${BF.direction === 'Long' ? 'sel-long' : ''}" data-d="Long" onclick="btSetDir('Long')">▲ Long</div>
          <div class="dir-opt ${BF.direction === 'Short' ? 'sel-short' : ''}" data-d="Short" onclick="btSetDir('Short')">▼ Short</div>
        </div>
      </div>
      <div>
        <label class="form-label-tj">Result</label>
        <div class="outcome-row">
          <div class="outcome-opt ${BF.result === 'TP' ? 'selected-profit' : ''}" data-o="TP" onclick="btSetResult('TP')">TP</div>
          <div class="outcome-opt ${BF.result === 'SL' ? 'selected-loss' : ''}" data-o="SL" onclick="btSetResult('SL')">SL</div>
          <div class="outcome-opt ${BF.result === 'BE' ? 'selected-be' : ''}" data-o="BE" onclick="btSetResult('BE')">BE</div>
        </div>
      </div>
      <div>
        <label class="form-label-tj">Profit R</label>
        <input type="number" step="0.01" id="bfR" class="form-control-tj" value="${t && t.profit_r != null ? t.profit_r : ''}" placeholder="e.g. 2.1 or -1">
      </div>
      <div>
        <label class="form-label-tj">Max RR <span style="font-weight:400;color:var(--muted);font-size:.7rem;">(how far it ran — powers the TP optimizer)</span></label>
        <input type="number" step="0.01" id="bfMaxRR" class="form-control-tj" value="${t && t.max_rr != null ? t.max_rr : ''}" placeholder="e.g. 3.4">
      </div>
      <div>
        <label class="form-label-tj">MAE (R) <span style="font-weight:400;color:var(--muted);font-size:.7rem;">(worst drawdown before it resolved — powers the SL optimizer)</span></label>
        <input type="number" step="0.01" min="0" id="bfMae" class="form-control-tj" value="${t && t.mae_r != null ? t.mae_r : ''}" placeholder="e.g. 0.45 (1 = tagged SL)">
      </div>
      <div>
        <label class="form-label-tj">SMT</label>
        <select id="bfSmt" class="form-control-tj">
          <option value="">—</option>
          ${BT_SMT.map(x => `<option ${t && t.smt === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label-tj">POI</label>
        <select id="bfPoi" class="form-control-tj">
          <option value="">—</option>
          ${BT_POI.map(x => `<option ${t && t.poi === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label-tj">iFVG Timeframe</label>
        <select id="bfIfvg" class="form-control-tj">
          <option value="">—</option>
          ${BT_IFVG.map(x => `<option ${t && t.ifvg_tf === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label-tj">SL (ticks)</label>
        <input type="number" step="1" id="bfSl" class="form-control-tj" value="${t && t.sl_ticks != null ? t.sl_ticks : ''}" placeholder="e.g. 96">
      </div>
      <div>
        <label class="form-label-tj">News that day</label>
        <select id="bfNews" class="form-control-tj">
          <option value="">none</option>
          ${BT_NEWS.map(x => `<option ${t && t.news === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
      <div class="full">
        <label class="form-label-tj">Chart Link (TradingView)</label>
        <input type="url" id="bfLink" class="form-control-tj" value="${esc(t ? t.chart_link : '')}" placeholder="https://www.tradingview.com/x/…">
      </div>
      <div class="full">
        <label class="form-label-tj">Comment</label>
        <textarea id="bfNotes" class="form-control-tj" rows="3" placeholder="Setup quality, what you saw, what you'd do live…">${esc(t ? t.notes : '')}</textarea>
      </div>
    </div>

    <hr class="divider">
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <a href="#bt-trades" class="btn-tj btn-ghost">Cancel</a>
      ${t ? `<button class="btn-tj" style="background:rgba(248,81,73,.15);color:var(--red);" onclick="btDelTrade(${t.id})"><i class="bi bi-trash"></i> Delete</button>` : ''}
      <button class="btn-tj btn-bt" onclick="btSaveTrade()"><i class="bi bi-check-lg"></i> ${t ? 'Save Changes' : 'Save Trade'}</button>
    </div>
  </div>
  <div style="height:20px;"></div>`;
}

function btSetDir(d) {
  BF.direction = d;
  document.querySelectorAll('#btView .dir-opt[data-d]').forEach(el => {
    el.className = 'dir-opt';
    if (el.dataset.d === d) el.classList.add(d === 'Long' ? 'sel-long' : 'sel-short');
  });
}

function btSetResult(o) {
  BF.result = o;
  document.querySelectorAll('#btView .outcome-opt').forEach(el => {
    el.className = 'outcome-opt';
    if (el.dataset.o === o) {
      el.classList.add(o === 'TP' ? 'selected-profit' : o === 'SL' ? 'selected-loss' : 'selected-be');
    }
  });
  // convenience: SL defaults Profit R to -1, BE to 0 when the field is empty
  const rEl = document.getElementById('bfR');
  if (rEl && rEl.value === '') {
    if (o === 'SL') rEl.value = '-1';
    if (o === 'BE') rEl.value = '0';
  }
}

function btSaveTrade() {
  const num = (id) => { const v = document.getElementById(id).value; return v === '' ? null : parseFloat(v); };
  const t = {
    trade_date: document.getElementById('bfDate').value || todayStr(),
    trade_time: document.getElementById('bfTime').value || '',
    strategy_name: document.getElementById('bfStrategy').value.trim(),
    symbol: document.getElementById('bfSymbol').value.toUpperCase().trim(),
    direction: BF.direction,
    result: BF.result,
    profit_r: num('bfR'),
    max_rr: num('bfMaxRR'),
    mae_r: num('bfMae'),
    smt: document.getElementById('bfSmt').value,
    poi: document.getElementById('bfPoi').value,
    ifvg_tf: document.getElementById('bfIfvg').value,
    sl_ticks: num('bfSl'),
    news: document.getElementById('bfNews').value,
    chart_link: document.getElementById('bfLink').value.trim(),
    notes: document.getElementById('bfNotes').value,
  };
  if (BF.editId != null) BTDB.updateTrade(BF.editId, t);
  else BTDB.addTrade(t);
  loadBT();
  scheduleSync();
  location.hash = '#bt-trades';
}

// ── Analytics ────────────────────────────────────────────────────────────────
const BT_TIME_BINS = [
  ['< 15:40', 0, 940], ['15:40–15:49', 940, 950], ['15:50–15:59', 950, 960],
  ['16:00–16:09', 960, 970], ['16:10–16:19', 970, 980], ['16:20–16:29', 980, 990], ['≥ 16:30', 990, 1441],
];

function btMinutes(t) {
  if (!t.trade_time) return null;
  const [h, m] = t.trade_time.split(':').map(Number);
  return isNaN(h) ? null : h * 60 + (m || 0);
}

function btBreakdownTable(title, groups, hint) {
  const rows = groups.filter(g => g.trades.length);
  if (!rows.length) return '';
  const maxAbs = Math.max(...rows.map(g => Math.abs(btStats(g.trades).avg)), 0.01);
  return `<div class="card" style="margin-bottom:16px;">
    <div class="card-title" style="margin-bottom:4px;">${title}</div>
    ${hint ? `<div style="font-size:.72rem;color:var(--muted);margin-bottom:8px;">${hint}</div>` : ''}
    <table class="bt-table">
      <thead><tr><th></th><th>n</th><th>WR</th><th>Total</th><th>Avg R</th><th></th></tr></thead>
      <tbody>
      ${rows.map(g => {
        const s = btStats(g.trades);
        const w = Math.min(Math.abs(s.avg) / maxAbs * 100, 100);
        return `<tr>
          <td style="font-weight:600;">${esc(g.label)}</td>
          <td class="text-muted-tj">${s.n}</td>
          <td class="${s.wr >= 50 ? 'text-green' : 'text-red'}">${s.wr}%</td>
          <td class="${s.total >= 0 ? 'text-green' : 'text-red'}">${fmtR(s.total)}</td>
          <td class="${s.avg >= 0 ? 'text-green' : 'text-red'}" style="font-weight:700;">${fmtR(s.avg)}</td>
          <td style="width:34%;"><div class="bt-bar ${s.avg >= 0 ? 'pos' : 'neg'}" style="width:${w}%;"></div></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderBtAnalytics() {
  const trades = btScoped().filter(t => t.profit_r != null);
  const s = btStats(trades);

  if (!trades.length) {
    document.getElementById('btView').innerHTML = `
    <div class="page-header"><h1 class="page-title">Backtest Analytics <span class="bt-chip">BACKTEST</span></h1></div>
    <div class="card no-data">No data yet — log trades or import your Excel backtest first.</div>`;
    return;
  }

  const by = (keyFn) => {
    const m = {};
    for (const t of trades) {
      const k = keyFn(t);
      if (k == null) continue;
      (m[k] = m[k] || []).push(t);
    }
    return m;
  };

  const timeGroups = BT_TIME_BINS.map(([label, lo, hi]) =>
    ({ label, trades: trades.filter(t => { const m = btMinutes(t); return m != null && m >= lo && m < hi; }) }));
  const dowMap = by(t => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(t.trade_date + 'T12:00:00').getDay()]);
  const dowGroups = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => ({ label: d, trades: dowMap[d] || [] }));
  const moMap = by(t => t.trade_date.slice(0, 7));
  const moGroups = Object.keys(moMap).sort().map(k => ({ label: k, trades: moMap[k] }));
  const mk = (map, order) => (order || Object.keys(map).sort()).map(k => ({ label: k, trades: map[k] || [] }));
  const symGroups = mk(by(t => t.symbol || null));
  const dirGroups = mk(by(t => t.direction || null), ['Long', 'Short']);
  const smtGroups = mk(by(t => t.smt || null), BT_SMT);
  const poiGroups = mk(by(t => t.poi || null), BT_POI);
  const ifvgGroups = mk(by(t => t.ifvg_tf || null), BT_IFVG);
  const newsMap = by(t => t.news || 'none');
  const newsGroups = mk(newsMap, ['none', 'yellow', 'orange', 'red', 'holiday']);

  // TP optimizer: replay every trade with Max RR data against a fixed TP target
  const withRR = trades.filter(t => t.max_rr != null);
  const targets = [];
  for (let x = 0.5; x <= 5.001; x += 0.25) targets.push(r2(x));
  const optimizer = targets.map(target => {
    let tot = 0, hits = 0;
    for (const t of withRR) {
      if (t.max_rr >= target) { tot += target; hits++; }
      else if (t.result === 'BE') tot += 0;
      else tot -= 1;
    }
    return { target, total: r2(tot), hits };
  });
  const best = optimizer.reduce((a, b) => (b.total > a.total ? b : a), optimizer[0]);

  // SL optimizer: tighten the stop to a fraction f of its real distance.
  // Losers stay -1R for any f ≤ 1 (stopped earlier, risk re-normalizes).
  // Winners/BE need MAE: mae_r ≥ f means the tighter stop kills the trade (−1),
  // otherwise the same exit prices now pay profit_r / f.
  const slLosers = trades.filter(t => t.profit_r <= -0.95);
  const maeWinners = trades.filter(t => t.profit_r > -0.95 && t.mae_r != null);
  const slFactors = [];
  for (let f = 0.5; f <= 1.001; f += 0.05) slFactors.push(r2(f));
  const slOpt = slFactors.map(f => {
    let tot = -slLosers.length, killed = 0;
    for (const t of maeWinners) {
      if (t.mae_r >= f - 1e-9) { tot -= 1; killed++; }
      else tot += t.profit_r / f;
    }
    return { f, total: r2(tot), killed };
  });
  const slBest = slOpt.reduce((a, b) => (b.total > a.total ? b : a), slOpt[0]);
  const maeSorted = maeWinners.map(t => t.mae_r).sort((a, b) => a - b);
  const pct = (p) => maeSorted.length ? r2(maeSorted[Math.min(Math.floor(p * maeSorted.length), maeSorted.length - 1)]) : 0;

  // SL size buckets: per symbol, split at the median tick distance
  const slSizeGroups = [];
  for (const sym of [...new Set(trades.map(t => t.symbol).filter(Boolean))].sort()) {
    const st = trades.filter(t => t.symbol === sym && t.sl_ticks != null);
    if (st.length < 8) continue;
    const sorted = st.map(t => t.sl_ticks).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    slSizeGroups.push({ label: `${sym} ≤ ${med} ticks`, trades: st.filter(t => t.sl_ticks <= med) });
    slSizeGroups.push({ label: `${sym} > ${med} ticks`, trades: st.filter(t => t.sl_ticks > med) });
  }

  // entry-time drift: chronological scatter of entry times
  const drift = trades.filter(t => btMinutes(t) != null).slice()
    .sort((a, b) => (a.trade_date + (a.trade_time || '')).localeCompare(b.trade_date + (b.trade_time || '')))
    .map(t => ({ x: t.trade_date, y: btMinutes(t), r: t.profit_r }));

  document.getElementById('btView').innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">Backtest Analytics <span class="bt-chip">BACKTEST</span></h1>
      <div class="page-sub">${s.n} trades${B.strategy ? ' · ' + esc(B.strategy) : ''}</div>
    </div>
    ${btStrategySelect('btSetStrategy(this.value)')}
  </div>

  <div class="analytics-grid">
    <div class="card card-sm">
      <div class="card-title">Total R</div>
      <div class="stat-value ${s.total >= 0 ? 'text-green' : 'text-red'}">${fmtR(s.total)}</div>
      <div class="stat-sub">expectancy ${fmtR(s.avg)}/trade</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Win Rate</div>
      <div class="stat-value ${s.wr >= 50 ? 'text-green' : 'text-red'}">${s.wr}%</div>
      <div class="stat-sub">${s.wins}W · ${s.losses}L · ${s.be}BE</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Profit Factor</div>
      <div class="stat-value ${s.pf >= 1 ? 'text-green' : 'text-red'}">${s.pf}</div>
      <div class="stat-sub">avg win ${fmtR(s.avg_win)} · avg loss ${fmtR(s.avg_loss)}</div>
    </div>
    <div class="card card-sm">
      <div class="card-title">Max DD / Streaks</div>
      <div class="stat-value text-red">-${s.max_dd}R</div>
      <div class="stat-sub">${s.max_ws} wins / ${s.max_ls} losses in a row</div>
    </div>
  </div>

  ${withRR.length >= 5 ? `
  <div class="chart-row-full">
    <div class="chart-card" style="padding:20px;">
      <div class="chart-title" style="margin-bottom:2px;">TP Optimizer</div>
      <div style="font-size:.75rem;color:var(--muted);margin-bottom:12px;">
        Replays the ${withRR.length} trades that have Max RR logged with a fixed take-profit.
        Best fixed target: <strong style="color:var(--purple);">${best.target}R → ${fmtR(best.total)}</strong>
        ${withRR.length < trades.length ? ` · ${trades.length - withRR.length} trades missing Max RR are excluded` : ''}
      </div>
      <div style="position:relative;height:220px;"><canvas id="btTpChart"></canvas></div>
    </div>
  </div>` : `
  <div class="card" style="margin-bottom:16px;font-size:.8rem;color:var(--muted);">
    <i class="bi bi-lightbulb" style="color:var(--yellow);"></i>
    Log <strong>Max RR</strong> (how far price ran before reversing) on your trades to unlock the TP optimizer —
    it replays your history with different fixed take-profit targets and finds the most profitable one.
    Currently ${withRR.length} of ${trades.length} trades have it.
  </div>`}

  ${maeWinners.length >= 5 ? `
  <div class="chart-row-full">
    <div class="chart-card" style="padding:20px;">
      <div class="chart-title" style="margin-bottom:2px;">SL Optimizer</div>
      <div style="font-size:.75rem;color:var(--muted);margin-bottom:12px;">
        Replays ${maeWinners.length + slLosers.length} trades (${maeWinners.length} non-losers with MAE + ${slLosers.length} losses)
        with the stop tightened to a fraction of its real distance — same exit prices, smaller risk.
        Best: <strong style="color:var(--purple);">${Math.round(slBest.f * 100)}% of current SL → ${fmtR(slBest.total)}</strong>
        (kills ${slBest.killed} winner${slBest.killed === 1 ? '' : 's'}) ·
        winners' MAE: 50% stayed under ${pct(0.5)}R, 90% under ${pct(0.9)}R
      </div>
      <div style="position:relative;height:220px;"><canvas id="btSlChart"></canvas></div>
    </div>
  </div>` : `
  <div class="card" style="margin-bottom:16px;font-size:.8rem;color:var(--muted);">
    <i class="bi bi-lightbulb" style="color:var(--yellow);"></i>
    Log <strong>MAE</strong> (worst drawdown in R before the trade resolved — 0.3 means price came 30% of the way to your stop)
    to unlock the SL optimizer — it shows whether tighter stop placement would have made more R overall.
    Currently ${maeWinners.length} of ${trades.length - slLosers.length} non-losing trades have it.
  </div>`}

  ${drift.length >= 5 ? `
  <div class="chart-row-full">
    <div class="chart-card" style="padding:20px;">
      <div class="chart-title" style="margin-bottom:2px;">Entry Time Drift</div>
      <div style="font-size:.75rem;color:var(--muted);margin-bottom:12px;">
        When your setups appear, over time — spot the window moving or widening. Green = win, red = loss.
      </div>
      <div style="position:relative;height:220px;"><canvas id="btDriftChart"></canvas></div>
    </div>
  </div>` : ''}

  ${btBreakdownTable('Performance by Entry Time', timeGroups)}
  ${btBreakdownTable('By Day of Week', dowGroups)}
  ${btBreakdownTable('By Month', moGroups)}
  ${btBreakdownTable('By Symbol', symGroups)}
  ${btBreakdownTable('By Direction', dirGroups)}
  ${btBreakdownTable('By SMT Timeframe', smtGroups)}
  ${btBreakdownTable('By POI Type', poiGroups)}
  ${btBreakdownTable('By iFVG Timeframe', ifvgGroups)}
  ${btBreakdownTable('By SL Size', slSizeGroups, 'Per symbol, split at the median stop distance in ticks')}
  ${btBreakdownTable('By News Day', newsGroups, 'Highest-impact scheduled news on the trade day')}
  <div style="height:20px;"></div>`;

  Chart.defaults.color = '#8b949e';
  Chart.defaults.borderColor = '#30363d';

  if (withRR.length >= 5) {
    S.charts.push(new Chart(document.getElementById('btTpChart'), {
      type: 'line',
      data: {
        labels: optimizer.map(o => o.target + 'R'),
        datasets: [{
          data: optimizer.map(o => o.total),
          borderColor: '#bf5af2', backgroundColor: 'rgba(191,90,242,.12)', fill: true,
          tension: 0.3, borderWidth: 2,
          pointRadius: optimizer.map(o => o.target === best.target ? 6 : 3),
          pointBackgroundColor: optimizer.map(o => o.target === best.target ? '#bf5af2' : '#8b949e'),
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => 'Fixed TP at ' + ctx[0].label,
              label: ctx => {
                const o = optimizer[ctx.dataIndex];
                return [` Total: ${fmtR(o.total)}`, ` Hit rate: ${o.hits}/${withRR.length} (${Math.round(o.hits / withRR.length * 100)}%)`];
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, title: { display: true, text: 'Fixed TP target', font: { size: 11 } } },
          y: { grid: { color: '#30363d' }, ticks: { callback: v => v + 'R' } },
        },
      },
    }));
  }

  if (maeWinners.length >= 5) {
    S.charts.push(new Chart(document.getElementById('btSlChart'), {
      type: 'line',
      data: {
        labels: slOpt.map(o => Math.round(o.f * 100) + '%'),
        datasets: [{
          data: slOpt.map(o => o.total),
          borderColor: '#ff9f0a', backgroundColor: 'rgba(255,159,10,.12)', fill: true,
          tension: 0.3, borderWidth: 2,
          pointRadius: slOpt.map(o => o.f === slBest.f ? 6 : 3),
          pointBackgroundColor: slOpt.map(o => o.f === slBest.f ? '#ff9f0a' : '#8b949e'),
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => 'SL at ' + ctx[0].label + ' of real distance',
              label: ctx => {
                const o = slOpt[ctx.dataIndex];
                return [` Total: ${fmtR(o.total)}`, ` Winners stopped out: ${o.killed}/${maeWinners.length}`];
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, title: { display: true, text: 'Stop distance vs. what you actually used', font: { size: 11 } } },
          y: { grid: { color: '#30363d' }, ticks: { callback: v => v + 'R' } },
        },
      },
    }));
  }

  if (drift.length >= 5) {
    const fmtMin = (v) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
    S.charts.push(new Chart(document.getElementById('btDriftChart'), {
      type: 'scatter',
      data: {
        labels: drift.map(d => d.x),
        datasets: [{
          data: drift.map((d, i) => ({ x: i, y: d.y })),
          pointBackgroundColor: drift.map(d => d.r > 0.05 ? '#3fb950' : d.r < -0.05 ? '#f85149' : '#8b949e'),
          pointRadius: 4, pointHoverRadius: 7,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => drift[ctx[0].dataIndex].x,
              label: ctx => {
                const d = drift[ctx.dataIndex];
                return [` Entry: ${fmtMin(d.y)}`, ` Result: ${fmtR(d.r)}`];
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear', grid: { color: 'rgba(48,54,61,0.5)' },
            ticks: { maxTicksLimit: 8, callback: v => drift[Math.round(v)] ? drift[Math.round(v)].x : '' },
          },
          y: { grid: { color: 'rgba(48,54,61,0.5)' }, ticks: { callback: fmtMin, stepSize: 10 } },
        },
      },
    }));
  }
}

// ── Strategies / data ────────────────────────────────────────────────────────
function renderBtStrategies() {
  const names = [...new Set([...B.strategies.map(x => x.name), ...B.trades.map(t => t.strategy_name).filter(Boolean)])].sort();
  const cards = names.map(name => {
    const row = B.strategies.find(x => x.name === name);
    const trades = B.trades.filter(t => t.strategy_name === name);
    const s = btStats(trades);
    return `<div class="card" style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:38px;height:38px;background:rgba(191,90,242,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <i class="bi bi-clipboard2-data" style="color:var(--purple);"></i>
          </div>
          <div>
            <div style="font-weight:800;">${esc(name)}</div>
            <div style="font-size:.74rem;color:var(--muted);">${s.n} trades</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn-edit-sm" onclick="B.strategy='${esc(name)}';location.hash='#bt-analytics'"><i class="bi bi-bar-chart-line"></i> Analytics</button>
          ${row ? `<button class="btn-danger-sm" onclick="btDelStrategy(${row.id}, '${esc(name)}')"><i class="bi bi-trash"></i></button>` : ''}
        </div>
      </div>
      ${s.n ? `<div class="stat-strip" style="margin:12px 0 0;">
        <div><span>Total R</span> <strong class="${s.total >= 0 ? 'text-green' : 'text-red'}">${fmtR(s.total)}</strong></div>
        <div><span>Win Rate</span> <strong class="${s.wr >= 50 ? 'text-green' : 'text-red'}">${s.wr}%</strong></div>
        <div><span>Expectancy</span> <strong class="${s.avg >= 0 ? 'text-green' : 'text-red'}">${fmtR(s.avg)}</strong></div>
        <div><span>Max DD</span> <strong class="text-red">-${s.max_dd}R</strong></div>
      </div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('btView').innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">Strategies <span class="bt-chip">BACKTEST</span></h1>
      <div class="page-sub">${B.trades.length} backtest trades · stored in backtest.db (separate from your journal)</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn-tj btn-ghost" onclick="switchWorkspace()" title="Switch workspace"><i class="bi bi-arrow-left-right"></i> Journal</button>
      <button class="btn-tj btn-ghost" onclick="signOutApp()" title="Sign out"><i class="bi bi-box-arrow-right"></i></button>
      <button class="btn-tj btn-bt" onclick="btPickFile()"><i class="bi bi-file-earmark-excel"></i> Import Excel</button>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px;">
    <div class="card-title" style="margin-bottom:10px;">New Strategy</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <input type="text" id="btNewStrategy" class="form-control-tj" placeholder="e.g. Leading Index NY Open — 2TP" style="flex:1;min-width:220px;">
      <button class="btn-tj btn-bt" onclick="btAddStrategy()"><i class="bi bi-plus-lg"></i> Add</button>
    </div>
    <div style="font-size:.74rem;color:var(--muted);margin-top:8px;">
      Use one strategy per rule-set variant (like the sheets in your Excel file) — then compare them in Analytics.
    </div>
  </div>

  ${cards || '<div class="no-data">No strategies yet — add one above or import your Excel backtest.</div>'}
  <div style="height:20px;"></div>`;
}

function btAddStrategy() {
  const name = document.getElementById('btNewStrategy').value.trim();
  if (!name) return;
  BTDB.ensureStrategy(name);
  loadBT();
  scheduleSync();
  renderBtStrategies();
}

function btDelStrategy(id, name) {
  const n = B.trades.filter(t => t.strategy_name === name).length;
  if (!confirm(`Delete strategy "${name}"?${n ? ` Its ${n} trades stay in the trade log.` : ''}`)) return;
  BTDB.deleteStrategy(id);
  loadBT();
  scheduleSync();
  renderBtStrategies();
}

// ── Excel import (supports both layouts of the user's backtesting workbook) ──
function btPickFile() {
  if (!window.XLSX) { alert('Excel library is still loading — try again in a second.'); return; }
  document.getElementById('btFileInput').click();
}

async function btFileChosen(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    B.importWb = XLSX.read(buf, { cellDates: true });
  } catch (e) {
    alert('Could not read that file: ' + e.message);
    return;
  }
  const sheets = B.importWb.SheetNames;
  document.getElementById('btImportSheet').innerHTML =
    sheets.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  document.getElementById('btImportBackdrop').classList.add('open');
  btPreviewImport();
}

function btCellVal(ws, r, c) {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  return cell ? cell : null;
}

function btParseDate(v) {
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (m) {
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      if (y > 2100) y -= 2000;           // "14.10.2025" typed with 4 digits → parsed as 4025
      const now = new Date().getFullYear();
      if (y > now + 1) y -= 10;          // fat-finger years like 24.03.36 → 2026
      return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    }
  }
  return null;
}

function btParseTime(v) {
  if (v instanceof Date && !isNaN(v)) return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`;
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60);
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
  if (typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v.trim())) {
    const [h, m] = v.trim().split(':');
    return `${h.padStart(2, '0')}:${m.slice(0, 2)}`;
  }
  return '';
}

const btNum = (v) => (typeof v === 'number' && isFinite(v)) ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : null);

// Returns {rows, layout} for a worksheet in either workbook layout:
//  A) headered — header row contains '#' + 'Profit R' (e.g. "01.09.25 - 14.11")
//  B) master   — no header row, news columns E/F/G (e.g. "01.09.25 - 5.12 …")
function btParseSheet(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const maxR = Math.min(range.e.r, 5000);
  const val = (r, c) => { const cell = btCellVal(ws, r, c); return cell ? cell.v : null; };
  const link = (r, c) => {
    const cell = btCellVal(ws, r, c);
    if (!cell) return '';
    if (cell.l && cell.l.Target) return cell.l.Target;
    return (typeof cell.v === 'string' && cell.v.startsWith('http')) ? cell.v : '';
  };

  // find a header row within the first 6 rows
  let hdrRow = -1; const colOf = {};
  for (let r = 0; r <= Math.min(5, maxR); r++) {
    const rowVals = [];
    for (let c = 0; c <= 30; c++) rowVals.push(val(r, c));
    if (rowVals.some(v => typeof v === 'string' && v.trim() === 'Profit R')) {
      hdrRow = r;
      rowVals.forEach((v, c) => { if (typeof v === 'string' && v.trim()) colOf[v.trim()] = c; });
      break;
    }
  }

  const rows = [];
  if (hdrRow >= 0) {
    const C = (names) => { for (const n of names) { for (const k in colOf) { if (k === n || k.startsWith(n)) return colOf[k]; } } return -1; };
    const cTime = C(['Time']), cIdx = C(['Index']), cDate = C(['Date', 'Dates']), cR = C(['Profit R']),
      cRes = C(['Trade Result']), cMax = C(['Max RR']), cDir = C(['Entry Type']),
      cImg = C(['Trade Image']), cSmt = C(['SMT']), cPoi = C(['FVG/OB', 'FVG']),
      cIfvg = C(['iFVG']), cSl = C(['SL']), cCmt = C(['Comment']);
    if (cDate < 0 || cR < 0) return { rows: [], layout: 'headered' };
    for (let r = hdrRow + 1; r <= maxR; r++) {
      const date = btParseDate(val(r, cDate));
      const profitR = btNum(val(r, cR));
      if (!date || profitR == null) continue;
      rows.push({
        trade_date: date,
        trade_time: btParseTime(val(r, cTime)),
        symbol: String(val(r, cIdx) || '').toUpperCase().trim(),
        direction: String(val(r, cDir) || '').trim(),
        result: String(val(r, cRes) || '').trim().toUpperCase(),
        profit_r: profitR,
        max_rr: cMax >= 0 ? btNum(val(r, cMax)) : null,
        smt: String(val(r, cSmt) || '').trim(),
        poi: String(val(r, cPoi) || '').trim(),
        ifvg_tf: String(val(r, cIfvg) || '').trim(),
        sl_ticks: cSl >= 0 ? btNum(val(r, cSl)) : null,
        news: '',
        chart_link: cImg >= 0 ? link(r, cImg) : '',
        notes: String(val(r, cCmt) || '').trim(),
      });
    }
    return { rows, layout: 'headered' };
  }

  // master layout: A=#, B=time, C=index, D=date, E/F/G=red/orange/yellow news,
  // H=profit R, J=result, K=direction, L=link (sometimes a text note), N=comment
  for (let r = 2; r <= maxR; r++) {
    const date = btParseDate(val(r, 3));
    const profitR = btNum(val(r, 7));
    if (!date || profitR == null) continue;
    const newsCells = [val(r, 4), val(r, 5), val(r, 6)];
    let news = '';
    if (newsCells.some(v => v === 'holiday')) news = 'holiday';
    else if (newsCells[0] != null) news = 'red';
    else if (newsCells[1] != null) news = 'orange';
    else if (newsCells[2] != null) news = 'yellow';
    const lCell = btCellVal(ws, r, 11);
    const lText = lCell && typeof lCell.v === 'string' && lCell.v !== 'link' && !lCell.v.startsWith('http') ? lCell.v : '';
    const notes = [String(val(r, 13) || '').trim(), lText].filter(Boolean).join(' · ');
    rows.push({
      trade_date: date,
      trade_time: btParseTime(val(r, 1)),
      symbol: String(val(r, 2) || '').toUpperCase().trim(),
      direction: String(val(r, 10) || '').trim(),
      result: String(val(r, 9) || '').trim().toUpperCase(),
      profit_r: profitR,
      max_rr: null,
      smt: '', poi: '', ifvg_tf: '', sl_ticks: null,
      news,
      chart_link: link(r, 11),
      notes,
    });
  }
  return { rows, layout: 'master' };
}

function btPreviewImport() {
  const sheetName = document.getElementById('btImportSheet').value;
  const stratEl = document.getElementById('btImportStrategy');
  if (!stratEl.dataset.touched) stratEl.value = sheetName;
  const ws = B.importWb.Sheets[sheetName];
  const out = document.getElementById('btImportPreview');
  try {
    const { rows, layout } = btParseSheet(ws);
    B.importRows = rows;
    if (!rows.length) {
      out.innerHTML = '<span style="color:var(--red);">No trades recognized on this sheet.</span>';
      return;
    }
    const dates = rows.map(x => x.trade_date).sort();
    const dupes = rows.filter(x => BTDB.hasUid(btImportUid(x, stratEl.value.trim()))).length;
    const withLinks = rows.filter(x => x.chart_link).length;
    out.innerHTML = `
      <strong>${rows.length}</strong> trades found (${layout === 'headered' ? 'detail layout with SMT/POI/Max RR' : 'master layout with news columns'})<br>
      ${dates[0]} → ${dates[dates.length - 1]} · ${withLinks} chart links
      ${dupes ? `<br><span style="color:var(--yellow);">${dupes} already imported — they will be skipped</span>` : ''}`;
  } catch (e) {
    B.importRows = [];
    out.innerHTML = `<span style="color:var(--red);">Could not parse: ${esc(e.message)}</span>`;
  }
}

// deterministic uid so re-importing the same sheet never duplicates trades
function btImportUid(row, strategy) {
  return `xl|${strategy}|${row.trade_date}|${row.trade_time}|${row.symbol}|${row.profit_r}|${row.direction}`;
}

function btRunImport() {
  const strategy = document.getElementById('btImportStrategy').value.trim() || document.getElementById('btImportSheet').value;
  if (!B.importRows.length) { alert('Nothing to import.'); return; }
  let added = 0, skipped = 0;
  for (const row of B.importRows) {
    const uid = btImportUid(row, strategy);
    if (BTDB.hasUid(uid)) { skipped++; continue; }
    BTDB.addTrade({ ...row, strategy_name: strategy }, uid);
    added++;
  }
  closeModal('btImportBackdrop');
  loadBT();
  scheduleSync();
  alert(`Imported ${added} trades into "${strategy}"${skipped ? ` (${skipped} duplicates skipped)` : ''}.`);
  location.hash = '#bt-trades';
  renderRoute();
}
