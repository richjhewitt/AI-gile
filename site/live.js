/* aigile.lol "Watch it being built, live" (AIG-1232): the AI-gile board from the relay's public board /b/aigile, every card text hidden.
   Natively drawn (the relay answers CORS *): snapshot from .json, then SSE /live. Cards are small bars sized by len, moved with FLIP. */
(function(){
  var RELAY="https://relay.aigile.lol", NAME="aigile";
  var sec=document.getElementById("live"); if(!sec||!window.SiteI18n)return;
  var T=SiteI18n.t, reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cols=document.getElementById("live-cols"), stat=document.getElementById("live-stat"), msg=document.getElementById("live-msg");
  var STD=["Backlog","To do","In progress","Team checking","For you to test","For the team","Done"];
  var MAX=40, els={}, snap=null, viewers=null, es=null, got=false, last=document.getElementById("live-last");
  function mk(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
  function label(l){var i=STD.indexOf(l),tr=T("live.cols").split("|");return i>=0&&tr.length===STD.length&&tr[i]?tr[i]:l}
  function fallback(on){if(on&&last)last.hidden=true;msg.hidden=!on;msg.textContent=on?T("live.offline"):"";cols.hidden=on;stat.hidden=on;if(on)sec.classList.add("off");else sec.classList.remove("off")}
  function paintStat(){if(viewers==null){stat.textContent="";return}stat.textContent="● "+T("live.watching",{n:viewers});stat.hidden=false}
  // AIG-1255: "Last card moved 3 min ago" from the snapshot time (the relay stamps `at` on every change), refreshed every minute.
  function paintLast(){
    var t=snap&&Date.parse(snap.at);if(!last)return;if(!t||isNaN(t)){last.hidden=true;return}
    var m=Math.max(0,Math.floor((Date.now()-t)/60000)),k=m<1?"live.last.now":m<60?"live.last.min":m<1440?"live.last.hour":"live.last.day";
    var n=m<60?m:m<1440?Math.floor(m/60):Math.floor(m/1440);
    last.textContent=T(k,{n:n});last.hidden=false;
  }
  function draw(s){
    snap=s;paintLast();got=true;fallback(false);
    var before={};Object.keys(els).forEach(function(id){if(els[id].isConnected)before[id]=els[id].getBoundingClientRect()});
    var seen={};cols.textContent="";
    (s.columns||[]).forEach(function(c){
      var d=mk("div","lv-col k-"+String(c.id).replace(/[^a-z]/g,"")),h=mk("h3",null,label(c.label));d.appendChild(h);
      var all=(s.cards||[]).filter(function(x){return x.status===c.id}),n=all.length;
      all.slice(-MAX).forEach(function(c2){
        seen[c2.id]=1;
        var e=els[c2.id]||(els[c2.id]=mk("div"));
        e.className="lv-card t-"+String(c2.type||"task").replace(/[^a-z]/g,"")+" p-"+String(c2.priority||"normal").replace(/[^a-z]/g,"");
        e.style.width=Math.max(14,Math.min(100,(c2.len||3)*12))+"%";
        e.setAttribute("aria-hidden","true");
        d.appendChild(e);
      });
      h.appendChild(mk("span","lv-n"," "+n));cols.appendChild(d);
    });
    Object.keys(els).forEach(function(id){if(!seen[id])delete els[id]});
    if(reduce)return;
    Object.keys(seen).forEach(function(id){
      var e=els[id],b=before[id];if(!b)return;var r=e.getBoundingClientRect(),dx=b.left-r.left,dy=b.top-r.top;
      if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
      e.classList.add("moved");e.style.transition="none";e.style.transform="translate("+dx+"px,"+dy+"px)";e.style.position="relative";e.style.zIndex=2;
      requestAnimationFrame(function(){requestAnimationFrame(function(){
        e.style.transition="transform .6s ease";e.style.transform="";
        setTimeout(function(){e.style.transition="";e.style.zIndex="";e.style.position=""},700);setTimeout(function(){e.classList.remove("moved")},1500)})});
    });
  }
  function start(){
    if(!window.EventSource||es||document.hidden)return;
    es=new EventSource(RELAY+"/b/"+NAME+"/live");
    es.addEventListener("snapshot",function(e){try{var s=JSON.parse(e.data);viewers=s.viewers;draw(s);paintStat()}catch(x){}});
    es.addEventListener("viewers",function(e){try{viewers=JSON.parse(e.data).viewers;paintStat()}catch(x){}});
    es.addEventListener("private",function(){fallback(true)});
  }
  // AIG-1254: no stream in a hidden tab (the relay counts every open one as a viewer); it reopens, and redraws from the .json, when the tab is shown.
  function stop(){if(es){es.close();es=null}}
  function load(){
    return fetch(RELAY+"/b/"+NAME+".json",{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(s){viewers=s.viewers;draw(s);paintStat();sec.hidden=false;start()}).catch(function(){sec.hidden=false;fallback(true)});
  }
  document.addEventListener("visibilitychange",function(){if(document.hidden)stop();else load()});
  setInterval(function(){if(!document.hidden)paintLast()},60000);
  try{load()}catch(e){sec.hidden=false;fallback(true)}
  SiteI18n.on(function(){if(snap&&got){var s=snap;draw(s);paintStat()}else if(!msg.hidden)msg.textContent=T("live.offline")});
})();
