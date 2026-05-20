---
name: run-levelup
description: Launch, screenshot, and smoke-test the Level Up PWA — a vanilla-JS gamified task tracker with a 7-day-average high score, a training module, and offline support via a service worker. Use this for "run levelup", "start the app", "screenshot the dashboard", "verify a UI change", "test on mobile viewport", or any change that touches index.html, css/style.css, js/main.js, js/training.js, js/storage.js, sw.js, or manifest.json.
---

# Level Up — Running & Driving the App

Level Up is a **build-step-free** Vanilla-JS PWA. There's no bundler, no
package.json, no node_modules. Source files are served as-is. All
state lives in `localStorage` under the `taskPWA_` prefix.

| File              | What lives here                                              |
| ----------------- | ------------------------------------------------------------ |
| `index.html`      | All DOM (5 modals, header, dashboard, task list, training)   |
| `css/style.css`   | Glassmorphism theme, responsive `@media (max-width: 480px)`  |
| `js/main.js`      | Score / streak / 7-day-avg / rendering / Sortable wiring     |
| `js/training.js`  | Training plans, sets/reps, progression, deload, best-form    |
| `js/storage.js`   | `taskPWA_*` localStorage wrapper, dispatches `storage-error` |
| `sw.js`           | Service worker (`CACHE_NAME` — bump on every code change)    |
| `manifest.json`   | PWA manifest; icons in `icons/`                              |

Driven from this skill via a Playwright-based Node driver at
**`.claude/skills/run-levelup/driver.mjs`**. All paths in this file are
relative to the repository root (`/home/user/levelup`).

---

## Prerequisites

Already installed in this environment — no setup needed:

- `python3` (for the static server)
- Node 22 with **global** Playwright at `/opt/node22/lib/node_modules/playwright/`
- Chromium at `/opt/pw-browsers/chromium-1194/` (auto-discovered by Playwright)

The driver imports Playwright via an explicit path
(`/opt/node22/lib/node_modules/playwright/index.mjs`) — there is **no**
local `node_modules`. Override with `PLAYWRIGHT_PATH=...` if needed.

---

## Run (agent path — use this)

### 1. Start the static server (port 8765)

```bash
python3 -m http.server 8765 > /tmp/levelup-server.log 2>&1 &
```

> **Port 8765, not 8000.** Devs sometimes already have 8000 in use.
> Override with `LEVELUP_URL=http://localhost:8000` for the driver.

### 2. Drive the app

```bash
# Full smoke (opens add-task / training / calendar modals; ~5s)
node .claude/skills/run-levelup/driver.mjs smoke

# Seed 7 days of demo history + 4 tasks, then screenshot dashboard + calendar
node .claude/skills/run-levelup/driver.mjs seed-and-shot

# One-off screenshot (optional flags: --mobile, --seed)
node .claude/skills/run-levelup/driver.mjs screenshot dashboard.png
node .claude/skills/run-levelup/driver.mjs screenshot mobile.png --mobile --seed
```

Screenshots land in `.claude/skills/run-levelup/screenshots/`. **Always
view at least one screenshot after a UI change** — Playwright reports
"shot ✓" even when the page is blank or showing an error overlay.

### 3. Stop the server when done

```bash
pkill -f "python3 -m http.server 8765"
```

---

## Run (human path)

```bash
python3 -m http.server 8765
# open http://localhost:8765/ in a browser
```

On the live site the same code runs from Cloudflare Pages
(branch: `main`). Service Worker is registered with scope `./`.

---

## Testing changes that touch state

The app is heavily stateful (`taskPWA_tasks`, `taskPWA_dailyHistory`,
`taskPWA_trainingHistory`, `taskPWA_customPlans`). To test against
realistic data without clicking through dozens of completions:

```js
// driver.mjs already does this — use `seedDemoData()` as a template.
await page.addInitScript(() => {
  localStorage.setItem('taskPWA_tasks', JSON.stringify([...]));
  localStorage.setItem('taskPWA_dailyHistory', JSON.stringify({
    '2026-05-18': {
      score: 87,
      tasksDone: [{ id: 't1', name: '30 Min Lesen', points: 10, quantity: 3, totalPoints: 30 }]
    }
  }));
});
```

**Shape gotcha:** `tasksDone` is an **array of objects**
`{id, name, points, quantity, totalPoints}`, not a map. Getting this
wrong throws `tasksDone.map is not a function` on first render.

---

## Logical-day model

