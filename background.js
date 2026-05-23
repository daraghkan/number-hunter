// Background service worker - v3.0
// Runs the scan loop here so it survives the popup closing.

const GRAPHQL_URL = 'https://api.amaysim.com.au/mobile/graphql';

let scanState = null;
let scanTimerId = null;

// --- Resume on service worker restart ---
(async () => {
  const { scanState: stored } = await chrome.storage.local.get('scanState');
  if (stored && stored.running) {
    scanState = stored;
    scheduleStep(50);
  }
})();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // API call to amaysim GraphQL (used by popup for non-scan calls)
  if (msg.type === 'API_CALL') {
    const headers = { 'Content-Type': 'application/json' };
    if (msg.sessionId) headers['authorization'] = msg.sessionId;
    fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(msg.payload)
    })
      .then(r => r.json())
      .then(data => sendResponse({ data }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  // Get session from amaysim page using file-based injection (no eval)
  if (msg.type === 'GET_PAGE_SESSION') {
    chrome.tabs.query({ url: 'https://www.amaysim.com.au/*' }, (foundTabs) => {
      if (!foundTabs || !foundTabs.length) {
        sendResponse({ error: 'No amaysim tab open' });
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: foundTabs[0].id },
        world: 'MAIN',
        files: ['get-session.js']
      }).then(results => {
        const sid = results?.[0]?.result;
        sendResponse({ sessionId: sid });
      }).catch(err => {
        sendResponse({ error: err.message });
      });
    });
    return true;
  }

  // Start a scan in the background
  if (msg.type === 'START_SCAN') {
    startScan(msg.opts).then(() => sendResponse({ ok: true }));
    return true;
  }

  // Stop the current scan
  if (msg.type === 'STOP_SCAN') {
    if (scanState) scanState.stopRequested = true;
    sendResponse({ ok: true });
    return;
  }

  // Get current scan state (for popup resume)
  if (msg.type === 'GET_SCAN_STATE') {
    sendResponse({ scanState });
    return;
  }
});

async function startScan(opts) {
  // If a scan is already running, ignore.
  if (scanState && scanState.running) return;
  const sessions = Math.max(1, opts.sessions || 1);
  scanState = {
    running: true,
    done: false,
    stopRequested: false,
    patterns: opts.patterns,
    repeats: opts.repeats || 1,
    sessionsTotal: sessions,
    sessionsDone: 1, // the initial session counts as the first
    label: opts.label || 'Scan',
    searchTerm: opts.searchTerm || null,
    searchDigits: opts.searchDigits || null,
    planId: opts.planId,
    sessionId: opts.sessionId,
    idx: 0,
    repIdx: 0,
    scanned: 0,
    found: 0,
    total: (opts.patterns?.length || 0) * (opts.repeats || 1) * sessions,
    matchedNumbers: [],
    startedAt: Date.now()
  };
  await persistScanState();
  scheduleStep(0);
}

function scheduleStep(delay) {
  clearTimeout(scanTimerId);
  scanTimerId = setTimeout(scanStep, delay);
}

async function scanStep() {
  if (!scanState) return;
  if (scanState.stopRequested) {
    await finalizeScan();
    return;
  }
  if (scanState.idx >= scanState.patterns.length) {
    // Pattern pass complete for this session — rotate if more sessions left
    if (scanState.sessionsDone < scanState.sessionsTotal) {
      try {
        const fresh = await bootstrapNewSession();
        scanState.sessionId = fresh.sessionId;
        scanState.planId = fresh.planId;
        scanState.sessionsDone++;
        scanState.idx = 0;
        scanState.repIdx = 0;
        await persistScanState();
        scheduleStep(400);
        return;
      } catch (e) {
        console.warn('[Number Hunter] Session rotation failed, finalizing:', e);
        await finalizeScan();
        return;
      }
    }
    await finalizeScan();
    return;
  }

  const pat = scanState.patterns[scanState.idx];
  try {
    const nums = await fetchNumbers(pat, scanState.planId, scanState.sessionId);
    if (scanState.searchTerm && scanState.searchDigits) {
      nums.forEach(n => { if (n.number.includes(scanState.searchDigits)) n.searchTerm = scanState.searchTerm; });
    }
    nums.forEach(n => {
      if (!scanState.searchDigits || n.number.includes(scanState.searchDigits)) {
        if (!scanState.matchedNumbers.includes(n.number)) scanState.matchedNumbers.push(n.number);
      }
    });
    const added = await mergeResults(nums);
    scanState.found += added;
  } catch (e) {
    // skip errors silently — backend sometimes 500s on certain filters
  }

  scanState.scanned++;
  scanState.repIdx++;
  if (scanState.repIdx >= scanState.repeats) {
    scanState.repIdx = 0;
    scanState.idx++;
  }
  await persistScanState();
  scheduleStep(300);
}

async function finalizeScan() {
  if (!scanState) return;
  await logSearch({
    input: scanState.label,
    digits: scanState.searchDigits || null,
    matches: scanState.matchedNumbers,
    timestamp: scanState.startedAt
  });
  scanState.running = false;
  scanState.done = true;
  scanState.finishedAt = Date.now();
  await persistScanState();
  // Clear in-memory after a short delay so the popup can read the final state
  setTimeout(async () => {
    await chrome.storage.local.remove('scanState');
    scanState = null;
  }, 1000);
}

