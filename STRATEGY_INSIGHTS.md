# Strategy Analysis — FVG→iFVG + SMT (NY Open)

Analysis of `Backtesting.xlsx` (master sheet: **123 trades, 01.09.2025 → 13.05.2026**, ~3.6
trades/week; detail sheet with SMT/POI/SL metadata: 50 trades Sep–Nov 2025). All numbers in R.

## Headline numbers (master sheet, your actual management)

| Metric | Value |
|---|---|
| Total | **+162.6R** (+1.32R per trade) |
| Win rate (excl. BE) | 79.3% — 92W / 24L / 7BE |
| Avg win / avg loss | +2.03R / −1.00R |
| Max drawdown | only **3R**; worst losing streak 3, best win streak 20 |
| Best / worst month | Apr-26 +2.24R/trade · Oct-25 +0.41R/trade |

A 79% WR with 2:1 average winners and a 3R max drawdown over 9 months is an exceptional
curve — treat it as an upper bound. Backtests entered with hindsight always flatter the
strategy; the live journal (web app) is where this gets confirmed trade by trade.

## SL placement (current focus)

What the data says today:

- **Your stops are structurally sound, not too tight.** Of 23 full losses that have the
  16:15-revisit column filled, only **1** had recovered to profit by 16:15 (13.10.25, would
  have been +2.6R) and 2 to breakeven. 20 of 23 stop-outs stayed losers — wider stops would
  mostly just lose more per trade.
- **BE management is net positive:** of 7 trades moved to breakeven, 1 would have been a full
  loss (10.11.25) and **0** gave up a winner. Keep doing this.
- **Stop sizes** (Sep–Nov sample): ES median 38 ticks (12–78), NQ median 190 ticks (29–347).
  Splitting at the median: tighter-than-median stops on **ES** performed fine (75% WR vs 67%),
  but on **NQ** tight stops underperformed (50% WR vs 65%) — NQ needs its room. Small samples
  (n≈25 per index), so directional hints only.
- **The missing measurement is MAE** (maximum adverse excursion — how close price came to
  your stop before the trade resolved). Without it, nobody can say whether your stops can be
  tightened safely. The new backtesting workspace has an **MAE field** and an **SL
  Optimizer**: it replays every trade with the stop at 50–100% of its real distance — same
  exit prices, smaller risk per trade, so survivors pay `R / f` — and shows the total-R curve
  plus how many winners each tightening level would kill, and your winners' MAE percentiles
  (e.g. "90% of winners never drew down past 0.6R" → ~40% of stop distance was never used).

**Action:** log MAE on every backtest (and ideally live) trade from now on — in ticks ÷ stop
size, so 0.45 means price came 45% of the way to your stop. After ~30 trades the SL Optimizer
becomes statistically meaningful.

## Entry-time drift (your observation about 16:20–16:40)

The data says the window is **widening, not moving**:

- Share of entries at/after 16:10 grew from 0% (Sep-25) to 19–31% (Feb–May-26), and the
  latest entry of each month drifted from 16:05 (Sep) to 16:40–16:42 (Mar–Apr). Your
  impression is real — late, high-quality inversions now happen (23–24.04 at 16:30/16:40,
  both winners on "very strong FVG").
- But the early window did **not** get worse — since Feb-26: entries before 16:10 ran
  **+1.94R/trade, 90% WR** (n=41) vs +1.00R/trade, 71% WR (n=15) at/after 16:10.

**Action:** keep 15:40–16:10 as the core window, and extend monitoring to ~16:45 for the
late ES-inversion setups instead of shutting down at 16:15. Any hard "flat at 16:15" rule is
counterproductive now (historically it only added +3.2R across 31 affected trades — noise —
and it would skip the new late setups entirely). The Analytics page has an **Entry Time
Drift** chart to watch this month by month.

## Other edges worth knowing

- **SMT timeframe matters most of all logged confluences:** 1/4hr SMT +1.14R/trade (78.6%
  WR) vs 5/15min SMT +0.72R/trade (60.6% WR), n=50. If a setup only has weak LTF SMT
  ("very little smt" appears on losers), it's a skip or half-size candidate.
- **Red-news days** are still profitable but weaker: +1.09R/trade vs +1.38 on clean days.
  No reason to skip; a size reduction on red days is defensible. Holidays (n=3, 33% WR) are
  the only calendar spot that looks skippable.
- **Friday is your best day** (+1.62R/trade, 87.5% WR); Thursday the weakest (+1.04). Not
  actionable yet, just worth watching.
- **Shorts** slightly outperform longs (+1.48 vs +1.23R/trade); ES has the higher WR
  (84.4%), NQ provides the volume (89 of 123 trades).
- **TP policy** (not the focus, for completeness): your active management (+0.73R/trade on
  the 18 trades that have Max RR logged) beats every fixed-TP replay except 1.5R (+0.81),
  which is within noise. Median winner is 2.0R and only 12% of winners exceed 3R — targets
  beyond ~2.5R don't pay on this setup. Logging **Max RR** again (you stopped after
  September) keeps the TP Optimizer honest.
- **October 2025** (+0.41R/trade, 53% WR) was the one weak month — comments show
  experiments (non-leading-index entries, TP-placement doubts). Worth re-reading those 16
  trades with fresh eyes; the strategy recovered as soon as the rules tightened again.

## Data-quality fixes (already handled by the importer)

- `24.03.36` → imported as 2026-03-24; `14.10.2025` (4-digit year in a 2-digit format) →
  2025-10-14.
- Comments sometimes typed into the link column ("ATH", "2TP's smashed") → merged into notes.
- Max RR stopped being filled after September; MAE never tracked → both have fields now.

## Caveats

- This analysis covers the spreadsheet only — the live `journal.db` on Drive isn't readable
  from the development environment. Once real trades accumulate in the journal workspace,
  compare its analytics against the backtest workspace side by side.
- Several sub-samples are small (news buckets, SL-size splits, late-window-since-Feb n=15).
  Directional conclusions, not certainties.
