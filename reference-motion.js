(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],reduce=matchMedia('(prefers-reduced-motion: reduce)');
const hero=$('.reference-hero'),pass=$('.reference-pass'),face=$('.pass-3d'),rope=$('.lanyard-rope');
if(hero&&pass&&rope){
 let state={x:0,y:0,vx:0,vy:0,rx:0,ry:0,roll:0},drag=null,raf=0,last=0,visible=true;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function paint(){const W=hero.clientWidth,H=hero.clientHeight,rest=pass.offsetTop,anchor=W/2,endX=anchor+state.x,endY=rest+state.y;
  pass.style.transform=`translate3d(${state.x}px,${state.y}px,0) rotate(${state.roll}deg)`;
  face.style.transform=`rotateX(${state.rx}deg) rotateY(${state.ry}deg)`;
  const bend=state.x*.14+state.vx*.8,d=`M ${anchor} -30 C ${anchor-bend} ${endY*.3},${anchor+state.x*.35-bend} ${endY*.72},${endX} ${endY+3}`;
  rope.querySelectorAll('path').forEach(p=>p.setAttribute('d',d));
 }
 function frame(time){raf=0;if(!visible)return;const dt=Math.min(2,(time-last)/16.67||1);last=time;
  if(!drag){state.vx+=(-state.x*.024-state.vx*.065)*dt;state.vy+=(-state.y*.055-state.vy*.12)*dt;state.x+=state.vx*dt;state.y+=state.vy*dt;state.rx*=Math.pow(.9,dt);state.ry*=Math.pow(.94,dt)}
  state.roll+=((-Math.atan2(state.x,pass.offsetTop+state.y)*180/Math.PI+state.vx*.7)-state.roll)*Math.min(1,.13*dt);
  paint();const active=drag||Math.abs(state.x)+Math.abs(state.y)+Math.abs(state.vx)+Math.abs(state.vy)+Math.abs(state.ry)+Math.abs(state.rx)>.07;
  if(active&&!reduce.matches)raf=requestAnimationFrame(frame);else{if(!drag){state={x:0,y:0,vx:0,vy:0,rx:0,ry:0,roll:0};paint()}pass.style.willChange='auto'}
 }
 function wake(){if(!raf){last=performance.now();pass.style.willChange='transform';raf=requestAnimationFrame(frame)}}
 pass.addEventListener('pointerdown',e=>{const now=performance.now();drag={x:e.clientX-state.x,y:e.clientY-state.y,lastX:state.x,lastY:state.y,time:now};state.vx=state.vy=0;pass.setPointerCapture(e.pointerId);pass.classList.add('dragging');wake()});
 pass.addEventListener('pointermove',e=>{if(!drag)return;const now=performance.now(),dt=Math.max(8,now-drag.time),maxX=hero.clientWidth*.4;const x=clamp(e.clientX-drag.x,-maxX,maxX),y=clamp(e.clientY-drag.y,-pass.offsetTop+100,hero.clientHeight-pass.offsetTop-pass.offsetHeight-25);state.vx=clamp((x-drag.lastX)/dt*16.67,-28,28);state.vy=clamp((y-drag.lastY)/dt*16.67,-20,20);state.x=x;state.y=y;state.ry=clamp(state.vx*2.3+x*.07,-65,65);state.rx=clamp(-state.vy*.8,-22,22);drag.lastX=x;drag.lastY=y;drag.time=now;paint()});
 const release=()=>{if(!drag)return;drag=null;pass.classList.remove('dragging');if(reduce.matches){state={x:0,y:0,vx:0,vy:0,rx:0,ry:0,roll:0};paint()}else wake()};
 ['pointerup','pointercancel','lostpointercapture'].forEach(name=>pass.addEventListener(name,release));
 pass.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Enter',' '].includes(e.key))return;e.preventDefault();if(reduce.matches)return;state.vx=e.key==='ArrowLeft'?-13:13;state.ry=e.key==='ArrowLeft'?-35:35;wake()});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){paint();if(Math.abs(state.x)+Math.abs(state.y)>.1)wake()}else if(raf){cancelAnimationFrame(raf);raf=0}},{threshold:0}).observe(hero);
 window.addEventListener('resize',paint,{passive:true});reduce.addEventListener('change',()=>{state={x:0,y:0,vx:0,vy:0,rx:0,ry:0,roll:0};paint()});paint();
}

