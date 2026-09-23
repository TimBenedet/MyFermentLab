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

