import puppeteer from 'puppeteer-core';

/* Test d'acceptation du pont Home Assistant, contre le site DÉPLOYÉ.
   Il clique réellement : une prise est allumée, vérifiée, puis ÉTEINTE.
   Le jeton du pont est fourni par l'environnement (JETON_PONT), jamais écrit ici. */

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE_PONT || 'http://192.168.1.51:30090';
const JETON = process.env.JETON_PONT || '';
const PRISE = process.env.PRISE || '5';
const ATTENTE = 900;

let ok = 0, ko = 0;
const controle = (nom, attendu, obtenu) => {
  const bon = String(attendu) === String(obtenu);
  console.log(`  ${bon ? 'OK  ' : 'KO  '} ${nom.padEnd(58)} ${obtenu}${bon ? '' : '   (attendu : ' + attendu + ')'}`);
  bon ? ok++ : ko++;
  return bon;
};

const b = await puppeteer.launch({ executablePath: EDGE, headless: 'shell', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000 });
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
const erreurs = [];
p.on('pageerror', e => erreurs.push('pageerror: ' + e.message));
p.on('console', m => {
  if (m.type() === 'error' && !/favicon|fonts\.(googleapis|gstatic)/.test(m.text())) erreurs.push('console: ' + m.text());
});
// Les polices du design viennent de Google : si le réseau ne les atteint pas, l'échec
// n'a rien à voir avec le pont et ne doit pas être compté comme une erreur de la page.
p.on('requestfailed', r => {
  if (!/favicon|fonts\.(googleapis|gstatic)/.test(r.url())) erreurs.push('requête échouée: ' + r.url());
});

// La page demande le jeton une fois : on répond automatiquement par la valeur fournie.
let demandeJeton = 0;
p.on('dialog', async d => { demandeJeton++; await d.accept(JETON); });

const etatPont = async () => p.evaluate(async (jeton, prise) => {
  const r = await fetch('api/etat', { headers: { Authorization: 'Bearer ' + jeton }, cache: 'no-store' });
  const d = await r.json();
  const a = (d.appareils || []).find(x => x.entite.endsWith('outlet_' + prise));
  return a ? a.etat : 'absent';
}, JETON, PRISE);

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
  controle(`la page affiche outlet_${PRISE}`, 'off', await etatPage());
  const autres = await p.evaluate(async (jeton) => {
    const d = await (await fetch('api/etat', { headers: { Authorization: 'Bearer ' + jeton } })).json();
    return d.appareils.filter(a => a.domaine === 'switch').length + ' prises / ' + d.appareils.filter(a => a.domaine === 'sensor').length + ' sondes';
  }, JETON);
  controle('appareils remontés par le pont', '5 prises / 4 sondes', autres);

  console.log(`\n=== 3. commande réelle : allumer la prise ${PRISE} depuis la page ===`);
  const bouton = await p.evaluateHandle((prise) => {
    const tr = [...document.querySelectorAll('#view tbody tr')]
      .find(x => (x.querySelector('.dev-cell .nm')?.textContent || '').includes('Outlet ' + prise));
    return tr?.querySelector('button.switch');
  }, PRISE);
  await bouton.asElement().click();
  await new Promise(x => setTimeout(x, ATTENTE));
  controle(`Home Assistant voit outlet_${PRISE} allumée`, 'on', await etatPont());
  controle(`la page affiche outlet_${PRISE} allumée`, 'on', await etatPage());
  controle('le jeton a été demandé (une fois)', 1, demandeJeton);
  const allumees = await p.evaluate(() => document.querySelectorAll('#view tbody tr button.switch[aria-checked="true"]').length);
  controle('une seule prise allumée', 1, allumees);

  console.log(`\n=== 4. commande inverse : éteindre la prise ${PRISE} ===`);
  const bouton2 = await p.evaluateHandle((prise) => {
    const tr = [...document.querySelectorAll('#view tbody tr')]
      .find(x => (x.querySelector('.dev-cell .nm')?.textContent || '').includes('Outlet ' + prise));
    return tr?.querySelector('button.switch');
  }, PRISE);
  await bouton2.asElement().click();
  await new Promise(x => setTimeout(x, ATTENTE));
  controle(`Home Assistant voit outlet_${PRISE} éteinte`, 'off', await etatPont());
  controle(`la page affiche outlet_${PRISE} éteinte`, 'off', await etatPage());
  controle('le jeton n\'est plus redemandé', 1, demandeJeton);

  console.log('\n=== 5. après rechargement, l\'état réel est conservé ===');
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { location.hash = '#/appareils'; });
  await new Promise(x => setTimeout(x, 1800));
  controle(`outlet_${PRISE} toujours éteinte à l'écran`, 'off', await etatPage());
  const stocke = await p.evaluate(() => !!localStorage.getItem('hakko-pont-jeton'));
  controle('jeton conservé pour la prochaine visite', true, stocke);

  console.log('\nERREURS JS :', erreurs.length ? erreurs : 'aucune');
  if (erreurs.length) ko++;
} finally {
  // Quoi qu'il arrive, on ne laisse pas une prise allumée.
  const restant = await etatPont().catch(() => '?');
  if (restant === 'on') {
    console.log('\n/!\\ prise encore allumée : extinction de sécurité…');
    await p.evaluate(async (jeton, prise) => {
      await fetch('api/prise', {
        method: 'POST', headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entite: 'switch.smart_switch_25021462413795540601c4e7ae132658_outlet_' + prise, allume: false }),
      });
    }, JETON, PRISE);
    await new Promise(x => setTimeout(x, 900));
    console.log('  état final :', await etatPont().catch(() => '?'));
  }
  await p.screenshot({ path: 'captures-appareils/pont-apres-test.png' });
  await b.close();
}
console.log(`\nrésultat : ${ok} OK, ${ko} KO`);
process.exit(ko === 0 ? 0 : 1);
