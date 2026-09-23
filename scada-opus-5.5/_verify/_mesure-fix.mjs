import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const b=await puppeteer.launch({executablePath:EDGE,headless:'shell',args:['--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
for (const [nom,url] of [['livrable','http://127.0.0.1:8812/hakko-dashboard.html'],['copie-corrigee','http://127.0.0.1:8811/_verify/fix-densite.html']]) {
  for (const [w,h] of [[1280,720],[1440,860]]) {
    const p=await b.newPage();
    await p.setViewport({width:w,height:h});
    await p.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
    await p.goto(url+'#/archive/b0',{waitUntil:'networkidle0'});
    await new Promise(r=>setTimeout(r,3600));
    const m=await p.evaluate(()=>{
      const svg=document.querySelector('#arch-2 svg'), fill=document.querySelector('#arch-2');
      const leg=document.querySelector('#arch-2')?.closest('.dp-plot')?.querySelector('.legend');
      const rb=e=>e?e.getBoundingClientRect():null;
      const a=rb(svg), f=rb(fill), l=rb(leg);
      const chevauchement = a && l ? Math.max(0, Math.min(a.bottom,l.bottom)-Math.max(a.top,l.top)) : 0;
      return {hauteurSvg:+a.height.toFixed(1), hauteurParent:+f.height.toFixed(1), debordement:+(a.bottom-f.bottom).toFixed(1),
              chevauchementLegende:+chevauchement.toFixed(1), scrollDoc:document.documentElement.scrollHeight-document.documentElement.clientHeight};
    });
    console.log(`${nom} ${w}x${h}`, JSON.stringify(m));
    if (w===1280) await p.screenshot({path:`captures-fix/${nom}_1280x720.png`, clip:{x:270,y:490,width:420,height:230}});
    await p.close();
  }
}
await b.close();
