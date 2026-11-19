# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/iosai2035/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/iosai2035/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar: every protocol in the DefiLlama snapshot that records no token, ranked by implied value, with a farm plan for each one.

## What it is

The snapshot is sealed: 758 protocols with at least $5M of TVL, as of 2026-11-14. This entry scores every protocol in it that records no token and is not a derivative of one that trades. That is **225 rows**: the 40-protocol watchlist as the floor, plus 185 early candidates below it — each one scored by the same model, and none hand-picked.

## The model (radar-2)

Implied value is a comparable-analysis estimate: what would the market pay for a token governing this much capital, at the multiple the market already pays for the same kind of protocol?

```
implied = round( tvl_usd x multiple x (1 + clamp(change_7d, -40, 80) / 100 x 0.6)
                 x (0.7 + min(age_days, 1095) / 1095 x 0.3)
                 x (1 + 0.03 x min(chains - 1, 5)) )
```

The multiple is calibrated from the snapshot itself: for each category, the median market-cap/TVL of the protocols in it whose token already trades, winsorized to [0.01, 1.0], requiring at least three traded examples — otherwise the market-wide median (0.1689). No protocol name is special-cased. No revenue multiple is claimed: the snapshot carries no fee or revenue figures, so none is invented.

- **Growth** (7-day TVL change) is capped and weighted to move the ranking, never to dominate it — a week of change is mostly price movement.
- **Maturity** rewards a long run with no token: a protocol that held capital for years without issuing one has a larger pent-up launch. Unknown age scores 0.85.
- **Breadth** rewards a protocol live on more chains.

A protocol is a candidate when the snapshot records no token for it (no market cap, no CoinGecko id, no symbol) and it is not a wrapped, staked or bridged product, a versioned pool, or an exchange's own product. Liquid staking and liquid restaking protocols stay in: a staking protocol with no token of its own is a launch candidate. "Records no token" is the snapshot's record, never proof it has none.

## The dashboard

`dashboard/` is a single-page board with no network: the page reads `data.js` and renders the ranked table (sortable, filterable, searchable, paginated), a Fresh view (listed within the last year and growing this week), a Live token view (the traded protocols the multiples come from), and the model itself with its calibration table. Select a row for a slide-over detail: the model broken down factor by factor, the page recomputing the row's implied value and confirming it matches the board, and a seven-step farm plan with a cost and a time for every step.

## Farm plans

Each plan is derived from the protocol's own record — category, chains, TVL and age — and covers the setup, the position, weekly activity, the hold, sybil-safe pacing, the risk check and the claim. Capital scales with TVL ($50–$250) and the hold with age (30–60 days). The expected airdrop pool is shown as 5–15% of implied value, the historical community share.

## Run it

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22, standard library only, no network. The program reads the snapshot, writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into the output directory. It runs twice and writes the same bytes both times.

## Files

- `main.ts` — the program: reads the snapshot, scores it, writes the output.
- `lib/model.ts` — the model: candidates, calibration, implied value, farm plans.
- `dashboard/` — the board: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a detail view and a filtered view.
- `vendor/makefun-board.ts` — the vendored make.fun board library, byte-for-byte from the competition kit.
