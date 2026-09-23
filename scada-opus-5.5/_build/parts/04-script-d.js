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
