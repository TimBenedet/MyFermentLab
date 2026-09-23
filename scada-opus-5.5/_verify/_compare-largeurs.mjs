import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FICHIERS = {
  'référence (noms de démo)': 'file:///C:/Users/Timoth%C3%A9e/Documents/IA/Hermes/FermentationLab2/_verify/version-identique-1440.html',
  'livrable (noms réels)': 'file:///C:/Users/Timoth%C3%A9e/Documents/IA/Hermes/FermentationLab2/hakko-dashboard.html',
};
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'shell', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
for (const [nom, url] of Object.entries(FICHIERS)) {
  for (const [w, h] of [[1440, 860], [1280, 720]]) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: h });
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await p.goto(url, { waitUntil: 'load' });
    await p.evaluate(() => { location.hash = '#/appareils'; });
    await new Promise(x => setTimeout(x, 1400));
    const m = await p.evaluate(() => {
      const tr = document.querySelector('#view tbody tr');
      const cell = tr.querySelector('.dev-cell');
      const nm = cell.querySelector('.nm');
      const st = cell.querySelector('.sm.num');
      const sel = tr.cells[3].querySelector('select');
      const cs = getComputedStyle(nm);
      return {
        colonnes: [...tr.cells].map(c => Math.round(c.getBoundingClientRect().width)),
        nomSurPlusieursLignes: nm.getBoundingClientRect().height > parseFloat(cs.lineHeight) * 1.6,
        hauteurNom: Math.round(nm.getBoundingClientRect().height), hauteurLigne: Math.round(parseFloat(cs.lineHeight)),
        selectPx: Math.round(sel.clientWidth) + '/' + Math.round(sel.scrollWidth),
        // le texte de l'option sélectionnée dépasse-t-il la largeur disponible ?
        selectionTronquee: sel.scrollWidth > sel.clientWidth + 1,
      };
    });
    console.log(`${nom} — ${w}x${h}`);
    console.log(`  colonnes          : ${m.colonnes.join(' | ')}`);
    console.log(`  nom sur 2 lignes  : ${m.nomSurPlusieursLignes ? 'OUI' : 'non'} (${m.hauteurNom} px pour une ligne de ${m.hauteurLigne} px)`);
    console.log(`  sélecteur Fermentation : ${m.selectPx} px → ${m.selectionTronquee ? 'TRONQUÉ' : 'entier'}\n`);
    await p.close();
  }
}
await b.close();
