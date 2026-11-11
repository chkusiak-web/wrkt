const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

/* ---------- Real data: dates + store ---------- */
const KEY='prometheus:v1';
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
/* a day runs until 4 am, so late nights count for the day you were living */
const dayOf=(t=new Date())=>{const d=new Date(t);if(d.getHours()<4)d.setDate(d.getDate()-1);return iso(d)};
const dObj=x=>new Date(x+'T12:00:00');
const addDays=(x,k)=>{const d=dObj(x);d.setDate(d.getDate()+k);return iso(d)};
const weekStart=x=>addDays(x,-((dObj(x).getDay()+6)%7));
const fmtDay=x=>{const d=dObj(x);return `${d.toLocaleDateString('en-US',{weekday:'short'})} ${d.getDate()} ${d.toLocaleDateString('en-US',{month:'short'})}`};
const dayShort=x=>dObj(x).toLocaleDateString('en-US',{weekday:'short'}).slice(0,2);
const nowH=()=>{const d=new Date();let h=d.getHours()+d.getMinutes()/60;if(h<4)h+=24;return h};
let TODAY=dayOf();
const last7=()=>Array.from({length:7},(_,i)=>addDays(TODAY,-i));
const thisWeek=()=>{const w=weekStart(TODAY),o=[];for(let d=w;d<=TODAY;d=addDays(d,1))o.push(d);return o};
const uid=()=>Math.random().toString(36).slice(2,10);
function blankStore(){return {v:1,setup:false,xp:0,level:1,streak:0,best:0,freezes:1,freezeWeek:weekStart(TODAY),missRun:0,forfeit:null,
  mindLog:[],bodyLog:[],questLog:[],avg:Array(12).fill(0),questLast:{},weights:{},sleep:{},workouts:[],checkins:[],days:{},
  tomorrow:null,hero:null,heroNext:null,weekGoals:null,lastCheckin:0,nudged:{},today:null}}
let D=blankStore();
const DAY=()=>D.days[TODAY]||(D.days[TODAY]={});

/* ---------- Flame sprite (approved: flame-reference-3.gif, 9 frames) ---------- */
const FW=432,FH=528,FN=9,sheetImg=new Image();sheetImg.src=import.meta.env.BASE_URL+'flame.png';
const flames=[];
function addFlame(cv,w){const o={cv,c:cv.getContext('2d')};flames.push(o);sizeFlame(o,w);return o}
function sizeFlame(o,w){const d=Math.min(2,devicePixelRatio||1),h=Math.round(w*FH/FW);o.cv.width=Math.max(1,Math.round(w*d));o.cv.height=Math.max(1,Math.round(h*d));o.cv.style.width=w+'px';o.cv.style.height=h+'px';o.dirty=true}
let lastF=-1;const t0=performance.now();
function loop(now){const f=Math.floor(Math.max(0,now-t0)/90)%FN;if(sheetImg.complete){flames.forEach(o=>{if(f===lastF&&!o.dirty)return;if(!o.cv.offsetParent&&!o.dirty)return;o.dirty=false;const{cv,c}=o;c.clearRect(0,0,cv.width,cv.height);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(sheetImg,f*FW,0,FW,FH,0,0,cv.width,cv.height)});lastF=f}requestAnimationFrame(loop)}
const torchW=s=>Math.round(60*Math.pow(s/100,1.6));

/* ---------- XP + toast ---------- */
let xp=0,level=1;
function gainXP(n,label){xp+=n;save();const fx=$('#xpfx');$('#xpchip').innerHTML=`<b>+${n} XP</b>${label?' · '+label:''}`;fx.classList.remove('on');void fx.offsetWidth;fx.classList.add('on');
  const pct=Math.min(100,xp/10);requestAnimationFrame(()=>{$('#xpbar i').style.width=pct+'%';$('#lvlFill').style.width=pct+'%'});$('#xpTxt').textContent=`${Math.min(xp,1000)} / 1000`;
  if(xp>=1000){setTimeout(()=>{if(xp<1000)return;xp-=1000;level++;save();$('#xpTxt').textContent=`${xp} / 1000`;$('#lvlFill').style.width=xp/10+'%';$('#xpbar i').style.width=xp/10+'%';renderHome();go('lvup')},1500)}}
let toastT;function toast(t){const e=$('#toast');e.textContent=t;e.style.bottom=document.querySelector('.bsheet.on')?'auto':'';e.style.top=document.querySelector('.bsheet.on')?'58px':'';e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),1600)}

/* ---------- Navigation ---------- */
const TABS=['today','mind','body','soul','stats'];
const FULL={onb:1,set:1,lock:1,rprev:1,food:1,fadd:1,run:1,rend:1,torch:1,ci1:1,ci2:1,rate:1,eve:1,lvup:1,plan:1,planflow:1,review:1};
let cur='today',lastTab='today';
function go(id,o={}){if(id==='back')id=lastTab;if(id==='notif'){showNotif();return}if(id==='body')setTimeout(paintBody,0);
  closeSheet();
  const prev=cur,ti=TABS.indexOf(id),pi=TABS.indexOf(prev);
  const v=$('#v-'+id),ov=$('#v-'+prev);$$('.view').forEach(x=>{x.getAnimations().forEach(a=>a.cancel());x.classList.remove('on','leaving');x.style.zIndex=x.style.clipPath=''});
  $('#wonfx').classList.remove('on');$('#forfx').classList.remove('on');
  if(ov&&ov!==v)ov.classList.add('leaving');v.classList.add('on');cur=id;animView(v,ov!==v?ov:null,prev,id);if(ti>=0)lastTab=id;
  const nav=$('#tabbar');nav.classList.toggle('hide',!!FULL[id]);nav.classList.toggle('dark',id==='soul');
  $$('#tabbar button').forEach(b=>b.classList.toggle('on',b.dataset.go===(ti>=0?id:lastTab)));
  if(id==='today'){countUp();growHome()}if(id==='mind'){radar();renderMplan()}
  if(id==='soul')skyDraw();
  if(id==='stats')renderStats();
  if(id==='plan'){renderPlan();$$('#planSeg button')[0].click()}
  if(id==='planflow')startPF();
  if(id==='food')renderFood();
  if(id==='review')startRV();
  if(id==='lock')renderLock();
  if(id==='onb')startOb();
  if(id==='set')renderSet();
  if(id==='lvup'){$('#lvNum').textContent=level}
  flames.forEach(f=>f.dirty=true);
  setNotes(o.note||id);
}
/* ---------- Motion: taps 200ms, pages 380ms, moments 700ms, one curve ---------- */
const T_TAP=200,T_PAGE=380,T_MOM=700,EZ='cubic-bezier(.2,.8,.2,1)';
const FLOWG={ci1:'ci',ci2:'ci',rate:'ci',eve:'ci',review:'review',planflow:'planflow',rprev:'run',run:'run',rend:'run',fadd:'fadd',lvup:'lvup'};
const FORDER=['rprev','run','rend','eve','ci1','ci2','rate','planflow'];
let lastTap=null;const ORIG={};
document.addEventListener('pointerdown',e=>{const el=e.target.closest('button,[data-go],.card,.tile,.chk');if(el&&$('#phone').contains(el))lastTap={r:el.getBoundingClientRect(),t:performance.now(),round:parseFloat(getComputedStyle(el).borderRadius)||14}},true);
function relRect(r,S){return {t:r.top-S.top,r:S.right-r.right,b:S.bottom-r.bottom,l:r.left-S.left}}
const clipOf=(q,rad)=>`inset(${q.t}px ${q.r}px ${q.b}px ${q.l}px round ${rad}px)`;
function animView(nv,ov,prev,id){const done=()=>{if(ov){ov.classList.remove('leaving');ov.style.zIndex=''}nv.style.zIndex='';nv.style.clipPath=''};
  if(reduce||!ov){if(!reduce)nv.animate([{opacity:0},{opacity:1}],{duration:T_TAP,easing:EZ});return done()}
  const o={duration:T_PAGE,easing:EZ,fill:'both'},S=nv.parentElement.getBoundingClientRect(),ti=TABS.indexOf(id),pi=TABS.indexOf(prev),gN=FLOWG[id],gO=FLOWG[prev];
  const fin=a=>a.finished.then(()=>{a.cancel();done()}).catch(()=>{});
  // 1. tab to tab: full push in tab order
  if(ti>=0&&pi>=0){const d=ti>pi?1:-1;ov.animate([{transform:'none'},{transform:`translateX(${-d*100}%)`}],o);fin(nv.animate([{transform:`translateX(${d*100}%)`},{transform:'none'}],o));return}
  // 2. steps inside one flow: slide sideways (back reverses)
  if(gN&&gN===gO){const d=FORDER.indexOf(id)>=FORDER.indexOf(prev)?1:-1;ov.animate([{transform:'none',opacity:1},{transform:`translateX(${-d*30}%)`,opacity:0}],o);fin(nv.animate([{transform:`translateX(${d*100}%)`},{transform:'none'}],o));return}
  // 3. into a full-screen flow: slide up like a tall sheet
  if(gN){nv.style.zIndex=3;fin(nv.animate([{transform:'translateY(100%)'},{transform:'none'}],{...o,duration:id==='lvup'?T_MOM:T_PAGE}));return}
  // 4. drill-in: the tapped tile or card grows into the page
  const fresh=lastTap&&performance.now()-lastTap.t<900;
  if(FULL[id]&&!ORIG[prev]&&fresh&&!gO){const q=relRect(lastTap.r,S);ORIG[id]={q,rad:lastTap.round};nv.style.zIndex=3;
    nv.animate([{opacity:.3},{opacity:1}],{duration:T_PAGE*.6,easing:EZ});fin(nv.animate([{clipPath:clipOf(q,lastTap.round)},{clipPath:clipOf({t:0,r:0,b:0,l:0},0)}],o));return}
  // 5. back out of a drilled page: it shrinks home
  if(ORIG[prev]&&!gO){const {q,rad}=ORIG[prev];delete ORIG[prev];ov.style.zIndex=3;ov.animate([{opacity:1},{opacity:1,offset:.7},{opacity:0}],o);fin(ov.animate([{clipPath:clipOf({t:0,r:0,b:0,l:0},0)},{clipPath:clipOf(q,rad)}],o));return}
  // 6. leaving a flow: it slides down
  if(gO){ov.style.zIndex=3;fin(ov.animate([{transform:'none'},{transform:'translateY(100%)'}],o));return}
  // 7. anything else: quick cross-fade
  ov.animate([{opacity:1},{opacity:0}],{duration:T_TAP,easing:EZ,fill:'both'});fin(nv.animate([{opacity:0},{opacity:1}],{duration:T_TAP,easing:EZ,fill:'both'}))}
/* steps inside a flow slide sideways; back reverses */
let stepDir=1;function stepIn(el){if(!el||reduce)return;el.animate([{opacity:0,transform:`translateX(${stepDir*40}px)`},{opacity:1,transform:'none'}],{duration:T_PAGE,easing:EZ})}
/* only one big overlay at a time */
{const W=$('#wonfx'),F=$('#forfx');new MutationObserver(()=>{if(F.classList.contains('on')&&W.classList.contains('on'))W.classList.remove('on')}).observe(F,{attributes:true,attributeFilter:['class']});
  new MutationObserver(()=>{if(W.classList.contains('on')&&F.classList.contains('on'))F.classList.remove('on')}).observe(W,{attributes:true,attributeFilter:['class']})}
function countUp(){if(reduce)return;$$('#v-today [data-count]').forEach(el=>{const to=+el.dataset.count;const t1=performance.now();(function s(n){const p=Math.min(1,(n-t1)/700),e=1-Math.pow(1-p,3);el.textContent=Math.round(to*e);if(p<1)requestAnimationFrame(s)})(t1)})}
function openSheet(id){closeSheet(true);$('#scrim').classList.add('on');$('#sh-'+id).classList.add('on');setNotes('sh-'+id)}
function closeSheet(keep){$$('.bsheet.on').forEach(s=>s.classList.remove('on'));if(!keep)$('#scrim').classList.remove('on');$$('#figs .pick').forEach(p=>p.classList.remove('pick'))}
$('#scrim').onclick=()=>{const wasCi=$('#sh-ci3').classList.contains('on');closeSheet();setNotes(cur)};
let notifGo='ci1';function showNotif(text,to){const n=$('#notif');if(text){n.querySelector(':scope>div>div:last-child').textContent=text;notifGo=to}n.classList.add('on');clearTimeout(n.t);n.t=setTimeout(()=>n.classList.remove('on'),8000)}
$('#notif').onclick=()=>{$('#notif').classList.remove('on');go(notifGo)};
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g&&$('#phone').contains(g)){go(g.dataset.go)}
  const s=e.target.closest('[data-sheet]');if(s)openSheet(s.dataset.sheet);
  const t=e.target.closest('[data-toast]');if(t)toast(t.dataset.toast)});

/* ---------- Today ---------- */


/* ---------- Mind wheel ---------- */
const CATS=[{n:'Learning',c:'--cobalt',it:[['Reading',0],['Classwork',0],['Research',0],['Chinese',0]]},
  {n:'Creating',c:'--sky',it:[['Writing',0],['Visual art',0],['Music',0],['Film',0]]},
  {n:'Mindfulness',c:'--navy',it:[['Meditation',0],['Journaling',0],['Social',0],['Planning',0]]}];
const GOAL=25;let focus=null,sel=null;
/* one score tree: Overall > Pillar > Category > Activity/trait, each an average % (0-100) */
/* Body score: Strength = sessions vs 3 a week; cardio + recovery = minutes vs 60 a week; Sleep = nights of 7h+ */
const BODYC={Strength:['Strength'],Cardio:['Run','Bike','Swim','Row / HIIT','Sport'],Recovery:['Stretch','Mobility','Walk','Sleep']};
function bodyVal(a){const W=new Set(last7());
  if(a==='Strength'){const n=D.workouts.filter(w=>W.has(w.date)).length+D.bodyLog.filter(e=>W.has(e.d)&&e.c==='Strength'&&e.m>0).length;return Math.min(100,Math.round(n/3*100))}
  if(a==='Sleep'){const n=last7().filter(d=>D.sleep[d]&&D.sleep[d].min>=420).length;return Math.round(n/7*100)}
  const m=D.bodyLog.filter(e=>W.has(e.d)&&e.a===a).reduce((t,e)=>t+e.m,0);return Math.max(0,Math.min(100,Math.round(m/60*100)))}
function BODYS(){const sel=(D.ob&&D.ob.sel&&D.ob.sel.Body)||[];const o={};for(const [c,L] of Object.entries(BODYC)){const k=L.filter(a=>sel.includes(a));if(k.length)o[c]=k.map(a=>[a,bodyVal(a)])}
  if(!Object.keys(o).length){o.Strength=[['Strength',bodyVal('Strength')]];o.Cardio=[['Run',bodyVal('Run')]];o.Recovery=[['Walk',bodyVal('Walk')],['Sleep',bodyVal('Sleep')]]}return o}
function logBody(c,a,m){if(!m)return;const bc=c==='Strength'||(BODYT.Strength&&BODYT.Strength[a])?'Strength':c;D.bodyLog.push({d:TODAY,c:bc,a:bc==='Strength'?'Strength':a,m})}
const logMind=(a,m)=>{if(m)D.mindLog.push({d:TODAY,a,m})};
function recalcMind(){const W=new Set(last7());CATS.forEach(c=>c.it.forEach(it=>it[1]=0));D.mindLog.forEach(e=>{if(!W.has(e.d))return;const ax=axes.find(x=>x.it[0]===e.a);if(ax)ax.it[1]=Math.max(0,ax.it[1]+e.m)})}
function syncArch(){ARCH.forEach((A,k)=>{A.subs.forEach((x,j)=>x[1]=Math.round(AVG[k*3+j]*100));A.s=avg(A.subs.map(x=>x[1]))})}
const avg=a=>a.length?Math.round(a.reduce((t,x)=>t+x,0)/a.length):0;
function TREE(){syncArch();const msel=(D.ob&&D.ob.sel&&D.ob.sel.Mind)||[],mpick=it=>!msel.some(n=>axes.some(a=>a.it[0]===n))||msel.includes(it[0]);
  const mind=CATS.map(c=>({n:c.n,c:`var(${c.c})`,k:c.it.filter(mpick).map(([n,m])=>({n,v:Math.min(100,Math.round(m/GOAL*100))}))})).filter(c=>c.k.length);
  const body=Object.entries(BODYS()).map(([n,a])=>({n,c:'var(--ember)',k:a.map(([n,v])=>({n,v}))}));
  const soul=ARCH.map(A=>({n:A.n,c:'var(--gold)',k:A.subs.map(([n,v])=>({n,v}))}));
  const P=[['Mind','var(--cobalt)',mind],['Body','var(--ember)',body],['Soul','var(--gold)',soul]].map(([n,c,cs])=>{cs.forEach(x=>x.v=avg(x.k.map(y=>y.v)));return {n,c,k:cs,v:avg(cs.map(x=>x.v))}});
  return {n:'Overall',v:avg(P.map(x=>x.v)),k:P}}
const PV=n=>TREE().k.find(x=>x.n===n).v;
const MTASK={"Reading": [["Read a book chapter", 0.5], ["Read 20 pages", 0.5], ["Read a long article", 0.25], ["Read before bed", 0.5], ["Finish a book", 1], ["Read a screenplay", 1]], "Classwork": [["Homework", 0.5], ["Reach out to professor for feedback", 0.25]], "Research": [["Deep-dive one topic", 1], ["Watch a lecture or talk", 1], ["Take notes on a paper", 0.5]], "Chinese": [["TianTian app", 0.25], ["Tone review", 0.5], ["Anki review", 0.25], ["Writing characters", 0.25], ["Listening", 0.5], ["Conversation practice", 0.5], ["Chinese lesson", 1]], "Writing": [["Write 500 words", 0.5], ["Edit a draft", 1], ["Free-write", 0.25]], "Visual art": [["Sketch", 0.5], ["Study a painting", 0.25], ["Finish a piece", 2]], "Music": [["Practice bass", 0.5], ["Learn a song", 1], ["Record an idea", 0.25]], "Film": [["Read a screenplay", 1], ["Break down a film", 2], ["Write a scene", 0.5], ["Make a shot list", 0.5]], "Meditation": [["Meditate", 0.25], ["Breathwork", 0.25], ["Body scan", 0.5]], "Journaling": [["Morning pages", 0.25], ["Evening reflection", 0.25], ["Gratitude list", 0.25]], "Social": [["Start a conversation with a stranger", 0.25], ["Introduce yourself to someone new", 0.25], ["Remember and use 3 names", 0.25], ["Tell a story well", 0.25], ["Speak up first in a group", 0.25], ["Give a toast or short talk", 0.5], ["Join a club or meetup", 1], ["Active-listening drill", 0.25]], "Planning": [["Plan tomorrow", 0.25], ["Weekly review", 0.5], ["Clear inbox", 0.5]]};
{const X={Reading:[['Read before bed',.5],['Finish a book',2]],Classwork:[['Do the readings',1],['Office hours',.5]],Research:[['Write a summary',.5],['Find 3 sources',.5]],Chinese:[['Listen to a podcast',.25]],
  Writing:[['Outline a piece',.5],['Write a page by hand',.25]],'Visual art':[['Draw from life',.5],['Color study',.25]],Music:[['Scales and technique',.25],['Jam along to a record',.5]],Film:[['Watch a classic',2]],
  Meditation:[['Walking meditation',.25],['Long sit',.5]],Journaling:[['Write about a hard day',.25],['Letter to future you',.25]],Social:[['Host a dinner',2],['Check in on someone',.25]],Planning:[['Plan the week',.5],['Budget check',.25]]};
  for(const k in X)if(MTASK[k])X[k].forEach(t=>{if(MTASK[k].length<5)MTASK[k].push(t)})}
const axes=[];CATS.forEach((c,ci)=>c.it.forEach((it,k)=>axes.push({it,ci})));
function radar(){const svg=$('#radar');let s='';
  const R=136,R0=30,RAD=6,GAP=1.6,deg=Math.PI/180;
  const P=(r,a)=>[(r*Math.cos(a)).toFixed(2),(r*Math.sin(a)).toFixed(2)];
  function wedge(i,r1){const a0=(i*30-90)*deg,a1=((i+1)*30-90)*deg,ri=R0+RAD,ro=r1-RAD;if(ro<=ri+1)return null;const ii=(RAD+GAP)/ri,io=(RAD+GAP)/ro;
    return `M${P(ri,a0+ii)}L${P(ro,a0+io)}A${ro} ${ro} 0 0 1 ${P(ro,a1-io)}L${P(ri,a1-ii)}Z`}
  axes.forEach((a,i)=>{const m=a.it[1],col=`var(${CATS[a.ci].c})`,on=focus===a.ci,op=sel!=null?(i===sel?1:.3):focus!=null?(on?1:.3):1,pct=Math.min(1,m/GOAL);
    const rf=R0+RAD*2+(R-R0-RAD*2)*Math.sqrt(pct);
    s+=`<g opacity="${op}" style="transition:opacity .25s"><path d="${wedge(i,R)}" style="fill:color-mix(in srgb, ${col} 20%, #ECE8E1);stroke:color-mix(in srgb, ${col} 20%, #ECE8E1)" stroke-width="${2*RAD}" stroke-linejoin="round"/>`;
    const fg=pct>0?wedge(i,rf):null;if(fg)s+=`<path d="${fg}" fill="${col}" stroke="${col}" stroke-width="${2*RAD}" stroke-linejoin="round"/>`;
    s+=`<path d="${wedge(i,R)}" fill="transparent" stroke="none" data-w="${i}" style="cursor:pointer"/></g>`});
  if(sel!=null){const a=axes[sel],m=Math.round(a.it[1]),col=`var(${CATS[a.ci].c})`,am=((sel+.5)*30-90)*deg,lr=R*.62,x=Math.max(-92,Math.min(92,lr*Math.cos(am))),y=lr*Math.sin(am);const bw=Math.max(a.it[0].length*8.2,52)+26,bh=50;
    s+=`<g pointer-events="none"><rect x="${x-bw/2}" y="${y-bh/2}" width="${bw}" height="${bh}" rx="16" fill="#FFFFFF" style="filter:drop-shadow(0 4px 8px rgba(0,0,0,.28))"/><text x="${x}" y="${y+1}" text-anchor="middle" font-family="Archivo, sans-serif" font-stretch="75%" font-size="24" font-weight="600" fill="var(--ink)">${m}<tspan font-size="11" font-weight="500" fill="var(--muted)"> / ${GOAL} min</tspan></text><text x="${x}" y="${y+17}" text-anchor="middle" font-family="Archivo, sans-serif" font-size="12.5" font-weight="700" fill="${col}">${a.it[0]}</text></g>`}
  svg.innerHTML=s;
  const pc=c=>Math.round(c.it.reduce((t,[,m])=>t+Math.min(1,m/GOAL),0)/4*100);
  $('#mchips').innerHTML=CATS.map((c,ci)=>`<button class="chip${ci===focus?' on':''}" data-i="${ci}" style="${ci===focus?`background:var(${c.c})`:''}"><i style="width:8px;height:8px;border-radius:50%;background:${ci===focus?'#fff':`var(${c.c})`}"></i>${c.n} ${pc(c)}%</button>`).join('');
  $('#mindWk').textContent=PV('Mind')+'%';
}
function mcard(){const ml=$('#mlist');renderMplan();if(sel==null){ml.style.display='none';return}ml.style.display='';const a=axes[sel],cc=CATS[a.ci].c,m=Math.round(a.it[1]);
  ml.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:700;font-size:15px;color:var(${cc})">${a.it[0]}</span><span style="font-size:13px;color:var(--muted)"><b class="n" style="font-size:28px;color:var(--ink);font-weight:400">${m}</b> / ${GOAL} min this week</span></div><div class="bar"><i style="width:${Math.min(100,m/GOAL*100)}%;background:var(${cc})"></i></div><div class="mt">${taskRows(sel)}</div>`;
  ml.style.animation='none';void ml.offsetWidth;ml.style.animation='';
  ml.onclick=taskClick;requestAnimationFrame(()=>{const mt=$('#mlist .mt'),v=$('#v-mind');if(!mt)return;const room=v.getBoundingClientRect().bottom-92-mt.getBoundingClientRect().top-16;mt.style.maxHeight=Math.max(80,room)+'px'})}
$('#radar').addEventListener('click',e=>{const w=e.target.closest('[data-w]');if(w){const i=+w.dataset.w;sel=sel===i?null:i;focus=sel!=null?Math.floor(i/4):null;radar();mcard();setNotes(sel!=null?'mindsel':'mind')}else{sel=null;focus=null;radar();mcard()}});
$('#mchips').addEventListener('click',()=>renderMplan());
$('#mchips').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(b){const i=+b.dataset.i;focus=focus===i&&sel==null?null:i;sel=null;radar();mcard()}});
/* log time sheet */
let pickAct=4,mins=25,showAll=false;const RECENT=[4,0,3,6];
function renderPick(){const list=showAll?axes.map((_,i)=>i):RECENT.includes(pickAct)?RECENT:[pickAct,...RECENT.slice(0,3)];
  $('#actPick').innerHTML=list.map(i=>{const a=axes[i];return `<button data-a="${i}" class="${i===pickAct?'on':''}" style="${i===pickAct?`background:var(${CATS[a.ci].c})`:''}">${a.it[0]}</button>`}).join('')+(showAll?'':'<button data-a="more">More…</button>');
  $('#mtList').innerHTML=mtEditing?editRows(pickAct):taskRows(pickAct);$('#mtEdit').textContent=mtEditing?'Done':'Edit';$('#mtHint').textContent=mtEditing?'Rename, change the length, delete, or add your own.':'Check one off to log it. + puts it on today\'s plan.'}
