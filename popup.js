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
  let lastSearchNumbers = new Set(); // tracks numbers from the most recent search

  // Plan to add to cart (amaysim's cheapest)
  const DEFAULT_PLAN = 'unlimited-15gb';
  const STORE_ID = 'website';
  const CHANNEL = 'online';

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
  // AABB: a pair followed by a different pair (e.g. 1122)
  function hasAABB(d) {
    const m = d.match(/(\d)\1(\d)\2/);
    return !!m && m[1] !== m[2];
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

    // Grouped pair patterns (priority: AABBCCDD > AABBCC > AAABBB > AABB)
    if (hasAABBCCDD(d)) {
      tags.push({ label: 'AABBCCDD', cls: 'aabbccdd' });
    } else if (hasAABBCC(d)) {
      tags.push({ label: 'AABBCC', cls: 'aabbcc' });
    } else if (hasAAABBB(d)) {
      tags.push({ label: 'AAABBB', cls: 'aaabbb' });
    }

    // Sequence (3+ ascending or descending consecutive digits)
    for (let i = 0; i < d.length - 2; i++) {
      if (+d[i+1] === +d[i]+1 && +d[i+2] === +d[i]+2) {
        tags.push({ label: 'Sequence', cls: 'sequence' }); break;
      }
      if (+d[i+1] === +d[i]-1 && +d[i+2] === +d[i]-2) {
        tags.push({ label: 'Sequence', cls: 'sequence' }); break;
      }
    }

    // Round ending (only if nothing else already tags this)
    const hasRepeat = tags.some(t => ['quint','quad','triple'].includes(t.cls));
    if (!hasRepeat && (d.endsWith('0000') || d.endsWith('000') || d.endsWith('500'))) {
      tags.push({ label: 'Round', cls: 'round' });
    }

    // AABB (fallback if no larger grouped pattern matched)
    const hasGrouped = tags.some(t => ['aabbccdd','aabbcc','aaabbb','quint','quad'].includes(t.cls));
    if (!hasGrouped && hasAABB(d)) {
      tags.push({ label: 'AABB', cls: 'aabb' });
    }

    // Pair fallback (only if nothing else classified it)
    if (tags.length === 0) {
      const pairs = d.match(/(\d)\1/g);
      if (pairs && pairs.length > 0) {
        tags.push({ label: pairs.length > 1 ? 'Pairs' : 'Pair', cls: 'pair' });
      }
    }

    return tags.slice(0, 2);
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
    if (d.endsWith('000')) score += 15;
    if (d.endsWith('0000')) score += 30;
    return score;
  }

  // --- Create a fresh session ---
  async function createSession() {
    const data = await apiCall({ query: '{ sessionId }' }, 'none');
    const sid = data?.data?.sessionId;
    if (!sid) throw new Error('Failed to create session');
    return sid;
  }

  // --- Add plan to cart ---
  async function setupCart() {
    // Navigate cart to get a plan loaded
    const cartQuery = `{ cart { items { ... on MobilePlanCartItem { id plan { id name } } } } }`;
    const cartData = await apiCall({ query: cartQuery });

    const existingPlan = cartData?.data?.cart?.items?.[0]?.plan;
    if (existingPlan?.id) {
      return existingPlan;
    }

    // Try to add plan via addMobilePlanToCart
    const addQuery = `mutation {
      addMobilePlanToCart(input: { planId: "${DEFAULT_PLAN}", storeId: "${STORE_ID}", channel: "${CHANNEL}" }) {
        items { ... on MobilePlanCartItem { id plan { id name } } }
      }
    }`;
    try {
      const addData = await apiCall({ query: addQuery });
      const added = addData?.data?.addMobilePlanToCart?.items?.[0]?.plan;
      if (added?.id) return added;
    } catch (e) {
      // Mutation name might differ, try cart query again
    }

    // Re-check cart
    const recheck = await apiCall({ query: cartQuery });
    const plan = recheck?.data?.cart?.items?.[0]?.plan;
    if (plan?.id) return plan;

    throw new Error('No plan in cart. Open amaysim.com.au and add a plan to cart first.');
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
    setStatus('yellow', 'Connecting...');

    // Load history
    const saved = await chrome.storage.local.get(['sessionId', 'planId', 'results', 'historyLog', 'sessionCount']);
    if (saved.historyLog) { historyLog = saved.historyLog; $('totalLogged').textContent = historyLog.length; }
    if (saved.sessionCount) $('totalSessions').textContent = saved.sessionCount;
    if (saved.results) { allResults = saved.results; $('totalFound').textContent = allResults.length; }

    // 1. Try saved session
    if (saved.sessionId) {
      setStatus('yellow', 'Checking saved session...');
      try {
        if (await tryConnect(saved.sessionId)) return;
      } catch (e) { /* expired */ }
    }

    // 2. Try auto-detect from amaysim page
    setStatus('yellow', 'Detecting from page...');
    try {
      const resp = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_PAGE_SESSION' }, r => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (r?.error) reject(new Error(r.error));
          else resolve(r);
        });
      });
      if (resp.sessionId) {
        setStatus('yellow', 'Found session, connecting...');
        try {
          if (await tryConnect(resp.sessionId)) return;
        } catch (e) { /* no plan in cart */ }
      }
    } catch (e) {
      // No amaysim tab or injection failed
    }

    // 3. Fall back to manual connect
    showConnectBox();
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
    let filtered = allResults;
    if (currentFilter === 'free') filtered = allResults.filter(r => !r.isPremium);
    if (currentFilter === 'premium') filtered = allResults.filter(r => r.isPremium);

    filtered = [...filtered].sort((a, b) => {
      if (currentSort === 'recent') return b.foundAt - a.foundAt;
      return b.score - a.score;
    });

    resultsCount.textContent = `${filtered.length} numbers (${allResults.filter(r=>!r.isPremium).length} free, ${allResults.filter(r=>r.isPremium).length} premium)`;

    if (filtered.length === 0) {
      resultsList.innerHTML = '<div class="results-empty">No results yet. Run a search or scan first.</div>';
      return;
    }

    resultsList.innerHTML = filtered.slice(0, 100).map(r => {
      const isNew = lastSearchNumbers.has(r.number);
      const tags = getNumberTags(r.number);
      return `
      <div class="number-card${isNew ? ' new-result' : ''}">
        <div>
          <div class="num">${r.formatted}</div>
          <div class="tags">
            ${isNew ? '<span class="tag new">New</span>' : ''}
            ${tags.map(t => `<span class="tag ${t.cls}">${t.label}</span>`).join('')}
            ${r.searchTerm ? `<span class="tag search">${r.searchTerm}</span>` : ''}
          </div>
        </div>
        <div class="meta">
          <div class="score">score ${r.score}</div>
          <span class="badge ${r.isPremium ? 'premium' : 'free'}">${r.isPremium ? '$30' : 'FREE'}</span>
          <div class="found-date">${new Date(r.foundAt).toLocaleDateString()}</div>
        </div>
      </div>`;
    }).join('');
  }

  function switchToResults() {
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="results"]').classList.add('active');
    $('panel-results').classList.add('active');
    renderResults();
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
      searchBtn.disabled = true;
      searchBtn.textContent = '...';
      lastSearchNumbers = new Set();
      try {
        const nums = await queryNumbers(digits);
        if (searchTerm) nums.forEach(n => { if (n.number.includes(digits)) n.searchTerm = searchTerm; });
        nums.forEach(n => lastSearchNumbers.add(n.number));
        addResults(nums);
        if (nums.length === 0) {
          searchResults.innerHTML = '<div class="results-empty" style="padding:15px">No numbers found for this pattern.</div>';
        } else {
          switchToResults();
        }
      } catch (e) {
        searchResults.innerHTML = `<div class="results-empty" style="padding:15px;color:#f44336">${e.message}</div>`;
      }
      searchBtn.disabled = false;
      searchBtn.textContent = 'Search';
    } else {
      // Longer input: generate sub-patterns and bulk scan
      await runBulkScan(generateSubPatterns(digits), searchTerm, digits);
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

  // --- Bulk Scan ---
  async function runBulkScan(patterns, searchTerm, searchDigits) {
    if (scanning) return;
    if (!planId) { alert('Not ready yet.'); return; }
    scanning = true;
    stopRequested = false;
    lastSearchNumbers = new Set();
    const total = patterns.length;

    scanProgress.classList.add('active');
    stopScanBtn.style.display = 'block';
    document.querySelectorAll('.preset-btn, #searchBtn').forEach(b => b.disabled = true);

    let scanned = 0;
    let found = 0;

    for (const pat of patterns) {
      if (stopRequested) break;
      try {
        const nums = await queryNumbers(pat);
        if (searchTerm && searchDigits) nums.forEach(n => { if (n.number.includes(searchDigits)) n.searchTerm = searchTerm; });
        nums.forEach(n => lastSearchNumbers.add(n.number));
        const added = addResults(nums);
        found += added;
      } catch (e) { /* skip */ }

      scanned++;
      const pct = Math.round((scanned / total) * 100);
      progressFill.style.width = pct + '%';
      progressText.textContent = `${scanned}/${total} patterns | ${found} new numbers found`;
      await new Promise(r => setTimeout(r, 300));
    }

    scanning = false;
    stopScanBtn.style.display = 'none';
    document.querySelectorAll('.preset-btn, #searchBtn').forEach(b => b.disabled = false);
    progressText.textContent = `Done! ${found} new numbers across ${scanned} patterns.`;

    switchToResults();
  }

  stopScanBtn.addEventListener('click', () => { stopRequested = true; });

  // --- Scan presets ---
  // Triples scan: AAA (3x), AAAA (4x), AAAAA (5x) for each digit 0-9
  $('scanTriples').addEventListener('click', () => {
    const pats = [];
    for (let d = 0; d <= 9; d++) {
      pats.push(`${d}${d}${d}`);
      pats.push(`${d}${d}${d}${d}`);
      pats.push(`${d}${d}${d}${d}${d}`);
    }
    runBulkScan(pats);
  });

  // All Doubles scan: AABB for each distinct digit pair (post-filter tags mark AABBCC / AABBCCDD)
  $('scanDoubleDoubles').addEventListener('click', () => {
    const pats = [];
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${a}${b}${b}`);
    runBulkScan(pats);
  });

  // AAABBB scan: search 5-char prefix AAABB for each distinct digit pair.
  // The API caps filters at 5 chars, so AAABB catches everything that could become AAABBB;
  // the AAABBB tag highlights the true matches in the Results tab.
  $('scanTripleTriples').addEventListener('click', () => {
    const pats = [];
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${a}${a}${b}${b}`);
    runBulkScan(pats);
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
    runBulkScan(sequencePatterns());
  });

  $('scanAll').addEventListener('click', () => {
    const pats = [];
    // Triples + quads + quints
    for (let d = 0; d <= 9; d++) {
      pats.push(`${d}${d}${d}`);
      pats.push(`${d}${d}${d}${d}`);
      pats.push(`${d}${d}${d}${d}${d}`);
    }
    // AABB pairs
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${a}${b}${b}`);
    // AAABBB prefixes (5-char AAABB)
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${a}${a}${b}${b}`);
    // Sequences
    pats.push(...sequencePatterns());
    runBulkScan([...new Set(pats)]);
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
    lastSearchNumbers = new Set();
    await chrome.storage.local.set({ results: [] });
    $('totalFound').textContent = '0';
    renderResults();
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
