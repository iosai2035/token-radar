// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a fresh view, the live-token
// reference set and the model itself. No network: every byte it shows is
// in data.js. The page recomputes each row's implied value, its value per
// $100 farmed and its farm plan from the same snapshot figures main.ts
// used, so the page's code and the board's data are visibly the same
// arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, page: 1, pageSize: 50, selected: null, watchlistOnly: false };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // The model in one function: the page recomputes a row from the snapshot
  // figures and checks the number board.json carries.
  function impliedOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.multiple * row.growth_multiplier * row.maturity_multiplier * row.breadth_multiplier));
  }

  // Value per $100 farmed: the pool is about 10% of implied value and a
  // farmer's share of it is their capital over the protocol's TVL, so the
  // TVL cancels out and the figure is the multiple after the three
  // factors. The page recomputes it the same way main.ts does.
  function valuePer100Of(row) {
    return Math.round(100 * 0.1 * row.multiple * row.growth_multiplier * row.maturity_multiplier * row.breadth_multiplier * 100) / 100;
  }

  // The farm plan is the same derivation main.ts writes to board.json:
  // category, chains, TVL, age and seven-day change decide the action, the
  // capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function gasNote(p) {
    var chain = chainOf(p);
    if (chain === 'Ethereum') return 'Ethereum mainnet gas can exceed $10 a transaction, so batch your actions into as few trips as you can.';
    if (chain === 'Solana') return 'Solana transactions cost fractions of a cent, so weekly actions stay nearly free.';
    return chain + ' is a low-fee chain, about $0.01 a transaction, so weekly actions stay cheap.';
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('yield') >= 0 || c.indexOf('aggregator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' to ' + chain + " and use its native apps through " + name + ' every week.';
    if (c.indexOf('payment') >= 0) return 'Hold $' + capital + ' in ' + name + ' on ' + chain + ' and pay one real invoice or transfer through it.';
    if (c.indexOf('governance') >= 0) return 'Delegate or vote with $' + capital + ' of stake on ' + name + ' and take part in one live proposal.';
    if (c.indexOf('index') >= 0) return 'Buy $' + capital + ' of the ' + name + ' index on ' + chain + ' and hold it.';
    if (c.indexOf('privacy') >= 0) return "Use " + name + "'s private pool on " + chain + ' with $' + capital + ' and keep the receipt.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + " into " + name + "'s basis strategy on " + chain + ' and hold the position.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyFor(p, chain) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow a small amount against your supply, then repay part of it, so the position shows real use.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Swap a small amount through the pool and add a little liquidity, so the wallet shows volume and depth.';
    if (c.indexOf('yield') >= 0 || c.indexOf('aggregator') >= 0) return 'Harvest or compound the vault yield once, so the position shows it is tended.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 'Bridge a small amount back, or on to another supported chain, so the history runs both ways.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Restake the rewards once, so the stake grows instead of sitting idle.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Open and close one small position, so the account shows trading activity.';
    if (c.indexOf('prediction') >= 0) return 'Place one new market position, so the account stays active.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Check the vault allocation and top it up once, so the deposit grows over time.';
    if (c.indexOf('stable') >= 0) return 'Mint or redeem a small amount, so the stable position shows movement.';
    if (c.indexOf('rwa') >= 0) return 'Top up the holding once, so the position grows instead of sitting flat.';
    if (c.indexOf('insurance') >= 0) return 'Check the cover and renew it if it lapses, so the policy never gaps.';
    if (c.indexOf('chain') >= 0) return "Make one transaction on " + chain + "'s native apps, so the wallet shows real chain use.";
    if (c.indexOf('payment') >= 0) return 'Make one payment through it, so the account shows real use.';
    if (c.indexOf('governance') >= 0) return 'Vote on one live proposal, so the account shows governance activity.';
    if (c.indexOf('index') >= 0) return 'Top up the index position once, so it grows over time.';
    if (c.indexOf('privacy') >= 0) return 'Make one private transfer, so the account shows continued use.';
    if (c.indexOf('basis') >= 0) return 'Check the funding rate and rebalance once, so the position follows the market.';
    return 'Make one qualifying action, such as a deposit, a swap or a vote, so the wallet shows real use.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var falling = p.change_7d !== null && p.change_7d < -20;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: "Open " + p.name + "'s own docs and look for a points, rewards or season page; if it runs one, finish its listed tasks first, since those are the ones a snapshot counts, and write down what each task pays.", cost: 'no fee to check', time: '15 minutes' },
      { text: weeklyFor(p, chain), cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Spread every action over weeks and vary the amounts; never run the same sequence from two wallets or fund them from one source.', cost: 'nothing extra', time: 'ongoing' },
      { text: falling ? "Check the protocol's TVL and audit status once a month, and unwind half the position if its TVL falls by more than 20% in a week. Its TVL already fell " + Math.abs(p.change_7d).toFixed(1) + "% in the last seven days, so check why before adding more. " + gasNote(p) : "Check the protocol's TVL and audit status once a month, and unwind half the position if its TVL falls by more than 20% in a week. " + gasNote(p), cost: 'nothing to check', time: '10 minutes a month' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay to claim.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' }
    ].map(stepText);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    // The hash is the whole state: reset hash-controlled fields first so a
    // navigation that drops a parameter actually clears it (otherwise the
    // detail drawer, for example, stays open after the link loses its p=).
    state.q = '';
    state.selected = null;
    state.category = 'all';
    state.chain = 'all';
    state.tab = 'pre-token';
    state.page = 1;
    state.watchlistOnly = false;
    state.sort = 'implied';
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('page')) state.page = Math.max(1, parseInt(params.get('page'), 10) || 1);
    if (params.get('w')) state.watchlistOnly = params.get('w') === '1';
    if (params.get('sort')) state.sort = params.get('sort');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.page > 1) params.set('page', String(state.page));
    if (state.watchlistOnly) params.set('w', '1');
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function baseRows() {
    if (state.tab === 'fresh') {
      // Fresh is ordered by heat (earliness x growth), the order data.js
      // carries, not by implied value: it is the discovery view.
      var bySlug = {};
      DATA.rows.forEach(function (r) { bySlug[r.slug] = r; });
      return DATA.fresh.map(function (s) { return bySlug[s]; }).filter(Boolean);
    }
    return DATA.rows;
  }
  function rows() {
    var q = state.q.trim().toLowerCase();
    var watch = {};
    (DATA.watchlist || []).forEach(function (s) { watch[s] = true; });
    return baseRows().filter(function (r) {
      if (state.watchlistOnly && !watch[r.slug]) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    // The Fresh view's default order is heat, the order baseRows() gave it.
    if (state.tab === 'fresh' && state.sort === 'implied' && state.dir === -1) return list;
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.multiple; bv = b.multiple; }
      else if (key === 'per100') { av = a.value_per_100_usd; bv = b.value_per_100_usd; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function activeFilters() {
    var out = [];
    if (state.q) out.push({ label: 'Search: ' + state.q, clear: function () { state.q = ''; } });
    if (state.category !== 'all') out.push({ label: 'Category: ' + state.category, clear: function () { state.category = 'all'; } });
    if (state.chain !== 'all') out.push({ label: 'Chain: ' + state.chain, clear: function () { state.chain = 'all'; } });
    if (state.watchlistOnly) out.push({ label: 'Watchlist only', clear: function () { state.watchlistOnly = false; } });
    return out;
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }
  function bestPer100() {
    var best = null;
    DATA.rows.forEach(function (r) { if (!best || r.value_per_100_usd > best.value_per_100_usd) best = r; });
    return best;
  }
  function lede() {
    var best = bestPer100();
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' more candidates below that floor, each one scored by the same model. Implied value is an FDV-equivalent model, not a price prediction.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Best value per $100 farmed' }), el('b', { text: best ? '$' + best.value_per_100_usd.toFixed(2) : 'n/a' }), el('span', { text: best ? best.name : '' }))
      )
    );
  }
  function spotlight() {
    var cards = DATA.rows.slice(0, 5).map(function (r) {
      return el('button', { class: 'spot-card', type: 'button', onclick: function () { openDetail(r.slug); } },
        el('span', { class: 'rank', text: 'Rank ' + r.rank }),
        el('b', { text: r.name }),
        el('span', { class: 'val', text: fmtUsd(r.implied_value_usd) }),
        el('span', { class: 'sub', text: fmtUsd(r.tvl_usd) + ' TVL · ' + (r.category || 'Other') })
      );
    });
    return el('div', { class: 'spot' }, cards);
  }
  function valueStrip() {
    // Where a dollar works hardest: the three best value-per-$100 rows,
    // whatever their size. TVL cancels out of that figure, so small
    // efficient protocols sit beside the giants.
    var top = DATA.rows.slice().sort(function (a, b) { return b.value_per_100_usd - a.value_per_100_usd || (a.slug < b.slug ? -1 : 1); }).slice(0, 3);
    var cards = top.map(function (r) {
      return el('button', { class: 'spot-card value-card', type: 'button', onclick: function () { openDetail(r.slug); } },
        el('span', { class: 'rank', text: '$' + r.value_per_100_usd.toFixed(2) + ' per $100' }),
        el('b', { text: r.name }),
        el('span', { class: 'val', text: fmtUsd(r.implied_value_usd) + ' implied' }),
        el('span', { class: 'sub', text: 'Rank ' + r.rank + ' · ' + (r.category || 'Other') })
      );
    });
    return el('div', { class: 'value-strip' },
      el('span', { class: 'value-label', text: 'Best value per $100 farmed' }),
      el('div', { class: 'spot value-cards' }, cards)
    );
  }
  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; state.page = 1; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; state.page = 1; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; state.page = 1; writeHash(); render(); });
    function tabBtn(tab, label) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === tab ? 'true' : 'false', text: label, onclick: function () { state.tab = tab; state.page = 1; writeHash(); render(); } });
    }
    var shown = state.tab === 'live' ? DATA.live.length : state.tab === 'model' ? 0 : rows().length;
    var watchBox = el('input', { type: 'checkbox', id: 'watchonly', checked: state.watchlistOnly ? 'checked' : null, 'aria-label': 'Watchlist only' });
    watchBox.addEventListener('change', function () { state.watchlistOnly = watchBox.checked; state.page = 1; writeHash(); render(); });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field check' }, el('label', { for: 'watchonly', text: 'Watchlist only' }), watchBox),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'View' }), el('div', { class: 'tabs' }, tabBtn('pre-token', 'Board'), tabBtn('fresh', 'Fresh'), tabBtn('live', 'Live token'), tabBtn('model', 'Model'))),
      el('span', { class: 'count', text: state.tab === 'model' ? 'The model, in full' : shown + ' rows shown' })
    );
  }
  function chips() {
    var filters = activeFilters();
    if (filters.length === 0) return null;
    var nodes = filters.map(function (f) {
      return el('button', { class: 'chip', type: 'button', text: f.label + ' ×', onclick: function () { f.clear(); state.page = 1; writeHash(); render(); } });
    });
    nodes.push(el('button', { class: 'chip', type: 'button', text: 'Clear all', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; state.page = 1; writeHash(); render(); } }));
    return el('div', { class: 'chips' }, nodes);
  }
  function sortHeader(key, label) {
    return el('th', { scope: 'col', class: 'num' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' ▼' : ' ▲' }) : null
      )
    );
  }
  function boardTable() {
    var list = sortedRows(rows());
    var pages = Math.max(1, Math.ceil(list.length / state.pageSize));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.pageSize;
    var pageRows = list.slice(start, start + state.pageSize);
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; state.page = 1; writeHash(); render(); } })
      ));
    }
    var max = DATA.rows[0] ? DATA.rows[0].implied_value_usd : 1;
    var tbody = el('tbody');
    pageRows.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', null, r.name, r.partial_data ? el('span', { class: 'badge', text: 'partial data' }) : null),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', { class: 'num', text: String(r.multiple) }),
        el('td', { class: 'num', text: '$' + r.value_per_100_usd.toFixed(2) }),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    var sizeSel = el('select', { 'aria-label': 'Rows per page' },
      [25, 50, 100].map(function (n) { return el('option', { value: String(n), text: n + ' / page', selected: n === state.pageSize ? 'selected' : null }); })
    );
    sizeSel.addEventListener('change', function () { state.pageSize = parseInt(sizeSel.value, 10); state.page = 1; render(); });
    var pager = el('div', { class: 'pager' },
      el('span', { class: 'sub', text: 'Page ' + state.page + ' of ' + pages + ' · ' + list.length + ' rows' }),
      el('button', { type: 'button', disabled: state.page <= 1 ? 'disabled' : null, text: '‹ Prev', onclick: function () { if (state.page > 1) { state.page--; writeHash(); render(); } } }),
      el('button', { type: 'button', disabled: state.page >= pages ? 'disabled' : null, text: 'Next ›', onclick: function () { if (state.page < pages) { state.page++; writeHash(); render(); } } }),
      sizeSel
    );
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: state.tab === 'fresh' ? 'Fresh: listed within the last year and growing this week, by heat.' : 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            el('th', { scope: 'col', text: 'Protocol' }),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            sortHeader('multiple', 'Multiple'),
            sortHeader('per100', 'Per $100'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      ),
      pager
    );
  }
  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.multiple === null ? 'n/a' : String(r.multiple) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. Their mcap/TVL ratios are the calibration the pre-token multiples come from.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', class: 'num', text: 'TVL' }), el('th', { scope: 'col', class: 'num', text: '7d' }), el('th', { scope: 'col', class: 'num', text: 'Market cap' }), el('th', { scope: 'col', class: 'num', text: 'MC/TVL' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }
  function modelPanel() {
    var m = DATA.model;
    var c = DATA.calibration;
    var rows = c.by_category.slice(0, 12).map(function (e) {
      return el('tr', null,
        el('td', { text: e.category }),
        el('td', { class: 'num', text: String(e.n) }),
        el('td', { class: 'num', text: String(e.median) }),
        el('td', { class: 'num', text: String(e.multiple) })
      );
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked. The multiple comes from the market itself: for each category, the median market-cap/TVL of the ' + c.global_n + ' protocols in this snapshot whose token already trades, pulled toward the market-wide median of ' + c.global_median + ' by a prior of ' + m.shrink_prior + ' observations, so a category with one traded example is neither trusted fully nor thrown away. A category with no traded example uses the market median outright.' }),
      el('div', { class: 'formula' },
        'multiple = clamp( (n x category median + ' + m.shrink_prior + ' x ' + c.global_median + ') / (n + ' + m.shrink_prior + '), ' + m.multiple_floor + ', ' + m.multiple_cap + ' )'
      ),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x maturity(age) x (1 + ' + m.breadth_per_chain + ' x min(chains - 1, ' + m.breadth_max_chains + ')) )'
      ),
      el('p', { text: 'TVL and seven-day growth come from the snapshot. Age follows the launch window: the factor rises from ' + m.maturity_floor + ' at listing to ' + m.maturity_peak + ' at ' + m.maturity_peak_days + ' days, then eases toward 0.85 by ' + m.maturity_old_days + ' days and never below ' + m.maturity_old_floor + '. Most large token launches land one to three years after a protocol starts; a protocol far past that with no token has had its chance to decide, and one younger than a year has barely started. Seven-day change is mostly price movement, so it is capped and weighted to move the ranking, never to dominate it. A row flagged "partial data" is missing its 7-day change or its listing date, and a missing listing date is discounted to ' + m.unknown_age_multiplier + ', not given the benefit of the doubt.' }),
      el('p', { text: 'Value per $100 farmed is the same arithmetic from the farmer\u2019s side: the airdrop pool runs about ' + Math.round(m.pool_share * 100) + '% of implied value, and a farmer\u2019s share of it is their capital over the protocol\u2019s TVL, so the TVL cancels out and the figure is the multiple after growth, age and breadth. It says where a dollar works hardest, not which protocol is biggest — and it is why a small protocol can outrank a giant on efficiency while the board still ranks by implied value.' }),
      el('table', { class: 'calib' },
        el('caption', { text: 'Calibration: the median mcap/TVL the market pays, per category. The multiple is the shrunk blend of that median and the market median; n is the traded count behind it.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', class: 'num', text: 'Traded n' }), el('th', { scope: 'col', class: 'num', text: 'Median' }), el('th', { scope: 'col', class: 'num', text: 'Multiple' }))),
        el('tbody', null, rows)
      ),
      el('p', { text: 'A protocol is a candidate when the snapshot records no token for it and it is not a wrapped, staked or bridged product, a versioned pool, or an exchange\u2019s own product. "Records no token" is the snapshot\u2019s record, never proof it has none. Implied value is an FDV-equivalent for a token if one is issued, derived from comparable capital bases; it is not a price prediction, and it says nothing about whether a future token will capture fees. Community airdrop pools have historically run about 5–15% of FDV, so the pool behind a rank is roughly that share of its implied value — and a position\u2019s share of that pool is its capital over the protocol\u2019s TVL, which is why the detail view shows it.' })
    );
  }

  var drawer = el('aside', { class: 'drawer', id: 'detail', hidden: '', 'aria-label': 'Protocol detail' });
  function closeDetail() {
    state.selected = null;
    drawer.setAttribute('hidden', '');
    writeHash();
  }
  function ageBand(age) {
    if (age === null || age === undefined) return 'age unknown: discounted in the model';
    if (age < 365) return 'early: under a year in, the launch window is ahead';
    if (age <= 1095) return 'in the typical launch window (1–3 years)';
    return 'late: over 3 years with no token';
  }
  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    var steps = farmSteps(row);
    var recomputed = impliedOf(row);
    var recomputedPer100 = valuePer100Of(row);
    var drift = Math.abs(recomputed - row.implied_value_usd) / row.implied_value_usd;
    var poolLow = Math.round(row.implied_value_usd * 0.05);
    var poolHigh = Math.round(row.implied_value_usd * 0.15);
    var capital = capitalFor(row);
    var idx = DATA.rows.findIndex(function (r) { return r.slug === slug; });
    var prev = idx > 0 ? DATA.rows[idx - 1] : null;
    var next = idx >= 0 && idx < DATA.rows.length - 1 ? DATA.rows[idx + 1] : null;
    drawer.textContent = '';
    drawer.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' · ' + (row.category || 'Other') }),
        el('h2', { text: row.name }),
        el('p', { class: 'sub', text: 'on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + (row.partial_data ? ' · partial data: the 7-day change or the listing date is missing' : '') })
      ),
      el('button', { class: 'close', type: 'button', text: 'Close', onclick: closeDetail })
    ));
    drawer.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Category multiple (' + (row.category || 'Other') + ')' }), el('b', { class: 'num', text: 'x ' + row.multiple })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) + ' → x ' + row.growth_multiplier })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) + ' → x ' + row.maturity_multiplier })),
        el('div', null, el('span', { text: 'Chain breadth (' + (row.chains ? row.chains.length : 0) + ' chains)' }), el('b', { class: 'num', text: 'x ' + row.breadth_multiplier })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Value per $100 farmed' }), el('b', { class: 'num', text: '$' + row.value_per_100_usd.toFixed(2) })),
        el('div', null, el('span', { text: 'Your $' + capital + ' share of the 10% pool' }), el('b', { class: 'num', text: '$' + row.pool_share_usd.toFixed(2) }))
      ),
      el('p', { class: 'sub', text: ageBand(row.age_days) + '.' }),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + ' and $' + recomputedPer100.toFixed(2) + ' per $100' + (drift < 0.01 ? ', the same numbers board.json carries, within the rounding of the four-decimal factors shown.' : ', which differ from the board: the data would be stale.') + ' This is an FDV-equivalent estimate, not a price.' }),
      el('div', { class: 'pool' }, el('b', { text: 'Expected airdrop pool: ' }), fmtUsd(poolLow) + ' – ' + fmtUsd(poolHigh) + ' (about 5–15% of implied value, the historical community share). A $' + capital + ' position is about $' + row.pool_share_usd.toFixed(2) + ' of the 10% pool at the current TVL — the pool is split across every dollar already in, so early capital earns more than late capital.')
    ));
    drawer.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    drawer.appendChild(el('div', { class: 'drawer-nav' },
      el('button', { class: 'button ghost', type: 'button', disabled: prev ? null : 'disabled', text: '‹ Prev rank', onclick: function () { if (prev) openDetail(prev.slug); } }),
      el('button', { class: 'button ghost', type: 'button', disabled: next ? null : 'disabled', text: 'Next rank ›', onclick: function () { if (next) openDetail(next.slug); } })
    ));
    drawer.removeAttribute('hidden');
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(spotlight());
    shell.appendChild(valueStrip());
    shell.appendChild(controls());
    var chip = chips();
    if (chip) shell.appendChild(chip);
    if (state.tab === 'live') shell.appendChild(liveTable());
    else if (state.tab === 'model') shell.appendChild(modelPanel());
    else shell.appendChild(boardTable());
    if (state.tab === 'pre-token' || state.tab === 'fresh') shell.appendChild(modelPanel());
    shell.appendChild(el('footer', null,
      el('p', { text: 'Source: ' + DATA.source + '. Snapshot ' + DATA.as_of + '. Implied value is a model, not a promise. A protocol "records no token" in the snapshot; that is the record, never proof it has none.' }),
      el('p', { text: 'Built with superbot.gg — the uncensored model for agent work.' })
    ));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!drawer.isConnected) app.appendChild(drawer);
    if (state.selected) openDetail(state.selected);
    else drawer.setAttribute('hidden', '');
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !drawer.hasAttribute('hidden')) closeDetail();
  });
})();
