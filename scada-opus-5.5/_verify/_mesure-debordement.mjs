import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const b=await puppeteer.launch({executablePath:EDGE,headless:'shell',args:['--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
for (const [w,h] of [[1440,860],[1280,720],[1600,900],[1366,768]]) {
  const p=await b.newPage();
  await p.setViewport({width:w,height:h});
  await p.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
  await p.goto('http://127.0.0.1:8812/hakko-dashboard.html#/archive/b0',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,3600));
  const m=await p.evaluate(()=>{
    const svg=document.querySelector('#arch-2 svg');
    const fill=document.querySelector('#arch-2');
    const plot=document.querySelector('.dp-plot');
    const corps=document.querySelector('.dp-chart-body');
    const grille=document.querySelector('.dp-archive, .dp');
    const r=e=>e?{y:+e.getBoundingClientRect().top.toFixed(1),bas:+e.getBoundingClientRect().bottom.toFixed(1),h:+e.getBoundingClientRect().height.toFixed(1),debord:getComputedStyle(e).overflow,debordY:getComputedStyle(e).overflowY}:null;
    return {svg:r(svg),fill:r(fill),plot:r(plot),corps:r(corps),conteneurPage:r(grille),
            svgAttr:{w:svg?.getAttribute('width'),h:svg?.getAttribute('height')},
            scrollDoc:document.documentElement.scrollHeight-document.documentElement.clientHeight,
            debordSvg:+(svg.getBoundingClientRect().bottom-fill.getBoundingClientRect().bottom).toFixed(1)};
  });
  console.log(`${w}x${h}`, JSON.stringify(m));
  await p.close();
}
await b.close();
