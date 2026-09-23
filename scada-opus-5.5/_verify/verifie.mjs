// Harnais de vérification headless — Hakko (FermentationLab2)
// Usage : node.exe verifie.mjs --a URL [--b URL] [--sortie DOSSIER] [--cible a|b|deux]
// Code de sortie : 0 = tout passe ; 1 = au moins une assertion échoue ; 2 = une cible demandée est indisponible.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

/* ---------- Arguments ---------- */
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const URLS = { a: arg('a'), b: arg('b') };
const SORTIE = path.resolve(arg('sortie', 'sortie'));
const CIBLE = arg('cible', URLS.b ? 'deux' : 'a');
const EDGE = arg('edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const PARALLELE = +arg('parallele', 4);
if (!['a', 'b', 'deux'].includes(CIBLE)) { console.error('--cible doit valoir a, b ou deux'); process.exit(64); }
const CIBLES = CIBLE === 'deux' ? ['a', 'b'] : [CIBLE];
for (const c of CIBLES) if (!URLS[c]) { console.error(`--${c} URL manquant pour --cible ${CIBLE}`); process.exit(64); }
fs.mkdirSync(SORTIE, { recursive: true });

const ROUTES = ['#/', '#/f/b1', '#/archive', '#/archive/b0', '#/recettes', '#/recettes/new', '#/recettes/r1', '#/appareils'];
const UN_ECRAN = new Set(['#/', '#/f/b1', '#/archive/b0']);          // §9 / §10.2
const VIEWPORTS = [[1440, 860], [1280, 720]];
const THEMES = [['clair', 'light', '#F4F5F7'], ['sombre', 'dark', '#0E1116']];
// Horloge virtuelle commune à A et B (même graine => mêmes données simulées) ; calée à hh:mm:30 pour éviter les bascules de minute.
const BASE = Math.floor(Date.now() / 60000) * 60000 + 30000;

/* ---------- Assertions ---------- */
const assertions = [];
function verifie(id, cible, libelle, attendu, obtenu, ok) {
  const a = { id, cible, libelle, attendu, obtenu, ok: !!ok };
  assertions.push(a);
  console.log(`${ok ? '  OK ' : '  ÉCHEC'} [${cible}] ${id} ${libelle} — attendu: ${JSON.stringify(attendu)} | obtenu: ${JSON.stringify(obtenu)}`);
  return !!ok;
}
const pause = ms => new Promise(r => setTimeout(r, ms));
const slug = r => r.replace(/^#\/?/, '').replace(/\//g, '_') || 'accueil';

/* ---------- Navigateur ---------- */
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'shell',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
});

// Écouteurs attachés AVANT tout goto.
function ecouter(page) {
  const j = { console: [], pageerror: [], http: [], echecs: [], dialogues: [] };
  const bruit = u => /\/favicon\.ico(\?|$)/.test(u || '');
  page.on('console', m => {
    const t = m.type();
    if (t !== 'error' && t !== 'warn' && t !== 'warning') return;
    const loc = m.location() || {};
    if (bruit(loc.url) || /favicon\.ico/.test(m.text())) return;
    j.console.push({ type: t, texte: m.text(), url: loc.url, ligne: loc.lineNumber });
  });
  page.on('pageerror', e => j.pageerror.push(e && e.stack ? e.stack : String(e)));
  page.on('response', r => { if (r.status() >= 400 && !bruit(r.url())) j.http.push({ statut: r.status(), url: r.url() }); });
  page.on('requestfailed', r => { if (!bruit(r.url())) j.echecs.push({ url: r.url(), erreur: r.failure()?.errorText }); });
  page.on('dialog', async d => { j.dialogues.push({ type: d.type(), message: d.message() }); await d.accept(); });
  return j;
}
const nbErreurs = j => j.console.length + j.pageerror.length + j.http.length + j.echecs.length;

async function horlogeVirtuelle(page) {
  await page.evaluateOnNewDocument(base => {
    Date.now = () => base + Math.round(performance.now());
    let s = 0x5eed;
    Math.random = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }, BASE);
}

// Attend un vrai tick de données (le texte « En direct, HH:MM:SS » change toutes les 3 s).
async function attendreTick(page, n = 1) {
  for (let i = 0; i < n; i++) {
    const avant = await page.evaluate(() => document.getElementById('syncTop')?.textContent ?? '');
    await page.waitForFunction(v => (document.getElementById('syncTop')?.textContent ?? '') !== v, { timeout: 8000, polling: 100 }, avant);
  }
  await pause(250); // setTimeout des graphiques + ResizeObserver
}
async function aller(page, hash) {
  await page.evaluate(h => { location.hash = h; }, hash);
  await page.waitForFunction(h => location.hash === h || (h === '#/' && location.hash === ''), { timeout: 5000 }, hash);
  await pause(300);
}

