// Old Norse in Younger Futhark: public/lang/runes.json from en.json (AIG-1040).
// Each English word is glossed to a simple Old Norse word (table below), then
// transliterated to runes; unknown words are transliterated from their English spelling.
import fs from 'node:fs';
const D = `the=hinn a=einn to=til and=ok it=þat you=þú your=þín on=á this=þetta in=í is=er for=fyrir no=ekki team=lið ai=ai
project=verk or=eða of=af cards=spjǫld card=spjald not=ekki one=einn with=með board=borð back=aptr at=at up=upp what=hvat
only=eins open=opna nothing=ekki yet=enn as=sem new=nýr lead=leiðtogi done=gǫrt every=hverr first=fyrstr an=einn all=allt
projects=verk own=eiginn from=frá do=gera so=svá its=þess when=þá that=þat can=má usage=notkun each=hverr add=auka run=renna
off=af by=hjá waiting=bíðandi time=tími test=reyna folder=mappa are=eru how=hvé server=þjónn teams=lið start=hefja work=verk
use=nota them=þeim they=þeir i=ek day=dagr runs=rennr here=hér out=út show=sýna now=nú never=aldri window=gluggi friend=vinr
change=breyta today=í-dag pick=kjósa code=kóði click=þrýsta once=einu-sinni then=þá read=lesa their=þeira set=setja link=tengsl
comments=ummæli until=unz setup=uppsetning mode=háttr into=inn-í before=áðr my=mín last=síðastr next=næstr any=nǫkkurr app=forrit
file=skjal chat=spjall copy=eftirrit has=hefir help=hjalp more=meira words=orð again=aptr switch=skipta quiet=kyrrt left=eptir
saved=varðveitt line=lína move=færa agent=erindreki type=rita check=gæta mail=bréf over=yfir sent=sent s=s see=sjá ask=spyrja
plan=ráð tokens=teikn hour=stund get=fá working=vinnandi steps=spor reply=svara paste=líma inbox=innhólf key=lykill live=lifa
token=teikn limit=mark used=notat question=spurning empty=tómt another=annarr stop=stǫðva remove=taka small=lítill if=ef
while=meðan night=nótt days=dagar kept=haldit tester=prófari short=skammr life=líf page=blað computer=reiknir wake=vekja
needs=þarf session=fundr save=geyma answer=svar per=á accept=þiggja be=vera like=sem works=vinnr friends=vinir week=vika
make=gera where=hvar these=þessir settings=stillingar still=enn there=þar who=hverr shows=sýnir about=um plain=skírr me=mik
share=skipta phone=sími just=bara dms=skeyti could=mætti comment=ummæli messages=boð running=rennandi look=líta other=annarr
turn=snúa which=hverr tick=hak keeps=heldr checks=gætir always=ávalt terminal=skel was=var backlog=safn starts=hefst
after=eptir agents=erindrekar text=texti full=fullr shared=skipt helpers=hjalparar call=kalla say=segja min=mín optional=valfrjálst
right=rétt tests=prófanir asks=spyrr build=smíða goes=fer picture=mynd list=skrá waits=bíðr discord=sundrung stand=standa
language=tunga have=hafa give=gefa scrum=skrum message=boð enter=ganga files=skjǫl may=má command=skipun raise=hefja hide=fela
status=staða questions=spurningar everything=allt things=hlutir want=vilja rest=hvíld stopped=stǫðvat saver=sparari most=mest
top=toppr quick=skjótr made=gǫrt inside=innan stay=vera model=líkan request=beiðni tour=ferð few=fáir close=loka home=heim
wakes=vekr role=hlutverk path=stígr data=gǫgn minutes=mínútur title=heiti below=niðri found=fundit asked=spurt reading=lesandi
button=hnappr take=taka streamer=streymari stuck=fastr already=þegar idea=hugmynd master=meistari away=burt group=flokkr
hidden=falit else=annat ready=búinn why=hví screen=skjár address=heimilisfang way=leið level=stig stays=verðr rules=lǫg
something=nǫkkut progress=framgangr version=útgáfa watch=vaka itself=sjálft connected=tengt task=verkefni delete=eyða column=dálkr
changes=breytingar connect=tengja sees=sér git=git without=án tasks=verkefni review=skoða step=spor added=aukit invite=bjóða
two=tveir people=menn private=einkar sign=merki crucial=mikilvægt write=rita reads=les uses=notar columns=dálkar row=röð
did=gerði should=skal note=minnisgrein under=undir big=mikill bar=stika shown=sýnt tidy=snyrta dev=smiðr hand=hǫnd many=margir
relay=boðleið password=lykilorð tell=segja much=mikit press=þrýsta through=gegnum same=samr edit=breyta opens=opnar priority=forgangr
whole=allr servers=þjónar browser=vafri roles=hlutverk will=mun looks=lítr sending=senda reset=endr-setja put=setja
were=váru lines=línur keys=lyklar default=forsetning anything=allt pretend=látast fine=gott expert=kunnandi pass=líða
ups=upp hours=stundir answers=svǫr watchman=vǫrðr gets=fær keep=halda does=gerir later=síðar background=bakgrunnr makes=gerir
colour=litr asking=spyrjandi wait=bíða leave=fara ways=leiðir ticked=hakat needed=nauðsyn passed=liðit also=ok join=ganga-í
offer=bjóða secret=leynd admin=stjórnandi numbers=tǫlur undo=aftra swarm=sveimr latest=nýjast going=farandi closed=lokat
feature=eiginleiki sends=sendir project's=verks local=staðbundit names=nǫfn space=rúm but=en taken=tekit down=niðr instead=í-stað
developer=smiðr try=reyna takes=tekr free=frjáls release=útgáfa form=mynd port=gátt shower=sturta wrong=rangt update=nýja
anyway=hvárt-sem times=sinnum answered=svarat bugs=pöddur ideas=hugmyndir example=dæmi started=hafit none=ekkert nudge=ýta
yes=já cancel=hætta error=villa failed=brást loading=hleðsla sorry=fyrirgef please=bið soon=brátt great=mikill good=góðr
bad=illr name=nafn user=notandi search=leita find=finna send=senda open=opinn dark=myrkr light=ljós theme=stef
sound=hljóð sounds=hljóð voice=rǫdd morning=morgunn evening=kveld month=mánaðr year=ár hello=heill hi=heill
welcome=velkominn thanks=þǫkk thank=þakka previous=fyrri forward=fram less=minna some=sumir old=gamall our=várr we=vér
he=hann she=hon him=hánum her=hennar us=oss am=em must=skal had=hafði been=verit being=verandi
than=en because=því-at too=ok very=mjǫk can't=má-ekki don't=gerðu-ekki won't=vill-ekki isn't=er-ekki
doesn't=gerir-ekki didn't=gerði-ekki it's=þat-er you'll=þú-munt you're=þú-ert i'll=ek-mun i'm=ek-em we'll=vér-munum
that's=þat-er there's=þar-er what's=hvat-er let's=látum let=lát those=þeir whom=hverjum whose=hvers between=milli
during=meðan around=um against=gegn often=opt sometimes=stundum tomorrow=á-morgin yesterday=í-gær tonight=í-nótt
three=þrír four=fjórir five=fimm six=sex seven=sjau eight=átta nine=níu ten=tíu second=annarr third=þriði
person=maðr man=maðr woman=kona ai-gile=ai-gile claude=claude`;
const dict = new Map();
for (const p of D.split(/\s+/)) { const i = p.indexOf('='); if (i > 0) dict.set(p.slice(0, i).toLowerCase(), p.slice(i + 1)); }

