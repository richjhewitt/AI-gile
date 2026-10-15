/* aigile.lol teaser: AI-gile in as many words as you like (AIG-695, AIG-1117) and the live card count (AIG-697). Plain JS, no trackers. */
(function(){
  var RELAY="https://relay.aigile.lol", BOARD="ai-gile", POLL_MS=30000, LINES="teaser-lines.json";
  var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $=function(i){return document.getElementById(i)};

  // AI-gile in N words (AIG-1117): the slider picks a length; each length has its own texts, written for that size (not a prefix of a longer one).
  var sec=$("pitch"),box=$("pitch-text"),range=$("pitch-range"),count=$("pitch-count"),quip=$("pitch-quip"),dice=$("pitch-dice");
  var data=null,alt=0;
  function letters(t){var m=t.match(/[A-Za-zÀ-ɏ]/g);return m?m.length:0}
  function draw(animate){
    var z=data.sizes[+range.value],t=z.texts[alt%z.texts.length],w=z.n===1?" word":" words";
    box.textContent="";var sp=document.createElement("span");sp.className="w"+(animate&&!reduce?" new":"");sp.textContent=t;box.appendChild(sp);
    count.textContent=z.n+w+" · "+letters(t)+" letters";
    range.setAttribute("aria-valuetext",z.n+w);
    var q=(data.quips||{})[z.n];quip.textContent=q||"";
  }
  function step(d){range.value=Math.max(0,Math.min(+range.max,+range.value+d));draw(true)}
  range.addEventListener("input",function(){draw(true)});
  range.addEventListener("wheel",function(e){e.preventDefault();step(e.deltaY<0?1:-1)},{passive:false});
  dice.addEventListener("click",function(){
    var k=data.sizes[+range.value].texts.length;if(k<2)return;
    var cur=alt%k,j;do{j=Math.floor(Math.random()*k)}while(j===cur);alt=j;draw(true);
  });
  // Opened from a file (double-click) the browser blocks fetch: teaser-lines.js (window.TEASER_LINES) is the fallback (AIG-697).
  fetch(LINES).then(function(r){if(!r.ok)throw 0;return r.json()}).catch(function(){if(window.TEASER_LINES)return window.TEASER_LINES;throw 0}).then(function(d){
    if(!d||!Array.isArray(d.sizes)||!d.sizes.length)return;
    d.sizes=d.sizes.filter(function(z){return z&&z.n>0&&Array.isArray(z.texts)&&z.texts.length});if(!d.sizes.length)return;
    data=d;range.min=0;range.max=d.sizes.length-1;range.value=0;alt=Math.floor(Math.random()*3);sec.hidden=false;draw(false);
  }).catch(function(){});

  // The live card count: cards in the relay's public board JSON
  var line=$("board-count"),num=$("board-n"),cur=null,raf=0;
  function show(to){
    var fn=$("famous-n");if(fn){fn.textContent=to;$("famous-us").hidden=false}
    if(cur===null||reduce||cur===to){num.textContent=to;cur=to;return}
    var from=cur,t0=performance.now();cur=to;cancelAnimationFrame(raf);
    (function tick(t){var p=Math.min(1,(t-t0)/700);num.textContent=Math.round(from+(to-from)*p);if(p<1)raf=requestAnimationFrame(tick)})(t0);
  }
  function poll(){
    fetch(RELAY+"/b/"+BOARD+".json",{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(s){
      if(!s||!Array.isArray(s.cards))throw 0;
      line.hidden=false;show(s.cards.length);
    }).catch(function(){line.hidden=true});
  }
  poll();setInterval(poll,POLL_MS);

  // The timeline (AIG-778/779): site/timeline.json from tools/gen/timeline.mjs. Dates in the visitor's own locale.
  var tl=$("timeline");
  function when(iso){
    var d=new Date(iso);if(isNaN(d))return "";
    try{return d.toLocaleString(undefined,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch(e){return d.toString()}
  }
  function item(s,planned){
    var li=document.createElement("li");li.className="tl-item"+(planned?" planned":"");
    var h=document.createElement("h3");h.textContent=s.name;
    if(planned){var tag=document.createElement("span");tag.className="tl-tag";tag.textContent="planned";h.appendChild(document.createTextNode(" "));h.appendChild(tag)}
    li.appendChild(h);
    if(!planned&&s.start){
      var t=document.createElement("p");t.className="tl-when";
      var a=document.createElement("time");a.setAttribute("datetime",s.start);a.textContent=when(s.start);t.appendChild(a);
      if(s.end&&s.end!==s.start){var b=document.createElement("time");b.setAttribute("datetime",s.end);b.textContent=when(s.end);t.appendChild(document.createTextNode(" → "));t.appendChild(b)}
      li.appendChild(t);
    }
    var p=document.createElement("p");p.className="tl-line";p.textContent=s.line||"";li.appendChild(p);
    if(s.cards){var n=document.createElement("p");n.className="tl-cards";n.textContent=s.cards+(s.cards===1?" card":" cards");li.appendChild(n)}
    return li;
  }
  // window.TIMELINE comes from timeline.js (works from file://, where fetch is blocked); timeline.json is the fallback.
  var tlData=window.TIMELINE&&Array.isArray(window.TIMELINE.stages)?Promise.resolve(window.TIMELINE)
    :fetch("timeline.json").then(function(r){if(!r.ok)throw 0;return r.json()});
  tlData.then(function(d){
    if(!d||!Array.isArray(d.stages)||!d.stages.length)return;
    var a=$("tl-done"),b=$("tl-planned");
    d.stages.forEach(function(s){a.appendChild(item(s,false))});
    (d.planned||[]).forEach(function(s){b.appendChild(item(s,true))});
    if(!b.children.length){b.hidden=true;$("tl-today").hidden=true}
    tl.hidden=false;
  }).catch(function(){});

  // Famous apps (AIG-842): site/famous-apps.json (famous-apps.js from a file), every line has its source links.
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
