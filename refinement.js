/* V5.2 Motion Atlas — no backend access, no scroll interception. */
(()=>{'use strict';
const root=document.documentElement,guest=document.getElementById('guest'),hero=document.getElementById('beranda'),art=hero?.querySelector('.hero-art>img'),fill=document.getElementById('motionWaveFill'),line=document.getElementById('motionWaveLine');
if(!guest||!hero||!fill||!line)return;
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),small=matchMedia('(max-width: 650px)');
const clamp=x=>Math.max(0,Math.min(1,x));
// Same cubic topology, interpolated continuously across three silhouettes.
const shapes=[[14,14,55,38,18,52,36,10,8,16],[7,64,6,28,62,4,42,63,5,33],[32,8,60,38,4,57,26,2,52,18]];
function curve(a){return `M0 ${a[0]} C180 ${a[1]} 260 ${a[2]} 445 ${a[3]} C650 ${a[4]} 750 ${a[5]} 900 ${a[6]} C1080 ${a[7]} 1250 ${a[8]} 1440 ${a[9]}`;}
const initial=curve(shapes[0]);
const header=document.querySelector('.header'),bridges=[...guest.querySelectorAll('[data-bridge]')];
const sections=[...guest.querySelectorAll('.folder-body > section:not(.hero), :scope > footer')];
const headings=[...guest.querySelectorAll('.section-copy, .bulletin-heading, #supportHeading, .support-intro, .footer-grid')];
const panels=[...guest.querySelectorAll('.carousel-head, .map-toolbar05, .availability-strip, .filters, .faq-panel, .feedback-panel')];
const grids=['shortcuts','zoneGrid','newsGrid'].map(id=>document.getElementById(id)).filter(Boolean);
const seen=new Set();let io=null,mo=null,raf=0,active=false,heroVisible=true,lastP=-1;
const cardSelector='.faculty-card,.zone-long,.news-card';
function key(el){if(el.dataset.faculty)return 'f:'+el.dataset.faculty;if(el.dataset.zone)return 'z:'+el.dataset.zone;const n=el.querySelector('[data-read-news]');return n?'n:'+n.dataset.readNews:null;}
function observeCards(grid){if(!io)return;grid.querySelectorAll(cardSelector).forEach((el,i)=>{const k=key(el);if(k&&seen.has(k))return;el.style.setProperty('--motion-delay',`${Math.min(i%4,3)*65}ms`);io.observe(el);});}
function draw(){raf=0;if(!active||reduce.matches||document.hidden)return;const hidden=guest.hidden||guest.getClientRects().length===0||document.body.classList.contains('live-workspace-open')||document.body.classList.contains('ops-open');if(hidden){root.style.setProperty('--atlas-page-progress','0');return;}
const scrollY=window.scrollY,max=Math.max(1,root.scrollHeight-innerHeight),page=clamp(scrollY/max),rect=hero.getBoundingClientRect();
// Read layout before writing. Only visible heading tracks are updated.
const bridgeUpdates=[];for(const b of bridges){const r=b.getBoundingClientRect();if(r.bottom>=-100&&r.top<=innerHeight+100)bridgeUpdates.push([b,clamp((innerHeight*.94-r.top)/(innerHeight*.48+Math.min(r.height,100)))]);}
const updates=[];for(const section of sections){const r=section.getBoundingClientRect();if(r.bottom>=-60&&r.top<=innerHeight+60){const p=clamp((innerHeight*.90-r.top)/(Math.min(r.height,innerHeight*.80)+innerHeight*.30));updates.push([section,p]);}}
root.style.setProperty('--atlas-page-progress',page.toFixed(4));
header?.classList.toggle('is-compact',scrollY>55);for(const [b,p] of bridgeUpdates)b.style.setProperty('--atlas-bridge-progress',p.toFixed(3));
const progress=clamp((Math.max(0,-rect.top)+Math.max(0,innerHeight-rect.bottom)*.10)/Math.max(1,rect.height*.87));
if(rect.bottom>=-80||heroVisible){if(Math.abs(progress-lastP)>.001){const n=progress*2,k=Math.min(1,Math.floor(n)),t=n-k;const eased=t*t*(3-2*t);const values=shapes[k].map((x,i)=>(x+(shapes[k+1][i]-x)*eased).toFixed(2));const d=curve(values);fill.setAttribute('d',d+' L1440 70 L0 70 Z');line.setAttribute('d',d);hero.style.setProperty('--atlas-drift',`${(progress*(small.matches?13:38)).toFixed(2)}px`);hero.style.setProperty('--atlas-zoom',(1.035+progress*.055).toFixed(4));hero.style.setProperty('--atlas-sign-drift',`${(-progress*12).toFixed(2)}px`);lastP=progress;}heroVisible=rect.bottom>=-80;}
for(const [s,p] of updates)s.style.setProperty('--atlas-section-progress',p.toFixed(3));}
function queue(){if(active&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
function stop(){active=false;root.classList.remove('atlas-motion');if(raf)cancelAnimationFrame(raf);raf=0;io?.disconnect();mo?.disconnect();io=mo=null;window.removeEventListener('scroll',queue);window.removeEventListener('resize',queue);document.removeEventListener('visibilitychange',queue);guest.querySelectorAll('.atlas-enter,.atlas-card-enter').forEach(e=>e.classList.remove('atlas-enter','atlas-card-enter'));root.style.removeProperty('--atlas-page-progress');hero.style.removeProperty('--atlas-drift');hero.style.removeProperty('--atlas-zoom');hero.style.removeProperty('--atlas-sign-drift');sections.forEach(s=>s.style.removeProperty('--atlas-section-progress'));bridges.forEach(b=>b.style.removeProperty('--atlas-bridge-progress'));header?.classList.remove('is-compact');fill.setAttribute('d',initial+' L1440 70 L0 70 Z');line.setAttribute('d',initial);lastP=-1;}
function start(){stop();if(reduce.matches)return;active=true;root.classList.add('atlas-motion');heroVisible=true;
if('IntersectionObserver'in window){io=new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting)continue;const el=e.target;io.unobserve(el);if(!active||reduce.matches||!el.isConnected)continue;const k=key(el);if(k){if(seen.has(k))continue;seen.add(k);el.classList.add('atlas-card-enter');}else{el.classList.add('atlas-enter');}}},{threshold:.12,rootMargin:'0px 0px -12px 0px'});[...headings,...panels].forEach(el=>io.observe(el));grids.forEach(observeCards);if('MutationObserver'in window){mo=new MutationObserver(records=>{for(const r of records){for(const el of r.removedNodes)if(el.nodeType===1){io.unobserve(el);el.querySelectorAll?.(cardSelector).forEach(c=>io.unobserve(c));}observeCards(r.target);}queue();});grids.forEach(g=>mo.observe(g,{childList:true}));}}
window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',queue,{passive:true});document.addEventListener('visibilitychange',queue);queue();}
reduce.addEventListener?.('change',start);small.addEventListener?.('change',()=>{lastP=-1;queue();});start();
})();

