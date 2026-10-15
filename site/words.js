/* 📖 Dev words on the teaser (AIG-1285): the app's glossary (backlog, sprint, commit...) in the page's language.
   A button next to the 🌐 language button opens a dialog with a search box and every word with its plain explanation.
   "Underline these words on the page" puts a dotted line under those words in the page's own text; hover, focus or tap
   one for its explanation (like the app's markDevWords). The choice is kept in localStorage aigile-site-devwords.
   Texts: SiteI18n.words() (made from public/lang by tools/gen/site-lang.mjs) and words.* in site/lang/<code>.json. */
(function(){
  var I=window.SiteI18n;if(!I||!I.words)return;
  var KEY="aigile-site-devwords";
  var CSS=".words-btn .words-label{margin-inline-start:6px}"+
    "@media (max-width:560px){.words-btn{padding:0}.words-btn .words-label{display:none}}"+
    ".words-dlg{width:min(520px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--line);border-radius:14px;background:var(--raised);color:var(--text);box-shadow:var(--shadow-lg)}"+
    ".words-dlg::backdrop{background:rgba(10,12,16,.55)}"+
    ".words-dlg[open]{display:flex;flex-direction:column}"+
    "@media (prefers-reduced-motion:no-preference){.words-dlg[open]{animation:words-in .14s ease-out}@keyframes words-in{from{opacity:0;transform:translateY(6px)}}}"+
    ".words-in{display:flex;flex-direction:column;gap:10px;padding:16px;min-height:0;text-align:start}"+
    ".words-head{display:flex;align-items:center;justify-content:space-between;gap:8px}"+
    ".words-head h2{margin:0;font-size:20px}"+
    ".words-x{flex:none;width:44px;height:44px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:inherit;font-size:20px;line-height:1;cursor:pointer}"+
    ".words-x:hover{background:var(--hover)}"+
    ".words-intro,.words-help,.words-none{margin:0;color:var(--muted);font-size:14px}"+
    ".words-count{margin:-4px 0 0;color:var(--muted);font-size:13px}.words-zero{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}"+
    ".words-group[hidden]{display:none}.words-gh{margin:14px 0 0;padding:0 2px 6px;font-size:16px;border-bottom:2px solid var(--line)}.words-group:first-child .words-gh{margin-top:6px}.words-gl{margin:0}"+
    ".words-q{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text)}"+
    ".words-opt{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;font-weight:600}"+
    ".words-opt input{width:20px;height:20px;margin:0;accent-color:var(--accent);flex:none}"+
    ".words-list{margin:0;padding:0;overflow-y:auto;min-height:80px;border-top:1px solid var(--line)}"+
    ".words-item{padding:10px 2px;border-bottom:1px solid var(--line)}"+
    ".words-item dt{font-weight:700}.words-item dd{margin:2px 0 0;color:var(--text)}"+
    ".words-ul{padding-inline:12px}.words-ul .words-abc{text-decoration:underline dotted;text-decoration-thickness:2px;text-underline-offset:3px;font-weight:700}.words-ul[aria-pressed=true]{background:var(--accent);color:#fff;border-color:var(--accent)}.words-ul[aria-pressed=true] .words-abc{text-decoration-style:solid}"+
    "abbr.devw{text-decoration:underline dotted var(--muted);text-decoration-thickness:1.5px;text-underline-offset:3px;cursor:help;border-radius:3px}"+
    "abbr.devw:focus-visible{outline:2px solid var(--focus);outline-offset:1px}"+
    ".words-tip{position:fixed;z-index:30;max-width:min(300px,calc(100vw - 32px));padding:8px 10px;border-radius:8px;background:var(--text);color:var(--bg);font-size:14px;line-height:1.4;box-shadow:var(--shadow-lg);text-align:start;pointer-events:none}";
  var st=document.createElement("style");st.textContent=CSS;(document.head||document.documentElement).appendChild(st);

  function isOn(){try{return localStorage.getItem(KEY)==="1"}catch(e){return false}}
  function save(v){try{v?localStorage.setItem(KEY,"1"):localStorage.removeItem(KEY)}catch(e){}}
  function setOn(v){save(v);if(box)box.checked=v;if(ul)ul.setAttribute("aria-pressed",v?"true":"false");v?mark():unmark()}
  function el(tag,cls){var e=document.createElement(tag);if(cls)e.className=cls;return e}
  function W(){return I.words()||{list:[]}}
  function fold(s){s=String(s||"").toLowerCase();try{s=s.normalize("NFD").replace(/[̀-ͯ]/g,"")}catch(e){}return s}

  /* ---------- the dialog ---------- */
  var btn,ul,label,dlg,h,intro,input,opt,box,optText,help,dl,none,count,x;
  function paint(){
    var w=W(),full=w.button||"📖 Dev words";
    label.textContent=full.replace(/^[^\p{L}\p{N}]+/u,"")||full;
    btn.setAttribute("aria-label",full);btn.title=full;
    h.textContent=w.h||full;intro.textContent=w.intro||"";
    input.placeholder=w.search||"";input.setAttribute("aria-label",w.search||full);
    none.textContent=w.none||"";x.setAttribute("aria-label",w.close||"Close");x.title=x.getAttribute("aria-label");
    optText.textContent=I.t("words.underline");ul.title=I.t("words.underline");ul.setAttribute("aria-label",I.t("words.underline"));help.textContent=I.t("words.underlineHelp");
    list();
  }
  // AIG-1296: a heading per group (h3 under the dialog's h2), A to Z inside each; the search runs across them all.
  function list(){
    var w=W(),loc=I.locale(),groups=(w.groups&&w.groups.length?w.groups:[{id:"",name:""}]);
    var cmp=function(a,b){try{return a.word.localeCompare(b.word,loc)}catch(e){return a.word<b.word?-1:1}};
    dl.textContent="";
    groups.forEach(function(g){
      var items=w.list.filter(function(x){return !g.id||x.g===g.id}).sort(cmp);if(!items.length)return;
      var sec=el("section","words-group"),gl=el("dl","words-gl");sec.setAttribute("data-group",g.id);
      if(g.name){var h3=el("h3","words-gh");h3.id="words-g-"+g.id;h3.textContent=g.name;sec.appendChild(h3);sec.setAttribute("aria-labelledby",h3.id)}
      items.forEach(function(x){
        var d=el("div","words-item"),dt=el("dt"),dd=el("dd");
        dt.textContent=x.word;dd.textContent=x.text;d.appendChild(dt);d.appendChild(dd);
        d._k=fold([x.word,x.text].concat(x.also||[]).join(" "));d.setAttribute("data-id",x.id);gl.appendChild(d);
      });
      sec.appendChild(gl);dl.appendChild(sec);
    });
    filter();
  }
  function counted(n){
    var c=W().count;if(!c)return String(n);
    var k="other";try{k=new Intl.PluralRules(I.locale()).select(n)}catch(e){}
    return String(c[k]||c.other).replace("{count}",n.toLocaleString?n.toLocaleString(I.locale()):n);
  }
  function filter(){
    var q=fold(input.value.trim()),n=0;
    [].forEach.call(dl.querySelectorAll(".words-item"),function(d){var hit=!q||d._k.indexOf(q)>=0;d.hidden=!hit;if(hit)n++});
    [].forEach.call(dl.querySelectorAll(".words-group"),function(s){s.hidden=!s.querySelector(".words-item:not([hidden])")});
    none.hidden=n>0;
    // With no match the visible "no word matches" line says it; the count line still reads it out, unseen.
    count.textContent=n?counted(n):(W().none||"");count.classList.toggle("words-zero",!n);
  }
  function open(){input.value="";filter();box.checked=isOn();hideTip();dlg.showModal();input.focus()}
  function mount(){
    var slot=document.getElementById("words-slot");if(!slot)return;
    btn=el("button","lang-btn words-btn");btn.type="button";btn.id="words-btn";btn.setAttribute("aria-haspopup","dialog");
    btn.appendChild(document.createTextNode("📖"));label=el("span","words-label");btn.appendChild(label);slot.appendChild(btn);
    // AIG-1288: the underline switch one click away on the page, next to the button (a dotted Abc reads in every language)
    ul=el("button","lang-btn words-ul");ul.type="button";ul.id="words-ul";var abc=el("span","words-abc");abc.textContent="Abc";abc.setAttribute("aria-hidden","true");ul.appendChild(abc);ul.setAttribute("aria-pressed",isOn()?"true":"false");slot.appendChild(ul);
    ul.addEventListener("click",function(){setOn(!isOn())});
    dlg=el("dialog","words-dlg");dlg.id="words-dlg";dlg.setAttribute("aria-labelledby","words-h");dlg.setAttribute("data-nowords","");
    var inner=el("div","words-in"),head=el("div","words-head");
    h=el("h2");h.id="words-h";x=el("button","words-x");x.type="button";x.id="words-close";x.textContent="×";
    head.appendChild(h);head.appendChild(x);
    intro=el("p","words-intro");intro.id="words-intro";dlg.setAttribute("aria-describedby","words-intro");
    input=el("input","words-q");input.type="search";input.id="words-q";input.autocomplete="off";
    opt=el("label","words-opt");box=el("input");box.type="checkbox";box.id="words-underline";optText=el("span");opt.appendChild(box);opt.appendChild(optText);
    help=el("p","words-help");dl=el("div","words-list");dl.id="words-list";none=el("p","words-none");none.id="words-none";none.hidden=true;
    // AIG-1296: how many words the search shows, read out as you type (and "no match" when none).
    count=el("p","words-count");count.id="words-count";count.setAttribute("role","status");count.setAttribute("aria-live","polite");count.setAttribute("aria-atomic","true");
    input.setAttribute("aria-describedby","words-count");
    [head,intro,input,count,opt,help,dl,none].forEach(function(e){inner.appendChild(e)});
    dlg.appendChild(inner);document.body.appendChild(dlg);
    btn.addEventListener("click",open);
    x.addEventListener("click",function(){dlg.close()});
    // A click on the dialog box itself (not its inside) is a click on the dimmed backdrop around it.
    dlg.addEventListener("click",function(e){if(e.target===dlg)dlg.close()});
    dlg.addEventListener("close",function(){btn.focus()});
    // Esc closes at once, also from the search box (which would otherwise only clear itself first).
    dlg.addEventListener("keydown",function(e){if(e.key==="Escape"){e.preventDefault();dlg.close()}});
    input.addEventListener("input",filter);
    box.addEventListener("change",function(){setOn(box.checked)});
    paint();
  }

  /* ---------- the dotted words on the page ---------- */
  // Whole words only (inside a sentence for scripts without spaces), never in links, buttons, typing boxes or the dialog.
  var re=null,texts=null,tip=null,tipFor=null,timer=null;
  var SKIP=/^(INPUT|TEXTAREA|SELECT|OPTION|SCRIPT|STYLE|CODE|PRE|ABBR|BUTTON|A|DIALOG|LABEL|OUTPUT|TIME)$/;
  var NOSPACE=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
  function key(v){return String(v).trim().replace(/\s+/g," ").toLowerCase()}
  function index(){
    texts={};
    // AIG-1296: terms of more words ("major incident") match across any run of spaces; the longest term wins where
    // several start at the same place ("major incident" over "incident"), so they are tried longest first.
    W().list.forEach(function(w){if(w.noTip)return;[w.word].concat(w.also||[]).forEach(function(v){var k=key(v);if(k&&!texts[k])texts[k]=w.text})});
    var q=function(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/ /g,"\\s+")},all=Object.keys(texts).sort(function(a,b){return b.length-a.length});
    var sp=all.filter(function(w){return!NOSPACE.test(w)}).map(q),bare=all.filter(function(w){return NOSPACE.test(w)}).map(q),parts=[];
    if(sp.length)parts.push("(?<![\\p{L}\\p{N}])(?:"+sp.join("|")+")(?![\\p{L}\\p{N}])");
    if(bare.length)parts.push("(?:"+bare.join("|")+")");
    re=new RegExp(parts.join("|")||"(?!)","giu");
  }
  function scope(){return[].slice.call(document.querySelectorAll("main, footer"))}
  function mark(){
    if(!isOn())return;if(!re)index();
    scope().forEach(function(root){
      var walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
        for(var p=n.parentElement;p&&p!==root.parentElement;p=p.parentElement)if(SKIP.test(p.tagName)||p.hasAttribute("data-nowords")||p.hidden&&p!==root)return NodeFilter.FILTER_REJECT;
        re.lastIndex=0;return re.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;
      }});
      var nodes=[];while(walk.nextNode())nodes.push(walk.currentNode);
      nodes.forEach(function(n){
        var f=document.createDocumentFragment(),s=n.nodeValue,last=0,m;re.lastIndex=0;
        while((m=re.exec(s))){
          f.appendChild(document.createTextNode(s.slice(last,m.index)));
          var a=el("abbr","devw");a.tabIndex=0;a.setAttribute("data-tip",texts[key(m[0])]||"");a.textContent=m[0];f.appendChild(a);
          last=m.index+m[0].length;
        }
        f.appendChild(document.createTextNode(s.slice(last)));n.parentNode.replaceChild(f,n);
      });
    });
  }
  function unmark(){
    hideTip();
    [].forEach.call(document.querySelectorAll("abbr.devw"),function(a){var p=a.parentNode;p.replaceChild(document.createTextNode(a.textContent),a);p.normalize()});
  }
  function showTip(a){
    if(!tip){tip=el("div","words-tip");tip.id="words-tip";tip.setAttribute("role","tooltip");document.body.appendChild(tip)}
    if(tipFor&&tipFor!==a)tipFor.removeAttribute("aria-describedby");
    tipFor=a;tip.textContent=a.getAttribute("data-tip");tip.hidden=false;a.setAttribute("aria-describedby","words-tip");
    var r=a.getBoundingClientRect(),w=tip.offsetWidth,ht=tip.offsetHeight,vw=document.documentElement.clientWidth;
    var left=document.documentElement.getAttribute("dir")==="rtl"?r.right-w:r.left;
    left=Math.max(16,Math.min(left,vw-16-w));
    var top=r.bottom+6;if(top+ht>innerHeight-8)top=Math.max(8,r.top-6-ht);
    tip.style.left=Math.round(left)+"px";tip.style.top=Math.round(top)+"px";
  }
  function hideTip(){if(tip)tip.hidden=true;if(tipFor){tipFor.removeAttribute("aria-describedby");tipFor=null}}
  function devw(e){return e.target&&e.target.closest?e.target.closest("abbr.devw"):null}
  document.addEventListener("mouseover",function(e){var a=devw(e);if(a)showTip(a)});
  document.addEventListener("mouseout",function(e){var a=devw(e);if(a&&a===tipFor&&!a.contains(e.relatedTarget)&&document.activeElement!==a)hideTip()});
  document.addEventListener("focusin",function(e){var a=devw(e);a?showTip(a):hideTip()});
  // A tap on a word shows (or hides) its explanation; a tap anywhere else hides it.
  var tapOpen=false;
  document.addEventListener("pointerdown",function(e){var a=devw(e);tapOpen=e.pointerType!=="mouse"&&!!a&&a===tipFor&&!!tip&&!tip.hidden});
  document.addEventListener("click",function(e){var a=devw(e);if(!a)return hideTip();if(tapOpen){tapOpen=false;hideTip()}else showTip(a)});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&tipFor)hideTip()});
  addEventListener("scroll",function(){if(tipFor)hideTip()},{passive:true});
  // The page fills itself in (slider, timeline, live board): mark what is new, a moment after it lands.
  function start(){
    new MutationObserver(function(){if(!isOn())return;clearTimeout(timer);timer=setTimeout(mark,150)}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
    mount();
    // A new language: new texts, new words to underline.
    I.on(function(){if(btn)paint();unmark();re=null;mark()});
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();
