# Trading Journal — Web

A static web version of the Trading Journal that reads and writes the **same
`journal.db`** the iPhone app syncs to Google Drive (`TradingJournalSync/journal.db`).
Edits made here merge losslessly with edits made on the iPhone: trades are
unioned by `uid`, edits use last-writer-wins on `updated_at`, and deletions
propagate via tombstones — exactly the same algorithm as the iOS app.

No server, no backend — everything runs in the browser (SQLite via sql.js WASM,
Google Drive REST API, Chart.js). Host it anywhere static files can live
(GitHub Pages, Netlify, etc.) and use it from any browser in the world.

## Two workspaces: Real Journal & Backtesting

Right after Google sign-in you choose a workspace (and can switch any time via
the pill in the top-left corner, or from the Accounts / Strategies pages):

- **Real Journal** — the live journal, synced with the iPhone app
  (`journal.db`, untouched behavior).
- **Backtesting** — a separate strategy lab stored in its own
  `TradingJournalSync/backtest.db`, so practice data can never mix with real
  trades. R-based stats per strategy variant, breakdown analytics (entry time,
  SMT / POI / iFVG, news days, SL size, day-of-week…), an **Entry Time Drift**
  chart, a **TP Optimizer** (replays trades with fixed take-profits using the
  logged *Max RR*), an **SL Optimizer** (replays trades with tightened stops
  using the logged *MAE*), and an **Excel importer** that understands the
  `Backtesting.xlsx` workbook layouts (both the detail sheets with headers and
  the master sheet with red/orange/yellow news columns), including TradingView
  screenshot links. Re-importing the same sheet never duplicates trades.

See `STRATEGY_INSIGHTS.md` for the data analysis that shaped these tools.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell: login screen, workspace chooser, tab bars, modals, CDN script tags |
| `style.css` | Dark theme (same design as the iOS/Flask versions) |
| `config.js` | **Your OAuth client ID goes here** |
| `db.js` | SQLite layer — schema, migrations, union-merge (mirrors iOS `DatabaseManager`) |
| `drive.js` | Google Drive layer — OAuth token, find/download/upload the DB files |
| `app.js` | The journal SPA: dashboard/calendar, trades, add/edit form, analytics, accounts |
| `bt.js` | The backtesting SPA: strategies, R-stats, SL/TP optimizers, Excel import (`backtest.db`) |

## Setup (one-time)

### 1. Create a Web OAuth client — in the SAME Google Cloud project as the iOS app

This is critical: the `drive.file` scope only lets an app see files created by
**the same Google Cloud project**. The iOS app's client is
`528474867568-….apps.googleusercontent.com`, so the web client must live in
that project too, or the web app won't be able to find the iPhone's `journal.db`.

1. Go to <https://console.cloud.google.com/apis/credentials> and make sure the
   project selector (top bar) shows the project that contains the iOS client
   starting with `528474867568-`.
2. **Create Credentials → OAuth client ID → Web application.**
3. Under **Authorized JavaScript origins** add your hosting URL, e.g.
   `https://<your-username>.github.io` (no path, no trailing slash).
   For local testing also add `http://localhost:8000`.
4. Copy the new client ID and paste it into `config.js`:

```js
CLIENT_ID: '528474867568-xxxxxxxx.apps.googleusercontent.com',
```

No client secret is needed (browser-only token flow).

### 2. Host the folder

Any static host works. With GitHub Pages:

```bash
cd TradingJournal-Web
git init && git add -A && git commit -m "Trading Journal web app"
gh repo create tradingjournal-web --public --source . --push
gh api repos/{owner}/tradingjournal-web/pages -X POST \
  -f "source[branch]=main" -f "source[path]=/"
```

Then the app lives at `https://<your-username>.github.io/tradingjournal-web/`.

### Local testing

```bash
cd TradingJournal-Web
python3 -m http.server 8000
# open http://localhost:8000  (origin must be listed in the OAuth client)
```

Opening `index.html` directly as a `file://` URL will NOT work — Google
sign-in requires an http(s) origin.

## How sync works

- **Sign-in** → download remote `journal.db` → open it in-memory (sql.js).
- **Every edit** (add/edit/delete trade, account change) is written locally,
  then a sync is scheduled ~1.2 s later.
- **Sync** = download the latest remote DB → union-merge into the local copy
  (trades by `uid`, last-writer-wins on `updated_at`, tombstones for deletes,
  accounts by name) → upload the merged DB back. The pill at the top right
  shows sync state; tap it to sync manually.
- Access tokens last ~1 hour and refresh silently; if Google requires it,
  you'll see the consent popup again.

## Safety notes

- The iOS/Mac apps are untouched — this web app only follows the same protocol.
- Downloads are validated against the SQLite magic header before being opened,
  so a bad response can never corrupt your journal.
- The DB only ever lives in memory in the browser tab + on your Google Drive.
