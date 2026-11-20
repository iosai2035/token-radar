# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/iosai2035/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/iosai2035/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar: every protocol in the DefiLlama snapshot that records no token, ranked by implied value, with a farm plan for each one — and with the per-farmer economics shown, not hidden.

## What it is

The snapshot is sealed: 758 protocols with at least $5M of TVL, as of 2026-11-14. This entry scores every protocol in it that records no token and is not a derivative of one that trades. That is **225 rows**: the 40-protocol watchlist as the floor, plus 185 early candidates below it — each one scored by the same model, and none hand-picked.

## The model (radar-3)

Implied value is a comparable-analysis estimate: what would the market pay for a token governing this much capital, at the multiple the market already pays for the same kind of protocol?

```
multiple = clamp( (n x category median + 3 x global median) / (n + 3), 0.05, 0.75 )
implied  = round( tvl_usd x multiple x (1 + clamp(change_7d, -40, 80) / 100 x 0.6)
                  x maturity(age) x (1 + 0.03 x min(chains - 1, 5)) )
maturity(age) = 0.7 + 0.3 x age / 730          (age <= 730 days)
              = 1.0 - 0.15 x (age - 730) / 730 (age > 730 days, floor 0.80)
```

Three changes over radar-2, each from the snapshot's own figures:

- **Shrunk multiples.** The multiple is the category median pulled toward the market-wide median (0.1689) by a prior of three observations. A category with one traded example is neither trusted fully nor thrown away — radar-2's hard "three examples or the global median" rule discarded a Risk Curators median of 1.0 from a single traded protocol and left the top four rows sharing one multiple.
- **The launch window.** Maturity now peaks at two years instead of rising forever: most large token launches land one to three years after a protocol starts, a protocol far past that with no token has had its chance to decide, and one younger than a year has barely started. A missing listing date is discounted to 0.75, not given the benefit of the doubt.
- **Value per $100 farmed.** The airdrop pool runs about 10% of implied value, and a farmer's share of it is their capital over the protocol's TVL — so per $100 the TVL cancels out and the figure is the multiple after growth, age and breadth. It says where a dollar works hardest, not which protocol is biggest. The detail view also shows the suggested position's share of the 10% pool: the honest dilution number.

No protocol name is special-cased. No revenue multiple is claimed: the snapshot carries no fee or revenue figures, so none is invented.

A protocol is a candidate when the snapshot records no token for it (no market cap, no CoinGecko id, no symbol) and it is not a wrapped, staked or bridged product, a versioned pool, or an exchange's own product. Liquid staking and liquid restaking protocols stay in: a staking protocol with no token of its own is a launch candidate. "Records no token" is the snapshot's record, never proof it has none.

## The dashboard

`dashboard/` is a single-page board with no network: the page reads `data.js` and renders the ranked table (sortable — including by value per $100 — filterable by category, chain and watchlist-only, searchable, paginated), a Fresh view (listed within the last year and growing this week), a Live token view (the traded protocols the multiples come from), and the model itself with its calibration table. Select a row for a slide-over detail: the model broken down factor by factor, the value per $100 and the position's pool share, the page recomputing the row's implied value and confirming it matches the board, and an eight-step farm plan with a cost and a time for every step.

## Farm plans

Each plan is derived from the protocol's own record — category, chains, TVL, age and seven-day change — and covers the setup, the position, the points-program check, weekly activity, the hold, sybil-safe pacing, the risk check and the claim. Capital scales with TVL ($50–$250) and the hold with age (30–60 days); the risk step names the protocol's own seven-day fall when it dropped more than 20%. The expected airdrop pool is shown as 5–15% of implied value, the historical community share, with the position's share of it beside it.

## Run it

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22, standard library only, no network. The program reads the snapshot, writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into the output directory. It runs twice and writes the same bytes both times.

## Files

- `main.ts` — the program: reads the snapshot, scores it, writes the output.
- `lib/model.ts` — the model: candidates, shrinkage calibration, implied value, per-farmer figures, farm plans.
- `dashboard/` — the board: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a detail view and a filtered view.
- `vendor/makefun-board.ts` — the vendored make.fun board library, byte-for-byte from the competition kit.

Entered on make.fun/?ref=57z043hx — a $1,325 bounty for the best token launch radar.
