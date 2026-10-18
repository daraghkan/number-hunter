| Summary | Instructions & Context | Urgency | Effort | Impact | Risk | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| Stop rewriting all results every scan step | `mergeResults` in `background.js` reads, sorts and rewrites the whole `results` and `historyLog` every 300 ms, and the popup re-renders on each change. This gets slow as history grows. Batch the writes, or only write when something new was found. | 4 | 4 | 5 | 3 | Not started |
| Drop the unused `www.amaysim.com.au` host permission | Only the removed tab-session injection used it. Check that the manual-connect path doesn't need it, then remove it from `manifest.json`. | 2 | 1 | 2 | 2 | Not started |
| Fix the 1-second clear-up race in `finalizeScan` | `background.js` clears `scanState` after a 1 s timer. A scan started inside that second would be wiped. The popup currently prevents this, but the timer should check that it's clearing the same scan. | 2 | 1 | 2 | 1 | Not started |
