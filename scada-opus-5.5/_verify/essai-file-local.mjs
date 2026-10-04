/* La page doit continuer de fonctionner ouverte en file://, sans pont.
 *
 * C'est un invariant du contrat (§7.2) : le dashboard s'ouvre d'un double-clic, sans serveur.
 * Le partage est alors impossible — et c'est normal. Ce qui ne serait PAS normal : une page
 * blanche, une erreur JavaScript, un bandeau qui promet un partage inexistant, ou la régulation
 * de maquette qui commanderait quelque chose.
 */
import puppeteer from 'puppeteer-core';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGE = join(import.meta.dirname, '..', 'hakko-dashboard.html');

let ok = 0, ko = 0;
const dit = (bon, quoi, detail = '') => {
  console.log(`  ${bon ? 'OK  ' : 'KO  '} ${quoi}${detail ? ' — ' + detail : ''}`);
  bon ? ok++ : ko++;
};
const dors = ms => new Promise(r => setTimeout(r, ms));

const main = async () => {
  const nav = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  try {
    const p = await nav.newPage();
    const erreurs = [];
    const requetes = [];
    p.on('pageerror', e => erreurs.push(String(e).slice(0, 160)));
    p.on('request', r => { if (/\/api\//.test(r.url())) requetes.push(r.url()); });

    await p.goto(pathToFileURL(PAGE).href, { waitUntil: 'domcontentloaded' });
    await dors(4000);   /* on laisse tourner les minuteries de la page */

    dit(erreurs.length === 0, 'aucune erreur JavaScript en file://', erreurs.slice(0, 2).join(' | '));

    const vue = await p.evaluate(() => ({
      local: typeof PONT_LOCAL !== 'undefined' ? PONT_LOCAL : 'absent',
      lots: (S.batches || []).length,
      recettes: (S.recipes || []).length,
      appareils: (S.devices || []).length,
      titre: (document.querySelector('h1') || {}).textContent,
      vide: (document.getElementById('view') || {}).innerHTML?.length || 0,
      bandeau: !!document.querySelector('[data-action="exporter"]'),
      partage: typeof PONT !== 'undefined' ? PONT.partage : 'absent',
      proposePartage: !!document.querySelector('[data-action="partager"], [data-action="adopter"]'),
    }));
    console.log('    [file://]', JSON.stringify(vue));

    dit(vue.local === true, 'la page se sait en mode local (PONT_LOCAL)');
    dit(vue.vide > 2000, 'la vue est rendue (pas de page blanche)', vue.vide + ' caractères');
    dit(vue.recettes > 0 && vue.appareils > 0, 'le jeu de démonstration est présent',
        `${vue.recettes} recettes, ${vue.appareils} appareils`);
    dit(vue.partage !== true, 'la page ne prétend PAS que ses données sont partagées');
    dit(!vue.proposePartage, 'aucun bouton de partage proposé sans pont');
    dit(vue.bandeau, 'le bouton Exporter reste atteignable hors ligne');
    dit(requetes.length === 0, 'aucun appel réseau vers une API', requetes.slice(0, 2).join(' '));

    /* La navigation doit marcher : c'est ce qui distingue « ouvert » de « utilisable ». */
    const navigue = await p.evaluate(async () => {
      const a = document.querySelector('a.lot[href^="#/f/"]');
      if (!a) return { ok: false, pourquoi: 'aucun lot affiché' };
      a.click();
      await new Promise(r => setTimeout(r, 700));
      return { ok: !!document.querySelector('[data-action="finish"], [data-action="delete-batch"]'),
               titre: (document.querySelector('h1') || {}).textContent };
    });
    dit(navigue.ok, 'la fiche d’un lot s’ouvre en file://', navigue.titre || navigue.pourquoi);

    await p.evaluate(() => { location.hash = '#/appareils'; });
    await dors(900);
    const appareils = await p.evaluate(() => ({
      lignes: document.querySelectorAll('table.data tbody tr, .plug-card').length,
      erreur: (document.getElementById('view') || {}).innerHTML?.includes('undefined') || false,
    }));
    dit(appareils.lignes > 0, 'la vue Appareils liste le parc', appareils.lignes + ' entrées');
    dit(!appareils.erreur, 'aucun « undefined » affiché à l’écran');
    dit(erreurs.length === 0, 'toujours aucune erreur JavaScript après navigation',
        erreurs.slice(0, 2).join(' | '));

  } finally {
    await nav.close().catch(() => {});
  }
  console.log('\n---');
  console.log(`Réussies : ${ok} | Échouées : ${ko} | Total : ${ok + ko}`);
  console.log(ko === 0 ? 'VERDICT : SUCCÈS' : `VERDICT : ÉCHEC — ${ko} assertion(s)`);
  process.exit(ko === 0 ? 0 : 1);
};

main().catch(e => { console.error('ERREUR :', e); process.exit(2); });
