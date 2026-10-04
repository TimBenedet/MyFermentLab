/* D7 — la marque « données de démonstration » tombe-t-elle à la PREMIÈRE édition réelle ?
 *
 * L'enjeu : tant que `S.ensemence` est vrai, deux choses opposées et toutes deux fausses
 * peuvent se produire. Le partage est refusé (« ce navigateur n'a pas de données à
 * partager »), OU le document du pont est adopté automatiquement, écrasant un travail réel.
 *
 * La revue reproche une LISTE de gestes, condamnée à dériver. On ne juge pas la liste : on
 * exerce les gestes dans un vrai navigateur et on regarde si la marque tombe. La mesure est
 * la même quelle que soit la mise en œuvre.
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

/* Chaque geste : on repart d'une page NEUVE (donc `ensemence: true`), on exerce le geste
   par un vrai clic, et on relit la marque dans le stockage. */
const gestes = [
  { nom: 'terminer un lot (archivage)', fait: async p => {
      /* « Terminer le lot » n'existe que sur la fiche : on y va par un vrai clic. */
      const ouvert = await p.evaluate(() => {
        const a = document.querySelector('a[href^="#/f/"]');
        if (!a) return false;
        a.click(); return true;
      });
      if (!ouvert) return null;
      await new Promise(r => setTimeout(r, 800));
      return p.evaluate(() => {
        const el = document.querySelector('[data-action="finish"]');
        if (!el) return null;
        el.click(); return 'clic';
      });
    } },
  { nom: 'rattacher un appareil à un lot', vue: '#/appareils', fait: async p => p.evaluate(() => {
      const d = S.devices.find(x => x.kind === 'plug');
      const b = S.batches.find(x => x.status === 'active');
      const sel = document.querySelector(`[data-action="assign"][data-id="${d.id}"]`);
      if (sel) { sel.value = b.id; sel.dispatchEvent(new Event('change', { bubbles: true })); return 'change'; }
      return null;
    }) },
  { nom: 'changer le mode d’un appareil', vue: '#/appareils', fait: async p => p.evaluate(() => {
      const d = S.devices.find(x => x.kind === 'plug');
      const sel = document.querySelector(`[data-action="plug-mode"][data-id="${d.id}"]`);
      if (sel) { sel.value = 'auto'; sel.dispatchEvent(new Event('change', { bubbles: true })); return 'change'; }
      return null;
    }) },
  { nom: 'ajouter une note au journal', fait: async p => p.evaluate(() => {
      const b = S.batches.find(x => x.status === 'active');
      if (typeof logEvent === 'function') { logEvent('note', 'essai D7', b.id); save(); return 'logEvent'; }
      return null;
    }) },
  { nom: 'ajouter un relevé de densité', fait: async p => p.evaluate(() => {
      const b = S.batches.find(x => x.status === 'active');
      b.gravity = b.gravity || [];
      b.gravity.push({ t: Date.now(), v: 1.05 });
      save(); return 'push';
    }) },
];

const main = async () => {
  const nav = await puppeteer.launch({ executablePath: EDGE, headless: true,
    args: ['--no-sandbox', '--allow-file-access-from-files'] });
  try {
    for (const g of gestes) {
      const ctx = await nav.createBrowserContext();
      const p = await ctx.newPage();
      const err = [];
      p.on('pageerror', e => err.push(String(e).slice(0, 120)));
      /* Un confirm()/alert() non traité gèle la page et fait expirer l'appel : on répond
         « oui », ce que fait l'utilisateur qui termine volontairement son lot. */
      p.on('dialog', async d => { try { await d.accept(); } catch(e) {} });
      await p.goto(pathToFileURL(PAGE).href, { waitUntil: 'domcontentloaded' });
      await dors(1500);
      if (g.vue){
        /* On clique le lien de navigation : poser location.hash par script ne redessine pas. */
        await p.evaluate(v => {
          const a = document.querySelector(`a[href="${v}"], [data-action="nav"][data-vue="${v}"]`);
          if (a) a.click(); else location.hash = v;
        }, g.vue);
        await dors(900);
      }

      const avant = await p.evaluate(() => S.ensemence);
      const comment = await g.fait(p);
      await dors(900);
      const apres = await p.evaluate(() => {
        const ecrit = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch(e){ return {}; } })();
        /* La marque compte dans l'état vivant ET dans ce qui a été écrit : c'est l'état
           écrit qu'un rechargement relira, et c'est lui qui décide du partage. */
        return { marque: S.ensemence, marqueEcrite: ecrit.ensemence, lots: (S.batches || []).length };
      });

      if (avant !== true) {
        dit(false, g.nom, 'état de départ non marqué — mesure impossible');
      } else if (comment === null) {
        dit(false, g.nom, 'geste introuvable dans l’interface (sélecteur à revoir)');
      } else {
        dit(apres.marque !== true && apres.marqueEcrite !== true, g.nom,
            `vivant ${avant} -> ${apres.marque}, écrit ${apres.marqueEcrite}` +
            `${err.length ? ' | erreur JS : ' + err[0] : ''}`);
      }
      await ctx.close();
    }
  } finally {
    await nav.close().catch(() => {});
  }
  console.log('\n---');
  console.log(`Réussies : ${ok} | Échouées : ${ko} | Total : ${ok + ko}`);
  console.log(ko === 0 ? 'VERDICT : SUCCÈS' : `VERDICT : ÉCHEC — ${ko} geste(s) laissent la marque`);
  process.exit(ko === 0 ? 0 : 1);
};

main().catch(e => { console.error('ERREUR :', e); process.exit(2); });