/* ---------- Mesures dans la page ---------- */
function mesurerDansPage() {
  const se = document.scrollingElement;
  const visible = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  const desc = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  const chemin = el => { const p = []; for (let e = el; e && e !== document.body && p.length < 4; e = e.parentElement) p.unshift(desc(e)); return p.join(' > '); };
  const clippe = cs => cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
  const debordements = [], horsEcran = [];
  const vh = innerHeight, vw = innerWidth;
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    if (['SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName)) continue;
    const p = el.parentElement; if (!p || p === document.documentElement) continue;
    if (!visible(el)) continue;
    // un ancêtre masqué rend l'élément invisible même si son propre style est visible
    let cache = false; for (let a = p; a && a !== document.body; a = a.parentElement) { if (!visible(a)) { cache = true; break; } }
    if (cache) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    // 1) débordement enfant → parent, quand le parent ne coupe/défile pas lui-même
    if (p !== document.body && !clippe(getComputedStyle(p)) && cs.position !== 'fixed') {
      const pr = p.getBoundingClientRect();
      const d = { gauche: pr.left - r.left, droite: r.right - pr.right, haut: pr.top - r.top, bas: r.bottom - pr.bottom };
      // Un élément inline a pour rect la zone de contenu de la police, pas la boîte de ligne : son dépassement vertical n'est pas un débordement de mise en page.
      if (cs.display === 'inline') { d.haut = 0; d.bas = 0; }
      const max = Math.max(...Object.values(d));
      if (max > 1) debordements.push({ el: chemin(el), px: Math.round(max * 10) / 10, cote: Object.keys(d).find(k => d[k] === max) });
    }
    // 2) élément hors du viewport sans conteneur défilant pour le rattraper
    let conteneur = null; for (let a = p; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { if (clippe(getComputedStyle(a))) { conteneur = a; break; } }
    if (!conteneur && cs.position !== 'fixed' && (r.bottom > vh + 1 || r.right > vw + 1)) horsEcran.push({ el: chemin(el), bas: Math.round(r.bottom), droite: Math.round(r.right) });
  }
  const before = scrollY;
  window.scrollTo(99999, 99999); const sy = scrollY, sx = scrollX; window.scrollTo(0, before);
  const dp = document.querySelector('#view .dp');
  const rs = getComputedStyle(document.documentElement);
  return {
    vue: { largeur: vw, hauteur: vh },
    defilement: { vertical: se.scrollHeight - se.clientHeight, horizontal: se.scrollWidth - se.clientWidth, scrollYMax: sy, scrollXMax: sx },
    dpBas: dp ? Math.round(dp.getBoundingClientRect().bottom) : null,
    page: document.getElementById('view')?.dataset.page ?? null,
    theme: { attr: document.documentElement.getAttribute('data-theme'), bg: rs.getPropertyValue('--bg').trim().toUpperCase(), fondBody: getComputedStyle(document.body).backgroundColor, cle: localStorage.getItem('hakko-theme') },
    debordements: debordements.slice(0, 40), nbDebordements: debordements.length,
    horsEcran: horsEcran.slice(0, 40), nbHorsEcran: horsEcran.length,
  };
}

function signatureDansPage() {
  const N = s => String(s ?? '')
    .replace(/\s+/g, ' ').trim()
    .replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, '«hh:mm:ss»')
    .replace(/il y a \d+ (s|min|h|j)\b/g, 'il y a «…»')
    .replace(/[?&]v=[\w.-]+/g, '«version»').replace(/\bv\d+(\.\d+)+\b/g, '«version»');
  const app = document.querySelector('.app').cloneNode(true);
  app.appendChild(document.getElementById('tabbar').cloneNode(true));
  app.querySelectorAll('[data-live],[data-state]').forEach(e => { e.textContent = '«direct»'; });
  app.querySelectorAll('[data-chart]').forEach(e => { e.textContent = ''; });
  app.querySelectorAll('svg').forEach(e => e.remove());
  const T = sel => [...app.querySelectorAll(sel)].map(e => N(e.textContent));
  const C = sel => document.querySelectorAll(sel).length;
  return {
    titre: document.title,
    compteurs: {
      tuilesLot: C('#view .lot'), lignesTableau: C('#view tbody tr'), onglets: C('#view [role=tab]'), prises: C('#view .outlet'),
      kpis: C('#view .kpi'), journal: C('#view .jl'), activite: C('#feed li'), sante: C('#view .health li'), graphiques: C('#view [data-chart]'),
      formulaires: C('#view form'), boutons: C('#view button'), champs: C('#view input, #view select, #view textarea'), liensNav: C('#nav a'),
      cartes: C('#view .card'), frise: C('#view .strip span'),
    },
    h1: T('#view h1'), filAriane: T('#crumbs'), nav: T('#nav a'), barreOnglets: T('#tabbar a'),
    h2: T('#view h2'), kpis: T('#view .kpi').map(s => s), entetes: T('#view th'), onglets: T('#view [role=tab]'),
    boutons: T('#view button, #view a.btn'), lignes: T('#view tbody tr'), tuiles: T('#view .lot'), prises: T('#view .outlet'),
    parametres: T('#view dl.kv'), activite: T('#feed li'), sante: T('#view .health li'), journal: T('#view .jl'),
    legendes: T('#view .legend'), sousTitres: T('#view .dp-sub, #view .ph p'),
  };
}

/* ---------- Disponibilité d'une cible ---------- */
async function disponible(url) {
  const ctx = await browser.createBrowserContext();
  try {
    const page = await ctx.newPage();
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const ok = !!r && r.status() < 400 && await page.evaluate(() => !!document.getElementById('view'));
    return { ok, statut: r ? r.status() : null };
  } catch (e) { return { ok: false, statut: null, erreur: e.message }; }
  finally { await ctx.close(); }
}

/* ---------- Passe 1 : routes × thèmes × viewports ---------- */
async function unCas(cible, [w, h], [nomTheme, cleTheme, bgAttendu], route) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const j = ecouter(page);
  try {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: cleTheme }]);
    await horlogeVirtuelle(page);
    await page.evaluateOnNewDocument(t => { try { localStorage.setItem('hakko-theme', t); } catch (e) {} }, cleTheme);
    await page.goto(URLS[cible] + route, { waitUntil: 'load', timeout: 20000 });
    await attendreTick(page);
    const m = await page.evaluate(mesurerDansPage);
    const sig = await page.evaluate(signatureDansPage);
    const hashFinal = await page.evaluate(() => location.hash);
    const capture = path.join(SORTIE, `${cible}_${w}x${h}_${nomTheme}_${slug(route)}.png`);
    await page.screenshot({ path: capture });
    return { cible, vp: `${w}x${h}`, theme: nomTheme, route, hashFinal, bgAttendu, mesures: m, signature: sig, journal: j, capture: path.basename(capture) };
  } catch (e) {
    return { cible, vp: `${w}x${h}`, theme: nomTheme, route, erreurHarnais: e.stack, journal: j };
  } finally { await ctx.close(); }
}

