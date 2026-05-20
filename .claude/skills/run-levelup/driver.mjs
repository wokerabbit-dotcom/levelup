#!/usr/bin/env node
// Driver for the Level Up PWA: launches a headless Chromium via Playwright,
// drives the app, captures screenshots into ./screenshots/.
//
// Usage:
//   node .claude/skills/run-levelup/driver.mjs smoke         # full smoke
//   node .claude/skills/run-levelup/driver.mjs screenshot [path] [--mobile]
//   node .claude/skills/run-levelup/driver.mjs seed-and-shot # seed history + shoot
//
// Assumes a static server is already running at http://localhost:8765
// (see SKILL.md — start it with `python3 -m http.server 8765`).

// Resolve playwright from the global npm prefix so this driver runs without
// a local node_modules. Override with PLAYWRIGHT_PATH if installed elsewhere.
const PW_PATH = process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW_PATH);
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(HERE, 'screenshots');
const BASE = process.env.LEVELUP_URL || 'http://localhost:8765';

mkdirSync(SHOTS, { recursive: true });

const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 800 } };

async function newPage(browser, mobile) {
  const ctx = await browser.newContext(mobile ? MOBILE : DESKTOP);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[console.error]', m.text());
  });
  return { ctx, page };
}

async function open(page) {
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  // main.js boots as an ES module — wait for the first render pass to finish
  // by polling for #current-month being populated (set in init()).
  await page.waitForFunction(() => {
    const el = document.getElementById('current-month');
    return el && el.textContent && el.textContent !== '...';
  }, { timeout: 5000 });
}

async function seedDemoData(page) {
  // Inject realistic demo data into localStorage *before* main.js boots,
  // then reload. Keys must match storage.js (`taskPWA_*`).
  await page.addInitScript(() => {
    const today = new Date();
    const key = (d) => d.toISOString().slice(0, 10);
    const days = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const score = 40 + Math.floor(Math.random() * 60);
      days[key(d)] = {
        score,
        tasksDone: [
          { id: 't1', name: '30 Min Lesen', points: 10, quantity: 3, totalPoints: 30 },
          { id: 't2', name: 'Wasser trinken', points: 2, quantity: Math.ceil(score / 10), totalPoints: score - 30 },
        ],
      };
    }
    localStorage.setItem('taskPWA_tasks', JSON.stringify([
      { id: 't1', name: '30 Min Lesen', points: 10, unit: 'Minute', category: 'routine' },
      { id: 't2', name: 'Wasser trinken', points: 2, unit: 'Glas', category: 'routine', isSimple: false },
      { id: 't3', name: 'Steuererklärung', points: 50, unit: 'Ausführung', category: 'todo', isSimple: true },
      { id: 't4', name: 'Süßes', points: 15, unit: 'Stück', category: 'dontdo' },
    ]));
    localStorage.setItem('taskPWA_dailyHistory', JSON.stringify(days));
  });
}

async function shot(page, name) {
  const path = resolve(SHOTS, name);
  await page.screenshot({ path, fullPage: true });
  console.log('shot →', path);
  return path;
}

const [, , cmd = 'smoke', ...rest] = process.argv;

const browser = await chromium.launch();
try {
  if (cmd === 'smoke') {
    const { page } = await newPage(browser, false);
    await open(page);
    await shot(page, 'dashboard-empty.png');

    // Open + close the "new task" modal
    await page.click('#btn-add-task');
    await page.waitForSelector('#add-task-modal:not(.hidden)');
    await shot(page, 'add-task-modal.png');
    await page.click('#btn-cancel-task');
    await page.waitForSelector('#add-task-modal', { state: 'hidden' });

    // Open training menu
    await page.click('#btn-training-menu');
    await page.waitForSelector('#training-section:not(.hidden)');
    await shot(page, 'training-menu.png');
    await page.click('#btn-close-training');

    // Open calendar modal
    await page.click('#btn-calendar');
    await page.waitForSelector('#calendar-modal:not(.hidden)');
    await shot(page, 'calendar-empty.png');
    await page.click('#btn-close-calendar');

    console.log('smoke OK');
  } else if (cmd === 'seed-and-shot') {
    const { page } = await newPage(browser, false);
    await seedDemoData(page);
    await open(page);
    await shot(page, 'dashboard-seeded.png');
    await page.click('#btn-calendar');
    await page.waitForSelector('#calendar-modal:not(.hidden)');
    await shot(page, 'calendar-seeded.png');
  } else if (cmd === 'screenshot') {
    const name = rest.find((a) => !a.startsWith('--')) || 'screenshot.png';
    const mobile = rest.includes('--mobile');
    const seed = rest.includes('--seed');
    const { page } = await newPage(browser, mobile);
    if (seed) await seedDemoData(page);
    await open(page);
    await shot(page, name);
  } else {
    console.error(`unknown command: ${cmd}`);
    process.exit(2);
  }
} finally {
  await browser.close();
}
