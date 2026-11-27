/* V4.9.1: detail page automatically refreshes when a published news entry changes.
   Only published announcements are selected; private drafts are never read. */
'use strict';
window.addEventListener('DOMContentLoaded',async()=>{
  const $=id=>document.getElementById(id);
  const id=new URLSearchParams(location.search).get('id');
  if(!id || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)){
    $('articleState').textContent='Pengumuman tidak ditemukan. Kembali ke daftar pengumuman.';return;
  }
  const config=window.PARKSENSE_CONFIG;
  if(!window.supabase?.createClient||!config?.supabaseUrl||!config?.supabaseAnonKey){
    $('articleState').textContent='Koneksi informasi belum tersedia.';return;
  }
  const client=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey);
  let request=0,delay=null;
  async function refreshArticle(){
    const token=++request;
    try{
      const {data,error}=await client.from('parking_announcements')
        .select('id,title,body,category,zone_code,status,image_path,published_at,expires_at')
        .eq('id',id).eq('status','published').maybeSingle();
      if(token!==request)return;
      if(error)throw error;
      if(!data || (data.expires_at&&Date.parse(data.expires_at)<=Date.now()))throw Error('Tidak tersedia');
      $('title').textContent=data.title||'Pengumuman parkir';
      $('body').textContent=data.body||'';
      $('meta').textContent=[data.category,data.zone_code,data.published_at?new Date(data.published_at).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'}):''].filter(Boolean).join('  •  ');
      const cover=$('cover');cover.replaceChildren();
      if(data.image_path&&/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp)$/i.test(data.image_path)){
        const img=new Image();img.alt='Foto pengumuman parkir';img.src=client.storage.from('parksense-announcements').getPublicUrl(data.image_path).data.publicUrl;cover.append(img);
      }else{const span=document.createElement('span');span.textContent='UI ParkSense';cover.append(span);}
      $('article').hidden=false;$('articleState').hidden=true;
    }catch(err){
      if(token!==request)return;
      $('article').hidden=true;$('articleState').hidden=false;
      $('articleState').textContent='Pengumuman sudah tidak tersedia, telah diarsipkan, atau belum bisa dimuat. Kembali ke Info Parkir UI untuk melihat berita terbaru.';
    }
  }
  const refreshSoon=()=>{
    if(document.hidden)return;
    clearTimeout(delay);
    delay=setTimeout(()=>refreshArticle().catch(()=>{}),120);
  };
  await refreshArticle();
  client.channel('parksense-news-detail-v491')
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'parking_news_signal'},refreshSoon)
    .subscribe(status=>{if(status==='SUBSCRIBED')refreshSoon();});
  // Jaring pengaman bila koneksi WebSocket dihalangi/diputus.
  setInterval(refreshSoon,30000);
  window.addEventListener('focus',refreshSoon);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSoon();});
});
