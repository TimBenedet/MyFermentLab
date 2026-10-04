/* Le symptôme d'origine, rejoué dans deux vrais navigateurs.
 *
 * « J'ai annulé la recette test eau en cours [sur le PC] … et pourtant je vois ça
 *   [sur le téléphone] » : deux copies locales, deux vérités.
 *
 * On ouvre la page dans DEUX contextes isolés (deux localStorage distincts, comme un PC et
 * un téléphone), contre un vrai pont et un faux Home Assistant. On vérifie que ce qui est
 * écrit sur l'un arrive sur l'autre, et surtout qu'une SUPPRESSION se propage.
 *
 * Aucune assertion ne porte sur l'allumage d'une prise : ce fichier ne commande rien.
 */
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const RACINE = join(import.meta.dirname, '..');
const PAGE = join(RACINE, 'hakko-dashboard.html');
/* Le pont refuse de démarrer avec moins de 32 caractères : il commande de vraies
   prises. On s'y conforme au lieu de l'affaiblir. */
const JETON = 'jeton-essai-deux-appareils-0123456789';

let ok = 0, ko = 0;
const dit = (bon, quoi, detail = '') => {
  console.log(`  ${bon ? 'OK  ' : 'KO  '} ${quoi}${detail ? ' — ' + detail : ''}`);
  bon ? ok++ : ko++;
};

const port = async () => new Promise(res => {
  const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});

/* --- faux Home Assistant : il retient l'état et journalise, il ne chauffe rien --- */
function fauxHA(p) {
  const etats = new Map();
  const vus = [];
  const ent = (id, st, extra = {}) => ({ entity_id: id, state: st, attributes: extra, last_updated: new Date().toISOString() });
  const srv = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/states') {
      const out = [ent('sensor.sonde_essai_temperature', '20.0', { unit_of_measurement: '°C', friendly_name: 'Sonde essai' })];
      for (const [k, v] of etats) out.push(ent(k, v, { friendly_name: k }));
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(out));
    }
    if (url.pathname.startsWith('/api/states/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/states/'.length));
      const st = id.startsWith('sensor.') ? '20.0' : (etats.get(id) || 'off');
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(ent(id, st, { unit_of_measurement: id.startsWith('sensor.') ? '°C' : undefined })));
    }
    if (url.pathname.startsWith('/api/services/switch/')) {
      let c = ''; req.on('data', d => c += d);
      return req.on('end', () => {
        const quoi = url.pathname.endsWith('turn_on') ? 'on' : 'off';
        try { const j = JSON.parse(c || '{}'); etats.set(j.entity_id, quoi); vus.push({ quoi, eid: j.entity_id, t: Date.now() }); } catch {}
        res.writeHead(200, { 'content-type': 'application/json' }); res.end('[]');
      });
    }
    res.writeHead(404); res.end('{}');
  });
  srv.listen(p, '127.0.0.1');
  return { srv, etats, vus };
}

/* --- le dashboard, servi en http (le partage est désactivé en file://) ---
 * La page appelle le pont sur SA PROPRE origine (pas de clé d'URL configurable) : ce
 * serveur doit donc relayer /api/ vers le pont, exactement comme nginx en production.
 * Sans ce relais, l'essai ne testerait rien du tout. */
function serveurPage(p, pPont) {
  const html = readFileSync(PAGE);
  const srv = createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      let corps = '';
      req.on('data', d => corps += d);
      req.on('end', async () => {
        try {
          const r = await fetch(`http://127.0.0.1:${pPont}${req.url}`, {
            method: req.method,
            headers: { 'content-type': 'application/json', ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}) },
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : (corps || '{}'),
          });
          const t = await r.text();
          res.writeHead(r.status, { 'content-type': 'application/json' });
          res.end(t);
        } catch (e) {
          res.writeHead(502, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, erreur: String(e) }));
        }
      });
      return;
    }
    if (req.url.startsWith('/hakko-dashboard.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html);
    }
    res.writeHead(404); res.end('');
  });
  srv.listen(p, '127.0.0.1');
  return srv;
}

const dors = ms => new Promise(r => setTimeout(r, ms));

/* Attendre une condition, jamais une durée fixe. */
async function jusqua(fn, limite = 25000, pas = 250) {
  const t0 = Date.now();
  for (;;) {
    let v = null;
    try { v = await fn(); } catch {}
    if (v) return v;
    if (Date.now() - t0 > limite) return null;
    await dors(pas);
  }
}

