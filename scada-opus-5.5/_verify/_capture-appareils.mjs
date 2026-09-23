import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FILE = 'file:///C:/Users/Timoth%C3%A9e/Documents/IA/Hermes/FermentationLab2/hakko-dashboard.html';
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'shell', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000 });
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
const err = []; p.on('pageerror', e => err.push(e.message));
p.on('console', m => { if (m.type() === 'error') err.push('console: ' + m.text()); });

await p.goto(FILE, { waitUntil: 'load' });
const capt = async (hash, nom, evalue) => {
  await p.evaluate(h => { location.hash = h; }, hash);
  await new Promise(x => setTimeout(x, 1500));
  const d = await p.evaluate(evalue);
  console.log('\n### ' + nom);
  console.log(JSON.stringify(d, null, 1));
  await p.screenshot({ path: `captures-appareils/${nom}.png`, fullPage: false });
};

await capt('#/appareils', 'appareils-tous', () => ({
  titre: document.querySelector('#view h1')?.textContent,
  soustitre: document.querySelector('#view .ph p')?.textContent,
  kpis: [...document.querySelectorAll('.kpis .kpi')].map(k => k.textContent.replace(/\s+/g, ' ').trim()),
  onglets: [...document.querySelectorAll('.tabs [role=tab]')].map(t => t.textContent.replace(/\s+/g, ' ').trim()),
  lignes: [...document.querySelectorAll('#view tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' | ')),
}));

await capt('#/appareils', 'appareils-prises', () => ({
  bandeau: document.querySelector('.strip-h')?.textContent.replace(/\s+/g, ' ').trim(),
  prises: [...document.querySelectorAll('.outlet')].map(o => ({
    entete: o.querySelector('.o-slot')?.textContent.trim(),
    puissance: o.querySelector('.o-pw')?.textContent.trim(),
    nom: o.querySelector('.o-name')?.textContent.trim(),
    bouton: o.querySelector('.o-btn')?.textContent.trim(),
    allumee: o.classList.contains('is-on'),
  })),
}), );
// pour l'onglet prises, il faut cliquer sur le filtre
await p.evaluate(() => { location.hash = '#/appareils'; });
await new Promise(x => setTimeout(x, 400));
await p.evaluate(() => { document.querySelector('.tabs [data-v="plug"]')?.click(); });
await new Promise(x => setTimeout(x, 900));
console.log('\n### bandeau multiprise (onglet Prises)');
console.log(JSON.stringify(await p.evaluate(() => ({
  bandeau: document.querySelector('.strip-h')?.textContent.replace(/\s+/g, ' ').trim(),
  prises: [...document.querySelectorAll('.outlet')].map(o => [o.querySelector('.o-slot')?.textContent.trim(), o.querySelector('.o-name')?.textContent.trim(), o.querySelector('.o-btn')?.textContent.trim()].join(' · ')),
})), null, 1));
await p.screenshot({ path: 'captures-appareils/appareils-multiprise.png' });

await capt('#/', 'accueil', () => ({
  kpis: [...document.querySelectorAll('.kpis .kpi')].map(k => k.textContent.replace(/\s+/g, ' ').trim()),
  etatAppareils: [...document.querySelectorAll('.health li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()),
}));

console.log('\nERREURS JS :', err.length ? err : 'aucune');
await b.close();