async function persistScanState() {
  if (scanState) await chrome.storage.local.set({ scanState });
}

async function bootstrapNewSession() {
  // Create a brand-new amaysim session and add the default plan to its cart,
  // so we can fetch numbers from a fresh server-side pool.
  const sidResp = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ sessionId }' })
  });
  const sidData = await sidResp.json();
  const sessionId = sidData?.data?.sessionId;
  if (!sessionId) throw new Error('createSession returned no sessionId');

  const cartUrl = '/mobile/cart/unlimited-15gb?storeId=website&channel=online&action=shop';
  const cartResp = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: sessionId },
    body: JSON.stringify({
      query: 'mutation AddToCart($planId: ID!, $cartUrl: String!) { updateCartItemQuantity(planId: $planId, quantity: 1, cartUrl: $cartUrl) { items { ... on MobilePlanCartItem { plan { id } } } } }',
      variables: { planId: 'unlimited-15gb', cartUrl },
      operationName: 'AddToCart'
    })
  });
  const cartData = await cartResp.json();
  const planId = cartData?.data?.updateCartItemQuantity?.items?.[0]?.plan?.id;
  if (!planId) throw new Error('setupCart returned no planId');
  return { sessionId, planId };
}

async function fetchNumbers(filter, planId, sessionId) {
  const query = `mutation updatePhoneNumbers($planId: ID!, $cartItemPlanIndex: Int!, $filter: String, $count: Int!) {
    updatePhoneNumbers(planId: $planId, cartItemPlanIndex: $cartItemPlanIndex, filter: $filter, count: $count) {
      items { ... on MobilePlanCartItem { numbers { reservedNumbers { number isPremium cost } } } }
    }
  }`;
  const headers = { 'Content-Type': 'application/json' };
  if (sessionId) headers['authorization'] = sessionId;
  const body = JSON.stringify({
    query,
    variables: { planId, cartItemPlanIndex: 0, filter, count: 10 },
    operationName: 'updatePhoneNumbers'
  });

  // The MSN backend transiently 500s on the first call for many filters;
  // retry up to 2 times with backoff before giving up.
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 400 + attempt * 200));
    try {
      const resp = await fetch(GRAPHQL_URL, { method: 'POST', headers, body });
      const data = await resp.json();
      if (data?.errors) { lastErr = data.errors[0]?.message; continue; }
      return (data?.data?.updatePhoneNumbers?.items || [])
        .flatMap(i => (i.numbers || []).flatMap(n => n.reservedNumbers || []))
        .map(n => ({ ...n, filter }));
    } catch (e) { lastErr = e.message; }
  }
  console.warn('[Number Hunter] fetchNumbers gave up:', filter, lastErr);
  return [];
}

async function mergeResults(numbers) {
  const { results = [], historyLog = [], sessionId } = await chrome.storage.local.get(['results', 'historyLog', 'sessionId']);
  const seenResults = new Set(results.map(r => r.number));
  const seenHistory = new Set(historyLog.map(r => r.number));
  let added = 0;
  for (const n of numbers) {
    const score = scoreNumber(n.number);
    const entry = {
      number: n.number,
      formatted: formatNum(n.number),
      isPremium: n.isPremium,
      cost: n.cost || 0,
      score,
      filter: n.filter,
      searchTerm: n.searchTerm || null,
      foundAt: Date.now()
    };
    if (!seenResults.has(n.number)) {
      seenResults.add(n.number);
      results.push(entry);
      added++;
    }
    if (!seenHistory.has(n.number)) {
      seenHistory.add(n.number);
      historyLog.push({ ...entry, session: (sessionId || '').slice(0, 8) || 'unknown' });
    }
  }
  results.sort((a, b) => b.score - a.score);
  historyLog.sort((a, b) => b.score - a.score);
  await chrome.storage.local.set({ results, historyLog });
  return added;
}

async function logSearch(entry) {
  const { searches = [] } = await chrome.storage.local.get('searches');
  searches.unshift(entry);
  if (searches.length > 100) searches.length = 100;
  await chrome.storage.local.set({ searches });
}

function formatNum(raw) {
  return raw.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
}

// Scoring — kept in sync with popup.js
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
  const abcabc = d.match(/(\d)(\d)(\d)\1\2\3/);
  if (abcabc && new Set([abcabc[1], abcabc[2], abcabc[3]]).size === 3) score += 25;
  const abab = d.match(/(\d)(\d)\1\2/);
  if (abab && abab[1] !== abab[2]) score += 8;
  const mirror = d.match(/(\d)(\d)\2\1/);
  if (mirror && mirror[1] !== mirror[2]) score += 8;
  const counts = {};
  for (const ch of d) counts[ch] = (counts[ch] || 0) + 1;
  for (const c of Object.values(counts)) if (c >= 4) score += (c - 3) * 8;
  if (d.endsWith('0000')) score += 30;
  else if (d.endsWith('000')) score += 15;
  else if (/[1-9]00$/.test(d)) score += 8;
  return score;
}