function openMindLog(){mtEditing=false;showAll=false;renderPick();openSheet('mindlog')}
$('#v-mind .logp').addEventListener('click',e=>{e.stopPropagation();pickAct=sel!=null?sel:4;openMindLog()},true);
$('#actPick').onclick=e=>{const b=e.target.closest('[data-a]');if(!b)return;if(b.dataset.a==='more'){showAll=true}else pickAct=+b.dataset.a;renderPick()};
const DONE_T=new Set();
function taskDone(ai,k){const [n]=MTASK[axes[ai].it[0]][k];const t=THREE.find(x=>x[5]===ai&&x[0]===n);return t?t[4]:DONE_T.has(ai+'|'+k)}
function taskRows(ai){const a=axes[ai],c=`var(${CATS[a.ci].c})`;return (MTASK[a.it[0]]||[]).map(([n,d],k)=>{const dn=taskDone(ai,k),planned=THREE.some(x=>x[5]===ai&&x[0]===n);
  return `<div class="mtr${dn?' done':''}" style="--pc:${c}"><button class="mck" data-ck="${ai}|${k}" aria-label="Done: ${n}"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6.5 5 9l5-6" stroke="#fff" stroke-width="2" fill="none"/></svg></button><span>${n}<small>${TMR&&TMR.key===ai+'|'+k?'<b class="tmrun" data-run>0:00</b>':dlab(d)}</small></span>${dn?'':`<button class="mtm${TMR&&TMR.key===ai+'|'+k?' on':''}" data-tm="${ai}|${k}" aria-label="Timer">${TMR&&TMR.key===ai+'|'+k?'■':'▶'}</button>`}<button class="mpl${planned?' on':''}" data-pl="${ai}|${k}" aria-label="Add ${n} to today">${planned?'✓':'+'}</button></div>`}).join('')}
function checkTask(ai,k){const [n,d]=MTASK[axes[ai].it[0]][k],ax=axes[ai],from=ax.it[1],ti=THREE.findIndex(x=>x[5]===ai&&x[0]===n);
  if(ti>=0)togglePlan(ti);else{THREE.push([n,'Mind',null,d,false,ai]);togglePlan(THREE.length-1)}
  const to=ax.it[1];closeSheet();if(cur!=='mind')go('mind');sel=ai;focus=ax.ci;ax.it[1]=from;const t1=performance.now();
  (function st(t){const q=Math.min(1,(t-t1)/700),e=1-Math.pow(1-q,3);ax.it[1]=from+(to-from)*e;radar();if(q<1&&!reduce)requestAnimationFrame(st);else{ax.it[1]=to;radar();mcard()}})(t1)}
let TMR=null,RUN=null;
const LIB=[["Bench press", "Chest", ["Triceps", "Shoulders"], "Barbell", 135, 8, ""], ["Incline bench press", "Chest", ["Shoulders", "Triceps"], "Barbell", 115, 8, ""], ["Decline bench press", "Chest", ["Triceps"], "Barbell", 135, 8, ""], ["Dumbbell bench press", "Chest", ["Triceps", "Shoulders"], "Dumbbell", 50, 10, ""], ["Incline DB press", "Chest", ["Shoulders", "Triceps"], "Dumbbell", 45, 10, ""], ["Dumbbell fly", "Chest", ["Shoulders"], "Dumbbell", 25, 12, ""], ["Cable fly", "Chest", ["Shoulders"], "Cable", 30, 12, ""], ["Pec deck", "Chest", [], "Machine", 90, 12, ""], ["Chest press machine", "Chest", ["Triceps"], "Machine", 100, 10, ""], ["Push-up", "Chest", ["Triceps", "Shoulders", "Abs"], "Bodyweight", 0, 15, ""], ["Dips", "Chest", ["Triceps", "Shoulders"], "Bodyweight", 0, 10, ""], ["Overhead press", "Shoulders", ["Triceps", "Traps"], "Barbell", 95, 6, ""], ["Seated DB press", "Shoulders", ["Triceps"], "Dumbbell", 40, 10, ""], ["Arnold press", "Shoulders", ["Triceps"], "Dumbbell", 30, 10, ""], ["Machine shoulder press", "Shoulders", ["Triceps"], "Machine", 80, 10, ""], ["Landmine press", "Shoulders", ["Serratus", "Chest"], "Barbell", 45, 10, ""], ["Lateral raise", "Shoulders", [], "Dumbbell", 15, 15, ""], ["Cable lateral raise", "Shoulders", [], "Cable", 10, 15, ""], ["Front raise", "Shoulders", [], "Dumbbell", 20, 12, ""], ["Rear delt fly", "Shoulders", ["Upper back"], "Dumbbell", 15, 15, ""], ["Face pull", "Shoulders", ["Upper back", "Traps"], "Cable", 40, 15, ""], ["Upright row", "Shoulders", ["Traps"], "Barbell", 65, 10, ""], ["Pike push-up", "Shoulders", ["Triceps"], "Bodyweight", 0, 10, ""], ["Close-grip bench", "Triceps", ["Chest"], "Barbell", 115, 8, ""], ["Rope pushdown", "Triceps", [], "Cable", 50, 12, ""], ["Skull crusher", "Triceps", [], "Barbell", 60, 10, ""], ["Overhead triceps extension", "Triceps", [], "Dumbbell", 40, 12, ""], ["Triceps kickback", "Triceps", [], "Dumbbell", 20, 12, ""], ["Bench dip", "Triceps", ["Chest"], "Bodyweight", 0, 15, ""], ["Diamond push-up", "Triceps", ["Chest"], "Bodyweight", 0, 12, ""], ["Barbell curl", "Biceps", ["Forearms"], "Barbell", 65, 10, ""], ["Dumbbell curl", "Biceps", ["Forearms"], "Dumbbell", 30, 10, ""], ["Hammer curl", "Biceps", ["Forearms"], "Dumbbell", 30, 10, ""], ["Incline DB curl", "Biceps", [], "Dumbbell", 25, 10, ""], ["Preacher curl", "Biceps", [], "Machine", 50, 10, ""], ["Cable curl", "Biceps", [], "Cable", 40, 12, ""], ["Concentration curl", "Biceps", [], "Dumbbell", 25, 12, ""], ["Chin-up", "Biceps", ["Lats"], "Bodyweight", 0, 8, ""], ["Pull-up", "Lats", ["Biceps", "Upper back"], "Bodyweight", 0, 8, ""], ["Lat pulldown", "Lats", ["Biceps"], "Cable", 120, 10, ""], ["Barbell row", "Lats", ["Upper back", "Lower back", "Biceps"], "Barbell", 135, 8, ""], ["Pendlay row", "Lats", ["Upper back", "Lower back"], "Barbell", 135, 5, ""], ["Single-arm row", "Lats", ["Upper back", "Biceps"], "Dumbbell", 60, 10, ""], ["T-bar row", "Lats", ["Upper back"], "Barbell", 90, 8, ""], ["Straight-arm pulldown", "Lats", [], "Cable", 50, 12, ""], ["Seated cable row", "Upper back", ["Lats", "Biceps"], "Cable", 120, 10, ""], ["Chest-supported row", "Upper back", ["Lats"], "Dumbbell", 45, 10, ""], ["Inverted row", "Upper back", ["Lats", "Biceps"], "Bodyweight", 0, 12, ""], ["Reverse fly machine", "Upper back", ["Shoulders"], "Machine", 70, 15, ""], ["Band pull-apart", "Upper back", ["Shoulders"], "Band", 0, 20, ""], ["Barbell shrug", "Traps", ["Forearms"], "Barbell", 185, 12, ""], ["Dumbbell shrug", "Traps", ["Forearms"], "Dumbbell", 60, 12, ""], ["Farmer carry", "Traps", ["Forearms", "Abs"], "Dumbbell", 70, 40, "m"], ["Deadlift", "Lower back", ["Hamstrings", "Glutes", "Traps", "Forearms"], "Barbell", 225, 5, ""], ["Back extension", "Lower back", ["Glutes", "Hamstrings"], "Bodyweight", 0, 15, ""], ["Good morning", "Lower back", ["Hamstrings"], "Barbell", 95, 10, ""], ["Bird dog", "Lower back", ["Abs"], "Bodyweight", 0, 10, ""], ["Superman", "Lower back", ["Glutes"], "Bodyweight", 0, 15, ""], ["Back squat", "Quads", ["Glutes", "Adductors"], "Barbell", 185, 5, ""], ["Front squat", "Quads", ["Abs", "Glutes"], "Barbell", 135, 6, ""], ["Goblet squat", "Quads", ["Glutes"], "Dumbbell", 60, 10, ""], ["Hack squat", "Quads", ["Glutes"], "Machine", 180, 10, ""], ["Leg press", "Quads", ["Glutes"], "Machine", 270, 10, ""], ["Leg extension", "Quads", [], "Machine", 90, 12, ""], ["Bulgarian split squat", "Quads", ["Glutes"], "Dumbbell", 35, 8, ""], ["Walking lunge", "Quads", ["Glutes", "Hamstrings"], "Dumbbell", 30, 12, ""], ["Step-up", "Quads", ["Glutes"], "Dumbbell", 30, 10, ""], ["Air squat", "Quads", ["Glutes"], "Bodyweight", 0, 20, ""], ["Box jump", "Quads", ["Calves", "Glutes"], "Bodyweight", 0, 8, ""], ["Wall sit", "Quads", [], "Bodyweight", 0, 45, "s"], ["Romanian deadlift", "Hamstrings", ["Glutes", "Lower back"], "Barbell", 155, 8, ""], ["Single-leg RDL", "Hamstrings", ["Glutes"], "Dumbbell", 35, 10, ""], ["Lying leg curl", "Hamstrings", [], "Machine", 70, 12, ""], ["Seated leg curl", "Hamstrings", [], "Machine", 80, 12, ""], ["Nordic curl", "Hamstrings", [], "Bodyweight", 0, 6, ""], ["Kettlebell swing", "Hamstrings", ["Glutes", "Lower back"], "Kettlebell", 53, 15, ""], ["Hip thrust", "Glutes", ["Hamstrings"], "Barbell", 185, 10, ""], ["Sumo deadlift", "Glutes", ["Adductors", "Hamstrings", "Quads"], "Barbell", 205, 5, ""], ["Glute bridge", "Glutes", ["Hamstrings"], "Bodyweight", 0, 15, ""], ["Cable kickback", "Glutes", [], "Cable", 30, 12, ""], ["Hip abduction machine", "Glutes", [], "Machine", 90, 15, ""], ["Adductor machine", "Adductors", [], "Machine", 90, 15, ""], ["Sumo squat", "Adductors", ["Glutes", "Quads"], "Dumbbell", 60, 12, ""], ["Lateral lunge", "Adductors", ["Glutes", "Quads"], "Dumbbell", 25, 10, ""], ["Copenhagen plank", "Adductors", ["Obliques"], "Bodyweight", 0, 20, "s"], ["Standing calf raise", "Calves", [], "Machine", 140, 15, ""], ["Seated calf raise", "Calves", [], "Machine", 90, 15, ""], ["Single-leg calf raise", "Calves", [], "Bodyweight", 0, 15, ""], ["Jump rope", "Calves", ["Shins"], "Bodyweight", 0, 60, "s"], ["Tibialis raise", "Shins", [], "Bodyweight", 0, 20, ""], ["Toe walk", "Shins", ["Calves"], "Bodyweight", 0, 30, "m"], ["Plank", "Abs", ["Obliques", "Shoulders"], "Bodyweight", 0, 45, "s"], ["Hanging leg raise", "Abs", ["Hip flexors"], "Bodyweight", 0, 10, ""], ["Ab wheel", "Abs", ["Lats"], "Bodyweight", 0, 10, ""], ["Cable crunch", "Abs", [], "Cable", 70, 15, ""], ["Dead bug", "Abs", [], "Bodyweight", 0, 12, ""], ["Hollow hold", "Abs", [], "Bodyweight", 0, 30, "s"], ["Crunch", "Abs", [], "Bodyweight", 0, 20, ""], ["Mountain climber", "Abs", ["Hip flexors", "Shoulders"], "Bodyweight", 0, 30, ""], ["Pallof press", "Obliques", ["Abs"], "Cable", 30, 12, ""], ["Side plank", "Obliques", ["Abs"], "Bodyweight", 0, 30, "s"], ["Woodchop", "Obliques", ["Abs"], "Cable", 40, 12, ""], ["Russian twist", "Obliques", ["Abs"], "Dumbbell", 20, 20, ""], ["Hanging knee raise", "Hip flexors", ["Abs"], "Bodyweight", 0, 12, ""], ["Lying leg raise", "Hip flexors", ["Abs"], "Bodyweight", 0, 15, ""], ["Scap push-up", "Serratus", ["Chest"], "Bodyweight", 0, 15, ""], ["Cable serratus punch", "Serratus", [], "Cable", 25, 12, ""], ["Wrist curl", "Forearms", [], "Dumbbell", 25, 15, ""], ["Reverse curl", "Forearms", ["Biceps"], "Barbell", 45, 12, ""], ["Dead hang", "Forearms", ["Lats"], "Bodyweight", 0, 40, "s"]];
const WORKOUTS={"Push day": ["Bench press", "Incline DB press", "Overhead press", "Lateral raise", "Rope pushdown"], "Pull day": ["Pull-up", "Barbell row", "Lat pulldown", "Face pull", "Hammer curl"], "Leg day": ["Back squat", "Romanian deadlift", "Leg press", "Lying leg curl", "Standing calf raise"], "Upper body": ["Bench press", "Barbell row", "Seated DB press", "Lat pulldown", "Dumbbell curl", "Rope pushdown"], "Lower body": ["Deadlift", "Front squat", "Bulgarian split squat", "Hip thrust", "Seated calf raise"], "Full body": ["Back squat", "Bench press", "Barbell row", "Overhead press", "Plank"], "Arms": ["Barbell curl", "Close-grip bench", "Hammer curl", "Skull crusher", "Wrist curl"], "Core": ["Hanging leg raise", "Ab wheel", "Pallof press", "Side plank", "Dead bug"], "Bodyweight": ["Push-up", "Pull-up", "Air squat", "Inverted row", "Glute bridge", "Plank"]};
const LIBM=[...new Set(LIB.map(x=>x[1]))];const EXR=n=>LIB.find(x=>x[0]===n)||[n,'Abs',[],'Bodyweight',0,10,''];
function lastSets(n){for(let i=D.workouts.length-1;i>=0;i--){const e=D.workouts[i].ex.find(x=>x.n===n);if(e&&e.sets.length)return e.sets}return null}
const bestW=n=>Math.max(0,...D.workouts.flatMap(w=>w.ex.filter(x=>x.n===n).flatMap(x=>x.sets.map(s=>s.w))));
/* double progression: hit the top of the range on every set -> +5 lb and back to the bottom; otherwise +1 rep */
function nextSet(n,w0,r0,u){const L=lastSets(n);if(!L)return [w0,r0];const top=L.reduce((a,s)=>s.w>a.w||(s.w===a.w&&s.r>a.r)?s:a,L[0]);
  if(u||!top.w)return [top.w,top.r+(u?5:1)];const lo=r0,hi=r0+4;return L.every(s=>s.r>=hi)?[top.w+5,lo]:[top.w,Math.min(hi,top.r+1)]}
const fmtT=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
const unitL=e=>e.u==='s'?'sec':e.u==='m'?'m':'reps';
const setL=(e,s)=>(s.w?s.w+' × ':'')+s.r+(e.u==='s'?'s':e.u==='m'?' m':'');
function mkEx(n,k){const [,m,sec,eq,w0,r0,u]=EXR(n),L=lastSets(n),top=L?L[0]:null,[w,r]=nextSet(n,w0,r0,u);return {n,m,sec,eq,u,last:top?[top.w,top.r]:[0,0],sets:Array.from({length:k},()=>({w,r,d:0}))}}
let RUN_IV;
function startRun(wk,now){RUN={wk,ex:WORKOUTS[wk].map((n,i)=>mkEx(n,i===0?4:3)),i:0,t0:null,rest:null};$('#rnRest').classList.remove('on');if(now)beginRun();else{go('rprev');renderPrev()}}
function beginRun(){RUN.t0=performance.now();RUN.i=0;go('run');renderRun();clearInterval(RUN_IV);RUN_IV=setInterval(tickRun,250)}
const reRun=()=>cur==='rprev'?renderPrev():renderRun();
function renderPrev(){$('#pvWkN').textContent=RUN.wk;const sets=RUN.ex.reduce((t,e)=>t+e.sets.length,0);$('#pvMeta').textContent=`${RUN.ex.length} · ~${Math.round(sets*2.5/5)*5} min`;
  $('#pvList').innerHTML=RUN.ex.map((e,i)=>{const s0=e.sets[0];return `<div class="pvr" data-i="${i}"><span class="hd" aria-label="Drag to reorder">≡</span><div class="nm"><b>${e.n}</b><small>${e.sets.length} × ${s0.r}${e.u==='s'?'s':e.u==='m'?' m':''}${s0.w?' · '+s0.w+' lb':''}</small></div><button class="pvs" data-sw>Swap</button><button class="pvx" data-rm aria-label="Remove ${e.n}">✕</button></div>`}).join('');
  $('#pvGo').classList.toggle('off',!RUN.ex.length)}
$('#pvList').onclick=e=>{const r=e.target.closest('.pvr');if(!r)return;const i=+r.dataset.i;
  if(e.target.closest('[data-rm]')){r.animate([{opacity:1},{opacity:0,transform:'translateX(30px)'}],{duration:180}).onfinish=()=>{RUN.ex.splice(i,1);renderPrev()};return}
  if(e.target.closest('[data-sw]')){RUN.i=i;openLib('e','swap')}};
{let dr=null;$('#pvList').addEventListener('pointerdown',e=>{const h=e.target.closest('.hd');if(!h)return;e.preventDefault();const row=h.closest('.pvr'),rows=[...$$('#pvList .pvr')];dr={row,i:rows.indexOf(row),y0:e.clientY,h:row.offsetHeight+6,n:rows.length,rows};row.classList.add('drag');h.setPointerCapture(e.pointerId)});
  $('#pvList').addEventListener('pointermove',e=>{if(!dr)return;const dy=e.clientY-dr.y0;dr.row.style.transform=`translateY(${dy}px)`;const to=Math.max(0,Math.min(dr.n-1,dr.i+Math.round(dy/dr.h)));dr.rows.forEach((r,j)=>{if(r===dr.row)return;r.style.transform=j>dr.i&&j<=to?`translateY(${-dr.h}px)`:j<dr.i&&j>=to?`translateY(${dr.h}px)`:''});dr.to=to});
  const end=()=>{if(!dr)return;const {i,to}=dr;dr=null;if(to!=null&&to!==i){const [x]=RUN.ex.splice(i,1);RUN.ex.splice(to,0,x)}renderPrev()};$('#pvList').addEventListener('pointerup',end);$('#pvList').addEventListener('pointercancel',end)}
$('#pvGo').onclick=()=>{if(!RUN.ex.length)return toast('Add an exercise first');beginRun()};
$('#pvX').onclick=()=>{RUN=null;go('body')};
$('#pvWk').onclick=()=>openLib('w');
$('#pvAdd').onclick=()=>{RUN.i=RUN.ex.length-1;openLib('e','add')};
function tickRun(){if(!RUN)return;$('#rnT').textContent=fmtT(Math.round((performance.now()-RUN.t0)/1000));const R=RUN.rest;if(!R)return;
  const ms=Math.max(0,R.end-performance.now());$('#rnRT').textContent=fmtT(Math.ceil(ms/1000));$('#rnRing').style.strokeDasharray=`${(553*ms/(R.len*1000)).toFixed(1)} 553`;if(ms<=0)endRest(true)}
const nextIdx=()=>{const n=RUN.ex.length;for(let k=0;k<n;k++){const i=(RUN.i+k)%n;if(RUN.ex[i].sets.some(s=>!s.d))return i}return -1};
function hitMap(ex){const h={};ex.forEach(e=>{if(e.sets.some(s=>s.d)){h[e.m]=2;e.sec.forEach(m=>h[m]=Math.max(h[m]||0,1))}});return h}
function paintFig(sel,ex,E){const h=hitMap(ex);$$(sel+' [data-m]').forEach(p=>{const m=p.dataset.m;p.style.fill=h[m]===2?'var(--ember)':h[m]===1?'#9E3A22':E&&E.m===m?'#F2E6DA':E&&E.sec.includes(m)?'#77706a':''})}
function renderRun(){const E=RUN.ex[RUN.i],cur=E.sets.findIndex(s=>!s.d);
  $('#rnWkN').textContent=RUN.wk;
  $('#rnDots').innerHTML=RUN.ex.map((e,i)=>`<i class="${i===RUN.i?'on':e.sets.every(s=>s.d)?'f':''}"></i>`).join('');
  $('#rnName').textContent=E.n;
  $('#rnLast').innerHTML=!E.last[1]?'First time':E.last[0]?`Last ${E.last[0]} × ${E.last[1]}`:`Last ${E.last[1]}${E.u==='s'?'s':E.u==='m'?' m':''}`;
  $('#rnSets').innerHTML=E.sets.map((s,j)=>`<div class="rset${s.d?' d':''}${j===cur?' cur':''}" data-j="${j}"><span class="rsn">${s.d?'✓':j+1}</span>${j===cur?`<span class="stp">${s.w||E.eq!=='Bodyweight'?`<button data-st="w|-1" aria-label="Less weight">−</button><b>${s.w}</b><button data-st="w|1" aria-label="More weight">+</button>`:''}<button data-st="r|-1" aria-label="Fewer">−</button><b>${s.r}${E.u==='s'?'s':E.u==='m'?'m':''}</b><button data-st="r|1" aria-label="More">+</button></span>`:`<span class="rsv">${setL(E,s)}</span>`}</div>`).join('');
  $('#rnGo').textContent=cur>=0?'Done':nextIdx()<0?'Finish':'Next';
  $('#rnPrev').style.visibility=RUN.i?'visible':'hidden';$('#rnNext').style.visibility=RUN.i<RUN.ex.length-1?'visible':'hidden';
  paintFig('#rnFig',RUN.ex,E)}
function slideTo(i){if(i===RUN.i||i<0||i>=RUN.ex.length)return;const d=i>RUN.i?1:-1,m=$('#rnMain');
  m.animate([{transform:'none',opacity:1},{transform:`translateX(${-40*d}px)`,opacity:0}],{duration:140}).onfinish=()=>{RUN.i=i;renderRun();m.animate([{transform:`translateX(${40*d}px)`,opacity:0},{transform:'none',opacity:1}],{duration:180})}}
function startRest(){RUN.rest={end:performance.now()+60000,len:60};const i=nextIdx(),e=RUN.ex[i],j=e.sets.findIndex(s=>!s.d);
  $('#rnUp').textContent='Next · '+(i!==RUN.i?e.n+' · ':'')+setL(e,e.sets[j]);$('#rnRT').textContent='1:00';$('#rnRing').style.strokeDasharray='553 553';$('#rnRest').classList.add('on')}
function endRest(buzz){if(!RUN||!RUN.rest)return;RUN.rest=null;$('#rnRest').classList.remove('on');if(buzz){navigator.vibrate&&navigator.vibrate([200,100,200]);toast('Rest over. Go.')}}
$('#rnGo').onclick=()=>{const E=RUN.ex[RUN.i],cur=E.sets.findIndex(s=>!s.d);
  if(cur<0){const n=nextIdx();n<0?finishRun():slideTo(n);return}
  E.sets[cur].d=1;navigator.vibrate&&navigator.vibrate(30);const n=nextIdx();renderRun();
  if(n<0){setTimeout(finishRun,400);return}
  if(n!==RUN.i)setTimeout(()=>slideTo(n),300);startRest()};
