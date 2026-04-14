// Content script - ISOLATED world
// Injects page-bridge.js into the page and relays messages

// Inject the page bridge script into MAIN world via <script> tag
const script = document.createElement('script');
script.src = chrome.runtime.getURL('page-bridge.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SESSION' || msg.type === 'REFRESH_SESSION') {
    const responseType = msg.type === 'GET_SESSION' ? 'SESSION_RESULT' : 'REFRESH_RESULT';

    const handler = (event) => {
      if (event.data?.source === 'amaysim-hunter-page' && event.data.type === responseType) {
        window.removeEventListener('message', handler);
        clearTimeout(timer);
        sendResponse(event.data);
      }
    };

    window.addEventListener('message', handler);
    window.postMessage({ source: 'amaysim-hunter-content', type: msg.type }, '*');

    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      sendResponse({ error: 'Timeout - bridge not responding' });
    }, 3000);

    return true; // async response
  }
});

console.log('[Number Hunter] Content script loaded');
