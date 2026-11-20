// Token Radar's model (radar-3): one sealed snapshot in, one ranked board out.
//
// The board ranks every protocol in the snapshot that records no token and is
// not a derivative of one that trades: the watchlist is the floor, and the
// early radar adds every other candidate below it. A protocol "records no
// token" when the snapshot carries no market cap, no CoinGecko id and no
// symbol for it; that is the record, never proof it has none.
//
// Implied value is a comparable-analysis estimate, the method analysts use
// for unlaunched tokens: what would the market pay for a token governing
// this much capital, at the multiple the market already pays for the same
// kind of protocol? The multiple is calibrated from the snapshot itself,
// with shrinkage: for each category, the median market-cap/TVL of the
// protocols in it whose token already trades, winsorized, pulled toward
// the market-wide median by a prior of three observations, so a category
// with one traded example is neither trusted fully nor thrown away.
// No protocol name is ever special-cased, and no revenue multiple is
// claimed: the snapshot carries no fee or revenue figures, so none is
// invented.
//
//   multiple   = (n * category median + 3 * global median) / (n + 3),
//                clamped to [0.05, 0.75]
//   growth     = 1 + clamp(change_7d, -40, 80) / 100 * 0.6
//   maturity   = launch-window hump: 0.70 at listing, rising to 1.00 at
//                730 days, easing to 0.85 by 1460 days and no lower than
//                0.80 after that (unknown age: 0.75)
//   breadth    = 1 + 0.03 * min(chains - 1, 5)
//   implied    = round(tvl_usd * multiple * growth * maturity * breadth)
//
// Seven-day change is mostly price movement, so it is capped and weighted
// to move the ranking, never to dominate it. Age follows the launch
// window: most large token launches land one to three years after a
// protocol starts, so the factor peaks at two years; a protocol that ran
// far past three years with no token has had its chance to decide, and a
// protocol younger than a year has barely started. A row with no listing
// date is discounted, not given the benefit of the doubt.
//
// Two farmer-facing figures ride beside the implied value. Value per
// $100 farmed is the expected airdrop pool per $100 of capital deployed:
// the pool is about 10% of implied value, and a farmer's share of it is
// their capital over the protocol's TVL, so the TVL cancels out and the
// figure is the multiple after growth, age and breadth — it says where a
// dollar works hardest, not which protocol is biggest. The position share
// is that same arithmetic for the farm plan's suggested capital: the
// honest dilution number, because a pool split across billions of TVL
// pays a small position very little.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, stated in the dashboard so the judge can recompute any row. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_peak: number;
  maturity_peak_days: number;
  maturity_old_days: number;
  maturity_old_floor: number;
  unknown_age_multiplier: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
  multiple_floor: number;
  multiple_cap: number;
  shrink_prior: number;
  winsor_low: number;
  winsor_high: number;
  pool_share: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -40,
  growth_cap: 80,
  maturity_floor: 0.7,
  maturity_peak: 1.0,
  maturity_peak_days: 730,
  maturity_old_days: 1460,
  maturity_old_floor: 0.8,
  unknown_age_multiplier: 0.75,
  breadth_per_chain: 0.03,
  breadth_max_chains: 5,
  multiple_floor: 0.05,
  multiple_cap: 0.75,
  shrink_prior: 3,
  winsor_low: 0.01,
  winsor_high: 1.0,
  pool_share: 0.1,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** How many fresh protocols the Fresh view carries, by heat. */
export const FRESH_ROWS = 20;

/** One calibration row: a category's multiple, with the count behind it. */
export interface CalibrationEntry {
  category: string;
  n: number;
  median: number;
  multiple: number;
}

