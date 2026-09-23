import puppeteer from 'puppeteer-core';

/* Test d'acceptation de la RÉGULATION AUTOMATIQUE, contre le site DÉPLOYÉ.
   Il ne touche jamais aux données de l'utilisateur : il travaille dans un profil de
   navigateur jetable, donc sur son propre localStorage. Déroulé :
     1. allumer une prise depuis la page (clic) — c'est la seule chauffe du test, quelques
        secondes, comme le test d'acceptation du pont ;
     2. baisser la consigne du lot au-dessous de la température mesurée, puis recharger ;
     3. laisser la régulation décider seule : elle doit ÉTEINDRE la prise (direction sûre ;
        un test ne met jamais en chauffe) ;
     4. le vérifier dans Home Assistant, à l'écran, et dans le journal du dashboard.

   Le pont n'exige plus de jeton (PONT_AUTH=aucune) : le test exige donc qu'AUCUN dialogue
   n'apparaisse, et il remet la prise à l'arrêt en sortant, quoi qu'il arrive. */

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE_PONT || 'http://192.168.1.51:30090';
const PRISE = process.env.PRISE || '2';
const LOT = process.env.LOT || 'b3';
const CLE = 'hakko-dashboard-v2';

let ok = 0, ko = 0;
const controle = (nom, attendu, obtenu) => {
  const bon = String(attendu) === String(obtenu);
  console.log(`  ${bon ? 'OK  ' : 'KO  '} ${nom.padEnd(56)} ${obtenu}${bon ? '' : '   (attendu : ' + attendu + ')'}`);
  bon ? ok++ : ko++;
  return bon;
};
const attendre = async (lire, voulu, maxMs = 30000) => {
  const t0 = Date.now();
  let vu = await lire();
  while (vu !== voulu && Date.now() - t0 < maxMs) {
    await new Promise(r => setTimeout(r, 400));
    vu = await lire();
  }
  return vu;
};

const b = await puppeteer.launch({ executablePath: EDGE, headless: 'shell', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000 });
const inattendues = [];
const horsSujet = s => /favicon|fonts\.(googleapis|gstatic)/.test(s);
p.on('pageerror', e => { inattendues.push('pageerror: ' + e.message); ko++; });
p.on('console', m => {
  if (m.type() !== 'error') return;
  const t = m.text(), u = (m.location() && m.location().url) || '';
  if (horsSujet(t) || horsSujet(u)) return;
  inattendues.push('console: ' + t + ' — ' + u); ko++;
});
p.on('requestfailed', r => { if (!horsSujet(r.url())) { inattendues.push('requête échouée: ' + r.url()); ko++; } });
let dialogues = 0, messageDialogue = '';
p.on('dialog', async d => {
  dialogues++; messageDialogue = d.message().slice(0, 70);
  // Le dialogue est écarté : sinon il bloque la page et masque les vrais contrôles.
  await d.dismiss();
});