async function passeMiseEnPage(cible) {
  const taches = [];
  for (const vp of VIEWPORTS) for (const th of THEMES) for (const r of ROUTES) taches.push([vp, th, r]);
  const res = []; let i = 0;
  await Promise.all(Array.from({ length: PARALLELE }, async () => {
    while (i < taches.length) { const [vp, th, r] = taches[i++]; res.push(await unCas(cible, vp, th, r)); process.stdout.write('.'); }
  }));
  process.stdout.write('\n');
  const ordre = c => VIEWPORTS.findIndex(v => `${v[0]}x${v[1]}` === c.vp) * 100 + THEMES.findIndex(t => t[0] === c.theme) * 10 + ROUTES.indexOf(c.route);
  res.sort((x, y) => ordre(x) - ordre(y));
  for (const c of res) {
    const k = `${c.route} ${c.vp} ${c.theme}`;
    if (c.erreurHarnais) { verifie('harnais', cible, `${k} exécution du cas`, 'pas d’exception', c.erreurHarnais.split('\n')[0], false); continue; }
    const j = c.journal, m = c.mesures;
    verifie('§10.1', cible, `${k} erreurs console/pageerror/HTTP≥400/requêtes échouées`, 0,
      nbErreurs(j) ? { total: nbErreurs(j), console: j.console, pageerror: j.pageerror, http: j.http, echecs: j.echecs } : 0, nbErreurs(j) === 0);
    verifie('§3.1', cible, `${k} thème appliqué (--bg)`, c.bgAttendu, m.theme.bg, m.theme.bg === c.bgAttendu);
    if (UN_ECRAN.has(c.route)) {
      verifie('§10.2', cible, `${k} défilement vertical du document`, 0, m.defilement.vertical, m.defilement.vertical === 0 && m.defilement.scrollYMax === 0);
      verifie('§10.2', cible, `${k} défilement horizontal du document`, 0, m.defilement.horizontal, m.defilement.horizontal === 0 && m.defilement.scrollXMax === 0);
      verifie('§9', cible, `${k} data-page="detail"`, 'detail', m.page, m.page === 'detail');
      verifie('§9', cible, `${k} éléments hors écran hors conteneur défilant`, 0, m.nbHorsEcran ? m.horsEcran.slice(0, 5) : 0, m.nbHorsEcran === 0);
      verifie('§9', cible, `${k} débordements enfant→conteneur`, 0, m.nbDebordements ? m.debordements.slice(0, 5) : 0, m.nbDebordements === 0);
    }
  }
  return res;
}

