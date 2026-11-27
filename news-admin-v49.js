/* UI ParkSense V4.9 — Pengumuman petugas. Tidak mengubah kapasitas atau kendaraan. */
'use strict';
window.ParkSenseNewsV49=(()=>{
 const $=id=>document.getElementById(id);
 const get=()=>window.ParkSenseNewsContext?.()||{};
 const cats=new Set(['Penutupan','Renovasi','Jam operasional','Pengumuman']);
 const validImage=new Set(['image/jpeg','image/png','image/webp']);
 const MIME_EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 let rows=[],busy=false,loadedFor=null,lastLoad=0,objectUrl=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function show(text,error=false){const el=$('ps49Notice');if(!el)return;el.textContent=text;el.classList.toggle('ps49-error',error);}
 function uuid(){if(!window.crypto?.randomUUID)throw Error('Unggah gambar memerlukan HTTPS browser terbaru.');return crypto.randomUUID();}
 function imgUrl(path,client){if(!path||!client||!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(path))return null;return client.storage.from('parksense-announcements').getPublicUrl(path).data.publicUrl;}
 function date(v){return v?new Date(v).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}):'—';}
 function contextReady(){const c=get();return Boolean(c.client&&c.user?.id&&c.assignments?.length);}
 function setBusy(value){busy=value;for(const id of ['ps49SaveDraft','ps49Publish','ps49Reload','ps49Clear']){const b=$(id);if(b)b.disabled=value;} }
 function populateZone(){const sel=$('ps47NewsZone'),c=get();if(!sel||!c.zones)return;const current=sel.value;
   const zs=c.zones.filter(z=>z.public_visible===true && !(c.zones||[]).some(q=>q.code?.startsWith(z.code+'-')));
   sel.innerHTML='<option value="">Pilih zona yang Anda kelola</option>'+zs.map(z=>`<option value="${esc(z.id)}">${esc(z.code)} — ${esc(z.name)}</option>`).join('');
   if(zs.some(z=>String(z.id)===String(current)))sel.value=current;
 }
 function displayRows(){const el=$('ps49NewsList');if(!el)return;
   if(!rows.length){el.innerHTML='<p class="ps49-empty">Belum ada berita yang tersimpan untuk zona Anda. Buat berita pertama menggunakan formulir di atas.</p>';return;}
   el.innerHTML=rows.map(r=>`<article class="ps49-news-item"><div class="ps49-news-item-main"><div class="ps49-news-item-meta"><span>${esc(r.category)}</span><span>${esc(r.zone_code)}</span><span class="ps49-status ps49-${esc(r.status)}">${esc(r.status==='published'?'Terbit':r.status==='archived'?'Arsip':'Draft')}</span></div><strong>${esc(r.title)}</strong><small>Diubah: ${esc(date(r.updated_at))}</small></div><div class="ps49-item-actions"><button type="button" data-ps49-edit="${esc(r.id)}">Edit</button>${r.status!=='archived'?`<button type="button" class="ps49-archive" data-ps49-archive="${esc(r.id)}">Arsipkan</button>`:''}</div></article>`).join('');
 }
 async function load(force=false){const c=get();if(!contextReady()){rows=[];displayRows();show('Login dengan akun petugas yang ditugaskan untuk mengelola berita.');return;}
   if(busy&&!force)return;
   if(!force&&loadedFor===c.user.id&&Date.now()-lastLoad<8000)return;
   try{show('Memuat berita zona Anda…');const {data,error}=await c.client.from('parking_announcements').select('id,zone_id,zone_code,title,summary,body,category,status,image_path,expires_at,published_at,updated_at').in('zone_id',c.assignments).order('updated_at',{ascending:false}).limit(100);
      if(error)throw error;const owned=new Set(c.assignments.map(String));rows=(data||[]).filter(r=>owned.has(String(r.zone_id)));loadedFor=c.user.id;lastLoad=Date.now();displayRows();show(`${rows.length} pengumuman dapat dikelola. Pilih berita untuk mengedit atau buat berita baru.`);
   }catch(e){rows=[];displayRows();show('Berita belum dapat dimuat: '+(e.message||'Periksa SQL 17 dan koneksi Supabase.'),true);}
 }
 function clearPreview(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}$('ps47NewsPreview')?.classList.add('hidden');}
 function reset(){const form=$('ps47NewsDraftForm');if($('ps47NewsZone'))$('ps47NewsZone').disabled=false;form?.reset();if($('ps49NewsId'))$('ps49NewsId').value='';clearPreview();populateZone();show('Siap membuat pengumuman baru.');}
 function resetSession(){rows=[];loadedFor=null;lastLoad=0;displayRows();reset();}
 function collect(){const f=$('ps47NewsDraftForm');if(!f?.reportValidity())throw Error('Lengkapi formulir pengumuman.');const c=get();if(!contextReady())throw Error('Silakan login sebagai petugas.');
   const zone=$('ps47NewsZone').value;const z=c.zones.find(z=>String(z.id)===String(zone)&&z.public_visible===true);
   if(!z)throw Error('Pilih zona yang benar-benar ditugaskan ke akun Anda.');
   const title=$('ps47NewsTitle').value.trim(),summary=$('ps49NewsSummary').value.trim(),body=$('ps47NewsBody').value.trim(),category=$('ps47NewsCategory').value,expiresInput=$('ps49NewsExpiry').value;
   if(title.length<8||title.length>100||body.length<20||body.length>3000||summary.length>200||!cats.has(category))throw Error('Panjang teks atau kategori tidak valid.');
   let expires_at=null;
   if(expiresInput){const d=new Date(expiresInput);if(!Number.isFinite(d.getTime())||d.getTime()<=Date.now())throw Error('Berlaku sampai harus lebih lambat dari waktu sekarang.');expires_at=d.toISOString();}
   const file=$('ps47NewsImage').files?.[0]||null;
   if(file&&(!validImage.has(file.type)||file.size>5242880||file.size===0))throw Error('Unggah JPG/PNG/WebP maksimal 5 MB.');
   const id=$('ps49NewsId').value||null;
   return {id,zone_id:zone,title,summary:summary||body.slice(0,170)+(body.length>170?'…':''),body,category,expires_at,file};
 }
 function preview(){try{const data=collect();const zone=get().zones.find(z=>String(z.id)===String(data.zone_id));
   $('ps47PreviewMeta').textContent=data.category+' · '+zone.name+' · Pratinjau lokal';$('ps47PreviewTitle').textContent=data.title;$('ps47PreviewBody').textContent=data.body;
   const media=$('ps47PreviewMedia');media.replaceChildren();clearPreview();
   if(data.file){objectUrl=URL.createObjectURL(data.file);const img=new Image();img.src=objectUrl;img.alt='Pratinjau gambar pengumuman';media.append(img);}
   else if(data.id){const row=rows.find(r=>String(r.id)===String(data.id));const u=imgUrl(row?.image_path,get().client);if(u){const img=new Image();img.src=u;img.alt='Foto pengumuman';media.append(img);}else{const span=document.createElement('span');span.textContent='Tanpa gambar';media.append(span);}}
   else{const span=document.createElement('span');span.textContent='Tanpa gambar';media.append(span);}
   $('ps47NewsPreview').classList.remove('hidden');$('ps47NewsPreview').scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(e){show(e.message,true);}}
 async function save(status){if(busy)return;let values;try{values=collect();if(status==='published'&&!confirm('Publikasikan berita ini ke halaman Info Parkir UI untuk semua pengunjung?'))return;}catch(e){show(e.message,true);return;}
   const c=get();setBusy(true);show(status==='published'?'Menerbitkan pengumuman…':'Menyimpan draft…');
   try{
     const existing=values.id?rows.find(r=>String(r.id)===String(values.id)):null;
     if(values.id&&!existing)throw Error('Berita yang sedang diedit tidak ditemukan di daftar milik akun Anda.');
     if(existing&&String(existing.zone_id)!==String(values.zone_id))throw Error('Zona berita tidak dapat diganti. Buat berita baru untuk zona lainnya.');
     let image_path=existing?.image_path||null;
     if(values.file){const ext=MIME_EXT[values.file.type];const path=`${c.user.id}/${uuid()}.${ext}`;
       const {error:uploadError}=await c.client.storage.from('parksense-announcements').upload(path,values.file,{contentType:values.file.type,upsert:false,cacheControl:'3600'});
       if(uploadError)throw new Error('Upload gambar gagal: '+uploadError.message);
       image_path=path;
     }
     const payload={zone_id:values.zone_id,title:values.title,summary:values.summary,body:values.body,category:values.category,expires_at:values.expires_at,status,image_path};
     let response;
     if(existing){delete payload.zone_id;response=await c.client.from('parking_announcements').update(payload).eq('id',existing.id).eq('zone_id',existing.zone_id).select('id').single();}
     else response=await c.client.from('parking_announcements').insert(payload).select('id').single();
     if(response.error)throw response.error;
     show(status==='published'?'Pengumuman berhasil dipublikasikan.':'Draft berhasil disimpan.');
     $('ps49NewsId').value=response.data.id;
     loadedFor=null;lastLoad=0;
     await load(true);
     await window.ParkSenseV48?.loadAnnouncements?.(c.client);
     show(status==='published'?'Pengumuman berhasil dipublikasikan.':'Draft berhasil disimpan.');
   }catch(e){show('Gagal menyimpan: '+(e.message||'Coba lagi.')+'. Jika gambar sempat terunggah, file lama tetap disimpan untuk audit.',true);}
   finally{setBusy(false);}
 }
 async function archive(id){if(busy)return;const row=rows.find(r=>String(r.id)===String(id));if(!row||!confirm('Arsipkan pengumuman ini? Berita tidak lagi ditampilkan kepada pengunjung.'))return;
   const c=get();setBusy(true);try{const {data,error}=await c.client.from('parking_announcements').update({status:'archived'}).eq('id',row.id).eq('zone_id',row.zone_id).select('id').single();if(error)throw error;
     loadedFor=null;lastLoad=0;await load(true);await window.ParkSenseV48?.loadAnnouncements?.(c.client);show('Pengumuman berhasil diarsipkan.');
   }catch(e){show('Arsip gagal: '+e.message,true);}finally{setBusy(false);}
 }
 function edit(id){const row=rows.find(r=>String(r.id)===String(id));if(!row)return;
   $('ps49NewsId').value=row.id;$('ps47NewsZone').value=row.zone_id;$('ps47NewsZone').disabled=true;
   $('ps47NewsTitle').value=row.title;$('ps49NewsSummary').value=row.summary||'';$('ps47NewsCategory').value=row.category;$('ps47NewsBody').value=row.body;
   $('ps49NewsExpiry').value=row.expires_at?new Date(new Date(row.expires_at).getTime()-new Date(row.expires_at).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
   $('ps47NewsImage').value='';clearPreview();show('Mengedit '+row.zone_code+' · '+row.status+'. Kosongkan gambar jika tidak ingin menggantinya.');$('ps47NewsTitle').focus();$('ps47NewsTitle').scrollIntoView({behavior:'smooth',block:'center'});
 }
 function onOpen(){populateZone();if(!contextReady()){show('Silakan login untuk mengelola berita.');return;}load(false);}
 function wire(){const form=$('ps47NewsDraftForm');form?.addEventListener('submit',e=>{e.preventDefault();save('draft');});
   $('ps49Preview')?.addEventListener('click',preview);$('ps49SaveDraft')?.addEventListener('click',()=>save('draft'));
   $('ps49Publish')?.addEventListener('click',()=>save('published'));
   $('ps49Clear')?.addEventListener('click',()=>{$('ps47NewsZone').disabled=false;reset();});
   $('ps49Reload')?.addEventListener('click',()=>{lastLoad=0;load(true);});
   $('ps49NewsList')?.addEventListener('click',e=>{const a=e.target.closest('[data-ps49-edit],[data-ps49-archive]');if(!a)return;
     if(a.dataset.ps49Edit)edit(a.dataset.ps49Edit);if(a.dataset.ps49Archive)archive(a.dataset.ps49Archive);});
 }
 document.addEventListener('DOMContentLoaded',wire);
 return {onOpen,resetSession,load};
})();
