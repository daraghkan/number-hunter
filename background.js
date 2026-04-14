// Background service worker - v2.1

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // API call to amaysim GraphQL
  if (msg.type === 'API_CALL') {
    const headers = { 'Content-Type': 'application/json' };
    if (msg.sessionId) headers['authorization'] = msg.sessionId;

    fetch('https://api.amaysim.com.au/mobile/graphql', {
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
});