/* ---------- Passe 2 : les 8 points de §10 par interactions réelles ---------- */
async function passeFonctionnelle(cible) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const j = ecouter(page);
  const V = (id, lib, att, obt, ok) => verifie(id, cible, lib, att, obt, ok);
  const trace = {};
  try {
    await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.goto(URLS[cible] + '#/', { waitUntil: 'load', timeout: 20000 });
    await attendreTick(page);

    /* §10.3 — valeurs en direct, focus et scroll conservés */
    const lireDirect = () => page.evaluate(() => ({
      horloge: document.getElementById('syncTop').textContent,
      valeurs: Object.fromEntries([...document.querySelectorAll('[data-live]')].map((e, i) => [e.dataset.live + '#' + i, e.textContent])),
    }));
    // Observe jusqu'à nMax ticks : horloge, textes data-live (DOM) et valeurs brutes des sondes (état JS `S`), arrêt dès qu'un texte data-live a changé (après au moins 2 ticks).
    const observerTicks = async (nMax = 5) => {
      const etatSondes = () => page.evaluate(() => { try { return S.devices.filter(d => d.online && d.kind !== 'plug').map(d => d.id + '=' + d.value).join(' '); } catch (e) { return null; } });
      const d0 = await lireDirect(), s0 = await etatSondes();
      const ticks = []; let prec = d0, precS = s0, dom = [];
      for (let k = 0; k < nMax; k++) {
        await attendreTick(page);
        const d = await lireDirect(), st = await etatSondes();
        ticks.push({ horlogeChange: d.horloge !== prec.horloge, sondesChangent: st != null && st !== precS });
        dom = Object.keys(d0.valeurs).filter(x => d0.valeurs[x] !== d.valeurs[x]).map(x => `${x}: ${d0.valeurs[x]} → ${d.valeurs[x]}`);
        prec = d; precS = st;
        if (k >= 1 && dom.length) break;
      }
      return { ticks, dom, total: Object.keys(d0.valeurs).length, horloge: [d0.horloge, prec.horloge] };
    };
    // Accueil : scroll de #feed
    const feedAvant = await page.evaluate(() => { const f = document.getElementById('feed'); f.scrollTop = 80; f.__marque = 1; return { top: f.scrollTop, defilable: f.scrollHeight > f.clientHeight }; });
    const o0 = await observerTicks();
    const feedApres = await page.evaluate(() => { const f = document.getElementById('feed'); return { top: f.scrollTop, meme: f.__marque === 1 }; });
    V('§10.3', 'accueil : à chaque tick l’horloge « En direct » et les valeurs brutes des sondes (état JS) changent', o0.ticks.map(() => '✓/✓').join(' '), o0.ticks.map(t => (t.horlogeChange ? '✓' : '✗') + '/' + (t.sondesChangent ? '✓' : '✗')).join(' '), o0.ticks.every(t => t.horlogeChange && t.sondesChangent));
    V('§10.3', `accueil : au moins une valeur data-live affichée a changé (en ${o0.ticks.length} ticks)`, '≥ 1', { changees: o0.dom.length, total: o0.total, exemples: o0.dom.slice(0, 3) }, o0.dom.length >= 1);
    V('§10.3', 'accueil : #feed défilable et scrollTop conservé', { defilable: true, top: feedAvant.top, memeNoeud: true }, { defilable: feedAvant.defilable, top: feedApres.top, memeNoeud: feedApres.meme }, feedAvant.defilable && feedApres.top === feedAvant.top && feedApres.meme);
    // Détail b1 : focus + saisie dans la note, scroll du journal
    await page.click('a.lot[href="#/f/b1"]');
    await page.waitForFunction(() => location.hash === '#/f/b1'); await pause(400);
    await page.click('form[data-form="note"] input[name="x"]');
    await page.keyboard.type('Observation en cours');
    const jAvant = await page.evaluate(() => { const l = document.getElementById('journal-list'); l.scrollTop = 50; return { top: l.scrollTop, defilable: l.scrollHeight > l.clientHeight }; });
    const o1 = await observerTicks();
    const fApres = await page.evaluate(() => { const a = document.activeElement; return { focus: a && a.name === 'x' && !!a.closest('form[data-form="note"]'), valeur: a ? a.value : null, top: document.getElementById('journal-list').scrollTop }; });
    V('§10.3', '#/f/b1 : à chaque tick l’horloge et les valeurs brutes des sondes (état JS) changent', o1.ticks.map(() => '✓/✓').join(' '), o1.ticks.map(t => (t.horlogeChange ? '✓' : '✗') + '/' + (t.sondesChangent ? '✓' : '✗')).join(' '), o1.ticks.every(t => t.horlogeChange && t.sondesChangent));
    V('§10.3', `#/f/b1 : au moins une valeur data-live affichée a changé (en ${o1.ticks.length} ticks)`, '≥ 1', { changees: o1.dom.length, total: o1.total, exemples: o1.dom.slice(0, 3) }, o1.dom.length >= 1);
    V('§10.3', '#/f/b1 : focus conservé dans le champ note', { focus: true, valeur: 'Observation en cours' }, { focus: fApres.focus, valeur: fApres.valeur }, fApres.focus && fApres.valeur === 'Observation en cours');
    V('§10.3', '#/f/b1 : journal défilable et scrollTop conservé', { defilable: true, top: jAvant.top }, { defilable: jAvant.defilable, top: fApres.top }, jAvant.defilable && jAvant.top > 0 && fApres.top === jAvant.top);
    await page.evaluate(() => { const a = document.activeElement; if (a) { a.value = ''; a.blur(); } });

    /* §10.4 — changement de consigne */
    const lireJournal = () => page.evaluate(() => [...document.querySelectorAll('#journal-list li.jl')].map(li => ({ badge: li.querySelector('.badge')?.textContent, corps: li.querySelector('.jt')?.textContent, heure: li.querySelector('time')?.textContent })));
    const chauffeKpi = await page.evaluate(() => document.querySelector('#view [data-live="heat:b1"]')?.textContent);
    const c0 = +(await page.$eval('form[data-form="target"] input[name="t"]', e => e.value));
    const sens = chauffeKpi === 'Active' ? [-3, +6] : [+3, -6];
    let courant = c0;
    trace.consigne = { depart: c0, chauffeInitiale: chauffeKpi, sens };
    for (const delta of sens) {
      const avant = await lireJournal();
      const nClic = Math.abs(delta) / 0.5;
      for (let k = 0; k < nClic; k++) await page.click(`form[data-form="target"] button[data-action="tstep"][data-d="${delta > 0 ? '0.5' : '-0.5'}"]`);
      const cible_ = courant + delta;
      const saisi = +(await page.$eval('form[data-form="target"] input[name="t"]', e => e.value));
      V('§6.2', `stepper : ${nClic} clics ${delta > 0 ? '+' : '−'} depuis ${courant}`, cible_, saisi, saisi === cible_);
      await page.click('form[data-form="target"] button.primary');
      await pause(400);
      const apres = await lireJournal();
      const f = n => n.toFixed(1).replace('.', ',');
      const attenduC = `Consigne modifiée de ${f(courant)} °C à ${f(cible_)} °C`;
      const iC = apres.findIndex(x => x.badge === 'Consigne' && x.corps === attenduC);
      const nChauffeAvant = avant.filter(x => /^Chauffe (on|off)$/.test(x.badge)).length;
      const chauffes = apres.filter(x => /^Chauffe (on|off)$/.test(x.badge));
      const attenduSens = delta > 0 ? 'Activation' : 'Désactivation';
      const iH = apres.findIndex(x => /^Chauffe (on|off)$/.test(x.badge));
      const h = apres[iH] || {};
      const m = /^(-?\d+,\d) °C \(([+−])(\d+,\d) °C\) - (Activation|Désactivation) de la chauffe(, manuelle)?$/.exec(h.corps || '');
      V('§10.4', `consigne ${f(courant)}→${f(cible_)} : entrée « Consigne »`, attenduC, iC >= 0 ? apres[iC].corps : apres.slice(0, 3), iC >= 0);
      V('§10.4', `consigne ${f(courant)}→${f(cible_)} : une nouvelle entrée de chauffe`, nChauffeAvant + 1, chauffes.length, chauffes.length === nChauffeAvant + 1);
      V('§10.4', `consigne ${f(courant)}→${f(cible_)} : entrée de chauffe la plus récente au format et au sens attendus`,
        `x °C (${delta > 0 ? '−' : '+'}y °C) - ${attenduSens} de la chauffe [badge ${delta > 0 ? 'Chauffe on' : 'Chauffe off'}]`, `${h.corps} [badge ${h.badge}]`,
        !!m && m[4] === attenduSens && m[2] === (delta > 0 ? '−' : '+') && h.badge === (delta > 0 ? 'Chauffe on' : 'Chauffe off') && !m[5]);
      if (m) {
        const tp = +m[1].replace(',', '.'), dl = (m[2] === '−' ? -1 : 1) * +m[3].replace(',', '.');
        V('§10.4', `consigne ${f(courant)}→${f(cible_)} : tp − écart = nouvelle consigne (±0,1)`, cible_, +(tp - dl).toFixed(1), Math.abs(tp - dl - cible_) <= 0.11);
      }
      V('§10.4', `consigne ${f(courant)}→${f(cible_)} : « Consigne » puis chauffe (chauffe plus récente ou simultanée)`, 'index chauffe < index consigne', { iChauffe: iH, iConsigne: iC }, iH >= 0 && iC >= 0 && iH < iC);
      const kpiC = await page.evaluate(() => [...document.querySelectorAll('#view .kpi')].find(k => k.querySelector('.k')?.textContent === 'Consigne')?.querySelector('.v')?.textContent);
      V('§6.2', `KPI Consigne après application`, `${f(cible_)}°C`, kpiC, kpiC === `${f(cible_)}°C`);
      courant = cible_;
    }
    trace.consigne.finale = courant;

    /* §10.5 — relevé de densité daté dans le passé */
    await page.click('button[data-action="ctab"][data-v="grav"]');
    await pause(500);
    const g0 = await page.evaluate(() => ({ n: document.querySelectorAll('.grav-list tbody tr').length, periodeMasquee: !document.querySelector('#view [data-action="range"]') }));
    V('§6.2', 'onglet Densité : période masquée', true, g0.periodeMasquee, g0.periodeMasquee);
    await page.click('form[data-form="gravity"] input[name="g"]');
    await page.keyboard.type('1.007');
    const dt = await page.evaluate(() => {
      // Date de la mesure : début du lot + 4 jours, arrondie à la minute (entre les relevés J3 et J5).
      const st = +document.querySelector('.grav-list tbody tr:last-child button[data-action="rm-grav"]').dataset.t;
      const t = Math.floor((st + 4 * 864e5) / 60000) * 60000, d = new Date(t - new Date(t).getTimezoneOffset() * 60000);
      const inp = document.querySelector('form[data-form="gravity"] input[name="d"]');
      inp.focus(); inp.value = d.toISOString().slice(0, 16); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
      return { t, start: st, valeur: inp.value, g: document.querySelector('form[data-form="gravity"] input[name="g"]').value,
        texte: new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ', ' + new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
    });
    V('§6.2', 'saisie du relevé', { g: '1.007', d: 'datetime-local non vide' }, { g: dt.g, d: dt.valeur }, dt.g === '1.007' && !!dt.valeur);
    await page.click('form[data-form="gravity"] button.btn');
    await pause(600);
    const g1 = await page.evaluate(t => {
      const rows = [...document.querySelectorAll('.grav-list tbody tr')].map(tr => ({ date: tr.cells[0].textContent, g: tr.cells[1].textContent, t: +tr.querySelector('[data-action="rm-grav"]')?.dataset.t }));
      const svg = document.querySelector('#chart-main svg');
      const W = +svg.getAttribute('width');
      const pts = [...svg.querySelectorAll('circle[r="3.5"]')].map(c => ({ cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy') })).sort((a, b) => a.cx - b.cx);
      return { rows, W, pts };
    }, dt.t);
    const idx = g1.rows.findIndex(r => r.g === '1,007');
    const attenduIdx = g1.rows.filter(r => r.t > dt.t).length;
    V('§10.5', 'tableau : une ligne de plus', g0.n + 1, g1.rows.length, g1.rows.length === g0.n + 1);
    V('§10.5', 'tableau : ligne 1,007 à la date saisie', dt.texte, idx >= 0 ? g1.rows[idx].date : null, idx >= 0 && g1.rows[idx].date === dt.texte && g1.rows[idx].t === dt.t);
    V('§10.5', 'tableau : ligne 1,007 triée à sa place (du plus récent au plus ancien)', attenduIdx, idx, idx === attenduIdx && attenduIdx > 0);
    // Graphique : x0 = début, x1 = max(début + 0,6 × 21 j, dernier relevé + 1 j) ; marges L46 R14.
    const x1 = Math.max(dt.start + 21 * 864e5 * 0.6, Math.max(...g1.rows.map(r => r.t)) + 864e5);
    const cxAtt = 46 + (dt.t - dt.start) / (x1 - dt.start) * (g1.W - 60);
    const plusBas = g1.pts.reduce((a, p, i) => (p.cy > g1.pts[a].cy ? i : a), 0);
    V('§10.5', 'graphique : un point de plus', g1.rows.length, g1.pts.length, g1.pts.length === g1.rows.length);
    V('§10.5', 'graphique : point 1,007 (le plus bas) à l’abscisse de sa date', `cx ≈ ${cxAtt.toFixed(1)} (rang ${g1.rows.length - 1 - attenduIdx})`, `cx = ${g1.pts[plusBas]?.cx} (rang ${plusBas})`,
      Math.abs(g1.pts[plusBas]?.cx - cxAtt) < 1.5 && plusBas === g1.rows.length - 1 - attenduIdx);
    trace.densite = { saisie: dt, lignes: g1.rows.map(r => `${r.date} ${r.g}`) };

    /* §10.7 — multiprise */
    await aller(page, '#/appareils');
    await page.click('button[data-action="dfilter"][data-v="plug"]');
    await pause(300);
    const lirePrises = () => page.evaluate(() => [...document.querySelectorAll('#view .outlet')].map(o => {
      const b = o.querySelector('.o-btn'); return { slot: o.querySelector('.o-slot')?.textContent, texte: b?.textContent, aria: b?.getAttribute('aria-pressed'), fond: b ? getComputedStyle(b).backgroundColor : null, couleur: b ? getComputedStyle(b).color : null, hauteur: b ? b.getBoundingClientRect().height : null, isOn: o.classList.contains('is-on') };
    }));
    const VERT = 'rgb(31, 157, 85)', ROUGE = 'rgb(197, 48, 48)';
    const p0 = await lirePrises();
    V('§10.7', 'nombre de tuiles de prise', 5, p0.length, p0.length === 5);
    const conforme = p => (p.texte === 'ON' && p.fond === VERT && p.aria === 'true' && p.isOn) || (p.texte === 'OFF' && p.fond === ROUGE && p.aria === 'false' && !p.isOn);
    p0.forEach(p => V('§10.7', `${p.slot} : ON vert ou OFF rouge (44 px, texte blanc)`, 'ON/rgb(31, 157, 85) ou OFF/rgb(197, 48, 48)', `${p.texte}/${p.fond}/${p.hauteur}px/${p.couleur}`, conforme(p) && p.hauteur === 44 && p.couleur === 'rgb(255, 255, 255)'));
    for (let i = 0; i < p0.length; i++) {
      await page.click(`#view .outlet:nth-child(${i + 1}) .o-btn`);
      await pause(250);
      const p1 = (await lirePrises())[i];
      const att = p0[i].texte === 'ON' ? 'OFF' : 'ON';
      V('§10.7', `${p0[i].slot} : bascule au clic`, `${att}/${att === 'ON' ? VERT : ROUGE}`, `${p1.texte}/${p1.fond}`, p1.texte === att && conforme(p1));
    }
    const pBasc = await lirePrises();
    await attendreTick(page);
    const pTick = await lirePrises();
    V('§6.6', 'prises basculées (mode manuel) stables après un tick', pBasc.map(p => p.texte).join(' '), pTick.map(p => p.texte).join(' '), pBasc.map(p => p.texte).join() === pTick.map(p => p.texte).join());

    /* §10.6 — Terminer le lot b4 */
    await aller(page, '#/');
    const h0 = await page.evaluate(() => ({ tuiles: [...document.querySelectorAll('#view a.lot')].map(a => a.getAttribute('href')), kpi: document.querySelector('#view .kpi .v')?.textContent }));
    await aller(page, '#/f/b4');
    const nDlg = j.dialogues.length;
    await page.click('button[data-action="finish"]');
    await page.waitForFunction(() => location.hash === '#/archive/b4', { timeout: 5000 }).catch(() => {});
    await pause(500);
    const dlg = j.dialogues[nDlg];
    V('§6.2', 'confirmation « Terminer le lot »', 'Terminer ce lot ? Il sera déplacé dans l’Archive et les appareils reliés seront libérés.', dlg?.message ?? null, dlg?.message === 'Terminer ce lot ? Il sera déplacé dans l’Archive et les appareils reliés seront libérés.');
    const ar = await page.evaluate(() => ({ hash: location.hash, h1: document.querySelector('#view h1')?.textContent, badge: [...document.querySelectorAll('#view .dp-title .badge')].map(b => b.textContent),
      interactifs: document.querySelectorAll('#view button, #view form, #view input, #view select, #view textarea').length, page: document.getElementById('view').dataset.page }));
    V('§10.6', 'ouvre la fiche d’archive', '#/archive/b4', ar.hash, ar.hash === '#/archive/b4');
    V('§10.6', 'fiche : titre et badge « Archivé »', { h1: 'Garum de champignons', badge: 'Archivé' }, { h1: ar.h1, badge: ar.badge.join(',') }, ar.h1 === 'Garum de champignons' && ar.badge.includes('Archivé'));
    V('§10.6', 'fiche en lecture seule (aucun bouton, formulaire ni champ)', 0, ar.interactifs, ar.interactifs === 0);
    await aller(page, '#/');
    const h1_ = await page.evaluate(() => ({ tuiles: [...document.querySelectorAll('#view a.lot')].map(a => a.getAttribute('href')), kpi: document.querySelector('#view .kpi .v')?.textContent }));
    V('§10.6', 'le lot disparaît de l’accueil', { tuiles: h0.tuiles.length - 1, sansB4: true, kpiLots: String(+h0.kpi - 1) }, { tuiles: h1_.tuiles.length, sansB4: !h1_.tuiles.includes('#/f/b4'), kpiLots: h1_.kpi },
      h1_.tuiles.length === h0.tuiles.length - 1 && !h1_.tuiles.includes('#/f/b4') && h0.tuiles.includes('#/f/b4') && h1_.kpi === String(+h0.kpi - 1));
    await page.evaluate(() => { location.hash = '#/f/b4'; });
    await page.waitForFunction(() => location.hash === '#/archive/b4', { timeout: 5000 }).catch(() => {});
    const redir = await page.evaluate(() => location.hash);
    V('§2', '#/f/b4 terminé redirige vers #/archive/b4', '#/archive/b4', redir, redir === '#/archive/b4');

    /* Thème : auto → light → dark par le bouton */
    await aller(page, '#/');
    await page.click('#themeBtn'); await page.click('#themeBtn');
    const th = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), cle: localStorage.getItem('hakko-theme'), bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toUpperCase() }));
    V('§4', 'bouton de thème : 2 clics auto→light→dark', { attr: 'dark', cle: 'dark', bg: '#0E1116' }, th, th.attr === 'dark' && th.cle === 'dark' && th.bg === '#0E1116');

    /* §10.8 — persistance après rechargement */
    const faits = async () => {
      const f = {};
      await aller(page, '#/');
      f.tuiles = await page.evaluate(() => [...document.querySelectorAll('#view a.lot')].map(a => a.getAttribute('href')).join(' '));
      f.theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await aller(page, '#/f/b1'); await pause(300);
      f.consigne = await page.evaluate(() => [...document.querySelectorAll('#view .dp-side .card-h')].find(h => h.textContent.startsWith('Consigne'))?.querySelector('.muted')?.textContent);
      f.entreesConsigne = await page.evaluate(() => [...document.querySelectorAll('#journal-list .jl')].filter(li => li.querySelector('.badge')?.textContent === 'Consigne').map(li => li.querySelector('.jt').textContent).join(' | '));
      await page.click('button[data-action="ctab"][data-v="grav"]'); await pause(400);
      f.releves = await page.evaluate(() => [...document.querySelectorAll('.grav-list tbody tr')].map(tr => tr.cells[1].textContent).join(' '));
      await page.click('button[data-action="ctab"][data-v="temp"]'); await pause(200);
      await aller(page, '#/appareils');
      await page.click('button[data-action="dfilter"][data-v="plug"]'); await pause(300);
      f.prises = await page.evaluate(() => [...document.querySelectorAll('#view .o-btn')].map(b => b.textContent).join(' '));
      await aller(page, '#/archive');
      f.archive = await page.evaluate(() => [...document.querySelectorAll('#view tbody tr')].map(tr => tr.dataset.href).join(' '));
      return f;
    };
    const avantRel = await faits();
    const stockage = await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('hakko-dashboard-v1')); return { lots: s.batches.length, b4: s.batches.find(b => b.id === 'b4')?.status }; } catch (e) { return { erreur: String(e) }; } });
    V('§1', 'localStorage « hakko-dashboard-v1 » lisible et à jour', { b4: 'done' }, stockage, stockage.b4 === 'done');
    await page.reload({ waitUntil: 'load' });
    await attendreTick(page);
    const apresRel = await faits();
    for (const k of Object.keys(avantRel)) V('§10.8', `après rechargement : ${k}`, avantRel[k], apresRel[k], avantRel[k] === apresRel[k] && avantRel[k] != null && avantRel[k] !== '');
    V('§10.8', 'après rechargement : consigne modifiée conservée', `Actuelle ${trace.consigne.finale.toFixed(1).replace('.', ',')} °C`, apresRel.consigne, apresRel.consigne === `Actuelle ${trace.consigne.finale.toFixed(1).replace('.', ',')} °C`);
    V('§10.8', 'après rechargement : relevé 1,007 conservé', 'contient 1,007', apresRel.releves, / 1,007 /.test(' ' + apresRel.releves + ' '));
    trace.persistance = { avant: avantRel, apres: apresRel };
    await page.screenshot({ path: path.join(SORTIE, `${cible}_fonctionnel_fin.png`) });
  } catch (e) {
    V('harnais', 'passe fonctionnelle sans exception', 'pas d’exception', e.stack, false);
  } finally { await ctx.close(); }
  V('§10.1', 'passe fonctionnelle : erreurs console/pageerror/HTTP≥400/requêtes échouées', 0, nbErreurs(j) ? { console: j.console, pageerror: j.pageerror, http: j.http, echecs: j.echecs } : 0, nbErreurs(j) === 0);
  return { trace, journal: j };
}

