/* UI ParkSense V4.6 — Vehicle First. Guest UI only; leaves Supabase and admin untouched. */
'use strict';
window.ParkSenseV46 = (() => {
  const LIMIT = 6;
  let shown = LIMIT;
  let filterSignature = '';
  const selectionKey = 'parksense-v46-vehicle-choice';
  const prefer = () => state.vehicle === 'mobil' ? 'mobil' : 'motor';
  const label = () => prefer() === 'mobil' ? 'mobil' : 'motor';
  const iconName = () => prefer() === 'mobil' ? 'car' : 'motorcycle';

  function syncSwitch() {
    document.querySelectorAll('[data-ps46-switch]').forEach(b => {
      const active = b.dataset.ps46Switch === prefer();
      b.classList.toggle('active',active);
      b.setAttribute('aria-pressed',String(active));
    });
    const listLabel = document.getElementById('ps46ListVehicleLabel');
    if(listLabel) listLabel.textContent = label();
    const title = document.getElementById('ps46CarouselTitle');
    if(title) title.textContent = `Jelajahi parkiran ${label()}`;
  }
  function validCoords(z) { return Number.isFinite(z.lat) && Number.isFinite(z.lng); }
  function mainStatus(z) { return status(z,prefer()); }
  function vacancy(z) { const available=free(z,prefer()); return available===null?'Belum dihitung':`${nf(available)} slot kosong`; }
  function miniCard(z){
    const st=mainStatus(z);const pending=free(z,prefer())===null;
    return `<article class="ps46-carousel-card" aria-label="${safe(z.name)}">
     <div class="ps46-carousel-art"><img src="${makaraSrc(z.code)}" alt="Makara fakultas" loading="lazy"><span class="ps46-art-vehicle">${miniSvg(iconName())}</span></div>
     <div class="ps46-carousel-info"><div class="ps46-carousel-top"><span class="ps46-faculty">${safe(facultyFor(z))}</span><span class="status-badge ${st}">${statusName(st)}</span></div>
     <h4>${safe(z.name)}</h4><p class="ps46-note">${safe(prefer()==='motor'?'Sepeda motor':'Mobil')} · kapasitas ${nf(cap(z,prefer()))}</p>
     <div class="ps46-vacancy ${pending?'pending':''}">${safe(vacancy(z))}</div>
     <div class="ps46-carousel-actions"><button type="button" data-ps46-detail="${safe(z.id)}">Lihat detail ↗</button>${validCoords(z)?`<a href="${safe(coordsHref(z))}" rel="noopener noreferrer" target="_blank">Petunjuk arah ↗</a>`:''}</div></div></article>`;
  }
  function simpleCard(z){const s=mainStatus(z), pending=free(z,prefer())===null;
    return `<article class="ps46-simple-card" aria-label="${safe(z.name)}: ${statusName(s)}">
      <div class="ps46-simple-top"><div class="ps46-simple-title"><img src="${makaraSrc(z.code)}" alt="" loading="lazy"><div><small>${safe(facultyFor(z))} · ${safe(prefer()==='motor'?'Motor':'Mobil')}</small><h4>${safe(z.name)}</h4></div></div><span class="status-badge ${s}">${statusName(s)}</span></div>
      <div class="ps46-simple-bottom"><b class="${pending?'pending':''}">${safe(vacancy(z))}</b><button type="button" data-ps46-detail="${safe(z.id)}">Detail ↗</button></div>
    </article>`;
  }
  function syncControls(track){
    const prev=document.getElementById('ps46CarouselPrev'),next=document.getElementById('ps46CarouselNext');if(!prev||!next||!track)return;
    prev.disabled=track.scrollLeft<8;
    next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-8;
  }
  function drawCards() {
    const zs = filtered();
    const counter = document.getElementById('resultCounter');
    if (counter) counter.textContent = `${zs.length} lokasi`;
    const signature = JSON.stringify([prefer(),state.facultyFilter,state.query,state.status,state.sort,zs.map(x=>String(x.id)).join(',')]);
    if(signature!==filterSignature){shown=LIMIT;filterSignature=signature;}
    syncSwitch();
    const track=document.getElementById('ps46CarouselTrack');
    if(track){track.innerHTML=zs.length?zs.map(miniCard).join(''):'<div class="ps46-none">Belum ada lokasi yang sesuai dengan pencarianmu.</div>';syncControls(track);}
    const list=document.getElementById('parkingCards');
    if(list){list.innerHTML=zs.length?zs.slice(0,shown).map(simpleCard).join(''):'<div class="ps46-none">Tidak ada lokasi untuk filter ini. Coba pilih status atau fakultas lain.</div>';}
    const more=document.getElementById('ps46MoreWrap');
    if(more)more.classList.toggle('hidden',shown>=zs.length);
    const shownCounter=document.getElementById('ps46ShownCounter');
    if(shownCounter)shownCounter.textContent=zs.length?`${Math.min(shown,zs.length)} dari ${zs.length} lokasi`:'0 lokasi';
  }
  function saveChoice(value) {try {sessionStorage.setItem(selectionKey,value);}catch(_){}}
  function restoreChoice(){try{const v=sessionStorage.getItem(selectionKey);return ['motor','mobil','all'].includes(v)?v:null;}catch(_){return null;}}
  function closeWelcome(){const modal=document.getElementById('ps46Welcome');if(modal){modal.classList.add('hidden');document.body.classList.remove('ps46-welcome-open');}}
  function chooseVehicle(value,scroll=false){
    if(!['motor','mobil'].includes(value))return;
    state.vehicle=value;
    state.facultyFilter='all';
    const zs=mappedZones();
    if(!zs.some(z=>String(z.id)===String(state.selected)))state.selected=zs[0]?.id||null;
    state.status='all';const statusFilter=document.getElementById('statusFilter');if(statusFilter)statusFilter.value='all';
    saveChoice(value);closeWelcome();
    renderGuest();
    if(scroll)showGuest('daftar');
    else if(!$('adminView').classList.contains('hidden'))showGuest('beranda');
  }
  function init(){
    const welcome=document.getElementById('ps46Welcome');
    if(!welcome)return;
    const remembered=restoreChoice();
    if(remembered==='motor'||remembered==='mobil'){state.vehicle=remembered;renderGuest();}
    else if(!document.location.hash.includes('petugas')){welcome.classList.remove('hidden');document.body.classList.add('ps46-welcome-open');welcome.focus();}
    welcome.addEventListener('click',e=>{const b=e.target.closest('[data-ps46-choose]');if(b)chooseVehicle(b.dataset.ps46Choose,false);});
    document.getElementById('ps46BrowseAll')?.addEventListener('click',()=>{saveChoice('all');closeWelcome();showGuest('daftar');});
    document.getElementById('ps46AdminAccess')?.addEventListener('click',()=>{closeWelcome();openAdmin();});
    document.querySelectorAll('[data-ps46-switch]').forEach(btn=>btn.addEventListener('click',()=>chooseVehicle(btn.dataset.ps46Switch,false)));
    document.querySelectorAll('[data-vehicle]').forEach(btn=>btn.addEventListener('click',()=>{saveChoice(btn.dataset.vehicle);syncSwitch();}));
    document.getElementById('ps46MoreBtn')?.addEventListener('click',()=>{shown+=LIMIT;drawCards();});
    document.getElementById('ps46CarouselPrev')?.addEventListener('click',()=>{const track=$('ps46CarouselTrack');track?.scrollBy({left:-(track.clientWidth*.76),behavior:'smooth'});});
    document.getElementById('ps46CarouselNext')?.addEventListener('click',()=>{const track=$('ps46CarouselTrack');track?.scrollBy({left:(track.clientWidth*.76),behavior:'smooth'});});
    document.getElementById('ps46CarouselTrack')?.addEventListener('scroll',()=>syncControls($('ps46CarouselTrack')),{passive:true});
    document.getElementById('guestView')?.addEventListener('click',e=>{const b=e.target.closest('[data-ps46-detail]');if(b)chooseZone(b.dataset.ps46Detail,true);});
    syncSwitch();
  }
  window.addEventListener('DOMContentLoaded',init);
  return {drawCards,chooseVehicle};
})();
