/**
 * Udayan's own booking assistant: no outside AI service. It understands a request such as
 * "book <film> at 10pm today in Serampore", "কাল সন্ধ্যায় দুটো টিকিট" or "kal sham 7 baje 2 ticket chahiye"
 * (typed or spoken; English, Bengali or Hindi, in any script; see ./lang.ts), keeps the conversation's details, asks
 * for whatever is missing, and answers in the customer's language with the exact shows and their District seat links.
 * Its vocabulary (films, cinemas, towns) is rebuilt from the live synced showtimes on every question, so it is always
 * as current as the last sync.
 */
import type {AssistantData} from './data';
import type {Movie,Screening,Venue} from './data';
const CITY_BN:Record<string,string>={Sheoraphuli:'শেওড়াফুলি',Tarakeswar:'তারকেশ্বর'};
import {districtAppLink} from '../district-link';

import {distanceKm} from '../cinema-location';
import {type Lang,CITY_HI,cityHi,detectLang,latin,lev,skeleton,translit,understand,words} from './lang';

export type {Lang};
export type AgentState={film?:string;cinemaId?:string;town?:string;day?:string;times?:number[];part?:Part;count?:number;after?:number;before?:number;asked?:'film'|'cinema'|'day'|null};
export type Hints={cinemaId?:string;lat?:number;lng?:number;lang?:Lang};
export type ShowCard={title:string;poster?:string;cinemaId:string;cinema:string;city:string;start:string;day:string;time:string;screen?:string;format?:string;price?:number;url:string;appUrl?:string;detail:string;exact?:boolean;lang?:Lang};
export type Chip={label:string;send:string};
export type AgentReply={reply:string;shows:ShowCard[];chips:Chip[];links:{label:string;href:string}[];state:AgentState;handled:boolean;askLocation?:boolean;lang?:Lang;score?:number};
type Part='morning'|'afternoon'|'evening'|'night';

const COMMON=new Set('open world time life home big little good bad one two the a an of and part chapter return returns story new last first love man men night day city mall centre center cinema cinemas udayan show house market complex plaza multiplex square point star movie film'.split(' '));
// Everyday Hindi and Bengali words (as spoken or typed in Latin letters): on their own they never identify a film,
// so "मेरे पास क्या चल रहा है" is not the film "Main Na Raha Mera".
for(const w of 'mere mera meri mujhe main mai mein men hai hain hei raha rahi rahe rha rhi chal chala kya kyaa kaun koi aaj kal sab abhi wala wali waale kar karo karna hum tum aap apna apni yeh woh nahi nahin hoga hogi amar ami tumi apni ache achhe ache cholche chalche kothay kache kachhe jabo dekhbo dekhte chai lagbe tikit tikat ticket shaam sham raat subah sokal sondhe bikel dupur kalke ajke aajke baje bajhe ekta duto'.split(' '))COMMON.add(w);

/* ---------------- time ---------------- */
const IST='Asia/Kolkata';
const istKey=(d:string|number)=>new Date(d).toLocaleDateString('en-CA',{timeZone:IST});
const istMinutes=(d:string)=>{const p=new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:IST}).split(':');return +p[0]*60+ +p[1]};
const fmtTime=(d:string|number)=>new Date(d).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:IST}).replace(/\s?(am|pm)$/i,m=>' '+m.trim().toUpperCase());
const fmtMin=(m:number)=>{const h=Math.floor(m/60)%24,mm=m%60;return `${h%12||12}:${String(mm).padStart(2,'0')} ${h<12?'AM':'PM'}`};
const addDays=(key:string,n:number)=>{const d=new Date(key+'T12:00:00+05:30');d.setUTCDate(d.getUTCDate()+n);return istKey(d.getTime())};
const WD_EN=['sun','mon','tue','wed','thu','fri','sat'],WD_BN=['রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র','শনি'],WD_HI=['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'];
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MON_BN=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'],MON_HI=['जनवरी','फ़रवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'];
/** "7:20 PM" → "সন্ধ্যা 7:20" / "शाम 7:20": how Bengali and Hindi speakers say a time. English is left as it is. */
function localTimes(text:string,lang:Lang){if(lang==='en')return text;
 return text.replace(/(\d{1,2}):(\d{2})\s?(AM|PM)/g,(_m,h:string,mm:string,ap:string)=>{const h24=(+h%12)+(ap==='PM'?12:0);
  const part=lang==='bn'?(h24>=4&&h24<12?'সকাল':h24<16&&h24>=12?'দুপুর':h24<18&&h24>=16?'বিকেল':h24<20&&h24>=18?'সন্ধ্যা':'রাত'):(h24>=4&&h24<12?'सुबह':h24<16&&h24>=12?'दोपहर':h24<20&&h24>=16?'शाम':'रात');
  return `${part} ${h}:${mm}`})}
function dayLabel(key:string,today:string,lang:Lang){
 if(key===today)return L(lang,'Today','আজ','आज');if(key===addDays(today,1))return L(lang,'Tomorrow','আগামীকাল','कल');
 const d=new Date(key+'T12:00:00+05:30');const w=d.getUTCDay(),m=d.getUTCMonth();
 return lang==='en'?`${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][w]} ${d.getUTCDate()} ${MON[m]}`:`${L(lang,'',WD_BN[w],WD_HI[w])}, ${d.getUTCDate()} ${L(lang,'',MON_BN[m],MON_HI[m])}`;
}
const PARTS:Record<Part,[number,number]>={morning:[5*60,12*60],afternoon:[12*60,16*60+30],evening:[16*60,20*60],night:[19*60+30,27*60]};
const PART_NAME:Record<Lang,Record<Part,string>>={en:{morning:'morning',afternoon:'afternoon',evening:'evening',night:'night'},bn:{morning:'সকাল',afternoon:'দুপুর',evening:'সন্ধ্যা',night:'রাত'},hi:{morning:'सुबह',afternoon:'दोपहर',evening:'शाम',night:'रात'}};
const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const keyOf=(y:number,m:number,d:number)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
/** A day-of-month with no month ("the 22nd"): this month, or next month once it has passed. */
function nextDate(today:string,dd:number,mon?:number){const y=+today.slice(0,4),m=mon??+today.slice(5,7);if(dd<1||dd>31||m<1||m>12)return;let key=keyOf(y,m,dd);if(key<today)key=mon?keyOf(y+1,m,dd):(m===12?keyOf(y+1,1,dd):keyOf(y,m+1,dd));return key}

