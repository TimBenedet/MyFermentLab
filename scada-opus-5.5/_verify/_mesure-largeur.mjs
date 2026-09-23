import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const b=await puppeteer.launch({executablePath:EDGE,headless:'shell',args:['--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
for (const [w,h] of [[1656,915],[1920,1000],[2560,1200],[1440,860],[1680,1050]]) {
  const p=await b.newPage();
  await p.setViewport({width:w,height:h});
  await p.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
  await p.goto('http://127.0.0.1:8812/hakko-dashboard.html',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,3400));
  const m=await p.evaluate(()=>{
    const g=s=>document.querySelector(s);
    const rb=e=>{const r=e.getBoundingClientRect();return {g:+r.left.toFixed(0),d:+r.right.toFixed(0),w:+r.width.toFixed(0)}};
    const c=g('.content'), app=g('.app'), side=g('.side'), vue=g('#view'), home=g('.home-grid');
    return {fenetre:innerWidth, app:rb(app), side:rb(side), content:rb(c), contentMaxW:getComputedStyle(c).maxWidth,
            vue:rb(vue), home:rb(home), colonnesLot:getComputedStyle(g('.lots')).gridTemplateColumns.split(' ').length,
            videADroite: +(innerWidth - rb(app).d).toFixed(0), defilement:document.documentElement.scrollHeight-document.documentElement.clientHeight};
  });
  console.log(`${w}x${h}`, JSON.stringify(m));
  if (w===1656) await p.screenshot({path:'captures-largeur/1656x915.png'});
  await p.close();
}
await b.close();
