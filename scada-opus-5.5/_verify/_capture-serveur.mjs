import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const b=await puppeteer.launch({executablePath:EDGE,headless:'shell',args:['--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
for (const [url,nom,w,h] of [['http://192.168.1.51:8090/','accueil-serveur',1200,1000],['http://192.168.1.51:8090/hakko-dashboard.html','dashboard-serveur',1920,1000]]) {
  const p=await b.newPage(); await p.setViewport({width:w,height:h});
  await p.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
  const err=[]; p.on('pageerror',e=>err.push(e.message));
  const r=await p.goto(url,{waitUntil:'networkidle0'});
  await new Promise(x=>setTimeout(x,3400));
  const m=await p.evaluate(()=>({titre:document.title, h1:document.querySelector('h1')?.textContent, tuiles:document.querySelectorAll('.lots .lot').length, vide:document.querySelector('.content')?+(innerWidth-document.querySelector('.content').getBoundingClientRect().right).toFixed(0):null}));
  console.log(url,'→ HTTP',r.status(),JSON.stringify(m),err.length?('ERREURS:'+err.join('|')):'aucune erreur JS');
  await p.screenshot({path:`captures-serveur/${nom}.png`});
  await p.close();
}
await b.close();