const M = { a:'ᛅ',á:'ᛅ',æ:'ᛅ',ǫ:'ᚬ',ø:'ᚬ',ö:'ᚬ',e:'ᛁ',é:'ᛁ',i:'ᛁ',í:'ᛁ',j:'ᛁ',o:'ᚬ',ó:'ᚬ',u:'ᚢ',ú:'ᚢ',y:'ᚢ',ý:'ᚢ',v:'ᚢ',w:'ᚢ',
 b:'ᛒ',p:'ᛒ',d:'ᛏ',t:'ᛏ',ð:'ᛏ',g:'ᚴ',k:'ᚴ',q:'ᚴ',c:'ᚴ',h:'ᚼ',f:'ᚠ',l:'ᛚ',m:'ᛘ',n:'ᚾ',r:'ᚱ',s:'ᛋ',z:'ᛋ',þ:'ᚦ',x:'ᚴᛋ' };
function rune(w) {
  w = w.toLowerCase().replace(/'/g, '').replace(/th/g, 'þ').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's')
    .replace(/ee|ea/g, 'i').replace(/oo/g, 'u').replace(/sh/g, 's').replace(/ch/g, 'k');
  let o = '', prev = '';
  const cs = [...w];
  cs.forEach((c, i) => {
    let r = M[c]; if (!r) return;
    if (c === 'r' && i === cs.length - 1 && cs.length > 2) r = 'ᛦ';
    if (r === prev && r !== 'ᛦ') return; // collapse doubles
    o += r; prev = r;
  });
  return o;
}
function word(w) {
  const g = dict.get(w.toLowerCase());
  return (g ?? w).split('-').map(rune).join('᛫');
}
const KEEP = /(\{\{dev:[^}]*\}\}|\{[^}]*\}|`[^`]*`|<[^>]*>|https?:\/\/\S+|\b[A-Z]{2,5}-\d+\b|\*\*|AI-gile|Claude|Opus|Sonnet|Haiku|GitHub|Git|VS Code|Discord|Giphy|Windows|Electron|npm|Node|[^\x00-⯿]\S*)/gu;
export function tr(s) {
  return s.split(KEEP).map((p, i) => {
    if (i % 2 === 1) return p;
    return p.replace(/[A-Za-z]+(?:'[a-z]+)?|\s+/g, m => /^\s+$/.test(m) ? '᛫' : word(m));
  }).join('');
}
function main() {
  const en = JSON.parse(fs.readFileSync('public/lang/en.json', 'utf8'));
  const out = {};
  for (const [k, v] of Object.entries(en)) {
    if (typeof v === 'string') out[k] = tr(v);
    else { out[k] = {}; for (const [f, x] of Object.entries(v)) out[k][f] = tr(x); }
  }
  fs.writeFileSync('public/lang/runes.json', JSON.stringify(out, null, 2) + '\n');
  console.log(Object.keys(out).length);
}
if (process.argv[1] && process.argv[1].endsWith('runes.mjs')) main();
