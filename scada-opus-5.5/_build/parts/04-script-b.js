































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
