import puppeteer from 'puppeteer-core';

/* Test d'acceptation du pont Home Assistant, contre le site DÉPLOYÉ.
   Il clique réellement : une prise est allumée, vérifiée, puis ÉTEINTE.
   Le pont ne demande plus de jeton (PONT_AUTH=aucune) : le test exige donc qu'AUCUN
   dialogue n'apparaisse, et il remet la prise à l'arrêt en sortant, quoi qu'il arrive. */

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE_PONT || 'http://192.168.1.51:30090';
const PRISE = process.env.PRISE || '5';
const ATTENTE = 900;

let ok = 0, ko = 0;
const controle = (nom, attendu, obtenu) => {
  const bon = String(attendu) === String(obtenu);
  console.log(`  ${bon ? 'OK  ' : 'KO  '} ${nom.padEnd(58)} ${obtenu}${bon ? '' : '   (attendu : ' + attendu + ')'}`);
  bon ? ok++ : ko++;
  return bon;
};

// Attend qu'une lecture atteigne la valeur voulue : la multiprise Tuya met une à trois
// secondes à confirmer, une durée fixe serait donc trop fragile.
const attendre = async (lire, voulu, maxMs = 8000) => {
  const t0 = Date.now();
  let vu = await lire();
  while (vu !== voulu && Date.now() - t0 < maxMs) {
    await new Promise(r => setTimeout(r, 250));
    vu = await lire();
  }
  return vu;
};

const b = await puppeteer.launch({ executablePath: EDGE, headless: 'shell', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000 });
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
const erreurs = [];
p.on('pageerror', e => erreurs.push('pageerror: ' + e.message));
// Le pont n'exige plus de jeton : le moindre 401 est un défaut. Les polices viennent de
// Google et peuvent être inaccessibles sans que cela concerne le pont.
const attendues = [], inattendues = [];
const horsSujet = s => /favicon|fonts\.(googleapis|gstatic)/.test(s);
p.on('console', m => {
  if (m.type() !== 'error') return;
  const t = m.text(), u = (m.location() && m.location().url) || '';
  if (horsSujet(t) || horsSujet(u)) return;
  inattendues.push('console: ' + t + ' — ' + u);
  ko++;
});
p.on('requestfailed', r => {
  if (horsSujet(r.url())) return;
  inattendues.push('requête échouée: ' + r.url());
  ko++;
});

// Plus aucun dialogue ne doit apparaître. S'il en apparaît un, le test le montre — et
// l'écarte, sinon il bloque la page et masque les vrais contrôles.
let demandeJeton = 0, messageDialogue = '';
p.on('dialog', async d => { demandeJeton++; messageDialogue = d.message().slice(0, 70); await d.dismiss(); });

const etatPont = async () => p.evaluate(async (prise) => {
  const r = await fetch('api/etat', { cache: 'no-store' });
  const d = await r.json();
  const a = (d.appareils || []).find(x => x.entite.endsWith('outlet_' + prise));
  return a ? a.etat : 'absent';
}, PRISE);

const etatPage = async () => p.evaluate((prise) => {
  const tr = [...document.querySelectorAll('#view tbody tr')]
    .find(x => (x.querySelector('.dev-cell .nm')?.textContent || '').includes('Outlet ' + prise));
  if (!tr) return 'ligne introuvable';
  const sw = tr.querySelector('button.switch');
  return sw ? (sw.getAttribute('aria-checked') === 'true' ? 'on' : 'off') : 'bouton introuvable';
}, PRISE);

