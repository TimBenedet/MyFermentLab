import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CIBLES={avant:'http://127.0.0.1:8812/hakko-dashboard.html', apres:'http://127.0.0.1:8811/_verify/essai-pleine-largeur.html'};
const ROUTES=['#/','#/f/b1','#/archive/b0'];
const b=await puppeteer.launch({executablePath:EDGE,headless:'shell',args:['--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
for (const [nom,url] of Object.entries(CIBLES)) {
 for (const [w,h] of [[1440,860],[1656,915],[1920,1000],[2560,1200],[3440,1400]]) {
  for (const route of ROUTES) {
    const p=await b.newPage();
    await p.setViewport({width:w,height:h});
    await p.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
    await p.goto(url+route,{waitUntil:'networkidle0'});
    await new Promise(r=>setTimeout(r,3400));
    const m=await p.evaluate(()=>{
      const r=e=>{const x=e.getBoundingClientRect();return +x.right.toFixed(0)};
      const c=document.querySelector('.content'), vue=document.querySelector('#view');
      const svg=document.querySelector('#view .chart svg, #view .dp-plot svg, #view .chart.fill svg');
      let debord=0;
      document.querySelectorAll('#view *').forEach(e=>{const cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden')return; const q=e.getBoundingClientRect(); if(!q.width||!q.height)return; const par=e.parentElement; if(!par)return; const pc=getComputedStyle(par); if(pc.overflowX!=='visible'&&pc.overflowX!=='hidden')return; if(q.right-par.getBoundingClientRect().right>1) debord=Math.max(debord,+(q.right-par.getBoundingClientRect().right).toFixed(1));});
      return {contentDroite:r(c), viewDroite:r(vue), vide:+(innerWidth-r(c)).toFixed(0), scrollX:document.documentElement.scrollWidth-document.documentElement.clientWidth, scrollY:document.documentElement.scrollHeight-document.documentElement.clientHeight, debordDroite:debord, tuiles:document.querySelectorAll('.lots .lot').length};
    });
    console.log(`${nom} ${w}x${h} ${route}`.padEnd(30), JSON.stringify(m));
    if (w===1920 && nom==='apres' && route==='#/') await p.screenshot({path:`captures-largeur/apres_1920x1000_accueil.png`});
    if (w===1920 && route==='#/' && nom==='avant') await p.screenshot({path:`captures-largeur/avant_1920x1000_accueil.png`});
    await p.close();
  }
 }
}
await b.close();
