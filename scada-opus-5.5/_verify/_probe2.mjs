import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'shell', args:['--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
const p = await b.newPage();
await p.setViewport({width:1440,height:860});
await p.goto('http://127.0.0.1:8812/hakko-dashboard.html', {waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,3500));
console.log(JSON.stringify(await p.evaluate(()=>({
  h1: document.querySelector('.ph h1')?.textContent,
  kpis: [...document.querySelectorAll('.kpi')].map(k=>k.textContent.replace(/\s+/g,' ').trim().slice(0,60)),
  tuiles: document.querySelectorAll('.lot').length,
  cartes: document.querySelectorAll('.card').length,
  cles: Object.keys(localStorage),
  err: window.__err||null
})), null, 1));
await b.close();
