import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:8812/hakko-dashboard.html';
const SORTIE = process.argv[3] || 'captures-parent';
const ROUTES = ['#/', '#/f/b1', '#/archive', '#/archive/b0', '#/recettes', '#/recettes/new', '#/appareils'];

fs.mkdirSync(SORTIE, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'shell',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
});
const rapport = [];
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 860 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  await page.evaluateOnNewDocument((t) => localStorage.setItem('hakko-theme', t), theme);
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) erreurs.push('console: ' + m.text()); });
  for (const route of ROUTES) {
    const url = BASE + route;
    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 3300));
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const fond = getComputedStyle(document.body).backgroundColor;
      return {
        titre: document.querySelector('h1')?.textContent?.trim() ?? null,
        thème: de.getAttribute('data-theme') ?? 'auto',
        fond,
        scrollY: de.scrollHeight - de.clientHeight,
        scrollX: de.scrollWidth - de.clientWidth,
        cartes: document.querySelectorAll('.card').length,
        lignesTableau: document.querySelectorAll('table.data tbody tr').length,
        kpis: [...document.querySelectorAll('.kpi')].map((k) => k.textContent.replace(/\s+/g, ' ').trim()),
        onglets: [...document.querySelectorAll('.tabs [role=tab]')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()),
        active: document.querySelector('.tabs [aria-selected=true]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      };
    });
    const nom = `${SORTIE}/${theme}-${route.replace(/[#/]/g, '_') || '_'}${route.endsWith('/new') ? '' : ''}.png`;
    await page.screenshot({ path: nom });
    rapport.push({ route, theme, fichier: nom, ...m });
  }
  rapport.push({ theme, erreurs });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(rapport, null, 1));
