import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'file:///C:/Users/Timoth%C3%A9e/Documents/IA/Hermes/FermentationLab2/hakko-dashboard.html';
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'shell', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 860 });
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
await p.goto(URL, { waitUntil: 'load' });
await p.evaluate(() => { location.hash = '#/appareils'; });
await new Promise(x => setTimeout(x, 1200));

const mesurer = async (variante) => p.evaluate((v) => {
  // applique la variante sur les sous-titres puis mesure la table
  document.querySelectorAll('#view tbody tr').forEach(tr => {
    const d = tr.querySelector('.dev-cell .sm.num'); if (!d) return;
    const id = d.textContent.trim();
    if (v === 'entier') d.textContent = id;
    else if (v === 'sans-domaine') d.textContent = id.includes('.') ? id.split('.').slice(1).join('.') : id;
    else if (v === 'court') d.textContent = id.startsWith('switch.') ? d.textContent : 'S' + (d.textContent.match(/sonde_sonoff_(\d)/) ? d.textContent.match(/sonde_sonoff_(\d)/)[1] : '1');
  });
  const tr = document.querySelector('#view tbody tr');
  const sel = tr.cells[3].querySelector('select');
  return {
    colonnes: [...tr.cells].map(c => Math.round(c.getBoundingClientRect().width)),
    fermTexte: Math.round(sel.clientWidth),
    fermTronque: sel.scrollWidth > sel.clientWidth + 1,
    sousTitre: document.querySelector('#view tbody tr .dev-cell .sm.num').textContent,
  };
}, variante);

for (const v of ['entier', 'sans-domaine', 'court']) {
  const m = await mesurer(v);
  console.log(`\n### sous-titre = ${v}`);
  console.log('  ex. de sous-titre :', m.sousTitre);
  console.log('  colonnes          :', m.colonnes.join(' | '));
  console.log('  Fermentation      :', m.fermTexte, 'px', m.fermTronque ? '→ TRONQUÉ' : '→ entier');
}
console.log('\n(cible : colonne Fermentation ≥ 141 px, comme la référence, pour que « Saison du Nord #3 » reste entier)');
await b.close();
