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
