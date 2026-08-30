# My Projects

A small repository of personal tools, built with Claude Code.

## Projects

### budget-ledger
Monthly budget ledger — enter your main income, add any extra income sources,
paste or quick-add your expenses (with categories and subcategories), and see
what's left, month by month.

**Features**
- Main income + unlimited additional income sources (each with a label and amount)
- Quick-add expenses via category/subcategory chips, or paste free text from Notes
- Automatic category breakdown
- Per-month history (browse previous months, data is saved for each)
- Hebrew / English toggle
- No build step — plain HTML + React (via CDN) + in-browser Babel

**Data storage:** uses the browser's `localStorage`, so data is saved per-device
only (not synced across devices, not shared between visitors).

**Run locally:**

cd budget-ledger
python3 -m http.server 8000   # or: py -m http.server 8000 on Windows

Then open http://localhost:8000 — do not open index.html directly via
double-click, since browsers block some required features on file:// URLs.

**Deploy:** drag the `budget-ledger` folder (or connect this repo) to
[Netlify](https://netlify.com) — no build command needed.