/** Day the customer means, as an IST date key. `t` is the understood (plain English) text. */
function parseDay(t:string,today:string):{day?:string;part?:Part}{
 const has=(re:RegExp)=>re.test(t);
 if(has(/\bdayaftertomorrow\b/))return {day:addDays(today,2)};
 const inN=t.match(/\b(?:in|after)\s+(\d{1,2})\s+days?\b/)||t.match(/\b(\d{1,2})\s*days?\s*(?:later|from now)\b/);if(inN&&+inN[1]<=30)return {day:addDays(today,+inN[1])};
 if(has(/\btonight\b/))return {day:today,part:'night'};
 if(has(/\btomorrow\b/))return {day:addDays(today,1)};
 if(has(/\b(today|now|right now)\b/))return {day:today};
 if(has(/\bweekend\b/)){const w=new Date(today+'T12:00:00+05:30').getUTCDay();return {day:w===0||w===6?today:addDays(today,6-w)}}
 const m=t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/)||t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
 if(m){const dd=+(isNaN(+m[1])?m[2]:m[1]),mon=MONTHS.indexOf((isNaN(+m[1])?m[1]:m[2]).slice(0,3))+1;const k=nextDate(today,dd,mon);if(k)return {day:k}}
 const dm=t.match(/\b(\d{1,2})[/-](\d{1,2})\b/);if(dm){const k=nextDate(today,+dm[1],+dm[2]);if(k)return {day:k}}
 const th=t.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);if(th){const k=nextDate(today,+th[1]);if(k)return {day:k}}
 const wd=t.match(/\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(day|nesday|sday|urday|rsday)?\b/);
 if(wd){const idx=WD_EN.indexOf(wd[1].slice(0,3));for(let i=0;i<7;i++){const k=addDays(today,i);if(new Date(k+'T12:00:00+05:30').getUTCDay()===idx)return {day:k}}}
 return {};
}
/** Part of the day the customer means. */
function parsePart(t:string):Part|undefined{
 if(/\b(night|late|raat|rat|raate)\b/.test(t))return 'night';
 if(/\bevening\b/.test(t))return 'evening';
 if(/\b(afternoon|noon)\b/.test(t))return 'afternoon';
 if(/\bmorning\b/.test(t))return 'morning';
}
/** Clock time(s) in minutes after midnight; an unqualified "10" can mean 10 AM or 10 PM, so both are kept. */
function parseTimes(t:string,part?:Part):number[]|undefined{
 if(/\bmidnight\b/.test(t))return [24*60];
 if(/\bnoon\b/.test(t)&&!/after\s*noon/.test(t))return [12*60];
 const re=/(?:^|[^\d])(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|oclock)?(?=$|[^\d])/g;let m;const out:number[]=[];
 while((m=re.exec(t))){const h=+m[1],mm=m[2]?+m[2]:0,suf=(m[3]||'').replace(/\./g,'');const before=t.slice(Math.max(0,m.index-8),m.index+1);
  if(h>23||mm>59)continue;
  const after=t.slice(re.lastIndex,re.lastIndex+10);
  if(!suf&&!m[2]&&!/\b(at|by|around|from|after|for the)\s*$/.test(before)&&!part)continue; // bare numbers ("2 tickets", "20 nov") are not times
  if(!suf&&!m[2]&&/^\s*(tickets?|seats?|people|persons|st|nd|rd|th|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(after))continue;
  if(/am/.test(suf))out.push((h%12)*60+mm);
  else if(/pm/.test(suf))out.push((h%12+12)*60+mm);
  else if(h>=13)out.push(h*60+mm);
  else if(part==='morning')out.push((h%12)*60+mm);
  else if(part==='afternoon'||part==='evening'||part==='night')out.push((h%12+12)*60+mm);
  else if(h===12)out.push(12*60+mm);
  else if(h<=8)out.push((h+12)*60+mm);
  else out.push(h*60+mm,(h+12)*60+mm);
 }
 return out.length?[...new Set(out)]:undefined;
}
const parseCount=(t:string)=>{const m=t.match(/\b(\d{1,2})\s*(tickets?|seats?|people|persons)\b/)||t.match(/\bfor (\d{1,2})\b(?!\s*(?:am|pm|oclock|:))/);if(!m)return undefined;const n=+m[1];return n>0&&n<=20?n:undefined};

/* ---------------- vocabulary from live data ---------------- */
const ALIASES:Record<string,string[]>={sheorafuli:['Sheoraphuli'],seoraphuli:['Sheoraphuli'],tarkeshwar:['Tarakeswar'],tarakeshwar:['Tarakeswar'],hooghly:['Sheoraphuli','Tarakeswar']};
const norm=(s:string)=>latin(s).replace(/\s+/g,' ');
type Vocab={films:Movie[];upcoming:Movie[];venues:Venue[];cities:string[]};

function findFilm(text:string,list:Movie[]):Movie|undefined{
 const q=words(text),qs=q.map(skeleton),lt=' '+latin(translit(text))+' ';let best:{m:Movie;s:number}|undefined;
 const distinct=new Map<string,number>();for(const m of list)for(const w of new Set(norm(m.title).split(' ')))distinct.set(w,(distinct.get(w)||0)+1);
 for(const m of list){const title=norm(m.title);if(!title)continue;let s=0;
  if(lt.includes(' '+title+' '))s=3;
  else{const tw=title.split(' ').filter(w=>w.length>=3&&!COMMON.has(w));if(!tw.length)continue;
   const hit=tw.filter(w=>{const sk=skeleton(w);return q.some((x,i)=>x===w||(w.length>=5&&lev(x,w)<=(w.length>=8?2:1))||(sk.length>=3&&(qs[i]===sk||(sk.length>=5&&lev(qs[i],sk)<=1))))});
   s=hit.length/tw.length;if(hit.length===1&&tw.length>1&&hit[0].length<5)s*=.5;
   // whole-title sound match across the words the customer said ("sadhak bamakhapa", "রামায়ণ", "रामायण")
   const whole=skeleton(m.title);if(whole.length>=4)for(let i=0;i<q.length;i++)for(let n=1;n<=Math.min(4,q.length-i);n++){const sk=qs.slice(i,i+n).join('');if(sk&&lev(sk,whole)<=Math.max(1,Math.floor(whole.length/6)))s=Math.max(s,.95)}}
  if(s<.8){const tw=title.split(' ').filter(w=>w.length>=4&&!COMMON.has(w));
   if(tw.some(w=>(distinct.get(w)||0)===1&&q.some((x,i)=>x===w||(w.length>=6&&lev(x,w)<=1)||(w.length>=6&&skeleton(w).length>=3&&qs[i]===skeleton(w)))))s=Math.max(s,.8)}
  if(s>=.6&&(!best||s>best.s))best={m,s}}
 return best?.m;
}
function findPlaces(text:string,t:string,v:Vocab){
 const plain=text.normalize('NFC'),lt=' '+latin(translit(text))+' ',w1=words(text);
 // Speech often splits a name in two ("naren drapur"), so neighbouring words are also tried joined.
 const q=[...w1,...w1.slice(1).map((x,i)=>w1[i]+x)],qs=q.map(skeleton);const towns=new Set<string>();
 const soundsLike=(x:string,sk:string)=>x===sk||(sk.length>=5&&lev(x,sk)<=1&&(x.length===sk.length||sk.length>=6&&x.length>=sk.length));
 for(const c of v.cities){const lc=norm(c),bn=CITY_BN[c]?.normalize('NFC'),sk=skeleton(c);
  if(lt.includes(' '+lc+' ')||(bn&&plain.includes(bn))||(CITY_HI[c]||[]).some(h=>plain.includes(h.normalize('NFC')))||(sk.length>=4&&qs.some(x=>soundsLike(x,sk)))||(lc.length>=6&&!lc.includes(' ')&&w1.some(x=>x.length>=5&&lev(x,lc)<=1)))towns.add(c)}
 for(const [alias,targets] of Object.entries(ALIASES)){const sk=skeleton(alias);
  if(lt.includes(' '+alias+' ')||(alias==='cooch'&&lt.includes(' cooch behar '))||(sk.length>=4&&qs.some(x=>x===sk))||(alias==='kolkata'&&/কলকাতা|कोलकाता|कलकत्ता/.test(plain)))targets.forEach(x=>v.cities.includes(x)&&towns.add(x))}
 const venues=v.venues.filter(x=>{const n=norm(x.shortName.replace(/\s*:.*$/,''));if(n.length>3&&lt.includes(' '+n+' '))return true;const sig=n.split(' ').filter(w=>w.length>=4&&!COMMON.has(w));return sig.length>0&&sig.every(w=>q.some((y,i)=>y===w||(w.length>=6&&lev(y,w)<=1)||(w.length>=5&&qs[i]===skeleton(w))))});
 // "Where's the cinema?" with no town named also means "near me".
 const near=/\b(near me|nearby|nearest|closest|near by|around me)\b/.test(t)||(/\bwhere\b/.test(t)&&/\bcinemas?\b/.test(t)&&!towns.size&&!/\bin\b/.test(t));
 return {towns:[...towns],venues,near};
}
/** Removes a film's title from the message, so a title such as "Raat Akeli Hai" or "18 November" isn't read as a time or a date. */
function withoutTitle(text:string,title:string){const ws=latin(title).split(' ').filter(Boolean);if(!ws.length)return text;
 const re=new RegExp(ws.map(w=>MONTHS.includes(w.slice(0,3))&&/^[a-z]+$/.test(w)?w.slice(0,3)+'[a-z]*':w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[^a-z0-9]*'),'i');return text.replace(re,' ')}

/* ---------------- replies ---------------- */
const L=(lang:Lang,en:string,bn:string,hi:string)=>lang==='bn'?bn:lang==='hi'?hi:en;
const nameOf=(v:Venue)=>v.shortName;
const same=(a:string,b:string)=>norm(a)===norm(b)||skeleton(a)===skeleton(b);
const join=(items:string[],and:string)=>items.length<=1?items.join(''):items.slice(0,-1).join(', ')+and+items[items.length-1];
const listOf=(lang:Lang,items:string[])=>join(items,L(lang,' and ',' ও ',' और '));
/** Bengali "in": দুর্গাপুর → দুর্গাপুরে, হাওড়া → হাওড়ায়, হুগলি → হুগলিতে, দার্জিলিং → দার্জিলিংয়ে. Latin names keep "-এ". */
const bnIn=(w:string)=>{if(!/[\u0980-\u09ff]$/.test(w))return w+'-এ';const last=w.slice(-1);
 return last==='া'?w+'য়':/[িীুূেৈোৌ]/.test(last)?w+'তে':last==='ং'?w+'য়ে':w+'ে'};
const townIn=(c:string,lang:Lang)=>lang==='bn'?CITY_BN[c]||c:lang==='hi'?cityHi(c):c;
/** "today", "tomorrow" or "on Sun 22 Nov", for the middle of an English sentence. */
const onDayEn=(key:string,today:string)=>key===today?'today':key===addDays(today,1)?'tomorrow':`on ${dayLabel(key,today,'en')}`;
const inPart=(start:string,part:Part)=>{const [a,b]=PARTS[part];let m=istMinutes(start);if(m<5*60)m+=24*60;return m>=a&&m<b};
type Tagged=Screening&{v:Venue};
/** Minutes after midnight, with after-midnight shows counted as the same night (1 AM = 25:00). */
const minsOf=(start:string)=>{let m=istMinutes(start);if(m<5*60)m+=24*60;return m};
const inBounds=(start:string,st:AgentState)=>{const m=minsOf(start);return (st.after===undefined||m>=st.after)&&(st.before===undefined||m<=st.before)};
/** "after 6 pm" / "before 9": a time bound in minutes (an unclear "after 10" is the morning one, "before 9" the evening one). */
function parseBound(t:string,word:'after'|'before',part?:Part){
 const m=t.match(new RegExp(`(\\d{1,2}(?::\\d{2})?)\\s*(am|pm|oclock)?\\s*${word}\\b`))||t.match(new RegExp(`\\b${word}\\s*(\\d{1,2}(?::\\d{2})?)\\s*(am|pm|oclock)?`));
 if(!m)return undefined;const v=parseTimes(`at ${m[1]} ${m[2]||''}`,part);if(!v)return undefined;return word==='after'?Math.min(...v):Math.max(...v);
}
const tagged=(venues:Venue[],data:AssistantData,now:number):Tagged[]=>venues.flatMap(v=>(data.shows.get(v.id)||[]).filter(e=>Date.parse(e.start)>now).map(e=>({...e,v}))).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));

/* ---------------- what is playing: filters a customer can ask for ---------------- */
const LANGS:[string,string,string,RegExp][]=[['Bengali','বাংলা','बांग्ला',/\b(bengali|bangla|bengla)\b|বাংলা/],['Hindi','হিন্দি','हिंदी',/\bhindi\b/],['English','ইংরেজি','अंग्रेज़ी',/\benglish\b/],['Tamil','তামিল','तमिल',/\btamil\b/],['Telugu','তেলুগু','तेलुगु',/\btelugu\b/],['Malayalam','মালয়ালম','मलयालम',/\bmalayalam\b/],['Kannada','কন্নড়','कन्नड़',/\bkannada\b/],['Marathi','মারাঠি','मराठी',/\bmarathi\b/],['Punjabi','পাঞ্জাবি','पंजाबी',/\bpunjabi\b/],['Odia','ওড়িয়া','ओड़िया',/\b(odia|oriya)\b/],['Assamese','অসমিয়া','असमिया',/\bassamese\b/],['Bhojpuri','ভোজপুরি','भोजपुरी',/\bbhojpuri\b/]];
const GENRES:Record<string,string>={comedy:'comedy',comedies:'comedy',funny:'comedy',comic:'comedy',horror:'horror',scary:'horror',ghost:'horror',bhoot:'horror',bhuter:'horror',romance:'romance',romantic:'romance',action:'action',thriller:'thriller',thrillers:'thriller',suspense:'thriller',mystery:'mystery',detective:'mystery',goenda:'mystery',animation:'animation',animated:'animation',cartoon:'animation',mythological:'mytholog',mythology:'mytholog',devotional:'mytholog',drama:'drama',crime:'crime',biopic:'biograph',biography:'biograph',historical:'histor',history:'histor',fantasy:'fantasy',scifi:'sci',adventure:'adventure',musical:'music',sports:'sport',sport:'sport'};
const GENRE_NAME:Record<string,[string,string,string]>={comedy:['comedy','কমেডি','कॉमेडी'],horror:['horror','ভূতের','हॉरर'],romance:['romantic','প্রেমের','रोमांटिक'],action:['action','অ্যাকশন','एक्शन'],thriller:['thriller','থ্রিলার','थ्रिलर'],mystery:['mystery','রহস্য','रहस्य'],animation:['animated','অ্যানিমেশন','एनीमेशन'],mytholog:['mythological','পৌরাণিক','पौराणिक'],drama:['drama','নাটক','ड्रामा'],crime:['crime','ক্রাইম','क्राइम'],biograph:['biopic','জীবনী','बायोपिक'],histor:['historical','ঐতিহাসিক','ऐतिहासिक'],fantasy:['fantasy','ফ্যান্টাসি','फ़ैंटेसी'],sci:['sci-fi','কল্পবিজ্ঞান','साइंस-फ़िक्शन'],adventure:['adventure','অ্যাডভেঞ্চার','एडवेंचर'],music:['musical','গানের','म्यूज़िकल'],sport:['sports','খেলার','स्पोर्ट्स']};
/** "Bengali, Hindi" → "বাংলা, হিন্দি" / "बांग्ला, हिंदी". */
const langNames=(names:string|undefined,lang:Lang)=>!names||lang==='en'?names:names.split(/\s*,\s*/).map(n=>{const x=LANGS.find(l=>l[0].toLowerCase()===n.toLowerCase());return x?(lang==='bn'?x[1]:x[2]):n}).join(', ');
type Filters={language?:[string,string,string];format?:string;family:boolean;genre?:string;fresh:boolean;soon:boolean;cheapest:boolean};
function filtersOf(t:string):Filters{
 const lang=LANGS.find(([,,,re])=>re.test(t));
 let genre:string|undefined;for(const w of t.split(' '))if(GENRES[w]){genre=GENRES[w];break}
 return {language:lang?[lang[0],lang[1],lang[2]]:undefined,format:t.match(/\b(3d|2d|imax|4dx)\b/)?.[1]?.toUpperCase(),family:/\b(family|kids?|children|child|bachcha|baccha)\b/.test(t),genre,fresh:/\b(new|newest|latest|recent|recently|just released|fresh)\b/.test(t),
  // "next show", "right now", "অভী/এখন": starting within the next 3 hours
  soon:/\b(next show|right now|starting soon)\b/.test(t)||(/\bnow\b/.test(t)&&!/\b(now (showing|playing|running)|(showing|playing|running) now)\b/.test(t)),
  cheapest:/\bcheapest\b/.test(t)};
}
const hasFilter=(f:Filters)=>!!(f.language||f.format||f.family||f.genre||f.fresh||f.soon||f.cheapest);

/** Films with upcoming shows across Udayan, most shows first. */
function playingNow(data:AssistantData,now:number){
 const m=new Map<string,{title:string;shows:number;venues:Set<string>}>();
 for(const v of data.venues)for(const e of data.shows.get(v.id)||[]){if(Date.parse(e.start)<=now)continue;const k=norm(e.title);const g=m.get(k)||{title:e.title,shows:0,venues:new Set<string>()};g.shows++;g.venues.add(v.id);m.set(k,g)}
 return [...m.values()].sort((a,b)=>b.venues.size-a.venues.size||b.shows-a.shows);
}
/** The town where a film has the most shows. */
function townFor(title:string,data:AssistantData,now:number){const n=new Map<string,number>();for(const v of data.venues){const c=(data.shows.get(v.id)||[]).filter(e=>Date.parse(e.start)>now&&same(e.title,title)).length;if(c)n.set(v.city,(n.get(v.city)||0)+c)}return [...n].sort((a,b)=>b[1]-a[1])[0]?.[0]||data.venues[0]?.city||'Kolkata'}

/** Starter suggestions for the chat window: universal questions (no film named), with the live film count. */
export function starters(data:AssistantData,now=Date.now()){
 return {films:playingNow(data,now).map(f=>f.title),example:null,
  en:['What’s playing today?','Shows near me tonight','New releases this week','What’s coming soon?','Where can I park?'],
  bn:['আজ কী চলছে?','আজ রাতে আমার কাছে কী শো আছে?','এই সপ্তাহে নতুন ছবি','শীঘ্রই কী আসছে?','পার্কিং আছে?'],
  hi:['आज क्या चल रहा है?','आज रात मेरे पास कौन-से शो हैं?','इस हफ़्ते की नई फ़िल्में','जल्द कौन-सी फ़िल्में आ रही हैं?','पार्किंग है?']};
}
/** Greeting and "what can you do": what the assistant does, with universal examples (no film singled out). */
export function helpReply(data:AssistantData,lang:Lang,now=Date.now(),lead?:string):AgentReply{
 const films=playingNow(data,now);const n=data.venues.length,k=films.length;
 const reply=L(lang,
  `${lead??'Hi! I’m Udayan’s booking assistant.'} I can find any show at our ${n} cinemas and take you straight to the seat map. I understand English, বাংলা and हिंदी.${k?` ${k} films are playing right now.`:''}\n\nTell me a film, a town, a day or a time — for example “tomorrow evening shows near me” or “what’s on this weekend in my town”.`,
  `${lead??'নমস্কার! আমি Udayan-এর বুকিং সহকারী।'} আমাদের ${n}টি হলের যেকোনও শো খুঁজে সরাসরি সিট বাছার পাতায় নিয়ে যেতে পারি। বাংলা, English বা हिंदी — যেকোনও ভাষায় বলুন।${k?` এখন ${k}টি ছবি চলছে।`:''}\n\nছবি, শহর, দিন বা সময় বলুন — যেমন “কাল সন্ধ্যায় আমার কাছে কী শো আছে” বা “এই সপ্তাহে নতুন ছবি”।`,
  `${lead??'नमस्ते! मैं Udayan का बुकिंग सहायक हूँ।'} हमारे ${n} सिनेमाघरों में कोई भी शो ढूँढकर सीधे सीट चुनने वाले पेज पर ले जा सकता हूँ। हिंदी, বাংলা या English — किसी भी भाषा में बोलिए।${k?` अभी ${k} फ़िल्में चल रही हैं।`:''}\n\nफ़िल्म, शहर, दिन या समय बताइए — जैसे “कल शाम मेरे पास कौन-से शो हैं” या “इस हफ़्ते की नई फ़िल्में”।`);
 const chip=(en:string,bn:string,hi:string)=>({label:L(lang,en,bn,hi),send:L(lang,en,bn,hi)});
 return {reply,shows:[],chips:[chip('What’s playing today?','আজ কী চলছে?','आज क्या चल रहा है?'),chip('Shows near me','আমার কাছে কী চলছে?','मेरे पास क्या चल रहा है?'),chip('New releases','নতুন ছবি','नई फ़िल्में'),chip('What’s coming soon?','শীঘ্রই কী আসছে?','जल्द कौन-सी फ़िल्में आ रही हैं?')],links:[],state:{},handled:true,lang};
}

/** "What's playing": every film in the scope (a cinema, towns, near the visitor or all of Udayan), filtered as asked. */
function browse(o:{scope:Venue[];single?:Venue;where:[string,string,string];state:AgentState;data:AssistantData;vocab:Vocab;f:Filters;lang:Lang;now:number;today:string;wide:boolean;late?:boolean}):AgentReply{
 const {scope,single,state,f,lang,now,today,vocab}=o;const where=L(lang,...o.where);
 const metaOf=(title:string)=>vocab.films.find(m=>same(m.title,title));
 let shows=tagged(scope,o.data,now);
 if(state.day)shows=shows.filter(e=>istKey(e.start)===state.day);
 if(state.part)shows=shows.filter(e=>inPart(e.start,state.part!));
 if(state.after!==undefined||state.before!==undefined)shows=shows.filter(e=>inBounds(e.start,state));
 if(f.soon){const soon=shows.filter(e=>Date.parse(e.start)-now<=3*3600e3);shows=soon}
 if(f.format)shows=shows.filter(e=>(e.format||'').toUpperCase().includes(f.format!));
 if(f.language){const want=f.language[0].toLowerCase();shows=shows.filter(e=>(e.language||metaOf(e.title)?.language||'').toLowerCase().includes(want))}
 const groups=new Map<string,{title:string;meta?:Movie;shows:Tagged[]}>();
 for(const e of shows){const k=norm(e.title);const g=groups.get(k)||{title:e.title,meta:metaOf(e.title),shows:[]};g.shows.push(e);groups.set(k,g)}
 let films=[...groups.values()];
 if(f.genre)films=films.filter(g=>(g.meta?.genres||[]).some(x=>x.toLowerCase().includes(f.genre!)));
 if(f.family)films=films.filter(g=>{const c=(g.meta?.censor||'').toUpperCase().replace(/\s/g,'');return ['U','UA','UA7+'].includes(c)||(g.meta?.genres||[]).some(x=>/family|animation/i.test(x))});
 if(f.fresh){const since=addDays(today,-21);const recent=films.filter(g=>{const r=g.meta?.releaseDate||'';return r>=since&&r<=today});/* released in the last 3 weeks; advance bookings are "coming soon", not new */films=recent;films.sort((a,b)=>(b.meta?.releaseDate||'').localeCompare(a.meta?.releaseDate||'')||b.shows.length-a.shows.length)}
 else films.sort((a,b)=>new Set(b.shows.map(e=>e.v.id)).size-new Set(a.shows.map(e=>e.v.id)).size||b.shows.length-a.shows.length);
 const low=(x:{shows:Tagged[]})=>Math.min(...x.shows.map(e=>e.price??1e9));
 if(f.cheapest)films.sort((a,b)=>low(a)-low(b));
 const tomorrow=addDays(today,1);const pn=state.part?PART_NAME[lang][state.part]:'';
 const when=lang==='en'?(!state.day?(state.part?`this ${state.part}`:'now'):state.day===today?(state.part==='night'?'tonight':state.part?`this ${state.part}`:'today'):(state.day===tomorrow?'tomorrow':`on ${dayLabel(state.day,today,'en')}`)+(state.part?` ${state.part}`:''))
  :(!state.day?(pn?`${L(lang,'','আজ','आज')} ${pn}`:L(lang,'','এখন','अभी')):`${dayLabel(state.day,today,lang)}${pn?' '+pn:''}`);
 const g=f.genre?GENRE_NAME[f.genre]:undefined;
 const kind=[f.fresh?L(lang,'new','নতুন','नई'):'',f.family?L(lang,'family-friendly','পরিবারের সঙ্গে দেখার মতো','परिवार के साथ देखने लायक'):'',f.language?L(lang,f.language[0],f.language[1],f.language[2]):'',g?L(lang,...g):'',f.format||''].filter(Boolean).join(' ');
 const facts=(x:{meta?:Movie;shows:Tagged[]})=>[langNames(x.meta?.language||x.shows[0].language,lang),x.meta?.censor].filter(Boolean).join(' · ');
 const ask=(en:string,bn:string,hi:string)=>({send:L(lang,en,bn,hi)});
 const relaxed:Chip[]=[...(hasFilter(f)?[{label:L(lang,'All films','সব ছবি','सभी फ़िल्में'),...ask('what is playing','কী চলছে','क्या चल रहा है')}]:[]),...(state.day!==today?[{label:L(lang,'Today','আজ','आज'),...ask('what is playing today','আজ কী চলছে','आज क्या चल रहा है')}]:[]),...(state.day!==tomorrow?[{label:L(lang,'Tomorrow','আগামীকাল','कल'),...ask('what is playing tomorrow','আগামীকাল কী চলছে','कल क्या चल रहा है')}]:[]),...(o.wide?[]:[{label:L(lang,'All Udayan cinemas','সব Udayan হল','सभी Udayan हॉल'),...ask('what is playing at all cinemas','সব হলে কী চলছে','सभी हॉल में क्या चल रहा है')}])];
 const nextState:AgentState={...state,film:undefined,times:undefined,asked:'film'};
 // Late in the day today's shows are over: say so and show tomorrow instead of a dead end.
 if(!films.length&&state.day===today&&!o.late){const next=browse({...o,state:{...state,day:tomorrow},late:true});
  if(next.chips.length&&!/couldn’t find|পেলাম না|नहीं मिली/.test(next.reply))return {...next,reply:L(lang,'Today’s shows are over. ','আজকের শো শেষ হয়ে গেছে। ','आज के शो खत्म हो चुके हैं। ')+next.reply}}
 if(!films.length)return {reply:L(lang,`I couldn’t find any ${kind?kind+' ':''}films playing ${when} ${where}. New shows appear as soon as cinemas publish them.`,`${when} ${where} কোনও ${kind?kind+' ':''}ছবি পেলাম না। হল শো প্রকাশ করলেই এখানে দেখা যাবে।`,`${when} ${where} कोई ${kind?kind+' ':''}फ़िल्म नहीं मिली। सिनेमाघर शो जारी करते ही यहाँ दिखेंगे।`),shows:[],chips:relaxed,links:[{label:L(lang,'All movies','সব ছবি','सभी फ़िल्में'),href:'/movies'}],state:nextState,handled:true,lang};
 const lines=films.slice(0,8).map(x=>{const fx=facts(x);
  if(single){const first=istKey(x.shows[0].start);const day=x.shows.filter(e=>istKey(e.start)===first);const times=day.slice(0,5).map(e=>fmtTime(e.start)).join(', ');const more=day.length>5?L(lang,` +${day.length-5} more`,` +আরও ${day.length-5}টি`,` +${day.length-5} और`):'';
   return `• ${x.title}${fx?` (${fx})`:''} — ${state.day?'':dayLabel(first,today,lang)+': '}${times}${more}`}
  const cinemas=new Set(x.shows.map(e=>e.v.id)).size;const prices=x.shows.map(e=>e.price).filter((p):p is number=>typeof p==='number');const next=x.shows[0];const nd=istKey(next.start)!==today?dayLabel(istKey(next.start),today,lang)+' ':'';
  const nextTxt=scope.length<=6?L(lang,`; next ${fmtTime(next.start)}${istKey(next.start)!==today?` ${onDayEn(istKey(next.start),today).replace(/^on /,'')}`:''} at ${nameOf(next.v)}`,`; পরের শো ${nd}${fmtTime(next.start)}, ${nameOf(next.v)}`,`; अगला शो ${nd}${fmtTime(next.start)}, ${nameOf(next.v)}`):'';
  const from=prices.length?Math.min(...prices):0;
  return L(lang,`• ${x.title}${fx?` (${fx})`:''} — ${x.shows.length} ${x.shows.length===1?'show':'shows'} at ${cinemas} ${cinemas===1?'cinema':'cinemas'}${from?`, from ₹${from}`:''}${nextTxt}`,`• ${x.title}${fx?` (${fx})`:''} — ${cinemas}টি হলে ${x.shows.length}টি শো${from?`, ₹${from} থেকে`:''}${nextTxt}`,`• ${x.title}${fx?` (${fx})`:''} — ${cinemas} हॉल में ${x.shows.length} शो${from?`, ₹${from} से`:''}${nextTxt}`)});
 const more=films.length>8?L(lang,`\n…and ${films.length-8} more on the Movies page.`,`\n…আরও ${films.length-8}টি ছবি Movies পাতায়।`,`\n…और ${films.length-8} फ़िल्में Movies पेज पर।`):'';
 const n=films.length;
 const head=L(lang,`${n} ${kind?kind+' ':''}${n===1?'film':'films'} playing ${when} ${where}:`,`${when} ${where} ${n}টি ${kind?kind+' ':''}ছবি চলছে:`,`${when} ${where} ${n} ${kind?kind+' ':''}${n===1?'फ़िल्म चल रही है':'फ़िल्में चल रही हैं'}:`);
 const fmtM=(m:number)=>{const h=Math.floor(m/60)%24,mm=m%60;return `${h%12||12}${mm?':'+String(mm).padStart(2,'0'):''} ${h<12?'AM':'PM'}`};
 const lead=[state.after!==undefined?L(lang,`After ${fmtM(state.after)}. `,`${fmtM(state.after)}-এর পরে। `,`${fmtM(state.after)} के बाद। `):'',state.before!==undefined?L(lang,`Before ${fmtM(state.before)}. `,`${fmtM(state.before)}-এর আগে। `,`${fmtM(state.before)} से पहले। `):'',f.soon?L(lang,'Starting in the next 3 hours. ','পরের ৩ ঘণ্টার মধ্যে শুরু। ','अगले 3 घंटों में शुरू। '):'',f.cheapest?L(lang,'Lowest price first. ','কম দাম আগে। ','सबसे कम दाम पहले। '):''].join('');
 const foot=L(lang,'Tap a film and I’ll find the show times and seats.','একটা ছবি ট্যাপ করুন — শো-এর সময় আর সিট খুঁজে দেব।','कोई फ़िल्म चुनिए — मैं शो का समय और सीटें ढूँढ दूँगा।');
 return {reply:localTimes(`${lead}${head}\n${lines.join('\n')}${more}\n\n${foot}`,lang),shows:[],chips:[...films.slice(0,8).map(x=>({label:x.title,send:x.title})),...relaxed.slice(0,2)],links:[single?{label:L(lang,'Cinema details','হলের বিস্তারিত','हॉल की जानकारी'),href:'/contact'}:{label:L(lang,'All movies','সব ছবি','सभी फ़िल्में'),href:'/movies'}],state:nextState,handled:true,lang};
}

/** "What's coming soon?": upcoming releases by date, advance bookings first noted with how many Udayan cinemas have them. */
function upcomingReply(data:AssistantData,lang:Lang,now:number,today:string):AgentReply{
 // Advance bookings sit with the films on screen (they have bookable shows); they belong here too.
 const advance=data.movies.filter(m=>!!m.releaseDate&&m.releaseDate>today&&m.cinemaIds.length>0);
 const pool=[...advance,...data.upcoming.filter(m=>!advance.some(x=>same(x.title,m.title)))];
 // Bookable now (advance) first, then by release date.
 const list=pool.filter(m=>(m.cinemaIds?.length||0)>0||(!!m.releaseDate&&m.releaseDate>=today)).sort((a,b)=>Number((b.cinemaIds?.length||0)>0)-Number((a.cinemaIds?.length||0)>0)||(a.releaseDate||'9999').localeCompare(b.releaseDate||'9999')).slice(0,8);
 if(!list.length)return {reply:L(lang,'No upcoming releases are announced for Udayan cinemas right now. New films appear here as soon as they are.','এখন Udayan হলে আসন্ন কোনও ছবির ঘোষণা নেই। ঘোষণা হলেই এখানে দেখা যাবে।','अभी Udayan सिनेमाघरों के लिए कोई आने वाली फ़िल्म घोषित नहीं है। घोषणा होते ही यहाँ दिखेगी।'),shows:[],chips:playingNow(data,now).slice(0,4).map(m=>({label:m.title,send:m.title})),links:[{label:L(lang,'All movies','সব ছবি','सभी फ़िल्में'),href:'/movies'}],state:{},handled:true,lang};
 const lines=list.map(m=>{const adv=m.cinemaIds?.length||0;const when=m.releaseDate?dayLabel(m.releaseDate,today,lang):L(lang,'date to be announced','তারিখ পরে জানানো হবে','तारीख़ बाद में');const ln=langNames(m.language,lang);
  return `• ${m.title}${ln?` (${ln})`:''} — ${L(lang,`releases ${when}`,`মুক্তি ${when}`,`रिलीज़ ${when}`)}${adv?L(lang,` · advance booking open at ${adv} Udayan ${adv===1?'cinema':'cinemas'}`,` · ${adv}টি Udayan হলে অ্যাডভান্স বুকিং চলছে`,` · ${adv} Udayan हॉल में एडवांस बुकिंग खुली`):''}`});
 const adv=list.filter(m=>m.cinemaIds?.length);
 return {reply:localTimes(`${L(lang,'Upcoming releases:','শীঘ্রই Udayan-এ আসছে:','जल्द ही Udayan में:')}\n${lines.join('\n')}\n\n${adv.length?L(lang,'Tap a film with advance booking and I’ll show its shows.','অ্যাডভান্স বুকিং খোলা ছবিতে ট্যাপ করলে শো দেখাব।','एडवांस बुकिंग वाली फ़िल्म चुनिए, मैं उसके शो दिखा दूँगा।'):L(lang,'Shows appear as soon as a Udayan cinema opens bookings.','কোনও Udayan হলে বুকিং খুললেই শো দেখা যাবে।','किसी Udayan हॉल में बुकिंग खुलते ही शो दिखेंगे।')}`,lang),
  shows:[],chips:[...adv,...list.filter(m=>!m.cinemaIds?.length)].slice(0,6).map(m=>({label:m.title,send:m.title})),links:[{label:L(lang,'Coming soon','শীঘ্রই আসছে','जल्द आ रही'),href:'/movies?tab=upcoming'}],state:{asked:'film'},handled:true,lang};
}

/**
 * One turn of the conversation. Returns handled:false when the message is not about finding or booking a show,
 * so the FAQ engine can answer it instead. `score` says how much of the message was understood, so the server
 * can pick the best of the speech recogniser's alternatives.
 */
export function agent(question:string,prev:AgentState,hints:Hints,data:AssistantData,now=Date.now()):AgentReply{
 const lang=detectLang(question,hints.lang);
 const today=istKey(now);
 // Advance bookings count as bookable films.
 const vocab:Vocab={films:[...data.movies,...data.upcoming.filter(m=>m.cinemaIds?.length&&!data.movies.some(x=>x.title===m.title))],upcoming:data.upcoming.filter(m=>!m.cinemaIds?.length),venues:data.venues,cities:[...new Set(data.venues.map(v=>v.city))]};
 // Films that are playing even if the catalogue has not caught up with the latest sync.
 for(const f of playingNow(data,now))if(!vocab.films.some(m=>same(m.title,f.title)))vocab.films.push({title:f.title,poster:'',cinemaIds:[...f.venues]});
 const film=findFilm(question,vocab.films),soon=film?undefined:findFilm(question,vocab.upcoming);
 // Words that must never be spell-corrected: titles, towns and cinema names.
 const keep=new Set<string>(['bengal']);for(const s of [...vocab.films.map(m=>m.title),...vocab.cities,...vocab.venues.map(v=>v.shortName)])for(const w of latin(s).split(' '))keep.add(w);
 // The message in plain English, without the film's title (so "18 November" is not a date).
 const t=understand(film?withoutTitle(question,film.title):question,keep);
 const greet=(/^(hi+|hello|hey|hola|good (morning|afternoon|evening))\b/.test(t)&&t.split(' ').length<=4)||/\b(what can you do|who are you|how does this work|how do you work|help me|^help$)\b/.test(t);
 if(greet&&!film)return helpReply(data,lang,now);
 // "ok", "ঠিক আছে", "ठीक है", "great": a friendly nudge, not "I didn't understand".
 if(!film&&/^(okay|great|nice|cool|thanks?|thank you|perfect)( (okay|thanks?|you|great))*$/.test(t.trim())){const h=helpReply(data,lang,now);return {...h,state:{...prev,asked:null},reply:L(lang,'Great! Anything else? Tell me a film, a town, a day or a time.','ঠিক আছে! আর কিছু? ছবি, শহর, দিন বা সময় বলুন।','ठीक है! और कुछ? फ़िल्म, शहर, दिन या समय बताइए।')}}
 const reset=/\b(start over|new booking|reset|cancel that|another film|different film|other film)\b/.test(t);
 const otherCinema=/\b(another|other|different) cinemas?\b/.test(t);
 const allScope=/\b(all|every|any) (udayan )?cinemas?\b|\b(all|every|any) (udayan )?(halls?|theat(re|er)s?|places)\b|\beverywhere\b/.test(t);
 const state:AgentState=reset?{}:{...prev};
 const excluded=otherCinema?prev.cinemaId:undefined;
 if(otherCinema||allScope){delete state.cinemaId;delete state.town}
 const places=findPlaces(question,t,vocab);
 // "Near me" (without naming a town) replaces the town or cinema from earlier in the chat: it means where I am now.
 if(places.near&&!places.towns.length&&!places.venues.length){delete state.cinemaId;delete state.town}
 const {day,part:dayPart}=parseDay(t,today);const part=parsePart(t)||dayPart;const afterM=parseBound(t,'after',part||prev.part),beforeM=parseBound(t,'before',part||prev.part);
 const times=afterM!==undefined||beforeM!==undefined?undefined:parseTimes(t,part||prev.part);const count=parseCount(t);
 const edge=/\blastshow\b/.test(t)?'last':/\bfirstshow\b/.test(t)?'first':undefined;
 const f=filtersOf(t);
 const bookCue=/\b(book|booking|tickets?|tix|seats?|show|shows|showtime|showtimes|timing|timings|watch|playing|screening|running|what time|lastshow|firstshow)\b/.test(t);
 const filmy=/\b(movies?|films?|pictures?|cinema|playing|showing|running|releases?|released|on)\b/.test(t);
 const scheduleCue=/\b(which days|what days|which dates|all (the )?(shows|dates|days|showtimes)|full schedule|schedule|every show|this week|next week)\b/.test(t);
 const upcomingCue=!film&&!soon&&/\b(upcoming|coming soon|releasing|next releases?|advance booking|pre ?book(ing)?)\b/.test(t);
 const browseCue=!upcomingCue&&!(scheduleCue&&!!prev.film)&&!film&&!soon&&((filmy&&(/\b(what|which|whats|any|all|list|new|newest|latest|recent|good|best|popular)\b/.test(t)||hasFilter(f)))||/\bwhat.?s (on|new|playing|showing)\b|\bnow (showing|playing)\b|\b(next show|starting soon)\b/.test(t)||f.cheapest||f.soon&&bookCue||((afterM!==undefined||beforeM!==undefined)&&!prev.film));
 // Refunds, cancellations, lost items and payments are questions for the FAQ even when they mention tickets.
 const infoCue=/\b(refunds?|cancel|cancell?ation|cancell?ed|lost|payment failed|money deducted)\b/.test(t)||/\b(refund|cancel|parking|park|food|outside|wheelchair|accessib|contact|phone|email|career|job|address|direction|reach|how to get|lost|age|id proof|rating|certificate|3d glasses|recliner|muse|cafe|menu|franchise|advert|payment|offer)\b/.test(t)&&!/\b(book|tickets?|show)\b/.test(t);
 const fillsAsked=!!state.asked&&(!!film||places.towns.length>0||places.venues.length>0||!!day||!!times||!!part||places.near||allScope);
 const continues=!!state.film&&(afterM!==undefined||beforeM!==undefined||!!day||!!times||!!part||!!edge||places.towns.length>0||places.venues.length>0||!!count);
 const handled=upcomingCue||(scheduleCue&&!!(film||prev.film))||browseCue||(otherCinema&&!!state.film)||!infoCue&&(!!film||!!soon||fillsAsked||continues||(bookCue&&(places.towns.length>0||places.venues.length>0||!!day||!!times||places.near||/\b(book|tickets?)\b/.test(t))))
  // "movies in Tezpur", "films at Triveni Mall": what is playing there
  ||!infoCue&&/\b(movies?|films?|pictures?|cinema|boi|chobi)\b/.test(t)&&!/\bcinemas?\b/.test(t.replace(/\b(udayan )?cinemas? (in|at)\b/g,''))&&(places.towns.length>0||places.venues.length>0);
 const score=(film||soon?4:0)+(places.towns.length||places.venues.length?2:0)+(places.near?1:0)+(day?1:0)+(times?1:0)+(part?1:0)+(count?1:0)+(browseCue?1:0);
 if(!handled)return {reply:'',shows:[],chips:[],links:[],state:prev,handled:false,lang,score};
 const out=(r:Omit<AgentReply,'handled'|'lang'|'score'>&{handled?:boolean}):AgentReply=>({...r,reply:localTimes(r.reply,lang),shows:r.shows.map(c=>({...c,time:localTimes(c.time,lang)})),chips:r.chips.map(c=>({...c,label:localTimes(c.label,lang)})),handled:true,lang,score});

 // A film that is not open for booking yet.
 if(soon&&!soon.cinemaIds?.length){const when=soon.releaseDate?new Date(soon.releaseDate+'T12:00:00+05:30').toLocaleDateString('en-IN',{day:'numeric',month:'long'}):'';
  return out({reply:L(lang,`${soon.title} isn’t open for booking yet${when?` — it releases on ${when}`:''}. I’ll have its shows as soon as a Udayan cinema opens bookings.`,`${soon.title}-এর বুকিং এখনও খোলেনি${when?`, মুক্তি ${when}`:''}। কোনও Udayan হলে বুকিং খুললেই শো দেখাতে পারব।`,`${soon.title} की बुकिंग अभी शुरू नहीं हुई है${when?` — यह ${when} को रिलीज़ होगी`:''}। किसी Udayan हॉल में बुकिंग खुलते ही शो दिखा दूँगा।`),shows:[],chips:playingNow(data,now).slice(0,6).map(m=>({label:m.title,send:L(lang,`Book ${m.title}`,`${m.title} টিকিট`,`${m.title} टिकट`)})),links:[{label:L(lang,'Browse movies','ছবির বিস্তারিত','फ़िल्म की जानकारी'),href:'/movies?tab=upcoming'}],state})}

 if(upcomingCue)return {...upcomingReply(data,lang,now,today),score};

 // Merge what this message adds. A new film keeps the day and time already asked for unless it replaces another film.
 if(browseCue)delete state.film;
 if(film&&film.title!==state.film){const switching=!!state.film;state.film=film.title;if(switching){if(!day)delete state.day;if(!times)delete state.times;if(!part)delete state.part}}
 if(day)state.day=day;if(times)state.times=times;if(part)state.part=part;else if((times||day)&&!prev.part&&!dayPart)delete state.part;if(count)state.count=count;
 if(edge){delete state.times;if(!part)delete state.part}
 if(afterM!==undefined){state.after=afterM;delete state.times}if(beforeM!==undefined){state.before=beforeM;delete state.times}
 if(times){delete state.after;delete state.before}
 if(/\b(any ?time|anytime|whenever|any show|any day)\b/.test(t)){delete state.times;delete state.part;delete state.after;delete state.before}
 // A mall name shared by several towns ("City Centre Mall") is settled by the town in the same message.
 const named=places.towns.length&&places.venues.length>1?places.venues.filter(v=>places.towns.includes(v.city)):places.venues;
 if(named.length===1){state.cinemaId=named[0].id;state.town=named[0].city}
 else if(places.towns.length){state.town=places.towns.join('|');if(!places.towns.includes(vocab.venues.find(v=>v.id===state.cinemaId)?.city||''))delete state.cinemaId}
 const movie=state.film?vocab.films.find(m=>m.title===state.film):undefined;
 const hasCoords=typeof hints.lat==='number'&&typeof hints.lng==='number';
 const km=(v:Venue)=>hasCoords&&v.lat!==null&&v.lng!==null?distanceKm({latitude:hints.lat!,longitude:hints.lng!},{latitude:v.lat,longitude:v.lng}):null;
 const byDistance=(list:Venue[])=>hasCoords?[...list].filter(v=>v.lat!==null).sort((a,b)=>km(a)!-km(b)!):list;
 const showsAt=(id:string)=>(data.shows.get(id)||[]).filter(e=>Date.parse(e.start)>now);
 const playingHere=(v:Venue)=>!movie||showsAt(v.id).some(e=>same(e.title,movie.title));
 const towns=state.town?state.town.split('|'):[];
 const townList=(ts:string[])=>listOf(lang,ts.map(c=>townIn(c,lang)));
 // Bengali: the case ending goes on the last town ("নিউ টাউন, নরেন্দ্রপুর ও হাওড়ায়").
 const townsIn=(ts:string[])=>{const n=ts.map(c=>townIn(c,'bn'));n[n.length-1]=bnIn(n[n.length-1]);return listOf('bn',n)};
 const askLocation=():AgentReply=>({...out({reply:L(lang,'Sure — let me find the Udayan cinemas near you. Please allow location access when your browser asks.','নিশ্চয়ই — আপনার কাছের Udayan হল খুঁজছি। ব্রাউজার জানতে চাইলে লোকেশন দিন।','ज़रूर — आपके पास के Udayan सिनेमाघर ढूँढ रहा हूँ। ब्राउज़र पूछे तो लोकेशन की अनुमति दीजिए।'),shows:[],chips:[],links:[],state:{...state,asked:'cinema'}}),askLocation:true});
 const ctx={state,data,vocab,f,lang,now,today};

 // No film yet: show what is playing where the customer is looking.
 if(!movie){
  if(places.near&&!hasCoords)return askLocation();
  const one=state.cinemaId?vocab.venues.find(v=>v.id===state.cinemaId):undefined;
  const r=one?browse({...ctx,scope:[one],single:one,where:[`at ${nameOf(one)}`,`${nameOf(one)}-এ`,`${nameOf(one)} में`],wide:false})
   :towns.length?browse({...ctx,scope:vocab.venues.filter(v=>towns.includes(v.city)),where:[`in ${listOf('en',towns)}`,`${townsIn(towns)}`,`${townList(towns)} में`],wide:false})
   :(places.near||f.soon||f.cheapest||state.after!==undefined||state.before!==undefined)&&hasCoords?(()=>{const all=byDistance(vocab.venues);const close=all.filter(v=>km(v)!<=30);return browse({...ctx,scope:(close.length?close:all).slice(0,6),where:['near you','আপনার কাছে','आपके पास'],wide:false})})()
   :browse({...ctx,scope:vocab.venues,where:['at Udayan cinemas','Udayan হলগুলিতে','Udayan सिनेमाघरों में'],wide:true});
  return {...r,score};
 }

 // "Which days is it on?" / "this week" / "next week": the film's schedule, day by day, where the customer is looking.
 if(scheduleCue){
  const named=state.cinemaId?vocab.venues.filter(v=>v.id===state.cinemaId):towns.length?vocab.venues.filter(v=>towns.includes(v.city)):hasCoords&&places.near?byDistance(vocab.venues).slice(0,3):[];
  const scope=(named.length?named:vocab.venues).filter(playingHere);
  const all=tagged(scope,data,now).filter(e=>same(e.title,movie.title));
  const w=new Date(today+'T12:00:00+05:30').getUTCDay();const nextMon=addDays(today,((8-w)%7)||7);
  const [from,to]=/\bnext week\b/.test(t)?[nextMon,addDays(nextMon,6)]:/\bthis week\b/.test(t)?[today,addDays(today,6)]:['',''];
  const inRange=from?all.filter(e=>{const d=istKey(e.start);return d>=from&&d<=to}):all;
  const byDay=new Map<string,Tagged[]>();for(const e of inRange){const d=istKey(e.start);byDay.set(d,[...(byDay.get(d)||[]),e])}
  const one=scope.length===1?scope[0]:undefined;
  const where=one?L(lang,`at ${nameOf(one)}`,`${nameOf(one)}-এ`,`${nameOf(one)} में`):named.length?L(lang,`in ${listOf('en',[...new Set(scope.map(v=>v.city))])}`,townsIn([...new Set(scope.map(v=>v.city))]),`${townList([...new Set(scope.map(v=>v.city))])} में`):L(lang,'at Udayan cinemas','Udayan হলগুলিতে','Udayan सिनेमाघरों में');
  if(!byDay.size){const first=all[0]?istKey(all[0].start):'';
   return out({reply:L(lang,`${movie.title} has no shows ${where} ${from?(/next week/.test(t)?'next week':'this week'):'yet'}.${first?` Its next shows are ${onDayEn(first,today)}.`:''}`,`${from?(/next week/.test(t)?'পরের সপ্তাহে':'এই সপ্তাহে'):'এখন'} ${where} ${movie.title}-এর শো নেই।${first?` পরের শো ${dayLabel(first,today,lang)}।`:''}`,`${from?(/next week/.test(t)?'अगले हफ़्ते':'इस हफ़्ते'):'अभी'} ${where} ${movie.title} के शो नहीं हैं।${first?` अगले शो ${dayLabel(first,today,lang)} को हैं।`:''}`),shows:[],chips:first?[{label:dayLabel(first,today,lang),send:dayLabel(first,today,'en')}]:[],links:[],state:{...state,asked:'day'}})}
  const days=[...byDay.keys()].slice(0,7);
  const lines=days.map(d=>{const ev=byDay.get(d)!;const n=new Set(ev.map(e=>e.v.id)).size;
   if(one)return `• ${dayLabel(d,today,lang)}: ${ev.slice(0,6).map(e=>fmtTime(e.start)).join(', ')}${ev.length>6?L(lang,` +${ev.length-6} more`,` +আরও ${ev.length-6}টি`,` +${ev.length-6} और`):''}`;
   return L(lang,`• ${dayLabel(d,today,lang)}: ${ev.length} ${ev.length===1?'show':'shows'} at ${n} ${n===1?'cinema':'cinemas'}, ${fmtTime(ev[0].start)} to ${fmtTime(ev[ev.length-1].start)}`,`• ${dayLabel(d,today,lang)}: ${n}টি হলে ${ev.length}টি শো, ${fmtTime(ev[0].start)} থেকে ${fmtTime(ev[ev.length-1].start)}`,`• ${dayLabel(d,today,lang)}: ${n} हॉल में ${ev.length} शो, ${fmtTime(ev[0].start)} से ${fmtTime(ev[ev.length-1].start)} तक`)});
  const more=byDay.size>7?L(lang,`\n…and ${byDay.size-7} more days.`,`\n…আরও ${byDay.size-7} দিন।`,`\n…और ${byDay.size-7} दिन।`):'';
  const head=L(lang,`${movie.title} ${where}: shows on ${byDay.size} ${byDay.size===1?'day':'days'}${from?(/next week/.test(t)?' next week':' this week'):''}.`,`${where} ${movie.title}: ${from?(/next week/.test(t)?'পরের সপ্তাহে ':'এই সপ্তাহে '):''}${byDay.size} দিন শো আছে।`,`${where} ${movie.title}: ${from?(/next week/.test(t)?'अगले हफ़्ते ':'इस हफ़्ते '):''}${byDay.size} दिन शो हैं।`);
  const foot=L(lang,'Pick a day and I’ll show the times to book.','একটা দিন বাছুন, বুক করার সময়গুলো দেখাব।','कोई दिन चुनिए, मैं बुक करने के समय दिखा दूँगा।');
  return out({reply:`${head}\n${lines.join('\n')}${more}\n\n${foot}`,shows:[],chips:[...days.slice(0,5).map(d=>({label:dayLabel(d,today,lang),send:dayLabel(d,today,'en')})),...(!named.length&&!hasCoords?[{label:L(lang,'📍 Near me','📍 আমার কাছে','📍 मेरे पास'),send:L(lang,'near me','আমার কাছে','मेरे पास')}]:[])],links:[{label:L(lang,'Browse movies','ছবির বিস্তারিত','फ़िल्म की जानकारी'),href:'/movies'}],state:{...state,day:undefined,asked:'day'}});
 }

 // Which cinemas? One named, the towns asked for, near the visitor, their saved cinema, or ask for a town.
 let list:Venue[]=[];
 const fromCoords=!state.cinemaId&&!towns.length&&hasCoords&&!(hints.cinemaId&&!places.near&&!otherCinema);
 if(state.cinemaId){const v=vocab.venues.find(x=>x.id===state.cinemaId);if(v)list=[v]}
 if(!list.length){
  let pool=towns.length?vocab.venues.filter(v=>towns.includes(v.city)):[];
  if(!pool.length&&places.near&&!hasCoords)return askLocation();
  if(!pool.length&&hints.cinemaId&&!otherCinema&&!places.near){const saved=vocab.venues.find(v=>v.id===hints.cinemaId);if(saved&&playingHere(saved))pool=[saved]}
  if(!pool.length&&hasCoords){const near=byDistance(vocab.venues).filter(v=>playingHere(v)&&v.id!==excluded);const close=near.filter(v=>km(v)!<=30);pool=(close.length?close:near).slice(0,3)}
  const playing=byDistance(pool.filter(v=>playingHere(v)&&v.id!==excluded));
  if(playing.length===1)state.cinemaId=playing[0].id;
  if(playing.length)list=playing.slice(0,4);
  else{
   const everywhere=vocab.venues.filter(v=>playingHere(v)&&v.id!==excluded);
   if(!everywhere.length)return out({reply:L(lang,`${movie.title} has no upcoming shows at Udayan cinemas right now. Here’s what is playing:`,`${movie.title}-এর এখন কোনও Udayan হলে শো নেই। যা চলছে:`,`${movie.title} के अभी किसी Udayan हॉल में शो नहीं हैं। ये फ़िल्में चल रही हैं:`),shows:[],chips:playingNow(data,now).slice(0,6).map(m=>({label:m.title,send:m.title})),links:[{label:L(lang,'Browse movies','ছবির বিস্তারিত','फ़िल्म की जानकारी'),href:'/movies'}],state:{...state,film:undefined,asked:'film'}});
   if(everywhere.length===1){state.cinemaId=everywhere[0].id;list=everywhere}
   else{
    const count=new Map<string,number>();for(const v of everywhere)count.set(v.city,(count.get(v.city)||0)+showsAt(v.id).filter(e=>same(e.title,movie.title)).length);
    const byTown=[...count.keys()].sort((a,b)=>count.get(b)!-count.get(a)!);
    const chips:Chip[]=[...(!hasCoords?[{label:L(lang,'📍 Near me','📍 আমার কাছে','📍 मेरे पास'),send:L(lang,'near me','আমার কাছে','मेरे पास')}]:[]),...byTown.slice(0,10).map(c=>({label:townIn(c,lang),send:c}))];
    const facts=[langNames(movie.language,lang),movie.censor].filter(Boolean).join(' · ');const etc=byTown.length>6;
    if(towns.length)return out({reply:L(lang,`${movie.title} isn’t showing in ${listOf('en',towns)} right now. It’s playing in ${listOf('en',byTown.slice(0,6))}${etc?' and more':''} — which town works for you?`,`${movie.title} এখন ${townsIn(towns)} চলছে না। চলছে ${etc?townList(byTown.slice(0,6))+' ইত্যাদি জায়গায়':townsIn(byTown.slice(0,6))} — কোন শহর সুবিধা?`,`${movie.title} अभी ${townList(towns)} में नहीं चल रही। यह ${townList(byTown.slice(0,6))}${etc?' वगैरह':''} में चल रही है — कौन-सा शहर ठीक रहेगा?`),shows:[],chips,links:[],state:{...state,town:undefined,asked:'cinema'}});
    return out({reply:L(lang,`${movie.title}${facts?` (${facts})`:''} is playing at ${everywhere.length} Udayan cinemas in ${byTown.length} towns. Where would you like to watch it? Pick a town or tap “Near me”.`,`${movie.title}${facts?` (${facts})`:''} ${byTown.length}টি শহরের ${everywhere.length}টি Udayan হলে চলছে। কোথায় দেখবেন? শহর বাছুন বা “আমার কাছে” ট্যাপ করুন।`,`${movie.title}${facts?` (${facts})`:''} ${byTown.length} शहरों के ${everywhere.length} Udayan हॉल में चल रही है। कहाँ देखना चाहेंगे? शहर चुनिए या “मेरे पास” दबाइए।`),shows:[],chips,links:[{label:L(lang,'Browse movies','ছবির বিস্তারিত','फ़िल्म की जानकारी'),href:'/movies'}],state:{...state,asked:'cinema'}});
   }
  }
 }
 const one=list.length===1?list[0]:undefined;
 const all=tagged(list,data,now);

 // The shows.
 const filmShows=all.filter(e=>same(e.title,movie.title));
 if(!filmShows.length){const alt=byDistance(vocab.venues.filter(playingHere)).filter(v=>!list.includes(v)).slice(0,6);const names=list.map(nameOf).join(', ');
  return out({reply:L(lang,`${movie.title} has no upcoming shows at ${names}. It’s playing at these Udayan cinemas:`,`${names}-এ ${movie.title}-এর কোনও শো নেই। এই হলগুলিতে চলছে:`,`${names} में ${movie.title} का कोई शो नहीं है। यह इन Udayan हॉल में चल रही है:`),shows:[],chips:alt.map(v=>({label:nameOf(v),send:nameOf(v)})),links:[],state:{...state,cinemaId:undefined,asked:'cinema'}})}
 const days=[...new Set(filmShows.map(e=>istKey(e.start)))];
 let targetDay=state.day;
 const nearby=fromCoords||places.near;const cities=[...new Set(list.map(v=>v.city))];
 const place=one?L(lang,`at ${nameOf(one)}`,nameOf(one),`${nameOf(one)} में`):nearby?L(lang,'near you','আপনার কাছে','आपके पास'):L(lang,`in ${listOf('en',cities)}`,`${townsIn(cities)}`,`${townList(cities)} में`);
 if(targetDay&&!days.includes(targetDay)){
  const first=movie.advance||days[0]>addDays(today,1);
  return out({reply:L(lang,`${movie.title} has no shows ${place} ${onDayEn(targetDay,today)}.${first?` Its first shows are on ${dayLabel(days[0],today,'en')}.`:''} These days are open:`,`${dayLabel(targetDay,today,lang)} ${place} ${movie.title}-এর শো নেই।${first?` প্রথম শো ${dayLabel(days[0],today,lang)}।`:''} এই দিনগুলোয় আছে:`,`${dayLabel(targetDay,today,lang)} ${place} ${movie.title} का कोई शो नहीं है।${first?` इसके पहले शो ${dayLabel(days[0],today,lang)} को हैं।`:''} इन दिनों में शो हैं:`),shows:[],chips:days.slice(0,5).map(d=>({label:dayLabel(d,today,lang),send:dayLabel(d,today,'en')})),links:[],state:{...state,day:undefined,asked:'day'}})}
 const matchesPart=(e:Screening)=>(!state.part||inPart(e.start,state.part))&&inBounds(e.start,state);
 const mins=(e:Screening)=>{let m=istMinutes(e.start);if(m<5*60)m+=24*60;return m};
 let wanted=state.times;
 const distanceTo=(e:Screening)=>wanted?Math.min(...wanted.map(w=>Math.abs(w-mins(e)))):0;
 if(!targetDay){
  // No day given: today when it has a matching show, otherwise the first day that does.
  targetDay=days.find(d=>filmShows.some(e=>istKey(e.start)===d&&matchesPart(e)&&(!wanted||distanceTo(e)<=30)))||days.find(d=>filmShows.some(e=>istKey(e.start)===d&&matchesPart(e)))||days[0];
 }
 const dayShows=filmShows.filter(e=>istKey(e.start)===targetDay);
 const inPartShows=dayShows.filter(matchesPart);
 // "Last show" / "first show" of that day.
 if(edge){const pool=inPartShows.length?inPartShows:dayShows;const e=edge==='last'?pool[pool.length-1]:pool[0];if(e)wanted=[mins(e)]}
 let picked:Tagged[]=[];let exact:Tagged|undefined;
 const tolerance=/\b(around|about|approx|approximately|ish|near|kachakachi)\b/.test(t)?30:10;
 if(wanted){const sorted=[...(inPartShows.length?inPartShows:dayShows)].sort((a,b)=>distanceTo(a)-distanceTo(b)||Date.parse(b.start)-Date.parse(a.start));exact=sorted.find(e=>distanceTo(e)<=tolerance);picked=sorted.slice(0,one?3:4).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))}
 else if(f.cheapest)picked=[...(inPartShows.length?inPartShows:dayShows)].sort((a,b)=>(a.price??1e9)-(b.price??1e9)||Date.parse(a.start)-Date.parse(b.start)).slice(0,one?6:8);
 else picked=(inPartShows.length?inPartShows:dayShows).slice(0,one?6:8);
 const card=(e:Tagged):ShowCard=>({title:movie.title,poster:e.poster||movie.poster||undefined,cinemaId:e.v.id,cinema:e.v.shortName.replace(/\s*:\s*[^:]+$/,''),city:e.v.city,start:e.start,day:dayLabel(istKey(e.start),today,lang),time:fmtTime(e.start),screen:e.auditorium?e.auditorium.replace(/\b\w+/g,w=>w[0]+w.slice(1).toLowerCase()):undefined,format:e.format,price:e.price,url:e.url,appUrl:districtAppLink(e.url,e.start)??undefined,detail:'/movies',exact:!!exact&&e===exact,lang});
 const dl=dayLabel(targetDay,today,lang);const dlIn=lang==='en'&&(targetDay===today||targetDay===addDays(today,1))?dl.toLowerCase():dl;
 const at=(v:Venue)=>{const d=km(v);return nameOf(v)+(d!==null&&nearby?L(lang,` (${d<1?'under 1':Math.round(d)} km away)`,` (${d<1?'১-এর কম':Math.round(d)} কিমি দূরে)`,` (${d<1?'1 किमी से कम':Math.round(d)+' किमी'} दूर)`):'')};
 const seats=state.count?L(lang,` Choose ${state.count} seats on District.`,` District-এ ${state.count}টি সিট বেছে নিন।`,` District पर ${state.count} सीटें चुनिए।`):'';
 const pn=state.part?` (${PART_NAME[lang][state.part]})`:'';
 const tm=wanted?wanted.map(fmtMin).join(' / '):'';
 const book=L(lang,'Tap “Book on District” to pick your seats.','সিট বাছতে “District-এ বুক করুন” ট্যাপ করুন।','सीट चुनने के लिए “District पर बुक करें” दबाइए।');
 let reply:string;
 const close=exact&&distanceTo(exact)>10;
 if(edge&&exact)reply=L(lang,`The ${edge} show of ${movie.title} ${dlIn} ${place} is at ${fmtTime(exact.start)}${one?'':`, ${at(exact.v)}`}.${exact.price?` From ₹${exact.price}.`:''} ${book}${seats}`,`${dl} ${place} ${movie.title}-এর ${edge==='last'?'শেষ':'প্রথম'} শো ${fmtTime(exact.start)}-এ${one?'':`, ${at(exact.v)}`}।${exact.price?` ₹${exact.price} থেকে।`:''} ${book}${seats}`,`${dl} ${place} ${movie.title} का ${edge==='last'?'आख़िरी':'पहला'} शो ${fmtTime(exact.start)} पर है${one?'':`, ${at(exact.v)}`}।${exact.price?` ₹${exact.price} से।`:''} ${book}${seats}`);
 else if(wanted&&exact&&close)reply=L(lang,`The closest show to ${tm} is ${fmtTime(exact.start)} — ${movie.title}, ${dlIn}, ${at(exact.v)}.${exact.price?` From ₹${exact.price}.`:''} ${book}${seats}`,`${tm}-এর সবচেয়ে কাছের শো ${fmtTime(exact.start)} — ${movie.title}, ${dl}, ${at(exact.v)}।${exact.price?` ₹${exact.price} থেকে।`:''} ${book}${seats}`,`${tm} के सबसे पास का शो ${fmtTime(exact.start)} है — ${movie.title}, ${dl}, ${at(exact.v)}।${exact.price?` ₹${exact.price} से।`:''} ${book}${seats}`);
 else if(wanted&&exact)reply=L(lang,`Found it — ${movie.title}, ${dlIn} at ${fmtTime(exact.start)}, ${at(exact.v)}.${exact.price?` From ₹${exact.price}.`:''} ${book}${seats}`,`পেয়েছি — ${movie.title}, ${dl} ${fmtTime(exact.start)}, ${at(exact.v)}।${exact.price?` ₹${exact.price} থেকে।`:''} ${book}${seats}`,`मिल गया — ${movie.title}, ${dl} ${fmtTime(exact.start)}, ${at(exact.v)}।${exact.price?` ₹${exact.price} से।`:''} ${book}${seats}`);
 else if(wanted)reply=L(lang,`There’s no ${tm} show of ${movie.title} ${place} ${dlIn}. The closest times are below.${seats}`,`${place} ${dl} ${tm}-এ ${movie.title}-এর শো নেই। কাছাকাছি সময়গুলো নিচে।${seats}`,`${place} ${dl} ${tm} पर ${movie.title} का कोई शो नहीं है। सबसे पास के समय नीचे हैं।${seats}`);
 else if(one)reply=L(lang,`${movie.title} at ${at(one)}, ${dlIn}${pn}: ${picked.length} ${picked.length===1?'show':'shows'}. Pick a time to book.${seats}`,`${at(one)}-এ ${dl}${pn} ${movie.title}: ${picked.length}টি শো। সময় বেছে বুক করুন।${seats}`,`${at(one)} में ${dl}${pn} ${movie.title}: ${picked.length} शो। बुक करने के लिए समय चुनिए।${seats}`);
 else{const n=new Set(picked.map(e=>e.v.id)).size;reply=L(lang,`${movie.title} ${place}, ${dlIn}${pn}: ${picked.length} ${picked.length===1?'show':'shows'} at ${n} ${n===1?'cinema':'cinemas'}. Pick a time to book, or choose a cinema below.${seats}`,`${place} ${dl}${pn} ${movie.title}: ${n}টি হলে ${picked.length}টি শো। সময় বেছে বুক করুন, বা নিচে হল বাছুন।${seats}`,`${place} ${dl}${pn} ${movie.title}: ${n} हॉल में ${picked.length} शो। बुक करने के लिए समय चुनिए, या नीचे हॉल चुनिए।${seats}`)}
 const otherDays=days.filter(d=>d!==targetDay).slice(0,3);
 const chips:Chip[]=[
  ...(one&&!exact?dayShows.filter(e=>!picked.includes(e)).slice(0,4).map(e=>({label:fmtTime(e.start),send:`${fmtTime(e.start)} ${dayLabel(targetDay!,today,'en')}`})):[]),
  ...otherDays.map(d=>({label:dayLabel(d,today,lang),send:dayLabel(d,today,'en')})),
  ...(one?[{label:L(lang,'Another cinema','অন্য হল','दूसरा हॉल'),send:L(lang,'another cinema','অন্য হল','दूसरा हॉल')}]:list.map(v=>({label:nameOf(v),send:nameOf(v)}))),
 ];
 return out({reply,shows:(exact?[exact,...picked.filter(e=>e!==exact)]:picked).map(card),chips,links:[],state:{...state,day:targetDay,asked:null}});
}