$('#rnSets').onclick=e=>{const E=RUN.ex[RUN.i],b=e.target.closest('[data-st]');
  if(b){const [k,d]=b.dataset.st.split('|'),cur=E.sets.findIndex(s=>!s.d),st=k==='w'?5:E.u?5:1;E.sets.forEach((s,j)=>{if(j>=cur&&!s.d)s[k]=Math.max(k==='w'?0:1,s[k]+d*st)});renderRun();return}
  const r=e.target.closest('.rset.d');if(r){E.sets[+r.dataset.j].d=0;renderRun()}};
{let x0=null;$('#rnMain').addEventListener('pointerdown',e=>{x0=e.clientX});$('#rnMain').addEventListener('pointerup',e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>50)slideTo(RUN.i+(dx<0?1:-1))})}
$('#rnPrev').onclick=()=>slideTo(RUN.i-1);$('#rnNext').onclick=()=>slideTo(RUN.i+1);
$('#rnPlus').onclick=()=>{RUN.rest.end+=15000;RUN.rest.len+=15};$('#rnSkip').onclick=()=>endRest(false);
$('#rnFin').onclick=()=>{if(!RUN.ex.some(e=>e.sets.some(s=>s.d)))return toast('Log at least one set first');finishRun()};
$('#rnX').onclick=()=>{if(RUN.ex.some(e=>e.sets.some(s=>s.d))){if(!confirm('Save this workout? Cancel throws it away.')){clearInterval(RUN_IV);endRest(false);RUN=null;go('body');return toast('Workout discarded')}return finishRun()}clearInterval(RUN_IV);RUN=null;go('body');toast('Workout ended · nothing logged')};
$('#runOpen').onclick=()=>startRun(nextWorkout());
const ROT=['Push day','Pull day','Leg day'];
function nextWorkout(){const p=THREE.find(t=>t[1]==='Body'&&!t[4]&&WORKOUTS[t[0]]);if(p)return p[0];const l=D.workouts.length?D.workouts[D.workouts.length-1].name:null;const i=ROT.indexOf(l);return i<0?(l&&WORKOUTS[l]?l:'Push day'):ROT[(i+1)%3]}
let LIBS={t:'w',act:'add'},libF='All';
function openLib(t,act){LIBS={t,act:act||'add'};libF=act==='swap'?RUN.ex[RUN.i].m:'All';$('#libQ').value='';renderLib();openSheet('lib');$('#libList').scrollTop=0}
function renderLib(){const {t,act}=LIBS;$$('#libSeg button').forEach(b=>b.classList.toggle('on',b.dataset.lt===t));$('#libQ').style.display=$('#libChips').style.display=t==='e'?'':'none';
  if(t==='w'){$('#libTtl').style.display='none';$('#libList').innerHTML=Object.entries(WORKOUTS).map(([n,L])=>`<button class="lrow" data-wk="${n}"><span><b>${n}</b><small>${[...new Set(L.map(x=>EXR(x)[1]))].slice(0,3).join(', ')}</small></span><i class="${n===RUN.wk?'cur':''}">${n===RUN.wk?'Now':'Start'}</i></button>`).join('');return}
  $('#libTtl').style.display='';$('#libTtl').textContent=act==='swap'?'Swap':'Add';
  $('#libChips').innerHTML=['All',...LIBM].map(m=>`<button data-lf="${m}" class="${m===libF?'on':''}">${m}</button>`).join('');{const c=$('#libChips .on');if(c)$('#libChips').scrollLeft=c.offsetLeft-60}
  const q=$('#libQ').value.trim().toLowerCase(),L=LIB.filter(x=>(libF==='All'||x[1]===libF||x[2].includes(libF))&&(!q||x[0].toLowerCase().includes(q)||x[3].toLowerCase().includes(q))).sort((a,b)=>(b[1]===libF)-(a[1]===libF));
  $('#libList').innerHTML=L.map(x=>`<button class="lrow" data-ex="${x[0]}"><span><b>${x[0]}</b><small>${x[3]}</small></span><i>${act==='swap'?'Swap':'Add'}</i></button>`).join('')||'<div style="color:var(--muted);font-size:13px;padding:10px 0">No matches</div>'}
$('#libSeg').onclick=e=>{const b=e.target.closest('[data-lt]');if(!b)return;LIBS.t=b.dataset.lt;renderLib()};
$('#libChips').onclick=e=>{const b=e.target.closest('[data-lf]');if(!b)return;libF=b.dataset.lf;renderLib()};
$('#libQ').oninput=renderLib;
$('#libList').onclick=e=>{const w=e.target.closest('[data-wk]');if(w){const n=w.dataset.wk;closeSheet();if(n!==RUN.wk){RUN.wk=n;RUN.ex=WORKOUTS[n].map((x,i)=>mkEx(x,i===0?4:3));RUN.i=0;endRest(false);reRun();toast('Switched to '+n)}return}
  const x=e.target.closest('[data-ex]');if(!x)return;const n=x.dataset.ex;closeSheet();
  if(LIBS.act==='swap'){RUN.ex[RUN.i]=mkEx(n,RUN.ex[RUN.i].sets.length);toast('Swapped in '+n)}else{RUN.ex.splice(RUN.i+1,0,mkEx(n,3));RUN.i++;toast('Added '+n)}reRun()};
$('#rnWk').onclick=()=>openLib('w');$('#rnSwap').onclick=()=>openLib('e','swap');$('#rnAdd').onclick=()=>openLib('e','add');
function finishRun(){clearInterval(RUN_IV);endRest(false);const sec=Math.round((performance.now()-RUN.t0)/1000),DN=RUN.ex.flatMap(e=>e.sets.filter(s=>s.d).map(s=>[e,s]));RUN.sec=sec;
  const vol=DN.reduce((t,[e,s])=>t+(e.u?0:s.w*s.r),0),PR=RUN.ex.map(e=>{const b=bestW(e.n),top=Math.max(0,...e.sets.filter(s=>s.d).map(s=>s.w));return top>b&&b?[e.n,top,b]:null}).filter(Boolean);
  $('#reName').textContent=RUN.wk;
  $('#reGrid').innerHTML=[['Time',fmtT(sec)],['Volume',vol.toLocaleString()+'<small style="font-size:14px"> lb</small>'],['Sets',DN.length],['PRs',PR.length]].map(([l,v])=>`<div><span class="lab" style="color:#9b958c">${l}</span><b class="n">${v}</b></div>`).join('');
  const h=hitMap(RUN.ex);$('#reMus').innerHTML=Object.entries(h).sort((a,b)=>b[1]-a[1]).map(([m,v])=>`<span class="${v===2?'p':''}">${m}</span>`).join('');paintFig('#reFig',RUN.ex,null);
  $('#rePR').innerHTML=PR.map(([n,w,b])=>`<div>${n}<span>${w} · PR</span></div>`).join('');
  go('rend')}
$('#reDone').onclick=()=>{const n=RUN?RUN.ex.reduce((t,e)=>t+e.sets.filter(s=>s.d).length,0):0;if(RUN){D.workouts.push({id:uid(),date:TODAY,name:RUN.wk,sec:RUN.sec||0,ex:RUN.ex.map(e=>({n:e.n,m:e.m,sets:e.sets.filter(s=>s.d).map(s=>({w:s.w,r:s.r}))})).filter(e=>e.sets.length)});save()}const wk=RUN&&RUN.wk,dur=RUN?Math.max(.25,Math.round((RUN.sec||0)/900)/4):1;RUN=null;D.active=null;go('body');paintBody();const kd=THREE.findIndex(t=>t[1]==='Body'&&t[4]&&t[0]===wk&&!(t[7]&&t[7].w));if(kd>=0){const t=THREE[kd];if(t[7])logBody(t[7].c,t[7].a,-Math.round(t[3]*60));t[7]={c:'Strength',a:'Strength',w:1}}let k=kd>=0?-2:THREE.findIndex(t=>t[1]==='Body'&&!t[4]&&t[6]!=='hero'&&(t[0]===wk||WORKOUTS[t[0]]));if(k<0)k=THREE.findIndex(t=>t[1]==='Body'&&!t[4]&&t[6]!=='hero');if(k>=0){THREE[k][4]=true;THREE[k][7]={c:'Strength',a:'Strength',w:1}}else if(k===-1)THREE.push([wk||'Workout','Body',null,dur,true,null,null,{c:'Strength',a:'Strength',w:1}]);setTimeout(checkWon,0);renderHome();renderPlan();save();{setTimeout(()=>checkXP(25,'Workout'),300);toast(`Workout logged · ${n} sets · counts for Body`)}};
const HEROES=[['Run 5K every day','Body','Run 5K'],['Train 60 min every day','Body','Train 60 min'],['60 min outside every day','Body','60 min outside'],['No coffee for 7 days','Body','No coffee today'],['Listen to one full audiobook','Mind','Audiobook 30 min'],['Write 500 words every day','Mind','Write 500 words'],['One hard conversation a day','Soul','Hard conversation']];
function setHero(H,wk){D.hero={week:wk,text:H[0],pil:H[1],short:H[2],days:[],done:false,swaps:0};const i=THREE.findIndex(t=>t[6]==='hero');if(wk===weekStart(TODAY)){const it=[`Hero: ${H[2]}`,H[1],null,.5,false,null,'hero'];if(i>=0){if(!THREE[i][4])THREE[i]=it}else THREE.push(it)}}
function ensureHero(){const wk=weekStart(TODAY);if(D.hero&&D.hero.week===wk)return;if(D.heroNext&&D.heroNext.week===wk){setHero(D.heroNext.h,wk);D.heroNext=null;return}
  const last=D.hero?HEROES.findIndex(h=>h[0]===D.hero.text):-1;setHero(HEROES[(last+1)%HEROES.length],wk)}
function goalProg(g){const wk=[];for(let d=g.week;d<=TODAY&&d<addDays(g.week,7);d=addDays(d,1))wk.push(d);const W=new Set(wk);
  if(g.p==='Mind')return wk.filter(d=>D.mindLog.filter(e=>e.d===d&&e.a===g.sub).reduce((t,e)=>t+e.m,0)>0).length;
  if(g.p==='Body'){if(g.sub==='Strength'||(BODYT.Strength&&BODYT.Strength[g.sub]))return D.workouts.filter(w=>W.has(w.date)).length+D.bodyLog.filter(e=>W.has(e.d)&&e.c==='Strength'&&e.m>0).length;return D.bodyLog.filter(e=>W.has(e.d)&&e.a===g.sub&&e.m>0).length}
  return D.questLog.filter(q=>W.has(q.d)&&q.t===g.sub).length}
function checkGoals(){const G=D.weekGoals;if(!G||G.week!==weekStart(TODAY))return;G.goals.forEach((g,i)=>{if(!G.paid[i]&&goalProg(g)>=g.k){G.paid[i]=1;checkXP(40,'Weekly goal');setTimeout(()=>toast(`Weekly goal done · ${g.name}`),1200)}});
  if(D.hero&&!D.hero.done&&D.hero.days.length>=7){heroDone(false)}
  if(weekWins()>=5&&D.spoilWeek!==weekStart(TODAY)){D.spoilWeek=weekStart(TODAY);setTimeout(()=>toast(`5 of 7 won · enjoy: ${WSP}`),2600)}}
$('#hSwap').onclick=()=>{if(!D.hero)return;if(D.hero.swaps>=1&&!confirm('Your free swap is used. Swap for 50 XP?'))return;if(D.hero.swaps>=1)xp=Math.max(0,xp-50);const sw=D.hero.swaps+1,i=HEROES.findIndex(h=>h[0]===D.hero.text);setHero(HEROES[(i+1)%HEROES.length],D.hero.week);D.hero.swaps=sw;save();renderPlan();renderHome();toast('Hero: '+D.hero.text)};
function heroDone(ph){if(D.hero){if(D.hero.done)return closeSheet();D.hero.done=true;(D.trophies=D.trophies||[]).push({week:D.hero.week,text:D.hero.text,photo:!!ph});save()}closeSheet();checkXP(150,'Hero');setTimeout(()=>toast(ph?'Hero done · photo added to your trophy':'Hero done · trophy earned'),400)}
$('#heroPh').onchange=()=>heroDone(true);$('#heroSkip').onclick=()=>heroDone(false);
function taskClick(e){const tm=e.target.closest('[data-tm]');if(tm){const key=tm.dataset.tm;
    if(TMR&&TMR.key===key){clearInterval(TMR.iv);const [ai,k]=key.split('|').map(Number),ax=axes[ai],m=Math.max(1,Math.round((performance.now()-TMR.t0)/60000));TMR=null;const tn=(MTASK[ax.it[0]][k]||['Timer'])[0];THREE.push([tn,'Mind',null,m/60,true,ai]);ax.it[1]+=m;logMind(ax.it[0],m);checkXP(blockXP(m/60),ax.it[0]);checkWon();save();toast(`Timer: ${m} min ${ax.it[0]} logged`);renderPick();radar();mcard();return true}
    if(TMR)clearInterval(TMR.iv);TMR={key,t0:performance.now()};renderPick();TMR.iv=setInterval(()=>{const el=document.querySelector('[data-run]');if(el){const sec=Math.round((performance.now()-TMR.t0)/1000);el.textContent=fmtT(sec)}},250);toast('Timer running · tap ■ to log the time');return true}const c=e.target.closest('[data-ck]');if(c){const [a,k]=c.dataset.ck.split('|').map(Number);checkTask(a,k);return true}
  const p=e.target.closest('[data-pl]');if(p){const [a,k]=p.dataset.pl.split('|').map(Number);const [n,d]=MTASK[axes[a].it[0]][k];if(THREE.some(x=>x[5]===a&&x[0]===n)){toast('Already on today\'s plan');return true}openSlot(-1,{n,p:'Mind',a,d});return true}}
let mtEditing=false;const DCYC=[.25,.5,1,2];
function editRows(ai){const L=MTASK[axes[ai].it[0]]||(MTASK[axes[ai].it[0]]=[]),c=`var(${CATS[axes[ai].ci].c})`;
  return L.map(([n,d],k)=>`<div class="mtr ed"><input value="${n.replace(/"/g,'&quot;')}" data-en="${k}" aria-label="Task name"><button class="dch" data-ed="${k}">${dlab(d)}</button><button class="del" data-del="${k}" aria-label="Delete">✕</button></div>`).join('')+`<button class="mtnew" id="mtNew" style="color:${c}">+ New task</button>`}