const etatPont = async () => p.evaluate(async (prise) => {
  const d = await (await fetch('api/etat', { cache: 'no-store' })).json();
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

const cliquerPrise = async () => {
  const h = await p.evaluateHandle((prise) => {
    const tr = [...document.querySelectorAll('#view tbody tr')]
      .find(x => (x.querySelector('.dev-cell .nm')?.textContent || '').includes('Outlet ' + prise));
    return tr?.querySelector('button.switch');
  }, PRISE);
  await h.asElement().click();
};

// Température mesurée par le lot, telle que la page la voit.
const temperatureLot = async () => p.evaluate((lot) => {
  const s = JSON.parse(localStorage.getItem('hakko-dashboard-v2') || '{}');
  const d = (s.devices || []).find(x => x.batch === lot && x.kind === 'temp');
  return d ? d.value : null;
}, LOT);

try {
  console.log(`\n=== 1. page déployée, synchro avec le pont (${BASE}) ===`);
  await p.goto(BASE + '/hakko-dashboard.html', { waitUntil: 'domcontentloaded' });
  await new Promise(x => setTimeout(x, 2500));
  await p.evaluate(() => { location.hash = '#/appareils'; });
  await new Promise(x => setTimeout(x, 1200));
  const tp = await temperatureLot();
  console.log(`  température réelle du lot ${LOT} : ${tp} °C`);
  controle(`Home Assistant dit outlet_${PRISE}`, 'off', await etatPont());
  controle('aucun dialogue à l\'ouverture', 0, dialogues);

  // Le profil du test ne régule que la prise éprouvée : sans cela, la page mettrait en
  // chauffe les prises des autres lots (mode « auto » par défaut) pendant le test.
  await p.evaluate((cle, prise) => {
    const s = JSON.parse(localStorage.getItem(cle) || '{}');
    (s.devices || []).filter(x => x.kind === 'plug' && x.eid && !x.eid.endsWith('outlet_' + prise))
      .forEach(x => { x.mode = 'manuel'; x.on = false; });
    localStorage.setItem(cle, JSON.stringify(s));
  }, CLE, PRISE);

  console.log(`\n=== 2. allumage manuel de la prise ${PRISE} (clic) ===`);
  await cliquerPrise();
  controle(`HA voit outlet_${PRISE} allumée`, 'on', await attendre(() => etatPont(), 'on'));
  controle('une seule prise allumée', 1, await attendre(
    () => p.evaluate(() => document.querySelectorAll('#view tbody tr button.switch[aria-checked="true"]').length), 1));

  console.log(`\n=== 3. consigne passée sous la température mesurée (profil du test seulement) ===`);
  const avant = await p.evaluate((lot, cle, prise) => {
    const s = JSON.parse(localStorage.getItem(cle) || '{}');
    const b = (s.batches || []).find(x => x.id === lot);
    const ancienne = b ? b.recipe.temp : null;
    if (b) b.recipe.temp = 0;
    // Un clic passe la prise en mode manuel (l'utilisateur décide) : pour éprouver la
    // régulation, on la remet en mode automatique et on repart d'un état propre.
    const p = (s.devices || []).find(x => x.eid && x.eid.endsWith('outlet_' + prise));
    if (p) { p.mode = 'auto'; p.regulT = null; p.regulPause = null; p.regulRefus = null; p.regulDepuis = null; }
    localStorage.setItem(cle, JSON.stringify(s));
    return ancienne;
  }, LOT, CLE, PRISE);
  console.log(`  consigne du lot ${LOT} : ${avant} °C -> 0 °C`);
  controle('consigne modifiée dans le profil du test', 0, await p.evaluate((lot, cle) => {
    const s = JSON.parse(localStorage.getItem(cle) || '{}');
    const b = (s.batches || []).find(x => x.id === lot);
    return b ? b.recipe.temp : 'lot absent';
  }, LOT, CLE));

  console.log('\n=== 4. la régulation doit éteindre la prise toute seule ===');
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { location.hash = '#/appareils'; });
  await new Promise(x => setTimeout(x, 1500));
  controle(`HA voit outlet_${PRISE} éteinte (régulation)`, 'off', await attendre(() => etatPont(), 'off', 40000));
  controle(`la page affiche outlet_${PRISE} éteinte`, 'off', await attendre(() => etatPage(), 'off', 20000));

  console.log('\n=== 5. l\'action est attribuée à la régulation, pas à un clic ===');
  const journal = await p.evaluate((cle) => {
    const s = JSON.parse(localStorage.getItem(cle) || '{}');
    const e = (s.events || []).filter(x => x.k === 'heat-off').slice(0, 3);
    return e.map(x => ({ manual: !!x.manual, texte: String(x.x).slice(0, 60) }));
  }, CLE);
  const auto = journal.find(e => !e.manual);
  controle('une entrée de journal automatique (sans « manuel »)', 'oui', auto ? 'oui' : JSON.stringify(journal));
  if (auto) console.log(`     « ${auto.texte} »`);
  controle('aucun dialogue pendant tout le test', 0, dialogues);
  if (dialogues) console.log(`     dialogue vu : « ${messageDialogue} »`);
} finally {
  // Quoi qu'il arrive, la prise du test repart à l'arrêt.
  const fin = await etatPont().catch(() => 'inconnu');
  if (fin === 'on') {
    await p.evaluate(async (prise) => {
      await fetch('api/prise', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entite: 'switch.smart_switch_25021462413795540601c4e7ae132658_outlet_' + prise, allume: false }),
      });
    }, PRISE).catch(() => {});
    console.log('\n  (sécurité) la prise est restée allumée : extinction forcée');
  }
  const etatFinal = await etatPont().catch(() => 'inconnu');
  console.log(`\n=== ${ok} OK / ${ko} KO — prise ${PRISE} : ${etatFinal} ===`);
  if (inattendues.length) console.log('ERREURS INATTENDUES :\n' + inattendues.map(s => '  - ' + s).join('\n'));
  await b.close();
  process.exit(ko ? 1 : 0);
}
