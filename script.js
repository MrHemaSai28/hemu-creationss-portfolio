const hero = document.querySelector('.hero');
const heroWrap = document.querySelector('.hero-wrap');
const track = document.querySelector('.person-track');
const typing = document.querySelector('#heroTyping');
const mode = document.querySelector('#mode');
const heroNo = document.querySelector('#heroNo');
const pops = [...document.querySelectorAll('.skill-pop')];

/* HERO PERFORMANCE PASS — preserve the exact V12-style two-screen composition,
   but keep the scroll path to one compositor-friendly transform.
   The previous version read layout on every scroll frame and updated 10+ CSS
   variables plus 3-D/filter state on the large cutout tree. */
const words = ['visuals.', 'stories.', 'ideas.', 'experiences.'];
let wi = 0, typeTimer;
function typeWord(){
  clearInterval(typeTimer);
  const word = words[wi]; let i = 0;
  typing.classList.add('is-changing');
  setTimeout(() => typing.classList.remove('is-changing'), 150);
  typing.textContent = '';
  typeTimer = setInterval(() => {
    typing.textContent = word.slice(0, ++i);
    if(i >= word.length){ clearInterval(typeTimer); setTimeout(() => eraseWord(word), 900); }
  }, 72);
}
function eraseWord(word){
  let i = word.length;
  typing.classList.add('is-changing');
  typeTimer = setInterval(() => {
    typing.textContent = word.slice(0, --i);
    if(i <= 0){ clearInterval(typeTimer); wi = (wi + 1) % words.length; setTimeout(typeWord, 180); }
  }, 38);
}
typeWord();

let heroStart = 0;
let heroRange = 1;
let heroTravel = innerWidth <= 680 ? 34 : 58;
let heroLastProgress = -1;
let heroLastSecond = null;

function measureHero(){
  if(!heroWrap || !hero || !track) return;
  const rect = heroWrap.getBoundingClientRect();
  heroStart = rect.top + scrollY;
  heroRange = Math.max(1, heroWrap.offsetHeight - innerHeight);
  heroTravel = innerWidth <= 680 ? 34 : 58;
  updateHero(true);
}

function updateHero(force = false){
  if(!heroWrap || !hero || !track) return;
  const progress = Math.max(0, Math.min(1, (scrollY - heroStart) / heroRange));
  const shift = Math.min(1, Math.max(0, (progress - .02) / .98));
  const second = progress > .46;
  const changed = heroLastSecond !== second;

  /* Skip tiny wheel deltas so the hero does not repaint on every fractional step. */
  if(!force && heroLastProgress >= 0 && Math.abs(shift - heroLastProgress) < 0.0015 && !changed) return;
  heroLastProgress = shift;

  if(changed || force){
    hero.classList.toggle('second', second);
    mode.textContent = second ? 'VISUAL EDITOR' : 'DIGITAL CREATOR';
    heroNo.textContent = second ? '02' : '01';
    heroLastSecond = second;
  }

  /* ONE moving property: the full-body cutout + anchored skill bubbles travel together. */
  track.style.transform = `translate3d(-50%, ${(-shift * heroTravel).toFixed(2)}vh, 0)`;

  if(changed || force){
    let delay = 0;
    pops.forEach((p) => {
      const isHidden = p.hidden || getComputedStyle(p).visibility === 'hidden' || getComputedStyle(p).opacity === '0';
      p.classList.remove('repop');
      void p.offsetWidth;
      if(!isHidden){
        p.style.animationDelay = `${delay}ms`;
        p.classList.add('repop');
        delay += 90;
      }
    });
  }
}

let raf = 0;
addEventListener('scroll', () => {
  if(!raf) raf = requestAnimationFrame(() => { updateHero(); raf = 0; });
}, {passive:true});
addEventListener('resize', () => { if(!raf) raf = requestAnimationFrame(() => { measureHero(); raf = 0; }); }, {passive:true});
measureHero();

const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

/* Magnetic buttons. */
document.querySelectorAll('.magnetic').forEach(el => {
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * .12;
    const y = (e.clientY - r.top - r.height / 2) * .12;
    el.style.transform = `translate(${x}px,${y}px)`;
  }, {passive:true});
  el.addEventListener('pointerleave', () => el.style.transform = '');
});

/* Scroll reveals. */
const reveal = new IntersectionObserver(entries => entries.forEach(e => {
  if(e.isIntersecting) e.target.classList.add('is-visible');
}), {threshold:.12});
document.querySelectorAll('.reveal-section').forEach(s => reveal.observe(s));

