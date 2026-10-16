/* aigile.lol pre-teaser (AIG-1320): the theme button, the 👥 humans · 🤖 agents line and the board behind the glass.
   The real board is site/live.js (relay /b/aigile.json + /live, CORS *). When it can't be reached, a made-up board moves
   its bars the same way, and the caption says so. Reduced motion: nothing moves. Plain JS, no trackers, no cookies. */
(function(){
  var RELAY="https://relay.aigile.lol", T=SiteI18n.t, $=function(i){return document.getElementById(i)};
  var reduce=function(){return matchMedia("(prefers-reduced-motion: reduce)").matches};

  // Theme: light, dark, then black (as the teaser, AIG-1301); the button shows the next one
  var root=document.documentElement,tb=$("theme");
  function cur(){if(root.hasAttribute("data-black"))return"black";var t=root.getAttribute("data-theme");if(t)return t;return matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}
  var NEXT={light:"dark",dark:"black",black:"light"},ICON={dark:"&#9790;",black:"&#9673;",light:"&#9728;"},TIP={dark:"theme.toDark",black:"theme.toBlack",light:"theme.toLight"};
  function paint(){var n=NEXT[cur()];tb.innerHTML=ICON[n];tb.title=T(TIP[n])}
  tb.addEventListener("click",function(){var n=NEXT[cur()];root.setAttribute("data-theme",n==="black"?"dark":n);if(n==="black")root.setAttribute("data-black","");else root.removeAttribute("data-black");try{localStorage.setItem("aigile-site-theme",n)}catch(e){}paint()});
  SiteI18n.on(paint);

  // 👥 Humans and Agents (AIG-1314, same rules as the teaser): hidden while the relay can't be reached or answers nonsense
  var ppl=$("people-count"),pLast=null;
  function pShow(o){
    var parts=[["humans",o.humans,"people.humans.html"],["agents",o.agents,"people.agents.html"]];if(o.working>0)parts.push(["working",o.working,"people.working.html"]);
    ppl.innerHTML=parts.map(function(x){return '<span class="pc-'+x[0]+'">'+T(x[2],{n:"<b>"+x[1]+"</b>",count:x[1]})+"</span>"}).join('<span class="sep" aria-hidden="true">·</span>');
  }
  function pPoll(){
    fetch(RELAY+"/people.json",{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(o){
      var n=function(v){return typeof v==="number"&&isFinite(v)&&v>=0?Math.round(v):null};
      if(!o||!n(o.humans)||n(o.agents)==null)throw 0;
      pLast={humans:n(o.humans),agents:n(o.agents),working:n(o.working)||0};ppl.hidden=false;pShow(pLast);
    }).catch(function(){ppl.hidden=true});
  }
  SiteI18n.on(function(){if(pLast)pShow(pLast)});
  pPoll();setInterval(pPoll,60000);
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")pPoll()});

  // 🌙 AIG-1388: while Rich is quiet the board's snapshot says night: a line under the people count and the night colours
  // (data-night on the root, a soft fade in pre.css). Off again when he's back, or when the board can't be reached.
  var nightEl=$("pre-night"),tc=document.querySelector('meta[name="theme-color"]'),tc0=tc&&tc.content,fadeT=0;
  function night(on){
    on=!!on;nightEl.hidden=!on;
    if(on!==root.hasAttribute("data-night")){root.setAttribute("data-nightfade","");clearTimeout(fadeT);fadeT=setTimeout(function(){root.removeAttribute("data-nightfade")},1000)}
    if(on)root.setAttribute("data-night","");else root.removeAttribute("data-night");
    if(tc)tc.content=on?"#0b0605":tc0;
  }
  document.addEventListener("live:snap",function(e){night(e.detail&&e.detail.night===true)});

  // Behind the glass: the live board when it has cards, else the made-up one
  var live=$("live"),liveCols=$("live-cols"),fake=$("pre-fake"),fcols=$("pre-fake-cols"),peek=$("pre-peek"),t0=Date.now(),mode="";
  var COLS=["backlog","todo","doing","review","verify","team","done"],TYPES=["task","task","feature","feature","bug","incident"],cards=[],timer=0;
  function liveOk(){return !live.hidden&&!live.classList.contains("off")&&!!liveCols.querySelector(".lv-card")}
  function caption(k){peek.setAttribute("data-i18n",k);peek.textContent=T(k)}
  function mk(c){var e=document.createElement("div");e.className=c;return e}
  function seed(){
    for(var i=0;i<30;i++){var e=mk("lv-card t-"+TYPES[i%TYPES.length]+(i%9===4?" p-high":""));e.style.width=(30+((i*37)%70))+"%";cards.push({el:e,col:Math.min(6,Math.floor(i/4.5))})}
  }
  function draw(){
    var before=cards.map(function(c){return c.el.isConnected?c.el.getBoundingClientRect():null});
    var tr=T("live.cols").split("|"),STD=["Backlog","To do","In progress","Team checking","For you to test","For the team","Done"];
    fcols.textContent="";
    COLS.forEach(function(id,i){
      var d=mk("lv-col k-"+id),h=document.createElement("h3");h.textContent=tr.length===7&&tr[i]?tr[i]:STD[i];d.appendChild(h);
      cards.forEach(function(c){if(c.col===i)d.appendChild(c.el)});fcols.appendChild(d);
    });
    if(reduce())return;
    cards.forEach(function(c,i){
      var b=before[i];if(!b)return;var r=c.el.getBoundingClientRect(),dx=b.left-r.left,dy=b.top-r.top;if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
      var e=c.el;e.style.transition="none";e.style.transform="translate("+dx+"px,"+dy+"px)";e.style.position="relative";e.style.zIndex=2;
      requestAnimationFrame(function(){requestAnimationFrame(function(){e.style.transition="transform .7s ease";e.style.transform="";setTimeout(function(){e.style.transition="";e.style.position="";e.style.zIndex=""},800)})});
    });
  }
  // One step: a card moves on a column (its glow shows which); a full Done column sends its oldest card back to the backlog.
  function step(){
    var done=cards.filter(function(c){return c.col===6});
    var c=done.length>9?done[0]:null;
    if(c){cards.splice(cards.indexOf(c),1);cards.push(c);c.col=0}
    else{var open=cards.filter(function(x){return x.col<6});c=open[Math.floor(Math.random()*open.length)];c.col++;cards.splice(cards.indexOf(c),1);cards.push(c)}
    draw();c.el.classList.remove("moved");void c.el.offsetWidth;c.el.classList.add("moved");
  }
  function setMode(m){
    if(m===mode)return;mode=m;
    live.style.display=m==="live"?"":"none";fake.hidden=m!=="fake";
    caption(m==="fake"?"pre.peekFake":"pre.peek");
    clearInterval(timer);timer=0;
    if(m==="fake"){if(!cards.length)seed();draw();if(!reduce())timer=setInterval(function(){if(!document.hidden)step()},2400)}
  }
  function check(){if(liveOk())setMode("live");else if(Date.now()-t0>4000||live.classList.contains("off"))setMode("fake")}
  check();setInterval(check,1500);
  SiteI18n.on(function(){if(mode==="fake")draw();if(mode)caption(mode==="fake"?"pre.peekFake":"pre.peek")});
  window.__pre={mode:function(){return mode},step:step,night:function(){return root.hasAttribute("data-night")}};
})();
