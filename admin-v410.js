'use strict';
/* UI ParkSense V4.10: satu grup fakultas, satu kartu setiap zona. */
window.ParkSenseAdminV410=(()=>{
 const code=z=>facultyCodeOf(z)||String(z.code||'LAINNYA').split('-')[0];
 const children=(z,zs)=>[...state.zones,...zs].some(x=>String(x.code).startsWith(String(z.code)+'-'));
 function group(zs){
  const all=new Map();
  for(const z of zs){
   const key=code(z);
   if(!all.has(key))all.set(key,{code:key,name:FACULTIES.find(x=>x.code===key)?.name||z.faculty||key,zones:[],legacy:[]});
   const isOld=children(z,zs);
   all.get(key)[isOld?'legacy':'zones'].push(z);
  }
  return [...all.values()];
 }
 const header=g=>'<header class="ps410-faculty"><img src="'+makaraSrc(g.code)+'" alt="" width="44" height="44"><div><small>FAKULTAS / KAWASAN</small><h3>'+safe(g.name)+'</h3><p>'+nf(g.zones.length)+' zona tugas</p></div></header>';
 const legacy=g=>g.legacy.length?'<details class="ps410-legacy" data-ps410-panel="old:'+safe(g.code)+'"><summary>'+nf(g.legacy.length)+' zona gabungan lama · lihat informasi</summary><p>Ditampilkan terpisah agar tidak ada pencatatan ganda. Data tidak dihapus.</p>'+g.legacy.map(z=>'<p><b>'+safe(z.code)+'</b> · '+safe(capacityLabel(z))+(z.operational&&z.counts_initialized?' · aktif di database, minta pengelola meninjau':' · belum beroperasi')+'</p>').join('')+'</details>':'';
 const label=z=>String(z.code)===code(z)||/^area fakultas/i.test(String(z.name))?'Zona gabungan '+code(z):z.name;
 function vehicle(g,zs){
  return '<section class="ps410-group">'+header(g)+'<div class="ps410-cards">'+g.zones.map(z=>{
   const pending=z.__preview||z.operational===false||z.counts_initialized===false;
   const form=genericZoneActivationMarkup(z);
   return '<article class="admin-zone ps410-zone '+(pending?'preview-zone':'')+'"><div class="admin-zone-head"><div class="admin-zone-title"><img class="admin-faculty-logo" src="'+makaraSrc(z.code)+'" alt="" width="45" height="45"><div><h3>'+safe(label(z))+'</h3><small>'+safe(vehicleLabel(z))+'</small></div></div><span class="ps410-status '+(pending?'pending':'')+'">'+(pending?'Belum beroperasi':'Aktif')+'</span></div><p class="ps410-code">Zona '+safe(z.code)+'</p>'+(children(z,zs)?'<p class="ps410-note">Zona gabungan ini punya zona rincian. Hindari penghitungan ganda.</p>':'')+drawCounter(z,'motor')+drawCounter(z,'mobil')+(form?'<details class="ps410-activation" data-ps410-panel="activate:'+safe(z.id)+'"><summary>Aktivasi zona · isi hitungan awal</summary>'+form+'</details>':'')+((pending&&/^(FMIPA|FEB)-/.test(z.code))?'<p class="ps410-note">Aktivasi dilakukan bersama lewat panel fakultas di atas.</p>':'')+'<div class="admin-foot"><span>Terakhir diperbarui</span><strong>'+(pending?'Belum beroperasi':safe(localTime(z.updated_at)))+'</strong></div></article>';
  }).join('')+'</div>'+legacy(g)+'</section>';
 }
 function capacity(g,zs){
  return '<section class="ps410-group">'+header(g)+'<div class="ps410-cards">'+g.zones.map(z=>
   '<article class="ps47-capacity-card"><div class="ps47-capacity-heading"><img src="'+makaraSrc(z.code)+'" alt="" width="42" height="42"><div><small>'+safe(z.code)+'</small><h3>'+safe(label(z))+'</h3><p>'+safe(vehicleLabel(z))+'</p></div></div><div class="ps47-capacity-values"><span>Motor: <strong>'+nf(cap(z,'motor'))+'</strong></span><span>Mobil: <strong>'+nf(cap(z,'mobil'))+'</strong></span></div>'+(children(z,zs)?'<p class="ps410-note">Ubah kapasitas pada zona rinciannya.</p>':capacityEditorMarkup(z)||'<p class="ps47-unavailable">Belum tersedia untuk zona ini.</p>')+'</article>'
  ).join('')+'</div>'+legacy(g)+'</section>';
 }
 function capture(){
  const open=new Set([...document.querySelectorAll('#adminView details[open][data-ps410-panel]')].map(x=>x.dataset.ps410Panel)),drafts=new Map();
  document.querySelectorAll('#adminView form').forEach(f=>{
   const id=f.id||f.dataset.activateZone||f.dataset.updateCapacity;
   if(id)drafts.set(id,[...f.querySelectorAll('input[name],textarea[name],select[name]')].map(el=>({name:el.name,value:el.value,checked:el.checked,initial:el.defaultValue})));
  });
  return {open,drafts};
 }
 function restore(prev){
  document.querySelectorAll('#adminView details[data-ps410-panel]').forEach(x=>{if(prev.open.has(x.dataset.ps410Panel))x.open=true;});
  document.querySelectorAll('#adminView form').forEach(f=>{
   const id=f.id||f.dataset.activateZone||f.dataset.updateCapacity;
   const draft=prev.drafts.get(id)||[];
   // Hindari input kapasitas lama setelah hasil perubahan dari database dimuat.
   const fresh=[...f.querySelectorAll('input[name],textarea[name],select[name]')];
   if(f.dataset.updateCapacity && draft.some(item=>{
    const el=fresh.find(x=>x.name===item.name);
    return el && el.type!=='checkbox' && el.defaultValue!==item.initial;
   }))return;
   for(const item of draft){
    const el=fresh.find(x=>x.name===item.name);
    if(el){if(el.type==='checkbox'||el.type==='radio')el.checked=item.checked;else el.value=item.value;}
   }
  });
 }
 return {group,vehicle,capacity,capture,restore};
})();
