import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ROUTES=['#/','#/f/b1','#/archive','#/archive/b0','#/recettes','#/recettes/new','#/appareils'];
const b=await puppeteer.launch({executablePath:EDGE,headless:'shell',args:['--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
for (const [w,h] of [[1920,1000],[2560,1200]]) {
 for (const route of ROUTES) {
  const p=await b.newPage();
  await p.setViewport({width:w,height:h});
  await p.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
  const err=[]; p.on('pageerror',e=>err.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push(m.text())});
  await p.goto('http://127.0.0.1:8812/hakko-dashboard.html'+route,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,3400));
  const m=await p.evaluate(()=>{
    const c=document.querySelector('.content');
    let debord=0, fautif='';
    document.querySelectorAll('#view *').forEach(e=>{const cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden')return; const q=e.getBoundingClientRect(); if(!q.width||!q.height)return; const par=e.parentElement; if(!par)return; const pc=getComputedStyle(par); if(pc.overflowX!=='visible'&&pc.overflowX!=='hidden')return; const d=q.right-par.getBoundingClientRect().right; if(d>1&&d>debord){debord=+d.toFixed(1); fautif=e.className||e.tagName;}});
    return {vide:+(innerWidth-c.getBoundingClientRect().right).toFixed(0), scrollX:document.documentElement.scrollWidth-document.documentElement.clientWidth, scrollY:document.documentElement.scrollHeight-document.documentElement.clientHeight, debordDroite:debord, fautif:String(fautif).slice(0,40), tableaux:document.querySelectorAll('table.data').length, prises:document.querySelectorAll('.outlet').length};
  });
  console.log(`${w}x${h} ${route}`.padEnd(26), JSON.stringify(m), err.length?('ERREURS:'+err.join('|').slice(0,80)):'');
  await p.close();
 }
}
// captures pour contrôle visuel
const p=await b.newPage(); await p.setViewport({width:1920,height:1000}); await p.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
for (const [route,nom] of [['#/','accueil'],['#/appareils','appareils'],['#/recettes','recettes'],['#/f/b1','detail']]) {
  await p.goto('http://127.0.0.1:8812/hakko-dashboard.html'+route,{waitUntil:'networkidle0'}); await new Promise(r=>setTimeout(r,3400));
  await p.screenshot({path:`captures-largeur/apres1920_${nom}.png`});
}
await b.close();
