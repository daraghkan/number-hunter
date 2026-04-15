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

  // --- Classify a number into tags ---
  function getNumberTags(num) {
    const tags = [];
    const d = num.slice(2); // 8 digits after "04"

    // Quad (4+ repeated digits anywhere)
    if (/(\d)\1{3,}/.test(d)) {
      tags.push({ label: 'Quad', cls: 'quad' });
    } else if (/(\d)\1{2}/.test(d)) {
      // Triple (3 repeated digits, only if not already a quad)
      tags.push({ label: 'Triple', cls: 'triple' });
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

    // Palindrome (last 4 digits mirror)
    const l4 = d.slice(-4);
    if (l4 === l4.split('').reverse().join('')) {
      tags.push({ label: 'Palindrome', cls: 'palindrome' });
    }

    // Round ending (only if not already tagged as Quad/Triple which imply 000/0000)
    const hasQuadOrTriple = tags.some(t => t.cls === 'quad' || t.cls === 'triple');
    if (!hasQuadOrTriple && (d.endsWith('0000') || d.endsWith('000') || d.endsWith('500'))) {
      tags.push({ label: 'Round', cls: 'round' });
    }

    // AABB (double-double pattern, only if not a quad)
    const hasQuad = tags.some(t => t.cls === 'quad');
    if (!hasQuad && /(\d)\1(\d)\2/.test(d)) {
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
    const l4 = d.slice(-4);
    if (l4 === l4.split('').reverse().join('')) score += 12;
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
      setStatus('green', 'Ready');
      planInfo.textContent = plan.name || 'Plan loaded';
      connectBox.classList.add('hidden');
      return true;
    }
    return false;
  }

  function showConnectBox() {
    setStatus('yellow', 'Need connection');
    planInfo.textContent = 'Open amaysim cart page';
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
    statusDot.className = 'status-dot ' + color;
    statusText.textContent = text;
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
        setStatus('green', 'Ready');
        planInfo.textContent = plan.name || 'Plan loaded';
        connectBox.classList.add('hidden');
      } else {
        setStatus('yellow', 'Connected');
        planInfo.textContent = 'No plan in cart - add one on amaysim.com.au';
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

  // --- Render results ---
  function renderResults() {
    let filtered = allResults;
    if (currentFilter === 'free') filtered = allResults.filter(r => !r.isPremium);
    if (currentFilter === 'premium') filtered = allResults.filter(r => r.isPremium);

    resultsCount.textContent = `${filtered.length} numbers (${allResults.filter(r=>!r.isPremium).length} free, ${allResults.filter(r=>r.isPremium).length} premium)`;

    if (filtered.length === 0) {
      resultsList.innerHTML = '<div class="results-empty">No results yet. Run a search or scan first.</div>';
      return;
    }

    resultsList.innerHTML = filtered.slice(0, 100).map(r => `
      <div class="number-card">
        <div>
          <div class="num">${r.formatted}</div>
          ${tagsHtml(getNumberTags(r.number))}
        </div>
        <div class="meta">
          <div class="score">score ${r.score}</div>
          <span class="badge ${r.isPremium ? 'premium' : 'free'}">${r.isPremium ? '$30' : 'FREE'}</span>
        </div>
      </div>
    `).join('');
  }

  function renderSearchResults(numbers) {
    if (numbers.length === 0) {
      searchResults.innerHTML = '<div class="results-empty" style="padding:15px">No numbers found for this pattern.</div>';
      return;
    }
    const scored = numbers.map(n => ({
      raw: n.number,
      formatted: formatNum(n.number),
      isPremium: n.isPremium,
      score: scoreNumber(n.number)
    })).sort((a, b) => b.score - a.score);

    searchResults.innerHTML = scored.map(r => `
      <div class="number-card">
        <div>
          <div class="num">${r.formatted}</div>
          ${tagsHtml(getNumberTags(r.raw))}
        </div>
        <div class="meta">
          <div class="score">score ${r.score}</div>
          <span class="badge ${r.isPremium ? 'premium' : 'free'}">${r.isPremium ? '$30' : 'FREE'}</span>
        </div>
      </div>
    `).join('');
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
    const digits = wordToDigits(raw);

    if (!digits || !/^\d+$/.test(digits)) {
      searchResults.innerHTML = '<div class="results-empty" style="padding:15px;color:#f44336">Could not convert input to digits.</div>';
      return;
    }

    // If 1-5 digits, do a single search. If longer, do a multi-pattern scan.
    if (digits.length <= 5) {
      searchBtn.disabled = true;
      searchBtn.textContent = '...';
      try {
        const nums = await queryNumbers(digits);
        addResults(nums);
        renderSearchResults(nums);
      } catch (e) {
        searchResults.innerHTML = `<div class="results-empty" style="padding:15px;color:#f44336">${e.message}</div>`;
      }
      searchBtn.disabled = false;
      searchBtn.textContent = 'Search';
    } else {
      // Longer input: generate sub-patterns and bulk scan
      await runBulkScan(generateSubPatterns(digits));
    }
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchBtn.click();
  });

  // --- Presets (single-pattern search shortcuts) ---
  document.querySelectorAll('.preset-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      searchInput.value = filter;
      convertedHint.style.display = 'none';
      searchBtn.click();
    });
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
  async function runBulkScan(patterns) {
    if (scanning) return;
    if (!planId) { alert('Not ready yet.'); return; }
    scanning = true;
    stopRequested = false;
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

    tabs.forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="results"]').classList.add('active');
    $('panel-results').classList.add('active');
    renderResults();
  }

  stopScanBtn.addEventListener('click', () => { stopRequested = true; });

  // --- Scan presets ---
  $('scanTriples').addEventListener('click', () => {
    const pats = [];
    for (let d = 0; d <= 9; d++) { pats.push(`${d}${d}${d}`); pats.push(`${d}${d}${d}${d}`); }
    runBulkScan(pats);
  });

  $('scanDoubleDoubles').addEventListener('click', () => {
    const pats = [];
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${a}${b}${b}`);
    runBulkScan(pats);
  });

  $('scanSequences').addEventListener('click', () => {
    runBulkScan(['1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321','2468','1357','8642','7531','100','200','300','400','500','600','700','800','900','1000','2000','3000','5000','8000']);
  });

  $('scanAll').addEventListener('click', () => {
    const pats = [];
    for (let d = 0; d <= 9; d++) { pats.push(`${d}${d}${d}`); pats.push(`${d}${d}${d}${d}`); }
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a !== b) pats.push(`${a}${a}${b}${b}`);
    pats.push('1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321','2468','1357','8642','7531');
    for (let d = 1; d <= 9; d++) pats.push(`${d}00`);
    pats.push('1000','2000','3000','5000','8000');
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
