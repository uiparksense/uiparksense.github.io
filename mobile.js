/* V5.3 Mobile UX. Uses existing map details, never duplicates or changes database. */
(()=>{'use strict';
const $=id=>document.getElementById(id), mq=matchMedia('(max-width:760px)'), sheet=$('mobileZoneSheet53'), more=$('mobileMoreSheet53'), details=$('mapDetail'), shell=$('mapShell'), preview=$('mobileMapPreview53'), dock=document.querySelector('.mobile-dock53'), guest=$('guest');
if(!sheet||!more||!details||!dock)return;
let previous=null,active='beranda';
function update(){const title=details.querySelector('.detail-title h3'), status=details.querySelector('.status,.status-pill,.badge');preview.disabled=!title;$('mobileMapName53').textContent=title?.textContent||'Pilih zona pada peta';$('mobileMapStatus53').textContent=status?.textContent||'';const counts=$('liveState').textContent.match(/^(\d+) zona · diperbarui/);$('mobileZoneCount53').textContent=document.body.classList.contains('data-unavailable')?'—':counts?.[1]||'—';}
function openDetail(){if(!mq.matches||guest.hidden||preview.disabled)return false;if(more.open)more.close();if(sheet.open)return true;previous=document.activeElement; $('mobileSheetBody53').append(details);sheet.showModal();document.body.classList.add('mobile-sheet-open53');sheet.querySelector('[data-close]').focus({preventScroll:true});return true;}
function restore(){if(details.parentElement!==shell)shell.append(details);document.body.classList.remove('mobile-sheet-open53');if(mq.matches&&!guest.hidden){if(previous?.isConnected&&previous.getClientRects().length)previous.focus({preventScroll:true});else if(preview.getBoundingClientRect().top>=0&&preview.getBoundingClientRect().bottom<=innerHeight)preview.focus({preventScroll:true});}previous=null;}
sheet.addEventListener('close',restore);preview.onclick=openDetail;
$('mobileMore53').onclick=()=>{if(!mq.matches||guest.hidden||more.open)return;more.showModal();document.body.classList.add('mobile-menu-open53');$('mobileMore53').setAttribute('aria-expanded','true');};
more.addEventListener('close',()=>{document.body.classList.remove('mobile-menu-open53');$('mobileMore53').setAttribute('aria-expanded','false');});
more.addEventListener('click',e=>{if(e.target.closest('a,button[data-open-admin]'))more.close();},true);
function setActive(section){active=section;const moreActive=['info','bantuan','tentang'].includes(section);const button=$('mobileMore53');button.classList.toggle('active',moreActive);if(moreActive)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');let current=dock.querySelector('.active');if(current){dock.style.setProperty('--dock-index',Array.from(dock.children).indexOf(current));}}
const toggle=$('facultyLayout53');toggle.onclick=()=>{const swipe=toggle.getAttribute('aria-pressed')!=='true';toggle.setAttribute('aria-pressed',String(swipe));toggle.textContent=swipe?'Tampilan daftar':'Tampilan geser';$('shortcuts').classList.toggle('mobile-swipe53',swipe);$('shortcuts').scrollLeft=0;updateFacultyLabel();};
function updateFacultyLabel(){const caption=document.querySelector('#fakultas .carousel-head>span');if(caption)caption.textContent=mq.matches&&toggle.getAttribute('aria-pressed')!=='true'?'14 fakultas · lihat semua untuk daftar lengkap':'14 fakultas · geser untuk menjelajahi';}
mq.addEventListener('change',()=>{if(!mq.matches){if(sheet.open)sheet.close();if(more.open)more.close();restore();}setActive(active);updateFacultyLabel();});
new MutationObserver(()=>{if(guest.hidden){if(sheet.open)sheet.close();if(more.open)more.close();}}).observe(guest,{attributes:true,attributeFilter:['hidden']});
new MutationObserver(update).observe($('liveState'),{childList:true,characterData:true,subtree:true});
window.ParkSenseMobile={update,openDetail,setActive};update();setActive('beranda');updateFacultyLabel();
})();