/* ---------- Comparaison A / B ---------- */
function comparer(ra, rb) {
  const div = [];
  const cle = c => `${c.route} ${c.vp} ${c.theme}`;
  const mb = new Map(rb.map(c => [cle(c), c]));
  for (const ca of ra) {
    const cb = mb.get(cle(ca));
    if (!cb || !ca.signature || !cb.signature) { div.push({ route: ca.route, cas: cle(ca), champ: 'cas', a: !!ca.signature, b: !!cb?.signature }); continue; }
    const sa = ca.signature, sb = cb.signature;
    if (sa.titre !== sb.titre) div.push({ route: ca.route, cas: cle(ca), champ: 'titre', a: sa.titre, b: sb.titre });
    if (ca.hashFinal !== cb.hashFinal) div.push({ route: ca.route, cas: cle(ca), champ: 'hashFinal', a: ca.hashFinal, b: cb.hashFinal });
    for (const k of Object.keys(sa.compteurs)) if (sa.compteurs[k] !== sb.compteurs[k]) div.push({ route: ca.route, cas: cle(ca), champ: 'compteurs.' + k, a: sa.compteurs[k], b: sb.compteurs[k] });
    for (const k of Object.keys(sa)) {
      if (!Array.isArray(sa[k])) continue;
      const n = Math.max(sa[k].length, sb[k].length);
      for (let i = 0; i < n; i++) if (sa[k][i] !== sb[k][i]) div.push({ route: ca.route, cas: cle(ca), champ: `${k}[${i}]`, a: sa[k][i] ?? null, b: sb[k][i] ?? null });
    }
    for (const k of ['vertical', 'horizontal']) if (ca.mesures.defilement[k] !== cb.mesures.defilement[k]) div.push({ route: ca.route, cas: cle(ca), champ: 'defilement.' + k, a: ca.mesures.defilement[k], b: cb.mesures.defilement[k] });
    if (ca.mesures.nbDebordements !== cb.mesures.nbDebordements) div.push({ route: ca.route, cas: cle(ca), champ: 'nbDebordements', a: ca.mesures.nbDebordements, b: cb.mesures.nbDebordements });
  }
  return div;
}

