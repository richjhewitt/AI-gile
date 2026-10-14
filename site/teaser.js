/* aigile.lol teaser: the one-word-at-a-time pitch (AIG-695) and the live card count (AIG-697). Plain JS, no trackers. */
(function(){
  var RELAY="https://relay.aigile.lol", BOARD="ai-gile", POLL_MS=30000, LINES="teaser-lines.json";
  var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $=function(i){return document.getElementById(i)};

  // The pitch
  var sec=$("pitch"),box=$("pitch-text"),range=$("pitch-range"),count=$("pitch-count"),quip=$("pitch-quip"),dice=$("pitch-dice");
  var data=null,vi=0,words=[],shown=0;
  function setVersion(i){
    vi=i;words=String(data.versions[i].words||"").trim().split(/\s+/).filter(Boolean);
    range.max=Math.max(1,words.length);box.textContent="";shown=0;
  }
  function draw(animate){
    var n=Math.min(+range.value,words.length);
    while(shown>n){box.removeChild(box.lastChild);shown--}
    while(shown<n){
      var sp=document.createElement("span");sp.className="w"+(animate&&!reduce?" new":"");
      sp.textContent=(shown?" ":"")+words[shown];box.appendChild(sp);shown++;
    }
    count.textContent=n+" / "+words.length;
    var best=0,q=(data&&data.quips)||{};
    for(var k in q){var m=+k;if(m<=n&&m>best)best=m}
    quip.textContent=best?q[best]:"";
  }
  function step(d){range.value=Math.max(1,Math.min(+range.max,+range.value+d));draw(true)}
  range.addEventListener("input",function(){draw(true)});
  range.addEventListener("wheel",function(e){e.preventDefault();step(e.deltaY<0?1:-1)},{passive:false});
  dice.addEventListener("click",function(){
    if(data.versions.length<2)return;
    var j;do{j=Math.floor(Math.random()*data.versions.length)}while(j===vi);
    var keep=+range.value;setVersion(j);range.value=Math.min(keep,+range.max);draw(false);
  });
  // Opened from a file (double-click) the browser blocks fetch: teaser-lines.js (window.TEASER_LINES) is the fallback (AIG-697).
  fetch(LINES).then(function(r){if(!r.ok)throw 0;return r.json()}).catch(function(){if(window.TEASER_LINES)return window.TEASER_LINES;throw 0}).then(function(d){
    if(!d||!d.versions||!d.versions.length)return;
    data=d;sec.hidden=false;setVersion(Math.floor(Math.random()*d.versions.length));range.value=1;draw(false);
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
