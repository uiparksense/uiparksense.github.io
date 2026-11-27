/* UI ParkSense V4.9.1 — Info Parkir UI + live news signal. Only PUBLIC published rows are rendered. */
'use strict';
window.ParkSenseV48 = (() => {
  let sb=null;
  let items=[];
  let schemaAvailable=false;
  let liveClient=null,liveChannel=null,pollTimer=null,refreshTimer=null;
  let latestRequest=0;
  function setLiveStatus(message){const el=$id('ps48LiveStatus');if(el)el.textContent=message;}
  function refreshSoon(delay=150){
    if(!sb || document.hidden)return;
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{
      loadAnnouncements().catch(err=>console.warn('Pembaruan berita:',err.message));
      // Daftar petugas juga diperbarui bila panel berita sedang terbuka.
      const panel=$id('ps47-panel-berita');
      if(panel && !panel.classList.contains('hidden'))window.ParkSenseNewsV49?.load?.(true);
    },delay);
  }
  function ensureRealtime(client){
    if(!client || client===liveClient)return;
    if(liveChannel && liveClient)liveClient.removeChannel(liveChannel).catch(()=>{});
    liveClient=client;
    // Hanya sinyal publik (revision), tanpa isi berita/draft privat.
    liveChannel=client.channel('parksense-news-live-v491')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'parking_news_signal'},()=>refreshSoon(120))
      .subscribe(status=>{
        if(status==='SUBSCRIBED'){
          setLiveStatus('● Pembaruan berita langsung aktif');
          refreshSoon(50); // Tangkap perubahan saat koneksi sempat terputus.
        }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
          setLiveStatus('● Pengecekan berita berkala aktif');
        }
      });
    if(!pollTimer)pollTimer=setInterval(()=>refreshSoon(0),30000);
  }
  const $id=id=>document.getElementById(id);
  const categories=new Set(['Penutupan','Renovasi','Jam operasional','Pengumuman']);
  const safeText=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function pictureUrl(path){
    if(!path || !sb)return null;
    // Storage paths only: no arbitrary remote URL from DB.
    if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp)$/i.test(path))return null;
    return sb.storage.from('parksense-announcements').getPublicUrl(path).data.publicUrl;
  }
  const formatDate=d=>d?new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}):'Tanggal belum tersedia';
  const active=(row)=>row.status==='published' && (!row.expires_at||new Date(row.expires_at).getTime()>Date.now());
  function card(row){
    const category=categories.has(row.category)?row.category:'Pengumuman';
    const label=row.zone_code||'Area parkir UI';
    const img=pictureUrl(row.image_path);
    const url='info-parkir-detail.html?id='+encodeURIComponent(row.id);
    return `<article class="ps48-card"><div class="ps48-card-img">${img?`<img src="${safeText(img)}" alt="Foto pengumuman parkir" loading="lazy">`:'<svg class="ui-icon" aria-hidden="true"><use href="#ps-message"></use></svg>'}</div><div class="ps48-card-body"><div class="ps48-card-badges"><span class="ps48-card-tag">${safeText(category)}</span><span class="ps48-card-tag ps48-card-zone">${safeText(label)}</span></div><h4>${safeText(row.title)}</h4><p class="ps48-card-summary">${safeText(row.summary||row.body.slice(0,145)+(row.body.length>145?'…':''))}</p><span class="ps48-card-meta">${safeText(formatDate(row.published_at))}</span><a class="ps48-card-more" href="${url}">Informasi lebih lanjut <span aria-hidden="true">↗</span></a></div></article>`;
  }
  function render(){
    const q=($id('ps48NewsSearch')?.value||'').trim().toLocaleLowerCase('id-ID');
    const c=$id('ps48NewsCategory')?.value||'all';
    const list=items.filter(active).filter(r=>(c==='all'||r.category===c)&&(!q||[r.title,r.summary,r.body,r.zone_code].some(v=>String(v||'').toLocaleLowerCase('id-ID').includes(q))));
    $id('ps48NewsCount').textContent=`${list.length} pengumuman`;
    $id('ps48NewsCards').innerHTML=list.map(card).join('');
    const empty=$id('ps48NewsEmpty'); empty.hidden=Boolean(list.length);
    if(!list.length){
      empty.querySelector('h4').textContent=!schemaAvailable?'Fitur berita sedang disiapkan':items.length?'Tidak ada hasil yang cocok':'Belum ada pengumuman parkir';
      empty.querySelector('p').textContent=!schemaAvailable?'Halaman sudah siap. Berita akan tersedia setelah penyimpanan dan publikasi Supabase diaktifkan pada tahap berikutnya.':items.length?'Coba kata kunci atau kategori lain.':'Belum ada pengumuman yang diterbitkan petugas. Kamu tetap bisa melihat informasi parkir dari peta dan daftar lokasi.';
    }
  }
  async function loadAnnouncements(client){
    if(client)sb=client;
    if(!sb){render();return;}
    ensureRealtime(sb);
    const request=++latestRequest;
    try{
      const {data,error}=await sb.from('parking_announcements')
        .select('id,title,summary,body,category,zone_id,zone_code,status,image_path,published_at,expires_at')
        .eq('status','published').order('published_at',{ascending:false}).limit(60);
      if(request!==latestRequest)return; // Hindari respons lama menimpa pembaruan terbaru.
      if(error)throw error;
      schemaAvailable=true;
      items=Array.isArray(data)?data:[];
    }catch(err){
      if(request!==latestRequest)return;
      const text=String(err?.message||'');
      schemaAvailable=false;items=[];
      if(!/PGRST205|42P01|not find|does not exist|relation .* not exist/i.test(text))console.warn('Info Parkir UI:',text);
    }
    render();
  }
  window.addEventListener('DOMContentLoaded',()=>{
    $id('ps48NewsSearch')?.addEventListener('input',render);
    $id('ps48NewsCategory')?.addEventListener('change',render);
    window.addEventListener('focus',()=>refreshSoon(0));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSoon(0);});
    window.addEventListener('pageshow',()=>refreshSoon(0));
    document.querySelectorAll('[data-ps48-go-parking]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();window.showGuest?window.showGuest('daftar'):document.getElementById('daftar')?.scrollIntoView({behavior:'smooth'});}));
    render();
  });
  return {loadAnnouncements,render};
})();