/* ---------- Déroulé ---------- */
const rapport = { date: new Date().toISOString(), urls: URLS, cible: CIBLE, sortie: SORTIE, horlogeVirtuelle: new Date(BASE).toISOString(), cibles: {}, divergences: null, assertions };
const debut = Date.now();
let indisponible = false;
const aFaire = [...CIBLES];
const reessai = [];
for (const c of aFaire) {
  let d = await disponible(URLS[c]);
  if (!d.ok && c === 'b') { console.log(`[b] indisponible (${d.statut ?? d.erreur}) — nouvel essai en fin de course`); reessai.push(c); continue; }
  if (!d.ok) { console.log(`[${c}] indisponible (${d.statut ?? d.erreur})`); rapport.cibles[c] = { disponible: false, ...d }; indisponible = true; continue; }
  await courir(c);
}
for (const c of reessai) {
  await pause(5000);
  const d = await disponible(URLS[c]);
  if (!d.ok) { console.log(`[${c}] toujours indisponible (${d.statut ?? d.erreur}) — non compté comme échec de l’application`); rapport.cibles[c] = { disponible: false, ...d }; indisponible = true; continue; }
  await courir(c);
}
async function courir(c) {
  console.log(`[${c}] ${URLS[c]} — passe mise en page (${ROUTES.length} routes × ${THEMES.length} thèmes × ${VIEWPORTS.length} viewports)`);
  const cas = await passeMiseEnPage(c);
  console.log(`[${c}] passe fonctionnelle (§10)`);
  const fonc = await passeFonctionnelle(c);
  rapport.cibles[c] = { disponible: true, cas: cas.map(x => ({ ...x, signature: x.signature })), fonctionnel: fonc };
}
if (rapport.cibles.a?.disponible && rapport.cibles.b?.disponible) {
  const div = comparer(rapport.cibles.a.cas, rapport.cibles.b.cas);
  rapport.divergences = div;
  verifie('A=B', 'a/b', 'divergences A/B (compteurs, libellés, nombres normalisés)', 0, div.length, div.length === 0);
  const routes = [...new Set(div.map(d => d.route))];
  for (const d of div.slice(0, 200)) console.log(`  DIVERGENCE ${d.cas} ${d.champ}\n      A: ${JSON.stringify(d.a)}\n      B: ${JSON.stringify(d.b)}`);
  if (div.length > 200) console.log(`  … ${div.length - 200} divergences de plus dans rapport.json`);
  rapport.divergencesParRoute = Object.fromEntries(routes.map(r => [r, div.filter(d => d.route === r).length]));
}
await browser.close();

