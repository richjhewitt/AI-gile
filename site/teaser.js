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
  fetch(LINES).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
    if(!d||!d.versions||!d.versions.length)return;
    data=d;sec.hidden=false;setVersion(Math.floor(Math.random()*d.versions.length));range.value=1;draw(false);
  }).catch(function(){});

  // The live card count: cards in the relay's public board JSON
  var line=$("board-count"),num=$("board-n"),cur=null,raf=0;
  function show(to){
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
})();