try {
  console.log(`\n=== 1. le pont répond sur la même origine (${BASE}) ===`);
  // « networkidle0 » est inatteignable ici : la page interroge le pont toutes les 15 s
  // et charge les polices du design depuis Internet.
  await p.goto(BASE + '/hakko-dashboard.html', { waitUntil: 'domcontentloaded' });
  await new Promise(x => setTimeout(x, 2500));
  const sante = await p.evaluate(async () => {
    const r = await fetch('api/sante', { cache: 'no-store' }); return r.status + ' ' + (await r.text()).trim();
  });
  controle('/api/sante', '200 ok', sante);
  // Le refus sans jeton (401) est vérifié par verif-pont.sh (contrôle 4) ; ici, toute
  // erreur console doit donc signaler un vrai défaut, sans sonde volontaire qui la pollue.

  console.log('\n=== 2. page Appareils : états réels ===');
  await p.evaluate(() => { location.hash = '#/appareils'; });
  await new Promise(x => setTimeout(x, 1200));
  controle(`Home Assistant dit outlet_${PRISE}`, 'off', await etatPont());
  // Le profil de ce test ne régule pas les autres prises : sinon la page mettrait en
  // chauffe les prises d'autres lots (mode « auto » par défaut) pendant le test.
  await p.evaluate((prise) => {
    const cle = 'hakko-dashboard-v2';
    const s = JSON.parse(localStorage.getItem(cle) || '{}');
    (s.devices || []).filter(x => x.kind === 'plug' && x.eid && !x.eid.endsWith('outlet_' + prise))
      .forEach(x => { x.mode = 'manuel'; x.on = false; });
    localStorage.setItem(cle, JSON.stringify(s));
  }, PRISE);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { location.hash = '#/appareils'; });
  await new Promise(x => setTimeout(x, 1500));
  controle(`la page affiche outlet_${PRISE}`, 'off', await etatPage());
  const autres = await p.evaluate(async () => {
    const d = await (await fetch('api/etat', { cache: 'no-store' })).json();
    return d.appareils.filter(a => a.domaine === 'switch').length + ' prises / ' + d.appareils.filter(a => a.domaine === 'sensor').length + ' sondes';
  });
  controle('appareils remontés par le pont', '5 prises / 4 sondes', autres);

  console.log(`\n=== 3. commande réelle : allumer la prise ${PRISE} depuis la page ===`);
  const bouton = await p.evaluateHandle((prise) => {
    const tr = [...document.querySelectorAll('#view tbody tr')]
      .find(x => (x.querySelector('.dev-cell .nm')?.textContent || '').includes('Outlet ' + prise));
    return tr?.querySelector('button.switch');
  }, PRISE);
  await bouton.asElement().click();
  controle(`Home Assistant voit outlet_${PRISE} allumée`, 'on', await attendre(() => etatPont(), 'on'));
  controle(`la page affiche outlet_${PRISE} allumée`, 'on', await attendre(() => etatPage(), 'on'));
  controle("aucun dialogue : le jeton n'est pas demandé", 0, demandeJeton);
  // Invariant solide : la page et Home Assistant comptent les mêmes prises allumées.
  const comptes = await attendre(async () => {
    const page = await p.evaluate(() => document.querySelectorAll('#view tbody tr button.switch[aria-checked="true"]').length);
    const ha = await p.evaluate(async () => (await (await fetch('api/etat', { cache: 'no-store' })).json())
      .appareils.filter(a => a.domaine === 'switch' && a.etat === 'on').length);
    return page === ha ? String(page) + '=' + String(ha) : null;
  }, null, 20000);
  controle('la page compte autant de prises allumées que Home Assistant', 'oui', comptes ? 'oui' : 'non');

  console.log(`\n=== 4. commande inverse : éteindre la prise ${PRISE} ===`);
  const bouton2 = await p.evaluateHandle((prise) => {
    const tr = [...document.querySelectorAll('#view tbody tr')]
      .find(x => (x.querySelector('.dev-cell .nm')?.textContent || '').includes('Outlet ' + prise));
    return tr?.querySelector('button.switch');
  }, PRISE);
  await bouton2.asElement().click();
  controle(`Home Assistant voit outlet_${PRISE} éteinte`, 'off', await attendre(() => etatPont(), 'off'));
  controle(`la page affiche outlet_${PRISE} éteinte`, 'off', await attendre(() => etatPage(), 'off'));
  controle('toujours aucun dialogue', 0, demandeJeton);

  console.log('\n=== 5. après rechargement, l\'état réel est conservé ===');
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { location.hash = '#/appareils'; });
  await new Promise(x => setTimeout(x, 1800));
  controle(`outlet_${PRISE} toujours éteinte à l'écran`, 'off', await attendre(() => etatPage(), 'off'));
  const stocke = await p.evaluate(() => !!localStorage.getItem('hakko-pont-jeton'));
  controle('aucun jeton conservé : le pont n\'en demande plus', 'false', String(stocke));

  console.log('\nERREURS JS INATTENDUES :', inattendues.length ? inattendues : 'aucune');
  console.log('ERREURS JS ATTENDUES   :', attendues.length ? attendues : 'aucune');
  if (erreurs.length) { console.log('ERREURS DE PAGE        :', erreurs); ko += erreurs.length; }
  if (demandeJeton) console.log('DIALOGUE VU            :', messageDialogue);
} finally {
  // Quoi qu'il arrive, on ne laisse pas une prise allumée.
  const restant = await etatPont().catch(() => '?');
  if (restant === 'on') {
    console.log('\n/!\\ prise encore allumée : extinction de sécurité…');
    await p.evaluate(async (prise) => {
      await fetch('api/prise', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entite: 'switch.smart_switch_25021462413795540601c4e7ae132658_outlet_' + prise, allume: false }),
      });
    }, PRISE);
    await new Promise(x => setTimeout(x, 900));
    console.log('  état final :', await etatPont().catch(() => '?'));
  }
  await p.screenshot({ path: 'captures-appareils/pont-apres-test.png' });
  await b.close();
}
console.log(`\nrésultat : ${ok} OK, ${ko} KO`);
process.exit(ko === 0 ? 0 : 1);