/* ---------- Rapport ---------- */
const echecs = assertions.filter(a => !a.ok);
rapport.resume = {
  duree_s: Math.round((Date.now() - debut) / 1000),
  assertions: assertions.length, reussies: assertions.length - echecs.length, echecs: echecs.length,
  parPoint: Object.fromEntries([...new Set(assertions.map(a => a.id))].map(id => [id, `${assertions.filter(a => a.id === id && a.ok).length}/${assertions.filter(a => a.id === id).length}`])),
  cibles: Object.fromEntries(Object.entries(rapport.cibles).map(([k, v]) => [k, v.disponible ? 'testée' : 'indisponible'])),
  divergences: rapport.divergences ? rapport.divergences.length : 'non comparé',
};
fs.writeFileSync(path.join(SORTIE, 'rapport.json'), JSON.stringify(rapport, null, 1));
// Tableau lisible des mesures de mise en page
for (const [c, v] of Object.entries(rapport.cibles)) {
  if (!v.disponible) continue;
  console.log(`\n[${c}] route              vp        thème   défil.V défil.H débord. hors-écran erreurs capture`);
  for (const x of v.cas) {
    if (!x.mesures) { console.log(`[${c}] ${x.route.padEnd(18)} ${x.vp} ${x.theme} ERREUR HARNAIS`); continue; }
    const m = x.mesures;
    console.log(`[${c}] ${x.route.padEnd(18)} ${x.vp.padEnd(9)} ${x.theme.padEnd(7)} ${String(m.defilement.vertical).padStart(7)} ${String(m.defilement.horizontal).padStart(7)} ${String(m.nbDebordements).padStart(7)} ${String(m.nbHorsEcran).padStart(10)} ${String(nbErreurs(x.journal)).padStart(7)} ${x.capture}`);
  }
}
console.log('\n=== RÉSUMÉ ===');
console.log(JSON.stringify(rapport.resume));
if (echecs.length) { console.log(`\n${echecs.length} ÉCHEC(S) :`); for (const a of echecs) console.log(` - [${a.cible}] ${a.id} ${a.libelle}\n     attendu: ${JSON.stringify(a.attendu)}\n     obtenu : ${JSON.stringify(a.obtenu)}`); }
console.log(`Rapport JSON : ${path.join(SORTIE, 'rapport.json')}`);
process.exit(echecs.length ? 1 : indisponible ? 2 : 0);