const rails=$$('.reference-rail').map(el=>({el,track:el.querySelector('.rail-track'),set:el.querySelector('.rail-set'),x:0,velocity:0,drag:null,visible:false,hover:false}));
let railRaf=0,lastRailTime=0;
function railTick(time){railRaf=0;const dt=Math.min(2,(time-lastRailTime)/16.67||1);lastRailTime=time;let keep=false;
 for(const r of rails){if(!r.visible||reduce.matches)continue;keep=true;const width=r.set.getBoundingClientRect().width;
  if(!r.drag){if(Math.abs(r.velocity)>.05){r.x+=r.velocity*dt;r.velocity*=Math.pow(.94,dt)}else if(!r.hover)r.x-=.24*dt}
  if(r.x< -width)r.x+=width;if(r.x>0)r.x-=width;r.track.style.transform=`translate3d(${r.x}px,0,0)`;
 }
 if(keep)railRaf=requestAnimationFrame(railTick);
}
function wakeRails(){if(!railRaf&&!reduce.matches){lastRailTime=performance.now();railRaf=requestAnimationFrame(railTick)}}
const ro=new IntersectionObserver(entries=>{for(const entry of entries){const r=rails.find(x=>x.el===entry.target);r.visible=entry.isIntersecting;r.track.style.willChange=r.visible&&!reduce.matches?'transform':'auto'}wakeRails()});
for(const r of rails){ro.observe(r.el);let moved=false;
 r.el.addEventListener('pointerenter',()=>r.hover=true);r.el.addEventListener('pointerleave',()=>r.hover=false);
 r.el.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;r.drag={startX:e.clientX,startY:e.clientY,start:r.x,lastX:e.clientX,lastTime:performance.now(),axis:null};r.velocity=0;moved=false});
 r.el.addEventListener('pointermove',e=>{const cursor=r.el.querySelector('.drag-cursor'),rect=r.el.getBoundingClientRect();cursor.style.transform=`translate3d(${e.clientX-rect.left-41}px,${e.clientY-rect.top-41}px,0)`;if(!r.drag)return;const dx=e.clientX-r.drag.startX,dy=e.clientY-r.drag.startY;if(!r.drag.axis&&Math.hypot(dx,dy)>6)r.drag.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';if(r.drag.axis!=='x')return;
  if(!r.el.hasPointerCapture(e.pointerId))r.el.setPointerCapture(e.pointerId);moved=true;r.el.classList.add('dragging');r.x=r.drag.start+dx;const now=performance.now();r.velocity=Math.max(-30,Math.min(30,(e.clientX-r.drag.lastX)/Math.max(8,now-r.drag.lastTime)*16.67));r.drag.lastX=e.clientX;r.drag.lastTime=now;r.track.style.transform=`translate3d(${r.x}px,0,0)`;
 });
 const release=()=>{r.drag=null;r.el.classList.remove('dragging');wakeRails()};['pointerup','pointercancel','lostpointercapture'].forEach(e=>r.el.addEventListener(e,release));r.el.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopPropagation();moved=false}},true);
 r.el.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();r.x+=e.key==='ArrowLeft'?120:-120;r.track.style.transform=`translate3d(${r.x}px,0,0)`;wakeRails()}});
}
reduce.addEventListener('change',()=>{if(reduce.matches&&railRaf){cancelAnimationFrame(railRaf);railRaf=0}rails.forEach(r=>{r.el.style.overflowX=reduce.matches?'auto':''});wakeRails()});

const intro=$('.reference-intro'),bio=$('.reference-bio'),headline=$('.reference-headline'),marquee=$('.featured-marquee h2');let scrollRaf=0;
function scrollPaint(){scrollRaf=0;if(reduce.matches)return;const y=scrollY,H=innerHeight;if(headline&&innerWidth>760){const t=Math.min(1,y/(H*.8));headline.style.transform=`translate(-50%,-50%) translate3d(0,${-t*35}px,0) scale(${1-t*.12})`;headline.style.opacity=String(1-t)}
 if(intro&&bio){const progress=Math.max(0,Math.min(1,-intro.getBoundingClientRect().top/(H*.65)));bio.style.transform=`scale(${1-progress*.08})`;bio.style.opacity=String(1-Math.max(0,progress-.65)*1.1)}
 if(marquee){const top=marquee.parentElement.getBoundingClientRect().top;marquee.style.transform=`translate3d(${-40+(H-top)*-.07}px,0,0)`}
}
addEventListener('scroll',()=>{if(!scrollRaf)scrollRaf=requestAnimationFrame(scrollPaint)},{passive:true});scrollPaint();

const album=document.querySelector('#album'),cover=document.querySelector('#album-cover');
if(album&&cover){const spread=album.querySelector('.album-spread'),controls=document.querySelector('.album-controls');spread.inert=true;controls.inert=true;
 function setOpen(open){album.classList.toggle('open',open);cover.setAttribute('aria-expanded',String(open));cover.tabIndex=open?-1:0;cover.setAttribute('aria-label',open?'合上视觉作品册':'打开视觉作品册');spread.inert=!open;controls.inert=!open}
 cover.addEventListener('click',()=>setOpen(!album.classList.contains('open')));document.querySelector('#album-close').addEventListener('click',()=>{setOpen(false);cover.focus()});
 const items=JSON.parse(document.querySelector('#book-data').textContent),count=document.querySelector('#book-count');new MutationObserver(()=>{const n=parseInt(count.textContent,10)-1,item=items[(n+1)%items.length],img=document.querySelector('#book-next-image');img.src=item.image;img.alt=item.caption}).observe(count,{childList:true});
 document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'&&!album.classList.contains('open')&&!document.querySelector('dialog').open){e.preventDefault();e.stopImmediatePropagation();setOpen(true)}},{capture:true});
}
const ambient=[...document.querySelectorAll('video[data-ambient]')];if(ambient.length){const observer=new IntersectionObserver(entries=>{for(const {target,isIntersecting}of entries){if(isIntersecting&&!reduce.matches){target.play().catch(()=>{})}else target.pause()}},{threshold:.15});ambient.forEach(v=>observer.observe(v));reduce.addEventListener('change',()=>{if(reduce.matches)ambient.forEach(v=>v.pause())})}
})();
