/* Sonde D8 + D9 — mesure directe des deux corrections, dans de vrais navigateurs Edge
 * contre un vrai pont Python. Fichier NOUVEAU : aucun essai existant n'est modifié.
 *
 * Usage : node _sonde-d8-d9.mjs [chemin/vers/page.html]
 *   sans argument : ../hakko-dashboard.html (la page corrigée)
 *   avec argument : sert une COPIE (contrôle négatif : correction réintroduite à l'envers)
 *
 * D8 — G3 est une précondition. Quand la copie de sauvegarde locale est impossible
 *      (quota du navigateur réellement saturé), l'adoption automatique doit être REFUSÉE,
 *      la divergence posée avec le motif `sauvegardeImpossible`, et le bandeau doit
 *      l'afficher avec sa sortie (exporter, puis adopter).
 *
 * D9 — aucune adoption pendant une saisie, y compris à la PREMIÈRE lecture. Un dialogue
 *      ouvert gèle l'adoption ; sa fermeture la libère.
 *
 * Aucune assertion ne porte sur l'allumage d'une prise : ce fichier ne commande rien, et
 * il vérifie à la fin qu'aucun allumage n'a été demandé au faux Home Assistant.
 */
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const RACINE = join(import.meta.dirname, '..');
const PAGE = process.argv[2] ? process.argv[2] : join(RACINE, 'hakko-dashboard.html');
const JETON = 'jeton-sonde-d8-d9-0123456789abcdef';

let ok = 0, ko = 0;
const dit = (bon, quoi, detail = '') => {
  console.log(`  ${bon ? 'OK  ' : 'KO  '} ${quoi}${detail ? ' — ' + detail : ''}`);
  bon ? ok++ : ko++;
};
const info = (quoi, v) => console.log(`    [${quoi}] ${typeof v === 'string' ? v : JSON.stringify(v)}`);
const dors = ms => new Promise(r => setTimeout(r, ms));

const port = async () => new Promise(res => {
  const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});

async function jusqua(fn, limite = 20000, pas = 250) {
  const t0 = Date.now();
  for (;;) {
    let v = null;
    try { v = await fn(); } catch {}
    if (v) return v;
    if (Date.now() - t0 > limite) return null;
    await dors(pas);
  }
}

/* --- faux Home Assistant : il retient l'état, il ne chauffe rien --- */
function fauxHA(p) {
  const etats = new Map(), vus = [];
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
        try { const j = JSON.parse(c || '{}'); etats.set(j.entity_id, quoi); vus.push({ quoi, eid: j.entity_id }); } catch {}
        res.writeHead(200, { 'content-type': 'application/json' }); res.end('[]');
      });
    }
    res.writeHead(404); res.end('{}');
  });
  srv.listen(p, '127.0.0.1');
  return { srv, vus };
}

/* --- le dashboard en http, avec relais /api/ vers le pont (comme nginx) ---
 * `vanne.ferme` coupe /api/donnees* en 503 : c'est ce qui permet d'ouvrir un dialogue
 * AVANT la première lecture du document, et donc de mesurer D9 sur cette branche. */
function serveurPage(p, pPont, vanne, cpt) {
  const html = readFileSync(PAGE);
  const srv = createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      if (vanne.ferme && req.url.includes('/api/donnees')) {
        res.writeHead(503, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, erreur: 'vanne fermee' }));
      }
      /* Compte les deux lectures du protocole. `rev` prouve qu'une synchronisation a bien
         eu lieu (sans quoi « rien n'est adopté » ne mesurerait rien : la boucle ne
         synchronise qu'un tour sur cinq, soit toutes les 15 s). `doc` prouve que la garde
         a arrêté la page AVANT le téléchargement du document. */
      if (req.method === 'GET' && req.url.indexOf('/api/donnees/rev') === 0) cpt.rev++;
      else if (req.method === 'GET' && req.url.indexOf('/api/donnees') === 0) cpt.doc++;
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
          res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(t);
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

/* Sature VRAIMENT le quota localStorage, par paliers décroissants : à la fin il ne reste
   pas de place pour une écriture de quelques kilo-octets, c'est-à-dire pour la copie de
   sauvegarde de G3. On ne simule pas l'échec, on le provoque. */