/* Editorial image tilt. */
document.querySelectorAll('.tilt-card').forEach(card => {
  card.addEventListener('pointermove', e => {
    if(innerWidth < 900) return;
    const r = card.getBoundingClientRect();
    const rx = ((e.clientY-r.top)/r.height-.5)*-2.8;
    const ry = ((e.clientX-r.left)/r.width-.5)*3.8;
    card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-5px)`;
  }, {passive:true});
  card.addEventListener('pointerleave', () => card.style.transform = '');
});

/* Six unique Shorts players; nearby players lazy-load and only the centered card plays. */
const reelSection = document.querySelector('#reels');
const reelRail = document.querySelector('#reelRail');
const reelCards = [...document.querySelectorAll('.reel-card')];
const reelCurrent = document.querySelector('#reelCurrent');
const reelLocalNotice = document.querySelector('#reelLocalNotice');
const reelIds = reelCards.map(card=>card.querySelector('.reel-player')?.dataset.videoId).filter(Boolean);
const reelPlayers = new Map();
const reelPlayerTimers = new Map();
let activeReelIndex = 0;
let reelMuted = true;
let reelSectionNear = false;
let reelInView = false;
let reelApiRequested = false;
let reelApiRetries = 0;
let reelUpdateQueued = false;
let reelAutoTimer;
let reelIdleTimer;
let reelDrag = null;
let reelPointerInside = false;
let ignoreReelClick = false;
let reelPlayerSwitchTimer;
const reelIsHttp = location.protocol === 'http:' || location.protocol === 'https:';

function reelApiReady(){
  if(!window.YT?.Player)return;
  reelCards.forEach((card,index)=>{
    if(!card.dataset.reelPlayerReady)return;
    const player = reelPlayers.get(index);
    if(player?.getIframe){
      const iframe = player.getIframe();
      if(iframe){iframe.title=`Hemu Creations Short ${String(index+1).padStart(2,'0')}`;iframe.allow='autoplay; encrypted-media; picture-in-picture';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.tabIndex=-1;iframe.setAttribute('aria-hidden','true')}
    }
  });
  if(reelInView)ensureActiveReelPlayer();
}
function loadReelApi(){
  if(reelApiRequested || !reelIsHttp)return;
  reelApiRequested=true;
  if(window.YT?.Player){reelApiReady();return}
  const priorCallback=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{if(typeof priorCallback==='function')priorCallback();reelApiReady()};
  const script=document.createElement('script');
  script.src='https://www.youtube.com/iframe_api';script.async=true;
  script.onerror=()=>{
    reelApiRequested=false;
    if(reelApiRetries++===0){setTimeout(()=>{if(reelSectionNear)loadReelApi()},1800);return}
    const card=reelCards[activeReelIndex];
    card?.classList.add('is-unavailable');
    const error=card?.querySelector('.reel-error');if(error)error.hidden=false;
  };
  document.head.append(script);
}
function updateReelSoundButtons(){
  reelCards.forEach((card,index)=>{
    const button=card.querySelector('.reel-sound');
    if(!button)return;
    const active=index===activeReelIndex;
    button.setAttribute('aria-label',reelMuted?'Unmute active video':'Mute active video');
    button.setAttribute('aria-pressed',String(!reelMuted));
    button.classList.toggle('is-unmuted',!reelMuted && active);
    button.tabIndex=active?0:-1;
    button.setAttribute('aria-hidden',String(!active));
  });
}
function pauseOtherReels(keepIndex=activeReelIndex){
  reelPlayers.forEach((player,index)=>{
    if(index!==keepIndex && reelCards[index]?.dataset.reelPlayerReady==='true')player.pauseVideo();
  });
}
function startActiveReel(){
  pauseOtherReels();
  const player=reelPlayers.get(activeReelIndex);
  const card=reelCards[activeReelIndex];
  if(!player || !card || card.dataset.reelPlayerReady!=='true' || !reelInView)return;
  if(reelMuted)player.mute();
  else{player.unMute();player.setVolume(100)}
  player.playVideo();
  delete card.dataset.unmuteOnPlay;
}
function createReelPlayer(index){
  const card=reelCards[index];
  const target=card?.querySelector('.reel-player');
  if(!target || card.dataset.reelPlayerReady==='true' || card.dataset.reelPlayerLoading==='true' || card.classList.contains('is-unavailable'))return;
  if(!reelIsHttp){return}
  if(!window.YT?.Player){loadReelApi();return}
  card.dataset.reelPlayerLoading='true';
  try{
    const player=new YT.Player(target,{
      videoId:reelIds[index],
      host:'https://www.youtube.com',
      playerVars:{
        autoplay:0,
        controls:0,
        disablekb:1,
        fs:0,
        iv_load_policy:3,
        loop:0,
        modestbranding:1,
        playsinline:1,
        rel:0,
        origin:location.origin,
        widget_referrer:location.href
      },
      events:{
        onReady:event=>{
          clearTimeout(reelPlayerTimers.get(index));reelPlayerTimers.delete(index);
          card.dataset.reelPlayerReady='true';delete card.dataset.reelPlayerLoading;
          const iframe=event.target.getIframe();
          iframe.title=`Hemu Creations Short ${String(index+1).padStart(2,'0')}`;
          iframe.allow='autoplay; encrypted-media; picture-in-picture';
          iframe.referrerPolicy='strict-origin-when-cross-origin';
          iframe.tabIndex=-1;
          iframe.setAttribute('aria-hidden','true');
          try{event.target.setPlaybackQuality('hd720')}catch{}
          event.target.mute();
          if(index===activeReelIndex && reelInView) startActiveReel();
          else event.target.pauseVideo();
          card.classList.add('is-player-ready');
          ensureActiveReelPlayer();
        },
        onStateChange:event=>{
          if(event.data===YT.PlayerState.PLAYING){
            if(index!==activeReelIndex || !reelInView){event.target.pauseVideo();return}
            pauseOtherReels(index);
          }
        },
        onError:event=>{
          clearTimeout(reelPlayerTimers.get(index));reelPlayerTimers.delete(index);
          card.dataset.reelErrorCode=String(event.data);
          delete card.dataset.reelPlayerReady;delete card.dataset.reelPlayerLoading;
          card.classList.remove('is-player-ready');card.classList.add('is-unavailable');
          const error=card.querySelector('.reel-error');if(error)error.hidden=false;
          try{event.target.destroy()}catch{}
          reelPlayers.delete(index);
        }
      }
    });
    reelPlayers.set(index,player);
    reelPlayerTimers.set(index,setTimeout(()=>{
      if(card.dataset.reelPlayerReady==='true')return;
      delete card.dataset.reelPlayerLoading;card.classList.add('is-unavailable');
      const error=card.querySelector('.reel-error');if(error)error.hidden=false;
      try{player.destroy()}catch{}
      reelPlayers.delete(index);reelPlayerTimers.delete(index);
    },30000));
  }catch{
    delete card.dataset.reelPlayerLoading;card.classList.add('is-unavailable');
    const error=card.querySelector('.reel-error');if(error)error.hidden=false;
  }
}
function ensureActiveReelPlayer(){
  if(!reelIsHttp || !window.YT?.Player || !reelSectionNear)return;
  // Only one YouTube iframe is kept alive at a time to protect page-scroll performance.
  reelPlayers.forEach((player,index)=>{
    if(index===activeReelIndex)return;
    try{player.destroy()}catch{}
    reelPlayers.delete(index);
    const oldCard=reelCards[index];
    if(oldCard){delete oldCard.dataset.reelPlayerReady;delete oldCard.dataset.reelPlayerLoading;oldCard.classList.remove('is-player-ready');}
  });
  createReelPlayer(activeReelIndex);
  if(reelInView)startActiveReel();
}
function scheduleReelPlayerSwitch(index){
  clearTimeout(reelPlayerSwitchTimer);
  reelPlayerSwitchTimer=setTimeout(()=>{
    if(index!==activeReelIndex)return;
    ensureActiveReelPlayer();
    if(reelInView)startActiveReel();
  },220);
}
function updateActiveReel(){
  reelUpdateQueued=false;
  if(!reelRail || !reelCards.length)return;
  const railCenter=reelRail.getBoundingClientRect().left+reelRail.clientWidth/2;
  let nearest=0,nearestDistance=Infinity;
  reelCards.forEach((card,index)=>{
    const bounds=card.getBoundingClientRect();
    const distance=bounds.left+bounds.width/2-railCenter;
    const normalized=distance/Math.max(1,bounds.width);
    card.style.setProperty('--reel-offset',String(Math.max(-3,Math.min(3,normalized))));
    card.style.setProperty('--reel-rotation',`${Math.max(-18,Math.min(18,normalized*-6))}deg`);
    if(Math.abs(distance)<nearestDistance){nearestDistance=Math.abs(distance);nearest=index}
  });
  if(nearest!==activeReelIndex){
    activeReelIndex=nearest;
    reelCards.forEach((card,index)=>{
      card.classList.toggle('is-active',index===activeReelIndex);
      card.classList.toggle('is-neighbor',Math.abs(index-activeReelIndex)===1);
      card.setAttribute('aria-current',index===activeReelIndex?'true':'false');
    });
    if(reelCurrent)reelCurrent.textContent=`${String(activeReelIndex+1).padStart(2,'0')} / ${String(reelCards.length).padStart(2,'0')}`;
    updateReelSoundButtons();
    scheduleReelPlayerSwitch(activeReelIndex);
  }
}
function queueReelUpdate(){if(reelUpdateQueued)return;reelUpdateQueued=true;requestAnimationFrame(updateActiveReel)}
function centerReel(index,behavior='smooth'){
  const card=reelCards[index];if(!card)return;
  card.scrollIntoView({behavior,block:'nearest',inline:'center'});
  activeReelIndex=index;
  queueReelUpdate();
  scheduleReelPlayerSwitch(index);
}
function clearReelAutoplay(){clearTimeout(reelAutoTimer);reelAutoTimer=undefined}
function scheduleReelAutoplay(){
  clearReelAutoplay();
  if(!reelInView || reelPointerInside || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  reelAutoTimer=setTimeout(()=>centerReel((activeReelIndex+1)%reelCards.length),7800);
}
function markReelInteraction(){
  clearReelAutoplay();clearTimeout(reelIdleTimer);
  reelIdleTimer=setTimeout(scheduleReelAutoplay,5200);
}
reelCards.forEach((card,index)=>{
  card.querySelector('.reel-sound')?.addEventListener('click',event=>{
    event.stopPropagation();reelMuted=!reelMuted;updateReelSoundButtons();
    const player=reelPlayers.get(index);
    if(player && card.dataset.reelPlayerReady==='true' && index===activeReelIndex){
      if(reelMuted)player.mute();
      else{player.unMute();player.setVolume(100);player.playVideo()}
    }
    markReelInteraction();
  });
  card.addEventListener('click',event=>{
    if(ignoreReelClick){ignoreReelClick=false;return}
    if(event.target.closest('.reel-sound,.reel-error a'))return;
    centerReel(index);markReelInteraction();
  });
  card.addEventListener('keydown',event=>{
    if(event.target!==card)return;
    if(event.key==='Enter'||event.key===' '){event.preventDefault();centerReel(index);markReelInteraction()}
  });
});
  reelRail?.addEventListener('scroll',()=>{queueReelUpdate();markReelInteraction()},{passive:true});
reelRail?.addEventListener('pointerdown',event=>{
  if(event.pointerType==='touch' || event.target.closest('.reel-sound,.reel-error a'))return;
  reelDrag={startX:event.clientX,startScroll:reelRail.scrollLeft,moved:false};
  reelRail.classList.add('is-dragging');reelRail.setPointerCapture(event.pointerId);markReelInteraction();
});
reelRail?.addEventListener('pointermove',event=>{
  if(!reelDrag)return;
  const delta=event.clientX-reelDrag.startX;
  if(Math.abs(delta)>5)reelDrag.moved=true;
  if(reelDrag.moved)reelRail.scrollLeft=reelDrag.startScroll-delta;
});
function releaseReelDrag(){
  if(reelDrag?.moved){ignoreReelClick=true;setTimeout(()=>{ignoreReelClick=false},0)}
  reelDrag=null;reelRail?.classList.remove('is-dragging');queueReelUpdate()
}
reelRail?.addEventListener('pointerup',releaseReelDrag);
reelRail?.addEventListener('pointercancel',releaseReelDrag);
reelRail?.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){reelPointerInside=true;clearReelAutoplay()}});
reelRail?.addEventListener('pointerleave',()=>{
  reelPointerInside=false;
  if(reelDrag)releaseReelDrag();scheduleReelAutoplay();
});
reelRail?.addEventListener('focusin',()=>{clearReelAutoplay()});
reelRail?.addEventListener('focusout',()=>{setTimeout(scheduleReelAutoplay,80)});
document.addEventListener('visibilitychange',()=>document.hidden?clearReelAutoplay():scheduleReelAutoplay());
window.addEventListener('resize',queueReelUpdate,{passive:true});
updateReelSoundButtons();

if(reelSection && !reelIsHttp){
  if(reelLocalNotice)reelLocalNotice.hidden=false;
  reelCards.forEach(card=>card.classList.add('is-local-preview'));
}else if(reelSection){
  const reelSectionObserver=new IntersectionObserver(entries=>{
    const entry=entries[0];
    reelSectionNear=!!entry?.isIntersecting;
    reelInView=!!entry?.isIntersecting && entry.intersectionRatio>=.16;
    if(reelSectionNear){
      loadReelApi();
      if(reelInView)ensureActiveReelPlayer();
    }
    if(reelInView){
      ensureActiveReelPlayer();
      startActiveReel();
      scheduleReelAutoplay();
      return;
    }
    clearReelAutoplay();
    if(!reelSectionNear){
      clearTimeout(reelPlayerSwitchTimer);
      reelPlayers.forEach((player,index)=>{
        try{player.destroy()}catch{}
        const card=reelCards[index];
        if(card){
          delete card.dataset.reelPlayerReady;
          delete card.dataset.reelPlayerLoading;
          card.classList.remove('is-player-ready');
        }
      });
      reelPlayers.clear();
    }else{
      pauseOtherReels(-1);
    }
  },{rootMargin:'160px 0px',threshold:[0,.16,.35,.65]});
  reelSectionObserver.observe(reelSection);
}
/* Footer terms & policies modal. */
const termsModal=document.querySelector('#termsModal');
const termsOpen=document.querySelector('#termsOpen');
const termsClose=document.querySelector('#termsClose');
termsOpen?.addEventListener('click',()=>termsModal?.showModal());
termsClose?.addEventListener('click',()=>termsModal?.close());
termsModal?.addEventListener('click',event=>{if(event.target===termsModal)termsModal.close()});
/* Contact form — Web3Forms, same-page AJAX submission. */
const projectForm = document.querySelector('#projectForm');
const projectFormStatus = document.querySelector('#formStatus');
const projectFormSubmit = projectForm?.querySelector('[type="submit"]');
const formSuccess = document.querySelector('#formSuccess');
const successName = document.querySelector('#successName');
const successClose = formSuccess?.querySelector('.success-close');
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const WEB3FORMS_PLACEHOLDER = 'PASTE_WEB3FORMS_ACCESS_KEY_HERE';
let formSubmitPending = false;

function resetProjectSubmitState(){
  formSubmitPending=false;
  if(projectFormSubmit){
    projectFormSubmit.disabled=false;
    const label=projectFormSubmit.querySelector('span');
    if(label) label.textContent='Send project request';
  }
}

function setFormStatus(message, isError=false){
  if(!projectFormStatus) return;
  projectFormStatus.textContent=message;
  projectFormStatus.classList.toggle('is-error', isError);
}

projectForm?.addEventListener('submit', async (event)=>{
  event.preventDefault();

  if(formSubmitPending) return;

  const accessKey=projectForm.querySelector('[name="access_key"]')?.value?.trim() || '';
  if(!accessKey || accessKey===WEB3FORMS_PLACEHOLDER){
    setFormStatus('Add your Web3Forms access key in index.html before testing.', true);
    return;
  }

  if(!projectForm.checkValidity()){
    projectForm.reportValidity();
    return;
  }

  formSubmitPending=true;
  setFormStatus('Sending your request…');

  if(projectFormSubmit){
    projectFormSubmit.disabled=true;
    const label=projectFormSubmit.querySelector('span');
    if(label) label.textContent='Sending…';
  }

  try{
    const formData=new FormData(projectForm);
    formData.set('access_key', accessKey);
    formData.set('subject', 'New creative project request — Hemu Creations');
    formData.set('from_name', projectForm.querySelector('[name="name"]')?.value?.trim() || 'Hemu Creations visitor');
    formData.set('replyto', projectForm.querySelector('[name="email"]')?.value?.trim() || '');

    const response=await fetch(WEB3FORMS_ENDPOINT, {
      method:'POST',
      body:formData,
      headers:{'Accept':'application/json'}
    });

    let result=null;
    try{ result=await response.json(); }catch(_){ result=null; }

    if(!response.ok || !result?.success){
      const message=result?.message || `Submission failed (${response.status || 'network error'}).`;
      throw new Error(message);
    }

    const submittedName=projectForm.querySelector('[name="name"]')?.value?.trim() || 'creator';
    if(successName) successName.textContent=submittedName;
    setFormStatus('Request sent successfully.');
    formSuccess?.showModal?.();
    projectForm.reset();
  }catch(error){
    console.error('Web3Forms submission error:', error);
    setFormStatus(error?.message ? `Could not send: ${error.message}` : 'Could not send the request. Please try again.', true);
  }finally{
    resetProjectSubmitState();
  }
});

successClose?.addEventListener('click',()=>formSuccess?.close());
formSuccess?.addEventListener('click',event=>{
  if(event.target===formSuccess) formSuccess.close();
});

