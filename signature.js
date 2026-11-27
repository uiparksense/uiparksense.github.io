/* V5.4 — presentation-only feedback. Never interpolates or writes occupancy. */
(()=>{'use strict';
const mq=matchMedia('(prefers-reduced-motion: reduce)'), guest=document.getElementById('guest');
const busyIds=['shortcuts','availabilityStrip','zoneGrid','newsGrid','mapDetail'];
const syncBusy=()=>{const busy=document.body.classList.contains('data-loading54');for(const id of busyIds)document.getElementById(id)?.setAttribute('aria-busy',String(busy));};
function entries(vehicle){const result=new Map();const add=(prefix,els)=>els.forEach((el,i)=>result.set(`${vehicle}|${prefix}|${i}`,el));
 document.querySelectorAll('#zoneGrid [data-zone]').forEach(c=>add('zone:'+c.dataset.zone,c.querySelectorAll('.zone-metrics strong')));
 document.querySelectorAll('#shortcuts [data-faculty]').forEach(c=>add('faculty:'+c.dataset.faculty,c.querySelectorAll('.faculty-card-stats b')));
 const d=document.getElementById('mapDetail'), code=d?.querySelector('.detail-kicker')?.textContent;if(code)add('detail:'+code,[...d.querySelectorAll('.detail-values b')].slice(0,4));
 add('summary',document.querySelectorAll('#availabilityStrip strong'));return result;
}
function capture(vehicle){return new Map([...entries(vehicle)].map(([k,el])=>[k,el.textContent.trim()]));}
const numeric=s=>/^±?\s*\d[\d.,]*(?:\s+(?:motor|mobil)|%)?$/i.test(s||'');
const value=s=>Number(s.replace(/[^\d]/g,''));
function animate(before,vehicle){if(!before||mq.matches||document.hidden||guest?.hidden)return;for(const [key,el] of entries(vehicle)){const old=before.get(key),next=el.textContent.trim();if(old===next||!numeric(old)||!numeric(next))continue;const r=el.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue;const dir=value(next)>=value(old)?1:-1;el.dataset.motionUpdated='true';const a=el.animate?.([{opacity:.55,transform:`translateY(${dir*5}px)`},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.22,.8,.22,1)'});if(a)a.finished.catch(()=>{}).finally(()=>delete el.dataset.motionUpdated);else delete el.dataset.motionUpdated;}}
window.ParkSenseSignature={capture,animate,syncBusy};
})();