$('#mtEdit').onclick=()=>{mtEditing=!mtEditing;renderPick();if(!mtEditing){if(sel!=null)mcard();toast('Saved')}};
$('#mtList').addEventListener('input',e=>{const i=e.target.closest('[data-en]');if(i)MTASK[axes[pickAct].it[0]][+i.dataset.en][0]=i.value});
$('#mtList').onclick=e=>{if(!mtEditing)return taskClick(e);const L=MTASK[axes[pickAct].it[0]];
  const d=e.target.closest('[data-ed]');if(d){const t=L[+d.dataset.ed];t[1]=DCYC[(DCYC.indexOf(t[1])+1)%DCYC.length];d.textContent=dlab(t[1]);d.animate([{transform:'scale(1.1)'},{transform:'none'}],{duration:180});return}
  const x=e.target.closest('[data-del]');if(x){const row=x.closest('.mtr');row.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateX(30px)'}],{duration:200}).onfinish=()=>{L.splice(+x.dataset.del,1);renderPick()};return}
  if(e.target.closest('#mtNew')){L.push(['',.5]);renderPick();const ins=$$('#mtList input');ins[ins.length-1].focus()}};

/* ---------- Body figure ---------- */
const STAT={};
const FILL={p:'var(--ember)',s:'#A8201A',n:'#E6E0D8'};
const lastHit=m=>{for(let i=D.workouts.length-1;i>=0;i--){const w=D.workouts[i];if(w.ex.some(e=>{const x=EXR(e.n);return x[1]===m||x[2].includes(m)}))return w.date}return null};
const daysAgo=d=>Math.round((dObj(TODAY)-dObj(d))/864e5);
function paintBody(){for(const k in STAT)delete STAT[k];
  D.workouts.filter(w=>daysAgo(w.date)<=1).forEach(w=>w.ex.forEach(e=>{const x=EXR(e.n);STAT[x[1]]='s';x[2].forEach(m=>{if(!STAT[m])STAT[m]='s'})}));
  THREE.filter(t=>t[1]==='Body'&&!t[4]&&WORKOUTS[t[0]]).forEach(t=>WORKOUTS[t[0]].forEach(n=>{const m=EXR(n)[1];if(!STAT[m])STAT[m]='p'}));
  $$('#figs [data-m]').forEach(p=>p.style.fill=FILL[STAT[p.dataset.m]||'n']);
  const ws=Object.keys(D.weights).sort(),lw=ws[ws.length-1];
  const wk=ws.filter(d=>daysAgo(d)<7).map(d=>D.weights[d]),pk=ws.filter(d=>daysAgo(d)>=7&&daysAgo(d)<14).map(d=>D.weights[d]);
  const av=a=>a.reduce((t,x)=>t+x,0)/a.length,dl=wk.length&&pk.length?av(wk)-av(pk):null;
  $('#stWt').innerHTML=`<span class="lab">Weight</span><span class="n">${lw?D.weights[lw].toFixed(1):'—'}</span><span${dl!=null?` style="color:${dl<=0?'var(--green)':'var(--ember)'};font-weight:600"`:''}>${dl!=null?`${dl<=0?'↓':'↑'} ${Math.abs(dl).toFixed(1)} lb`:lw?'7-day trend soon':'Log it'}</span>`;
  const sl=D.sleep[TODAY]||D.sleep[addDays(TODAY,-1)];
  $('#stSl').innerHTML=`<span class="lab">Sleep</span><span class="n">${sl?Math.floor(sl.min/60)+':'+pad(sl.min%60):'—'}</span><span>${sl?'quality '+sl.q:'Log it'}</span>`;
  const W=new Set(last7()),ca=D.bodyLog.filter(e=>W.has(e.d)&&e.c==='Cardio').reduce((t,e)=>t+e.m,0);
  $('#stCa').innerHTML=`<span class="lab">Cardio</span><span class="n">${Math.max(0,ca)}</span><span>/ 150 min</span>`;
  $('#wtBox').textContent=lw?D.weights[lw].toFixed(1):'—';$('#wtSub').textContent=D.weights[TODAY]?'lb · today':lw?'lb · '+fmtDay(lw):'Tap to log';
  const st=D.sleep[TODAY];$('#slBox').textContent=st?`${Math.floor(st.min/60)}h ${pad(st.min%60)}m`:'—';$('#slSub').textContent=st?'quality '+st.q:'Tap to log';
  $('#runNext').textContent=nextWorkout()+' · up next';renderWater();fdHead()}
const EX={};LIB.forEach(x=>(EX[x[1]]=EX[x[1]]||[]).push(x[0]));
const ST={p:["Today's plan",'var(--ember)','Last trained 4 days ago'],s:['Sore','#A8201A','Last trained yesterday'],n:['Ready','#8f897f','Last trained 3 days ago']};
$('#figSeg').onclick=e=>{const b=e.target.closest('[data-fs]');if(!b||(+b.dataset.fs===1)===back)return;$('#rot').click()};
let back=false;$('#rot').onclick=()=>{const f=$('#figs');f.classList.add('flip');setTimeout(()=>{back=!back;f.setAttribute('viewBox',back?'653 5 495 1050':'160 5 495 1050');$$('#figSeg button').forEach((x,i)=>x.classList.toggle('on',i===(back?1:0)));f.classList.remove('flip')},180)};
$('#figs').addEventListener('click',e=>{const p=e.target.closest('[data-m]');if(!p)return;const name=p.dataset.m,s=ST[STAT[name]||'n'],lh=lastHit(name);
  $('#musName').textContent=name;$('#musTag').textContent=s[0];$('#musTag').style.background=s[1];$('#musInfo').textContent=lh?(daysAgo(lh)===0?'Last trained today':daysAgo(lh)===1?'Last trained yesterday':`Last trained ${daysAgo(lh)} days ago`):'Not trained yet';
  $('#musEx').innerHTML=(EX[name]||['Bodyweight circuit']).slice(0,4).map(x=>`<div class="exr" style="align-items:center">${x}<button class="addx" aria-label="Add ${x} to workout">+</button></div>`).join('');
  openSheet('muscle');$$('#figs [data-m="'+name+'"]').forEach(x=>x.classList.add('pick'))});
$('#musEx').onclick=e=>{const b=e.target.closest('.addx');if(!b)return;const on=b.classList.toggle('on');b.textContent=on?'✓':'+';if(on)toast('Added to today\'s workout')};
let water=0;function renderWater(){$('#glass').innerHTML=Array.from({length:8},(_,i)=>`<i class="${i<water?'f':''}"></i>`).join('');$('#wTxt').textContent=`${water}/8`}renderWater();
$('#water').onclick=e=>{const g=e.target.closest('#glass i');if(g){const i=[...$$('#glass i')].indexOf(g);const to=i<water?i:i+1;const add=to>water;water=to;renderWater();if(add)checkXP(5,'Water');save();return}
  if(water<8){water++;renderWater();checkXP(5,'Water');save()}else toast('8 of 8. Done for today')};
/* ---- Food ---- */
const FMEALS=['Breakfast','Lunch','Dinner','Snack'];const FBASE={Breakfast:500,Lunch:700,Dinner:900,Snack:300};const FEND={Breakfast:10.5,Lunch:15,Dinner:21,Snack:24};
const FMAC={p:40,c:30,f:30};const FCHK={};let fdOpen=null,fdEditing=false,fdSave=false;
const mx=(n,k,p,c,f)=>[n,k,p??Math.round(k*.25/4),c??Math.round(k*.45/4),f??Math.round(k*.3/9)];
const FLOG={Breakfast:[],Lunch:[],Dinner:[],Snack:[]};
/* Usual = the last day's items for that meal; Recent = other items you've logged for it lately */
const FUSUAL={Breakfast:null,Lunch:null,Dinner:null,Snack:null},FREC={Breakfast:[],Lunch:[],Dinner:[],Snack:[]};
/* last 6 days; null = not logged (left out of the average) */
const FWEEK=[];
function recalcFood(){FWEEK.length=0;for(let i=6;i>=1;i--){const d=addDays(TODAY,-i),x=D.days[d];FWEEK.push([dayShort(d),x&&x.food&&x.food.logged?x.food.total:null])}
  const past=Object.keys(D.days).filter(d=>d<TODAY&&D.days[d].flog).sort().reverse();
  FMEALS.forEach(m=>{const u=past.find(d=>(D.days[d].flog[m]||[]).length);if(u){const it=D.days[u].flog[m];FUSUAL[m]=['Usual '+m.toLowerCase(),it.map(x=>x[0]).join(', ').slice(0,60),it.reduce((t,x)=>t+x[1],0),it]}else FUSUAL[m]=null;
    const seen=new Set(),R=[];past.slice(0,21).forEach(d=>(D.days[d].flog[m]||[]).forEach(x=>{if(!seen.has(x[0])&&R.length<6){seen.add(x[0]);R.push(x)}}));FREC[m]=R})}
const SAVE={k:1500,days:17,start:null};let svK=1500,svDay=17;
const mealK=m=>FLOG[m].reduce((a,x)=>a+x[1],0),fdTotal=()=>FMEALS.reduce((t,m)=>t+mealK(m),0),baseDay=()=>FMEALS.reduce((t,m)=>t+FBASE[m],0);
const mClosed=m=>FCHK[m]!==undefined?FCHK[m]:nowH()>=FEND[m];
const fdBank=()=>Math.max(-500,Math.min(500,FWEEK.filter(x=>x[1]!=null).reduce((t,x)=>t+baseDay()-x[1],0)));
const saveOn=()=>fdSave&&SAVE.start&&TODAY<addDays(SAVE.start,SAVE.days);
const saveCut=()=>saveOn()?Math.round(SAVE.k/SAVE.days):0;
const dayTarget=()=>baseDay()+fdBank()-saveCut();
const todayLogged=()=>FMEALS.every(m=>mClosed(m)&&FLOG[m].length);
function weekAvg(){const L=FWEEK.filter(x=>x[1]!=null).map(x=>x[1]);if(todayLogged())L.push(fdTotal());return L.length?Math.round(L.reduce((a,b)=>a+b,0)/L.length):0}
const nowMeal=()=>FMEALS.find(m=>!mClosed(m))||'Snack';
const FTOL=50;
const foodOK=()=>todayLogged()&&weekAvg()<=baseDay()+FTOL;
function effTargets(){const D=dayTarget(),B=baseDay(),E={},RL={};FMEALS.forEach(m=>E[m]=FBASE[m]*D/B);
  FMEALS.forEach((m,i)=>{if(!mClosed(m))return;const d=Math.round(E[m]-mealK(m)),later=FMEALS.slice(i+1).filter(x=>!mClosed(x)),w=later.reduce((t,x)=>t+FBASE[x],0);RL[m]=w?d:null;if(w)later.forEach(x=>E[x]+=d*FBASE[x]/w);E[m]=mealK(m)});
  FMEALS.forEach(m=>E[m]=Math.round(E[m]));return {E,RL}}
const macGoal=k=>Math.round(dayTarget()*FMAC[k]/100/(k==='f'?9:4)),macEat=k=>FMEALS.reduce((t,m)=>t+FLOG[m].reduce((a,x)=>a+(x[{p:2,c:3,f:4}[k]]||0),0),0);
function fdHead(){const T=fdTotal(),G=dayTarget(),L0=G-T,o=L0<0;$('#fdSum').textContent=$('#fdTot').textContent=Math.abs(L0).toLocaleString();
  $('#fdSumS').textContent=`kcal ${o?'over':'left'} · today ${G.toLocaleString()}`;$('#fdTotS').textContent=o?'kcal over':'kcal left';$('#fdSum').style.color=$('#fdTot').style.color=o?'var(--ember)':''}
function renderFood(){recalcFood();fdHead();$('#fdEdit').textContent=fdEditing?'Done':'Edit targets';
  const ring=(v,c)=>`<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" fill="none" stroke="#2c2c32" stroke-width="7"/><circle cx="30" cy="30" r="24" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(Math.min(1,v)*150.8).toFixed(1)} 151" transform="rotate(-90 30 30)"/></svg>`;
  $('#fdMac').innerHTML=[['p','Protein','#fff'],['c','Carbs','#fff'],['f','Fat','#fff']].map(([k,n,c])=>{const e=macEat(k),g=macGoal(k);return `<div><div class="rg">${ring(e/g,e>g?'var(--ember)':c)}<b>${e}g</b></div><span>${n}</span>${fdEditing?`<div class="tst"><button data-md="${k}|-1" aria-label="Less">−</button><b>${FMAC[k]}%</b><button data-md="${k}|1" aria-label="More">+</button></div>`:`<small>of ${g}g · ${FMAC[k]}%</small>`}</div>`}).join('');
  const B=baseDay(),days=[...FWEEK,['Mo',todayLogged()?fdTotal():null,1]],mxk=Math.max(B*1.35,...days.map(x=>x[1]||0)),avg=weekAvg(),bank=fdBank(),ok=foodOK();
  {const lo=B*.6,hi=B*1.25,pos=v=>Math.max(0,Math.min(100,(v-lo)/(hi-lo)*100)),ov=avg>B+FTOL;
  $('#fdWeek').innerHTML=`<div class="r2"><span class="lab" style="color:#9b958c">7-day average</span><button class="sv${saveOn()?' on':''}" id="fdSaveB">${saveOn()?`Saving +${SAVE.k.toLocaleString()}`:'Save +'}</button></div>
    <div class="r2" style="align-items:baseline"><span><b class="n" style="font-size:30px;color:${ov?'var(--ember)':'#fff'}">${avg?avg.toLocaleString():'—'}</b><small style="color:#9b958c;font:600 13px var(--f)"> / ${B.toLocaleString()}</small></span><span class="st"><span class="${ok?'ok':''}">${!avg?'Builds as you log':ok?'Counts for Day won':todayLogged()?(ov?`${(avg-B).toLocaleString()} over`:avg>B?`On track · ${avg-B} over is fine`:'On track'):(ov?`${(avg-B).toLocaleString()} over · log all meals`:'On track · log all meals')}</span></span></div>
    <div class="gauge"><s style="left:${pos(B-FTOL)}%;width:${pos(B+FTOL)-pos(B-FTOL)}%"></s><i style="width:${pos(avg)}%;background:${ov?'var(--ember)':'#fff'}"></i><b style="left:${pos(B)}%"></b></div>`}
  const {E,RL}=effTargets();
  $('#fdMeals').innerHTML=FMEALS.map(m=>{const k=mealK(m),t=E[m],l=t-k,o=l<-FTOL,c=mClosed(m),r=RL[m];
    const right=fdEditing?`<span class="tst"><button data-td="-1" aria-label="Lower">−</button><b>${FBASE[m]}</b><button data-td="1" aria-label="Raise">+</button></span>`
      :c?`<span class="rl">${!FLOG[m].length?'Not logged':r==null?k+' kcal':Math.abs(r)<=FTOL?'On target':r>0?`+${r} to later meals`:`−${-r} from later meals`}</span>`
      :Math.abs(l)<=FTOL&&k?`<span class="ml"><b>✓</b>on target</span>`:`<span class="ml${o?' o':''}"><b>${Math.abs(l)}</b>${l<0?'over':'left'}</span>`;
    const us=!fdEditing&&!c&&!FLOG[m].length&&FUSUAL[m]?`<button class="fus" data-us>+ Usual · ${FUSUAL[m][2]}</button>`:'';
    return `<div class="fm${c?' cl':''}" data-fm="${m}"><div class="r2"><span class="mh">${fdEditing?'':`<button class="mck${c?' on':''}" data-ck aria-label="${c?'Reopen':'Check off'} ${m}">${c?'✓':''}</button>`}<b class="mn">${m}</b>${us}</span>${right}</div>`
    +(fdEditing||c?'':`<div class="mb"><i style="width:${t?Math.min(100,k/t*100):100}%;${o?'':'background:#fff'}"></i></div>`)
    +(fdOpen===m&&!fdEditing?FLOG[m].map((x,i)=>`<div class="it">${x[0]}<small>${x[1]}<button data-fx="${i}" aria-label="Remove">✕</button></small></div>`).join('')||'<div class="it" style="color:#9b958c">Nothing yet</div>':'')+'</div>'}).join('');
  {const b=$('#fdSaveB');if(b)b.onclick=e=>{e.stopPropagation();openSave()}}}
$('#fdMeals').onclick=e=>{const c=e.target.closest('[data-fm]');if(!c)return;const m=c.dataset.fm;
  if(e.target.closest('[data-us]')){const u=FUSUAL[m];if(!u)return;u[3].forEach(x=>FLOG[m].push([...x]));renderFood();checkWon();save();toast(`${m} · ${u[1]} · ${u[2]} kcal`);return}
  const td=e.target.closest('[data-td]');if(td){FBASE[m]=Math.max(0,FBASE[m]+50*+td.dataset.td);renderFood();return}
  const x=e.target.closest('[data-fx]');if(x){FLOG[m].splice(+x.dataset.fx,1);renderFood();checkWon();return}
  const ck=e.target.closest('[data-ck]');if(ck){const was=mClosed(m);FCHK[m]=!was;renderFood();if(!was){const r=effTargets().RL[m];toast(!FLOG[m].length?m+' · not logged':r>0?`${m} done · +${r} rolls to later meals`:r<0?`${m} done · −${-r} from later meals`:m+' done')}checkWon();return}
  if(fdEditing)return;fdOpen=fdOpen===m?null:m;renderFood()};
$('#fdMac').onclick=e=>{const b=e.target.closest('[data-md]');if(!b)return;const [k,d]=b.dataset.md.split('|');FMAC[k]=Math.max(5,Math.min(70,FMAC[k]+5*+d));renderFood();const t=FMAC.p+FMAC.c+FMAC.f;if(t!==100)toast(`Macros add up to ${t}%`)};
$('#fdEdit').onclick=()=>{fdEditing=!fdEditing;renderFood()};
const svDate=k=>fmtDay(addDays(TODAY,k));
function renderSave(){$('#svK').textContent='+'+svK.toLocaleString();$('#svPer').textContent=`−${Math.round(svK/svDay)} kcal a day until ${svDate(svDay)}`;
  $('#svDays').innerHTML=Array.from({length:30},(_,i)=>i+1).map(k=>`<button class="${k===svDay?'on':''}" data-sd="${k}">${svDate(k)}</button>`).join('');$('#svOff').style.display=saveOn()?'':'none'}
function openSave(){if(saveOn()){svK=SAVE.k;svDay=Math.max(1,SAVE.days-Math.round((dObj(TODAY)-dObj(SAVE.start))/864e5))}renderSave();openSheet('save');const on=$('#svDays .on');if(on)$('#svDays').scrollLeft=on.offsetLeft-120}
$('#svMinus').onclick=()=>{svK=Math.max(250,svK-250);renderSave()};$('#svPlus').onclick=()=>{svK=Math.min(5000,svK+250);renderSave()};
$('#svDays').onclick=e=>{const b=e.target.closest('[data-sd]');if(!b)return;svDay=+b.dataset.sd;renderSave()};
$('#svGo').onclick=()=>{Object.assign(SAVE,{k:svK,days:svDay,start:TODAY,d:svDate(svDay)});fdSave=true;save();closeSheet();renderFood();toast(`+${svK.toLocaleString()} kcal saved for ${SAVE.d}`)};
$('#svOff').onclick=()=>{fdSave=false;save();closeSheet();renderFood();toast('Saving off')};fdHead();
/* Log food focus mode — USDA SR Legacy list from WRKT: [name,kcal,protein,carbs,fat,servingLabel,servingG] per 100 g */
let FOODS=null,FWD=null,FA={m:'Lunch',hit:null,q:1};
let FOODS_P=null;function loadFoods(){if(FOODS||FOODS_P)return;FOODS_P=fetch(import.meta.env.BASE_URL+'foods.json').then(r=>r.json()).then(d=>{FOODS=d;FWD=FOODS.map(r=>r[0].toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean));if(cur==='fadd'&&$('#faQ').value.trim())faList()}).catch(()=>{FOODS_P=null})}
const PROC=new Set(['breaded','fried','frozen','prepackaged','dehydrated','canned','mix','restaurant','fast','babyfood','imitation','dry','dried','powder','powdered','sifted','duck','goose','quail','substitute']);
const FSYN={oatmeal:'cereals oats','chicken breast':'chicken broiler breast meat only',salmon:'fish salmon',eggs:'egg whole',egg:'egg whole',steak:'beef steak'};
function searchFoods(q){loadFoods();if(!FOODS)return[];q=q.toLowerCase().trim();q=FSYN[q]||q;const qs=q.split(/[^a-z0-9%]+/).filter(Boolean).map(w=>w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w);if(!qs.length)return[];const out=[];
  for(let i=0;i<FOODS.length;i++){const W=FWD[i];if(!qs.every(w=>W.some(x=>x.startsWith(w))))continue;const n=FOODS[i][0];
    let sc=W.length+(/^[A-Z0-9'&.\- ]{3,},/.test(n)?20:0)+W.filter(x=>PROC.has(x)).length*3-(W[0].startsWith(qs[0])?6:0)-qs.filter(w=>W.includes(w)).length*2-(/^1 (large|medium|small|egg|piece|slice|fruit|item|whole)/i.test(FOODS[i][5]||'')?5:0);out.push([sc,i])}
  return out.sort((a,b)=>a[0]-b[0]).slice(0,40).map(x=>FOODS[x[1]])}
const tidyF=n=>{let t=n.replace(/\s+/g,' ');if(/^[A-Z0-9'&.\- ]{3,},/.test(t))t=t.replace(/^([^,]+),/,(m,a)=>a.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())+',');return t};
const servG=r=>r[6]||100,servL=r=>r[5]||'100 g';
function faHead(){const m=FA.m,l=effTargets().E[m]-mealK(m);$('#faMealN').textContent=m;$('#faLeft').textContent=Math.abs(l);$('#faLeft').style.color=l<0?'var(--ember)':'';$('#faLeftS').textContent=l<0?'over':'left'}
function faList(){const q=$('#faQ').value.trim();let h='';
  if(!q)h=(FUSUAL[FA.m]?`<button class="farow fusual" data-usual><span><b>${FUSUAL[FA.m][0]}</b><small>${FUSUAL[FA.m][1]} · ${FUSUAL[FA.m][2]} kcal</small></span><i>+</i></button>`:'')+(FREC[FA.m].length?'<div class="fh">Recent</div>':'<div class="fh">Search 7,448 foods above. What you log shows up here next time.</div>')+FREC[FA.m].map((x,i)=>`<button class="farow" data-rq="${i}"><span><b>${x[0]}</b><small>${x[1]} kcal</small></span><i>+</i></button>`).join('');
  else{const R=searchFoods(q);h=R.length?R.map((r,i)=>`<button class="farow" data-hi="${FOODS.indexOf(r)}"><span><b>${tidyF(r[0])}</b><small>${servL(r)} · ${Math.round(r[1]*servG(r)/100)} kcal</small></span><i>›</i></button>`).join(''):'<div class="fh">No matches</div>'}
  $('#faList').innerHTML=h;$('#faList').scrollTop=0}
function faMode(p){$('#faS').hidden=p;$('#faP').hidden=!p;$('#faGo').textContent=p?'Add':'Done';$('#faBack').style.visibility=p?'visible':'hidden'}
function faPortion(){const r=FA.hit,g=servG(r)*FA.q,k=x=>Math.round(x*g/100);$('#faName').textContent=tidyF(r[0]).split(',').slice(0,2).join(',');$('#faK').textContent=k(r[1]);
  $('#faMac').innerHTML=`<span><b>${k(r[2])}g</b>protein</span><span><b>${k(r[3])}g</b>carbs</span><span><b>${k(r[4])}g</b>fat</span>`;
  $('#faQty').textContent=`${FA.q} × ${servL(r)}`;$('#faG').textContent=`${Math.round(g)} g`}
function openFoodLog(m){recalcFood();FA={m:m||nowMeal(),hit:null,q:1};go('fadd');$('#faQ').value='';faHead();faMode(false);faList();setTimeout(()=>{loadFoods()},50)}
function faAdd(name,kcal,p,c,f){FLOG[FA.m].push(mx(name,kcal,p,c,f));save();faHead();renderFood();toast(`${FA.m} · +${kcal} kcal`)}
$('#fdLog').onclick=()=>openFoodLog(fdOpen);
$('#faX').onclick=()=>go('food');
$('#faMeal').onclick=()=>{FA.m=FMEALS[(FMEALS.indexOf(FA.m)+1)%4];faHead();if(!$('#faS').hidden)faList()};
$('#faQ').oninput=()=>{clearTimeout(faList.t);faList.t=setTimeout(faList,120)};
$('#faList').onclick=e=>{if(e.target.closest('[data-usual]')){const u=FUSUAL[FA.m];if(!u)return;u[3].forEach(x=>FLOG[FA.m].push([...x]));faHead();renderFood();toast(`${FA.m} · +${u[2]} kcal`);checkWon();save();return}const r=e.target.closest('[data-rq]');if(r){const x=FREC[FA.m][+r.dataset.rq];faAdd(x[0],x[1],x[2],x[3],x[4]);checkWon();return}
  const h=e.target.closest('[data-hi]');if(h){FA.hit=FOODS[+h.dataset.hi];FA.q=1;faPortion();faMode(true)}};
$('#faP').onclick=e=>{const b=e.target.closest('[data-qd]');if(!b)return;FA.q=Math.max(.5,FA.q+.5*+b.dataset.qd);faPortion()};
$('#faBack').onclick=()=>faMode(false);
$('#faGo').onclick=()=>{if($('#faP').hidden){go('food');return}const r=FA.hit,g=servG(r)*FA.q/100;faAdd(tidyF(r[0]).split(',').slice(0,2).join(','),Math.round(r[1]*g),Math.round(r[2]*g),Math.round(r[3]*g),Math.round(r[4]*g));$('#faQ').value='';faList();faMode(false)};
/* ---- Weight ---- */
let wtIn='',wtToday=false;const WTH=()=>Object.keys(D.weights).sort().filter(d=>daysAgo(d)<30).map(d=>D.weights[d]);
function renderWt(){const v=WTH(),N=v.length,L=N-1,mn=Math.min(...v)-.5,mx=Math.max(...v)+.5,pt=v.map((y,i)=>`${(N>1?i/L*296+2:150).toFixed(1)},${(66-(y-mn)/(mx-mn)*62).toFixed(1)}`);if(!N){$('#wtSvg').innerHTML='';$('#wtTrend').textContent='Your 30-day trend builds here';const n=$('#wtNum');n.textContent=wtIn||'0';n.classList.toggle('ph',!wtIn);$('#wtPad').innerHTML=['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k=>`<button data-k="${k}">${k}</button>`).join('');return}
  $('#wtSvg').innerHTML=`<polyline points="${pt.join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${pt[L].split(',')[0]}" cy="${pt[L].split(',')[1]}" r="4" fill="var(--ember)"/>`;
  const d=(v[L]-v[0]).toFixed(1);$('#wtTrend').textContent=N>1?`${d>0?'+':''}${d} lb · 30 days`:'One weigh-in so far';
  const n=$('#wtNum');n.textContent=wtIn||v[L].toFixed(1);n.classList.toggle('ph',!wtIn);
  $('#wtPad').innerHTML=['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k=>`<button data-k="${k}">${k}</button>`).join('')}
$('#lgWt').onclick=()=>{wtIn='';renderWt();openSheet('weight')};
$('#wtPad').onclick=e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;if(k==='⌫')wtIn=wtIn.slice(0,-1);else if(k==='.'){if(!wtIn.includes('.'))wtIn=(wtIn||'0')+'.'}else if(wtIn.replace('.','').length<4&&!/\.\d$/.test(wtIn))wtIn+=k;renderWt()};
$('#wtSave').onclick=()=>{const h=WTH(),v=parseFloat(wtIn)||h[h.length-1];if(!v||v<50||v>800)return toast('Type your weight first');const first=!D.weights[TODAY];D.weights[TODAY]=v;wtToday=true;save();paintBody();closeSheet();if(first)checkXP(5,'Weight');else toast('Weight updated')};
/* ---- Sleep ---- */
const T10=(a,b)=>{const o=[];for(let m=a;m<=b;m+=10)o.push(m);return o};
const BEDS=T10(20*60,26*60),WAKES=T10(4*60,11*60);let slBed=23*60+20,slWake=6*60+50,slQv=4;
const tlab=m=>{m=m%1440;const h=Math.floor(m/60),mm=m%60;return `${h%12||12}:${String(mm).padStart(2,'0')} ${h<12?'AM':'PM'}`};
const durL=()=>{const d=slWake+1440-slBed;return `${Math.floor(d/60)}h ${String(d%60).padStart(2,'0')}m`};
function wheel(el,list,val,set){el.innerHTML=list.map(m=>`<div data-m="${m}">${tlab(m)}</div>`).join('');const it=[...el.children];
  const mark=()=>{const i=Math.max(0,Math.min(list.length-1,Math.round(el.scrollTop/44)));it.forEach((x,j)=>x.classList.toggle('on',j===i));set(list[i]);$('#slTot').textContent=durL()};
  el.onscroll=mark;el.scrollTop=list.indexOf(val)*44;mark();it.forEach((x,j)=>x.onclick=()=>el.scrollTo({top:j*44,behavior:'smooth'}))}
function renderSl(){$('#slQ').innerHTML=[1,2,3,4,5].map(q=>`<button class="${q===slQv?'on':''}" data-q="${q}">${q}</button>`).join('')}
$('#lgSl').onclick=()=>{openSheet('sleep');renderSl();requestAnimationFrame(()=>{wheel($('#whBed'),BEDS,slBed,v=>slBed=v);wheel($('#whWake'),WAKES,slWake,v=>slWake=v)})};
$('#slQ').onclick=e=>{const b=e.target.closest('[data-q]');if(!b)return;slQv=+b.dataset.q;renderSl()};
$('#sleepSave').onclick=()=>{const first=!D.sleep[TODAY];D.sleep[TODAY]={bed:slBed,wake:slWake,q:slQv,min:slWake+1440-slBed};save();paintBody();closeSheet();if(first)checkXP(5,'Sleep');else toast('Sleep updated')};

/* ---------- Soul ---------- */
function setSG(v){const k=Math.round(v/100*8);$$('#tdG i').forEach((x,i)=>x.classList.toggle('on',i===k))}
const ARCH=[{n:'King',s:0,subs:[['Order',0],['Purpose',0],['Blessing others',0]],sh:['Weakling','Tyrant'],g:50},
  {n:'Warrior',s:0,subs:[['Discipline',0],['Courage',0],['Decisive action',0]],sh:['Masochist','Sadist'],g:50},
  {n:'Magician',s:0,subs:[['Learning',0],['Self-awareness',0],['Mastery',0]],sh:['Innocent','Manipulator'],g:50},
  {n:'Lover',s:0,subs:[['Connection',0],['Presence',0],['Creativity',0]],sh:['Impotent','Addict'],g:50}];
const QUESTS=[];
let qi=0,qdone=0;
const SKR=118,sp=i=>{const a=(i*30-90+15)*Math.PI/180;return [SKR*Math.cos(a),SKR*Math.sin(a)]};
function skyDraw(){const svg=$('#sky');if(!svg)return;let s=`<defs><filter id="sglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="sglow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs>`;
  ['King','Warrior','Magician','Lover'].forEach((n,k)=>{const r=160,a0=(k*90-90+8)*Math.PI/180,a1=((k+1)*90-90-8)*Math.PI/180,bot=k===1||k===2,[b0,b1]=bot?[a1,a0]:[a0,a1];
    s+=`<path id="sarc${k}" d="M${r*Math.cos(b0)} ${r*Math.sin(b0)}A${r} ${r} 0 0 ${bot?0:1} ${r*Math.cos(b1)} ${r*Math.sin(b1)}" fill="none" stroke="#2c2c32" stroke-width="1.2"/>`;
    s+=`<text class="st" data-k="${k}" font-family="Archivo, sans-serif" font-size="10" font-weight="800" letter-spacing="2" fill="var(--gold)" dy="${bot?10:-5}"><textPath href="#sarc${k}" startOffset="50%" text-anchor="middle">${n.toUpperCase()}</textPath></text>`});
  const shape=AVG.map((v,i)=>{const [x,y]=sp(i);const f=.15+.85*v;return (x*f).toFixed(1)+','+(y*f).toFixed(1)}).join(' ');
  s+=`<polygon points="${shape}" fill="rgba(255,176,0,.10)" stroke="#FFD27A" stroke-width="1.6" stroke-linejoin="round" filter="url(#sglow)"/>`;
  const lo=AVG.indexOf(Math.min(...AVG));
  TR.forEach(([n,k],i)=>{const [x,y]=sp(i),f=1.2,lx=x*f,ly=y*f,anc=Math.abs(lx)<16?'middle':lx>0?'start':'end',dy=Math.abs(lx)<16?(ly<0?-2:10):4,v=AVG[i],weak=i===lo;
    const sx=x*(.15+.85*v),sy=y*(.15+.85*v);
    s+=`<g class="st${weak?' weak':''}" data-k="${k}" data-t="${i}"><circle class="halo" cx="${x}" cy="${y}" r="10" fill="${weak?'var(--ember)':'#FFB000'}" opacity="${weak?.5:0}" filter="url(#sglow2)"/><circle cx="${x}" cy="${y}" r="${1.8+2.4*v}" fill="${weak?'var(--ember)':'#EDE6D8'}" opacity="${.45+.55*v}"/><circle cx="${sx}" cy="${sy}" r="2.4" fill="#FFE7A8"/>${weak?`<text x="${x*.84}" y="${y*.84+4}" text-anchor="${Math.abs(x)<16?'middle':x>0?'end':'start'}" font-family="Archivo, sans-serif" font-size="11.5" font-weight="800" fill="var(--ember)" stroke="var(--ink)" stroke-width="4" paint-order="stroke">${n}</text>`:""}<circle cx="${x}" cy="${y}" r="20" fill="transparent"/></g>`});
  svg.innerHTML=s}
$('#v-soul').addEventListener('click',e=>{const t=e.target.closest('#sky .st');if(t){if(t.dataset.t!=null)openQuests(+t.dataset.t);else openTorch(+t.dataset.k)}});
const POOLS={"Order": [["M", "Plan tomorrow in writing before bed"], ["M", "Clear one cluttered space (desk, car, closet)"], ["S", "Set up or reset your weekly calendar"], ["M", "Fix one thing you've been putting off fixing"], ["M", "Go through your finances for 20 minutes"], ["S", "Clear your inbox or message backlog"], ["M", "Write down your rules for one area of life (phone, money, mornings)"], ["L", "Spend one full day on your planned schedule"]], "Purpose": [["M", "Write or revise your personal mission in one paragraph"], ["S", "Review the past week: what moved you toward your goals, what didn't"], ["M", "Pick the one priority for this month and write why it matters"], ["L", "Write your eulogy as you'd want it read"], ["M", "Cut one commitment that doesn't serve your purpose"], ["L", "Imagine yourself 10 years from now and write a letter from him"], ["S", "Check one decision this week against your values"], ["M", "Spend 30 minutes thinking with no input (no phone, no music)"]], "Blessing others": [["S", "Tell someone specifically what they did well"], ["M", "Help someone without being asked or telling anyone"], ["L", "Teach someone a skill you have"], ["M", "Write a thank-you note to someone who shaped you"], ["S", "Introduce two people who should know each other"], ["S", "Publicly credit someone else's work"], ["M", "Ask someone what they need and follow through"], ["M", "Forgive a small debt or grudge out loud"]], "Discipline": [["M", "Go to bed on time tonight"], ["S", "Do your hardest task first, before anything else"], ["M", "Take 3 swaps in one day"], ["M", "Go the full day without your weakest-link habit"], ["M", "Finish a workout exactly as planned, no shortcuts"], ["S", "Cold shower"], ["S", "Keep your phone out of the bedroom for a night"], ["M", "Do a task to completion with no breaks to check your phone"]], "Courage": [["L", "Have a conversation you've been avoiding"], ["M", "Say no to something you'd normally agree to out of guilt"], ["M", "Share a piece of your writing with someone"], ["M", "Ask for something you want (raise, favor, feedback)"], ["L", "Admit a mistake to the person it affected"], ["M", "Do something you're bad at in front of others"], ["M", "Disagree honestly in a conversation"], ["L", "Face one small fear on purpose and log what happened"]], "Decisive action": [["M", "Make a decision you've been stalling on, today"], ["L", "Ship something unfinished but good enough"], ["M", "Clear 5 small open tasks in one sitting"], ["S", "Set a deadline and tell someone"], ["M", "Cancel or quit something you've been half-doing"], ["S", "Make a choice in under 2 minutes that you'd normally overthink"], ["M", "Act today on an idea you had today"], ["S", "Send the message you've been drafting in your head"]], "Learning": [["M", "Read for 30 minutes on a subject new to you"], ["M", "Learn one thing and explain it to someone else"], ["M", "Take notes on a book chapter in your own words"], ["M", "Watch or attend a lecture and write 3 takeaways"], ["M", "Ask an expert a question"], ["L", "Learn the basics of a skill you've always dismissed"], ["M", "Read something you expect to disagree with"], ["L", "Review old notes and connect two ideas"]], "Self-awareness": [["M", "Shadow entry: who irritated you today, and where is that in you?"], ["S", "Log a dream within 10 minutes of waking"], ["M", "Persona audit: where did you act fake today, and why?"], ["S", "Notice a strong emotion, name it, and trace where it came from"], ["L", "Ask a trusted friend for one honest criticism"], ["M", "Review this week's emotion check-ins and find a pattern"], ["L", "Write a dialogue with a part of yourself you dislike (active imagination)"], ["S", "Sit for 10 minutes and just watch your thoughts"], ["S", "Catch yourself justifying something today. What were you actually protecting?"], ["S", "Notice when you interrupt someone. What did you need in that moment?"], ["M", "Projection check: name a trait you admire in someone, and find where it lives in you"], ["M", "Track every time you check your phone for no reason. What were you avoiding?"], ["S", "Before one reaction today, pause 5 seconds and name the feeling first"], ["M", "Notice who you perform for today, and how you change around them"], ["S", "Find one belief you hold that you never chose. Where did it come from?"], ["M", "Spot a moment of envy today and write what it says you want"], ["M", "Watch for your default excuse today. Count how often you use it"], ["S", "Notice where you feel stress in your body when it shows up"], ["M", "Pick one recurring argument or conflict. What is your part in it?"], ["L", "Ask someone close: \"What do I do that I don't see?\" Just listen"], ["M", "When you feel defensive today, ask what the criticism got right"], ["S", "Name the mood you woke up in, then check at night what fed it"], ["M", "Look for one way you are acting like a parent you swore you would not be"], ["L", "Spend a day saying only what you mean: no filler agreement, no white lies"], ["M", "Notice what you daydream about today. What does it say you are missing?"], ["S", "Catch one story you told yourself about someone today, and look for another version"]], "Mastery": [["L", "60 minutes of deliberate practice at your craft"], ["M", "Study a master's work and copy their technique"], ["L", "Redo a past piece better"], ["M", "Get feedback on your work and apply one note"], ["M", "Practice the part you're weakest at, not the fun part"], ["M", "Set a measurable skill goal and test yourself against it"], ["L", "Finish a small piece start to end in one sitting"], ["M", "Teach or write about a technique you've learned"]], "Connection": [["S", "Call (not text) someone you care about"], ["M", "Have a meal with someone, phones away"], ["S", "Reach out to someone you've lost touch with"], ["M", "Ask someone a deep question and just listen"], ["M", "Plan something for someone you love"], ["S", "Say \"I love you\" or \"I'm proud of you\" to someone"], ["M", "Spend an hour with family with no agenda"], ["M", "Share something vulnerable with someone close"], ["L", "Write a letter to someone you love, and give it to them"]], "Presence": [["S", "Meditate for 10 minutes"], ["M", "Take a walk with no phone or headphones"], ["S", "Eat one meal slowly, with no screens"], ["M", "Spend 2 hours phone-free"], ["M", "Watch a sunrise or sunset start to finish"], ["S", "Do one ordinary task with full attention"], ["M", "Spend time in nature for 30 minutes"], ["S", "Do a body scan before sleep"]], "Creativity": [["M", "Make something with no goal of being good"], ["M", "Try a creative medium you don't normally use"], ["S", "Write for fun, not for a project"], ["M", "Cook something without a recipe"], ["M", "Play music, draw or sketch for 20 minutes"], ["M", "Rearrange or redesign a space"], ["L", "Go somewhere new and collect ideas"], ["S", "Play: do something purely for enjoyment"]]};
const PKEY={Blessing:'Blessing others',Decisive:'Decisive action','Self-aware':'Self-awareness'};
const SZ={S:['Small',10],M:['Medium',25],L:['Large',50]};
function openQuests(i){$('#qsHint').textContent='Least recently done first. Add one to today.';const [n,k]=TR[i],key=PKEY[n]||n,lo=AVG.indexOf(Math.min(...AVG));
  $('#qsArch').textContent=ARCH[k].n+(i===lo?' · needs work':'');$('#qsName').textContent=key;
  const PL=poolFor(key);$('#qsList').innerHTML=PL.slice(0,5).map(([sz,q],j)=>`<div class="qrow"><div><b>${q}</b><small>${SZ[sz][0]} · +${SZ[sz][1]} XP</small></div><button data-q="${j}">Add</button></div>`).join('');
  $('#qsList').onclick=e=>{const b=e.target.closest('[data-q]');if(!b||b.classList.contains('on'))return;const [sz,q]=PL[+b.dataset.q];b.classList.add('on');b.textContent='✓ Added';
    if(QUESTS.slice(qi).length>=3&&QUESTS.length-qdone>=3){toast('3 quests a day max');return}QUESTS.splice(qi,0,{a:k,t:key,q,xp:SZ[sz][1],sz:SZ[sz][0]});save();toast("Added to today's quests");setTimeout(()=>{closeSheet();renderQuest(true)},700)};
  openSheet('quests')}
function growTorch(i){skyDraw()}
function renderQuest(anim){const el=$('#quest');if(qi>=QUESTS.length){el.className='quest won'+(anim?' in':'');el.innerHTML=`<span class="lab" style="color:var(--gold)">Today's quests</span><div class="q">All done. The fire's fed.</div><span style="font-size:13px;opacity:.75">${qdone} done · new quests tomorrow</span>`;return}
  const q=QUESTS[qi];el.className='quest'+(anim?' in':'');el.innerHTML=`<div style="display:flex;justify-content:space-between"><span class="lab">Quest ${qi+1} of ${QUESTS.length} · ${ARCH[q.a].n}</span><span class="lab">+${q.xp} XP</span></div><div class="q">${q.q}</div><div style="display:flex;gap:4px;align-items:center;margin-top:auto"><button class="btn" id="qDone">Done</button><button class="btn ghost" id="qSkip">Skip</button><span style="font-size:13px;opacity:.9;margin-left:auto">${q.t} · ${q.sz}</span></div>`;
  $('#qDone').onclick=()=>{const a=ARCH[q.a];el.classList.add('won');$('#qDone').textContent='✓ Done';checkXP(q.xp,a.n);{const ti=TR.findIndex(t=>q.t.startsWith(t[0]));if(ti>=0)AVG[ti]=Math.min(1,AVG[ti]+.08)}D.questLast[q.q]=TODAY;D.questLog.push({d:TODAY,t:q.t});q.done=1;growTorch(q.a);qdone++;$('#soulPct').textContent=PV('Soul');checkWon();save();setTimeout(()=>nextQuest(),900)};
  $('#qSkip').onclick=()=>{q.skip=1;nextQuest()}}
function nextQuest(){const el=$('#quest');el.classList.add('out');setTimeout(()=>{qi++;save();renderQuest(true)},300)}
const poolFor=key=>[...(POOLS[key]||[])].sort((x,y)=>(D.questLast[x[1]]||'').localeCompare(D.questLast[y[1]]||''));
const traitKey=i=>PKEY[TR[i][0]]||TR[i][0];
const weakest=()=>AVG.indexOf(Math.min(...AVG));
function questFor(i,skip=0){const key=traitKey(i),[sz,q]=poolFor(key)[skip]||poolFor(key)[0];return {a:TR[i][1],t:key,q,xp:SZ[sz][1],sz:SZ[sz][0]}}
function openActs(P,C,A){if(P==='Soul'){const i=TR.findIndex(([n])=>(PKEY[n]||n)===A);if(i>=0)openQuests(i);return}
  const list=P==='Mind'?MTASK[A]||[]:(BODYT[C]||{})[A]||[],ai=P==='Mind'?axes.findIndex(x=>x.it[0]===A):null;
  $('#qsArch').textContent=P+' · '+C;$('#qsName').textContent=A;$('#qsHint').textContent='Pick one and add it to today.';
  $('#qsList').innerHTML=list.map(([n,d],j)=>`<div class="qrow"><div><b>${n}</b><small>${dlab(d)} · +${d>=1?25:d>=.5?15:10} XP</small></div><button data-q="${j}">Add</button></div>`).join('');
  $('#qsList').onclick=e=>{const b=e.target.closest('[data-q]');if(!b)return;const [n,d]=list[+b.dataset.q];closeSheet();setTimeout(()=>openSlot(-1,{n,p:P,a:ai,d}),250)};
  openSheet('quests')}
let tdF,stF,stG,stOpen={};let LASTWK=0;
function renderStats(){const T=TREE();$('#stOv').textContent=T.v;{const lw=D.days[addDays(TODAY,-7)];LASTWK=lw&&lw.ov!=null?lw.ov:T.v}
  const fw=v=>Math.round(260*FW/FH*(.35+.65*v/100));if(stF)sizeFlame(stF,fw(T.v));if(stG)sizeFlame(stG,fw(LASTWK));{const gw=fw(LASTWK),gh=Math.round(gw*FH/FW),l=$('#stGl');l.style.bottom=Math.round(gh*.6)+'px';l.style.width=Math.round(gw*1.15)+'px'}const dv=T.v-LASTWK;$('#stVs').textContent=`${dv>=0?'+':''}${dv}% vs last week`;$('#stVs').style.color=dv>=0?'var(--green)':'var(--ember)';
  const row=(x,lvl,key,c,kids,path)=>`<button class="srow l${lvl}${kids?' has':''}${stOpen[key]?' open':''}${path?' leaf':''}" data-sk="${key}"${path?` data-path="${path}"`:''}><span class="sn">${kids?'<i class="car">›</i>':''}${x.n}</span><svg class="sring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="none" stroke="#D9D4CC" stroke-width="4.5"/><circle cx="18" cy="18" r="14" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="${(x.v/100*87.96).toFixed(1)} 88" transform="rotate(-90 18 18)"/></svg><b>${x.v}%</b></button>`;
  let h='';T.k.forEach((P,pi)=>{const kp='p'+pi;h+=row(P,0,kp,P.c,1);if(stOpen[kp])P.k.forEach((C,ci)=>{const kc=kp+'c'+ci;h+=row(C,1,kc,P.c,1);if(stOpen[kc])C.k.forEach(A=>h+=row(A,2,'',P.c,0,P.n+'|'+C.n+'|'+A.n))})});
  $('#stTree').innerHTML=h}
$('#stTree').onclick=e=>{const lf=e.target.closest('.srow.leaf');if(lf){const [P,C,A]=lf.dataset.path.split('|');openActs(P,C,A);return}const b=e.target.closest('.srow.has');if(!b)return;const k=b.dataset.sk;stOpen[k]=!stOpen[k];renderStats()};
function openTorch(i){const a=ARCH[i];$('#tdName').textContent=a.n;$('#tdScore').textContent=a.s;$('#tdS1').textContent=a.sh[0];$('#tdS2').textContent=a.sh[1];
  $('#tdSubs').innerHTML=`<div class="lab">Sub-traits</div>`+a.subs.map(([n,v])=>`<div class="sub"><div class="row"><span>${n}</span><b style="${v<60?'color:var(--ember)':''}">${v}</b></div><div class="bar"><i style="width:0%;background:${v<60?'var(--ember)':'var(--gold)'}" data-w="${v}"></i></div></div>`).join('');
  setSG(50);
  go('torch',{note:'torch'});setTimeout(()=>{$$('#tdSubs .bar i').forEach(x=>x.style.width=x.dataset.w+'%');setSG(a.g)},80)}
$('#reflectBtn').onclick=()=>{closeSheet();checkXP(15,'Reflect')};

/* ---------- Soul rating ---------- */
const TR=[['Order',0],['Purpose',0],['Blessing',0],['Discipline',1],['Courage',1],['Decisive',1],['Learning',2],['Self-aware',2],['Mastery',2],['Connection',3],['Presence',3],['Creativity',3]];
let AVG=Array(12).fill(0);
const TRR=82,VB=174,tp=i=>{const a=(i*30-90+15)*Math.PI/180;return [TRR*Math.cos(a),TRR*Math.sin(a)]};
let picks=[],closed=false,finger=null,drawing=false;
function triInit(){const svg=$('#tri');let s=`<defs>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="glow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <radialGradient id="neb"><stop offset="0" stop-color="#FFB000" stop-opacity=".22"/><stop offset="1" stop-color="#FFB000" stop-opacity=".06"/></radialGradient></defs>`;
  ['King','Warrior','Magician','Lover'].forEach((n,k)=>{const r=160,a0=(k*90-90+8)*Math.PI/180,a1=((k+1)*90-90-8)*Math.PI/180,bot=k===1||k===2,[b0,b1]=bot?[a1,a0]:[a0,a1];
    s+=`<path id="arc${k}" d="M${r*Math.cos(b0)} ${r*Math.sin(b0)}A${r} ${r} 0 0 ${bot?0:1} ${r*Math.cos(b1)} ${r*Math.sin(b1)}" fill="none" stroke="#2c2c32" stroke-width="1.2" stroke-linecap="round"/>`;
    s+=`<text font-family="Archivo, sans-serif" font-size="10" font-weight="800" letter-spacing="2" fill="var(--gold)" dy="${bot?10:-5}"><textPath href="#arc${k}" startOffset="50%" text-anchor="middle">${n.toUpperCase()}</textPath></text>`});
  s+=`<g id="tAvg"></g><g id="tLines"></g><g id="tStars">`;
  TR.forEach(([n],i)=>{const [x,y]=tp(i),f=1.2,lx=x*f,ly=y*f,anc=Math.abs(lx)<16?'middle':lx>0?'start':'end',dy=Math.abs(lx)<16?(ly<0?-2:10):4;
    s+=`<g class="star" data-i="${i}"><circle class="halo" cx="${x}" cy="${y}" r="9" fill="#fff" opacity="0" filter="url(#glow2)"/><circle class="core" cx="${x}" cy="${y}" r="2.6" fill="#EDE6D8" style="animation-delay:${-(i*0.37)%2.8}s"/><text x="${lx}" y="${ly+dy}" text-anchor="${anc}" font-family="Archivo, sans-serif" font-size="10.5" font-weight="600" fill="#8f897f">${n}</text></g>`});
  s+=`</g>`;svg.innerHTML=s}
function triDraw(){const avg=AVG.map((v,i)=>{const [x,y]=tp(i);const f=.15+.85*v;return (x*f).toFixed(1)+','+(y*f).toFixed(1)}).join(' ');
  $('#tAvg').innerHTML=`<polygon points="${avg}" fill="url(#neb)" stroke="rgba(255,176,0,.35)" stroke-width="1" stroke-linejoin="round"/>`;
  let l='';const pts=picks.map(tp);
  if(pts.length){const seq=closed?[...pts,pts[0]]:pts;const d=seq.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ');
    if(closed)l+=`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="rgba(255,176,0,.16)" class="triin"/>`;
    l+=`<polyline points="${d}" fill="none" stroke="#FFD27A" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" filter="url(#glow)"/>`;
    if(!closed&&drawing&&finger){const lp=pts[pts.length-1];l+=`<line x1="${lp[0]}" y1="${lp[1]}" x2="${finger[0]}" y2="${finger[1]}" stroke="#FFD27A" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="3 4" stroke-linecap="round"/>`}}
  $('#tLines').innerHTML=l;
  $$('#tStars .star').forEach(g=>{const i=+g.dataset.i,on=picks.includes(i),first=picks.length===3&&!closed&&i===picks[0];g.classList.toggle('on',on);g.classList.toggle('target',first)});
  $('#rateDone').disabled=!closed;$('#rateDone').style.opacity=closed?1:.35;
  $('#rateHint').textContent=closed?picks.map(i=>TR[i][0]).join(' · '):picks.length===3?`Close it: back to ${TR[picks[0]][0]}`:picks.length?`Connect ${3-picks.length} more`:'Connect 3 stars, then close the triangle.'}
function triPt(e){const svg=$('#tri'),r=svg.getBoundingClientRect(),k=(VB*2)/r.width;return [(e.clientX-r.left)*k-VB,(e.clientY-r.top)*k-VB]}
function near(p,rad=17){let best=-1,bd=rad;TR.forEach((_,i)=>{const [x,y]=tp(i),d=Math.hypot(x-p[0],y-p[1]);if(d<bd){bd=d;best=i}});return best}
function step(i){if(i<0||closed)return;if(picks.length===3){if(i===picks[0]){closed=true;if(navigator.vibrate)navigator.vibrate(14)}return}if(picks.includes(i))return;picks.push(i);if(navigator.vibrate)navigator.vibrate(8)}
(function(){const svg=$('#tri');
  svg.addEventListener('pointerdown',e=>{const p=triPt(e),i=near(p,22);
    if(closed||!(picks.length&&i===picks[picks.length-1])){picks=[];closed=false}
    drawing=true;svg.setPointerCapture(e.pointerId);step(i);finger=p;triDraw()});
  svg.addEventListener('pointermove',e=>{if(!drawing)return;finger=triPt(e);step(near(finger));triDraw()});
  const end=()=>{drawing=false;finger=null;triDraw()};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end)})();
$('#triClear').onclick=()=>{picks=[];closed=false;triDraw()};
$('#rateDone').onclick=()=>{if(!closed)return;
  const from=AVG.slice(),to=AVG.map((v,i)=>picks.includes(i)?Math.min(1,v+.08):Math.max(0,v-.01));const t1=performance.now();const tl=$('#tLines');
  (function st(n){const p=Math.min(1,(n-t1)/800),e=1-Math.pow(1-p,3);AVG=from.map((v,i)=>v+(to[i]-v)*e);triDraw();tl.style.opacity=1-e;
    if(p<1&&!reduce)requestAnimationFrame(st);else{AVG=to;DAY().tri=picks.map(i=>traitKey(i));save();picks=[];closed=false;tl.style.opacity=1;triDraw();go(closing?'planflow':'soul');checkXP(15,'Soul check-in');const lo=weakest();if(!closing)setTimeout(()=>toast(`${TR[lo][0]} is your focus this week`),1700)}})(t1)};
let LKT=[['Write 500 words',0],['Pick up dry cleaning',0],['Call Dad',0]],lkWater=5,lkMood=null;
function renderLock(){const d=LKT.filter(x=>x[1]).length;
  $('#lkWidget').innerHTML=`<div class="r2"><span class="lab">Today · ${d+2} of 5</span><span class="lab">🔥 47</span></div>${LKT.map((x,i)=>`<button class="lkr${x[1]?' on':''}" data-lk="${i}"><i>${x[1]?'✓':''}</i>${x[0]}</button>`).join('')}<div class="r2" style="margin-top:2px"><span style="font:600 13px var(--f)">Water ${lkWater}/8</span><button class="lkb" data-lkw>+1</button></div>`;
  $('#lkNote').innerHTML=lkMood?`<span class="lab">Prometheus · now</span><b style="font:600 14px var(--f)">Logged: ${lkMood} · +5 XP</b>`:`<span class="lab">Prometheus · now</span><b style="font:600 14px var(--f)">How are you feeling?</b><div class="lkm">${[['High · −','var(--ember)'],['High · +','var(--gold)'],['Low · −','var(--cobalt)'],['Low · +','#12a36b']].map(([n,c])=>`<button data-lkm="${n}" style="background:${c}">${n}</button>`).join('')}</div>`}
$('#v-lock').onclick=e=>{const t=e.target.closest('[data-lk]');if(t){LKT[+t.dataset.lk][1]^=1;renderLock();return}
  if(e.target.closest('[data-lkw]')){lkWater=Math.min(8,lkWater+1);renderLock();return}
  const m=e.target.closest('[data-lkm]');if(m){lkMood=m.dataset.lkm.replace('·','energy,').replace('−','unpleasant').replace('+','pleasant');renderLock()}};
$('#stkBody').onclick=e=>{const x=e.target.closest('[data-skx]'),r=e.target.closest('[data-sk]'),t=e.target.closest('[data-skt]');
  if(t){const inp=t.parentElement.querySelector('input'),v=inp.value.trim(),k=inp.dataset.ska;if(!v){inp.focus();return}if(k==='ff')STK.ff.push([v,t.dataset.skt]);else STK[k].push(v);renderStakes();return}
  if(!r)return;const [k,i]=r.dataset.sk.split('|');
  if(x){if(k==='ff')STK.ff.splice(+i,1);else STK[k].splice(+i,1);renderStakes();return}
  if(stkMode==='w'){WSP=STK.week[+i];closeSheet();renderPlan();toast('This week: '+WSP)}else if(stkMode==='f'){FORFEIT=STK.ff[+i][0];closeSheet();renderPlan();toast('Forfeit set')}};
$('#stkEdit').onclick=()=>{stkMode=null;renderStakes()};
$('#wkSpoil').onclick=()=>{WSP=rot(STK.week,WSP);save();renderPlan();toast('Week spoil: '+WSP)};
$('#hSpoil').onclick=e=>{e.stopPropagation();HSP=rot(STK.hero,HSP);save();$('#hSpoil').textContent=HSP;toast('Hero spoil: '+HSP)};
/* ---------- Onboarding ---------- */
const OBA={Mind:['Reading','Classwork','Research','Chinese','Skills','Writing','Visual art','Music','Film','Building / code','Cooking','Meditation','Journaling','Social','Planning'],Body:['Strength','Run','Bike','Swim','Row / HIIT','Sport','Stretch','Mobility','Walk','Sleep']};
let obS=1,obSel={Mind:['Reading','Classwork','Chinese','Writing','Music','Meditation','Journaling'],Body:['Strength','Run','Stretch','Walk']},obCon={health:0,cal:0,notif:0},obFoodOK=null,obK=2160,obSp=['Coffee out','One dessert'],obFf=['50 push-ups','Clean the kitchen','Run 5K'];
const OBSP=['One dessert','Coffee out','Popcorn at the movies','A bath or sauna session','Sleep in on Sunday','Pizza night','A new record'],OBHS=['Dinner out / takeaway','Brunch out','Buy a book','A concert or comedy show','Bottle of wine'],OBFF=[['50 push-ups','S'],['Cold shower','S'],['$5 to a cause','S'],['10-min total plank','M'],['Clean the kitchen','M'],['Run 5K','L'],['Clean the bathroom','L']];
function renderOb(){[1,2,3].forEach(i=>$('#ob'+i).style.display=i===obS?'flex':'none');$('#obStep').textContent=`Setup · ${obS} of 3`;$('#obBack').style.display=obS>1?'':'none';
  const chips=(list,sel,c,attr)=>list.map(n=>`<button data-${attr}="${n}" class="${sel.includes(n)?'on':''}" style="--c:${c}">${n}</button>`).join('');
  if(obS===1)$('#obAreas').innerHTML=['Mind','Body'].map(p=>`<div class="obg"><span class="lab" style="color:${PCOL[p]}">${p}<small style="color:var(--muted)">${obSel[p].length} picked</small></span><div class="obch">${chips(OBA[p],obSel[p],PCOL[p],'oa-'+p.toLowerCase())}<button class="add" data-oadd="${p}">+ Your own</button></div></div>`).join('')+`<div class="obg"><span class="lab" style="color:var(--gold)">Soul</span><div style="font-size:13px;color:var(--muted)">King · Warrior · Magician · Lover, 12 traits. Quests are picked from your weakest one.</div></div>`;
  if(obS===2){const row=(k,n,sub)=>`<div class="conr"><span>${n}<small>${sub}</small></span><button class="tgl${obCon[k]?' on':''}" data-oc="${k}" aria-label="${n}"></button></div>`;
    $('#obConn').innerHTML=`<div class="conr"><span>Apple Health + Calendar<small>Come with the iPhone app. For now weight, sleep and water are one tap each.</small></span></div><div class="conr"><span>Reminders<small>Check-ins and Close the day pop up when you open the app. Times are in Settings.</small></span></div>`;
    const per=FMEALS.map(m=>`${m[0]} ${Math.round(obK*FBASE[m]/2400/10)*10}`).join(' · ');
    $('#obFood').innerHTML=`<span class="lab" style="color:#9b958c">Daily calories</span><div class="faqty" style="justify-content:flex-start;gap:14px"><button data-ok="-50" aria-label="Less">−</button><div><b>${obK.toLocaleString()}</b><small>kcal</small></div><button data-ok="50" aria-label="More">+</button></div><span style="font:600 12px var(--f);color:#9b958c">${per}</span><span style="font:600 12px var(--f);color:#9b958c">Macros 40 / 30 / 30${obCon.health?' · Health suggests 2,160':''}</span>`}
  if(obS===3)$('#obStakes').innerHTML=`<div class="obg"><span class="lab">Week spoils<small style="color:var(--muted)">Win 5 of 7</small></span><div class="obch">${chips(OBSP,obSp,'var(--gold)','osp')}</div></div><div class="obg"><span class="lab">Hero spoil<small style="color:var(--muted)">Picked for you · change anytime</small></span><div class="obch">${chips(OBHS,[HSP],'var(--ink)','ohs')}</div></div><div class="obg"><span class="lab">Forfeits<small style="color:var(--muted)">Rolled at random · size up with misses</small></span><div class="obch">${OBFF.map(([n,z])=>`<button data-off="${n}" class="${obFf.includes(n)?'on':''}" style="--c:var(--ember)">${n} · ${z}</button>`).join('')}</div></div>`;
  const ok=obS!==1||obSel.Mind.length+obSel.Body.length>0;$('#obNext').disabled=!ok;$('#obNext').textContent=obS===3?'Start day 1':'Next'}
$('#v-onb').onclick=e=>{const t=e.target;let b;
  if(b=t.closest('[data-oa-mind],[data-oa-body]')){const p=b.dataset.oaMind!=null?'Mind':'Body',n=b.dataset.oaMind??b.dataset.oaBody,a=obSel[p],i=a.indexOf(n);i>=0?a.splice(i,1):a.push(n);renderOb();return}
  if(b=t.closest('[data-oadd]')){const p=b.dataset.oadd,n=prompt('Add your own '+p+' area')||'';if(n.trim()){OBA[p].push(n.trim());obSel[p].push(n.trim())}renderOb();return}
  if(b=t.closest('[data-oc]')){const k=b.dataset.oc;obCon[k]=obCon[k]?0:1;renderOb();if(obCon[k])toast(k==='health'?'Health connected':k==='cal'?'Calendar connected':'Notifications on');return}
  if(b=t.closest('[data-ok]')){obK=Math.max(1200,Math.min(4000,obK+ +b.dataset.ok));renderOb();return}
  if(b=t.closest('[data-osp]')){const n=b.dataset.osp,i=obSp.indexOf(n);i>=0?obSp.splice(i,1):obSp.push(n);renderOb();return}
  if(b=t.closest('[data-ohs]')){HSP=b.dataset.ohs;renderOb();return}
  if(b=t.closest('[data-off]')){const n=b.dataset.off,i=obFf.indexOf(n);i>=0?obFf.splice(i,1):obFf.push(n);renderOb();return}};
$('#obNext').onclick=()=>{if($('#obNext').disabled)return;if(obS<3){obS++;stepIn($('#ob'+obS));renderOb();return}const again=D.setup;
  if(obSp.length){STK.week=OBSP.filter(n=>obSp.includes(n));WSP=STK.week[0]}if(obFf.length)STK.ff=OBFF.filter(([n])=>obFf.includes(n));
  const f=obK/Object.values(FBASE).reduce((a,b)=>a+b,0);FMEALS.forEach(m=>FBASE[m]=Math.round(FBASE[m]*f/10)*10);if(again){save();go('set');return toast('Saved')}startDay1();checkXP(25,'Setup done')};
$('#obBack').onclick=()=>{if(obS>1){obS--;stepDir=-1;stepIn($('#ob'+obS));stepDir=1;renderOb()}};
$('#obSkip').onclick=()=>{if(D.setup)return go('set');startDay1()};
function startOb(){obS=1;obFoodOK=null;$('#obSkip').textContent=D.setup?'Close':'Skip';renderOb()}

/* ---------- Day 1 / blank day ---------- */
let day1=false,blank=false;
function startDay1(){D.setup=true;day1=true;blank=true;newDay(true);save();go('today')}


/* ---------- Settings ---------- */
const NOTIF={am:'9:00 am',pm:'9:00 pm'};
function renderSet(){const r=(k,n,v)=>`<button class="setr" data-st="${k}"><span>${n}</span><small>${v||''}</small><i>›</i></button>`;
  $('#setList').innerHTML=`<div class="setg"><span class="lab">You</span>${r('areas','Your areas',`${obSel.Mind.length} Mind · ${obSel.Body.length} Body`)}${r('routine','Routines','Soon')}${r('food','Food targets',`${Object.values(FBASE).reduce((a,b)=>a+b,0).toLocaleString()} kcal · 40/30/30`)}</div>
  <div class="setg"><span class="lab">Stakes</span>${r('stakes','Spoils + forfeits',`${STK.week.length} week · ${STK.ff.length} forfeits`)}${r('freeze','Streak freeze',`${D.freezes||0} banked · 1 a week`)}</div>
  <div class="setg"><span class="lab">Connections</span>${r('health','Apple Health','iPhone app')}${r('cal','Calendar','iPhone app')}</div>
  <div class="setg"><span class="lab">Reminders</span>${r('am','Morning check-in',NOTIF.am)}${r('pm','Close the day',NOTIF.pm)}${r('sun','Sunday review','Sun 6:00 pm')}</div>
  <div class="setg"><span class="lab">Your data</span>${r('export','Back up','Download a file')}${r('import','Restore','From a backup file')}${r('reset','Start over','Erases everything')}</div><div style="font-size:12px;color:var(--muted);padding:4px 4px 12px">Prometheus beta · data stays on this device · best ${D.best||0}-day streak</div>`}
$('#setList').onclick=e=>{const b=e.target.closest('[data-st]');if(!b)return;const k=b.dataset.st;
  if(k==='stakes')return openStakes();if(k==='areas'){go('onb');return}if(k==='food'){go('food');fdEditing=true;return renderFood()}
  if(k==='export')return exportData();if(k==='import')return importData();if(k==='reset'){if(confirm('Erase all Prometheus data on this device? Back up first if unsure.')&&confirm('Really erase everything?')){try{localStorage.removeItem(KEY)}catch(e){}location.reload()}return}
  if(k==='health'||k==='cal')return toast('Comes with the iPhone app');
  if(k==='am'||k==='pm'){const o=k==='am'?['7:00 am','8:00 am','9:00 am','10:00 am']:['8:00 pm','9:00 pm','10:00 pm','11:00 pm'];NOTIF[k]=o[(o.indexOf(NOTIF[k])+1)%o.length];save();renderSet();return}
  toast({routine:'Routines are coming. For now the draft carries your plan forward',freeze:'You earn 1 freeze a week (max 1 banked). It covers one missed day and cancels that forfeit.',sun:'Pops up Sunday after 6 pm'}[k]||'')};
function startRate(){picks=[];closed=false;$('#rateStep').textContent=closing?'Close the day · 2 of 3':'Soul check-in';triInit();triDraw();go('rate')}

/* ---------- Check-in ---------- */
const CORN=[{n:'High energy · Unpleasant',c:'var(--ember)',t:'#fff',tag:['#FFE2D9','#C2300B'],sl:'var(--ember)',w:'Stressed Anxious Frustrated Irritated Overwhelmed Nervous Tense Restless Annoyed Worried Angry Pressured Jittery Agitated Impatient On edge Fed up Defensive Panicked Scared Jealous Embarrassed Shocked Furious'},
 {n:'High energy · Pleasant',c:'var(--gold)',t:'var(--ink)',tag:['#FFF0C7','#8A5E00'],sl:'var(--gold)',w:'Excited Proud Joyful Energized Inspired Motivated Confident Playful Optimistic Thrilled Eager Focused Hopeful Cheerful Lively Amused Determined Upbeat Elated Curious Pumped Accomplished Alive Surprised'},
 {n:'Low energy · Unpleasant',c:'var(--cobalt)',t:'#fff',tag:['#DCE4FC','#1F43B8'],sl:'var(--cobalt)',w:'Tired Drained Down Bored Sad Lonely Disappointed Numb Discouraged Sluggish Exhausted Meh Hurt Guilty Lost Gloomy Burned out Empty Unmotivated Insecure Left out Apathetic Ashamed Hopeless'},
 {n:'Low energy · Pleasant',c:'var(--green)',t:'#fff',tag:['#D6F2E6','#0B6E4B'],sl:'var(--green)',w:'Calm Content Relaxed Grateful Peaceful Rested Grounded Thoughtful Satisfied Mellow Balanced Comfortable At ease Chill Fulfilled Secure Serene Cozy Relieved Patient Reflective Easygoing Tranquil Blessed'}];
const splitW=s=>s.replace(/On edge|Fed up|Burned out|Left out|At ease/g,m=>m.replace(' ','_')).split(' ').map(x=>x.replace('_',' '));
let corner=1;
$$('.meter button').forEach(b=>b.onclick=()=>{corner=+b.dataset.corner;b.animate([{transform:'scale(.95)'},{transform:'scale(1)'}],{duration:200});setTimeout(()=>openWords(),140)});
function openWords(){const c=CORN[corner];$('#ci2Back').textContent='← '+c.n;const w=$('#words');w.style.setProperty('--wc',c.c);w.style.setProperty('--wt',c.t);
  w.innerHTML=splitW(c.w).map((x,i)=>`<button style="animation-delay:${i*14}ms">${x}</button>`).join('');go('ci2')}
$('#words').onclick=e=>{const b=e.target.closest('button');if(!b)return;$$('#words button').forEach(x=>x.classList.remove('on'));b.classList.add('on');const c=CORN[corner];
  $('#ciWord').textContent=b.textContent;$('#ciTag').textContent=c.n;$('#ciTag').style.background=c.tag[0];$('#ciTag').style.color=c.tag[1];$('#sh-ci3 .track[data-i="0"] i').style.background=c.sl;setTimeout(()=>openSheet('ci3'),160)};
$$('.track').forEach(tr=>{const set=e=>{const r=tr.getBoundingClientRect(),p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),v=Math.max(1,Math.round(p*10));tr.querySelector('i').style.width=v*10+'%';tr.querySelector('em').style.left=v*10+'%';$('#sv'+tr.dataset.i).textContent=v};
  tr.addEventListener('pointerdown',e=>{tr.setPointerCapture(e.pointerId);set(e);tr.onpointermove=set});tr.addEventListener('pointerup',()=>tr.onpointermove=null)});
$('#ciSave').onclick=()=>{D.checkins.push({ts:Date.now(),d:TODAY,corner,word:$('#ciWord').textContent,strength:+$('#sv0').textContent,stress:+$('#sv1').textContent,note:$('#ciNote').value.trim()||undefined});D.lastCheckin=Date.now();$('#ciNote').value='';save();closeSheet();go('today');checkXP(10,'Check-in')};

/* ---------- Evening ---------- */
$('#scale').onclick=e=>{const b=e.target.closest('button');if(!b)return;$$('#scale button').forEach(x=>x.classList.remove('on'));b.classList.add('on')};
let closing=false;
$('#eveDone').onclick=()=>{const r=$('#scale .on');if(!r)return toast('Pick 1 to 5 first');DAY().rating=+r.textContent;DAY().note=$('#eveTxt').value.trim()||undefined;DAY().closed=true;save();closing=true;FLOWG.planflow='ci';checkXP(15,'Evening');setTimeout(()=>startRate(),350)};


/* ---------- Plan ---------- */
const PCOL={Mind:'var(--cobalt)',Body:'var(--ember)',Soul:'var(--gold)',Task:'#77716A'};
/* plan item: [name, pillar, hour|null (unscheduled), duration h, done, mind activity index|null] */
let THREE=[['Chinese lesson','Mind',8,.5,true,3],['Push day','Body',12,1,true,null],['Email advisor','Task',13,.25,true,null],['Write 500 words','Mind',15,.5,false,4],['Pick up dry cleaning','Task',16,.25,false,null],['Call Dad','Soul',19,.5,false,null],['Hero: 3K tempo run','Body',18,.5,false,null,'hero'],['Read a book chapter','Mind',21.5,.5,false,0],['Econ problem set','Mind',null,2,false,1],['Laundry','Task',null,1,false,null]];
const DUR=[[.25,'15 min'],[.5,'30 min'],[1,'60 min']],dlab=d=>(DUR.find(x=>x[0]===d)||[0,Math.round(d*60)+' min'])[1];
function sortPlan(){THREE.sort((a,b)=>(a[2]??99)-(b[2]??99))}
const CAL=[]; // calendar events come with the iPhone app
const H0=7,H1=23,PX=56;
function renderPlan(){NOW=nowH();$('#planDate').textContent=fmtDay(TODAY);$('#weekDate').textContent='Week of '+fmtDay(weekStart(TODAY)).replace(/^\w+ /,'');
  {const pb=$('#v-plan .logp');pb.textContent=nowH()>=18&&!DAY().closed?'Close the day':'Plan tomorrow';pb.dataset.go=nowH()>=18&&!DAY().closed?'eve':'planflow'}
  const pp=(k,lab,v,ph)=>`<button class="pp${v?' set':''}" data-pp="${k}"><span class="lab">${lab}</span><b>${v||ph}</b></button>`;
  $('#planPact').innerHTML=pp('w',`Win 5 of 7 · ${weekWins()}/5`,WSP,'+ Week spoil')+pp('f',"If I don't · rolled",`🎲 ${FFT[ffSize(missRun+1)]} forfeit`,'');
  $$('#planPact [data-pp]').forEach(b=>b.onclick=()=>openStakes(b.dataset.pp==='f'?null:b.dataset.pp));
  const un=THREE.filter(x=>x[2]==null);
  if(slPick!=null&&THREE[slPick][2]!=null)slPick=null;
  $('#planThree').innerHTML=`<div class="trh"><span class="lab" style="color:${slPick!=null?'var(--ink)':'var(--muted)'}">${slPick!=null?'Tap a free time':'Not slotted · '+un.length}</span>${un.some(x=>!x[4])&&slPick==null?'<button class="tlink" id="tAll" style="padding:0">Slot all</button>':''}${slPick!=null?'<button class="tlink" id="tCancel" style="padding:0">Cancel</button>':''}</div><div class="trow"><button class="tchip2 add" id="tAdd">+ Add</button>${un.map(x=>`<button class="tchip2${x[4]?' done':''}${THREE.indexOf(x)===slPick?' pick':''}" data-e="${THREE.indexOf(x)}" style="--c:${PCOL[x[1]]}">${x[0]} · ${dlab(x[3])}</button>`).join('')}</div>`;
  let t='';for(let h=H0;h<H1;h++)t+=`<div class="hr"><span>${h%12||12}${h<12?'a':'p'}</span></div>`;
  CAL.forEach(([n,h,d])=>t+=`<div class="ev cal${d<=.5?' sm':''}" style="top:${6+(h-H0)*PX+2}px;height:${d*PX-4}px">${n}<small> Calendar</small></div>`);
  THREE.filter(x=>x[2]!=null).forEach(([n,p,h,d,done,a],_,__,k=THREE.findIndex(y=>y[0]===n&&y[2]===h))=>t+=`<div class="ev${done?' done':''}${d<=.5?' sm':''}" data-k="${k}" style="top:${6+(h-H0)*PX+2}px;height:${Math.max(.5,d)*PX-4}px;background:${PCOL[p]};color:${p==='Soul'?'var(--ink)':'#fff'};${done?'opacity:.45;text-decoration:line-through':''}"><span class="evn"><i class="evc"></i>${n}</span><small>${a!=null?axes[a].it[0]:p}</small></div>`);
  if(NOW>=H0&&NOW<=H1)t+=`<div class="now" style="top:${6+(NOW-H0)*PX}px"></div>`;
  if(slPick!=null){const x=THREE[slPick];gapStarts(slPick,x[3]).forEach(h=>t+=`<button class="gh" data-h="${h}" style="--c:${PCOL[x[1]]};top:${6+(h-H0)*PX+2}px;height:${Math.max(.5,x[3])*PX-4}px">+ ${hl(h)}</button>`)}
  $('#timeline').innerHTML=t;
  if(slPick!=null){const g=$('#timeline .gh');if(g)$('#timeline').scrollTo({top:g.offsetTop-60,behavior:'smooth'})}
  $$('#timeline .gh').forEach(b=>b.onclick=()=>{const k=slPick,h=+b.dataset.h;THREE[k][2]=h;slPick=null;renderPlan();renderHome();toast(`${THREE[k][0]} · ${hl(h)}`)});
  {const a=$('#tAll');if(a)a.onclick=slotAll;const c=$('#tCancel');if(c)c.onclick=()=>{slPick=null;renderPlan()}}
  $('#tAdd').onclick=()=>openSlot(-1);$$('#planThree [data-e]').forEach(b=>b.onclick=()=>{const k=+b.dataset.e;if(THREE[k][4])return openSlot(k);slPick=slPick===k?null:k;renderPlan()});
  $$('#timeline .ev[data-k]').forEach(b=>b.onclick=e=>{const k=+b.dataset.k;if(e.target.closest('.evc')){togglePlan(k);renderPlan();renderHome()}else openSlot(k)});
  $('#wkSpoil').innerHTML=`<span class="lab">Win 5 of 7 days</span><div class="row"><b>${WSP}</b><span class="n" style="font-size:22px">${weekWins()}/5</span></div><div class="bar"><i style="width:${Math.min(100,weekWins()/5*100)}%;background:var(--gold)"></i></div>`;$('#hSpoil').textContent=HSP;
  if(D.hero){$('#hTitle').textContent=D.hero.text;$('#hTitle2').textContent=D.hero.text;$('#hPil').textContent=`Hero of the week · ${D.hero.pil} · ${D.hero.done?'done':D.hero.days.length+'/7'}`}
  const WG=D.weekGoals&&D.weekGoals.week===weekStart(TODAY)?D.weekGoals.goals.map(g=>[g.name,g.p,goalProg(g),g.k]):[];
  $('#weekGoals').innerHTML=`<span class="lab">This week's 3</span>`+(WG.length?'':'<div style="font-size:13px;color:var(--muted)">Set them in the Sunday review. One per pillar, tracked from your logs.</div>')+WG.map(([n,p,a,b])=>`<div class="sub"><div class="row"><span style="display:flex;align-items:center;gap:8px"><i class="dot" style="margin:0;background:${PCOL[p]}"></i>${n}</span><b style="font-size:15px">${Math.min(a,b)}/${b}</b></div><div class="bar"><i style="width:${Math.min(100,a/b*100)}%;background:${PCOL[p]}"></i></div></div>`).join('')}
function todoRow(t){const [n,p,h,d,done,a]=t,k=THREE.indexOf(t),mc=a!=null?`var(${CATS[axes[a].ci].c})`:'var(--muted)';
  return `<div class="chk${done?' done':''}" style="padding:6px 0;--pc:${PCOL[p]}"><button data-k="${k}" aria-label="${n}"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6.5 5 9l5-6" stroke="#fff" stroke-width="2" fill="none"/></svg></button><span style="display:flex;flex-direction:column;min-width:0">${n}<small class="mtag" style="color:${mc}">${a!=null?`<em class="act">${axes[a].it[0]} · </em>`:''}${dlab(d)}</small></span>${h==null?`<button class="ttime slotit" data-e="${k}">+ Slot</button>`:`<button class="ttime" data-e="${k}">${fmt(h)}</button>`}<i class="dot" style="margin-left:8px;background:${PCOL[p]}"></i></div>`}
let NOW=nowH(),dayDemo=-1;
const DAYMSG=["Let's set up today.","Let's get going.",'Keep pushing.','Still time to catch up.','Close it out strong.','Day won.'];
function dayState(){if(dayDemo>=0)return dayDemo;const sch=THREE.filter(t=>t[2]!=null),und=THREE.filter(t=>!t[4]);
  if(!THREE.length)return 0;if(!und.length)return 5;if(sch.some(t=>!t[4]&&t[2]+t[3]<=NOW))return 3;if(NOW>=20)return 4;if(!THREE.some(t=>t[4])&&NOW<12)return 1;return 2}
function fitMsg(){const m=$('#dayTop .dmsg');if(!m)return;m.style.fontSize='28px';let f=28;while(m.scrollWidth>m.clientWidth+1&&f>20){f--;m.style.fontSize=f+'px'}}
const CK='<svg width="14" height="14" viewBox="0 0 12 12"><path d="M2 6.5 5 9l5-6" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
let homeF=null,homeFl=null;
function growHome(){const el=$('#dayTop');el.classList.add('grow');renderHome();clearTimeout(growHome.t);growHome.t=setTimeout(()=>el.classList.remove('grow'),1400)}
function renderHome(){const el=$('#dayTop');if(!el)return;NOW=nowH();day1=!Object.keys(D.days).some(d=>d<TODAY&&D.days[d].done)&&!THREE.some(t=>t[4])&&!qdone;
  const done=THREE.filter(t=>t[4]).length,OVR=Math.round((63+71+81)/3);
  const sq=(f,bg,name,corner,w)=>`<button class="bx pq${homeF&&homeF!==f?' dim':''}${homeF===f?' sel':''}" data-f="${f}" style="background:var(--ink);--c:${bg};--w:${w}%"><i class="fill"></i><span class="lab pc">${corner}</span><div class="cond pn">${name}</div></button>`;
  el.innerHTML=`
  <div class="dbox"><button class="dbar" data-go="plan"><span class="cond">${fmtDay(TODAY)}</span><span class="lab" style="color:#9b958c;margin-left:auto">Daily plan</span><span class="dch">›</span></button><div class="hstat"><span class="lab">Level ${level}</span><span class="emo2">🔥</span><span class="lab" style="color:var(--ember)" id="stkTxt">${streak}-day streak</span><span class="frz" title="Streak freezes banked: each covers one missed day"><i class="emo">❄️</i>${D.freezes||0}</span><span class="lab" id="xpTxt" style="margin-left:auto;color:#9b958c">${Math.min(xp,1000)} / 1000</span></div><div class="thin dk"><i id="lvlFill" style="width:${Math.min(100,xp/10)}%"></i></div></div>`+
  ['Mind','Body','Soul'].map(n=>{const v=day1?0:PV(n);return sq(n,PCOL[n],n,v+'%',v)}).join('')+sq('Hero','#fff','Hero',D.hero?`${D.hero.done?'Done':D.hero.days.length+'/7'}`:'Sunday',D.hero?(D.hero.done?100:Math.round(D.hero.days.length/7*100)):0);
  el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{homeF=homeF===b.dataset.f?null:b.dataset.f;renderHome()});
  const over=THREE.filter(t=>!t[4]&&t[2]!=null&&t[2]+t[3]<=NOW),rest=THREE.filter(t=>!t[4]&&!over.includes(t)).sort((a,b)=>(a[2]??99)-(b[2]??99)),up=homeF?THREE.filter(t=>homeF==='Hero'?t[6]==='hero':t[1]===homeF).sort((a,b)=>(a[4]-b[4])||((a[2]??99)-(b[2]??99))):[...over,...rest];
  const U=$('#homeUp');
  U.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">${homeF?`<span class="lab" style="color:${homeF==='Hero'?'var(--green)':PCOL[homeF]}">${homeF==='Hero'?'Hero · '+(D.hero?D.hero.text:''):homeF+' tasks'}</span><button class="lab hupe" id="hupX">Show all ✕</button>`:`<span class="lab">Up next${dayWon?' · <span style="color:var(--green)">Day won</span>':` · <span style="color:var(--muted)">Win needs ${winNeeds()}</span>`}</span><button class="lab hupe" data-go="plan">Edit ›</button>`}</div>`+(!homeF&&!THREE.some(t=>t[6]!=='hero')?`<div class="empt"><b>${day1?'Day 1. Let\'s light it.':'Nothing planned yet'}</b><span>${day1?'Plan today in about a minute. One block per pillar wins the day.':'Take the draft or build your own. One block per pillar wins the day.'}</span><button class="btn" data-go="planflow" style="padding:12px 18px">${day1?'Plan today':'Use today\'s draft'}</button></div><div class="tlist" id="homeList">`+up.map(t=>todoRow(t)).join(''):'<div class="tlist" id="homeList">'+(up.length?up.map(t=>todoRow(t).replace('class="chk','class="chk'+(over.includes(t)?' late':''))).join(''):(!homeF&&!THREE.length?`<div class="empt"><b>${day1?'Day 1. Let\'s light it.':'Nothing planned yet'}</b><span>${day1?'Plan today in about a minute. One block per pillar wins the day.':'Take the draft or build your own. One block per pillar wins the day.'}</span><button class="btn" data-go="planflow" style="padding:12px 18px">${day1?'Plan today':'Use today\'s draft'}</button></div>`
    :`<div class="empt" style="padding:6px 0;gap:8px"><span>${homeF?'Nothing planned for '+homeF+' today.':dayWon?'All done. Day won.':'All done. Win needs '+winNeeds()+'.'}</span>${homeF?'':`<button class="btn" data-go="${nowH()>=18?'eve':'planflow'}" style="padding:12px 18px">${nowH()>=18?'Close the day':'Plan tomorrow'}</button>`}</div>`)))+`</div>`;
  U.querySelectorAll('.chk>button:first-child').forEach(b=>b.onclick=()=>{const k=+b.dataset.k;b.parentElement.classList.add('done');togglePlan(k);setTimeout(renderHome,650)});
  U.querySelectorAll('button.ttime').forEach(b=>b.onclick=()=>openSlot(+b.dataset.e));
  const hx=$('#hupX');if(hx)hx.onclick=()=>{homeF=null;renderHome()};
  requestAnimationFrame(()=>{const L=$('#homeList');if(!L)return;const rs=[...L.children];})}
let streak=0,dayWon=false,forceDrop=false,SPOILS='',FORFEIT='Cold shower',HFORF='';
const STK={week:['One dessert','Coffee out','Popcorn at the movies','A bath or sauna session','Sleep in on Sunday'],hero:['Dinner out / takeaway','6-pack of beers','Bottle of wine','Buy a book','Brunch out','A concert or comedy show'],
  ff:[['50 push-ups','S'],['Cold shower','S'],['$5 to a cause','S'],['10-min total plank','M'],['Clean the kitchen','M'],['Run 5K','L'],['Clean the bathroom','L']]};
const FFT={S:'Small',M:'Medium',L:'Large'},ffType=n=>{const f=STK.ff.find(x=>x[0]===n);return f?f[1]:'S'};
/* escalation + random: misses in a row set the size, the app rolls within it */
let missRun=0;const ffSize=m=>m<=1?'S':m===2?'M':'L',ORD=['1st','2nd','3rd'];
function rollFF(m){const z=ffSize(m),pool=STK.ff.filter(x=>x[1]===z);const f=pool.length?pool[Math.floor(Math.random()*pool.length)]:STK.ff[0];return [f[0],z]}
let WSP='Coffee out',HSP='Dinner out / takeaway',stkMode=null;
const rot=(arr,cur)=>arr[(arr.indexOf(cur)+1)%arr.length];
function renderStakes(){const pick=stkMode,box=$('#stkBody');
  $('#stkTitle').textContent=pick==='w'?'This week\'s spoil':pick==='f'?"If I don't":'Spoils + forfeits';
  $('#stkSub').textContent=pick?'Tap one. Change your lists anytime.':'Set these once. Spoils are weekly. Forfeits are effort, paid the day after a loss.';
  const row=(n,on,attr,tag)=>`<div class="skr${on?' on':''}" ${attr}><span>${n}</span>${tag?`<i class="sktag ${tag}">${FFT[tag]}</i>`:''}${pick?(on?'<b>✓</b>':''):`<button class="skx" data-skx aria-label="Remove">✕</button>`}</div>`;
  const add=k=>pick?'':`<div class="skadd"><input data-ska="${k}" placeholder="Add one" autocomplete="off">${k==='ff'?['S','M','L'].map(z=>`<button class="sktag ${z}" data-skt="${z}">${FFT[z]}</button>`).join(''):'<button data-skt="">Add</button>'}</div>`;
  const sec=(k,lab,sub)=>`<div class="sksec"><span class="lab">${lab}<small>${sub}</small></span>${(k==='ff'?[...STK.ff].sort((a,b)=>'SML'.indexOf(a[1])-'SML'.indexOf(b[1])):STK[k]).map((x,i)=>{const n=k==='ff'?x[0]:x;return row(n,pick?(k==='ff'?FORFEIT===n:WSP===n):false,`data-sk="${k}|${k==='ff'?STK.ff.indexOf(x):i}"`,k==='ff'?x[1]:null)}).join('')}${add(k)}</div>`;
  box.innerHTML=pick==='w'?sec('week','Week spoils','Win 5 of 7 days'):pick==='f'?sec('ff','Forfeits','Random · misses size it up'):
    sec('week','Week spoils','Win 5 of 7 days')+sec('hero','Hero spoils','Beat the Hero')+sec('ff','Forfeits','Random · misses size it up');
  $('#stkEdit').style.display=pick?'':'none'}
function openStakes(m){stkMode=m||null;renderStakes();openSheet('stakes')}
const wonDone=()=>{const d=THREE.filter(t=>t[4]).map(t=>t[1]);for(let i=0;i<qdone;i++)d.push('Soul');if(typeof foodOK==='function'&&foodOK()&&!d.includes('Body'))d.push('Body');return d};
const isWon=()=>{const d=wonDone();return d.length>=3&&['Mind','Body','Soul'].every(p=>d.includes(p))};
const winNeeds=()=>{const d=wonDone(),miss=['Mind','Body','Soul'].filter(p=>!d.includes(p));return d.length>=3&&!miss.length?'':miss.length?miss.join(' + '):(3-d.length)+' more'};
function checkWon(){const w=isWon();if(w&&!dayWon){dayWon=true;streak++;D.best=Math.max(D.best||0,streak);DAY().won=true;save();const st=$('#stkTxt');if(st)st.textContent=streak+'-day streak';setTimeout(()=>wonMoment(),1200)}else if(!w&&dayWon){dayWon=false;streak=Math.max(0,streak-1);DAY().won=false;save();const st=$('#stkTxt');if(st)st.textContent=streak+'-day streak'}}
const weekWins=()=>thisWeek().filter(d=>d===TODAY?dayWon:D.days[d]&&D.days[d].won).length;
function wonMoment(){const f=$('#wonfx');f.innerHTML=`<div class="cond">Day won</div><span class="lab" style="color:var(--ember)">${streak}-day streak</span><div class="wsp"><span class="lab" style="color:#9b958c">${weekWins()>=5?'Week spoil earned':`Toward this week's spoil · ${weekWins()} of 5`}</span><b>${WSP}</b></div><button class="btn wide" style="background:#fff;color:var(--ink)">Nice</button>`;f.querySelector('button').onclick=()=>f.classList.remove('on');
  const P=$('#phone'),S=f.parentElement.getBoundingClientRect(),src=lastTap&&performance.now()-lastTap.t<4000?lastTap.r:null;
  if(reduce||!src){f.classList.add('on');return}
  const x=src.left+src.width/2-S.left,y=src.top+src.height/2-S.top,R0=Math.hypot(Math.max(x,S.width-x),Math.max(y,S.height-y))*2,b=document.createElement('div');
  b.className='burst';Object.assign(b.style,{left:x+'px',top:y+'px',width:R0+'px',height:R0+'px'});f.parentElement.appendChild(b);
  b.animate([{transform:'translate(-50%,-50%) scale(0)'},{transform:'translate(-50%,-50%) scale(1)'}],{duration:T_MOM,easing:EZ,fill:'forwards'});
  setTimeout(()=>{f.classList.add('on');b.animate([{opacity:1},{opacity:0}],{duration:T_PAGE,easing:EZ,fill:'forwards'}).onfinish=()=>b.remove()},T_MOM*.7)}
function checkXP(n,label){const d=forceDrop||Math.random()<.1;forceDrop=false;$('#xpchip').classList.toggle('drop',d);gainXP(d?n*2:n,d?'Ember drop ×2':label)}
function togglePlan(k){const t=THREE[k];t[4]=!t[4];setTimeout(checkWon,0);
  if(t[6]==='hero'&&D.hero){const H=D.hero;H.days=H.days.filter(x=>x!==TODAY);if(t[4])H.days.push(TODAY)}
  if(t[1]==='Body'&&t[7]&&!t[7].w)logBody(t[7].c,t[7].a,(t[4]?1:-1)*Math.round(t[3]*60));
  if(t[5]!=null){const m=Math.round(t[3]*60),ax=axes[t[5]];ax.it[1]=Math.max(0,ax.it[1]+(t[4]?m:-m));logMind(ax.it[0],t[4]?m:-m);if(t[4]){checkXP(blockXP(t[3]),ax.it[0]);setTimeout(()=>toast(`${m} min ${ax.it[0]} logged to your Mind wheel`),900)}else toast(`Removed ${m} min from ${ax.it[0]}`)}
  else if(t[4])checkXP(t[1]==='Task'?5:blockXP(t[3]),t[6]==='hero'?'Hero':'Today');save()}
const blockXP=d=>d<=.25?5:d<=.5?10:20;
function renderMplan(){const el=$('#mplan');if(!el)return;const all=THREE.filter(t=>t[5]!=null&&t[2]!=null),ms=[...all.filter(t=>!t[4]),...all.filter(t=>t[4])].slice(0,3).sort((a,b)=>a[2]-b[2]);el.style.display=sel==null&&ms.length?'':'none';
  el.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:2px"><span class="lab">Today</span><span class="lab" style="color:var(--muted)">${all.filter(t=>t[4]).length} of ${all.length}</span></div>`+ms.map(t=>{const [n,,h,d,done,a]=t,c=`var(${CATS[axes[a].ci].c})`;return `<div class="chk${done?' done':''}" style="padding:3px 0;--pc:${c}"><button data-k="${THREE.indexOf(t)}" aria-label="${n}"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6.5 5 9l5-6" stroke="#fff" stroke-width="2" fill="none"/></svg></button><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n}</span><small style="color:var(--muted);font-size:13px;font-weight:600;white-space:nowrap">${fmt(h)}</small></div>`}).join('');
  $$('#mplan .chk > button').forEach(b=>b.onclick=()=>{const k=+b.dataset.k,t=THREE[k],a=t[5],ax=axes[a],from=ax.it[1];togglePlan(k);const to=ax.it[1];ax.it[1]=from;sel=null;focus=axes[a].ci;const t1=performance.now();
    (function st(n){const q=Math.min(1,(n-t1)/700),e=1-Math.pow(1-q,3);ax.it[1]=from+(to-from)*e;radar();if(q<1&&!reduce)requestAnimationFrame(st);else{ax.it[1]=to;radar();renderMplan()}})(t1)})}
function fmt(h){const hh=Math.floor(h),m=Math.round((h-hh)*60);return `${hh%12||12}${m?':'+String(m).padStart(2,'0'):''}${hh<12?'am':'pm'}`}
$('#planSeg').onclick=e=>{const b=e.target.closest('[data-p]');if(!b)return;$$('#planSeg button').forEach(x=>x.classList.toggle('on',x===b));const w=b.dataset.p==='week';$('#planDay').style.display=w?'none':'flex';$('#planWeek').style.display=w?'flex':'none';setNotes(w?'planweek':'plan')};
/* planning flow */
const SUGG={Goals:[['Train: Pull day','Body'],['Write 25 min','Mind'],['Courage quest','Soul']],Habits:[['Read 30 min','Mind'],['Run 3 miles','Body'],['Meditate 10 min','Mind']],Quests:[['Have the conversation you\'ve avoided','Soul'],['Tell someone what they did well','Soul']]};
let pfSel=[];const FREE=[8,12,13.5,16,18,19.5,20.5];
let pfSt={p:null,c:null,s:null};
function renderPF(){const st=pfSt,dn=funDone(st);
  const soul=st.p==='Soul',sb=funSub(st);
  $('#pfPick').innerHTML=funCrumb(st).replace('Pick one',soul?'Pick tomorrow\'s challenge':'Length + label')+(dn?(soul?`<div class="frows">${funIdeas(st).map(([n],k)=>`<button data-i="${k}" class="${pfCh===n?'on':''}"><span>${n}</span><small>All day</small></button>`).join('')}</div>`
    :`<div class="slt" id="pfDur">${DUR.map(([d,l])=>`<button data-pd="${d}" class="${d===pfD?'on':''}">${l}</button>`).join('')}</div><div class="pick lbl">${[...new Set(funIdeas(st).map(x=>x[0]))].map(n=>`<button data-lb="${n}" class="${pfL===n?'on':''}">${n}${WORKOUTS[n]?' · '+WORKOUTS[n].length+' ex':''}</button>`).join('')}</div><div style="display:flex;gap:8px"><input id="pfOwn" class="slin" style="flex:1;min-width:0;background:var(--paper)" placeholder="Your own label · optional" autocomplete="off" value="${pfL&&!funIdeas(st).some(x=>x[0]===pfL)?pfL:''}"><button class="btn" id="pfOwnAdd">Add ${dlab(pfD)}</button></div>`):funTiles(st))+
  (pfSel.length||pfCh?`<div class="pfg" style="margin-top:auto"><span class="lab" style="color:var(--muted)">On tomorrow · ${pfSel.length}</span><div class="pick">${pfSel.map(([n,p,,d],k)=>`<button data-x="${k}" class="on" style="background:${PCOL[p]};color:#fff">${n} · ${dlab(d)} ✕</button>`).join('')}${pfCh?`<button data-xc class="on" style="background:var(--gold);color:var(--ink)">Challenge: ${pfCh} ✕</button>`:''}</div></div>`:'');
  const ok=pfSel.length>0||!!pfCh;$('#pfNext').disabled=!ok;$('#pfNext').classList.toggle('off',!ok);$('#pfNext').textContent=ok?(pfSel.length?`Next · ${pfSel.length} to slot`:'Next'):'Add at least one'}
let pfD=.5,pfL=null,pfCh=null;
$('#pfPick').onclick=e=>{if(funClick(pfSt,e)){pfL=null;renderPF();return}
  const i=e.target.closest('[data-i]');if(i){const [n]=funIdeas(pfSt)[+i.dataset.i];pfCh=pfCh===n?null:n;renderPF();return}
  const d=e.target.closest('[data-pd]');if(d){pfD=+d.dataset.pd;renderPF();return}
  const l=e.target.closest('[data-lb]');if(l){pfL=pfL===l.dataset.lb?null:l.dataset.lb;renderPF();return}
  if(e.target.closest('[data-xc]')){pfCh=null;renderPF();return}
  const x=e.target.closest('[data-x]');if(x){pfSel.splice(+x.dataset.x,1);renderPF();return}
  if(e.target.id==='pfOwnAdd'){const v=$('#pfOwn').value.trim()||pfL||funSub(pfSt).n;pfSel.push([v,pfSt.p,null,pfD,metaOf(pfSt),aiOf(pfSt)]);pfL=null;renderPF();toast(`${dlab(pfD)} · ${v} added`)}};
const FB=[[7,9],[11,13],[13,17],[18,20],[20,22]];let fbFill={},fbAsk=0;
const fbLen=b=>{const h=b[1]-b[0];return h+'h'};
function renderFit(){const placed=Object.values(fbFill).map(f=>f[0]);
  const FBX=freeBlocks(PFT),rows=[...FBX.map((b,i)=>{const f=fbFill[i];
    if(f){const c=f[1]?PCOL[f[1]]:(f[0]==='Rest'?'#8C857B':'#CFC8BE'),tc=f[1]==='Soul'?'var(--ink)':'#fff';
      return {t:b[0],h:`<div class="fb done" style="background:${c};color:${tc}"><div class="hd"><b>${f[0]}</b><span style="display:flex;gap:8px;align-items:center">${fmt(b[0])}–${fmt(b[1])}<button class="clr" data-c="${i}" aria-label="Clear">✕</button></span></div></div>`}}
    const ask=i===fbAsk,opts=[...pfSel.filter(x=>!placed.includes(x[0])).map(x=>[x[0],x[1],x[3]]),['Rest',''],['Leave open','']];
    return {t:b[0],h:`<div class="fb${ask?' ask':''}" data-b="${i}"><div class="hd"><b>Free · ${fmt(b[0])}–${fmt(b[1])}</b><span>${fbLen(b)}</span></div>${ask?`<div class="q">How do you want to fill this?</div><div class="opts">${opts.map(([n,p,d])=>`<button data-f="${n}" data-p="${p}">${p?`<i class="dot" style="margin:0;background:${PCOL[p]}"></i>`:''}${n}${d?` · ${dlab(d)}`:''}</button>`).join('')}</div>`:''}</div>`}}),
  ...CAL.map(([n,h,d])=>({t:h,h:`<div class="slot cal">${fmt(h)}–${fmt(h+d)} · ${n}</div>`}))].sort((a,b)=>a.t-b.t);
  $('#pfFit').innerHTML=rows.map(r=>r.h).join('');const ak=$('#pfFit .fb.ask');if(ak)ak.scrollIntoView({block:'nearest',behavior:'smooth'});
  const left=pfSel.filter(x=>!placed.includes(x[0])).length,ok=left===0;$('#pfDone').disabled=!ok;$('#pfDone').style.opacity=ok?1:.35;$('#pfDone').disabled=false;$('#pfDone').style.opacity=1;$('#pfDone').textContent=ok?'Lock it in':`Lock it in · ${left} unslotted`}
$('#pfFit').onclick=e=>{const c=e.target.closest('[data-c]');if(c){delete fbFill[+c.dataset.c];fbAsk=+c.dataset.c;renderFit();return}
  const f=e.target.closest('[data-f]');if(f){fbFill[fbAsk]=[f.dataset.f,f.dataset.p];const nx=freeBlocks(PFT).findIndex((b,i)=>!fbFill[i]);fbAsk=nx;renderFit();return}
  const b=e.target.closest('.fb[data-b]');if(b){fbAsk=+b.dataset.b;renderFit()}};
$('#pfBack').onclick=()=>{if($('#pf1').style.display!=='none'){$('#pf1').style.display='none';$('#pf0').style.display='flex';stepDir=-1;stepIn($('#pf0'));stepDir=1;$('#pfBack').style.display='none';$('#pfStep').textContent=closing?'Close the day · 3 of 3':PFT===TODAY?'Plan today':'Plan tomorrow';return}$('#pf2').style.display='none';$('#pf1').style.display='flex';stepDir=-1;stepIn($('#pf1'));stepDir=1;$('#pfStep').textContent=(PFT===TODAY?'Plan today':'Plan tomorrow')+' · 1 of 2';renderPF();setNotes('planflow')};
$('#pfNext').onclick=()=>{if(!pfSel.length&&!pfCh)return;$('#pf1').style.display='none';$('#pf2').style.display='flex';stepIn($('#pf2'));$('#pfBack').style.display='';$('#pfStep').textContent=(PFT===TODAY?'Plan today':'Plan tomorrow')+' · 2 of 2';fbFill={};fbAsk=0;renderFit();setNotes('planflow2')};
$('#pfDone').onclick=()=>{if($('#pfDone').disabled)return;const fb=freeBlocks(PFT),H={};Object.entries(fbFill).forEach(([i,f])=>{if(f&&fb[+i])H[f[0]]=fb[+i][0]});commitPlan(pfSel.map(x=>[x[0],x[1],H[x[0]]??null,x[3],x[4],x[5]]),pfCh?findQuest(pfCh):null)};
const BODYT={Strength:{Split:[['Push day',.75],['Pull day',.75],['Leg day',.75]],'Upper / lower':[['Upper body',1],['Lower body',.75],['Full body',.75]],Focus:[['Arms',.5],['Core',.5],['Bodyweight',.5]]},
  Cardio:{Run:[['Run 3 miles',.5],['3K tempo run',.5],['Intervals 6×400m',.5],['Long easy run',1],['Hill repeats',.5]],Bike:[['Ride 10 miles',1],['Spin class',1],['Hill climb ride',1],['Easy spin',.5],['Bike to work',.5]],'Row / HIIT':[['Row 5K',.5],['EMOM',.25],['Tabata',.25],['Jump rope',.25]],Sport:[['Pickup basketball',1],['Tennis',1],['Climbing',1],['Martial arts',1]],Swim:[['Swim 1K',.5],['Swim drills',.5],['Sprint 10×50m',.5],['Open-water swim',1],['Kick sets',.25]]},
  Recovery:{Stretch:[['Full-body stretch',.25],['Yoga flow',.5],['Hamstring + hip stretch',.25],['Evening wind-down stretch',.25],['Yoga class',1]],Mobility:[['Hip mobility',.25],['Foam roll',.25],['Shoulder mobility',.25],['Ankle + knee prep',.25],['Mobility flow',.5]],Sleep:[['Lights out by 11',.25],['No screens before bed',.25],['Nap',.25],['Sauna or hot bath',.5]],Walk:[['Long walk',1],['Walk after dinner',.25],['Morning walk',.5],['Hike',2],['Walk a new route',.5]]}};
const SOULT={Order:[['Clear your desk',.25],['Set three priorities',.25]],Purpose:[['Write your why in one line',.25],['Review long-term goals',.5]],'Blessing others':[['Tell someone what they did well',.25],['Do a favor unasked',.25]],
  Discipline:[['Cold shower',.25],['No phone first hour',1]],Courage:[["Have the conversation you've avoided",.5],['Do the hard thing before noon',1]],'Decisive action':[["Decide one thing you've stalled on",.25]],
  Learning:[['Learn the basics of a new skill',.5]],'Self-awareness':[['Write about a trigger',.25]],Mastery:[['Deliberate practice',.5]],
  Connection:[['Call Dad',.5],['Coffee with a friend',1]],Presence:[['Meal with no phone',.5],['Walk, no headphones',.25]],Creativity:[['Make something for someone',1]]};
function funTree(p){if(p==='Mind')return CATS.map(c=>({n:c.n,c:`var(${c.c})`,s:c.it.map(it=>({n:it[0],a:axes.findIndex(x=>x.it===it),i:MTASK[it[0]]||[]}))}));
  if(p==='Body')return Object.entries(BODYT).map(([n,o])=>({n,c:'var(--ember)',s:Object.entries(o).map(([m,i])=>({n:m,i}))}));
  if(p==='Soul')return ARCH.map(A=>({n:A.n,c:'var(--gold)',s:A.subs.map(([m])=>({n:m,i:(POOLS[m]||[]).map(([z,q])=>[q,{S:.25,M:.5,L:1}[z]])}))}));return []}
const funDone=st=>st.p==='Task'||st.fix||st.s!=null;
const funSub=st=>st.p&&st.c!=null&&st.s!=null?funTree(st.p)[st.c].s[st.s]:null;
const funIdeas=st=>{const x=funSub(st);return x?x.i:[]};
function funTiles(st,hint){let items,l;
  if(st.p==null){items=[['Mind','var(--cobalt)','Mind'],['Body','var(--ember)','Body'],['Soul','var(--gold)','Soul'],['To-do','var(--ink)','Task']].map(([n,c,v])=>({n,c,v}));l='p'}
  else{const T=funTree(st.p);if(st.c==null){items=T.map((x,i)=>({n:x.n,c:x.c,v:i}));l='c'}else{items=T[st.c].s.map((x,i)=>({n:x.n,c:T[st.c].c,v:i}));l='s'}}
  return `<div class="fgrid${items.length%2?' one':''}">${items.map(x=>`<button class="ftile cond" data-l="${l}" data-v="${x.v}" style="background:${x.c}">${hint&&hint(l,x.v)?'<span class="fh">Needs work</span>':''}<span class="fn">${x.n}</span></button>`).join('')}</div>`}
function funCrumb(st){if(!st.p)return `<span class="lab" style="color:var(--muted)">Pick a pillar</span>`;const T=funTree(st.p),parts=[['p',st.p==='Task'?'To-do':st.p]];
  if(st.c!=null)parts.push(['c',T[st.c].n]);if(st.s!=null)parts.push(['s',T[st.c].s[st.s].n]);
  const nxt=funDone(st)?'Pick one':st.c==null?'Pick a category':'Pick an activity';
  return `<div class="fcrumb"><button data-b="up" aria-label="Back">‹</button>${parts.map(([l,n])=>`<button data-b="${l}" style="background:${PCOL[st.p]};color:${st.p==='Soul'?'var(--ink)':'#fff'}">${n}</button>`).join('')}<span>${nxt}</span></div>`}
function funClick(st,e){const t=e.target.closest('[data-l]');if(t){const v=t.dataset.v;if(t.dataset.l==='p'){st.p=v;st.c=st.s=null;st.fix=false}else if(t.dataset.l==='c'){st.c=+v;st.s=null}else st.s=+v;return true}
  const b=e.target.closest('[data-b]');if(b){const l=b.dataset.b;st.fix=false;if(l==='up'){if(st.lock&&st.c==null)return true;if(st.p==='Task'||st.c==null){st.p=null;st.c=st.s=null}else if(st.s!=null)st.s=null;else st.c=null}else if(l==='p'){st.c=st.s=null;if(st.p==='Task'&&!st.lock)st.p=null}else if(l==='c')st.s=null;return true}return false}
let slE=-1,slP='Mind',slH=null,slA=4,slD=.5,slSt={p:null,c:null,s:null};
var slPick=null;
const hl=h=>`${Math.floor(h)%12||12}${h%1?':'+String(Math.round(h%1*60)).padStart(2,'0'):''}${h<12?'a':'p'}`;
function gapStarts(k,dur){const out=[];let end=-1;freeStarts(k,Math.max(.25,dur)).forEach(h=>{if(h>=end){out.push(h);end=h+Math.max(.5,dur)}});return out}
function slotAll(){const L=THREE.map((t,i)=>i).filter(i=>THREE[i][2]==null&&!THREE[i][4]).sort((a,b)=>THREE[b][3]-THREE[a][3]);let n=0;
  L.forEach(i=>{const h=freeStarts(i,Math.max(.25,THREE[i][3]))[0];if(h!=null){THREE[i][2]=h;n++}});slPick=null;renderPlan();renderHome();toast(n?`Slotted ${n} · tap a block to move it`:'No free time left today')}
function freeStarts(skip,dur){const busy=[...CAL.map(c=>[c[1],c[1]+c[2]]),...THREE.filter((t,i)=>i!==skip&&t[2]!=null).map(t=>[t[2],t[2]+Math.max(.25,t[3])])];const out=[];
  for(let h=Math.max(7,Math.ceil(nowH()*2)/2);h+dur<=23&&out.length<8;h+=.5){if(!busy.some(([a,b])=>h<b&&h+dur>a))out.push(h)}return out}
function renderSlot(){const st=slSt,dn=funDone(st);$('#slCrumb').innerHTML=funCrumb(st);$('#slFun').innerHTML=dn?'':funTiles(st);$('#slFinal').style.display=dn?'flex':'none';$('#slBtns').style.display=dn?'flex':'none';
  if(st.p)slP=st.p;const sb=funSub(st);if(sb&&sb.a!=null)slA=sb.a;
  $('#slIdea').innerHTML=funIdeas(st).map(([n,d],k)=>`<button data-i="${k}" class="${$('#slName').value===n?'on':''}"><span>${n}</span><small>${slP==='Soul'?'All day':dlab(d)}</small></button>`).join('');
  $('#slDur').innerHTML=DUR.map(([d,l])=>`<button data-d="${d}" class="${d===slD?'on':''}">${l}</button>`).join('');
  const sl=slP==='Soul'&&funDone(st);$('#slFinal').querySelectorAll('.lab,#slDur,#slTimes').forEach(x=>x.style.display=sl?'none':'');if(sl){slH='later'}
  const fs=freeStarts(slE,slD);if(slE>=0&&THREE[slE][2]!=null&&THREE[slE][2]===slH&&!fs.includes(slH))fs.unshift(slH);fs.sort((a,b)=>a-b);if(slH!=null&&slH!=='later'&&!fs.includes(slH))slH=fs[0]??'later';
  $('#slTimes').innerHTML=fs.map(h=>`<button data-h="${h}" class="${h===slH?'on':''}">${fmt(h)}–${fmt(h+slD)}</button>`).join('')+`<button data-h="later" class="${slH==='later'?'on':''}">Not yet</button>`}
function openSlot(i,pre){slE=i;const t=THREE[i];$('#slTitle').textContent=t?(t[2]==null?'Slot it':'Edit it'):'Add to today';$('#slName').value=t?t[0]:'';slP=t?t[1]:'Mind';slH=t?(t[2]??'later'):'later';slA=t&&t[5]!=null?t[5]:4;slD=t?t[3]:.5;
  if(pre){$('#slName').value=pre.n;slP=pre.p;slA=pre.a;slD=pre.d;slH=freeStarts(-1,pre.d)[0]??'later'}
  slSt={p:null,c:null,s:null};if(t||pre){slSt.p=slP;const a=t?t[5]:pre.a;if(slP==='Mind'&&a!=null){const ci=axes[a].ci;slSt.c=ci;slSt.s=CATS[ci].it.indexOf(axes[a].it)}else slSt.fix=true}
  $('#slSave').textContent=t?'Save':'Add';$('#slDel').style.display=t?'':'none';renderSlot();openSheet('slot')}
$('#slCrumb').onclick=$('#slFun').onclick=e=>{if(funClick(slSt,e)){if(!funDone(slSt))$('#slName').value='';renderSlot()}};
$('#slIdea').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const [n,d]=funIdeas(slSt)[+b.dataset.i];$('#slName').value=n;slD=d;renderSlot()};
$('#slDur').onclick=e=>{const b=e.target.closest('[data-d]');if(b){slD=+b.dataset.d;renderSlot()}};
$('#slTimes').onclick=e=>{const b=e.target.closest('[data-h]');if(b){slH=b.dataset.h==='later'?'later':+b.dataset.h;renderSlot()}};
$('#slSave').onclick=()=>{const act=slP==='Mind'&&slSt.s!=null?slA:(slP==='Mind'&&slE>=0?THREE[slE][5]:null),sb=funSub(slSt),n=$('#slName').value.trim()||(sb?sb.n:'Untitled');if(slE>=0){const t=THREE[slE];if(t[4]&&t[5]!=null)togglePlan(slE);const hh=slH==='later'?null:slH;t[0]=n;t[1]=slP;t[2]=hh;t[3]=slD;t[5]=act}else THREE.push([n,slP,slH==='later'?null:slH,slD,false,act,null,metaOf(slSt)]);if(slE>=0)THREE[slE][7]=metaOf(slSt)||THREE[slE][7];save();
  sortPlan();closeSheet();renderPlan();renderHome();toast(slP==='Soul'?'Today\'s challenge set. Keep it in mind':slH==='later'?'On your list. Slot it when you\'re ready':`Slotted at ${fmt(slH)}`)};
$('#slDel').onclick=()=>{const t=THREE[slE];if(t&&t[4])togglePlan(slE);THREE.splice(slE,1);save();closeSheet();renderPlan();renderHome();toast('Removed')};

$$('#sh-log [data-lg]').forEach(b=>b.onclick=()=>{closeSheet();setTimeout(()=>openSheet(b.dataset.lg),250)});
let DCH='',PFT=null;const DRAFT=[],DALT=[];let dAlt=0;
const fmtA=h=>fmt(h).replace('am','a').replace('pm','p');
function freeBlocks(date){const st=date===TODAY?Math.ceil(nowH()):0;return FB.map(([a,b])=>[Math.max(a,st),b]).filter(([a,b])=>b-a>=.5)}
function buildDraft(){DRAFT.length=0;DALT.length=0;const fb=freeBlocks(PFT);let bi=0;const at=()=>{const b=fb[bi++];return b?b[0]:null};
  if(PFT!==TODAY)THREE.filter(t=>!t[4]&&t[6]!=='hero'&&t[1]!=='Task').slice(0,2).forEach(t=>DRAFT.push([null,t[0],t[1],'Carried over · '+dlab(t[3]),t[3],null,t[7]||null,t[5]]));
  if(!DRAFT.some(d=>d[2]==='Body')){const w=nextWorkout();DRAFT.push([null,w,'Body','Strength · '+WORKOUTS[w].length+' exercises',1,null,{c:'Strength',a:'Strength'},null])}
  if(!DRAFT.some(d=>d[2]==='Mind')){const ms=(obSel.Mind||[]).filter(n=>axes.some(a=>a.it[0]===n)),pool=axes.map((a,i)=>i).filter(i=>!ms.length||ms.includes(axes[i].it[0]));const ai=pool.sort((x,y)=>axes[x].it[1]-axes[y].it[1])[0];DRAFT.push([null,axes[ai].it[0],'Mind',`${axes[ai].it[1]} of ${GOAL} min this week`,.5,null,null,ai])}
  DRAFT.forEach(d=>{d[5]=at();d[0]=d[5]==null?'Any time':fmtA(d[5])});
  const w=weakest();DCH=AVG.every(v=>v===0)?'Start with '+traitKey(w):traitKey(w)+' is lowest';for(let k=0;k<3;k++){const q=questFor(w,k);if(!DALT.some(x=>x[0]===q.q))DALT.push([q.q,q])}}
function renderDraft(){$('#pfDraft').innerHTML=`<div class="drow dch"><span class="dt">All day</span><span class="dn"><b>${DALT[dAlt][0]}</b><small><i class="dot" style="margin:0 5px 0 0;background:var(--gold)"></i>Challenge · ${DCH}</small></span><button class="dsw" data-dsw aria-label="Swap">↻</button></div>`+DRAFT.map(d=>`<div class="drow"><span class="dt">${d[0]}</span><span class="dn"><b>${d[1]}</b><small><i class="dot" style="margin:0 5px 0 0;background:${PCOL[d[2]]}"></i>${d[3]}</small></span></div>`).join('');
  $('#pfStake').innerHTML=`<button data-dst="s"><small>This week · win 5 of 7</small>${WSP}</button><button data-dst="f"><small>If I don't · rolled</small>🎲 ${FFT[ffSize(missRun+1)]} forfeit</button>`}
function findQuest(text){for(const [k,L] of Object.entries(POOLS)){const x=L.find(y=>y[1]===text);if(x){const i=TR.findIndex(t=>traitKey(TR.indexOf(t))===k);return {a:TR[i][1],t:k,q:text,xp:SZ[x[0]][1],sz:SZ[x[0]][0]}}}return {a:0,t:'Order',q:text,xp:25,sz:'Medium'}}
function commitPlan(items,quest){const L=items.map(x=>[x[0],x[1],x[2],x[3],false,x[5]??null,null,x[4]||null]);
  if(PFT===TODAY){L.forEach(x=>{if(!THREE.some(t=>t[0]===x[0]&&!t[4]))THREE.push(x)});if(quest&&!QUESTS.some(q=>q.q===quest.q))QUESTS.splice(qi,0,quest);sortPlan();renderQuest()}
  else D.tomorrow={date:PFT,items:L,quest};
  const first=!DAY().planned;DAY().planned=true;save();endClose();go(PFT===TODAY?'today':'plan');if(first)checkXP(20,'Planned');setTimeout(()=>toast(PFT===TODAY?'Today is set':'Tomorrow is set'),1600)}
const metaOf=st=>{if(!st||!st.p||st.c==null)return null;if(st.p==='Body'){const c=Object.keys(BODYT)[st.c];return c?{c,a:Object.keys(BODYT[c])[st.s]||c}:null}if(st.p==='Soul'){const A=ARCH[st.c];return A&&st.s!=null?{t:A.subs[st.s][0]}:null}return null};
const aiOf=st=>{const sb=funSub(st);return st.p==='Mind'&&sb&&sb.a!=null?sb.a:null};
$('#pfStake').onclick=e=>{const b=e.target.closest('[data-dst]');if(!b)return;if(b.dataset.dst==='s'){WSP=rot(STK.week,WSP);save()}else openStakes();renderDraft()};
function startPF(){PFT=!closing&&nowH()<18&&!THREE.some(t=>t[6]!=='hero')?TODAY:addDays(TODAY,1);const td=PFT===TODAY;$('#pf0T').textContent=td?'Today, drafted':'Tomorrow, drafted';$('#pf1T').textContent=td?"What's on today?":"What's on tomorrow?";buildDraft();pfSel=[];pfCh=null;pfL=null;pfD=.5;pfSt={p:null,c:null,s:null};$('#pfBack').style.display='none';$('#pf0').style.display='flex';$('#pf1').style.display='none';$('#pf2').style.display='none';$('#pfStep').textContent=closing?'Close the day · 3 of 3':td?'Plan today':'Plan tomorrow';dAlt=0;renderDraft();renderPF()}
$('#pfDraft').onclick=e=>{if(e.target.closest('[data-dsw]')){dAlt=(dAlt+1)%DALT.length;renderDraft()}};
function endClose(){closing=false;FLOWG.planflow='planflow'}
$('#pfOk').onclick=()=>commitPlan(DRAFT.map(d=>[d[1],d[2],d[5],d[4],d[6],d[7]]),DALT[dAlt][1]);
$('#pfChange').onclick=()=>{pfSel=DRAFT.map(d=>[d[1],d[2],null,d[4]||.5,d[6],d[7]]);pfCh=DALT[dAlt][0];$('#pf0').style.display='none';$('#pf1').style.display='flex';stepIn($('#pf1'));$('#pfBack').style.display='';$('#pfBack').dataset.to='0';$('#pfStep').textContent=(PFT===TODAY?'Plan today':'Plan tomorrow')+' · 1 of 2';renderPF()};
/* sunday review */
let rv=1,rvSel=[],swapped=false,rvW={},rvCur='Mind',rvSt={p:'Mind',c:null,s:null,lock:1};
const WT={Mind:[[3,'days'],[5,'days'],[7,'days']],Body:[[2,'sessions'],[3,'sessions'],[4,'sessions']],Soul:[[2,'quests'],[3,'quests'],[5,'quests']]};
function rvHint(l,v){const p=rvSt.p;if(p==='Soul')return l==='c'?ARCH[+v].s<70:l==='s'&&ARCH[rvSt.c].subs[+v][1]<60;if(p==='Mind')return l==='c'?false:l==='s'&&CATS[rvSt.c].it[+v][1]<10;if(p==='Body')return l==='c'&&v==2;return false}
let rvM={};
function rvGoalName(st,n){const sb0=funSub(st);rvM[st.p]={p:st.p,sub:sb0.n,k:WT[st.p][n][0]};const sb=funSub(st),[k,u]=WT[st.p][n];return st.p==='Soul'?`${k} ${sb.n} quests`:st.p==='Body'?`${sb.n} ${k}× this week`:`${sb.n} ${k} days`}
const RVG=[['One Courage quest every day','Soul'],['Sleep 7h+ five nights','Body'],['Train 4 times','Body'],['Write 5 days','Mind'],['Finish Econ problem set','Mind'],['Call Dad twice','Soul']];
let HRS={Mind:2.5,Body:2,Soul:.5};const BUSY=[8,7,6,9,4,0,0];
const hf=h=>{const m=Math.round(h*60);return Math.floor(m/60)+(m%60?':'+String(m%60).padStart(2,'0'):'h')};
function renderHours(){$('#wkBusy').innerHTML=['M','T','W','T','F','S','S'].map((d,i)=>`<div><i style="height:${BUSY[i]/10*44}px"></i><span>${d}</span></div>`).join('');
  const tot=HRS.Mind+HRS.Body+HRS.Soul;$('#hTot').textContent=hf(tot);
  $('#hRows').innerHTML=Object.entries(HRS).map(([p,h])=>`<div class="hrow"><i class="dot" style="margin:0;background:${PCOL[p]}"></i><span>${p}</span><button data-hp="${p}" data-hd="-0.5">−</button><b>${hf(h)}</b><button data-hp="${p}" data-hd="0.5">+</button></div>`).join('')}
function renderRV(){$$('#v-review .rv').forEach((x,i)=>x.style.display=i===rv-1?'flex':'none');stepIn($$('#v-review .rv')[rv-1]);$('#rvStep').textContent=`Sunday review · ${rv} of 3`;
  renderWG();if(0)$('#rvGoals').innerHTML=RVG.map(([n,p])=>{const on=rvSel.includes(n);return `<button data-g="${n}" class="${on?'on':''}" style="${on?`background:${PCOL[p]};color:${p==='Soul'?'var(--ink)':'#fff'}`:''}">${n}</button>`}).join('');
  $('#rvBack').style.display=rv>1?'':'none';$('#rvNext').textContent=rv===3?'Start the week':rv===2&&rvSel.length<3?`Pick ${3-rvSel.length} more`:'Next';$('#rvNext').classList.toggle('off',rv===2&&rvSel.length<3)}
function renderWG(){rvSel=Object.values(rvW).filter(Boolean);
  $('#rvSlots').innerHTML=['Mind','Body','Soul'].map(p=>`<button data-ws="${p}" class="${p===rvCur?'cur':''}${rvW[p]?' set':''}" style="--c:${PCOL[p]}"><span class="lab">${p}</span><b>${rvW[p]||'Pick one'}</b></button>`).join('');
  const st=rvSt;let body;if(!rvCur){$('#rvGoals').innerHTML='';return}
  if(st.s!=null){const sb=funSub(st);body=`<div class="fgrid one">${WT[st.p].map(([k,u],i)=>`<button class="ftile cond" data-t="${i}" style="background:${PCOL[st.p]}"><span class="fn">${k} ${u}</span><span class="fs">${st.p==='Mind'?`${sb.i[0]?dlab(sb.i[0][1]):'30 min'} each`:st.p==='Body'?(i===0?'Easy week':i===1?'Steady':'Push it'):(i===0?'Light':i===1?'Steady':'All in')}</span></button>`).join('')}</div>`}
  else body=funTiles(st,rvHint);
  $('#rvGoals').innerHTML=funCrumb(st).replace(/Pick one|Pick a category|Pick an activity/,m=>st.s!=null?'How often?':m)+body}
$('#rvSlots').onclick=e=>{const b=e.target.closest('[data-ws]');if(!b)return;rvCur=b.dataset.ws;rvSt={p:rvCur,c:null,s:null,lock:1};renderWG()};
$('#rvGoals').onclick=e=>{const t=e.target.closest('[data-t]');if(t){rvW[rvCur]=rvGoalName(rvSt,+t.dataset.t);const nx=['Mind','Body','Soul'].find(p=>!rvW[p]);if(nx)rvCur=nx;rvSt={p:rvCur,c:null,s:null,lock:1};renderRV();return}
  if(funClick(rvSt,e))renderWG()};
$('#rvBack').onclick=()=>{if(rv>1){rv--;stepDir=-1;renderRV();stepDir=1;setNotes('review'+(rv===1?'':rv))}};
$('#rvSwap').onclick=()=>{if(swapped&&!confirm('Your free swap is used. Swap again for 50 XP?'))return;if(swapped){xp=Math.max(0,xp-50);save()}swapped=true;const l=$('#rvLabor');l.animate([{transform:'rotateY(0)'},{transform:'rotateY(90deg)'},{transform:'rotateY(0)'}],{duration:450});rvHero=(rvHero+1)%HEROES.length;setTimeout(()=>{$('#rvLaborT').textContent=HEROES[rvHero][0];$('#rvLaborS').textContent=HEROES[rvHero][1]+' · +150 XP · trophy'},220);$('#rvSwap').textContent='Swap · 50 XP'};
$('#rvNext').onclick=()=>{if(rv===2&&rvSel.length<3)return;if(rv<3){rv++;renderRV();setNotes('review'+rv);return}
  const wk=dObj(TODAY).getDay()===0?addDays(weekStart(TODAY),7):weekStart(TODAY);D.weekGoals={week:wk,goals:['Mind','Body','Soul'].map(p=>({...rvM[p],name:rvW[p]})),paid:{}};
  const H=HEROES[rvHero];if(wk===weekStart(TODAY)&&!D.hero){setHero(H,wk)}else D.heroNext={week:wk,h:H};
  const first=!DAY().review;DAY().review=true;DAY().reviewLine=$('#rvLine').value.trim()||undefined;save();go('plan');if(first)checkXP(40,'Sunday review')};
let rvHero=0;
function startRV(){rv=1;rvSel=[];rvM={};swapped=false;const W=last7(),won=W.filter(d=>d===TODAY?dayWon:D.days[d]&&D.days[d].won).length,qs=D.questLog.filter(q=>W.includes(q.d)).length;
  $('#rvStats').innerHTML=`<div><b class="n">${won}</b><span>of 7 days</span></div><div><b class="n">${qs}</b><span>quests</span></div><div><b class="n">${TREE().v}%</b><span>overall</span></div>`;
  const wo=D.workouts.filter(w=>W.includes(w.date)).length,mm=D.mindLog.filter(e=>W.includes(e.d)).reduce((t,e)=>t+e.m,0),ci=D.checkins.filter(c=>W.includes(c.d)).length,sl=W.filter(d=>D.sleep[d]&&D.sleep[d].min<420).length;
  const wins=[won?`Won ${won} day${won>1?'s':''}`:'',wo?`${wo} workout${wo>1?'s':''}`:'',mm?`${Math.round(mm/6)/10}h of Mind time`:'',qs?`${qs} Soul quest${qs>1?'s':''}`:'',ci?`${ci} check-in${ci>1?'s':''}`:''].filter(Boolean);
  const T=TREE(),lowP=[...T.k].sort((a,b)=>a.v-b.v)[0],miss=[`${traitKey(weakest())}: your lowest trait`,lowP&&lowP.v<50?`${lowP.n} is behind at ${lowP.v}%`:'',sl?`Sleep under 7h on ${sl} night${sl>1?'s':''}`:'',7-won?`${7-won} day${7-won>1?'s':''} not won`:''].filter(Boolean);
  $('#rvWins').innerHTML=`<span class="lab" style="color:var(--gold)">Wins</span>`+(wins.length?wins.map(x=>`<span>${x}</span>`).join(''):'<span>Your first week. It fills in as you log.</span>');
  $('#rvMiss').innerHTML=`<span class="lab" style="color:var(--ember)">Missed</span>`+miss.slice(0,3).map(x=>`<span>${x}</span>`).join('');
  const ms=(obSel.Mind||[]).filter(n=>axes.some(a=>a.it[0]===n)),mi=axes.map((a,i)=>i).filter(i=>!ms.length||ms.includes(axes[i].it[0])).sort((x,y)=>axes[x].it[1]-axes[y].it[1])[0],wt=traitKey(weakest());
  rvW={Mind:`${axes[mi].it[0]} 5 days`,Body:'Strength 3× this week',Soul:`3 ${wt} quests`};rvM={Mind:{p:'Mind',sub:axes[mi].it[0],k:5},Body:{p:'Body',sub:'Strength',k:3},Soul:{p:'Soul',sub:wt,k:3}};
  rvCur=null;rvSt={p:'Mind',c:null,s:null,lock:1};const lp=lowP?lowP.n:'Body';rvHero=Math.max(0,HEROES.findIndex(h=>h[1]===lp));if(D.hero&&HEROES[rvHero][0]===D.hero.text)rvHero=(rvHero+1)%HEROES.length;
  $('#rvLaborT').textContent=HEROES[rvHero][0];$('#rvLaborS').textContent=HEROES[rvHero][1]+' · +150 XP · trophy';$('#rvSwap').textContent='Swap (1 free)';$('#rvLine').value='';renderRV()}
function setNotes(){}
/* ---------- persistence ---------- */
let saveT;function save(){clearTimeout(saveT);saveT=setTimeout(saveNow,120)}
function saveNow(){clearTimeout(saveT);if(!D)return;
  Object.assign(D,{xp,level,streak,missRun,stk:STK,wsp:WSP,hsp:HSP,fbase:FBASE,fmac:FMAC,save:{on:fdSave,k:SAVE.k,days:SAVE.days,start:SAVE.start},notif:NOTIF,mtask:MTASK,avg:AVG,ob:{sel:obSel,k:obK,extra:OBA}});
  D.today={date:TODAY,items:THREE,flog:FLOG,fchk:FCHK,water,quests:QUESTS,qi,qdone,won:dayWon};
  const d=DAY();d.won=dayWon;d.done=THREE.filter(t=>t[4]).length+qdone;d.food={total:fdTotal(),logged:todayLogged()};d.flog=FLOG;d.water=water;d.qdone=qdone;try{d.ov=TREE().v}catch(e){}
  try{localStorage.setItem(KEY,JSON.stringify(D))}catch(e){toast('Could not save on this device')}}
function restoreToday(t){THREE.length=0;(t.items||[]).forEach(x=>THREE.push(x));FMEALS.forEach(m=>FLOG[m]=(t.flog&&t.flog[m])||[]);for(const k in FCHK)delete FCHK[k];Object.assign(FCHK,t.fchk||{});
  water=t.water||0;QUESTS.length=0;(t.quests||[]).forEach(q=>QUESTS.push(q));qi=t.qi||0;qdone=t.qdone||0;dayWon=!!t.won}
function newDay(){THREE.length=0;FMEALS.forEach(m=>FLOG[m]=[]);for(const k in FCHK)delete FCHK[k];water=0;DONE_T.clear();QUESTS.length=0;qi=0;qdone=0;dayWon=false;
  const T=D.tomorrow;if(T&&T.date===TODAY){T.items.forEach(x=>THREE.push(x));if(T.quest)QUESTS.push(T.quest)}D.tomorrow=null;
  if(!QUESTS.length)QUESTS.push(questFor(weakest()));
  ensureHero();if(D.hero&&!D.hero.done&&!THREE.some(t=>t[6]==='hero'))THREE.push([`Hero: ${D.hero.short}`,D.hero.pil,null,.5,false,null,'hero']);sortPlan()}
/* close out every day since the last one: won keeps the streak, a freeze covers one miss, otherwise the streak resets and a forfeit is rolled */
function rollover(){const t=D.today;if(!t||t.date>=TODAY)return false;let d=t.date,missed=0;
  while(d<TODAY){const x=D.days[d]||(D.days[d]={});const won=d===t.date?!!t.won:!!x.won;x.won=won;
    if(won)D.missRun=0;else if(D.freezes>0){D.freezes--;x.freeze=true}else{D.streak=0;D.missRun=(D.missRun||0)+1;missed++}
    d=addDays(d,1);if(weekStart(d)!==D.freezeWeek){D.freezeWeek=weekStart(d);D.freezes=Math.min(1,(D.freezes||0)+1)}}
  streak=D.streak;missRun=D.missRun;
  if(missed){const [n,z]=rollFF(missRun);D.forfeit={date:TODAY,n,z,run:missRun,seen:false}}
  newDay();return true}
function showForfeit(){const F=D.forfeit;if(!F||F.date!==TODAY||F.seen)return;
  $('#ffT').textContent='Forfeit: '+F.n.toLowerCase()+' today';$('#ffTag').innerHTML=`<i class="sktag ${F.z}">${FFT[F.z]}</i> <span style="font-size:12px;color:#c9c2b8;margin-left:6px">${ORD[Math.min(2,F.run-1)]} miss in a row</span>`;
  $('#ffWhy').textContent='Rolled from your list. Honor system. Win today and the next one starts small again.';$('#forfx').classList.add('on');
  $('#forfx .btn').onclick=()=>{$('#forfx').classList.remove('on');F.seen=true;save()}}
function nudge(){if(!D.setup||cur==='onb'||document.querySelector('.bsheet.on')||$('#notif').classList.contains('on'))return;const h=nowH(),pm=parseInt(NOTIF.pm)+12,am=parseInt(NOTIF.am),N=D.nudged||(D.nudged={});
  if(h>=pm&&!DAY().closed&&N.close!==TODAY){N.close=TODAY;save();return showNotif('Close the day: did you live fully?','eve')}
  if(dObj(TODAY).getDay()===0&&h>=18&&!DAY().review&&N.review!==TODAY){N.review=TODAY;save();return showNotif('Your Sunday review is ready','review')}
  if(h>=am&&h<pm&&Date.now()-(D.lastCheckin||0)>4*36e5&&Date.now()-(N.ci||0)>4*36e5){N.ci=Date.now();save();return showNotif('Check-in: how are you feeling?','ci1')}}
function dayTick(){const t=dayOf();if(t!==TODAY){saveNow();TODAY=t;rollover();saveNow();renderAll();go('today');showForfeit()}checkGoals();nudge()}
function renderAll(){recalcMind();recalcFood();renderQuest();skyDraw();radar();mcard();renderHome();renderPlan();paintBody();renderWater();$('#soulPct').textContent=PV('Soul')}
/* ---------- backup ---------- */
function exportData(){saveNow();const b=new Blob([JSON.stringify(D)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`prometheus-${TODAY}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast('Backup saved')}
function importData(){const i=document.createElement('input');i.type='file';i.accept='application/json,.json';i.onchange=async()=>{try{const x=JSON.parse(await i.files[0].text());if(!x||x.v!==1||!x.days)throw 0;if(!confirm('Replace everything on this device with this backup?'))return;localStorage.setItem(KEY,JSON.stringify(x));location.reload()}catch(e){toast('That file is not a Prometheus backup')}};i.click()}
/* first run: bring weights, meals and workout days over from WRKT (same site, same storage) */
function importWRKT(){let w;try{w=JSON.parse(localStorage.getItem('wt:v1')||'null')}catch(e){}if(!w)return 0;let n=0;
  (w.weights||[]).forEach(x=>{if(x.date&&x.lbs){D.weights[x.date]=x.lbs;n++}});
  const MM={breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner',snack:'Snack'};
  (w.foods||[]).forEach(f=>{if(!f.date||f.date>=TODAY)return;const d=D.days[f.date]||(D.days[f.date]={}),fl=d.flog||(d.flog={Breakfast:[],Lunch:[],Dinner:[],Snack:[]});(fl[MM[f.meal]||'Snack']).push([f.name,Math.round(f.kcal||0),Math.round(f.protein||0),Math.round(f.carbs||0),Math.round(f.fat||0)]);n++});
  Object.values(D.days).forEach(d=>{if(d.flog){const t=FMEALS.reduce((a,m)=>a+d.flog[m].reduce((s,x)=>s+x[1],0),0);d.food={total:t,logged:t>0}}});
  (w.workouts||[]).forEach(x=>{if(x.date){D.workouts.push({id:x.id||uid(),date:x.date,name:x.planName||'Workout',sec:Math.round(((x.end||0)-(x.start||0))/1000),ex:[]});n++}});
  if(w.profile&&w.profile.goalWeight)D.goalWeight=w.profile.goalWeight;D.wrktImported=n;return n}
function load(){let raw=null;try{raw=localStorage.getItem(KEY)}catch(e){}
  if(raw){try{D=Object.assign(blankStore(),JSON.parse(raw))}catch(e){D=blankStore()}}else{D=blankStore();importWRKT()}
  xp=D.xp||0;level=D.level||1;streak=D.streak||0;missRun=D.missRun||0;
  if(D.stk)Object.assign(STK,D.stk);if(D.wsp)WSP=D.wsp;if(D.hsp)HSP=D.hsp;if(D.fbase)Object.assign(FBASE,D.fbase);if(D.fmac)Object.assign(FMAC,D.fmac);
  if(D.save){fdSave=!!D.save.on;Object.assign(SAVE,{k:D.save.k||1500,days:D.save.days||17,start:D.save.start||null})}
  if(D.notif)Object.assign(NOTIF,D.notif);if(D.mtask){for(const k in MTASK)delete MTASK[k];Object.assign(MTASK,D.mtask)}
  if(D.avg&&D.avg.length===12)AVG=D.avg;if(D.ob){if(D.ob.sel)obSel=D.ob.sel;if(D.ob.k)obK=D.ob.k;if(D.ob.extra)Object.assign(OBA,D.ob.extra)}
  if(D.today&&D.today.date===TODAY)restoreToday(D.today);else if(D.today){restoreToday(D.today);rollover()}else newDay();
  day1=!Object.keys(D.days).some(d=>d<TODAY&&D.days[d].done);}
/* every tap or edit is saved */
['click','input','change'].forEach(ev=>document.addEventListener(ev,()=>{save();setTimeout(checkGoals,400)},true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();else dayTick()});
addEventListener('pagehide',saveNow);

/* ---------- boot ---------- */
stG=addFlame($('#stGhost'),140);stF=addFlame($('#stFlame'),150);addFlame($('#lvFlame'),132);
load();saveNow();renderAll();growHome();
if(!D.setup)go('onb');else{go('today');showForfeit();if(D.wrktImported&&!D.wrktToast){D.wrktToast=1;toast('Brought over your WRKT history')}}
requestAnimationFrame(loop);setInterval(dayTick,60000);setTimeout(nudge,2500);
