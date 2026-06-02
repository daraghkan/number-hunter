# Number Hunter

A Chrome extension for finding memorable phone numbers available on amaysim.com.au. Search by digits or words, run pattern scans, score numbers by memorability, favourite the good ones, and copy them to your clipboard with one click.

## How It Works

Number Hunter creates its own amaysim browser session, adds a plan to the cart in the background, and uses amaysim's GraphQL API to enumerate available phone numbers matching the filters you give it. Numbers are scored and tagged client-side by their memorability patterns.

### Setup

1. Clone the repo and load as an unpacked Chrome extension:
   ```bash
   git clone https://github.com/daraghkan/number-hunter.git
   ```
2. Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the repo folder.
3. Click the Number Hunter icon. While it sets itself up, the status bar shows **"Setting up — please wait, no action needed…"**. Once that bar disappears, you're connected and ready.

No amaysim tab or manual setup is needed. If auto-setup ever fails, the extension shows a step-by-step explainer for grabbing a session ID from amaysim.com.au and pasting it in manually.

### Searching

Type digits or a word into the search box and hit Search. Every search runs as a background scan using the same deep, multi-session method as the Pattern Scans below (see [Deep + multi-session by default](#deep--multi-session-by-default)), so it keeps running if you close the popup and shows up in **Recent Searches**.

- **Digits** (1-5 characters): scans for numbers containing that pattern.
- **Words**: converted to digits using T9 phone keypad mapping (e.g. COOL = 2665), then scanned.
- **Longer input** (6+ characters): automatically split into 3-to-5-digit sub-patterns and scanned in bulk.

A live hint shows the digit conversion as you type letters.

### Find Best Number

A single top-level button that runs a full scan across all pattern types (using the default deep, multi-session method), jumps you to the **All Numbers** tab sorted by score, and highlights the winning card with a gold border and `TOP SCORE` ribbon.

### Pattern Scans

Run bulk scans across many patterns at once:

| Scan | What it searches |
|------|-----------------|
| **Triples** | AAA for each digit (10 patterns) |
| **Quads** | AAAA for each digit (10 patterns) |
| **Quints** | AAAAA for each digit (10 patterns) |
| **All Doubles** | Every AABB combination (90 patterns); longer runs like AABBCC and AABBCCDD get tagged when found |
| **AAABBB** | Every triple-triple pair like 111222 (90 patterns). The API caps filters at 5 chars, so this fetches via the `AAABB` proxy but only records true `AAABBB` numbers as matches. |
| **ABAB** | Every alternating pair like 1212, 3434 (90 patterns) |
| **Mirrors** | Every ABBA palindrome of 4 like 1221, 3443 (90 patterns) |
| **Sequences** | 4 and 5 digit ascending/descending runs like 1234, 98765 (22 patterns) |
| **Round 00** | Ends in 100, 200, ..., 900 (9 patterns) |

#### Deep + multi-session by default

Every scan runs the widest-coverage method automatically (there are no toggles):

- **3 passes per filter** -- each filter is queried 3 times. The amaysim API tracks a `flushList` of numbers it has already shown you and rotates fresh ones in, so repeating the same filter yields up to 3x more candidates.
- **3 rotated sessions** -- after finishing one pass of all patterns, the extension creates a brand-new amaysim session (fresh `sessionId` + cart) and runs the same scan again, three times total. Each session has its own number pool, so this surfaces numbers the previous session never had access to.

Because both are always on, scans take longer than a single pass — roughly 9x — but find far more numbers.

Scans run with a 300ms delay between API calls. A progress bar pinned to the bottom of the popup shows the session count (`session 1/3`), pass number (`pass 1/3`), and an ETA. For an explicit word/number search it shows the running **match count**; for a pattern scan it shows how many **new** numbers were found. The **Stop** button next to it works mid-scan.

#### Scans keep running when the popup closes

The scan loop runs in the background service worker, not in the popup. Click somewhere else, the popup closes, but the scan keeps going. Reopen the popup and the progress bar picks up where it left off; numbers stream into the All Numbers tab live as they're found.

### Searches and Results

- **Recent Searches** -- one entry per search or scan you've run. Click an entry to expand and see only the numbers that actually matched. If nothing matched, it says so. Each entry shows how long ago the search ran. A scan that's **currently running** appears at the top as a blinking **● In progress** card with a live match count, until it finishes and becomes a normal entry.
- **All Numbers** -- every number found across every search. Sort by score or most recent. Filter by All / ★ Favs / Free / Premium. A box at the top explains how to actually claim a number you like (copy it, then select it on amaysim's As You Go plan via **Pick a new number**).

Each number card shows:

- **Formatted number** (e.g. `0412 345 678`)
- **Score** based on memorability
- **Free / $30 premium** badge
- **Pattern tags** identifying what makes the number memorable (up to 4 tags per card)
- **Date found**
- **Search term tag** if the word's digits are found in the number
- **★ favourite toggle** -- click to save the number; favourites survive Clear All History
- **Click anywhere else on the card to copy** the number to your clipboard

### Pattern Tags

Numbers are automatically classified with up to 4 tags:

| Tag | Pattern | Example |
|-----|---------|---------|
| Quint | 5 same digits in a row | 04x **99999** x |
| Quad | 4 same digits | 04x **8888** xx |
| Triple | 3 same digits | 04x **777** xxx |
| AABBCCDD | Four consecutive different-digit pairs | **11223344** |
| AABBBCC | Pair, triple, pair (three distinct digits) | 04 **1122233** x |
| AAABBCC | Triple, pair, pair (three distinct digits) | 04 **1112233** x |
| AABBCCC | Pair, pair, triple (three distinct digits) | 04 **1122333** x |
| AABBCC | Three consecutive different-digit pairs | 04 **112233** xx |
| AAAABB | Quad followed by a pair | 04x **111122** |
| AABBBB | Pair followed by a quad | 04x **112222** |
| AAABBB | Two triples of different digits | 04x **111222** |
| AAABB | Triple followed by a pair | 04x **11122** x |
| AABBB | Pair followed by a triple | 04x **11222** x |
| ABCABC | A 3-digit block repeated, all distinct | 04 **123123** xx |
| ABAB | Alternating two distinct digits | 04xx **1212** xx |
| Mirror | 4-character palindrome (ABBA) | 04xx **1221** xx |
| Seq _nnn_ | 3+ ascending or descending run (tag shows the digits, e.g. `Seq 234`) | 04x **2345** xx |
| Round | Ends in 000/0000/500 or any X00 | 04xxxx **3000** or 04xxxx **700** |
| AABB | Two different-digit pairs | 04xxx **1122** x |
| Heavy | A single digit appears 4+ times anywhere | `Heavy 8 ×5` |
| Pair | Contains a double digit | 04xxx **55** xxx |

### Scoring

Numbers are scored by combining bonuses for runs of repeats, pairs, ascending/descending sequences, repeating blocks (ABCABC), alternating pairs (ABAB), mirrors, single-digit dominance, and round endings. A rough calibration:

- **0–30** -- everyday numbers
- **60+** -- rare
- **90+** -- exceptional

### Export and history

The **More actions** menu in the All Numbers tab keeps less-used controls tucked away:

- **Export CSV** / **Export JSON** -- download all-time number history
- **View Full History** -- see every number ever found across all sessions
- **Clear All History** -- delete everything (favourites are preserved)

The **New Session (Fresh Numbers)** button is at the top of the actions area -- creates a new amaysim session for a different number pool while keeping history intact.

## Architecture

```
popup.html / popup.js   -- Extension popup UI and interactions
background.js           -- Service worker. Runs the scan loop, owns scan state,
                           bootstraps fresh sessions for rotation, persists results
                           to chrome.storage.local
content.js              -- Content script relaying messages to page bridge
page-bridge.js          -- Runs in page context to access amaysim sessionStorage
get-session.js          -- Injected by background to extract session ID from an open
                           amaysim tab (used by manual fallback path)
```

The extension uses Chrome's Manifest V3, `chrome.storage.local` for persistence (results, history, favourites, scan state), and communicates with the amaysim GraphQL API at `https://api.amaysim.com.au/mobile/graphql`. Scan state is persisted on every step so a service-worker recycle resumes cleanly.

## License

MIT
