/* aigile.lol in every language the app has (AIG-1226). Plain JS, no libraries, no cookies.
   Texts: site/lang/<code>.json (flat keys), the slider lines <code>.lines.json, the timeline <code>.timeline.json; each language's
   three files are bundled into lang/<code>.js by tools/gen/site-lang.mjs (a script tag works over https and opened from a file).
   The English text also stays in the HTML (search engines, no-JS); en.js is loaded by every page, so English is the fallback per key.
   Pages mark texts with data-i18n="key" (text), data-i18n-html="key" (markup; keys end in .html) and data-i18n-attr="attr:key;attr:key".
   Plurals: t("key", {n}) (or {count}) reads key.<Intl plural category> (one, few, many...), then key.other.
   Language: the saved pick (localStorage aigile-site-lang), else the first device language (navigator.languages) that has a file. */
(function(){
  var KEY="aigile-site-lang",RTL={ar:1,he:1,fa:1,ur:1,ps:1,sd:1,yi:1,ckb:1};
  var D=window.SITE_LANG_DATA=window.SITE_LANG_DATA||{};
  var LIST=Array.isArray(window.SITE_LANGS)&&window.SITE_LANGS.length?window.SITE_LANGS:[{code:"en",label:"EN",name:"English",locale:"en-GB"}];
  var root=document.documentElement,listeners=[],applied=false;
  var EN=D.en||{ui:{}},cur={code:"en",data:EN};
  function ls(){try{return localStorage.getItem(KEY)}catch(e){return null}}
  function save(c){try{localStorage.setItem(KEY,c)}catch(e){}}
  function langOf(c){for(var i=0;i<LIST.length;i++)if(LIST[i].code===c)return LIST[i];return null}
  function prefs(){try{return navigator.languages&&navigator.languages.length?[].slice.call(navigator.languages):[navigator.language||"en"]}catch(e){return["en"]}}
  function region(p){var m=String(p).split(/[-_]/).slice(1).filter(function(x){return/^[A-Za-z]{2}$/.test(x)});return m.length?m[0].toUpperCase():""}
  function locale(){
    if(cur.code!=="en")return(langOf(cur.code)||{}).locale||cur.code;
    var p=prefs().filter(function(x){return/^en[-_][a-z]{2}$/i.test(x)})[0];return p?"en-"+region(p):"en-GB";
  }

  // Device languages in order, as the app picks them: nl-BE gets Flemish, zh-Hant/TW/HK/MO Traditional Chinese, pt-BR Brazilian,
  // tl Filipino, nb/nn Norwegian, iw Hebrew. Fun languages are never picked by themselves. English last.
  function deviceCodes(){
    var out=[];function add(c){var l=langOf(c);if(l&&!l.fun&&out.indexOf(c)<0)out.push(c)}
    prefs().forEach(function(p){
      var c=String(p).toLowerCase().split(/[-_]/)[0],r=region(p);
      LIST.forEach(function(l){if(l.region&&l.base===c&&r===l.region)add(l.code)});
      if(c==="zh"&&(/hant/i.test(p)||["TW","HK","MO"].indexOf(r)>=0))add("zh-tw");
      if(c==="pt"&&r==="BR")add("pt-br");
      var alias={tl:"fil",nb:"no",nn:"no",iw:"he"}[c];if(alias)add(alias);
      add(c);
    });
    add("en");return out;
  }

  // A language's bundle: lang/<code>.js sets SITE_LANG_DATA[code]. cb(true) once it is in, cb(false) when there is no file yet.
  function load(code,cb){
    if(D[code])return cb(true);
    if(!/^[a-z0-9-]+$/i.test(code))return cb(false);
    var s=document.createElement("script"),done=false,timer=setTimeout(function(){fin(false)},4000);
    function fin(ok){if(done)return;done=true;clearTimeout(timer);cb(ok&&!!D[code])}
    s.src="lang/"+code+".js";s.onload=function(){fin(true)};s.onerror=function(){fin(false)};
    (document.head||root).appendChild(s);
  }
  function first(codes,cb){var c=codes.shift();if(!c)return cb("en");load(c,function(ok){ok?cb(c):first(codes,cb)})}

  var PR={};
  function cat(n){try{var l=locale();return(PR[l]=PR[l]||new Intl.PluralRules(l)).select(Number(n))}catch(e){return Number(n)===1?"one":"other"}}
  function look(ui,key,vars){
    if(!ui)return null;
    var n=vars?(vars.count!=null?vars.count:vars.n):null;
    if(n!=null&&!(key in ui)){var v=ui[key+"."+cat(n)];return v!=null?v:ui[key+".other"]!=null?ui[key+".other"]:null}
    return ui[key]!=null?ui[key]:null;
  }
  function t(key,vars){
    var s=look(cur.data.ui,key,vars);if(s==null)s=look(EN.ui,key,vars);if(s==null)return key;
    s=String(s);return vars?s.replace(/\{(\w+)\}/g,function(m,k){return k in vars?vars[k]:m}):s;
  }

  function apply(){
    var l=langOf(cur.code)||{},tag=cur.code==="en"?"en":l.fun?(l.locale||"en"):cur.code;
    root.setAttribute("lang",tag);root.setAttribute("dir",l.dir==="rtl"||RTL[cur.code]?"rtl":"ltr");
    [].forEach.call(document.querySelectorAll("[data-i18n]"),function(e){var v=t(e.getAttribute("data-i18n"));if(v!==e.getAttribute("data-i18n"))e.textContent=v});
    [].forEach.call(document.querySelectorAll("[data-i18n-html]"),function(e){var v=t(e.getAttribute("data-i18n-html"));if(v!==e.getAttribute("data-i18n-html"))e.innerHTML=v});
    [].forEach.call(document.querySelectorAll("[data-i18n-attr]"),function(e){
      e.getAttribute("data-i18n-attr").split(";").forEach(function(p){var i=p.indexOf(":");if(i<1)return;var a=p.slice(0,i).trim(),k=p.slice(i+1).trim(),v=t(k);if(v!==k)e.setAttribute(a,v)});
    });
    paintButton();
    applied=true;root.classList.remove("i18n-wait");
    listeners.forEach(function(f){try{f(cur.code)}catch(e){}});
  }
  function use(code,cb){load(code,function(ok){if(ok)cur={code:code,data:D[code]};if(cb)cb(ok);if(ok||!applied)whenDom(apply)})}
  function whenDom(f){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f,{once:true}):f()}

  /* The language button (top right) and its searchable list */
  var CSS=".i18n-wait body{visibility:hidden}"+
    ".lang-pick{position:relative;display:inline-block}"+
    ".lang-btn{min-height:44px;min-width:44px;padding:0 14px;border-radius:999px;border:1px solid var(--line,#dde1e8);background:var(--surface,var(--card,#eef0f3));color:var(--text,inherit);font:inherit;font-weight:600;cursor:pointer;white-space:nowrap}"+
    ".lang-btn:hover{background:var(--hover,var(--line,#e4e8ee))}"+
    ".lang-pop{position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:20;width:min(320px,calc(100vw - 32px));background:var(--raised,var(--card,#fff));color:var(--text,inherit);border:1px solid var(--line,#dde1e8);border-radius:12px;box-shadow:var(--shadow-lg,0 12px 32px rgba(0,0,0,.2));padding:8px;text-align:start}"+
    ".lang-pop input{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border-radius:8px;border:1px solid var(--line,#dde1e8);background:var(--bg,#fff);color:inherit}"+
    ".lang-list{list-style:none;margin:6px 0 0;padding:0;max-height:min(60vh,420px);overflow-y:auto}"+
    ".lang-list button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:6px 10px;border:0;border-radius:8px;background:none;color:inherit;font:inherit;text-align:start;cursor:pointer}"+
    ".lang-list button:hover,.lang-list button:focus-visible{background:var(--hover,var(--line,#e4e8ee))}"+
    ".lang-list button[aria-current=true]{font-weight:700}"+
    ".lang-list small{color:var(--muted,#677085);font-size:12px;unicode-bidi:isolate}"+
    ".lang-none,.lang-msg{margin:8px 4px 2px;color:var(--muted,#677085);font-size:14px}"+
    ".top-end{display:flex;align-items:center;gap:8px}";
  var st=document.createElement("style");st.textContent=CSS;(document.head||root).appendChild(st);

  var btn=null,pop=null,input=null,ul=null,none=null,note=null;
  function el(tag,cls){var e=document.createElement(tag);if(cls)e.className=cls;return e}
  function paintButton(){
    if(!btn)return;var l=langOf(cur.code)||LIST[0];
    btn.textContent="🌐 "+l.label;btn.setAttribute("aria-label",t("lang.button",{name:l.name}));btn.title=btn.getAttribute("aria-label");
    input.placeholder=t("lang.search");input.setAttribute("aria-label",t("lang.search"));pop.setAttribute("aria-label",t("lang.dialog"));none.textContent=t("lang.none");
  }
  function fold(s){s=String(s||"").toLowerCase();try{s=s.normalize("NFD").replace(/[̀-ͯ]/g,"")}catch(e){}return s}
  // Searchable by the language's own name, its label and code, and its name in the page's language and in English ("German" finds Deutsch).
  function names(l){
    var out=[l.name,l.label,l.code];
    [locale(),"en"].forEach(function(x){try{var n=new Intl.DisplayNames([x],{type:"language"}).of(l.code);if(n&&n!==l.code)out.push(n)}catch(e){}});
    return fold(out.join(" "));
  }
  function build(){
    ul.textContent="";
    LIST.forEach(function(l){
      var li=el("li"),b=el("button"),n=el("span"),c=el("small");
      b.type="button";b.setAttribute("data-code",l.code);b.setAttribute("aria-current",l.code===cur.code?"true":"false");
      n.textContent=l.name;n.setAttribute("lang",l.fun?(l.locale||"en"):l.code);n.setAttribute("dir","auto");c.textContent=l.label;
      b.appendChild(n);b.appendChild(c);li.appendChild(b);li._k=names(l);ul.appendChild(li);
    });
  }
  function filter(){
    var q=fold(input.value.trim()),any=false;
    [].forEach.call(ul.children,function(li){var on=!q||li._k.indexOf(q)>=0;li.hidden=!on;if(on)any=true});
    none.hidden=any;
  }
  function visible(){return[].filter.call(ul.querySelectorAll("button"),function(b){return!b.parentNode.hidden})}
  function open(){
    build();input.value="";filter();note.textContent="";
    // Phone width: the list spans the screen under the button (the button need not be the last thing in the header).
    var r=btn.getBoundingClientRect();pop.style.cssText=innerWidth<560?"position:fixed;top:"+Math.round(r.bottom+6)+"px;left:16px;right:16px;width:auto":"";
    pop.hidden=false;btn.setAttribute("aria-expanded","true");input.focus()}
  function close(back){pop.hidden=true;btn.setAttribute("aria-expanded","false");if(back)btn.focus()}
  function pick(code){
    note.textContent="";
    use(code,function(ok){
      if(ok){save(code);close(true)}
      else{var l=langOf(code)||{};note.textContent=t("lang.notYet",{name:l.name||code})}
    });
  }
  function mount(){
    var slot=document.getElementById("lang-slot");if(!slot)return;
    var box=el("div","lang-pick");btn=el("button","lang-btn");pop=el("div","lang-pop");input=el("input");ul=el("ul","lang-list");none=el("p","lang-none");note=el("p","lang-msg");
    btn.type="button";btn.id="lang-btn";btn.setAttribute("aria-haspopup","dialog");btn.setAttribute("aria-expanded","false");
    pop.hidden=true;pop.setAttribute("role","dialog");input.type="search";input.autocomplete="off";none.hidden=true;note.setAttribute("role","status");
    pop.appendChild(input);pop.appendChild(ul);pop.appendChild(none);pop.appendChild(note);box.appendChild(btn);box.appendChild(pop);slot.appendChild(box);
    btn.addEventListener("click",function(){pop.hidden?open():close(false)});
    input.addEventListener("input",filter);
    input.addEventListener("keydown",function(e){
      var v=visible();
      if(e.key==="ArrowDown"&&v.length){e.preventDefault();v[0].focus()}
      else if(e.key==="Enter"&&v.length){e.preventDefault();pick(v[0].getAttribute("data-code"))}
    });
    ul.addEventListener("click",function(e){var b=e.target.closest("button[data-code]");if(b)pick(b.getAttribute("data-code"))});
    ul.addEventListener("keydown",function(e){
      var v=visible(),i=v.indexOf(document.activeElement);if(i<0)return;
      if(e.key==="ArrowDown"){e.preventDefault();(v[i+1]||v[i]).focus()}
      else if(e.key==="ArrowUp"){e.preventDefault();(i?v[i-1]:input).focus()}
      else if(e.key==="Home"){e.preventDefault();v[0].focus()}
      else if(e.key==="End"){e.preventDefault();v[v.length-1].focus()}
    });
    pop.addEventListener("keydown",function(e){if(e.key==="Escape"){e.preventDefault();close(true)}});
    document.addEventListener("click",function(e){if(!pop.hidden&&!box.contains(e.target))close(false)});
    paintButton();
  }

  window.SiteI18n={
    t:t,
    lang:function(){return cur.code},
    locale:locale,
    dir:function(){return root.getAttribute("dir")||"ltr"},
    // The slider lines in the page's language, else English: {code, unit, sizes, quips}.
    lines:function(){var d=cur.data.lines&&Array.isArray(cur.data.lines.sizes)?cur.data.lines:null,code=d?cur.code:"en";d=d||EN.lines||null;
      return d?{code:code,unit:d.unit==="chars"?"chars":"words",sizes:d.sizes,quips:d.quips||{}}:null},
    // A timeline text (id.name / id.line) in the page's language, else the fallback (timeline.json's English).
    timeline:function(id,field,fb){var m=cur.data.timeline,v=m&&m[id+"."+field];return v!=null&&v!==""?v:fb},
    // AIG-1285: the app's dev words in the page's language, else English: {button, h, intro, search, none, close, list:[{id, word, text, also?, noTip?}]}.
    words:function(){var w=cur.data.words&&Array.isArray(cur.data.words.list)&&cur.data.words.list.length?cur.data.words:EN.words;return w||null},
    // f(code) runs now if the page is translated already, and again after every language change.
    on:function(f){listeners.push(f);if(applied)try{f(cur.code)}catch(e){}},
    set:pick
  };

  // Start: a saved pick (if its file is in), else the first device language with a file. The page stays hidden for at most a moment.
  var saved=ls(),codes=saved&&langOf(saved)?[saved]:deviceCodes();
  if(codes[0]!=="en"){root.classList.add("i18n-wait");setTimeout(function(){root.classList.remove("i18n-wait")},2500)}
  whenDom(mount);
  first(codes.slice(),function(c){use(c)});
})();