/* V5.2.5: scroll-driven folder silhouette. Only decorative elements move; no
   transform or clipping of maps, interactive controls, or card containers. */
(()=>{'use strict';
const guest=document.getElementById('guest'),folders=[...document.querySelectorAll('#guest .folder-scene')];
if(!guest||!folders.length)return;
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),clamp=x=>Math.max(0,Math.min(1,x));
const base=[4,16,7,3,24,108,125,132,18,139,29,146];
const raised=[2,12,4,1,20,116,132,139,14,146,28,153];
function shape(p){const a=base.map((v,i)=>(v+(raised[i]-v)*p).toFixed(2));return `M0 42 L${a[0]} ${a[1]} Q${a[2]} ${a[3]} ${a[4]} ${a[3]} H${a[5]} Q${a[6]} ${a[3]} ${a[7]} ${a[8]} L${a[9]} ${a[10]} Q${a[11]} 42 164 42 Z`;}
let raf=0;function draw(){raf=0;if(reduce.matches||document.hidden||guest.hidden||!guest.getClientRects().length)return;
const vh=innerHeight,read=folders.map(f=>[f,f.getBoundingClientRect()]);let active=null;let best=-Infinity;
for(const [f,r] of read){const visible=Math.min(r.bottom,vh)-Math.max(r.top,0);if(visible>0&&visible>best){best=visible;active=f;} if(r.bottom< -100||r.top>vh+120)continue;const t=clamp((vh*.92-r.top)/(vh*.75));const e=t*t*(3-2*t); f.style.setProperty('--folder-progress',e.toFixed(3));const stack=clamp((vh*.94-r.top)/(vh*.40));f.style.setProperty('--signature-stack',(stack*stack*(3-2*stack)).toFixed(3));f.querySelector('.folder-tab-shape').setAttribute('d',shape(e));}
for(const f of folders)f.classList.toggle('folder-in-focus',f===active);}
function queue(){if(!reduce.matches&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
function sync(){if(raf)cancelAnimationFrame(raf);raf=0;window.removeEventListener('scroll',queue);window.removeEventListener('resize',queue);document.removeEventListener('visibilitychange',queue);if(reduce.matches){folders.forEach(f=>{f.style.removeProperty('--folder-progress');f.style.removeProperty('--signature-stack');f.classList.remove('folder-in-focus');f.querySelector('.folder-tab-shape').setAttribute('d',shape(0));});return;}window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',queue,{passive:true});document.addEventListener('visibilitychange',queue);queue();}
reduce.addEventListener?.('change',sync);sync();})();
