/* aigile.lol teaser: AI-gile in as many words as you like (AIG-695, AIG-1117) and the live card count (AIG-697). Plain JS, no trackers.
   Every text comes from SiteI18n (i18n.js, AIG-1226): the page's language, else English. */
(function(){
  var RELAY="https://relay.aigile.lol", BOARD="ai-gile", POLL_MS=30000;
  var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $=function(i){return document.getElementById(i)}, T=SiteI18n.t;

  // AI-gile in N words (AIG-1117): the slider picks a length; each length has its own texts, written for that size (not a prefix of a longer one).
  // AIG-1226: the lines come from the page language's lang/<code>.lines.json (SiteI18n.lines), else English. A language written
  // without spaces ("unit": "chars") counts characters, about 2 per word.
  var sec=$("pitch"),box=$("pitch-text"),range=$("pitch-range"),count=$("pitch-count"),quip=$("pitch-quip"),dice=$("pitch-dice");
  var data=null,alt=0,LET;
  try{LET=new RegExp("\\p{L}","gu")}catch(e){LET=/[A-Za-zÀ-ɏ]/g}
  function letters(t){var m=t.match(LET);return m?m.length:0}
  function draw(animate){
    var z=data.sizes[+range.value],t=z.texts[alt%z.texts.length],chars=data.unit==="chars";
    var len=chars?T("pitch.chars",{n:letters(t)}):T("pitch.words",{n:z.n});
    box.textContent="";var sp=document.createElement("span");sp.className="w"+(animate&&!reduce?" new":"");sp.textContent=t;box.appendChild(sp);
    count.textContent=chars?len:len+" · "+T("pitch.letters",{n:letters(t)});
    range.setAttribute("aria-valuetext",len);
    var q=(data.quips||{})[z.n];quip.textContent=q||"";
  }
  function step(d){range.value=Math.max(0,Math.min(+range.max,+range.value+d));draw(true)}
  range.addEventListener("input",function(){draw(true)});
  range.addEventListener("wheel",function(e){e.preventDefault();step(e.deltaY<0?1:-1)},{passive:false});
  dice.addEventListener("click",function(){
    var k=data.sizes[+range.value].texts.length;if(k<2)return;
    var cur=alt%k,j;do{j=Math.floor(Math.random()*k)}while(j===cur);alt=j;draw(true);
  });
  // On every language change: that language's lines (English while it has none), at the same length where it can.
  function lines(){
    var d=SiteI18n.lines();if(!d||!Array.isArray(d.sizes))return;
    var sizes=d.sizes.filter(function(z){return z&&z.n>0&&Array.isArray(z.texts)&&z.texts.length});if(!sizes.length)return;
    var was=data?data.sizes[+range.value].n:null,first=!data;
    data={code:d.code,unit:d.unit,sizes:sizes,quips:d.quips};
    // English lines on a page in another language keep their own language and direction (screen readers, right-to-left pages).
    [box,quip].forEach(function(e){e.setAttribute("lang",d.code);e.setAttribute("dir",d.code===SiteI18n.lang()?SiteI18n.dir():"ltr")});
    var i=0;sizes.forEach(function(z,k){if(was!=null&&z.n<=was)i=k});
    range.min=0;range.max=sizes.length-1;range.value=i;if(first)alt=Math.floor(Math.random()*3);sec.hidden=false;draw(!first);
  }
  SiteI18n.on(lines);

  // The live card count: cards in the relay's public board JSON
  var line=$("board-count"),cur=null,raf=0;
  function show(to){
    var fn=$("famous-n");if(fn){fn.textContent=to;$("famous-us").hidden=false}
    // The sentence around the number is translated (and its plural picked) for the final count; the number then counts up.
    line.innerHTML=T("count.line.html",{n:'<b id="board-n">'+(cur===null?to:cur)+"</b>",count:to});
    var num=$("board-n");if(!num)return;
    if(cur===null||reduce||cur===to){num.textContent=to;cur=to;return}
    var from=cur,t0=performance.now();cur=to;cancelAnimationFrame(raf);
    (function tick(t){var p=Math.min(1,(t-t0)/700);num.textContent=Math.round(from+(to-from)*p);if(p<1)raf=requestAnimationFrame(tick)})(t0);
  }
  SiteI18n.on(function(){if(cur!==null){var c=cur;cur=null;show(c)}});
  function poll(){
    fetch(RELAY+"/b/"+BOARD+".json",{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(s){
      if(!s||!Array.isArray(s.cards))throw 0;
      line.hidden=false;show(s.cards.length);
    }).catch(function(){line.hidden=true});
  }
  poll();setInterval(poll,POLL_MS);

  // 👥 Humans and Agents (AIG-1314): three counts the owner's board sends the relay (/people.json, no names). Each number counts up
  // when it changes (reduced motion: it just changes); "at work" only while someone is; hidden while the relay can't be reached.
  var ppl=$("people-count"),pNow={},pRaf={};
  function pShow(o){
    var parts=[["humans",o.humans,"people.humans.html"],["agents",o.agents,"people.agents.html"]];if(o.working>0)parts.push(["working",o.working,"people.working.html"]);
    ppl.innerHTML=parts.map(function(x){return '<span class="pc-'+x[0]+'">'+T(x[2],{n:'<b id="pc-'+x[0]+'"></b>',count:x[1]})+"</span>"}).join('<span class="sep" aria-hidden="true">·</span>');
    parts.forEach(function(x){
      var k=x[0],to=x[1],el=$("pc-"+k),from=pNow[k];pNow[k]=to;cancelAnimationFrame(pRaf[k]);
      if(from==null||from===to||matchMedia("(prefers-reduced-motion: reduce)").matches){el.textContent=to;return}
      var t0=performance.now();(function tick(t){var q=Math.min(1,(t-t0)/700);el.textContent=Math.round(from+(to-from)*q);if(q<1)pRaf[k]=requestAnimationFrame(tick)})(t0);
    });
  }
  var pLast=null;
  SiteI18n.on(function(){if(pLast){pNow={};pShow(pLast)}});
  function pPoll(){
    fetch(RELAY+"/people.json",{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(o){
      var n=function(v){return typeof v==="number"&&isFinite(v)&&v>=0?Math.round(v):null};
      if(!o||n(o.humans)==null||!n(o.humans)||n(o.agents)==null)throw 0;
      pLast={humans:n(o.humans),agents:n(o.agents),working:n(o.working)||0};ppl.hidden=false;pShow(pLast);
    }).catch(function(){ppl.hidden=true});
  }
  pPoll();setInterval(pPoll,POLL_MS);
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")pPoll()});   // back on the tab: fresh numbers

  // The timeline (AIG-778/779): site/timeline.json from tools/gen/timeline.mjs. Dates in the page language's locale;
  // names and lines from lang/<code>.timeline.json by stage id (AIG-1226), else timeline.json's English.
  var tl=$("timeline"),tlStages=null;
  function when(iso){
    var d=new Date(iso);if(isNaN(d))return "";
    try{return d.toLocaleString(SiteI18n.locale(),{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch(e){return d.toString()}
  }
  function item(s,planned){
    var li=document.createElement("li");li.className="tl-item"+(planned?" planned":"");
    var h=document.createElement("h3");h.textContent=SiteI18n.timeline(s.id,"name",s.name);
    if(planned){var tag=document.createElement("span");tag.className="tl-tag";tag.textContent=T("tl.planned");h.appendChild(document.createTextNode(" "));h.appendChild(tag)}
    li.appendChild(h);
    if(!planned&&s.start){
      var t=document.createElement("p");t.className="tl-when";
      var a=document.createElement("time");a.setAttribute("datetime",s.start);a.textContent=when(s.start);t.appendChild(a);
      if(s.end&&s.end!==s.start){var b=document.createElement("time");b.setAttribute("datetime",s.end);b.textContent=when(s.end);t.appendChild(document.createTextNode(" → "));t.appendChild(b)}
      li.appendChild(t);
    }
    var p=document.createElement("p");p.className="tl-line";p.textContent=SiteI18n.timeline(s.id,"line",s.line||"");li.appendChild(p);
    if(s.cards){var n=document.createElement("p");n.className="tl-cards";n.textContent=T("tl.cards",{n:s.cards});li.appendChild(n)}
    return li;
  }
  function drawTimeline(){
    var d=tlStages;if(!d)return;
    var a=$("tl-done"),b=$("tl-planned");a.textContent="";b.textContent="";
    d.stages.forEach(function(s){a.appendChild(item(s,false))});
    (d.planned||[]).forEach(function(s){b.appendChild(item(s,true))});
    b.hidden=!b.children.length;$("tl-today").hidden=!b.children.length;
    tl.hidden=false;
  }
  // window.TIMELINE comes from timeline.js (works from file://, where fetch is blocked); timeline.json is the fallback.
  var tlData=window.TIMELINE&&Array.isArray(window.TIMELINE.stages)?Promise.resolve(window.TIMELINE)
    :fetch("timeline.json").then(function(r){if(!r.ok)throw 0;return r.json()});
  tlData.then(function(d){
    if(!d||!Array.isArray(d.stages)||!d.stages.length)return;
    tlStages=d;SiteI18n.on(drawTimeline);
  }).catch(function(){});

  // Famous apps (AIG-842, off since AIG-1222, English only): site/famous-apps.json (famous-apps.js from a file), every line has its source links.
  var faData=window.FAMOUS_APPS&&Array.isArray(window.FAMOUS_APPS.apps)?Promise.resolve(window.FAMOUS_APPS)
    :fetch("famous-apps.json").then(function(r){if(!r.ok)throw 0;return r.json()});
  faData.then(function(d){
    if(!d||!Array.isArray(d.apps)||!d.apps.length)return;
    var ul=$("famous-list"),src=$("famous-sources");
    d.apps.forEach(function(a){
      var li=document.createElement("li"),b=document.createElement("b");
      b.textContent=a.name+": ";li.appendChild(b);li.appendChild(document.createTextNode(a.line||""));ul.appendChild(li);
      var s=document.createElement("li");s.appendChild(document.createTextNode(a.name+": "));
      (a.sources||[]).forEach(function(u,i){
        if(!/^https:\/\//.test(u))return;
        if(i)s.appendChild(document.createTextNode(", "));
        var l=document.createElement("a");l.href=u;l.rel="noopener";l.textContent=u.replace(/^https:\/\/(www\.)?/,"").split("/")[0];s.appendChild(l);
      });
      src.appendChild(s);
    });
    $("famous").hidden=false;
  }).catch(function(){});
})();
