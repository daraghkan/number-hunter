# Number Hunter

A Chrome extension for finding memorable phone numbers available on amaysim.com.au. Search by digits or words, run pattern scans, and score numbers by memorability.

## How It Works

Number Hunter connects to the amaysim API through your browser session and searches for available phone numbers matching patterns you specify. Numbers are scored and tagged by their memorability patterns.

### Setup

1. Clone the repo and load as an unpacked Chrome extension:
   ```bash
   git clone https://github.com/daraghkan/number-hunter.git
   ```
2. Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the repo folder
3. Open [amaysim.com.au](https://www.amaysim.com.au), add any plan to your cart
4. Press F12 on the amaysim page, run `copy(sessionStorage.getItem('sessionId'))` in the Console
5. Click the Number Hunter extension icon, paste the session ID into the connect box

The status bar only appears if something needs attention. Once connected, it disappears and you're ready to search.

### Searching

Type digits or a word into the search box and hit Search.

- **Digits** (1-5 characters): searches the amaysim API directly for numbers containing that pattern
- **Words**: converted to digits using T9 phone keypad mapping (e.g. COOL = 2665) and searched
- **Longer input** (6+ characters): automatically split into sub-patterns and scanned as a bulk search

A live hint shows the conversion as you type letters.

### Pattern Scans

Run bulk scans across many patterns at once:

| Scan | What it searches |
|------|-----------------|
| **Repeats** | AAA, AAAA, AAAAA for each digit (30 patterns) |
| **All Doubles** | Every AABB combination (90 patterns) |
| **AAABBB** | Every triple-triple pair like 111222 (90 patterns) |
| **Sequences** | 4 and 5 digit ascending/descending runs like 1234, 98765 (22 patterns) |
| **Full Scan** | All of the above combined |

Scans run with a 300ms delay between API calls. A progress bar shows status and you can stop at any time.

### Results

All results go to the Results tab. Each number card shows:

- **Formatted number** (e.g. 0412 345 678)
- **Score** based on memorability (repeats, sequences, palindromes)
- **Free / $30 premium** badge
- **Pattern tags** identifying what makes the number memorable
- **Date found**
- **"New" tag** on numbers from the most recent search (clears on next search)
- **Search term** shown if the number was found via a word search

Filter results by All / Free only / Premium.

### Pattern Tags

Numbers are automatically classified with up to 2 tags:

| Tag | Pattern | Example |
|-----|---------|---------|
| Quint | 5 same digits in a row | 04x **99999** x |
| Quad | 4 same digits | 04x **8888** xx |
| Triple | 3 same digits | 04x **777** xxx |
| AAABBB | Two triples of different digits | 04x **111222** |
| AABBCCDD | Four consecutive different-digit pairs | **11223344** |
| AABBCC | Three consecutive different-digit pairs | 04 **112233** xx |
| Sequence | 3+ ascending or descending | 04x **2345** xx |
| Palindrome | Last 4 digits mirror | 04xxxx **1221** |
| Round | Ends in 000/0000/500 | 04xxxx **3000** |
| AABB | Two different-digit pairs | 04xxx **1122** x |
| Pair | Contains a double digit | 04xxx **55** xxx |

### Export

From the Results tab:

- **Export CSV** / **Export JSON** -- download all-time number history
- **View Full History** -- see every number ever found across all sessions
- **New Session** -- get a fresh number pool (history is preserved)
- **Clear All History** -- delete everything

## Architecture

```
popup.html/js     -- Extension popup UI and main logic
background.js     -- Service worker proxying API calls to amaysim
content.js        -- Content script relaying messages to page bridge
page-bridge.js    -- Runs in page context to access sessionStorage
get-session.js    -- Injected by background to extract session ID
```

The extension uses Chrome's Manifest V3, `chrome.storage.local` for persistence, and communicates with the amaysim GraphQL API at `https://api.amaysim.com.au/mobile/graphql`.

## License

MIT