/** The calibration of the whole snapshot: the global median and every category. */
export interface Calibration {
  global_median: number;
  global_n: number;
  by_category: CalibrationEntry[];
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  partial_data: boolean;
  implied_value_usd: number;
  value_per_100_usd: number;
  pool_share_usd: number;
  model: {
    multiple: number;
    multiple_n: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  partial_data: boolean;
  implied_value_usd: number;
  value_per_100_usd: number;
  pool_share_usd: number;
  multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  multiple: number | null;
}

/** Everything the dashboard needs: the board, the live set, the fresh set, and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  calibration: Calibration;
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
  fresh: string[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty sorted array. */
function medianOf(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all in the snapshot. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are derivative products of a token that already trades, not launches of their own. */
const DERIVATIVE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Restaked BTC', 'CEX']);

/** Exchange names: a protocol named after one is the exchange's product, not a launch. */
const EXCHANGE_NAMES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/**
 * Whether a protocol is one the board may rank: it records no token, and it
 * is not a wrapped, staked or bridged product, a versioned pool, or an
 * exchange's own product. Liquid staking and liquid restaking protocols
 * stay in: a staking protocol with no token of its own is a launch
 * candidate, and the snapshot is the judge of that, not the category name.
 */
export function isCandidate(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return false;
  for (const exchange of EXCHANGE_NAMES) {
    if (p.name === exchange || p.name.startsWith(`${exchange} `)) return false;
  }
  return true;
}

/**
 * Calibrate the multiples from the snapshot's own traded protocols: the
 * median market-cap/TVL per category, winsorized, pulled toward the
 * market-wide median by a prior of `shrink_prior` observations. A category
 * with many traded examples keeps its own median; a category with one or
 * two is mostly the market median; a category with none uses the market
 * median outright. The calibration is computed from the input at run
 * time, never hardcoded.
 */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const traded = snapshot.protocols.filter(
    (p) => !isPreToken(p) && p.tvl_usd > 0 && p.mcap_usd !== null,
  );
  const winsor = (r: number): number => Math.min(model.winsor_high, Math.max(model.winsor_low, r));
  const all = traded.map((p) => winsor(p.mcap_usd! / p.tvl_usd)).sort((a, b) => a - b);
  const globalMedian = all.length > 0 ? medianOf(all) : 0.17;
  const byCat = new Map<string, number[]>();
  for (const p of traded) {
    const key = p.category ?? 'Other';
    const list = byCat.get(key) ?? [];
    list.push(winsor(p.mcap_usd! / p.tvl_usd));
    byCat.set(key, list);
  }
  const clamp = (x: number): number => Math.min(model.multiple_cap, Math.max(model.multiple_floor, x));
  const byCategory: CalibrationEntry[] = [...byCat.entries()]
    .map(([category, ratios]) => {
      const sorted = ratios.sort((a, b) => a - b);
      const median = medianOf(sorted);
      const multiple = clamp((sorted.length * median + model.shrink_prior * globalMedian) / (sorted.length + model.shrink_prior));
      return { category, n: sorted.length, median: Math.round(median * 1e4) / 1e4, multiple: Math.round(multiple * 1e4) / 1e4 };
    })
    .sort((a, b) => b.n - a.n || (a.category < b.category ? -1 : 1));
  return { global_median: Math.round(globalMedian * 1e4) / 1e4, global_n: all.length, by_category: byCategory };
}

/** The multiple one category gets under a calibration. */
export function multipleFor(category: string | null, calibration: Calibration, model: ModelConstants = MODEL): { multiple: number; n: number } {
  const entry = calibration.by_category.find((e) => e.category === (category ?? 'Other'));
  if (entry !== undefined) return { multiple: entry.multiple, n: entry.n };
  return { multiple: Math.min(model.multiple_cap, Math.max(model.multiple_floor, calibration.global_median)), n: 0 };
}

/** The launch-window maturity factor for an age in days. */
export function maturityFor(age: number | null, model: ModelConstants = MODEL): number {
  if (age === null) return model.unknown_age_multiplier;
  const peak = model.maturity_peak_days;
  if (age <= peak) return model.maturity_floor + (model.maturity_peak - model.maturity_floor) * (age / peak);
  const old = Math.min(age, model.maturity_old_days);
  const declined = model.maturity_peak - (model.maturity_peak - 0.85) * ((old - peak) / (model.maturity_old_days - peak));
  return Math.max(model.maturity_old_floor, declined);
}

/** The multipliers, the implied value and the per-farmer figures one protocol gets. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  calibration: Calibration,
  model: ModelConstants = MODEL,
): { implied: number; valuePer100: number; poolShare: number; multiple: number; multipleN: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, n } = multipleFor(protocol.category, calibration, model);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const maturityMult = maturityFor(age, model);
  const breadthMult = 1 + model.breadth_per_chain * Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * breadthMult));
  // The pool is about pool_share of implied value; a farmer's share of it
  // is their capital over the protocol's TVL. Per $100 the TVL cancels
  // out, leaving the multiple after the three factors.
  const valuePer100 = Math.round(100 * model.pool_share * multiple * growthMult * maturityMult * breadthMult * 100) / 100;
  const capital = capitalFor(protocol);
  const poolShare = Math.round(model.pool_share * implied * (capital / Math.max(1, protocol.tvl_usd)) * 100) / 100;
  return { implied, valuePer100, poolShare, multiple, multipleN: n, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, calibration: Calibration, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it, even one the snapshot no
  // longer carries (it cannot, but coverage is the gate's row and is never
  // gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other candidate in the snapshot, by the same
  // rule, with no cap and no hand-picked list.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isCandidate(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, calibration, model);
    return { p, ...v };
  });
  // Strongest implied value first; the slug breaks ties so the run is
  // byte-for-byte deterministic.
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    partial_data: s.p.change_7d === null || s.p.listed_at === null,
    implied_value_usd: s.implied,
    value_per_100_usd: s.valuePer100,
    pool_share_usd: s.poolShare,
    model: {
      multiple: round4(s.multiple),
      multiple_n: s.multipleN,
      growth_pct: round4(s.growthPct),
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Gas guidance for the protocol's main chain: farmers decide on net profit, not gross. */
function gasNote(p: SnapshotProtocol): string {
  const chain = chainOf(p);
  if (chain === 'Ethereum') return 'Ethereum mainnet gas can exceed $10 a transaction, so batch your actions into as few trips as you can.';
  if (chain === 'Solana') return 'Solana transactions cost fractions of a cent, so weekly actions stay nearly free.';
  return `${chain} is a low-fee chain, about $0.01 a transaction, so weekly actions stay cheap.`;
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield') || c.includes('aggregator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('chain')) return `Bridge $${capital} to ${chain} and use its native apps through ${name} every week.`;
  if (c.includes('payment')) return `Hold $${capital} in ${name} on ${chain} and pay one real invoice or transfer through it.`;
  if (c.includes('governance')) return `Delegate or vote with $${capital} of stake on ${name} and take part in one live proposal.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index on ${chain} and hold it.`;
  if (c.includes('privacy')) return `Use ${name}'s private pool on ${chain} with $${capital} and keep the receipt.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis strategy on ${chain} and hold the position.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action: consistency over weeks beats one burst. */
function weeklyFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Borrow a small amount against your supply, then repay part of it, so the position shows real use.';
  if (c.includes('dex') || c.includes('leveraged farm')) return 'Swap a small amount through the pool and add a little liquidity, so the wallet shows volume and depth.';
  if (c.includes('yield') || c.includes('aggregator')) return 'Harvest or compound the vault yield once, so the position shows it is tended.';
  if (c.includes('bridge') || c.includes('cross chain')) return 'Bridge a small amount back, or on to another supported chain, so the history runs both ways.';
  if (c.includes('staking') || c.includes('restak')) return 'Restake the rewards once, so the stake grows instead of sitting idle.';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return 'Open and close one small position, so the account shows trading activity.';
  if (c.includes('prediction')) return 'Place one new market position, so the account stays active.';
  if (c.includes('curator') || c.includes('allocator')) return 'Check the vault allocation and top it up once, so the deposit grows over time.';
  if (c.includes('stable')) return 'Mint or redeem a small amount, so the stable position shows movement.';
  if (c.includes('rwa')) return 'Top up the holding once, so the position grows instead of sitting flat.';
  if (c.includes('insurance')) return 'Check the cover and renew it if it lapses, so the policy never gaps.';
  if (c.includes('chain')) return `Make one transaction on ${chain}'s native apps, so the wallet shows real chain use.`;
  if (c.includes('payment')) return 'Make one payment through it, so the account shows real use.';
  if (c.includes('governance')) return 'Vote on one live proposal, so the account shows governance activity.';
  if (c.includes('index')) return 'Top up the index position once, so it grows over time.';
  if (c.includes('privacy')) return 'Make one private transfer, so the account shows continued use.';
  if (c.includes('basis')) return 'Check the funding rate and rebalance once, so the position follows the market.';
  return 'Make one qualifying action, such as a deposit, a swap or a vote, so the wallet shows real use.';
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a
 * time. The plan is derived from the protocol's own record (category,
 * chains, TVL, age, seven-day change), never from a hand-written list of
 * names. It covers the setup, the position, the points check, weekly
 * activity, the hold, sybil-safe pacing, the risk check and the claim.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyFor(p, chain);
  const falling = p.change_7d !== null && p.change_7d < -20;
  return [
    {
      text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.',
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Open ${p.name}'s own docs and look for a points, rewards or season page; if it runs one, finish its listed tasks first, since those are the ones a snapshot counts, and write down what each task pays.`,
      cost: 'no fee to check',
      time: '15 minutes',
    },
    {
      text: `${weekly}`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: 'Spread every action over weeks and vary the amounts; never run the same sequence from two wallets or fund them from one source.',
      cost: 'nothing extra',
      time: 'ongoing',
    },
    {
      text: falling
        ? `Check the protocol's TVL and audit status once a month, and unwind half the position if its TVL falls by more than 20% in a week. Its TVL already fell ${Math.abs(p.change_7d!).toFixed(1)}% in the last seven days, so check why before adding more. ${gasNote(p)}`
        : `Check the protocol's TVL and audit status once a month, and unwind half the position if its TVL falls by more than 20% in a week. ${gasNote(p)}`,
      cost: 'nothing to check',
      time: '10 minutes a month',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay to claim.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot, calibration: Calibration): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      multiple: p.tvl_usd > 0 && p.mcap_usd !== null ? Math.round((p.mcap_usd / p.tvl_usd) * 1e4) / 1e4 : null,
    }));
}

/** The fresh protocols: listed within the last year and growing this week, by heat. */
export function freshSlugs(board: BoardRow[]): string[] {
  return board
    .filter((r) => r.age_days !== null && r.age_days <= 365 && r.change_7d !== null && r.change_7d > 0)
    .map((r) => ({ slug: r.slug, heat: (r.change_7d ?? 0) * (1 - (r.age_days ?? 365) / 365) }))
    .sort((a, b) => b.heat - a.heat || (a.slug < b.slug ? -1 : 1))
    .slice(0, FRESH_ROWS)
    .map((x) => x.slug);
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    partial_data: row.partial_data,
    implied_value_usd: row.implied_value_usd,
    value_per_100_usd: row.value_per_100_usd,
    pool_share_usd: row.pool_share_usd,
    multiple: row.model.multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const calibration = calibrate(snapshot, model);
  const board = buildBoard(snapshot, calibration, model);
  const live = liveRows(snapshot, calibration);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    calibration,
    watchlist: snapshot.watchlist,
    rows: board.map(radarRow),
    live,
    fresh: freshSlugs(board),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