const BOURRAGE = () => {
  const paliers = [64 * 1024, 4 * 1024, 256, 16];
  let blocs = 0;
  for (const taille of paliers) {
    const bloc = 'x'.repeat(taille);
    for (let i = 0; i < 4000; i++) {
      try { localStorage.setItem('bourrage-' + taille + '-' + i, bloc); blocs++; }
      catch (e) { break; }
    }
  }
  /* Précondition mesurée dans la page elle-même, avec SA fonction : si elle renvoie une
     clé, le quota n'est pas saturé et toute la mesure qui suit serait un mensonge. */
  const essai = typeof sauvegarderLocal === 'function' ? sauvegarderLocal('sonde-precondition-') : 'absente';
  if (typeof essai === 'string' && essai.indexOf('sonde-precondition-') === 0) {
    try { localStorage.removeItem(essai); } catch (e) {}
  }
  return { blocs, sauvegardeLocalePossible: essai !== null, essai: String(essai).slice(0, 40) };
};

const main = async () => {
  console.log('Page sous mesure : ' + PAGE + '\n');
  const pHA = await port(), pPont = await port(), pWeb = await port();
  const ha = fauxHA(pHA);
  const vanne = { ferme: false };
  const cpt = { rev: 0, doc: 0 };
  const web = serveurPage(pWeb, pPont, vanne, cpt);
  const etatDir = mkdtempSync(join(tmpdir(), 'pont-sonde-'));

  const pont = spawn('python', [join(RACINE, 'pont', 'pont.py')], {
    env: { ...process.env,
      HASS_URL: `http://127.0.0.1:${pHA}`, HASS_TOKEN: 'x',
      PONT_PORT: String(pPont), PONT_AUTH: 'jeton', PONT_JETON: JETON,
      PONT_ETAT: join(etatDir, 'etat.json'), PONT_DONNEES: etatDir,
      PONT_SONDES: 'sensor.sonde_essai_temperature',
      PONT_PRISES: 'switch.prise_essai_1,switch.prise_essai_2' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pont.stdout.on('data', () => {}); pont.stderr.on('data', () => {});

  const nav = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const url = `http://127.0.0.1:${pWeb}/hakko-dashboard.html`;
  const auth = { Authorization: 'Bearer ' + JETON };

  try {
    const pret = await jusqua(async () => (await fetch(`http://127.0.0.1:${pPont}/api/etat`, { headers: auth })).ok);
    if (!pret) { dit(false, 'le pont démarre'); return; }

    /* --- le pont reçoit un document de référence, écrit par un appareil A normal ---
     * Les identifiants sont volontairement UNIQUES : le jeu de démonstration contient déjà
     * des lots `b1`..`b4`, donc chercher `b1` dans l'état local ne prouverait rien (c'est
     * l'erreur qu'a faite la deuxième version de cette sonde). */
    const ctxA = await nav.createBrowserContext();
    const A = await ctxA.newPage();
    await A.goto(url, { waitUntil: 'domcontentloaded' });
    await A.evaluate(j => localStorage.setItem('hakko-pont-jeton', j), JETON);
    await A.evaluate(() => localStorage.setItem('hakko-dashboard-v2', JSON.stringify({
      recipes: [{ id: 'sonde-r', name: 'Test eau sonde', type: 'koji', duration: 2, temp: 30, archived: false }],
      batches: [{ id: 'sonde-lot', name: 'Test eau sonde #1',
                  recipe: { id: 'sonde-r', name: 'Test eau sonde', type: 'koji', duration: 2, temp: 30 },
                  status: 'active', start: Date.now(), devices: [] }],
      devices: [], events: [] })));
    await A.reload({ waitUntil: 'networkidle2' });
    await jusqua(() => A.evaluate(() => !!document.querySelector('[data-action="partager"]')));
    await A.evaluate(() => { window.confirm = () => true; });
    await A.click('[data-action="partager"]');
    const revRef = await jusqua(async () => {
      const j = await (await fetch(`http://127.0.0.1:${pPont}/api/donnees/rev`, { headers: auth })).json();
      return j.rev > 0 ? j.rev : null;
    });
    dit(!!revRef, 'préparation : le pont détient un document de référence', 'rev ' + revRef);

    /* Une écriture au pont depuis node : sert à faire « un autre appareil a écrit » sans
       piloter une troisième interface. Même corps que pontEcrireDonnees. */
    const ecrireAuPont = async (base, donnees) => {
      const r = await fetch(`http://127.0.0.1:${pPont}/api/donnees`, {
        method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ base, op: 'sonde-' + Date.now(), donnees }),
      });
      return { status: r.status, j: await r.json().catch(() => null) };
    };

    /* ================= D8 — chemin AUTOMATIQUE B (un autre appareil a écrit) =========
     * C'est LE cas réel de D8 : B est à jour, n'a rien modifié localement, un autre
     * appareil écrit — l'adoption serait « sans risque »… sauf que la copie de sauvegarde
     * de G3 ne peut pas être écrite. On exige alors : rien d'adopté, PONT.rev NON avancé,
     * motif sauvegardeImpossible, bandeau affiché avec ses sorties.
     *
     * Le chemin automatique A (première lecture, état de démonstration) est mesuré
     * séparément plus bas : il se comporte autrement, pour une raison documentée. */
    console.log('\n  D8 — un autre appareil a écrit, quota saturé (chemin automatique B)');
    const ctxB = await nav.createBrowserContext();
    const B = await ctxB.newPage();
    const errB = [];
    B.on('pageerror', e => errB.push(String(e).slice(0, 140)));
    await B.goto(url, { waitUntil: 'domcontentloaded' });
    await B.evaluate(j => localStorage.setItem('hakko-pont-jeton', j), JETON);
    await B.reload({ waitUntil: 'domcontentloaded' });

    /* 1. B se synchronise NORMALEMENT : il adopte le document de référence. */
    const syncB = await jusqua(() => B.evaluate(() =>
      ((S.recipes || []).some(r => r.name === 'Test eau sonde') && PONT.sigEcrite) ? true : null), 60000);
    const apresSync = await B.evaluate(() => ({ rev: PONT.rev, sigEcrite: !!PONT.sigEcrite,
      recette: (S.recipes || []).some(r => r.name === 'Test eau sonde') }));
    dit(!!syncB, 'préparation B : B est à jour et n’a rien de local à perdre', JSON.stringify(apresSync));

    /* 2. On sature VRAIMENT le quota de B. */
    const preB = await B.evaluate(BOURRAGE);
    info('quota B', preB);
    dit(preB.sauvegardeLocalePossible === false,
        'précondition : sauvegarderLocal() échoue vraiment dans B',
        preB.blocs + ' blocs écrits, retour ' + preB.essai);

    /* 3. Un autre appareil écrit une recette de plus. */
    const docRef = await (await fetch(`http://127.0.0.1:${pPont}/api/donnees`, { headers: auth })).json();
    const docNeuf = JSON.parse(JSON.stringify(docRef.donnees));
    docNeuf.recettes = [...(docNeuf.recettes || []),
      { id: 'sonde-r2', name: 'Recette venue de l autre appareil', type: 'koji', duration: 3, temp: 28, archived: false }];
    const pousse = await ecrireAuPont(docRef.rev, docNeuf);
    info('ecriture autre appareil', { status: pousse.status, rev: pousse.j && pousse.j.rev });
    dit(pousse.status === 200 && pousse.j && pousse.j.rev > docRef.rev,
        'préparation : un autre appareil a écrit une révision plus récente',
        'rev ' + docRef.rev + ' -> ' + (pousse.j && pousse.j.rev));
    const revAutre = pousse.j && pousse.j.rev;

    /* 4. B doit REFUSER d'adopter et le dire. */
    await jusqua(() => B.evaluate(() =>
      (PONT.divergence && PONT.divergence.motif) ? true : null), 60000);
    const etatB = await B.evaluate(() => ({
      motif: PONT.divergence && PONT.divergence.motif,
      pontRev: PONT.rev,
      recetteAutreAppareil: (S.recipes || []).some(r => r.name === 'Recette venue de l autre appareil'),
      recetteRef: (S.recipes || []).some(r => r.name === 'Test eau sonde'),
      bandeau: (document.querySelector('[role="alert"], [role="status"]') || {}).textContent || '',
      aExport: !!document.querySelector('[data-action="exporter"]'),
      aAdopter: !!document.querySelector('[data-action="adopter"]'),
      aGarder: !!document.querySelector('[data-action="garder"]'),
    }));
    info('etat B', { ...etatB, bandeau: etatB.bandeau.replace(/\s+/g, ' ').trim().slice(0, 200) });
    dit(etatB.motif === 'sauvegardeImpossible',
        'D8/auto : la divergence porte le motif sauvegardeImpossible', 'motif = ' + etatB.motif);
    dit(etatB.recetteAutreAppareil === false,
        'D8/auto : le document du pont n’a PAS été adopté',
        'recette de l’autre appareil présente : ' + etatB.recetteAutreAppareil);
    dit(etatB.recetteRef === true, 'D8/auto : les données locales de B sont intactes');
    dit(etatB.pontRev !== revAutre,
        'D8/auto : PONT.rev n’est PAS avancé (la page ne se croit pas à jour)',
        'PONT.rev = ' + etatB.pontRev + ', pont = ' + revAutre);
    dit(/stockage/i.test(etatB.bandeau) && /plein/i.test(etatB.bandeau) && /pas/i.test(etatB.bandeau),
        'D8/auto : le bandeau AFFICHE l’état (stockage plein, rien adopté)');
    dit(etatB.aExport && etatB.aAdopter && etatB.aGarder,
        'D8/auto : le bandeau porte ses sorties nommées (exporter, adopter, garder)',
        `export ${etatB.aExport}, adopter ${etatB.aAdopter}, garder ${etatB.aGarder}`);

    /* L'adoption manuelle est REFUSÉE tant qu'aucun export n'a eu lieu.
     * Le clic est tolérant à l'absence du bouton : un contrôle négatif doit rendre des
     * assertions ROUGES, pas une exception qui masque les mesures suivantes. */
    const clic = async (p, sel) => {
      const vu = await p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
      if (!vu) info('clic impossible', sel + ' absent du DOM');
      return vu;
    };
    const dialogues = [];
    B.on('dialog', async d => { dialogues.push({ type: d.type(), msg: d.message() }); try { await d.accept(); } catch (e) {} });
    await clic(B, '[data-action="adopter"]');
    await dors(1200);
    const apresClicSansExport = await B.evaluate(() => ({
      adopte: (S.recipes || []).some(r => r.name === 'Recette venue de l autre appareil'),
      motif: PONT.divergence && PONT.divergence.motif,
      exportT: PONT.exportT,
    }));
    info('dialogues vus', dialogues.map(d => d.type + ' : ' + d.msg.replace(/\s+/g, ' ').slice(0, 120)));
    dit(dialogues.length === 1 && dialogues[0].type === 'alert' && /[Ee]xportez/.test(dialogues[0].msg),
        'D8/manuel : sans export, un alert() exige l’export (pas de confirm trompeur)',
        dialogues.length ? dialogues[0].type : 'aucun dialogue');
    dit(apresClicSansExport.adopte === false,
        'D8/manuel : rien n’est adopté avant l’export', JSON.stringify(apresClicSansExport));

    /* Après un export, le confirm() dit la vérité : AUCUNE copie conservée. */
    dialogues.length = 0;
    await B.evaluate(() => { PONT.exportT = Date.now(); });   /* l'export réel ouvre une boîte de téléchargement */
    await clic(B, '[data-action="adopter"]');
    await dors(1500);
    const apresExport = await B.evaluate(() => ({
      adopte: (S.recipes || []).some(r => r.name === 'Recette venue de l autre appareil'),
      motif: PONT.divergence && PONT.divergence.motif,
    }));
    info('dialogue apres export', dialogues.map(d => d.type + ' : ' + d.msg.replace(/\s+/g, ' ').slice(0, 220)));
    const msg = dialogues.length ? dialogues[0].msg : '';
    dit(dialogues.length === 1 && dialogues[0].type === 'confirm'
        && /AUCUNE copie de sauvegarde/.test(msg) && !/est conservée dans ce navigateur/.test(msg),
        'D8/manuel : le confirm() ne promet PAS « votre version est conservée »',
        msg.replace(/\s+/g, ' ').slice(0, 90));
    dit(apresExport.adopte === true,
        'D8/manuel : après export, l’adoption forcée aboutit (pas d’impasse)',
        JSON.stringify(apresExport));

    /* ========= D8 — chemin automatique A (première lecture, état de démonstration) =====
     * Mesure honnête : sur cette branche, saturer le quota fait AUSSI tomber la marque
     * « démonstration ». `empreinteDemo` inclut la longueur du journal, et un save() en
     * échec y écrit une alerte de stockage — l'empreinte diverge donc de sa référence et
     * save() retire la marque. La page ne tente alors plus d'adoption automatique du tout :
     * elle prend la route ordinaire `divergence`. Résultat différent, exigence identique —
     * RIEN n'est adopté et le bandeau le dit avec ses sorties. C'est ce qu'on vérifie. */
    console.log('\n  D8 — première lecture, quota saturé (chemin automatique A)');
    vanne.ferme = true;
    const ctxD = await nav.createBrowserContext();
    const D = await ctxD.newPage();
    const errD = [];
    D.on('pageerror', e => errD.push(String(e).slice(0, 140)));
    await D.goto(url, { waitUntil: 'domcontentloaded' });
    await D.evaluate(j => localStorage.setItem('hakko-pont-jeton', j), JETON);
    await D.reload({ waitUntil: 'domcontentloaded' });
    await dors(2500);
    const preD = await D.evaluate(BOURRAGE);
    const avantD = await D.evaluate(() => ({ rev: PONT.rev,
      recette: (S.recipes || []).some(r => r.name === 'Test eau sonde'), ensemence: S.ensemence }));
    info('quota D', preD); info('avant reouverture D', avantD);
    dit(preD.sauvegardeLocalePossible === false && avantD.rev === null && avantD.recette === false,
        'précondition D : quota saturé et rien encore adopté', JSON.stringify(avantD));
    /* Comme pour C et E : on attend des synchronisations réelles (une tous les 15 s), pas
       un délai arbitraire, sinon « rien n'est adopté » ne mesure rien. */
    const revAvantD = cpt.rev;
    vanne.ferme = false;
    const syncVueD = await jusqua(() => cpt.rev >= revAvantD + 2 ? true : null, 60000, 500);
    dit(!!syncVueD, 'D : au moins deux synchronisations ont bien eu lieu après réouverture',
        'lectures de révision : ' + revAvantD + ' -> ' + cpt.rev);
    const etatD = await D.evaluate(() => ({
      motif: PONT.divergence && PONT.divergence.motif,
      ensemence: S.ensemence,
      actif: PONT.actif, disponible: PONT.disponible, jetonRequis: PONT.jetonRequis,
      partage: PONT.partage, pontRev: PONT.rev,
      adopte: (S.recipes || []).some(r => r.name === 'Test eau sonde'),
      demoEncoreLa: (S.recipes || []).some(r => r.name === 'Saison du Nord'),
      bandeau: (document.querySelector('[role="alert"], [role="status"]') || {}).textContent || '',
      aExport: !!document.querySelector('[data-action="exporter"]'),
      aAdopter: !!document.querySelector('[data-action="adopter"]'),
    }));
    info('etat D', { ...etatD, bandeau: etatD.bandeau.replace(/\s+/g, ' ').trim().slice(0, 170) });
    dit(etatD.adopte === false && etatD.demoEncoreLa === true,
        'D8/première lecture : RIEN n’est adopté quand la sauvegarde est impossible',
        JSON.stringify({ adopte: etatD.adopte, demo: etatD.demoEncoreLa, motif: etatD.motif }));
    dit(etatD.aExport === true,
        'D8/première lecture : l’export reste atteignable dans tous les cas',
        'bandeau : ' + etatD.bandeau.replace(/\s+/g, ' ').trim().slice(0, 70));

    /* ================= D9 — première lecture, dialogue ouvert ================= */
    console.log('\n  D9 — aucune adoption pendant une saisie, branche PREMIÈRE lecture');
    vanne.ferme = true;
    const ctxC = await nav.createBrowserContext();
    const C = await ctxC.newPage();
    const errC = [];
    C.on('pageerror', e => errC.push(String(e).slice(0, 140)));
    await C.goto(url, { waitUntil: 'domcontentloaded' });
    await C.evaluate(j => localStorage.setItem('hakko-pont-jeton', j), JETON);
    await C.reload({ waitUntil: 'domcontentloaded' });
    await dors(2500);
    const avantC = await C.evaluate(() => ({ rev: PONT.rev, lot: (S.recipes || []).some(r => r.name === 'Test eau sonde') }));
    dit(avantC.rev === null && avantC.lot === false,
        'préparation C : vanne fermée, PONT.rev est encore null', JSON.stringify(avantC));

    /* On ouvre un vrai dialogue de saisie : « Ajouter un appareil ». */
    const dlgOuvert = await C.evaluate(() => {
      const a = document.querySelector('a[href="#/appareils"], [data-action="nav"][data-vue="#/appareils"]');
      if (a) a.click(); else location.hash = '#/appareils';
      return true;
    });
    await dors(1200);
    const ouvert = await C.evaluate(() => {
      const b = document.querySelector('[data-action="add-dev"]');
      if (!b) return { ok: false, pourquoi: 'bouton add-dev introuvable' };
      b.click();
      const d = document.getElementById('dlg');
      return { ok: !!(d && d.open) };
    });
    dit(dlgOuvert && ouvert.ok, 'préparation C : un dialogue de saisie est ouvert', JSON.stringify(ouvert));

    /* On rouvre la vanne : le document est de nouveau lisible. La page ne doit RIEN adopter.
     *
     * ATTENTION — c'est l'erreur qu'a faite la troisième version de cette sonde : la boucle
     * ne synchronise QU'UN TOUR SUR CINQ (`ticPont % 5`, soit toutes les 15 s), pas toutes
     * les 3 s. Attendre 11 s laissait donc la fenêtre sans aucune synchronisation, et
     * « rien n'est adopté » passait au vert même avec la correction retirée : la mesure ne
     * mesurait rien. On attend maintenant que DEUX lectures de révision aient réellement
     * eu lieu, puis on vérifie que le document n'a PAS été téléchargé — la garde doit
     * arrêter la page avant le GET /api/donnees. */
    const revAvant = cpt.rev, docAvant = cpt.doc;
    vanne.ferme = false;
    const syncVue = await jusqua(() => cpt.rev >= revAvant + 2 ? true : null, 60000, 500);
    dit(!!syncVue, 'C : au moins deux synchronisations ont bien eu lieu pendant la saisie',
        'lectures de révision : ' + revAvant + ' -> ' + cpt.rev);
    dit(cpt.doc === docAvant,
        'D9 : le document n’est même pas TÉLÉCHARGÉ pendant la saisie',
        'GET /api/donnees : ' + docAvant + ' -> ' + cpt.doc);
    const pendantSaisie = await C.evaluate(() => ({
      dlgOuvert: !!(document.getElementById('dlg') || {}).open,
      pontRev: PONT.rev,
      adopte: (S.recipes || []).some(r => r.name === 'Test eau sonde'),
      demoEncoreLa: (S.recipes || []).some(r => r.name === 'Saison du Nord'),
    }));
    info('C pendant la saisie', pendantSaisie);
    dit(pendantSaisie.dlgOuvert === true, 'C : le dialogue est resté ouvert pendant la mesure');
    dit(pendantSaisie.adopte === false,
        'D9 : RIEN n’est adopté pendant la saisie, première lecture comprise',
        JSON.stringify(pendantSaisie));

    /* Fermeture du dialogue : la synchronisation doit REPRENDRE — le gel est une pause,
     * pas une panne. Attention : `add-dev` fait partie de GESTES_EDITION, donc ouvrir ce
     * dialogue a fait tomber la marque « démonstration » de C. À la reprise, C ne doit
     * donc PAS adopter en silence : il a été édité, et la page lui pose une divergence
     * avec son bandeau. C'est le comportement correct, pas un gel — ce qu'on vérifie
     * ici, c'est que la page a de nouveau TRANCHÉ. L'adoption elle-même reprend dans le
     * contexte E ci-dessous, où le dialogue est ouvert sans geste d'édition. */
    await C.evaluate(() => {
      const b = document.querySelector('#dlg [data-action="close-dlg"]');
      if (b) b.click(); else { const d = document.getElementById('dlg'); if (d) d.close(); }
    });
    const repriseC = await jusqua(() => C.evaluate(() =>
      (PONT.rev !== null || PONT.divergence) ? true : null), 60000);
    /* `bandeauPartage()` n'est appelée que depuis `home()` : le bandeau n'existe que sur la
       vue d'ensemble, pour TOUS ses états (c'était déjà le cas avant cette correction).
       C est sur #/appareils — on revient à l'accueil pour pouvoir le lire. */
    await C.evaluate(() => {
      const a = document.querySelector('a[href="#/"], a[href="#"]');
      if (a) a.click(); else { location.hash = '#/'; if (typeof render === 'function') render(); }
    });
    await dors(1500);
    const finC = await C.evaluate(() => ({
      pontRev: PONT.rev, adopte: (S.recipes || []).some(r => r.name === 'Test eau sonde'),
      ensemence: S.ensemence, motif: PONT.divergence && PONT.divergence.motif,
      aAdopter: !!document.querySelector('[data-action="adopter"]'),
      aExport: !!document.querySelector('[data-action="exporter"]'),
    }));
    info('C apres fermeture', finC);
    dit(!!repriseC && finC.pontRev !== null && (finC.adopte || !!finC.motif),
        'D9 : une fois la saisie finie, la synchronisation reprend et la page tranche',
        JSON.stringify(finC));
    dit(finC.ensemence !== true && finC.motif === 'divergence' && finC.aAdopter && finC.aExport,
        'D9 : C ayant été édité (add-dev), la reprise pose une divergence affichée, pas une adoption muette',
        JSON.stringify({ ensemence: finC.ensemence, motif: finC.motif, adopter: finC.aAdopter }));

    /* --- contexte E : dialogue ouvert SANS geste d'édition (la marque démo survit) ---
     * §6 est écrite contre `dlg.open` : on met la page exactement dans cet état, sans
     * passer par un geste qui changerait par ailleurs la décision. On mesure alors les
     * deux moitiés de la règle : rien pendant la saisie, adoption après. */
    console.log('\n  D9 — dialogue ouvert sans geste d’édition (la marque démo survit)');
    vanne.ferme = true;
    const ctxE = await nav.createBrowserContext();
    const E = await ctxE.newPage();
    const errE = [];
    E.on('pageerror', e => errE.push(String(e).slice(0, 140)));
    await E.goto(url, { waitUntil: 'domcontentloaded' });
    await E.evaluate(j => localStorage.setItem('hakko-pont-jeton', j), JETON);
    await E.reload({ waitUntil: 'domcontentloaded' });
    await dors(2500);
    /* La marque « démonstration » tombe d'elle-même en quelques secondes (empreinteDemo
       inclut la longueur du journal, et la page y écrit), alors que la branche de première
       lecture n'adopte que si elle est encore là. Pour mesurer D9 sur CETTE branche — la
       seule qui était trouée — il faut donc tenir la précondition « navigateur de
       démonstration jamais touché » le temps de la mesure. On épingle la marque depuis la
       sonde : on ne touche pas au code mesuré, on maintient l'état dans lequel il est censé
       adopter. Sans cet épinglage, le contrôle négatif de D9 (§4) ne pourrait pas rougir,
       puisque le code fautif n'adopterait pas davantage. */
    const ouvertE = await E.evaluate(() => {
      const d = document.getElementById('dlg');
      if (!d) return { ok: false, pourquoi: '#dlg absent' };
      /* Épinglage DÉTERMINISTE. Un simple setInterval perdait la course : `save()` est
         appelée juste avant la synchronisation des données et y exécute
         `delete S.ensemence`, si bien que `etatEnsemence()` était lu pendant la fenêtre où
         la marque venait de tomber. Une propriété non configurable qui renvoie toujours
         `true` résiste au `delete` (non strict : il échoue en silence) et tient donc la
         précondition pendant toute la mesure. On ne modifie pas le code mesuré : on
         maintient l'état « navigateur de démonstration jamais touché ». */
      try {
        delete S.ensemence;
        Object.defineProperty(S, 'ensemence', {
          configurable: false, enumerable: true, get(){ return true; }, set(){},
        });
      } catch(e){ S.ensemence = true; }
      if (!d.open) d.showModal();
      return { ok: !!d.open, rev: PONT.rev, ensemence: S.ensemence, nEv: (S.events || []).length,
               empreinteEgale: typeof empreinteDemo === 'function' && typeof empreinteSemence === 'function'
                 ? (empreinteDemo(S) === empreinteSemence()) : 'n/a',
               adopte: (S.recipes || []).some(r => r.name === 'Test eau sonde') };
    });
    info('preparation E', ouvertE);
    dit(ouvertE.ok && ouvertE.rev === null && ouvertE.ensemence === true && ouvertE.adopte === false,
        'préparation E : dialogue ouvert, marque démo intacte, rien encore adopté',
        JSON.stringify(ouvertE));
    /* Même précaution que pour C : on attend des synchronisations RÉELLES, pas un délai. */
    const revAvantE = cpt.rev, docAvantE = cpt.doc;
    vanne.ferme = false;
    const syncVueE = await jusqua(() => cpt.rev >= revAvantE + 2 ? true : null, 60000, 500);
    dit(!!syncVueE, 'E : au moins deux synchronisations ont bien eu lieu pendant la saisie',
        'lectures de révision : ' + revAvantE + ' -> ' + cpt.rev);
    dit(cpt.doc === docAvantE,
        'D9 : le document n’est même pas TÉLÉCHARGÉ pendant la saisie (marque démo tenue)',
        'GET /api/donnees : ' + docAvantE + ' -> ' + cpt.doc);
    const pendantE = await E.evaluate(() => ({
      dlgOuvert: !!(document.getElementById('dlg') || {}).open,
      pontRev: PONT.rev, ensemence: S.ensemence, nEv: (S.events || []).length,
      empreinteEgale: typeof empreinteDemo === 'function' ? (empreinteDemo(S) === empreinteSemence()) : 'n/a',
      adopte: (S.recipes || []).some(r => r.name === 'Test eau sonde'),
      demoEncoreLa: (S.recipes || []).some(r => r.name === 'Saison du Nord'),
    }));
    info('E pendant la saisie', pendantE);
    dit(pendantE.dlgOuvert === true && pendantE.ensemence === true
        && pendantE.adopte === false && pendantE.demoEncoreLa === true,
        'D9 : rien n’est adopté pendant la saisie, marque démo tenue (LA branche qui adoptait)',
        JSON.stringify(pendantE));
    await E.evaluate(() => { const d = document.getElementById('dlg'); if (d) d.close(); });
    const adopteE = await jusqua(() => E.evaluate(() =>
      (S.recipes || []).some(r => r.name === 'Test eau sonde') ? true : null), 60000);
    const finE = await E.evaluate(() => ({
      pontRev: PONT.rev, adopte: (S.recipes || []).some(r => r.name === 'Test eau sonde'),
      demoEncoreLa: (S.recipes || []).some(r => r.name === 'Saison du Nord'),
      ensemence: S.ensemence, nEv: (S.events || []).length,
      motif: PONT.divergence && PONT.divergence.motif,
    }));
    info('E apres fermeture', finE);
    /* La marque étant tenue, la reprise doit ADOPTER : c'est la preuve que la garde est une
       pause et non un gel définitif — et c'est la mesure que le contrôle négatif de D9 fait
       simplement arriver trop tôt, pendant la saisie. */
    dit(!!adopteE && finE.adopte === true && finE.demoEncoreLa === false,
        'D9 : la saisie finie, l’adoption se fait bien (le gel est une pause, pas une panne)',
        JSON.stringify(finE));

    dit(errB.length === 0 && errC.length === 0 && errD.length === 0 && errE.length === 0, 'aucune erreur JavaScript dans les navigateurs de la sonde',
        [...errB, ...errC, ...errD, ...errE].slice(0, 2).join(' | '));
    dit(ha.vus.filter(v => v.quoi === 'on').length === 0, 'aucun allumage de prise pendant toute la sonde',
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
