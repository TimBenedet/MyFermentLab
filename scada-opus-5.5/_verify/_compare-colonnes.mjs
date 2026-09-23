import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FICHIERS = {
  'nouveau (appareils réels)': 'file:///C:/Users/Timoth%C3%A9e/Documents/IA/Hermes/FermentationLab2/hakko-dashboard.html',
  'référence (données de démo)': 'file:///C:/Users/Timoth%C3%A9e/Documents/IA/Hermes/FermentationLab2/_verify/version-identique-1440.html',
};
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'shell', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
for (const [nom, url] of Object.entries(FICHIERS)) {
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 860 });
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await p.goto(url, { waitUntil: 'load' });
  await p.evaluate(() => { location.hash = '#/appareils'; });
  await new Promise(x => setTimeout(x, 1200));
  const m = await p.evaluate(() => {
    const lignes = [...document.querySelectorAll('#view tbody tr')];
    const sel = lignes.map(tr => tr.cells[3]?.querySelector('select')).filter(Boolean);
    const colonnes = lignes[0] ? [...lignes[0].cells].map(c => Math.round(c.getBoundingClientRect().width)) : [];
    const tbl = document.querySelector('#view table.data');
    return {
      colonnes,
      largeurTable: Math.round(tbl.getBoundingClientRect().width),
      largeurDisponible: Math.round(document.querySelector('#view').clientWidth),
      comprimes: sel.filter(s => s.scrollWidth > s.clientWidth + 1).length + '/' + sel.length,
      exemple: sel[0] ? sel[0].options[sel[0].selectedIndex].text + ' (affiché sur ' + Math.round(sel[0].clientWidth) + ' px, texte ' + sel[0].scrollWidth + ' px)' : null,
      debordementConteneur: [...document.querySelectorAll('#view *')].filter(e => {
        const r = e.getBoundingClientRect(), pa = e.parentElement.getBoundingClientRect();
        return r.bottom > pa.bottom + 1 || r.right > pa.right + 1;
      }).length,
    };
  });
  console.log('\n### ' + nom);
  console.log('  largeur du tableau    :', m.largeurTable, 'px  (zone :', m.largeurDisponible, 'px)');
  console.log('  largeur des colonnes  :', m.colonnes.join(' | '));
  console.log('  listes déroulantes comprimées :', m.comprimes);
  console.log('  exemple               :', m.exemple);
  console.log('  débordements          :', m.debordementConteneur);
  await p.close();
}
await b.close();
