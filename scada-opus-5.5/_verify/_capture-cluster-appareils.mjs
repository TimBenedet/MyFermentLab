import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://192.168.1.51:30090/hakko-dashboard.html';
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'shell', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000 });
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
const err = []; p.on('pageerror', e => err.push(e.message));
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { location.hash = '#/appareils'; });
await new Promise(x => setTimeout(x, 1500));

const infobulles = await p.evaluate(() => [...document.querySelectorAll('#view tbody tr .dev-cell')].map(c => c.getAttribute('title')));
console.log('=== infobulles (identifiant d\'entité) sur les 9 lignes ===');
infobulles.forEach((t, i) => console.log('  ' + (i + 1) + '. ' + t));
console.log('toutes présentes :', infobulles.filter(Boolean).length + '/9');

const etat = await p.evaluate(() => ({
  kpis: [...document.querySelectorAll('.kpis .kpi')].map(k => k.textContent.replace(/\s+/g, ' ').trim()),
  noms: [...document.querySelectorAll('#view tbody tr .dev-cell .nm')].map(n => n.textContent.trim()),
  sousTitres: [...document.querySelectorAll('#view tbody tr .dev-cell .sm.num')].map(n => n.textContent.trim()),
}));
console.log('\n=== page Appareils servie par le cluster ===');
console.log('KPI :', etat.kpis.join(' | '));
etat.noms.forEach((n, i) => console.log('  ' + n + '  →  ' + etat.sousTitres[i]));
console.log('\nERREURS JS :', err.length ? err : 'aucune');

await p.screenshot({ path: 'captures-appareils/cluster-appareils.png' });
await p.evaluate(() => { document.querySelector('.tabs [data-v="plug"]')?.click(); });
await new Promise(x => setTimeout(x, 1000));
await p.screenshot({ path: 'captures-appareils/cluster-multiprise.png' });
await b.close();
