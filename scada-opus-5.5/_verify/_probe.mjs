import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'shell', args:['--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
const p = await b.newPage();
await p.setViewport({width:1440,height:860});
await p.goto('http://127.0.0.1:8811/_verify/reference-original.html', {waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,3500));
console.log(JSON.stringify(await p.evaluate(()=>({titre:document.title, tuiles:document.querySelectorAll('[data-href]').length, scroll:document.documentElement.scrollHeight-document.documentElement.clientHeight, h1:document.querySelector('h1')?.textContent})), null, 1));
await b.close();
