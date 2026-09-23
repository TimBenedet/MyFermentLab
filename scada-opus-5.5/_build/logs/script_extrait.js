
/* ---------- Utils ---------- */
const DAY = 864e5, HOUR = 36e5, HYST = 0.2;
const now = () => Date.now();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, d = 1) => (n == null || isNaN(n)) ? '—' : Number(n).toFixed(d).replace('.', ',');
const fmtDate = t => new Date(t).toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
const fmtDateY = t => new Date(t).toLocaleDateString('fr-FR', {day:'numeric', month:'short', year:'numeric'});
const fmtTime = t => new Date(t).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
const uid = p => p + Math.random().toString(36).slice(2, 8);
function fmtDur(d){
  if (d < 3) return Math.round(d * 24) + ' h';
  if (d < 60) return Math.round(d) + ' jours';
  if (d >= 330){ const y = Math.round(d / 365); return y + (y > 1 ? ' ans' : ' an'); }
  return Math.round(d / 30) + ' mois';
}
function ago(t){
  const s = Math.round((now() - t) / 1000);
  if (s < 60) return 'il y a ' + s + ' s';
  if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
  return 'il y a ' + Math.round(s / 86400) + ' j';
}
function hash(s){ let h = 2166136261; for (const c of s){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295 * 100; }

const TYPES = {
  biere: {label:'Bière', c:'var(--biere)', tol:1.0},
  miso:  {label:'Miso',  c:'var(--miso)',  tol:4.0},
  koji:  {label:'Koji',  c:'var(--koji)',  tol:2.5},
  garum: {label:'Garum', c:'var(--garum)', tol:1.5},
};

const IC = {
  jar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8M9 3v3.2C6.6 7.2 5 9.4 5 12v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6c0-2.6-1.6-4.8-4-5.8V3"/><path d="M5.5 13.5c2 .9 4 .9 6.5 0s4.5-.9 6.5 0"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M9 8h7M9 12h5"/></svg>',
  sensor:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/></svg>',
  temp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.8V4.5a2 2 0 0 0-4 0v10.3a4 4 0 1 0 4 0z"/><path d="M12 11v6"/></svg>',
  hum:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/></svg>',
  plug:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

/* ---------- Data ---------- */
const STORE = 'hakko-dashboard-v1';
function seed(){
  const t = now();
  const R = [
    {id:'r1', name:'Saison du Nord', type:'biere', duration:21, temp:24, og:1.058, fg:1.006, volume:20, archived:false,
     desc:'Saison sèche et poivrée, fermentation chaude avec montée libre en fin de parcours.',
     ingredients:[{n:'Malt Pilsner',q:'4,2 kg'},{n:'Malt de froment',q:'0,8 kg'},{n:'Malt Munich',q:'0,3 kg'},{n:'Houblon Saaz (60 min)',q:'35 g'},{n:'Houblon Saaz (5 min)',q:'25 g'},{n:'Levure Belle Saison',q:'1 sachet'}],
     steps:['Empâtage à 65 °C pendant 60 min','Ébullition 60 min, houblons selon le planning','Refroidir à 22 °C et ensemencer','Laisser monter à 24 °C, maintenir jusqu’à densité stable','Embouteiller avec 7 g/L de sucre']},
    {id:'r2', name:'Miso d’orge', type:'miso', duration:365, temp:18, salt:11, archived:false,
     desc:'Miso rouge au koji d’orge, vieillissement long en cellier.',
     ingredients:[{n:'Soja jaune sec',q:'1 kg'},{n:'Koji d’orge',q:'1 kg'},{n:'Sel gris',q:'260 g'},{n:'Eau de cuisson',q:'150 ml'}],
     steps:['Tremper le soja 18 h puis cuire jusqu’à écrasement facile','Mélanger koji et sel, incorporer le soja écrasé tiède','Tasser en pot sans bulles d’air, saler la surface','Couvrir, lester et laisser 12 mois au cellier']},
    {id:'r3', name:'Koji de riz', type:'koji', duration:2, temp:30, hum:85, archived:false,
     desc:'Koji de riz blanc pour amazake et shio-koji.',
     ingredients:[{n:'Riz rond poli',q:'1 kg'},{n:'Spores Aspergillus oryzae',q:'1 g'},{n:'Farine de riz grillée',q:'10 g'}],
     steps:['Laver et tremper le riz 12 h, égoutter 1 h','Cuire à la vapeur 50 min','Refroidir à 35 °C et ensemencer','Incuber à 30 °C, humidité 85 %','Retourner à 18 h puis à 26 h','Récolter entre 44 et 48 h, avant sporulation']},
    {id:'r4', name:'Garum de champignons', type:'garum', duration:49, temp:60, salt:10, archived:false,
     desc:'Garum de champignons de Paris au koji, fermentation chaude.',
     ingredients:[{n:'Champignons de Paris',q:'1 kg'},{n:'Koji de riz',q:'250 g'},{n:'Sel',q:'125 g'},{n:'Eau',q:'250 ml'}],
     steps:['Mixer grossièrement les champignons','Mélanger avec le koji, le sel et l’eau','Bocal fermé en étuve à 60 °C','Remuer une fois par semaine','Filtrer, pasteuriser, mettre en bouteille']},
    {id:'r5', name:'IPA Citra', type:'biere', duration:14, temp:19, og:1.064, fg:1.012, volume:20, archived:true,
     desc:'IPA mono-houblon, dry hop massif en fin de fermentation.',
     ingredients:[{n:'Malt Pale Ale',q:'5,2 kg'},{n:'Malt Carapils',q:'0,3 kg'},{n:'Houblon Citra',q:'180 g'},{n:'Levure US-05',q:'1 sachet'}],
     steps:['Empâtage 66 °C 60 min','Ébullition 60 min','Fermenter à 19 °C','Dry hop au jour 7','Mise en fût à froid']},
    {id:'r6', name:'Miso cacao-épeautre', type:'miso', duration:180, temp:20, salt:12, archived:true,
     desc:'Miso expérimental à l’épeautre et au grué de cacao.',
     ingredients:[{n:'Épeautre',q:'800 g'},{n:'Koji de riz',q:'800 g'},{n:'Grué de cacao',q:'120 g'},{n:'Sel',q:'230 g'}],
     steps:['Cuire l’épeautre','Mélanger koji, sel, cacao','Tasser et couvrir','Affiner 6 mois']},
  ];
  const snap = id => JSON.parse(JSON.stringify(R.find(r => r.id === id)));
  const b1s = t - 9.3*DAY, b2s = t - 142*DAY, b3s = t - 26*HOUR, b4s = t - 20*DAY, b0s = t - 52*DAY;
  const B = [
    {id:'b1', name:'Saison du Nord #3', recipe:snap('r1'), recipeId:'r1', start:b1s, status:'active',
     gravity:[[b1s,1.058],[b1s+1.5*DAY,1.047],[b1s+3*DAY,1.030],[b1s+5*DAY,1.016],[b1s+7*DAY,1.010],[b1s+9*DAY,1.008]],
     notes:[{t:b1s+2*HOUR,x:'Empâtage 65 °C pendant 60 min, rendement 74 %.'},{t:b1s+2.3*DAY,x:'Krausen haut, pic à 25,4 °C.'}]},
    {id:'b2', name:'Miso d’orge 2026', recipe:snap('r2'), recipeId:'r2', start:b2s, status:'active',
     notes:[{t:b2s,x:'Mise en pot, surface salée, poids de 2 kg.'},{t:b2s+90*DAY,x:'Contrôle : pas de moisissure, odeur sucrée et lactique.'}]},
    {id:'b3', name:'Koji de riz — amazake', recipe:snap('r3'), recipeId:'r3', start:b3s, status:'active',
     notes:[{t:b3s,x:'Ensemencement à 35 °C, riz trempé 12 h.'},{t:b3s+18*HOUR,x:'Premier retournement, mycélium visible.'}]},
    {id:'b4', name:'Garum de champignons', recipe:snap('r4'), recipeId:'r4', start:b4s, status:'active',
     notes:[{t:b4s,x:'Broyage champignons et koji, sel 10 %, étuve à 60 °C.'}]},
    {id:'b0', name:'IPA Citra #2', recipe:snap('r5'), recipeId:'r5', start:b0s, end:b0s+14*DAY, status:'done',
     gravity:[[b0s,1.064],[b0s+2*DAY,1.040],[b0s+5*DAY,1.018],[b0s+9*DAY,1.012],[b0s+13*DAY,1.011]],
     notes:[{t:b0s+7*DAY,x:'Dry hop 120 g Citra.'}]},
  ];
  const D = [
    {id:'t1', name:'Sonde fermenteur Saison', kind:'temp', batch:'b1', battery:82, online:true},
    {id:'p1', name:'Ceinture chauffante', kind:'plug', batch:'b1', mode:'auto', on:false, online:true},
    {id:'t2', name:'Sonde cellier miso', kind:'temp', batch:'b2', battery:64, online:true},
    {id:'t3', name:'Sonde chambre koji', kind:'temp', batch:'b3', battery:91, online:true},
    {id:'h1', name:'Hygromètre chambre koji', kind:'hum', batch:'b3', battery:77, online:true},
    {id:'p2', name:'Tapis chauffant koji', kind:'plug', batch:'b3', mode:'auto', on:true, online:true},
    {id:'t4', name:'Sonde étuve garum', kind:'temp', batch:'b4', battery:55, online:true},
    {id:'p3', name:'Prise étuve garum', kind:'plug', batch:'b4', mode:'auto', on:true, online:true},
    {id:'t5', name:'Sonde cave', kind:'temp', batch:null, battery:8, online:false, seen:t - 2.2*HOUR, value:14.6},
  ];
  return {recipes:R, batches:B, devices:D};
}
let S = null;
try { S = JSON.parse(localStorage.getItem(STORE)); } catch(e) {}
if (!S || !S.recipes) S = seed();
function save(){ try { localStorage.setItem(STORE, JSON.stringify(S)); } catch(e) {} }

/* ---------- Simulation ---------- */
function tgt(b, t){
  const L = b.targets; if (!L || !L.length) return b.recipe.temp;
  let v = L[0][1];
  for (let i = 1; i < L.length; i++){ const [tc, nv] = L[i]; if (t < tc) break; v = v + (nv - v) * (1 - Math.exp(-(t - tc) / (40 * 60e3))); }
  return v;
}
function model(b, t){
  const r = b.recipe, h = hash(b.id), d = (t - b.start) / DAY;
  const n = Math.sin(t/3.6e6 + h)*0.18 + Math.sin(t/1.3e6 + h*1.7)*0.09 + Math.sin(t/7e5 + h*.3)*0.05;
  const T0 = tgt(b, t); let temp = T0 + n, hum = null;
  if (r.type === 'biere') temp += 1.4 * Math.exp(-((d - 2.2) ** 2) / 1.6);
  if (r.type === 'miso') temp += 2.2 * Math.sin(d / 365 * 2 * Math.PI - 1) + Math.sin(t / DAY * 2 * Math.PI) * 0.5 + n;
  if (r.type === 'koji'){
    const g = 1 / (1 + Math.exp(-(d*24 - 22) / 3));
    temp = T0 - 1.4 + g*3.2 + n;
    hum = (r.hum || 85) + 3 - g*8 + n*4;
  }
  if (r.type === 'garum') temp += n * 0.6;
  return {temp, hum};
}
const devsOf = b => S.devices.filter(d => d.batch === b.id);
function currentTemp(b){
  if (b.status !== 'active') return model(b, b.end).temp;
  const d = devsOf(b).find(d => d.kind === 'temp' && d.online);
  return d ? d.value : null;
}
function currentHum(b){
  if (b.status !== 'active') return model(b, b.end).hum;
  const d = devsOf(b).find(d => d.kind === 'hum' && d.online);
  return d ? d.value : null;
}
function tick(){
  const t = now();
  for (const d of S.devices){
    if (!d.online) continue;
    d.seen = t;
    const b = S.batches.find(x => x.id === d.batch && x.status === 'active');
    if (d.kind === 'temp') d.value = b ? model(b, t).temp + (Math.random() - .5) * .05 : 17.6 + Math.sin(t/DAY*6.28) * .6;
    if (d.kind === 'hum') { const m = b && model(b, t).hum; d.value = m != null ? m + (Math.random() - .5) * .4 : 64 + (Math.random() - .5); }
  }
  for (const d of S.devices){
    if (d.kind !== 'plug' || !d.online) continue;
    const b = S.batches.find(x => x.id === d.batch && x.status === 'active');
    if (d.mode === 'auto' && b){
      const tp = currentTemp(b), tg = b.recipe.temp;
      if (tp != null){ const was = d.on; if (tp < tg - HYST) d.on = true; else if (tp > tg + HYST) d.on = false; if (was !== d.on) logHeat(d, b, tp, false); }
    }
    d.power = d.on ? (d.id === 'p3' ? 410 : 160) + Math.random() * 12 : 0.4;
  }
}
function status(b){
  if (b.status === 'done') return ['', 'Terminée'];
  const tp = currentTemp(b);
  if (tp == null) return ['', 'Sans sonde'];
  const dev = Math.abs(tp - b.recipe.temp), tol = TYPES[b.recipe.type].tol;
  if (dev <= tol * .5) return ['ok', 'Dans la cible'];
  if (dev <= tol) return ['warn', 'Écart léger'];
  return ['bad', 'Hors plage'];
}
function progress(b){
  const dur = b.recipe.duration, el = ((b.status === 'done' ? b.end : now()) - b.start) / DAY;
  const frac = Math.min(1, el / dur);
  let label;
  if (dur < 3) label = `${Math.floor(el*24)} h sur ${Math.round(dur*24)} h`;
  else if (dur > 90) label = `Semaine ${Math.floor(el/7) + 1} sur ${Math.ceil(dur/7)}`;
  else label = `Jour ${Math.min(Math.floor(el) + 1, Math.ceil(dur))} sur ${dur}`;
  if (b.status === 'done') label = `${fmtDur(el)} de fermentation`;
  return {frac, el, label, endAt: b.start + dur * DAY};
}
function heater(b){ const p = devsOf(b).find(d => d.kind === 'plug'); return p ? (p.on ? 'Chauffe active' : 'Chauffe en veille') : null; }

/* ---------- Charts ---------- */
function niceStep(r){ const p = 10 ** Math.floor(Math.log10(r)); const n = r / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }
function drawChart(el){
  const c = el._cfg && el._cfg(); if (!c) return;
  const fill = el.classList.contains('fill'); const W = Math.max(200, el.clientWidth), H = fill ? Math.max(120, el.clientHeight) : (c.h || 220);
  const L = 46, R = 14, T = 14, B = 28, iw = W - L - R, ih = H - T - B;
  const xs = [], ys = [];
  c.series.forEach(s => s.pts.forEach(p => { xs.push(p[0]); ys.push(p[1]); }));
  (c.lines || []).forEach(l => ys.push(l.y));
  if (c.band) ys.push(...c.band);
  if (!xs.length){ el.innerHTML = '<p class="muted">Pas encore de mesure.</p>'; return; }
  let x0 = c.x0 ?? Math.min(...xs), x1 = c.x1 ?? Math.max(...xs); if (x1 === x0) x1 = x0 + 1;
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * .18 || .5; y0 -= pad; y1 += pad;
  const sx = x => L + (x - x0) / (x1 - x0) * iw, sy = y => T + (1 - (y - y0) / (y1 - y0)) * ih;
  const step = niceStep((y1 - y0) / 4);
  let g = '';
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step){
    const y = sy(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" style="stroke:var(--grid)" stroke-width="1"/>`;
    g += `<text x="${L - 8}" y="${y + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${c.yFmt(v, step)}</text>`;
  }
  for (let i = 0; i <= 3; i++){
    const x = x0 + (x1 - x0) * i / 3, px = sx(x);
    g += `<text x="${px}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}" font-size="11" style="fill:var(--muted)">${c.xFmt(x)}</text>`;
  }
  if (c.band) g += `<rect x="${L}" width="${iw}" y="${sy(c.band[1])}" height="${sy(c.band[0]) - sy(c.band[1])}" style="fill:${c.color};opacity:.09"/>`;
  (c.lines || []).forEach(l => {
    g += `<line x1="${L}" x2="${W - R}" y1="${sy(l.y)}" y2="${sy(l.y)}" style="stroke:${c.color}" stroke-width="1" stroke-dasharray="4 4" opacity=".7"/>`;
    g += `<text x="${W - R}" y="${sy(l.y) - 6}" text-anchor="end" font-size="11" style="fill:var(--muted)">${l.label}</text>`;
  });
  c.series.forEach(s => {
    if (!s.pts.length) return;
    const d = s.pts.map((p, i) => (i ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join('');
    if (s.area) g += `<path d="${d}L${sx(s.pts.at(-1)[0])} ${T + ih}L${sx(s.pts[0][0])} ${T + ih}Z" style="fill:${s.color};opacity:.07"/>`;
    g += `<path d="${d}" fill="none" style="stroke:${s.color}" stroke-width="${s.w || 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (s.dots) s.pts.forEach(p => g += `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="3.5" style="fill:var(--surface);stroke:${s.color}" stroke-width="2"/>`);
    const lp = s.pts.at(-1);
    if (s.live) g += `<circle cx="${sx(lp[0])}" cy="${sy(lp[1])}" r="4" style="fill:${s.color}"/>`;
  });
  g += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ih}" style="stroke:var(--muted)" stroke-width="1" opacity="0"/><circle class="xd" r="4" style="fill:${c.color}" opacity="0"/>`;
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.label || 'Graphique')}">${g}</svg><div class="tip num"></div>`;
  el._sc = {sx, sy, x0, x1, L, iw, pts: c.series[0].pts, tip: c.tip};
}
function chartHover(el, e){
  const sc = el._sc; if (!sc || !sc.pts.length) return;
  const r = el.getBoundingClientRect(), x = e.clientX - r.left;
  const xv = sc.x0 + (x - sc.L) / sc.iw * (sc.x1 - sc.x0);
  let best = sc.pts[0]; for (const p of sc.pts) if (Math.abs(p[0] - xv) < Math.abs(best[0] - xv)) best = p;
  const px = sc.sx(best[0]), py = sc.sy(best[1]);
  const xh = el.querySelector('.xh'), xd = el.querySelector('.xd'), tip = el.querySelector('.tip');
  xh.setAttribute('x1', px); xh.setAttribute('x2', px); xh.setAttribute('opacity', .4);
  xd.setAttribute('cx', px); xd.setAttribute('cy', py); xd.setAttribute('opacity', 1);
  tip.textContent = sc.tip(best); tip.style.left = Math.min(Math.max(px, 60), r.width - 60) + 'px'; tip.style.opacity = 1;
  el._hover = true;
}
function chartLeave(el){ el._hover = false; drawChart(el); }
const chartRO = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(es => es.forEach(e => { const el = e.target; cancelAnimationFrame(el._raf); el._raf = requestAnimationFrame(() => drawChart(el)); })) : null;
function mountCharts(){
  document.querySelectorAll('[data-chart]').forEach(el => {
    if (el._bound) return; el._bound = true; if (chartRO) chartRO.observe(el);
    el.addEventListener('pointermove', e => chartHover(el, e));
    el.addEventListener('pointerleave', () => chartLeave(el));
  });
}
function sparkPath(b){
  const end = b.status === 'done' ? b.end : now(), from = Math.max(b.start, end - DAY), n = 48, pts = [];
  for (let i = 0; i <= n; i++){ const t = from + (end - from) * i / n; pts.push(model(b, t).temp); }
  const cur = currentTemp(b); if (cur != null) pts[pts.length - 1] = cur;
  const lo = Math.min(...pts, b.recipe.temp) - .3, hi = Math.max(...pts, b.recipe.temp) + .3;
  const y = v => 28 - (v - lo) / (hi - lo) * 26;
  const d = pts.map((v, i) => (i ? 'L' : 'M') + (i / n * 100).toFixed(2) + ' ' + y(v).toFixed(2)).join('');
  return `<line x1="0" x2="100" y1="${y(b.recipe.temp)}" y2="${y(b.recipe.temp)}" style="stroke:var(--c)" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke" opacity=".5"/><path d="${d}" fill="none" style="stroke:var(--c)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
}


function tempCfg(b){
  const active = b.status === 'active', end = active ? now() : b.end;
  const span = detailRange === '24h' ? DAY : detailRange === '7j' ? 7 * DAY : end - b.start;
  const from = Math.max(b.start, end - span), n = 160, pts = [];
  for (let i = 0; i <= n; i++){ const t = from + (end - from) * i / n; pts.push([t, model(b, t).temp]); }
  const cur = currentTemp(b); if (active && cur != null) pts[pts.length - 1] = [end, cur];
  const tg = b.recipe.temp, tol = TYPES[b.recipe.type].tol * .5, long = end - from > 2 * DAY, c = TYPES[b.recipe.type].c;
  return {color:c, series:[{pts, color:c, area:true, live:active}], band:[tg - tol, tg + tol], lines:[{y:tg, label:'cible ' + fmt(tg, 0) + ' °C'}],
    yFmt:(v, s) => fmt(v, s < 1 ? 1 : 0) + '°', xFmt:t => long ? fmtDate(t) : fmtTime(t),
    tip:p => `${fmt(p[1], 1)} °C, ${long ? fmtDate(p[0]) + ' ' : ''}${fmtTime(p[0])}`, label:'Courbe de température'};
}
function humCfg(b){
  const active = b.status === 'active', end = active ? now() : b.end, from = b.start, n = 120, pts = [];
  for (let i = 0; i <= n; i++){ const t = from + (end - from) * i / n; pts.push([t, model(b, t).hum]); }
  const cur = currentHum(b); if (active && cur != null) pts[pts.length - 1] = [end, cur];
  return {color:'var(--accent)', h:170, series:[{pts, color:'var(--accent)', area:true, live:active}], lines:[{y:b.recipe.hum, label:'cible ' + b.recipe.hum + ' %'}],
    yFmt:v => fmt(v, 0) + ' %', xFmt:fmtTime, tip:p => `${fmt(p[1], 0)} % HR, ${fmtTime(p[0])}`, label:'Courbe d’humidité'};
}
function gravCfg(b){
  const r = b.recipe, c = TYPES.biere.c;
  return {color:c, h:190, x0:b.start, x1:Math.max(b.start + r.duration * DAY * .6, (b.gravity.at(-1) || [b.start])[0] + DAY),
    series:[{pts:b.gravity, color:c, dots:true}], lines:[{y:r.fg, label:'visée ' + fmt(r.fg, 3)}],
    yFmt:v => fmt(v, 3), xFmt:t => 'J' + (Math.round((t - b.start) / DAY) + 1), tip:p => `${fmt(p[1], 3)}, ${fmtDate(p[0])}`, label:'Courbe de densité'};
}

































/* ---------- Extra icons ---------- */
const svgI = p => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
Object.assign(IC, {
  grid: svgI('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  jar: svgI('<path d="M8 3h8M9 3v3.2C6.6 7.2 5 9.4 5 12v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6c0-2.6-1.6-4.8-4-5.8V3"/><path d="M5.5 13.5c2 .9 4 .9 6.5 0s4.5-.9 6.5 0"/>'),
  book: svgI('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
  sensor: svgI('<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>'),
  temp: svgI('<path d="M14 14.8V4.5a2 2 0 0 0-4 0v10.3a4 4 0 1 0 4 0z"/>'),
  hum: svgI('<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>'),
  plug: svgI('<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>'),
  flame: svgI('<path d="M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-10-2 2-3 4-3 6-1-1-2-2-2.5-3.5C7.5 9.5 5 12 5 15c0 4.3 3 7 7 7z"/>'),
  pen: svgI('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  play: svgI('<path d="M7 4v16l13-8z"/>'),
  alert: svgI('<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>'),
  plus: svgI('<path d="M12 5v14M5 12h14"/>'),
  x: svgI('<path d="M6 6l12 12M18 6L6 18"/>'),
  search: svgI('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  archive: svgI('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>'),
  chev: svgI('<path d="M9 6l6 6-6 6"/>'),
  sun: svgI('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svgI('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  auto: svgI('<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
});
const MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3h8M9 3v3.2C6.6 7.2 5 9.4 5 12v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6c0-2.6-1.6-4.8-4-5.8V3"/><circle cx="10" cy="15" r="1.3" fill="currentColor"/><circle cx="14.5" cy="12.5" r="1" fill="currentColor"/></svg>';

/* ---------- Multiprise ---------- */
if (!S.stripSeeded){
  const plugs = S.devices.filter(d => d.kind === 'plug');
  plugs.slice(0, 5).forEach((d, i) => d.slot = i + 1);
  for (let i = plugs.length + 1; i <= 5; i++) S.devices.push({id:'p' + (i + 10), name:'Prise ' + i, kind:'plug', batch:null, mode:'manuel', on:false, online:true, slot:i});
  S.stripSeeded = true;
}
const outlets = () => S.devices.filter(d => d.kind === 'plug' && d.slot).sort((a, c) => a.slot - c.slot);
/* ---------- Events log ---------- */
S.batches.forEach(b => { if (b.status === 'done' && !b.devSnap) b.devSnap = [{name:'Sonde fermenteur', kind:'temp'}, {name:'Ceinture chauffante', kind:'plug'}]; });
if (!S.events){
  const t = now();
  S.events = [
    {t:t - 12*60e3, k:'heat-on', x:'Prise étuve garum allumée à 59,8 °C', b:'b4'},
    {t:t - 48*60e3, k:'note', x:'Note ajoutée sur Koji de riz — amazake', b:'b3'},
    {t:t - 2.2*HOUR, k:'alert', x:'Sonde cave hors ligne, batterie à 8 %', b:null},
    {t:t - 5*HOUR, k:'heat-off', x:'Ceinture chauffante éteinte à 24,2 °C', b:'b1'},
    {t:t - 26*HOUR, k:'batch', x:'Fermentation lancée : Koji de riz — amazake', b:'b3'},
  ];
}
function logEvent(k, x, b, extra){ S.events.unshift(Object.assign({t:now(), k, x, b}, extra || {})); S.events.length = Math.min(S.events.length, 500); }
function logHeat(d, b, tp, manual, t){
  const tg = b ? b.recipe.temp : null;
  const x = `${d.name} : ${d.on ? 'activation' : 'désactivation'} de la chauffe${tp != null ? ' à ' + fmt(tp, 1) + ' °C' : ''}${manual ? ' (manuel)' : ''}`;
  const e = {t:t || now(), k:d.on ? 'heat-on' : 'heat-off', x, b:b ? b.id : null, tp, tg, manual:!!manual};
  if (t){ S.events.push(e); } else { S.events.unshift(e); S.events.length = Math.min(S.events.length, 500); }
}
/* Historique de chauffe reconstruit pour la démo (36 dernières heures) */
if (!S.heatSeeded){
  S.events = S.events.filter(e => !((e.k === 'heat-on' || e.k === 'heat-off') && e.tp == null));
  const t1 = now();
  for (const b of S.batches.filter(x => x.status === 'active')){
    for (const d of S.devices.filter(x => x.kind === 'plug' && x.batch === b.id)){
      let on = null;
      for (let t = Math.max(b.start, t1 - 36 * HOUR); t < t1 - 60e3; t += 4 * 60e3){
        const tp = model(b, t).temp, tg = b.recipe.temp;
        const nxt = tp < tg - HYST ? true : tp > tg + HYST ? false : on;
        if (on !== null && nxt !== on){ d.on = nxt; logHeat(d, b, tp, false, t); }
        on = nxt;
      }
    }
  }
  S.events.sort((a, c) => c.t - a.t);
  S.heatSeeded = true;
}
const EV_IC = {target:['note', IC.temp], 'heat-on':['heat', IC.flame], 'heat-off':['', IC.flame], note:['note', IC.pen], alert:['', IC.alert], batch:['batch', IC.play]};
function feedHTML(list){
  if (!list.length) return '<div class="empty">Aucune activité récente.</div>';
  return `<ul class="feed">${list.map(e => { const [c, i] = EV_IC[e.k] || ['', IC.pen]; return `<li><span class="fi ${c}" style="${e.k === 'alert' ? 'color:var(--bad)' : ''}">${i}</span><div><div class="ft">${esc(e.x)}</div><div class="fm">${ago(e.t)}</div></div></li>`; }).join('')}</ul>`;
}

/* ---------- Live values ---------- */
function live(key){
  const [k, id] = key.split(':');
  if (k === 'dev'){
    const d = S.devices.find(x => x.id === id); if (!d) return '';
    if (d.kind === 'plug') return d.online ? (d.on ? fmt(d.power, 0) + ' W' : '0 W') : '—';
    if (d.value == null || !d.online) return '—';
    return d.kind === 'hum' ? fmt(d.value, 1) + ' %' : fmt(d.value, 2) + ' °C';
  }
  if (k === 'seen'){ const d = S.devices.find(x => x.id === id); return d ? ago(d.seen) : ''; }
  if (k === 'kpi'){ return kpiVal(id); }
  const b = S.batches.find(x => x.id === id); if (!b) return '';
  if (k === 'temp') return fmt(currentTemp(b), 1);
  if (k === 'hum') return fmt(currentHum(b), 0);
  if (k === 'heat') return heater(b) ? (devsOf(b).find(d => d.kind === 'plug').on ? 'Active' : 'Veille') : '—';
  if (k === 'delta'){
    const tp = currentTemp(b); if (tp == null) return 'Aucune sonde reliée';
    const d = tp - b.recipe.temp;
    return `${d >= 0 ? '+' : '−'}${fmt(Math.abs(d), 1)} °C vs cible`;
  }
}
function kpiVal(k){
  const act = S.batches.filter(b => b.status === 'active');
  if (k === 'alerts') return String(act.filter(b => status(b)[0] === 'bad' || status(b)[0] === 'warn').length);
  if (k === 'online') return `${S.devices.filter(d => d.online).length}/${S.devices.length}`;
  if (k === 'heaters') return String(S.devices.filter(d => d.kind === 'plug' && d.on).length);
  if (k === 'power') return fmt(S.devices.filter(d => d.kind === 'plug' && d.on).reduce((a, d) => a + d.power, 0), 0);
  return '';
}
function refreshLive(){
  document.querySelectorAll('[data-live]').forEach(el => { const v = live(el.dataset.live); if (el.textContent !== v) el.textContent = v; });
  document.querySelectorAll('[data-state]').forEach(el => { const b = S.batches.find(x => x.id === el.dataset.state); el.outerHTML = stateBadge(b, true); });
  document.querySelectorAll('[data-spark]').forEach(el => { const b = S.batches.find(x => x.id === el.dataset.spark); el.innerHTML = sparkPath(b); });
  document.querySelectorAll('[data-plugbtn]').forEach(el => { const d = S.devices.find(x => x.id === el.dataset.plugbtn); if (!d) return; el.setAttribute('aria-pressed', d.on ? 'true' : 'false'); el.textContent = d.on ? 'ON' : 'OFF'; el.closest('.outlet')?.classList.toggle('is-on', !!d.on); });
  const so = document.getElementById('strip-on'); if (so) so.textContent = outlets().filter(d => d.on).length;
  document.querySelectorAll('[data-plug]').forEach(el => { const d = S.devices.find(x => x.id === el.dataset.plug); if (d) el.setAttribute('aria-checked', d.on ? 'true' : 'false'); });
  document.querySelectorAll('[data-chart]').forEach(el => { if (!el._hover && el.dataset.live2 !== undefined) drawChart(el); });
  const jl = document.getElementById('journal-list');
  if (jl){ const b = S.batches.find(x => x.id === jl.dataset.b); const h = journalHTML(b); if (jl._h !== h){ jl.innerHTML = h; jl._h = h; } }
  const feed = document.getElementById('feed'); if (feed){ const h = feedHTML(S.events.slice(0, 30)); if (feed._h !== h){ const st = feed.scrollTop; feed.innerHTML = feed._h = h; feed.scrollTop = st; } }
  const st = new Date().toLocaleTimeString('fr-FR');
  document.getElementById('syncTxt').textContent = 'Dernière synchro ' + st;
  document.getElementById('syncTop').textContent = 'En direct, ' + st;
}
function stateBadge(b, liveAttr){
  const [c, t] = status(b);
  return `<span class="badge ${c}" ${liveAttr && b.status === 'active' ? `data-state="${b.id}"` : ''}><span class="dot"></span>${t}</span>`;
}

/* ---------- Router ---------- */
let detailRange = '24h', detailChart = 'temp', recipeTab = 'actives', recipeType = 'all', recipeQuery = '', devFilter = 'all';
const routes = [
  [/^#?\/?$/, home, 'home'],
  [/^#\/f\/(\w+)$/, detail, 'home'],
  [/^#\/recettes$/, recipes, 'recettes'],
  [/^#\/recettes\/new$/, () => recipeForm(null), 'recettes'],
  [/^#\/recettes\/(\w+)$/, id => recipeForm(id), 'recettes'],
  [/^#\/appareils$/, devices, 'appareils'],
  [/^#\/archive$/, archive, 'archive'],
  [/^#\/archive\/(\w+)$/, archiveDetail, 'archive'],
];
function navHTML(active, mobile){
  const nAct = S.batches.filter(b => b.status === 'active').length, nRec = S.recipes.filter(r => !r.archived).length;
  const nArc = S.batches.filter(b => b.status === 'done').length;
  const items = [['home','#/','Vue d’ensemble',IC.grid,nAct],['recettes','#/recettes','Recettes',IC.book,nRec],['appareils','#/appareils','Appareils',IC.sensor,S.devices.length],['archive','#/archive','Archive',IC.archive,nArc]];
  if (mobile) return [items[0], items[3], items[1], items[2]].map(([k, h, l, i]) => `<a href="${h}" ${k === active ? 'aria-current="page"' : ''}>${i}<span>${k === 'home' ? 'Accueil' : l}</span></a>`).join('');
  const a = ([k, h, l, i, n]) => `<a href="${h}" ${k === active ? 'aria-current="page"' : ''}>${i}<span>${l}</span><span class="cnt num">${n}</span></a>`;
  return `<div class="nav-sec">Suivi</div>${a(items[0])}${a(items[3])}<div class="nav-sec">Bibliothèque</div>${a(items[1])}<div class="nav-sec">Installation</div>${a(items[2])}`;
}
function setCrumbs(parts){
  document.getElementById('crumbs').innerHTML = parts.map((p, i) => i < parts.length - 1 ? `<a href="${p[1]}">${esc(p[0])}</a><span class="sep">/</span>` : `<span class="cur">${esc(p[0])}</span>`).join('');
}
function render(){
  const h = location.hash || '#/';
  for (const [re, fn, tab] of routes){
    const m = h.match(re);
    if (m){
      document.getElementById('nav').innerHTML = navHTML(tab);
      document.getElementById('tabbar').innerHTML = navHTML(tab, true);
      const view = document.getElementById('view'); view.dataset.page = h.startsWith('#/f/') || h.startsWith('#/archive/') || h === '#/' || h === '#' || h === '' ? 'detail' : ''; view.innerHTML = fn(m[1]);
      document.querySelectorAll('[data-chart]').forEach(drawChart);
      mountCharts();
      return;
    }
  }
  location.hash = '#/';
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
window.addEventListener('resize', () => document.querySelectorAll('[data-chart]').forEach(drawChart));

/* ---------- Overview ---------- */
function home(){
  setCrumbs([['Vue d’ensemble']]);
  const act = S.batches.filter(b => b.status === 'active').sort((a, b) => a.start - b.start);
  const done = S.batches.filter(b => b.status === 'done').sort((a, b) => b.end - a.end);
  const al = +kpiVal('alerts'), off = S.devices.filter(d => !d.online).length;
  const today = new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
  const lots = act.map(b => {
    const r = b.recipe, T = TYPES[r.type], p = progress(b);
    const third = r.type === 'koji' ? ['Humidité', `<span data-live="hum:${b.id}">${fmt(currentHum(b), 0)}</span><small>%</small>`]
      : r.type === 'biere' && b.gravity?.length ? ['Densité', fmt(b.gravity.at(-1)[1], 3)]
      : ['Chauffe', `<span data-live="heat:${b.id}">${live('heat:' + b.id)}</span>`];
    return `<a class="lot" href="#/f/${b.id}" style="--c:${T.c}">
      <div class="lot-h"><span class="type"><i></i>${T.label}</span>${stateBadge(b, true)}</div>
      <div class="lot-n">${esc(b.name)}</div>
      <div class="lot-m num">Démarrée le ${fmtDate(b.start)}, ${fmtDur(r.duration)} prévus</div>
      <div class="lot-metrics num">
        <div><div class="k">Température</div><div class="v"><span data-live="temp:${b.id}">${fmt(currentTemp(b), 1)}</span><small>°C</small></div></div>
        <div><div class="k">Cible</div><div class="v">${fmt(r.temp, 1)}<small>°C</small></div></div>
        <div><div class="k">${third[0]}</div><div class="v">${third[1]}</div></div>
      </div>
      <svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" data-spark="${b.id}" aria-hidden="true">${sparkPath(b)}</svg>
      <div class="lot-f"><div class="row num"><span>${p.label}</span><span>${Math.round(p.frac * 100)} %</span></div><div class="bar"><div style="width:${(p.frac * 100).toFixed(1)}%"></div></div></div>
    </a>`;
  }).join('');
  const health = S.devices.slice().sort((a, b) => (a.online - b.online) || ((a.battery ?? 100) - (b.battery ?? 100))).slice(0, 5).map(d =>
    `<li><span class="dev-ic">${IC[d.kind]}</span><span class="nm">${esc(d.name)}</span>${d.online ? (d.battery != null && d.battery < 20 ? `<span class="badge warn">${d.battery} %</span>` : `<span class="vl num" data-live="dev:${d.id}">${live('dev:' + d.id)}</span>`) : '<span class="badge bad">Hors ligne</span>'}</li>`).join('');
  return `<div class="dp home">
    <div class="dp-head"><div class="dp-title"><h1>Vue d’ensemble</h1><span class="dp-sub">Situation au ${today}</span></div>
    <div class="ph-actions"><a class="btn" href="#/appareils">${IC.sensor}Appareils</a><a class="btn primary" href="#/recettes">${IC.plus}Lancer une fermentation</a></div></div>
    <div class="kpis compact">
      <div class="card kpi"><div class="k">${IC.jar}Lots en cours</div><div class="v num">${act.length}</div><div class="s">${S.recipes.filter(r => !r.archived).length} recettes disponibles</div></div>
      <div class="card kpi"><div class="k">${IC.alert}Écarts de température</div><div class="v num" data-live="kpi:alerts">${al}</div><div class="s ${al ? 'warn' : 'ok'}">${al ? 'À vérifier' : 'Tous les lots dans leur plage'}</div></div>
      <div class="card kpi"><div class="k">${IC.sensor}Appareils en ligne</div><div class="v num" data-live="kpi:online">${kpiVal('online')}</div><div class="s ${off ? 'bad' : 'ok'}">${off ? off + ' hors ligne' : 'Tous connectés'}</div></div>
      <div class="card kpi"><div class="k">${IC.flame}Chauffe active</div><div class="v num"><span data-live="kpi:heaters">${kpiVal('heaters')}</span><small>prises</small></div><div class="s num"><span data-live="kpi:power">${kpiVal('power')}</span> W consommés</div></div>
    </div>
    <div class="ov home-grid">
        <section class="card scroll-card"><div class="card-h"><h2>Lots en cours<span class="sub num">${act.length}</span></h2><a class="btn ghost sm" href="#/recettes">Voir les recettes</a></div>
          ${act.length ? `<div class="lots scroll">${lots}</div>` : `<div class="empty"><strong>Aucune fermentation en cours</strong>Lancez-en une depuis une recette.</div>`}</section>
      <div class="side-stack">
        <section class="card scroll-card feed-card"><div class="card-h"><h2>Activité récente</h2></div><div id="feed" class="scroll">${feedHTML(S.events.slice(0, 30))}</div></section>
        <section class="card scroll-card health-card"><div class="card-h"><h2>État des appareils</h2><a class="btn ghost sm" href="#/appareils">Tout voir</a></div><ul class="health scroll">${health}</ul></section>
      </div>
    </div>
  </div>`;
}

/* ---------- Detail ---------- */
function detail(id){
  const b = S.batches.find(x => x.id === id);
  if (!b){ setCrumbs([['Vue d’ensemble', '#/'], ['Introuvable']]); return `<div class="card empty"><strong>Fermentation introuvable</strong>Elle a peut-être été supprimée.</div>`; }
  if (b.status === 'done'){ setTimeout(() => location.replace('#/archive/' + b.id)); return ''; }
  setCrumbs([['Vue d’ensemble', '#/'], [b.name]]);
  const r = b.recipe, T = TYPES[r.type], p = progress(b), active = b.status === 'active';
  const unit = r.duration < 3 ? 4 / 24 : r.duration > 90 ? 7 : 1;
  const cells = Math.ceil(r.duration / unit), cur = Math.floor(p.el / unit);
  let strip = ''; for (let i = 0; i < cells; i++) strip += `<span class="${i < cur || !active ? 'past' : i === cur ? 'now' : ''}" title="${unit < 1 ? (i*4) + ' h' : unit === 7 ? 'Semaine ' + (i+1) : 'Jour ' + (i+1)}"></span>`;
  const remain = Math.max(0, p.endAt - (active ? now() : b.end)) / DAY;

  const kp = [];
  kp.push(['Température', `<span ${active ? `data-live="temp:${b.id}"` : ''}>${fmt(currentTemp(b), 1)}</span><small>°C</small>`, `<span ${active ? `data-live="delta:${b.id}"` : ''}>${live('delta:' + b.id)}</span>`]);
  kp.push(['Consigne', `${fmt(r.temp, 1)}<small>°C</small>`, `Tolérance ±${fmt(TYPES[r.type].tol / 2, 1)} °C`]);
  if (r.type === 'koji') kp.push(['Humidité', `<span ${active ? `data-live="hum:${b.id}"` : ''}>${fmt(currentHum(b), 0)}</span><small>%</small>`, `Cible ${r.hum} %`]);
  if (r.type === 'biere' && b.gravity?.length){
    const g = b.gravity.at(-1)[1], abv = (r.og - g) * 131.25, att = (r.og - g) / (r.og - 1) * 100;
    kp.push(['Densité', fmt(g, 3), `Visée ${fmt(r.fg, 3)}`], ['Alcool estimé', `${fmt(abv, 1)}<small>%</small>`, `Atténuation ${fmt(att, 0)} %`]);
  }
  if (r.salt) kp.push(['Salinité', `${fmt(r.salt, 0)}<small>%</small>`, 'Du poids total']);
  kp.push(['Chauffage', `<span ${active ? `data-live="heat:${b.id}"` : ''}>${live('heat:' + b.id)}</span>`, `Hystérésis ±${fmt(HYST, 1)} °C`]);

  const tabs = [['temp', 'Température']];
  if (r.type === 'koji') tabs.push(['hum', 'Humidité']);
  if (r.type === 'biere') tabs.push(['grav', 'Densité']);
  if (!tabs.find(t => t[0] === detailChart)) detailChart = 'temp';
  const ranges = r.duration < 3 ? [['24h', '24 h'], ['tout', 'Tout']] : [['24h', '24 h'], ['7j', '7 j'], ['tout', 'Tout']];
  if (!ranges.find(x => x[0] === detailRange)) detailRange = '24h';

  const params = [['Recette', `<a href="#/recettes/${r.id}" style="color:var(--accent)">${esc(r.name)}</a>`], ['Durée prévue', fmtDur(r.duration)], ['Consigne', fmt(r.temp, 1) + ' °C']];
  if (r.type === 'biere') params.push(['Densité initiale', fmt(r.og, 3)], ['Densité finale', fmt(r.fg, 3)], ['Volume', (r.volume || '—') + ' L']);
  if (r.type === 'koji') params.push(['Humidité', r.hum + ' %']);
  if (r.salt) params.push(['Salinité', r.salt + ' %']);
  params.push(['Démarrée le', fmtDateY(b.start)]);
  const devs = devsOf(b);
  const lc = detailChart === 'hum' ? 'var(--accent)' : T.c;

  setTimeout(() => { const el = document.getElementById('chart-main'); if (el){ el._cfg = () => chartCfg(b); drawChart(el); mountCharts(); } });

  return `<div class="dp" style="--c:${T.c}">
    <div class="dp-head">
      <div class="dp-title"><h1>${esc(b.name)}</h1><span class="type"><i></i>${T.label}</span>${stateBadge(b, true)}
        <span class="dp-sub num">Démarrée le ${fmtDateY(b.start)} à ${fmtTime(b.start)}${!active ? `, terminée le ${fmtDateY(b.end)}` : ''}</span></div>
      <div class="ph-actions">${active ? `<button class="btn" data-action="finish" data-id="${b.id}">Terminer le lot</button>` : `<button class="btn danger" data-action="delete-batch" data-id="${b.id}">Supprimer</button>`}</div>
    </div>

    <div class="kpis compact">${kp.map(([k, v, s]) => `<div class="card kpi"><div class="k">${k}</div><div class="v num">${v}</div><div class="s num">${s}</div></div>`).join('')}</div>

    <div class="dp-grid">
      <section class="card dp-chart">
        <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-action="ctab" data-v="${k}" aria-selected="${detailChart === k}">${l}</button>`).join('')}
          <span class="tabs-end">${detailChart !== 'grav' ? `<span class="seg">${ranges.map(([k, l]) => `<button data-action="range" data-r="${k}" aria-pressed="${detailRange === k}">${l}</button>`).join('')}</span>` : ''}</span></div>
        <div class="dp-chart-body ${detailChart === 'grav' ? 'with-side' : ''}">
          <div class="dp-plot">
            <div class="chart fill" id="chart-main" data-chart ${active && detailChart !== 'grav' ? 'data-live2' : ''}></div>
            <div class="legend" style="--c:${lc}"><span><i></i>${detailChart === 'temp' ? 'Mesure' : detailChart === 'hum' ? 'Humidité relative' : 'Relevés de densité'}</span><span><i class="dash"></i>${detailChart === 'grav' ? 'Densité visée' : 'Consigne'}</span>${detailChart === 'temp' ? '<span><i class="band"></i>Plage tolérée</span>' : ''}</div>
          </div>
          ${detailChart === 'grav' ? gravHTML(b, active) : ''}
        </div>
      </section>

      <section class="card dp-journal scroll-card"><div class="card-h"><h2>Journal</h2>
          <span class="seg">${[['all','Tout'],['note','Notes'],['heat','Chauffe'],['target','Consigne']].map(([k, l]) => `<button data-action="jfilter" data-v="${k}" aria-pressed="${journalFilter === k}">${l}</button>`).join('')}</span></div>
        <ul class="notes journal scroll" id="journal-list" data-b="${b.id}">${journalHTML(b)}</ul>
        <form class="note-form" data-form="note" data-id="${b.id}"><input type="text" name="x" placeholder="Ajouter une observation" required aria-label="Nouvelle note"><button class="btn">Ajouter</button></form></section>

      <section class="card dp-devs scroll-card"><div class="card-h"><h2>Appareils reliés<span class="sub num">${devs.length}</span></h2><a class="btn ghost sm" href="#/appareils">Gérer</a></div>
        <div class="scroll">${devs.length ? `<table class="data"><tbody>${devs.map(d => `<tr><td><div class="dev-cell"><span class="dev-ic">${IC[d.kind]}</span><div><div class="nm">${esc(d.name)}</div><div class="sm">${d.online ? (d.kind === 'plug' ? (d.mode === 'auto' ? 'Mode auto' : 'Mode manuel') : 'En ligne') : 'Hors ligne'}</div></div></div></td><td class="r num" data-live="dev:${d.id}">${live('dev:' + d.id)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Aucun appareil relié.</div>'}</div></section>

      <div class="dp-side">
        ${active ? `<section class="card"><div class="card-h"><h2>Consigne</h2><span class="muted num">Actuelle ${fmt(r.temp, 1)} °C</span></div>
          <form class="card-b" data-form="target" data-id="${b.id}">
            <div class="tset"><div class="stepper"><button type="button" data-action="tstep" data-d="-0.5" aria-label="Baisser de 0,5 °C">−</button><input type="number" name="t" step="0.5" min="-5" max="100" value="${r.temp}" aria-label="Nouvelle consigne en °C"><span>°C</span><button type="button" data-action="tstep" data-d="0.5" aria-label="Monter de 0,5 °C">+</button></div>
            <button class="btn primary">Appliquer</button></div>
            <p class="hint num">Chauffe active sous ${fmt(r.temp - HYST, 1)} °C, coupée au-dessus de ${fmt(r.temp + HYST, 1)} °C.</p>
          </form></section>` : ''}
        <section class="card"><div class="card-h"><h2>Progression</h2><span class="muted num">${Math.round(p.frac * 100)} %</span></div>
          <div class="card-b"><div class="prog-top"><strong class="num">${p.label}</strong></div>
            <div class="strip" aria-label="${Math.round(p.frac * 100)} % de la durée prévue">${strip}</div>
            <div class="dates num"><div><div class="k">Début</div><div class="v">${fmtDate(b.start)}</div></div><div><div class="k">${active ? 'Restant' : 'Durée'}</div><div class="v">${active ? (remain > 0 ? fmtDur(remain) : 'Échu') : fmtDur((b.end - b.start) / DAY)}</div></div><div><div class="k">${active ? 'Fin prévue' : 'Fin'}</div><div class="v">${fmtDate(active ? p.endAt : b.end)}</div></div></div></div></section>
        <section class="card scroll-card dp-params"><div class="card-h"><h2>Paramètres</h2></div><div class="scroll"><dl class="kv num">${params.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div></section>
      </div>
    </div>
  </div>`;
}
function chartCfg(b){
  return detailChart === 'hum' ? humCfg(b) : detailChart === 'grav' ? gravCfg(b) : tempCfg(b);
}
const dtLocal = t => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
function gravHTML(b, active){
  const r = b.recipe, list = (b.gravity || []).slice().sort((a, c) => c[0] - a[0]);
  return `<div class="grav-side">
    ${active ? `<form class="grav-form" data-form="gravity" data-id="${b.id}">
      <label class="field"><span>Densité mesurée</span><input type="number" name="g" step="0.001" min="0.990" max="1.150" placeholder="1.007" required></label>
      <label class="field"><span>Date de la mesure</span><input type="datetime-local" name="d" value="${dtLocal(now())}" max="${dtLocal(now())}" required></label>
      <button class="btn">Ajouter le relevé</button></form>` : ''}
    <div class="scroll grav-list"><table class="data"><thead><tr><th>Date</th><th class="r">Densité</th><th class="r">Alcool</th><th></th></tr></thead><tbody>
    ${list.map(([t, g]) => `<tr><td class="num sm">${fmtDate(t)}, ${fmtTime(t)}</td><td class="r num nm">${fmt(g, 3)}</td><td class="r num">${fmt((r.og - g) * 131.25, 1)} %</td><td class="r">${active ? `<button type="button" class="icon-btn bare" data-action="rm-grav" data-id="${b.id}" data-t="${t}" aria-label="Supprimer ce relevé">${IC.x}</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}
let journalFilter = 'all';
function journalHTML(b, jf){
  jf = jf || journalFilter;
  let items = b.notes.map(n => ({t:n.t, k:'note', x:n.x}));
  S.events.filter(e => e.b === b.id && (((e.k === 'heat-on' || e.k === 'heat-off') && e.tp != null) || e.k === 'target')).forEach(e => items.push(e));
  if (jf === 'note') items = items.filter(i => i.k === 'note');
  if (jf === 'heat') items = items.filter(i => i.k === 'heat-on' || i.k === 'heat-off');
  if (jf === 'target') items = items.filter(i => i.k === 'target');
  items.sort((a, c) => c.t - a.t);
  if (!items.length) return '<li class="muted">Aucune entrée.</li>';
  return items.slice(0, 150).map(i => {
    let body, tag;
    if (i.k === 'note'){ tag = '<span class="badge">Note</span>'; body = esc(i.x); }
    else if (i.k === 'target'){ tag = '<span class="badge acc">Consigne</span>'; body = `Consigne modifiée de ${fmt(i.from, 1)} °C à <strong>${fmt(i.to, 1)} °C</strong>`; }
    else {
      const dl = i.tp - i.tg, on = i.k === 'heat-on';
      tag = `<span class="badge ${on ? 'warn' : ''}">${on ? 'Chauffe on' : 'Chauffe off'}</span>`;
      body = `<strong>${fmt(i.tp, 1)} °C</strong> (${dl >= 0 ? '+' : '−'}${fmt(Math.abs(dl), 1)} °C) - ${on ? 'Activation' : 'Désactivation'} de la chauffe${i.manual ? ', manuelle' : ''}`;
    }
    return `<li class="jl"><time class="num">${fmtDate(i.t)}, ${fmtTime(i.t)}</time>${tag}<span class="num jt">${body}</span></li>`;
  }).join('');
}

/* ---------- Recipes ---------- */
function recipes(){
  setCrumbs([['Recettes']]);
  const act = S.recipes.filter(r => !r.archived), arc = S.recipes.filter(r => r.archived);
  let list = recipeTab === 'actives' ? act : arc;
  if (recipeType !== 'all') list = list.filter(r => r.type === recipeType);
  if (recipeQuery) list = list.filter(r => (r.name + ' ' + (r.desc || '')).toLowerCase().includes(recipeQuery.toLowerCase()));
  const runs = id => S.batches.filter(b => b.recipeId === id);
  const rows = list.map(r => {
    const T = TYPES[r.type], rs = runs(r.id), last = rs.length ? Math.max(...rs.map(b => b.start)) : null;
    const spec = r.type === 'biere' ? `${fmt(r.og, 3)} → ${fmt(r.fg, 3)}` : r.type === 'koji' ? `${r.hum} % HR` : `${r.salt} % sel`;
    return `<tr class="click" data-href="#/recettes/${r.id}"><td class="first"><div class="nm">${esc(r.name)}</div><div class="sm" style="max-width:48ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.desc || '')}</div></td>
      <td data-l="Type"><span class="type" style="--c:${T.c}"><i></i>${T.label}</span></td>
      <td data-l="Durée" class="num">${fmtDur(r.duration)}</td><td data-l="Température" class="num">${fmt(r.temp, 1)} °C</td>
      <td data-l="Paramètre" class="num">${spec}</td><td data-l="Lancements" class="r num">${rs.length}</td>
      <td data-l="Dernier lancement" class="r num sm">${last ? fmtDateY(last) : '—'}</td></tr>`;
  }).join('');
  return `<div class="ph"><div><h1>Recettes</h1><p>Modèles de fermentation réutilisables</p></div>
    <div class="ph-actions"><a class="btn primary" href="#/recettes/new">${IC.plus}Nouvelle recette</a></div></div>
    <section class="card">
      <div class="tabs" role="tablist"><button role="tab" data-action="rtab" data-v="actives" aria-selected="${recipeTab === 'actives'}">Actives<span class="cnt num">${act.length}</span></button><button role="tab" data-action="rtab" data-v="archivees" aria-selected="${recipeTab === 'archivees'}">Archivées<span class="cnt num">${arc.length}</span></button></div>
      <div class="toolbar">
        <label class="search">${IC.search}<input type="search" id="rsearch" placeholder="Rechercher" value="${esc(recipeQuery)}" aria-label="Rechercher une recette"></label>
        <span class="spacer"></span>
        <span class="seg"><button data-action="rtype" data-v="all" aria-pressed="${recipeType === 'all'}">Tous</button>${Object.entries(TYPES).map(([k, T]) => `<button data-action="rtype" data-v="${k}" aria-pressed="${recipeType === k}">${T.label}</button>`).join('')}</span>
      </div>
      ${rows ? `<div class="tbl-wrap"><table class="data stack"><thead><tr><th>Nom</th><th>Type</th><th>Durée</th><th>Température</th><th>Paramètre clé</th><th class="r">Lancements</th><th class="r">Dernier lancement</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty"><strong>${recipeQuery || recipeType !== 'all' ? 'Aucune recette ne correspond aux filtres' : recipeTab === 'actives' ? 'Aucune recette active' : 'Aucune recette archivée'}</strong>${recipeTab === 'actives' ? 'Créez une recette avec le bouton Nouvelle recette.' : 'Les recettes archivées apparaîtront ici.'}</div>`}
    </section>`;
}
function ingRow(i = {}){ return `<div class="rrow"><input type="text" name="in" value="${esc(i.n)}" placeholder="Ingrédient" aria-label="Ingrédient"><input type="text" name="iq" value="${esc(i.q)}" placeholder="Quantité" aria-label="Quantité"><button type="button" class="icon-btn bare" data-action="rm-row" aria-label="Retirer">${IC.x}</button></div>`; }
function stepRow(s = '', n = 1){ return `<div class="rrow step"><span class="ix num">${n}</span><input type="text" name="st" value="${esc(s)}" placeholder="Décrire l’étape" aria-label="Étape ${n}"><button type="button" class="icon-btn bare" data-action="rm-row" aria-label="Retirer">${IC.x}</button></div>`; }
function renumber(){ document.querySelectorAll('#steps .rrow .ix').forEach((e, i) => e.textContent = i + 1); }
function recipeForm(id){
  const r = id ? S.recipes.find(x => x.id === id) : null;
  if (id && !r){ setCrumbs([['Recettes', '#/recettes'], ['Introuvable']]); return `<div class="card empty"><strong>Recette introuvable</strong></div>`; }
  setCrumbs([['Recettes', '#/recettes'], [r ? r.name : 'Nouvelle recette']]);
  const v = r || {type:'biere', duration:14, temp:20, og:1.050, fg:1.010, volume:20, hum:85, salt:10, ingredients:[{},{},{}], steps:['','','']};
  const rs = r ? S.batches.filter(b => b.recipeId === r.id) : [];
  const u = (name, val, step, unit, extra = '') => `<div class="unit"><input type="number" name="${name}" step="${step}" value="${val ?? ''}" ${extra}><b>${unit}</b></div>`;
  return `<div class="ph"><div><h1>${r ? esc(r.name) : 'Nouvelle recette'}</h1><p>${r ? (r.archived ? 'Recette archivée' : 'Modifier la recette') : 'Définir un nouveau modèle de fermentation'}</p></div>
    <div class="ph-actions"><a class="btn ghost" href="#/recettes">Annuler</a><button class="btn primary" type="submit" form="rform">Enregistrer</button></div></div>
  <form id="rform" data-type="${v.type}" data-id="${r ? r.id : ''}" novalidate>
   <div class="rf">
    <div class="dcol">
      <section class="card"><div class="card-h"><h2>Informations générales</h2></div><div class="card-b">
        <div class="fgrid">
          <div class="field full"><span>Type de fermentation</span><div class="types">${Object.entries(TYPES).map(([k, T]) => `<label style="--c:${T.c}"><input type="radio" name="type" value="${k}" ${k === v.type ? 'checked' : ''}><span><i></i>${T.label}</span></label>`).join('')}</div></div>
          <label class="field full"><span>Nom</span><input type="text" name="name" value="${esc(v.name || '')}" placeholder="Ex. Shio-koji au riz complet" required></label>
          <label class="field full"><span>Description <em>facultatif</em></span><textarea name="desc" placeholder="Style, intention, remarques">${esc(v.desc || '')}</textarea></label>
        </div></div></section>
      <section class="card"><div class="card-h"><h2>Paramètres de fermentation</h2></div><div class="card-b"><div class="fgrid">
        <label class="field"><span>Durée prévue</span>${u('duration', v.duration, '0.5', 'jours', 'min="0.5"')}</label>
        <label class="field"><span>Température cible</span>${u('temp', v.temp, '0.5', '°C')}</label>
        <label class="field t-only t-biere"><span>Densité initiale (OG)</span><input type="number" name="og" step="0.001" value="${v.og ?? 1.050}"></label>
        <label class="field t-only t-biere"><span>Densité finale visée (FG)</span><input type="number" name="fg" step="0.001" value="${v.fg ?? 1.010}"></label>
        <label class="field t-only t-biere"><span>Volume</span>${u('volume', v.volume ?? 20, '1', 'L')}</label>
        <label class="field t-only t-koji"><span>Humidité cible</span>${u('hum', v.hum ?? 85, '1', '% HR')}</label>
        <label class="field t-only t-salt"><span>Salinité</span>${u('salt', v.salt ?? 10, '0.5', '%')}</label>
      </div></div></section>
      <section class="card"><div class="card-h"><h2>Ingrédients</h2></div>
        <div class="rows-h"><span>Ingrédient</span><span>Quantité</span><span></span></div>
        <div class="rows" id="ings">${v.ingredients.map(ingRow).join('')}</div>
        <div class="add-row"><button type="button" class="btn ghost sm" data-action="add-ing">${IC.plus}Ajouter un ingrédient</button></div></section>
      <section class="card"><div class="card-h"><h2>Étapes</h2></div>
        <div class="rows" id="steps">${v.steps.map((s, i) => stepRow(s, i + 1)).join('')}</div>
        <div class="add-row"><button type="button" class="btn ghost sm" data-action="add-step">${IC.plus}Ajouter une étape</button></div></section>
      <p class="err" id="ferr" role="alert"></p>
    </div>
    <div class="dcol sticky">
      ${r ? `<section class="card"><div class="card-h"><h2>Actions</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:8px">
          ${!r.archived ? `<button type="button" class="btn primary" data-action="launch" data-id="${r.id}">${IC.play}Lancer une fermentation</button>` : ''}
          <button type="button" class="btn" data-action="archive" data-id="${r.id}">${r.archived ? 'Restaurer la recette' : 'Archiver la recette'}</button></div></section>
        <section class="card"><div class="card-h"><h2>Historique</h2><span class="muted num">${rs.length}</span></div>
          ${rs.length ? `<table class="data"><tbody>${rs.sort((a, c) => c.start - a.start).map(b => `<tr class="click" data-href="#/${b.status === 'done' ? 'archive' : 'f'}/${b.id}"><td class="nm">${esc(b.name)}</td><td class="r sm num">${fmtDate(b.start)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Jamais lancée.</div>'}</section>`
      : `<section class="card"><div class="card-h"><h2>Après l’enregistrement</h2></div><div class="card-b muted" style="font-size:13.5px">La recette apparaît dans l’onglet Actives. Ouvrez-la pour lancer une fermentation : la température cible pilote alors automatiquement les prises reliées.</div></section>`}
    </div>
   </div>
  </form>`;
}

/* ---------- Devices ---------- */
function devices(){
  setCrumbs([['Appareils']]);
  const act = S.batches.filter(b => b.status === 'active');
  const opt = sel => `<option value="">Non relié</option>` + act.map(b => `<option value="${b.id}" ${sel === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  const KL = {temp:'Température', hum:'Humidité', plug:'Prise'};
  const list = S.devices.filter(d => devFilter === 'all' || d.kind === devFilter);
  const off = S.devices.filter(d => !d.online).length, low = S.devices.filter(d => d.battery != null && d.battery < 20).length;
  const rows = list.map(d => {
    const bat = d.battery != null ? `<div class="bat num"><div class="bar" style="--c:${d.battery < 20 ? 'var(--bad)' : d.battery < 50 ? 'var(--warn)' : 'var(--ok)'}"><div style="width:${d.battery}%"></div></div>${d.battery} %</div>` : '<span class="muted">Secteur</span>';
    const ctl = d.kind === 'plug' ? `<select data-action="plug-mode" data-id="${d.id}" aria-label="Mode" style="width:auto"><option value="auto" ${d.mode === 'auto' ? 'selected' : ''}>Auto</option><option value="manuel" ${d.mode === 'manuel' ? 'selected' : ''}>Manuel</option></select>
      <button class="switch" role="switch" aria-checked="${d.on}" aria-label="Allumer ou éteindre ${esc(d.name)}" data-action="toggle-plug" data-id="${d.id}" data-plug="${d.id}" ${d.online ? '' : 'disabled'}></button>` : '';
    return `<tr>
      <td class="first"><div class="dev-cell"><span class="dev-ic">${IC[d.kind]}</span><div><div class="nm">${esc(d.name)}</div><div class="sm num">${d.slot ? 'Multiprise, prise ' + d.slot : d.id.toUpperCase()}</div></div></div></td>
      <td data-l="Type">${KL[d.kind]}</td>
      <td data-l="Mesure" class="num nm" data-live="dev:${d.id}">${live('dev:' + d.id)}</td>
      <td data-l="Fermentation"><select data-action="assign" data-id="${d.id}" aria-label="Fermentation reliée">${opt(d.batch)}</select></td>
      <td data-l="Batterie">${bat}</td>
      <td data-l="Dernière remontée" class="num sm" ${d.online ? `data-live="seen:${d.id}"` : ''}>${ago(d.seen)}</td>
      <td data-l="État">${d.online ? '<span class="badge ok"><span class="dot"></span>En ligne</span>' : '<span class="badge bad"><span class="dot"></span>Hors ligne</span>'}</td>
      <td data-l="Contrôle"><div class="ctl">${ctl}<button class="icon-btn bare" data-action="rm-dev" data-id="${d.id}" aria-label="Retirer ${esc(d.name)}">${IC.x}</button></div></td></tr>`;
  }).join('');
  const cnt = k => S.devices.filter(d => k === 'all' || d.kind === k).length;
  const ol = outlets();
  const strip = `<div class="strip-h"><div class="strip-title">${IC.plug}<div><div class="nm">Multiprise connectée</div><div class="sm num">${ol.length} prises, allumées : <span id="strip-on">${ol.filter(d => d.on).length}</span>, puissance : <span data-live="kpi:power">${kpiVal('power')}</span> W</div></div></div></div>
    <div class="outlets">${ol.map(d => `<div class="outlet ${d.on ? 'is-on' : ''} ${d.online ? '' : 'off'}">
      <div class="o-top"><span class="o-slot"><span class="o-led"></span>Prise ${d.slot}</span><span class="o-pw num" data-live="dev:${d.id}">${live('dev:' + d.id)}</span></div>
      <div class="o-name" title="${esc(d.name)}">${esc(d.name)}</div>
      <label class="o-f"><span>Fermentation</span><select data-action="assign" data-id="${d.id}">${opt(d.batch)}</select></label>
      <label class="o-f"><span>Mode</span><select data-action="plug-mode" data-id="${d.id}"><option value="auto" ${d.mode === 'auto' ? 'selected' : ''} ${d.batch ? '' : 'disabled'}>Auto (consigne)</option><option value="manuel" ${d.mode === 'manuel' ? 'selected' : ''}>Manuel</option></select></label>
      <button class="o-btn" data-action="toggle-plug" data-id="${d.id}" data-plugbtn="${d.id}" aria-pressed="${!!d.on}" aria-label="Prise ${d.slot} : allumer ou éteindre" ${d.online ? '' : 'disabled'}>${d.on ? 'ON' : 'OFF'}</button>
    </div>`).join('')}</div>`;
  return `<div class="ph"><div><h1>Appareils</h1><p>Sondes et prises remontées par Home Assistant</p></div>
    <div class="ph-actions"><button class="btn primary" data-action="add-dev">${IC.plus}Ajouter un appareil</button></div></div>
    <div class="kpis">
      <div class="card kpi"><div class="k">En ligne</div><div class="v num" data-live="kpi:online">${kpiVal('online')}</div><div class="s ${off ? 'bad' : 'ok'}">${off ? off + ' hors ligne' : 'Tous connectés'}</div></div>
      <div class="card kpi"><div class="k">Batterie faible</div><div class="v num">${low}</div><div class="s ${low ? 'warn' : 'ok'}">${low ? 'Sous 20 %' : 'Aucune alerte'}</div></div>
      <div class="card kpi"><div class="k">Prises allumées</div><div class="v num" data-live="kpi:heaters">${kpiVal('heaters')}</div><div class="s">Sur ${cnt('plug')} prises</div></div>
      <div class="card kpi"><div class="k">Puissance instantanée</div><div class="v num"><span data-live="kpi:power">${kpiVal('power')}</span><small>W</small></div><div class="s">Hystérésis auto ±${fmt(HYST, 1)} °C</div></div>
    </div>
    <section class="card">
      <div class="tabs" role="tablist">${[['all', 'Tous'], ['temp', 'Température'], ['hum', 'Humidité'], ['plug', 'Prises']].map(([k, l]) => `<button role="tab" data-action="dfilter" data-v="${k}" aria-selected="${devFilter === k}">${l}<span class="cnt num">${cnt(k)}</span></button>`).join('')}</div>
      ${devFilter === 'plug' ? strip : ''}
      ${devFilter === 'plug' ? '' : rows ? `<div class="tbl-wrap"><table class="data stack"><thead><tr><th>Appareil</th><th>Type</th><th>Mesure</th><th>Fermentation</th><th>Batterie</th><th>Dernière remontée</th><th>État</th><th class="r">Contrôle</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty"><strong>Aucun appareil de ce type</strong>Ajoutez-en un avec le bouton Ajouter un appareil.</div>'}
    </section>`;
}
function openAddDevice(){
  const act = S.batches.filter(b => b.status === 'active');
  const dlg = document.getElementById('dlg');
  dlg.innerHTML = `<form data-form="device" method="dialog"><div class="card-h"><h2>Ajouter un appareil</h2><button type="button" class="icon-btn bare" data-action="close-dlg" aria-label="Fermer">${IC.x}</button></div>
    <div class="card-b">
      <label class="field"><span>Nom</span><input type="text" name="name" placeholder="Ex. Sonde fût n° 2" required></label>
      <label class="field"><span>Type</span><select name="kind"><option value="temp">Sonde de température</option><option value="hum">Sonde d’humidité</option><option value="plug">Prise connectée</option></select></label>
      <label class="field"><span>Relier à</span><select name="batch"><option value="">Non relié</option>${act.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
    </div>
    <div class="foot"><button type="button" class="btn ghost" data-action="close-dlg">Annuler</button><button class="btn primary">Ajouter l’appareil</button></div></form>`;
  dlg.showModal(); dlg.querySelector('input').focus();
}


/* ---------- Archive ---------- */
let archType = 'all', archQuery = '';
const statsCache = new Map();
function setAt(b, t){
  const L = b.targets; if (!L || !L.length) return b.recipe.temp;
  let v = L[0][1]; for (const [tc, nv] of L) if (tc <= t) v = nv; return v;
}
function archStats(b){
  const key = b.id + ':' + b.end + ':' + (b.targets ? b.targets.length : 0);
  if (statsCache.has(key)) return statsCache.get(key);
  const r = b.recipe, tol = TYPES[r.type].tol / 2, end = b.end, span = end - b.start;
  const n = 160, pts = [], hum = [], pmin = [], pmax = [];
  let sum = 0, sq = 0, min = Infinity, max = -Infinity, inR = 0, hs = 0, hc = 0;
  const K = 40, raw = [];
  for (let i = 0; i <= n; i++){
    const t = b.start + span * i / n; let at = 0, ah = 0, hk = 0, lo = Infinity, hi = -Infinity;
    for (let k = 0; k < K; k++){
      const tt = Math.min(end, t + (k - K / 2) * span / n / K), m = model(b, tt);
      raw.push([tt, m.temp]); at += m.temp; lo = Math.min(lo, m.temp); hi = Math.max(hi, m.temp); sum += m.temp; sq += m.temp * m.temp;
      min = Math.min(min, m.temp); max = Math.max(max, m.temp);
      if (Math.abs(m.temp - setAt(b, tt)) <= tol) inR++;
      if (m.hum != null){ ah += m.hum; hk++; hs += m.hum; hc++; }
    }
    pts.push([t, at / K]); pmin.push([t, lo]); pmax.push([t, hi]); if (hk) hum.push([t, ah / hk]);
  }
  const N = (n + 1) * K, avg = sum / N, sd = Math.sqrt(Math.max(0, sq / N - avg * avg));
  inR = inR / N * (n + 1);
  // Chauffe : simulation de l'hystérésis sur toute la durée
  let heat = null;
  if ((b.devSnap || []).some(d => d.kind === 'plug')){
    let on = false, acts = 0, onMs = 0; const st = Math.max(5 * 60e3, span / 20000);
    for (let t = b.start; t < end; t += st){
      const tp = model(b, t).temp, tg = setAt(b, t);
      if (!on && tp < tg - HYST){ on = true; acts++; } else if (on && tp > tg + HYST) on = false;
      if (on) onMs += st;
    }
    heat = {acts, hours: onMs / HOUR, duty: onMs / span * 100};
  }
  // Agrégats journaliers (ou par 4 h si lot court)
  const bucket = span < 3 * DAY ? 4 * HOUR : span > 90 * DAY ? 7 * DAY : DAY;
  const daily = [];
  for (let t0 = b.start; t0 < end; t0 += bucket){
    const seg = raw.filter(p => p[0] >= t0 && p[0] < t0 + bucket); if (seg.length < 40) continue;
    const v = seg.map(p => p[1]);
    daily.push({t:t0 + bucket / 2, avg:v.reduce((a, c) => a + c, 0) / v.length, min:Math.min(...v), max:Math.max(...v)});
  }
  const s = {pts, pmin, pmax, hum, avg, sd, min, max, inRange: inR / (n + 1) * 100, humAvg: hc ? hs / hc : null, heat, daily, bucket, span};
  statsCache.set(key, s); return s;
}
function archResult(b){
  const r = b.recipe;
  if (r.type === 'biere' && b.gravity?.length){ const g = b.gravity.at(-1)[1]; return `${fmt(g, 3)}, ${fmt((r.og - g) * 131.25, 1)} %`; }
  if (r.type === 'koji'){ const s = archStats(b); return s.humAvg != null ? `${fmt(s.humAvg, 0)} % HR moy.` : '—'; }
  return r.salt ? `${fmt(r.salt, 0)} % sel` : '—';
}
function archive(){
  setCrumbs([['Archive']]);
  const all = S.batches.filter(b => b.status === 'done').sort((a, c) => c.end - a.end);
  let list = all;
  if (archType !== 'all') list = list.filter(b => b.recipe.type === archType);
  if (archQuery) list = list.filter(b => (b.name + ' ' + b.recipe.name).toLowerCase().includes(archQuery.toLowerCase()));
  const rows = list.map(b => {
    const T = TYPES[b.recipe.type], s = archStats(b), ir = s.inRange;
    return `<tr class="click" data-href="#/archive/${b.id}">
      <td class="first"><div class="nm">${esc(b.name)}</div><div class="sm">${esc(b.recipe.name)}</div></td>
      <td data-l="Type"><span class="type" style="--c:${T.c}"><i></i>${T.label}</span></td>
      <td data-l="Période" class="num">${fmtDate(b.start)} au ${fmtDateY(b.end)}</td>
      <td data-l="Durée" class="num">${fmtDur((b.end - b.start) / DAY)}</td>
      <td data-l="Temp. moyenne" class="num">${fmt(s.avg, 1)} °C <span class="sm">/ ${fmt(b.recipe.temp, 1)}</span></td>
      <td data-l="Dans la plage" class="num"><span class="badge ${ir >= 90 ? 'ok' : ir >= 70 ? 'warn' : 'bad'}">${fmt(ir, 0)} %</span></td>
      <td data-l="Résultat" class="r num">${archResult(b)}</td></tr>`;
  }).join('');
  return `<div class="ph"><div><h1>Archive</h1><p>Lots terminés, consultables en lecture seule</p></div></div>
    <section class="card">
      <div class="toolbar">
        <label class="search">${IC.search}<input type="search" id="asearch" placeholder="Rechercher un lot" value="${esc(archQuery)}" aria-label="Rechercher un lot archivé"></label>
        <span class="spacer"></span>
        <span class="seg"><button data-action="atype" data-v="all" aria-pressed="${archType === 'all'}">Tous</button>${Object.entries(TYPES).map(([k, T]) => `<button data-action="atype" data-v="${k}" aria-pressed="${archType === k}">${T.label}</button>`).join('')}</span>
      </div>
      ${rows ? `<div class="tbl-wrap"><table class="data stack"><thead><tr><th>Lot</th><th>Type</th><th>Période</th><th>Durée</th><th>Temp. moyenne</th><th>Dans la plage</th><th class="r">Résultat</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty"><strong>${all.length ? 'Aucun lot ne correspond aux filtres' : 'Aucun lot archivé'}</strong>${all.length ? '' : 'Un lot arrive ici quand vous cliquez sur Terminer le lot.'}</div>`}
    </section>`;
}
function archiveDetail(id){
  const b = S.batches.find(x => x.id === id && x.status === 'done');
  if (!b){ setCrumbs([['Archive', '#/archive'], ['Introuvable']]); return `<div class="card empty"><strong>Lot archivé introuvable</strong></div>`; }
  setCrumbs([['Archive', '#/archive'], [b.name]]);
  const r = b.recipe, T = TYPES[r.type], s = archStats(b), dur = (b.end - b.start) / DAY;
  const kp = [
    ['Durée totale', fmtDur(dur), `Prévue ${fmtDur(r.duration)}`],
    ['Température moyenne', `${fmt(s.avg, 1)}<small>°C</small>`, `Écart-type ${fmt(s.sd, 2)} °C`],
    ['Min / max', `${fmt(s.min, 1)} / ${fmt(s.max, 1)}<small>°C</small>`, `Amplitude ${fmt(s.max - s.min, 1)} °C`],
    ['Dans la plage', `${fmt(s.inRange, 0)}<small>%</small>`, `Consigne ±${fmt(TYPES[r.type].tol / 2, 1)} °C`],
  ];
  if (r.type === 'biere' && b.gravity?.length){
    const g = b.gravity.at(-1)[1];
    kp.push(['Densité finale', fmt(g, 3), `${fmt((r.og - g) * 131.25, 1)} % vol., att. ${fmt((r.og - g) / (r.og - 1) * 100, 0)} %`]);
  }
  if (s.humAvg != null) kp.push(['Humidité moyenne', `${fmt(s.humAvg, 0)}<small>%</small>`, `Cible ${r.hum} %`]);
  if (s.heat) kp.push(['Chauffe', `${fmt(s.heat.hours, 0)}<small>h</small>`, `${s.heat.acts} activations, ${fmt(s.heat.duty, 0)} % du temps`.replace(' du temps', '')]);

  const second = r.type === 'biere' && b.gravity?.length ? ['Densité', 'grav'] : r.type === 'koji' ? ['Humidité relative', 'hum'] : [s.bucket === 7 * DAY ? 'Températures par semaine' : s.bucket === DAY ? 'Températures par jour' : 'Températures par tranche de 4 h', 'daily'];
  const params = [['Recette', esc(r.name)], ['Durée prévue', fmtDur(r.duration)], ['Consigne finale', fmt(r.temp, 1) + ' °C']];
  if (b.targets && b.targets.length > 1) params.push(['Changements de consigne', String(b.targets.length - 1)]);
  if (r.type === 'biere') params.push(['Densité initiale', fmt(r.og, 3)], ['Densité finale visée', fmt(r.fg, 3)], ['Volume', (r.volume || '—') + ' L']);
  if (r.type === 'koji') params.push(['Humidité cible', r.hum + ' %']);
  if (r.salt) params.push(['Salinité', r.salt + ' %']);
  params.push(['Début', `${fmtDateY(b.start)}, ${fmtTime(b.start)}`], ['Fin', `${fmtDateY(b.end)}, ${fmtTime(b.end)}`]);
  if (b.devSnap?.length) params.push(['Appareils utilisés', b.devSnap.map(d => esc(d.name)).join('<br>')]);

  setTimeout(() => {
    const a = document.getElementById('arch-temp'), c = document.getElementById('arch-2');
    if (a){ a._cfg = () => archTempCfg(b); drawChart(a); }
    if (c){ c._cfg = () => archSecondCfg(b, second[1]); drawChart(c); }
    mountCharts();
  });
  const T2 = second[1] === 'hum' ? 'var(--accent)' : T.c;
  return `<div class="dp" style="--c:${T.c}">
    <div class="dp-head">
      <div class="dp-title"><h1>${esc(b.name)}</h1><span class="type"><i></i>${T.label}</span><span class="badge">Archivé</span>
        <span class="dp-sub num">Du ${fmtDateY(b.start)} au ${fmtDateY(b.end)}</span></div>
    </div>
    <div class="kpis compact">${kp.map(([k, v, x]) => `<div class="card kpi"><div class="k">${k}</div><div class="v num">${v}</div><div class="s num" title="${x}">${x}</div></div>`).join('')}</div>
    <div class="dp-grid arch">
      <section class="card dp-chart"><div class="card-h"><h2>Température sur toute la durée</h2><span class="muted num">${fmt(s.min, 1)} à ${fmt(s.max, 1)} °C</span></div>
        <div class="dp-chart-body"><div class="dp-plot"><div class="chart fill" id="arch-temp" data-chart></div>
          <div class="legend" style="--c:${T.c}"><span><i></i>Moyenne</span><span><i style="background:var(--faint)"></i>Min et max</span><span><i class="dash"></i>Consigne finale</span><span><i class="band"></i>Plage tolérée</span></div></div></div></section>
      <section class="card dp-journal scroll-card arch-2"><div class="card-h"><h2>${second[0]}</h2></div>
        <div class="dp-chart-body"><div class="dp-plot"><div class="chart fill" id="arch-2" data-chart></div>
          <div class="legend" style="--c:${T2}">${second[1] === 'daily' ? '<span><i></i>Moyenne</span><span><i style="background:var(--faint)"></i>Min et max</span>' : second[1] === 'grav' ? '<span><i></i>Relevés</span><span><i class="dash"></i>Densité visée</span>' : '<span><i></i>Humidité</span><span><i class="dash"></i>Cible</span>'}</div></div></div></section>
      <section class="card dp-devs scroll-card"><div class="card-h"><h2>Journal</h2><span class="muted num">${b.notes.length} notes</span></div>
        <ul class="notes journal scroll">${journalHTML(b, 'all')}</ul></section>
      <div class="dp-side">
        <section class="card scroll-card dp-params"><div class="card-h"><h2>Résumé de la recette</h2></div>
          <div class="scroll">
            ${r.desc ? `<p class="arch-desc">${esc(r.desc)}</p>` : ''}
            <dl class="kv num">${params.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
            <div class="arch-sub">Ingrédients</div>
            <dl class="kv">${r.ingredients.map(i => `<dt>${esc(i.n)}</dt><dd class="num">${esc(i.q)}</dd>`).join('')}</dl>
            <div class="arch-sub">Étapes</div>
            <ol class="steps">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
          </div></section>
      </div>
    </div>
  </div>`;
}
function archTempCfg(b){
  const s = archStats(b), r = b.recipe, tol = TYPES[r.type].tol / 2, c = TYPES[r.type].c, long = s.span > 2 * DAY;
  return {color:c, series:[{pts:s.pts, color:c, w:2}, {pts:s.pmax, color:'var(--faint)', w:1}, {pts:s.pmin, color:'var(--faint)', w:1}], band:[r.temp - tol, r.temp + tol], lines:[{y:r.temp, label:'consigne ' + fmt(r.temp, 1) + ' °C'}],
    yFmt:(v, st) => fmt(v, st < 1 ? 1 : 0) + '°', xFmt:t => long ? fmtDate(t) : fmtTime(t),
    tip:p => { const i = s.pts.findIndex(x => x[0] === p[0]); return `Moy. ${fmt(p[1], 1)} °C (${fmt(s.pmin[i][1], 1)} à ${fmt(s.pmax[i][1], 1)}), ${fmtDate(p[0])} ${fmtTime(p[0])}`; }, label:'Température archivée'};
}
function archSecondCfg(b, kind){
  const s = archStats(b), r = b.recipe, c = TYPES[r.type].c;
  if (kind === 'grav') return Object.assign(gravCfg(b), {x0:b.start, x1:b.end});
  if (kind === 'hum') return {color:'var(--accent)', series:[{pts:s.hum, color:'var(--accent)', area:true}], lines:[{y:r.hum, label:'cible ' + r.hum + ' %'}],
    yFmt:v => fmt(v, 0) + ' %', xFmt:fmtTime, tip:p => `${fmt(p[1], 0)} % HR, ${fmtDate(p[0])} ${fmtTime(p[0])}`, label:'Humidité archivée'};
  const f = s.bucket < DAY ? t => fmtTime(t) : t => fmtDate(t);
  return {color:c, series:[
      {pts:s.daily.map(d => [d.t, d.avg]), color:c, w:2},
      {pts:s.daily.map(d => [d.t, d.max]), color:'var(--faint)', w:1},
      {pts:s.daily.map(d => [d.t, d.min]), color:'var(--faint)', w:1}],
    lines:[{y:r.temp, label:'consigne'}], yFmt:(v, st) => fmt(v, st < 1 ? 1 : 0) + '°', xFmt:f,
    tip:p => { const d = s.daily.find(x => x.t === p[0]); return d ? `Moy. ${fmt(d.avg, 1)}, min ${fmt(d.min, 1)}, max ${fmt(d.max, 1)} °C` : ''; }, label:'Températures agrégées'};
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const tr = e.target.closest('tr[data-href]');
  if (tr && !e.target.closest('select,button,input,a')){ location.hash = tr.dataset.href; return; }
  const a = e.target.closest('[data-action]'); if (!a) return;
  const act = a.dataset.action, id = a.dataset.id;
  if (act === 'theme') return cycleTheme();
  if (act === 'range'){ detailRange = a.dataset.r; a.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === a)); drawChart(document.getElementById('chart-main')); return; }
  if (act === 'ctab'){ detailChart = a.dataset.v; render(); return; }
  if (act === 'finish'){
    if (!confirm('Terminer ce lot ? Il sera déplacé dans l’Archive et les appareils reliés seront libérés.')) return;
    const b = S.batches.find(x => x.id === id); b.status = 'done'; b.end = now();
    b.devSnap = devsOf(b).map(d => ({name:d.name, kind:d.kind}));
    S.devices.forEach(d => { if (d.batch === id){ d.batch = null; if (d.kind === 'plug') d.on = false; } });
    logEvent('batch', 'Lot terminé et archivé : ' + b.name, b.id); save(); location.hash = '#/archive/' + b.id; return;
  }
  if (act === 'delete-batch'){ if (!confirm('Supprimer définitivement ce lot ?')) return; S.batches = S.batches.filter(x => x.id !== id); save(); location.hash = '#/'; return; }
  if (act === 'jfilter'){ journalFilter = a.dataset.v; a.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === a)); const jl = document.getElementById('journal-list'); jl.innerHTML = jl._h = journalHTML(S.batches.find(x => x.id === jl.dataset.b)); return; }
  if (act === 'tstep'){ const inp = a.parentElement.querySelector('input'); inp.value = (Math.round(((parseFloat(inp.value) || 0) + parseFloat(a.dataset.d)) * 2) / 2).toString(); return; }
  if (act === 'rm-grav'){ const b = S.batches.find(x => x.id === id); b.gravity = b.gravity.filter(g => String(g[0]) !== a.dataset.t); save(); render(); return; }
  if (act === 'atype'){ archType = a.dataset.v; render(); return; }
  if (act === 'rtab'){ recipeTab = a.dataset.v; render(); return; }
  if (act === 'rtype'){ recipeType = a.dataset.v; render(); return; }
  if (act === 'dfilter'){ devFilter = a.dataset.v; render(); return; }
  if (act === 'add-ing'){ document.getElementById('ings').insertAdjacentHTML('beforeend', ingRow()); document.querySelector('#ings .rrow:last-child input').focus(); return; }
  if (act === 'add-step'){ const s = document.getElementById('steps'); s.insertAdjacentHTML('beforeend', stepRow('', s.children.length + 1)); s.querySelector('.rrow:last-child input').focus(); return; }
  if (act === 'rm-row'){ a.closest('.rrow').remove(); renumber(); return; }
  if (act === 'archive'){ const r = S.recipes.find(x => x.id === id); r.archived = !r.archived; save(); recipeTab = r.archived ? 'archivees' : 'actives'; location.hash = '#/recettes'; return; }
  if (act === 'launch'){
    const r = S.recipes.find(x => x.id === id), n = S.batches.filter(b => b.recipeId === id).length + 1;
    const b = {id:uid('b'), name:`${r.name} #${n}`, recipe:JSON.parse(JSON.stringify(r)), recipeId:r.id, start:now(), status:'active', notes:[], gravity:r.type === 'biere' ? [[now(), r.og]] : undefined};
    S.batches.push(b); logEvent('batch', 'Fermentation lancée : ' + b.name, b.id); save(); location.hash = '#/f/' + b.id; return;
  }
  if (act === 'add-dev') return openAddDevice();
  if (act === 'close-dlg') return document.getElementById('dlg').close();
  if (act === 'toggle-plug'){ const d = S.devices.find(x => x.id === id); if (!d.online) return; d.on = !d.on; d.mode = 'manuel'; const b = S.batches.find(x => x.id === d.batch && x.status === 'active'); logHeat(d, b, b ? currentTemp(b) : null, true); tick(); save(); render(); return; }
  if (act === 'rm-dev'){ const d = S.devices.find(x => x.id === id); if (!confirm(`Retirer « ${d.name} » ?`)) return; S.devices = S.devices.filter(x => x.id !== id); save(); render(); return; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-action="assign"]')){ const d = S.devices.find(x => x.id === t.dataset.id); d.batch = t.value || null; if (!d.batch && d.kind === 'plug') d.on = false; tick(); save(); render(); }
  if (t.matches('[data-action="plug-mode"]')){ const d = S.devices.find(x => x.id === t.dataset.id); d.mode = t.value; tick(); save(); render(); }
  if (t.name === 'type' && t.closest('#rform')) t.closest('#rform').dataset.type = t.value;
});
document.addEventListener('input', e => {
  if (e.target.id === 'asearch'){ archQuery = e.target.value; const pos = e.target.selectionStart; render(); const s = document.getElementById('asearch'); s.focus(); s.setSelectionRange(pos, pos); return; }
  if (e.target.id === 'rsearch'){ recipeQuery = e.target.value; const pos = e.target.selectionStart; render(); const s = document.getElementById('rsearch'); s.focus(); s.setSelectionRange(pos, pos); }
});
document.addEventListener('submit', e => {
  const f = e.target; e.preventDefault();
  const fd = new FormData(f);
  if (f.dataset.form === 'note'){ const b = S.batches.find(x => x.id === f.dataset.id); const x = fd.get('x').trim(); if (!x) return; b.notes.push({t:now(), x}); save(); render(); return; }
  if (f.dataset.form === 'gravity'){
    const b = S.batches.find(x => x.id === f.dataset.id); const g = parseFloat(String(fd.get('g')).replace(',', '.'));
    if (!(g > .98 && g < 1.2)) return;
    let t = new Date(fd.get('d')).getTime(); if (isNaN(t)) t = now(); t = Math.min(Math.max(t, b.start), now());
    b.gravity = (b.gravity || []).concat([[t, g]]).sort((a, c) => a[0] - c[0]); save(); render(); return;
  }
  if (f.dataset.form === 'target'){
    const b = S.batches.find(x => x.id === f.dataset.id); const v = parseFloat(String(fd.get('t')).replace(',', '.'));
    if (isNaN(v) || v < -5 || v > 100 || v === b.recipe.temp) return;
    if (!b.targets) b.targets = [[b.start, b.recipe.temp]];
    const from = b.recipe.temp; b.targets.push([now(), v]); b.recipe.temp = v;
    logEvent('target', `${b.name} : consigne modifiée de ${fmt(from, 1)} à ${fmt(v, 1)} °C`, b.id, {from, to:v});
    tick(); save(); render(); return;
  }
  if (f.dataset.form === 'device'){
    const name = fd.get('name').trim(); if (!name) return; const kind = fd.get('kind');
    const d = {id:uid(kind[0]), name, kind, batch:fd.get('batch') || null, online:true, seen:now()};
    if (kind === 'plug'){ d.mode = d.batch ? 'auto' : 'manuel'; d.on = false; const used = outlets().map(o => o.slot); const free = [1, 2, 3, 4, 5].find(s => !used.includes(s)); if (free) d.slot = free; } else d.battery = 100;
    S.devices.push(d); document.getElementById('dlg').close(); tick(); save(); render(); return;
  }
  if (f.id === 'rform'){
    const num = k => { const v = parseFloat(String(fd.get(k)).replace(',', '.')); return isNaN(v) ? null : v; };
    const name = fd.get('name').trim(), err = document.getElementById('ferr');
    if (!name){ err.textContent = 'Donnez un nom à la recette pour l’enregistrer.'; f.querySelector('[name=name]').focus(); return; }
    const duration = num('duration'), temp = num('temp');
    if (!duration || duration <= 0){ err.textContent = 'Indiquez une durée prévue supérieure à zéro.'; return; }
    if (temp == null){ err.textContent = 'Indiquez une température cible.'; return; }
    const type = fd.get('type'), ins = fd.getAll('in'), iqs = fd.getAll('iq');
    const r = {type, name, desc:fd.get('desc').trim(), duration, temp,
      ingredients:ins.map((n, i) => ({n:n.trim(), q:iqs[i].trim()})).filter(i => i.n),
      steps:fd.getAll('st').map(s => s.trim()).filter(Boolean)};
    if (type === 'biere'){ r.og = num('og'); r.fg = num('fg'); r.volume = num('volume'); }
    if (type === 'koji') r.hum = num('hum');
    if (type === 'miso' || type === 'garum') r.salt = num('salt');
    const id = f.dataset.id;
    if (id){ const o = S.recipes.find(x => x.id === id); Object.keys(o).forEach(k => { if (!['id', 'archived'].includes(k)) delete o[k]; }); Object.assign(o, r); }
    else S.recipes.push({id:uid('r'), archived:false, ...r});
    save(); recipeTab = 'actives'; location.hash = '#/recettes';
  }
});

/* ---------- Theme ---------- */
const themes = ['auto', 'light', 'dark'];
let theme = 'auto'; try { theme = localStorage.getItem('hakko-theme') || 'auto'; } catch(e) {}
function applyTheme(){
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = theme;
  const b = document.getElementById('themeBtn'); b.innerHTML = theme === 'auto' ? IC.auto : theme === 'light' ? IC.sun : IC.moon;
  b.title = theme === 'auto' ? 'Thème automatique' : theme === 'light' ? 'Thème clair' : 'Thème sombre';
}
function cycleTheme(){ theme = themes[(themes.indexOf(theme) + 1) % 3]; try { localStorage.setItem('hakko-theme', theme); } catch(e) {} applyTheme(); document.querySelectorAll('[data-chart]').forEach(drawChart); }

/* ---------- Boot ---------- */
document.querySelectorAll('.brand-mark').forEach(e => e.innerHTML = MARK);
applyTheme();
tick();
render();
refreshLive();
setInterval(() => { tick(); save(); refreshLive(); }, 3000);

