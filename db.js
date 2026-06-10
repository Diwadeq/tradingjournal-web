// SQLite (sql.js / WASM) layer — mirrors the iOS app's DatabaseManager exactly:
// same schema, same uid/updated_at semantics, same union-merge with tombstones,
// so web edits and iPhone edits never overwrite each other.
const DB = {
  SQL: null,
  db: null,

  TRADE_COLS: 'uid, created_at, updated_at, trade_date, trade_time, entry_type, title, symbol, direction, outcome, net_pnl, risk_amount, net_r, account_name, confluences, market_condition, market_catalyst, fits_plan, notes, chart_links',

  async ensureSQL() {
    if (!this.SQL) {
      this.SQL = await initSqlJs({
        locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/${f}`,
      });
    }
  },

  async init(bytes) {
    await this.ensureSQL();
    this.db = bytes ? new this.SQL.Database(bytes) : new this.SQL.Database();
    this.migrate(this.db);
  },

  // Same tables + migrations as iOS DatabaseManager.createTables()/migrate()
  migrate(d) {
    d.run(`CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      balance REAL DEFAULT 0,
      equity REAL DEFAULT 0,
      acc_type TEXT DEFAULT 'Demo',
      target_pct REAL DEFAULT 0,
      created_at TEXT DEFAULT (date('now'))
    );`);
    d.run(`CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT '',
      trade_date TEXT NOT NULL,
      trade_time TEXT DEFAULT '',
      entry_type TEXT DEFAULT 'trade',
      title TEXT DEFAULT 'New Trade',
      symbol TEXT DEFAULT '',
      direction TEXT DEFAULT '',
      outcome TEXT DEFAULT '',
      net_pnl REAL,
      risk_amount REAL,
      net_r REAL,
      account_name TEXT DEFAULT '',
      confluences TEXT DEFAULT '[]',
      market_condition TEXT DEFAULT '',
      market_catalyst TEXT DEFAULT '',
      fits_plan INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      chart_links TEXT DEFAULT '[]'
    );`);
    d.run(`CREATE TABLE IF NOT EXISTS tombstones (uid TEXT PRIMARY KEY, deleted_at TEXT);`);
    this.tryRun(d, "ALTER TABLE trades ADD COLUMN uid TEXT");
    // deterministic uid backfill — identical formula to iOS so merges dedupe
    d.run("UPDATE trades SET uid = created_at || '|' || trade_date || '|' || trade_time || '|' || COALESCE(symbol,'') WHERE uid IS NULL OR uid = ''");
    this.tryRun(d, "ALTER TABLE trades ADD COLUMN updated_at TEXT");
    d.run("UPDATE trades SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''");
    this.tryRun(d, "ALTER TABLE trades ADD COLUMN chart_links TEXT DEFAULT '[]'");
    this.tryRun(d, "ALTER TABLE accounts ADD COLUMN target_pct REAL DEFAULT 0");
  },

  tryRun(d, sql) { try { d.run(sql); } catch (e) { /* column exists */ } },

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

  // ── Union-merge a remote journal.db (mirrors iOS mergeRemoteDatabase) ──────
  merge(remoteBytes) {
    let r;
    try { r = new this.SQL.Database(remoteBytes); } catch (e) { return; }
    try {
      this.migrate(r); // bring remote copy up to schema + backfill uids
      const rq = (sql) => {
        const out = [];
        try {
          const s = r.prepare(sql);
          while (s.step()) out.push(s.getAsObject());
          s.free();
        } catch (e) { /* table may not exist */ }
        return out;
      };

      // tombstones: union, used below to drop deleted trades
      for (const t of rq("SELECT uid, deleted_at FROM tombstones WHERE uid IS NOT NULL AND uid != ''")) {
        this.run("INSERT OR IGNORE INTO tombstones (uid, deleted_at) VALUES (?, ?)", [t.uid, t.deleted_at || '']);
      }

      // accounts: insert remote accounts missing locally (keyed by name)
      const localNames = new Set(this.q("SELECT name FROM accounts").map(a => a.name));
      for (const a of rq("SELECT name, balance, equity, acc_type, target_pct, created_at FROM accounts")) {
        if (!localNames.has(a.name)) {
          this.run("INSERT INTO accounts (name, balance, equity, acc_type, target_pct, created_at) VALUES (?,?,?,?,?,?)",
            [a.name, a.balance || 0, a.equity || 0, a.acc_type || 'Demo', a.target_pct || 0, a.created_at || '']);
        }
      }

      // trades: union by uid, last-writer-wins on updated_at
      const localUpdated = {};
      for (const t of this.q("SELECT uid, updated_at FROM trades")) localUpdated[t.uid] = t.updated_at || '';
      for (const t of rq(`SELECT ${this.TRADE_COLS} FROM trades`)) {
        if (!t.uid) continue;
        const lu = localUpdated[t.uid];
        if (lu === undefined) {
          this.insertTradeRow(t);
        } else if ((t.updated_at || '') > lu) {
          this.run("DELETE FROM trades WHERE uid = ?", [t.uid]);
          this.insertTradeRow(t);
        }
      }

      // propagate deletions
      this.run("DELETE FROM trades WHERE uid IN (SELECT uid FROM tombstones WHERE uid != '')");
    } finally {
      r.close();
    }
  },

  insertTradeRow(t) {
    this.run(`INSERT INTO trades (${this.TRADE_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      t.uid, t.created_at || '', t.updated_at || '', t.trade_date || '', t.trade_time || '',
      t.entry_type || 'trade', t.title || '', t.symbol || '', t.direction || '', t.outcome || '',
      t.net_pnl ?? null, t.risk_amount ?? null, t.net_r ?? null, t.account_name || '',
      t.confluences || '[]', t.market_condition || '', t.market_catalyst || '',
      t.fits_plan ? 1 : 0, t.notes || '', t.chart_links || '[]',
    ]);
  },

  // ── Trades ─────────────────────────────────────────────────────────────────
  parseTrade(t) {
    const safe = (s) => { try { return JSON.parse(s || '[]'); } catch (e) { return []; } };
    return { ...t, confluences: safe(t.confluences), chart_links: safe(t.chart_links), fits_plan: !!t.fits_plan };
  },

  allTrades() {
    return this.q("SELECT * FROM trades ORDER BY trade_date DESC, trade_time DESC, created_at DESC")
      .map(t => this.parseTrade(t));
  },

  addTrade(t) {
    this.run(`INSERT INTO trades (uid, created_at, updated_at, trade_date, trade_time, entry_type, title, symbol, direction, outcome, net_pnl, risk_amount, net_r, account_name, confluences, market_condition, market_catalyst, fits_plan, notes, chart_links)
      VALUES (?, datetime('now'), datetime('now'), ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      crypto.randomUUID(),
      t.trade_date, t.trade_time || '', t.entry_type || 'trade', t.title || 'New Trade',
      t.symbol || '', t.direction || '', t.outcome || '',
      t.net_pnl ?? null, t.risk_amount ?? null, t.net_r ?? null,
      t.account_name || '', JSON.stringify(t.confluences || []),
      t.market_condition || '', t.market_catalyst || '',
      t.fits_plan ? 1 : 0, t.notes || '', JSON.stringify(t.chart_links || []),
    ]);
  },

  updateTrade(id, t) {
    this.run(`UPDATE trades SET trade_date=?, trade_time=?, entry_type=?, title=?, symbol=?, direction=?, outcome=?, net_pnl=?, risk_amount=?, net_r=?, account_name=?, confluences=?, market_condition=?, market_catalyst=?, fits_plan=?, notes=?, chart_links=?, updated_at=datetime('now') WHERE id=?`, [
      t.trade_date, t.trade_time || '', t.entry_type || 'trade', t.title || 'New Trade',
      t.symbol || '', t.direction || '', t.outcome || '',
      t.net_pnl ?? null, t.risk_amount ?? null, t.net_r ?? null,
      t.account_name || '', JSON.stringify(t.confluences || []),
      t.market_condition || '', t.market_catalyst || '',
      t.fits_plan ? 1 : 0, t.notes || '', JSON.stringify(t.chart_links || []),
      id,
    ]);
  },

  deleteTrade(id) {
    // tombstone first so the deletion reaches the iPhone on its next sync
    this.run("INSERT OR IGNORE INTO tombstones (uid, deleted_at) SELECT uid, datetime('now') FROM trades WHERE id = ? AND uid IS NOT NULL AND uid != ''", [id]);
    this.run("DELETE FROM trades WHERE id = ?", [id]);
  },

  // ── Accounts ───────────────────────────────────────────────────────────────
  allAccounts() {
    return this.q("SELECT * FROM accounts ORDER BY name ASC");
  },

  addAccount(a) {
    this.run("INSERT INTO accounts (name, balance, equity, acc_type, target_pct) VALUES (?,?,?,?,?)",
      [a.name, a.balance || 0, a.equity || 0, a.acc_type || 'Demo', a.target_pct || 0]);
  },

  updateAccountEquity(id, equity) {
    this.run("UPDATE accounts SET equity=? WHERE id=?", [equity, id]);
  },

  deleteAccount(id) {
    this.run("DELETE FROM accounts WHERE id=?", [id]);
  },
};
