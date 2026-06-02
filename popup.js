// =============================================
// Amaysim Number Hunter - v3.0
// Self-contained: creates own session, no tab needed
// =============================================

(function() {
  'use strict';

  // --- State ---
  let sessionId = null;
  let planId = null;
  let allResults = [];
  let historyLog = [];
  let scanning = false;
  let stopRequested = false;
  let currentFilter = 'all';
  let currentSort = 'score';
  let searches = []; // log of each search performed
  let liveScan = null; // the running scan, shown in Recent Searches as "in progress"
  let favourites = []; // saved number entries the user has starred
  let favSet = new Set(); // O(1) lookup for star state

  // Plan to add to cart (amaysim's cheapest)
  const DEFAULT_PLAN = 'unlimited-15gb';
  const CART_URL = `/mobile/cart/${DEFAULT_PLAN}?storeId=website&channel=online&action=shop`;

  // --- T9 keypad mapping ---
  const LETTER_TO_DIGIT = {
    a: '2', b: '2', c: '2',
    d: '3', e: '3', f: '3',
    g: '4', h: '4', i: '4',
    j: '5', k: '5', l: '5',
    m: '6', n: '6', o: '6',
    p: '7', q: '7', r: '7', s: '7',
    t: '8', u: '8', v: '8',
    w: '9', x: '9', y: '9', z: '9'
  };

  function wordToDigits(input) {
    return input.toLowerCase().split('').map(ch => {
      if (/\d/.test(ch)) return ch;
      return LETTER_TO_DIGIT[ch] || '';
    }).join('');
  }

  // --- DOM refs ---
  const $ = id => document.getElementById(id);
  const statusBar = document.querySelector('.status-bar');
  const statusDot = $('statusDot');
  const statusText = $('statusText');
  const planInfo = $('planInfo');
  const searchInput = $('searchInput');
  const searchBtn = $('searchBtn');
  const searchResults = $('searchResults');
  const convertedHint = $('convertedHint');
  const connectBox = $('connectBox');
  const scanProgress = $('scanProgress');
  const progressFill = $('progressFill');
  const progressText = $('progressText');
  const stopScanBtn = $('stopScan');
  const resultsList = $('resultsList');
  const resultsCount = $('resultsCount');

  // --- Tab management ---
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'results') renderResults();
      if (tab.dataset.tab === 'searches') renderSearches();
    });
  });

  // --- Filter buttons ---
  document.querySelectorAll('.filter-row .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-row .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderResults();
    });
  });

  // --- Show live conversion hint as user types ---
  searchInput.addEventListener('input', () => {
    const raw = searchInput.value.trim();
    if (!raw) { convertedHint.style.display = 'none'; return; }
    const hasLetters = /[a-zA-Z]/.test(raw);
    if (hasLetters) {
      const digits = wordToDigits(raw);
      convertedHint.textContent = `"${raw.toUpperCase()}" → ${digits}`;
      convertedHint.style.display = 'block';
    } else {
      convertedHint.style.display = 'none';
    }
  });

  // --- API via background script ---
  function apiCall(payload, sid) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'API_CALL', sessionId: sid || sessionId, payload },
        resp => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (resp?.error) reject(new Error(resp.error));
          else resolve(resp.data);
        }
      );
    });
  }

  // --- Pattern detection helpers ---
  // AABBCCDD: 4 consecutive pairs with 4 distinct digits (e.g. 11223344)
  function hasAABBCCDD(d) {
    const m = d.match(/(\d)\1(\d)\2(\d)\3(\d)\4/);
    return !!m && new Set([m[1], m[2], m[3], m[4]]).size === 4;
  }
  // AABBCC: 3 consecutive pairs with 3 distinct digits (e.g. 112233)
  function hasAABBCC(d) {
    const m = d.match(/(\d)\1(\d)\2(\d)\3/);
    return !!m && m[1] !== m[2] && m[2] !== m[3] && m[1] !== m[3];
  }
  // AAABBB: two triples of different digits (e.g. 111222)
  function hasAAABBB(d) {
    const m = d.match(/(\d)\1\1(\d)\2\2/);
    return !!m && m[1] !== m[2];
  }
  // AAABB: triple then pair of different digits (e.g. 11122)
  function hasAAABB(d) {
    const m = d.match(/(\d)\1\1(\d)\2/);
    return !!m && m[1] !== m[2];
  }
  // AABBB: pair then triple of different digits (e.g. 11222)
  function hasAABBB(d) {
    const m = d.match(/(\d)\1(\d)\2\2/);
    return !!m && m[1] !== m[2];
  }
  // AAAABB: quad then pair of different digits (e.g. 111122)
  function hasAAAABB(d) {
    const m = d.match(/(\d)\1\1\1(\d)\2/);
    return !!m && m[1] !== m[2];
  }
  // AABBBB: pair then quad of different digits (e.g. 112222)
  function hasAABBBB(d) {
    const m = d.match(/(\d)\1(\d)\2\2\2/);
    return !!m && m[1] !== m[2];
  }
  // AABBBCC: pair, triple, pair with 3 distinct digits (e.g. 1122233)
  function hasAABBBCC(d) {
    const m = d.match(/(\d)\1(\d)\2\2(\d)\3/);
    return !!m && new Set([m[1], m[2], m[3]]).size === 3;
  }
  // AAABBCC: triple, pair, pair with 3 distinct digits (e.g. 1112233)
  function hasAAABBCC(d) {
    const m = d.match(/(\d)\1\1(\d)\2(\d)\3/);
    return !!m && new Set([m[1], m[2], m[3]]).size === 3;
  }
  // AABBCCC: pair, pair, triple with 3 distinct digits (e.g. 1122333)
  function hasAABBCCC(d) {
    const m = d.match(/(\d)\1(\d)\2(\d)\3\3/);
    return !!m && new Set([m[1], m[2], m[3]]).size === 3;
  }
  // AABB: a pair followed by a different pair (e.g. 1122)
  function hasAABB(d) {
    const m = d.match(/(\d)\1(\d)\2/);
    return !!m && m[1] !== m[2];
  }
  // ABAB: alternating two distinct digits (e.g. 1212)
  function hasABAB(d) {
    const m = d.match(/(\d)(\d)\1\2/);
    return !!m && m[1] !== m[2];
  }
  // Mirror (ABBA): 4-char palindrome of two distinct digits (e.g. 1221)
  function hasMirror(d) {
    const m = d.match(/(\d)(\d)\2\1/);
    return !!m && m[1] !== m[2];
  }
  // ABCABC: a 3-digit block repeated, with the three digits all distinct (e.g. 123123)
  function hasABCABC(d) {
    const m = d.match(/(\d)(\d)(\d)\1\2\3/);
    return !!m && new Set([m[1], m[2], m[3]]).size === 3;
  }
  // Dominant digit: any single digit appearing 4+ times anywhere in d
  function dominantDigit(d) {
    const counts = {};
    for (const ch of d) counts[ch] = (counts[ch] || 0) + 1;
    let best = null;
    for (const [digit, count] of Object.entries(counts)) {
      if (count >= 4 && (!best || count > best.count)) best = { digit, count };
    }
    return best;
  }

  // Find the longest ascending or descending run of consecutive digits (3+)
  function findSequence(d) {
    let best = '';
    for (let i = 0; i < d.length; i++) {
      let asc = d[i], desc = d[i];
      for (let j = i + 1; j < d.length; j++) {
        if (+d[j] === +d[j-1] + 1) asc += d[j]; else break;
      }
      for (let j = i + 1; j < d.length; j++) {
        if (+d[j] === +d[j-1] - 1) desc += d[j]; else break;
      }
      const longer = asc.length >= desc.length ? asc : desc;
      if (longer.length >= 3 && longer.length > best.length) best = longer;
    }
    return best;
  }

  // --- Classify a number into tags ---
  function getNumberTags(num) {
    const tags = [];
    const d = num.slice(2); // 8 digits after "04"

    // Repeating-digit runs (priority: Quint > Quad > Triple)
    if (/(\d)\1{4}/.test(d)) {
      tags.push({ label: 'Quint', cls: 'quint' });
    } else if (/(\d)\1{3}/.test(d)) {
      tags.push({ label: 'Quad', cls: 'quad' });
    } else if (/(\d)\1{2}/.test(d)) {
      tags.push({ label: 'Triple', cls: 'triple' });
    }

    // Grouped pair/run patterns — most specific (longest, most distinct digits) first
    if (hasAABBCCDD(d)) {
      tags.push({ label: 'AABBCCDD', cls: 'aabbccdd' });
    } else if (hasAABBBCC(d)) {
      tags.push({ label: 'AABBBCC', cls: 'aabbbcc' });
    } else if (hasAAABBCC(d)) {
      tags.push({ label: 'AAABBCC', cls: 'aaabbcc' });
    } else if (hasAABBCCC(d)) {
      tags.push({ label: 'AABBCCC', cls: 'aabbccc' });
    } else if (hasAABBCC(d)) {
      tags.push({ label: 'AABBCC', cls: 'aabbcc' });
    } else if (hasAAAABB(d)) {
      tags.push({ label: 'AAAABB', cls: 'aaaabb' });
    } else if (hasAABBBB(d)) {
      tags.push({ label: 'AABBBB', cls: 'aabbbb' });
    } else if (hasAAABBB(d)) {
      tags.push({ label: 'AAABBB', cls: 'aaabbb' });
    } else if (hasAAABB(d)) {
      tags.push({ label: 'AAABB', cls: 'aaabb' });
    } else if (hasAABBB(d)) {
      tags.push({ label: 'AABBB', cls: 'aabbb' });
    }

    // ABCABC: repeating 3-digit block (e.g. 123123) — high priority, distinct from sequences
    if (hasABCABC(d)) {
      tags.push({ label: 'ABCABC', cls: 'abcabc' });
    }

    // Sequence (3+ ascending or descending consecutive digits) — include digits in label
    const seq = findSequence(d);
    if (seq) {
      tags.push({ label: `Seq ${seq}`, cls: 'sequence' });
    }

    // Round ending (covers 0000, 000, X00 where X != 0, and 500)
    const hasRepeat = tags.some(t => ['quint','quad','triple'].includes(t.cls));
    if (!hasRepeat) {
      if (d.endsWith('0000')) tags.push({ label: 'Round 0000', cls: 'round' });
      else if (d.endsWith('000')) tags.push({ label: 'Round 000', cls: 'round' });
      else if (d.endsWith('500')) tags.push({ label: 'Round 500', cls: 'round' });
      else if (/[1-9]00$/.test(d)) tags.push({ label: `Round ${d.slice(-3)}`, cls: 'round' });
    }

    // ABAB alternating (e.g. 1212)
    const hasGroupedOrAltOrMirror = tags.some(t => ['aabbccdd','aabbbcc','aaabbcc','aabbccc','aabbcc','aaaabb','aabbbb','aaabbb','aaabb','aabbb','quint','quad','abcabc'].includes(t.cls));
    if (!hasGroupedOrAltOrMirror && hasABAB(d)) {
      tags.push({ label: 'ABAB', cls: 'abab' });
    }

    // Mirror (ABBA): 4-char palindrome (e.g. 1221)
    if (!hasGroupedOrAltOrMirror && !tags.some(t => t.cls === 'abab') && hasMirror(d)) {
      tags.push({ label: 'Mirror', cls: 'mirror' });
    }

    // AABB (fallback if no larger grouped pattern matched)
    const hasGrouped = tags.some(t => ['aabbccdd','aabbbcc','aaabbcc','aabbccc','aabbcc','aaaabb','aabbbb','aaabbb','aaabb','aabbb','quint','quad','abab','mirror'].includes(t.cls));
    if (!hasGrouped && hasAABB(d)) {
      tags.push({ label: 'AABB', cls: 'aabb' });
    }

    // Heavy single-digit dominance (e.g. five 8s scattered across d)
    const dom = dominantDigit(d);
    if (dom && !tags.some(t => ['quint','quad','triple'].includes(t.cls))) {
      tags.push({ label: `Heavy ${dom.digit} ×${dom.count}`, cls: 'heavy' });
    }

    // Pair fallback (only if nothing else classified it)
    if (tags.length === 0) {
      const pairs = d.match(/(\d)\1/g);
      if (pairs && pairs.length > 0) {
        tags.push({ label: pairs.length > 1 ? 'Pairs' : 'Pair', cls: 'pair' });
      }
    }

    return tags.slice(0, 4);
  }

  function tagsHtml(tags) {
    if (!tags || tags.length === 0) return '';
    return `<div class="tags">${tags.map(t => `<span class="tag ${t.cls}">${t.label}</span>`).join('')}</div>`;
  }

  // --- Scoring ---
  function scoreNumber(num) {
    let score = 0;
    const d = num.slice(2);
    const repeats = d.match(/(\d)\1{2,}/g);
    if (repeats) repeats.forEach(r => score += r.length * 15);
    const pairs = d.match(/(\d)\1/g);
    if (pairs) score += pairs.length * 5;
    for (let i = 0; i < d.length - 2; i++) {
      if (+d[i+1] === +d[i]+1 && +d[i+2] === +d[i]+2) score += 10;
      if (+d[i+1] === +d[i]-1 && +d[i+2] === +d[i]-2) score += 10;
    }
    if (hasABCABC(d)) score += 25;
    if (hasABAB(d)) score += 8;
    if (hasMirror(d)) score += 8;
    const dom = dominantDigit(d);
    if (dom) score += (dom.count - 3) * 8;
    if (d.endsWith('0000')) score += 30;
    else if (d.endsWith('000')) score += 15;
    else if (/[1-9]00$/.test(d)) score += 8;
    return score;
  }

  // --- Create a fresh session ---
  // Must be called with sessionId == null so apiCall sends no authorization header.
  async function createSession() {
    const data = await apiCall({ query: '{ sessionId }' });
    const sid = data?.data?.sessionId;
    if (!sid) throw new Error('Failed to create session (API returned no sessionId)');
    return sid;
  }

  // --- Add plan to cart ---
  async function setupCart() {
    const cartQuery = `{ cart { items { ... on MobilePlanCartItem { id plan { id name } } } } }`;
    const cartData = await apiCall({ query: cartQuery });
    console.log('[Number Hunter] initial cart response:', cartData);

    const existingPlan = cartData?.data?.cart?.items?.[0]?.plan;
    if (existingPlan?.id) {
      return existingPlan;
    }

    const addQuery = `mutation AddToCart($planId: ID!, $cartUrl: String!) {
      updateCartItemQuantity(planId: $planId, quantity: 1, cartUrl: $cartUrl) {
        items { ... on MobilePlanCartItem { id plan { id name } } }
      }
    }`;
    let addData;
    try {
      addData = await apiCall({
        query: addQuery,
        variables: { planId: DEFAULT_PLAN, cartUrl: CART_URL },
        operationName: 'AddToCart'
      });
      console.log('[Number Hunter] updateCartItemQuantity response:', addData);
    } catch (e) {
      console.warn('[Number Hunter] updateCartItemQuantity threw:', e);
    }

    const added = addData?.data?.updateCartItemQuantity?.items?.[0]?.plan;
    if (added?.id) return added;

    const recheck = await apiCall({ query: cartQuery });
    console.log('[Number Hunter] cart recheck response:', recheck);
    const plan = recheck?.data?.cart?.items?.[0]?.plan;
    if (plan?.id) return plan;

    const gqlErr = addData?.errors?.[0]?.message;
    throw new Error(
      gqlErr
        ? `updateCartItemQuantity failed: ${gqlErr}`
        : `updateCartItemQuantity returned no plan`
    );
  }

  // --- Query numbers ---
  async function queryNumbers(filter) {
    const query = `mutation updatePhoneNumbers($planId: ID!, $cartItemPlanIndex: Int!, $filter: String, $count: Int!) {
      updatePhoneNumbers(planId: $planId, cartItemPlanIndex: $cartItemPlanIndex, filter: $filter, count: $count) {
        items { ... on MobilePlanCartItem { numbers { reservedNumbers { number isPremium cost } } } }
      }
    }`;
    const data = await apiCall({
      query,
      variables: { planId, cartItemPlanIndex: 0, filter, count: 10 },
      operationName: 'updatePhoneNumbers'
    });
    if (data?.errors) return [];
    return (data?.data?.updatePhoneNumbers?.items || [])
      .flatMap(i => (i.numbers || []).flatMap(n => n.reservedNumbers || []))
      .map(n => ({ ...n, filter }));
  }

  // --- Try to connect with a session ID ---
  async function tryConnect(sid) {
    sessionId = sid;
    const cartData = await apiCall({ query: '{ cart { items { ... on MobilePlanCartItem { plan { id name } } } } }' });
    const plan = cartData?.data?.cart?.items?.[0]?.plan;
    if (plan?.id) {
      planId = plan.id;
      await chrome.storage.local.set({ sessionId: sid, planId });
      setStatus('green', '');
      planInfo.textContent = '';
      connectBox.classList.add('hidden');
      return true;
    }
    return false;
  }

  function showConnectBox() {
    setStatus('yellow', 'Need connection');
    planInfo.textContent = '';
    connectBox.classList.remove('hidden');
  }

  // --- Initialize ---
  async function init() {
    setStatus('yellow', 'Setting up — please wait, no action needed…');

    // Load history
    const saved = await chrome.storage.local.get(['sessionId', 'planId', 'results', 'historyLog', 'sessionCount', 'searches', 'scanState', 'favourites']);
    if (saved.historyLog) { historyLog = saved.historyLog; $('totalLogged').textContent = historyLog.length; }
    if (saved.sessionCount) $('totalSessions').textContent = saved.sessionCount;
    if (saved.results) { allResults = saved.results; $('totalFound').textContent = allResults.length; }
    if (saved.searches) { searches = saved.searches; }
    if (saved.favourites) { favourites = saved.favourites; favSet = new Set(favourites.map(f => f.number)); }

    // Resume scan UI if a scan is already running in the background
    if (saved.scanState && saved.scanState.running) {
      enterScanningUI();
      applyScanState(saved.scanState);
    }

    // 1. Try saved session
    if (saved.sessionId) {
      setStatus('yellow', 'Setting up — please wait, no action needed…');
      try {
        if (await tryConnect(saved.sessionId)) return;
      } catch (e) { /* expired */ }
    }

    // 2. Try auto-detect from amaysim page
    setStatus('yellow', 'Setting up — please wait, no action needed…');
    try {
      const resp = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_PAGE_SESSION' }, r => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (r?.error) reject(new Error(r.error));
          else resolve(r);
        });
      });
      if (resp.sessionId) {
        setStatus('yellow', 'Setting up — please wait, no action needed…');
        try {
          if (await tryConnect(resp.sessionId)) return;
        } catch (e) { /* no plan in cart */ }
      }
    } catch (e) {
      // No amaysim tab or injection failed
    }

    // 3. Auto-bootstrap a fresh session + cart via the API (no amaysim tab needed)
    // Reset any stale sessionId left over from failed steps 1/2 so createSession
    // sends no authorization header.
    sessionId = null;
    setStatus('yellow', 'Setting up — please wait, no action needed…');
    let bootstrapError = null;
    try {
      const sid = await createSession();
      sessionId = sid;
      setStatus('yellow', 'Setting up — please wait, no action needed…');
      await setupCart();
      setStatus('yellow', 'Almost ready — please wait…');
      if (await tryConnect(sid)) return;
      bootstrapError = 'Cart verification returned no plan';
    } catch (e) {
      bootstrapError = e.message;
      console.warn('[Number Hunter] Auto-bootstrap failed:', e);
    }

    // 4. Manual connect (only if everything else failed). Surface the real reason.
    showConnectBox();
    if (bootstrapError) {
      planInfo.textContent = `Auto-setup failed: ${bootstrapError}`;
    }
  }

  function setStatus(color, text) {
    if (color === 'green') {
      statusBar.classList.add('hidden');
    } else {
      statusBar.classList.remove('hidden');
      statusDot.className = 'status-dot ' + color;
      statusText.textContent = text;
    }
  }

  // --- Manual session connect ---
  $('connectBtn').addEventListener('click', async () => {
    const sid = $('manualSessionInput').value.trim();
    if (!sid || sid.length < 10) {
      alert('Please paste a valid session ID');
      return;
    }
    sessionId = sid;
    await chrome.storage.local.set({ sessionId: sid });
    setStatus('yellow', 'Checking cart...');

    try {
      const cartData = await apiCall({ query: '{ cart { items { ... on MobilePlanCartItem { plan { id name } } } } }' });
      const plan = cartData?.data?.cart?.items?.[0]?.plan;
      if (plan?.id) {
        planId = plan.id;
        await chrome.storage.local.set({ planId });
        setStatus('green', '');
        planInfo.textContent = '';
        connectBox.classList.add('hidden');
      } else {
        setStatus('yellow', 'No plan in cart');
        planInfo.textContent = 'Add one on amaysim.com.au';
      }
    } catch (e) {
      setStatus('red', 'Invalid session');
      planInfo.textContent = e.message;
    }
  });

  function formatNum(raw) {
    return raw.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
  }

  // --- Persistent history ---
  async function addToHistory(numbers) {
    const seen = new Set(historyLog.map(r => r.number));
    let added = 0;
    for (const n of numbers) {
      if (!seen.has(n.number)) {
        seen.add(n.number);
        historyLog.push({
          number: n.number,
          formatted: formatNum(n.number),
          isPremium: n.isPremium,
          cost: n.cost || 0,
          score: scoreNumber(n.number),
          filter: n.filter,
          searchTerm: n.searchTerm || null,
          foundAt: Date.now(),
          session: sessionId?.slice(0, 8) || 'unknown'
        });
        added++;
      }
    }
    if (added > 0) {
      historyLog.sort((a, b) => b.score - a.score);
      await chrome.storage.local.set({ historyLog });
      $('totalLogged').textContent = historyLog.length;
    }
    return added;
  }

  // --- Add results (dedup) ---
  function addResults(numbers) {
    const seen = new Set(allResults.map(r => r.number));
    let added = 0;
    for (const n of numbers) {
      if (!seen.has(n.number)) {
        seen.add(n.number);
        allResults.push({
          number: n.number,
          formatted: formatNum(n.number),
          isPremium: n.isPremium,
          cost: n.cost || 0,
          score: scoreNumber(n.number),
          filter: n.filter,
          searchTerm: n.searchTerm || null,
          foundAt: Date.now()
        });
        added++;
      }
    }
    allResults.sort((a, b) => b.score - a.score);
    chrome.storage.local.set({ results: allResults });
    $('totalFound').textContent = allResults.length;
    addToHistory(numbers);
    return added;
  }

  // --- Sort control ---
  $('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderResults();
  });

  // --- Render results ---
  function renderResults() {
    let source = allResults;
    if (currentFilter === 'favourites') source = favourites;

    let filtered = source;
    if (currentFilter === 'free') filtered = source.filter(r => !r.isPremium);
    if (currentFilter === 'premium') filtered = source.filter(r => r.isPremium);

    filtered = [...filtered].sort((a, b) => {
      if (currentSort === 'recent') return (b.favouritedAt || b.foundAt) - (a.favouritedAt || a.foundAt);
      return b.score - a.score;
    });

    if (currentFilter === 'favourites') {
      resultsCount.textContent = `${filtered.length} favourite${filtered.length === 1 ? '' : 's'}`;
    } else {
      resultsCount.textContent = `${filtered.length} numbers (${allResults.filter(r=>!r.isPremium).length} free, ${allResults.filter(r=>r.isPremium).length} premium)`;
    }

    if (filtered.length === 0) {
      const msg = currentFilter === 'favourites'
        ? 'No favourites yet. Tap ☆ on any number to save it here.'
        : 'No results yet. Run a search or scan first.';
      resultsList.innerHTML = `<div class="results-empty">${msg}</div>`;
      return;
    }

    resultsList.innerHTML = filtered.slice(0, 100).map((r, i) => renderNumberCard(r, { top: i === 0 && currentSort === 'score' && r.score > 0 && currentFilter !== 'favourites' })).join('');
  }

  function switchToResults() {
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="results"]').classList.add('active');
    $('panel-results').classList.add('active');
    renderResults();
  }

  // --- Shared number card renderer ---
  function renderNumberCard(r, opts = {}) {
    const tags = getNumberTags(r.number);
    const isFav = favSet.has(r.number);
    return `
      <div class="number-card${opts.top ? ' top-result' : ''}" data-number="${r.number}" title="Click to copy">
        ${opts.top ? '<span class="top-ribbon">TOP SCORE</span>' : ''}
        <div>
          <div class="num">${r.formatted}</div>
          <div class="tags">
            ${tags.map(t => `<span class="tag ${t.cls}">${t.label}</span>`).join('')}
            ${r.searchTerm ? `<span class="tag search">${r.searchTerm}</span>` : ''}
          </div>
        </div>
        <button class="fav-btn${isFav ? ' active' : ''}" data-fav="${r.number}" title="${isFav ? 'Remove from favourites' : 'Save to favourites'}" aria-pressed="${isFav}">${isFav ? '★' : '☆'}</button>
        <div class="meta">
          <div class="score">score ${r.score}</div>
          <span class="badge ${r.isPremium ? 'premium' : 'free'}">${r.isPremium ? '$30' : 'FREE'}</span>
          <div class="found-date">${formatFoundAt(r.foundAt)}</div>
        </div>
      </div>`;
  }

  async function toggleFavourite(number) {
    if (favSet.has(number)) {
      favSet.delete(number);
      favourites = favourites.filter(f => f.number !== number);
    } else {
      const entry = allResults.find(r => r.number === number) || historyLog.find(r => r.number === number);
      if (!entry) return;
      favSet.add(number);
      favourites.unshift({ ...entry, favouritedAt: Date.now() });
    }
    await chrome.storage.local.set({ favourites });
    renderResults();
    renderSearches();
  }

  // Click delegation: star button toggles fav, otherwise copy number
  document.body.addEventListener('click', async (e) => {
    const favBtn = e.target.closest('.fav-btn');
    if (favBtn) {
      e.stopPropagation();
      await toggleFavourite(favBtn.dataset.fav);
      return;
    }
    const card = e.target.closest('.number-card');
    if (!card || !card.dataset.number) return;
    try {
      await navigator.clipboard.writeText(card.dataset.number);
      card.classList.add('copied');
      setTimeout(() => card.classList.remove('copied'), 1600);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  });

  // --- Search logging and rendering ---
  async function logSearch(entry) {
    searches.unshift(entry);
    if (searches.length > 200) searches = searches.slice(0, 200);
    await chrome.storage.local.set({ searches });
  }

  function formatFoundAt(ts) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
    return isToday
      ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString();
  }

  function formatRelativeTime(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  function renderSearches() {
    const countEl = $('searchesCount');
    const listEl = $('searchesList');

    // A running scan shows at the top as an in-progress entry until it finishes
    // (at which point background.js logs it into `searches`).
    const liveEntry = (liveScan && liveScan.running) ? {
      input: liveScan.label || 'Scan',
      digits: liveScan.searchDigits || null,
      matches: liveScan.matchedNumbers || [],
      timestamp: liveScan.startedAt,
      inProgress: true
    } : null;

    const entries = liveEntry ? [liveEntry, ...searches] : searches;

    if (entries.length === 0) {
      countEl.textContent = '';
      listEl.innerHTML = '<div class="results-empty">No searches yet. Run a search or scan first.</div>';
      return;
    }

    countEl.textContent = liveEntry
      ? `${searches.length} search${searches.length === 1 ? '' : 'es'} — 1 in progress`
      : `${searches.length} search${searches.length === 1 ? '' : 'es'} — last ${formatRelativeTime(searches[0].timestamp)}`;

    const resultsByNumber = new Map(allResults.map(r => [r.number, r]));

    // Remember which cards are open so a re-render (e.g. after favouriting a
    // number inside a card, or a live progress update) doesn't collapse them.
    const expandedIdx = new Set(
      [...listEl.querySelectorAll('.search-card.expanded')].map(c => c.dataset.idx)
    );

    listEl.innerHTML = entries.map((s, i) => {
      // Stable id: the live card keeps "live" so its open state survives updates.
      const cardId = s.inProgress ? 'live' : String(liveEntry ? i - 1 : i);
      const matchCount = s.matches.length;
      const digitsLabel = s.digits && s.digits !== s.input ? ` <span class="search-digits">${s.digits}</span>` : '';
      const matchesHtml = matchCount === 0
        ? `<div class="no-matches">${s.inProgress ? 'Searching… matches will appear here.' : 'No numbers matched this search.'}</div>`
        : s.matches.map(num => resultsByNumber.get(num)).filter(Boolean).map(renderNumberCard).join('');
      const metaRight = s.inProgress
        ? '<span class="in-progress">● In progress</span>'
        : `<span>${formatRelativeTime(s.timestamp)}</span>`;
      return `
        <div class="search-card${s.inProgress ? ' in-progress-card' : ''}${expandedIdx.has(cardId) ? ' expanded' : ''}" data-idx="${cardId}">
          <div class="search-card-header">
            <div>
              <div class="search-card-title">${s.input}${digitsLabel}</div>
            </div>
            <div class="search-card-meta">
              <span class="match-count${matchCount === 0 ? ' zero' : ''}">${matchCount} match${matchCount === 1 ? '' : 'es'}</span>
              ${metaRight}
              <span class="search-card-toggle">▸</span>
            </div>
          </div>
          <div class="search-card-matches">${matchesHtml}</div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.search-card-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('expanded');
      });
    });
  }

  // --- Search (supports numbers and words) ---
  searchBtn.addEventListener('click', async () => {
    const raw = searchInput.value.trim();
    if (!raw) {
      searchResults.innerHTML = '<div class="results-empty" style="padding:15px;color:#f44336">Enter digits or a word to search.</div>';
      return;
    }
    if (!planId) {
      searchResults.innerHTML = '<div class="results-empty" style="padding:15px;color:#f44336">Not ready. Wait for connection.</div>';
      return;
    }

    // Convert letters to digits
    const hasLetters = /[a-zA-Z]/.test(raw);
    const digits = wordToDigits(raw);
    const searchTerm = hasLetters ? raw.toUpperCase() : null;

    if (!digits || !/^\d+$/.test(digits)) {
      searchResults.innerHTML = '<div class="results-empty" style="padding:15px;color:#f44336">Could not convert input to digits.</div>';
      return;
    }

    // Clear search results area (only used for errors now)
    searchResults.innerHTML = '';

    // If 1-5 digits, do a single search. If longer, do a multi-pattern scan.
    if (digits.length <= 5) {
      await runBulkScan([digits], searchTerm, digits, searchTerm || digits);
    } else {
      // Longer input: generate sub-patterns and bulk scan
      await runBulkScan(generateSubPatterns(digits), searchTerm, digits, searchTerm || digits);
    }
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchBtn.click();
  });

  function generateSubPatterns(digits) {
    const pats = [];
    for (let len = 3; len <= Math.min(5, digits.length); len++) {
      for (let i = 0; i <= digits.length - len; i++) {
        pats.push(digits.slice(i, i + len));
      }
    }
    return [...new Set(pats)];
  }

  // --- Bulk Scan (delegated to background.js so it survives popup close) ---
  async function runBulkScan(patterns, searchTerm, searchDigits, label, opts = {}) {
    if (scanning) return;
    if (!planId) { alert('Not ready yet.'); return; }
    // Deep (3 passes per filter) + 3-session rotation are now the default
    // method for the widest number coverage.
    const repeats = opts.repeats ?? 3;
    const sessions = opts.sessions ?? 3;
    enterScanningUI();
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'START_SCAN',
        opts: { patterns, repeats, sessions, label, searchTerm, searchDigits, matchRegex: opts.matchRegex || null, planId, sessionId }
      }, resp => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(resp);
      });
    });
  }

  function enterScanningUI() {
    scanning = true;
    scanProgress.classList.add('active');
    stopScanBtn.style.display = 'block';
    document.querySelectorAll('.preset-btn, #searchBtn').forEach(b => b.disabled = true);
  }

  function exitScanningUI(finalText) {
    scanning = false;
    stopScanBtn.style.display = 'none';
    document.querySelectorAll('.preset-btn, #searchBtn').forEach(b => b.disabled = false);
    if (finalText) progressText.textContent = finalText;
  }

  function applyScanState(s) {
    if (!s) return;
    liveScan = s;
    // Keep the in-progress card in Recent Searches current while it's visible.
    if ($('panel-searches').classList.contains('active')) renderSearches();
    const pct = s.total ? Math.round((s.scanned / s.total) * 100) : 0;
    progressFill.style.width = pct + '%';
    const remaining = Math.max(0, s.total - s.scanned);
    const etaSec = Math.round(remaining * 0.7);
    const eta = etaSec > 60 ? `~${Math.ceil(etaSec / 60)} min left` : etaSec > 5 ? `~${etaSec}s left` : 'finishing...';
    // Deep multi-session scanning is always on, so session/pass counters add
    // noise. Lead with what the user cares about: new numbers found, and — for
    // an explicit search — whether a match has turned up yet.
    const newCount = s.found || 0;
    const newLabel = `${newCount} new number${newCount === 1 ? '' : 's'} found`;
    let label;
    if (s.searchDigits) {
      const matches = s.matchedNumbers ? s.matchedNumbers.length : 0;
      const matchLabel = matches === 0
        ? 'No match yet'
        : `${matches} match${matches === 1 ? '' : 'es'} found`;
      label = `${matchLabel} · ${newLabel}`;
    } else {
      label = newLabel;
    }
    progressText.textContent = `${label} · ${eta}`;
  }

  // Listen for background scan updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.scanState) {
      const next = changes.scanState.newValue;
      const prev = changes.scanState.oldValue;
      if (next) {
        if (!scanning) enterScanningUI();
        applyScanState(next);
      } else if (prev) {
        // scanState was cleared — scan finished
        liveScan = null;
        const newCount = prev.found || 0;
        const newLabel = `${newCount} new number${newCount === 1 ? '' : 's'} found`;
        let summary;
        if (prev.searchDigits) {
          const matches = prev.matchedNumbers ? prev.matchedNumbers.length : 0;
          const term = prev.searchTerm || prev.searchDigits;
          const matchLabel = matches === 0
            ? `No matches for "${term}"`
            : `${matches} match${matches === 1 ? '' : 'es'} for "${term}"`;
          summary = `Done! ${matchLabel} · ${newLabel}.`;
        } else {
          summary = `Done! ${newLabel}.`;
        }
        exitScanningUI(summary);
        // Refresh results from storage and switch to results tab
        chrome.storage.local.get(['results', 'searches'], data => {
          if (data.results) { allResults = data.results; $('totalFound').textContent = allResults.length; renderResults(); }
          if (data.searches) { searches = data.searches; renderSearches(); }
          switchToResults();
        });
      }
    }
    if (changes.results) {
      allResults = changes.results.newValue || [];
      $('totalFound').textContent = allResults.length;
      renderResults();
    }
    if (changes.historyLog) {
      historyLog = changes.historyLog.newValue || [];
      $('totalLogged').textContent = historyLog.length;
    }
    if (changes.searches) {
      searches = changes.searches.newValue || [];
      renderSearches();
    }
    if (changes.favourites) {
      favourites = changes.favourites.newValue || [];
      favSet = new Set(favourites.map(f => f.number));
      renderResults();
    }
  });

  stopScanBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_SCAN' });
  });

  // --- Scan presets ---
  // Run one of the repeat-digit scans (3, 4, or 5 of the same digit)
  function runRepeatScan(count, label) {
    const pats = [];
    for (let d = 0; d <= 9; d++) pats.push(String(d).repeat(count));
    runBulkScan(pats, null, null, label);
  }
  $('scanAAA').addEventListener('click', () => runRepeatScan(3, 'Triples scan'));
  $('scanAAAA').addEventListener('click', () => runRepeatScan(4, 'Quads scan'));
  $('scanAAAAA').addEventListener('click', () => runRepeatScan(5, 'Quints scan'));

  // All Doubles scan: AABB for each distinct digit pair (post-filter tags mark AABBCC / AABBCCDD)
  $('scanDoubleDoubles').addEventListener('click', () => {
    const pats = [];
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${a}${b}${b}`);
    runBulkScan(pats, null, null, 'All Doubles scan');
  });

  // AAABBB scan: search 5-char prefix AAABB for each distinct digit pair.
  // The API caps filters at 5 chars, so AAABB catches everything that could become AAABBB.
  // matchRegex narrows the recorded matches to true AAABBB (two triples of different
  // digits), so the search only shows AAABBB — not the AAABB numbers it had to fetch.
  $('scanTripleTriples').addEventListener('click', () => {
    const pats = [];
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${a}${a}${b}${b}`);
    runBulkScan(pats, null, null, 'AAABBB scan', { matchRegex: '(\\d)\\1\\1(?!\\1)(\\d)\\2\\2' });
  });

  // Consecutive ascending/descending sequences (4 and 5 digits long)
  function sequencePatterns() {
    const pats = [];
    // 4-digit ascending: 1234, 2345, ..., 6789
    for (let start = 1; start <= 6; start++) {
      pats.push(`${start}${start+1}${start+2}${start+3}`);
    }
    // 4-digit descending: 9876, 8765, ..., 4321
    for (let start = 9; start >= 4; start--) {
      pats.push(`${start}${start-1}${start-2}${start-3}`);
    }
    // 5-digit ascending: 12345, ..., 56789
    for (let start = 1; start <= 5; start++) {
      pats.push(`${start}${start+1}${start+2}${start+3}${start+4}`);
    }
    // 5-digit descending: 98765, ..., 54321
    for (let start = 9; start >= 5; start--) {
      pats.push(`${start}${start-1}${start-2}${start-3}${start-4}`);
    }
    return pats;
  }

  $('scanSequences').addEventListener('click', () => {
    runBulkScan(sequencePatterns(), null, null, 'Sequences scan');
  });

  function abPatterns() {
    const pats = [];
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${b}${a}${b}`);
    return pats;
  }
  function mirrorPatterns() {
    const pats = [];
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${b}${b}${a}`);
    return pats;
  }
  function roundHundredsPatterns() {
    const pats = [];
    for (let n = 1; n <= 9; n++) pats.push(`${n}00`);
    return pats;
  }

  $('scanABAB').addEventListener('click', () => runBulkScan(abPatterns(), null, null, 'ABAB scan'));
  $('scanMirrors').addEventListener('click', () => runBulkScan(mirrorPatterns(), null, null, 'Mirrors scan'));
  $('scanRoundHundreds').addEventListener('click', () => runBulkScan(roundHundredsPatterns(), null, null, 'Round 00 scan'));

  function fullScanPatterns() {
    const pats = [];
    for (let d = 0; d <= 9; d++) {
      pats.push(`${d}${d}${d}`);
      pats.push(`${d}${d}${d}${d}`);
      pats.push(`${d}${d}${d}${d}${d}`);
    }
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${a}${b}${b}`);
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${a}${a}${b}${b}`);
    pats.push(...abPatterns());
    pats.push(...mirrorPatterns());
    pats.push(...sequencePatterns());
    pats.push(...roundHundredsPatterns());
    return [...new Set(pats)];
  }

  // One-click: deep full scan, then jump to All Numbers sorted by score
  $('findBest').addEventListener('click', async () => {
    currentSort = 'score';
    $('sortSelect').value = 'score';
    await runBulkScan(fullScanPatterns(), null, null, 'Find Best Number', { repeats: 3 });
  });

  // --- Export CSV ---
  $('exportCSV').addEventListener('click', async () => {
    await loadHistory();
    if (historyLog.length === 0) { alert('No numbers logged yet.'); return; }
    const header = 'Number,Formatted,Premium,Cost,Score,Pattern,Found At,Session\n';
    const rows = historyLog.map(r =>
      `${r.number},${r.formatted},${r.isPremium ? 'Yes' : 'No'},${r.cost},${r.score},${r.filter},${new Date(r.foundAt).toISOString()},${r.session || ''}`
    ).join('\n');
    downloadFile(header + rows, 'amaysim-numbers.csv', 'text/csv');
  });

  $('exportJSON').addEventListener('click', async () => {
    await loadHistory();
    if (historyLog.length === 0) { alert('No numbers logged yet.'); return; }
    downloadFile(JSON.stringify(historyLog, null, 2), 'amaysim-numbers.json', 'application/json');
  });

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // --- View History ---
  $('viewHistory').addEventListener('click', async () => {
    await loadHistory();
    const overlay = $('historyOverlay');
    const list = $('historyList');
    if (historyLog.length === 0) {
      list.innerHTML = '<div style="color:#555; text-align:center; padding:30px;">No numbers logged yet.</div>';
    } else {
      list.innerHTML = historyLog.map(r => {
        const date = new Date(r.foundAt).toLocaleDateString();
        const time = new Date(r.foundAt).toLocaleTimeString();
        const tags = getNumberTags(r.number);
        const tagText = tags.length ? tags.map(t => t.label).join(' · ') : '';
        return `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 8px; border-bottom:1px solid #1a1a1a;">
          <span style="color:#fff; font-weight:600;">${r.formatted}</span>
          <span style="color:#ff8c00; font-size:10px;">${tagText}</span>
          <span style="color:${r.isPremium ? '#ff8c00' : '#4caf50'}; font-size:11px;">${r.isPremium ? '$30' : 'FREE'}</span>
          <span style="color:#ff8c00; font-size:11px;">score ${r.score}</span>
          <span style="color:#555; font-size:10px;">${date} ${time}</span>
        </div>`;
      }).join('');
    }
    overlay.style.display = 'block';
  });

  $('closeHistory').addEventListener('click', () => { $('historyOverlay').style.display = 'none'; });

  $('clearResults').addEventListener('click', async () => {
    allResults = [];
    await chrome.storage.local.set({ results: [] });
    $('totalFound').textContent = '0';
    renderResults();
  });

  $('moreToggle').addEventListener('click', () => {
    const m = $('moreActions');
    const isHidden = m.classList.toggle('hidden');
    $('moreToggle').textContent = isHidden ? 'More actions ▾' : 'More actions ▴';
  });

  $('clearSearches').addEventListener('click', async () => {
    if (searches.length === 0) return;
    if (confirm('Clear all search history?')) {
      searches = [];
      await chrome.storage.local.set({ searches: [] });
      renderSearches();
    }
  });

  $('clearHistory').addEventListener('click', async () => {
    if (confirm('Delete ALL saved number history? This cannot be undone.')) {
      historyLog = []; allResults = [];
      await chrome.storage.local.set({ historyLog: [], results: [], sessionCount: 0 });
      $('totalLogged').textContent = '0'; $('totalSessions').textContent = '0'; $('totalFound').textContent = '0';
      renderResults();
    }
  });

  // --- Session refresh (get fresh number pool) ---
  $('refreshSession').addEventListener('click', async () => {
    if (confirm('Create a new session for a fresh number pool? History is preserved.')) {
      try {
        const saved = await chrome.storage.local.get('sessionCount');
        const newCount = (saved.sessionCount || 0) + 1;
        allResults = [];
        await chrome.storage.local.set({ sessionCount: newCount, results: [], sessionId: null, planId: null });
        $('totalSessions').textContent = newCount;
        $('totalFound').textContent = '0';
        sessionId = null; planId = null;
        init();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
  });

  async function loadHistory() {
    const saved = await chrome.storage.local.get(['historyLog', 'sessionCount']);
    historyLog = saved.historyLog || [];
    $('totalLogged').textContent = historyLog.length;
    $('totalSessions').textContent = saved.sessionCount || 0;
  }

  // --- Init ---
  init();
})();