The app rolls the day over at **03:00 local time** via a 3-hour
subtraction in `getLogicalDate()` (`js/main.js`). To test the rollover:

```js
// inside addInitScript
const FAKE_NOW = new Date('2026-05-20T02:30:00').getTime();
const _Date = Date;
globalThis.Date = class extends _Date {
  constructor(...a) { return a.length ? new _Date(...a) : new _Date(FAKE_NOW); }
  static now() { return FAKE_NOW; }
};
```

Note that the **7-day average** filters by `getMonth()` of the logical
"today" — month rollover at 00:00–03:00 on the 1st is the known edge
case (B1 in the review).

---

## Service Worker — when to bump `CACHE_NAME`

`sw.js` precaches `./`, `index.html`, all `js/*`, `css/style.css`, the
manifest, and the three icons. **Any change to a precached file
requires bumping `CACHE_NAME`** (currently `levelup-v10`) so existing
clients pick up the new shell on next load.

External resources (Google Fonts) are intentionally **not** in
`SHELL_ASSETS` — they're cached opportunistically by the fetch handler.
`addAll()` is all-or-nothing and would brick installs if Fonts were
blocked.

---

## Gotchas

- **`#task-list` is not "visible" when empty.** It's an `<ul>` with
  height 0, so `waitForSelector('#task-list')` (defaults to `visible`)
  hangs. The driver waits for `#current-month` to be populated instead
  — a reliable signal that `init()` finished.
- **Modal close ≠ "selector hidden".** Modals add the `.hidden` class
  (`display: none`). Use
  `page.waitForSelector('#add-task-modal', { state: 'hidden' })`, not
  `waitForSelector('#add-task-modal.hidden')` (which waits for
  visibility, which never comes).
- **Google Fonts `ERR_CERT_AUTHORITY_INVALID` in console** — harmless
  in the sandbox. The system font stack takes over. Don't chase it.
- **Service-Worker registration in headless Chromium** registers fine
  but the install step quietly fails if any `SHELL_ASSETS` path is
  broken. Check `chrome://serviceworker-internals/` on a real browser
  after editing `sw.js`.
- **SortableJS for mobile drag** uses `forceFallback: true` + a
  dedicated `.drag-handle` span with `touch-action: none`. Don't
  re-add `delay` — it competes with browser scroll on touch.
- **CSS cascade in the header pills.** `.btn-primary` is defined after
  `.btn-pill` in `style.css`, so a single-class `.btn-pill` rule is
  overridden. The compound `.btn-primary.btn-pill, .btn-secondary.btn-pill`
  is intentional — keep it that way.
- **`storage.js` is `async` but synchronous under the hood.** Don't
  rely on its promise for ordering of multiple writes; today they
  resolve immediately. Migration to IndexedDB is a tracked TODO.
- **No tests.** The codebase has no unit tests. Hand-verify state
  logic (`calculate7DayAverage`, `calculateStreak`, `completeTask`) by
  seeding `dailyHistory` and reading the dashboard.

---

## Troubleshooting

| Symptom                                                          | Fix                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Cannot find package 'playwright'`                               | Driver imports from global node_modules. Set `PLAYWRIGHT_PATH=/path/to/playwright/index.mjs` if installed elsewhere. |
| Driver hangs on `waitForFunction` for `#current-month`           | A JS error broke `init()`. Re-run with `node ...` and watch the `[pageerror]` lines. |
| Server returns `404` for `js/storage.js`                         | Wrong CWD — run `python3 -m http.server` from the repo root, not from `js/`.         |
| Service Worker keeps serving stale JS                            | You forgot to bump `CACHE_NAME` in `sw.js`. Hard-reload + un-register in DevTools.   |
| `tasksDone.map is not a function`                                | Seed data uses an object; it must be an array — see "Testing changes that touch state". |
| Mobile drag-and-drop not working                                 | Check that the `.drag-handle` span exists per task row and that `forceFallback: true` is still in the Sortable config. |

---

## Quick reference — IDs you'll touch most

- `#main-view` – dashboard view
- `#training-section` – training module (toggled `.hidden`)
- `#task-list` – ul that gets re-rendered on every change
- `#add-task-modal`, `#edit-task-modal`, `#quantity-modal`,
  `#calendar-modal`, `#custom-training-modal`, `#confirm-modal`
- `#score-today`, `#score-target`, `#score-progress`, `#streak-display`,
  `#dashboard-message`
- `#current-month` – populated last during `init()`, good readiness probe
