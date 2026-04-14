// Runs in MAIN world (injected via <script> tag)
// Has access to page's sessionStorage

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.source !== 'amaysim-hunter-content') return;

  if (event.data.type === 'GET_SESSION') {
    window.postMessage({
      source: 'amaysim-hunter-page',
      type: 'SESSION_RESULT',
      sessionId: sessionStorage.getItem('sessionId')
    }, '*');
  }

  if (event.data.type === 'REFRESH_SESSION') {
    sessionStorage.clear();
    document.cookie.split(';').forEach(c => {
      document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;';
    });
    window.postMessage({
      source: 'amaysim-hunter-page',
      type: 'REFRESH_RESULT',
      ok: true
    }, '*');
    location.reload();
  }
});

console.log('[Number Hunter] Page bridge loaded');