const main = async () => {
  const pHA = await port(), pPont = await port(), pWeb = await port();
  const ha = fauxHA(pHA);
  const web = serveurPage(pWeb, pPont);
  const etatDir = mkdtempSync(join(tmpdir(), 'pont-deux-'));

  const pont = spawn('python', [join(RACINE, 'pont', 'pont.py')], {
    env: {
      ...process.env,
      HASS_URL: `http://127.0.0.1:${pHA}`, HASS_TOKEN: 'x',
      PONT_PORT: String(pPont), PONT_AUTH: 'jeton', PONT_JETON: JETON,
      PONT_ETAT: join(etatDir, 'etat.json'),
      /* PONT_DONNEES est un RÉPERTOIRE : le pont y range le document et sa semence. */
      PONT_DONNEES: etatDir,
      PONT_SONDES: 'sensor.sonde_essai_temperature',
      PONT_PRISES: 'switch.prise_essai_1,switch.prise_essai_2',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pont.stdout.on('data', () => {});
  pont.stderr.on('data', () => {});

  const nav = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });

  try {
    const pret = await jusqua(async () => {
      const r = await fetch(`http://127.0.0.1:${pPont}/api/etat`, { headers: { Authorization: 'Bearer ' + JETON } });
      return r.ok;
    });
    if (!pret) { dit(false, 'le pont démarre'); return; }
    dit(true, 'le pont répond');

    const url = `http://127.0.0.1:${pWeb}/hakko-dashboard.html`;
    /* Deux contextes INCOGNITO distincts = deux localStorage, comme deux appareils. */
    const ctxA = await nav.createBrowserContext();
    const ctxB = await nav.createBrowserContext();
    const A = await ctxA.newPage();
    A.on('console', m => console.log('    [A console]', m.text().slice(0, 180)));
    A.on('pageerror', e => console.log('    [A ERREUR]', String(e).slice(0, 120), '|', (e.stack || '').split('\n').slice(1, 4).join(' <- ').replace(/https?:\/\/[^/]+/g, '')));
    A.on('response', r => { if (r.url().includes('/api/')) console.log('    [A api]', r.status(), r.url().replace(/^https?:\/\/[^/]+/, '')); });
    const B = await ctxB.newPage();
    B.on('pageerror', e => console.log('    [B ERREUR]', String(e).slice(0, 120)));
    B.on('response', r => { if (r.url().includes('/api/donnees')) console.log('    [B api]', r.status(), r.url().replace(/^https?:\/\/[^/]+/, '')); });

    /* --- appareil A : on lui donne de vraies données et le jeton --- */
    await A.goto(url, { waitUntil: 'domcontentloaded' });
    await A.evaluate(jeton => localStorage.setItem('hakko-pont-jeton', jeton), JETON);
    await A.evaluate(() => {
      const S = { recipes: [{ id: 'r1', name: 'Test eau', type: 'koji', duration: 2, temp: 30, archived: false }],
                  batches: [{ id: 'b1', name: 'Test eau #1', recipe: { id: 'r1', name: 'Test eau', type: 'koji', duration: 2, temp: 30 },
                              status: 'active', start: Date.now(), devices: [] }],
                  devices: [], events: [] };
      localStorage.setItem('hakko-dashboard-v2', JSON.stringify(S));
    });
    await A.reload({ waitUntil: 'networkidle2' });

    /* Pourquoi la page n'écrit-elle pas ? On interroge son état interne. */
    const diag = await A.evaluate(async () => {
      const r = await fetch('api/donnees/rev', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('hakko-pont-jeton') || '') } });
      const j = await r.json().catch(() => null);
      return { rev: j && j.rev, actif: PONT.actif, jetonRequis: PONT.jetonRequis, partage: PONT.partage,
               divergence: JSON.stringify(PONT.divergence), ensemence: typeof etatEnsemence === 'function' ? etatEnsemence() : 'absent',
               lots: (S.batches || []).length, recettes: (S.recipes || []).length,
               pontRev: PONT.rev };
    });
    console.log('    [diag A]', JSON.stringify(diag));

    /* A doit proposer de devenir la référence (pont vierge, état non ensemencé) */
    const proposeA = await jusqua(() => A.evaluate(() =>
      !!document.querySelector('[data-action="partager"]')));
    dit(!!proposeA, 'A (données réelles) propose de devenir la référence');

    const exportA = await A.evaluate(() => !!document.querySelector('[data-action="exporter"]'));
    dit(exportA, 'le bouton « Exporter mes données » est présent');

    /* On clique : A devient la référence partagée */
    if (proposeA) {
      await A.evaluate(() => { window.confirm = () => true; });
      await A.click('[data-action="partager"]');
    }
    const revApres = await jusqua(async () => {
      const r = await fetch(`http://127.0.0.1:${pPont}/api/donnees/rev`, { headers: { Authorization: 'Bearer ' + JETON } });
      const j = await r.json();
      return j.rev > 0 ? j.rev : null;
    });
    dit(!!revApres, 'le pont détient le document partagé', revApres ? 'rev ' + revApres : 'rien écrit');

    const docPont = await (await fetch(`http://127.0.0.1:${pPont}/api/donnees`, { headers: { Authorization: 'Bearer ' + JETON } })).json();
    dit(docPont?.donnees?.lots?.length === 1 && docPont.donnees.lots[0].id === 'b1',
        'le lot « Test eau #1 » est dans la vérité partagée');

    /* --- appareil B : navigateur neuf, il doit RECEVOIR les données de A --- */
    await B.goto(url, { waitUntil: 'domcontentloaded' });
    await B.evaluate(jeton => localStorage.setItem('hakko-pont-jeton', jeton), JETON);
    await B.reload({ waitUntil: 'networkidle2' });

    const recuB = await jusqua(() => B.evaluate(() => {
      const S = JSON.parse(localStorage.getItem('hakko-dashboard-v2') || '{}');
      return (S.batches || []).some(b => b.id === 'b1') ? true : null;
    }));
    dit(!!recuB, 'B (navigateur neuf) reçoit le lot sans rien saisir');

    const diagB = await B.evaluate(() => ({
      marque: S.ensemence, rev: PONT.rev, div: JSON.stringify(PONT.divergence || null),
      sigEcrite: !!PONT.sigEcrite, recettes: (S.recipes || []).length,
      sigEgale: (typeof signaturePartagee === 'function' && typeof signatureSemence === 'function')
        ? (signaturePartagee() === signatureSemence()) : 'n/a',
    }));
    console.log('    [diag B] ' + JSON.stringify(diagB));

    const pasDeDemoB = await B.evaluate(() => {
      const S = JSON.parse(localStorage.getItem('hakko-dashboard-v2') || '{}');
      return !(S.recipes || []).some(r => r.name === 'Saison du Nord');
    });
    dit(pasDeDemoB, 'B n’a pas gardé les recettes de démonstration');

    /* --- LE SYMPTÔME : A supprime le lot, B doit le perdre aussi ---
     * On supprime comme l'utilisateur le fait : par l'interface, dans la session en cours.
     * (Écrire localStorage par-dessous puis recharger remettrait PONT.sigEcrite à null, et
     * la page poserait — à juste titre — une divergence au lieu d'écrire : ce serait un
     * essai qui teste son propre artefact.) */
    await A.evaluate(() => { window.confirm = () => true; });
    /* On CLIQUE la carte du lot : poser location.hash par script ne redessine pas toujours
       (hashchange n'est pas garanti sans navigation réelle). On fait comme l'utilisateur. */
    const ouvert = await A.evaluate(async () => {
      const a = document.querySelector('a.lot[href^="#/f/"]');
      if (!a) return { ok: false, pourquoi: 'aucune carte de lot sur la vue d’accueil',
                       cartes: document.querySelectorAll('a.lot').length,
                       html: (document.getElementById('view') || {}).innerHTML?.slice(0, 300) };
      a.click();
      await new Promise(r => setTimeout(r, 800));
      /* render() est-il appelé ? on force pour voir si c'est le routeur ou le clic. */
      const avant = { hash: location.hash, titre: (document.querySelector('h1') || {}).textContent };
      if (typeof render === 'function') render();
      await new Promise(r => setTimeout(r, 400));
      return { ok: !!document.querySelector('[data-action="finish"], [data-action="delete-batch"]'),
               avant, apres: { titre: (document.querySelector('h1') || {}).textContent } };
    });
    console.log('    [ouverture]', JSON.stringify(ouvert));
    dit(ouvert && ouvert.ok, 'A ouvre la fiche du lot en cours');
    await dors(600);
    /* Un lot ACTIF n'a pas de bouton Supprimer : on le termine d'abord — c'est le geste de
       l'utilisateur quand il annule ou archive une recette en cours, celui de l'incident. */
    const termine = await A.evaluate(() => {
      window.confirm = () => true;
      const btn = document.querySelector('[data-action="finish"]');
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!termine) {
      const quoi = await A.evaluate(() => ({
        hash: location.hash,
        actions: [...document.querySelectorAll('[data-action]')].map(e => e.dataset.action).slice(0, 25),
        titre: (document.querySelector('h1') || {}).textContent,
        lot: (S.batches || [])[0] ? { id: S.batches[0].id, status: S.batches[0].status } : null,
      }));
      console.log('    [page A]', JSON.stringify(quoi));
    }
    dit(termine, 'A termine le lot (geste réel : annuler / archiver)');
    await dors(1800);

    const diagSuppr = await A.evaluate(() => ({
      lots: (S.batches || []).length, sigEcrite: PONT.sigEcrite ? PONT.sigEcrite.slice(0, 60) : null,
      sigNow: signaturePartagee().slice(0, 60), rev: PONT.rev,
      divergence: JSON.stringify(PONT.divergence), enVol: PONT.enVol,
      egales: signaturePartagee() === PONT.sigEcrite,
    }));
    console.log('    [apres suppression sur A]', JSON.stringify(diagSuppr));

    const plusActif = await jusqua(async () => {
      const r = await fetch(`http://127.0.0.1:${pPont}/api/donnees`, { headers: { Authorization: 'Bearer ' + JETON } });
      const j = await r.json();
      const lots = j?.donnees?.lots || [];
      return lots.every(l => l.status !== 'active') ? true : null;
    });
    dit(!!plusActif, 'le lot n’est plus actif dans la vérité partagée (A → pont)');

    const bVoitLArchivage = await jusqua(() => B.evaluate(() => {
      const S = JSON.parse(localStorage.getItem('hakko-dashboard-v2') || '{}');
      const b = (S.batches || []).find(x => x.id === 'b1');
      return (!b || b.status !== 'active') ? true : null;
    }), 30000);
    if (!bVoitLArchivage) {
      const dB = await B.evaluate(() => ({
        rev: PONT.rev, actif: PONT.actif, jetonRequis: PONT.jetonRequis,
        divergence: JSON.stringify(PONT.divergence), sigEcriteEgale: signaturePartagee() === PONT.sigEcrite,
        lot: (S.batches || []).map(b => ({ id: b.id, status: b.status })),
      }));
      console.log('    [diag B]', JSON.stringify(dB));
    }
    dit(!!bVoitLArchivage, 'B voit l’archivage fait sur A (LE SYMPTÔME D’ORIGINE)');

    /* --- G2 : un navigateur vidé ne doit JAMAIS imposer ses données de démonstration --- */
    const ctxC = await nav.createBrowserContext();
    const C = await ctxC.newPage();
    await C.goto(url, { waitUntil: 'domcontentloaded' });
    await C.evaluate(jeton => localStorage.setItem('hakko-pont-jeton', jeton), JETON);
    await C.reload({ waitUntil: 'networkidle2' });
    await dors(3000);
    const docApresC = await (await fetch(`http://127.0.0.1:${pPont}/api/donnees`, { headers: { Authorization: 'Bearer ' + JETON } })).json();
    const pasEcrase = !(docApresC?.donnees?.recettes || []).some(r => r.name === 'Saison du Nord');
    dit(pasEcrase, 'G2 : un navigateur neuf n’écrase pas la vérité avec ses données de démo');

    /* --- aucune prise n'a été commandée par cet essai --- */
    dit(ha.vus.filter(v => v.quoi === 'on').length === 0,
        'aucun allumage de prise pendant tout l’essai',
        ha.vus.length ? JSON.stringify(ha.vus.slice(0, 3)) : 'aucune commande');

  } finally {
    await nav.close().catch(() => {});
    pont.kill('SIGKILL');
    ha.srv.close(); web.close();
    try { rmSync(etatDir, { recursive: true, force: true }); } catch {}
  }

  console.log('\n---');
  console.log(`Réussies : ${ok} | Échouées : ${ko} | Total : ${ok + ko}`);
  console.log(ko === 0 ? 'VERDICT : SUCCÈS' : `VERDICT : ÉCHEC — ${ko} assertion(s)`);
  process.exit(ko === 0 ? 0 : 1);
};

main().catch(e => { console.error('ERREUR :', e); process.exit(2); });
