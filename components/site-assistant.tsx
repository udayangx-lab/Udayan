'use client';
import Link from 'next/link';
import DistrictLink from './district-link';
import {cinemaPreferenceKey} from '@/lib/cinema-location';
const LOGO_DARK='/images/udayancinema-logo.png';

import {fixHeard} from '@/lib/assistant/heard';
import {Fragment,useCallback,useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {ArrowRight,ArrowUp,ArrowUpRight,Keyboard,Lock,Mic,MicOff,MessagesSquare,RotateCcw,Ticket,Volume2,X} from 'lucide-react';

type ChatLink={label:string;href:string;external?:boolean};
type ShowCard={lang?:'en'|'bn'|'hi';title:string;poster?:string;cinemaId:string;cinema:string;city:string;start:string;day:string;time:string;screen?:string;format?:string;price?:number;url:string;appUrl?:string;detail:string;exact?:boolean};
type Chip={label:string;send:string};
type Message={id:number;role:'user'|'assistant';content:string;links?:ChatLink[];related?:string[];shows?:ShowCard[];chips?:Chip[];fresh?:boolean;voice?:boolean};
type AgentState=Record<string,unknown>;
const storageKey='udayan-assistant';
const read=(k:string)=>{try{return localStorage.getItem(k)}catch{return null}};
const isBn=()=>read('udayan-lang')==='bn';
const T={
 en:{welcome:'Hi! I’m the Udayan Assistant. Tell me what you’d like to watch — type or tap the mic and say something like “tonight’s shows near me”. I’ll find the show and give you a direct link to book your seats.',
  starters:['What’s playing today?','What’s showing near me?','Shows tomorrow evening','How do refunds work?'],place:'Ask Udayan…',listening:'Listening… speak now',online:'Shows & visitor information',
  book:'Book on District',details:'Details',popular:'Try asking',related:'Related questions',note:'Choose seats and pay on District.',mic:'Speak your question',stop:'Stop listening',speakOn:'Read replies aloud',speakOff:'Stop reading replies aloud',noMic:'Voice input is not available in this browser. Please type your question.',micDenied:'Microphone access was blocked. Allow it in your browser settings, or type your question.',loc:'Finding cinemas near you…',locNo:'I couldn’t get your location. Please tell me your town instead.',
  noSpeech:'I didn’t catch that. Tap the mic and speak again, or type your question.',noMicFound:'No microphone was found. Check that one is connected, or type your question.',voiceNet:'Voice needs an internet connection. Please type your question.',dictTitle:'Turn on Dictation',dictBody:'iPhone and iPad use Dictation to understand speech. Turn it on, then come back and tap “Try again”:',dictSteps:['Open Settings → General → Keyboard','Turn on Enable Dictation','Come back and tap “Try again”'],
  thinking:'Finding your show…',speaking:'Speaking…',sayHint:'Try: “Shows tonight near me”',tapStop:'Tap the orb to stop',keyboard:'Type instead',
  permTitle:'Turn on your microphone',permBody:'Allow microphone access to talk to the Udayan Assistant. It only listens while the red orb is showing.',permAllow:'Allow microphone',permRetry:'Try again',permBlocked:'Microphone is blocked for this site. To turn it on:',
  insecureTitle:'Voice needs a secure connection',insecureBody:'Browsers only allow the microphone on https (or localhost). Open the site on its https address to talk; you can still type.',unsupported:'This browser can’t listen. Try Chrome, Edge or Safari, or type your question.',
  steps:{desktop:['Click the 🔒 (or ⓘ) icon at the left of the address bar','Set Microphone to Allow','Click “Try again”'],safari:['Safari menu → Settings for This Website…','Set Microphone to Allow','Click “Try again”'],ios:['Open Settings → Safari → Microphone','Choose Allow','Come back and tap “Try again”'],android:['Tap ⋮ → Settings → Site settings → Microphone','Allow this site','Tap “Try again”']}},
 bn:{welcome:'নমস্কার! আমি Udayan সহকারী। কী দেখতে চান বলুন — লিখুন বা মাইক ট্যাপ করে বলুন, যেমন “আজ রাতে আমার কাছে কী শো আছে”। শো খুঁজে সরাসরি বুক করার লিঙ্ক দিয়ে দেব।',
  starters:['আজ কী চলছে?','আমার কাছে কী চলছে?','কাল সন্ধ্যার শো','রিফান্ড কীভাবে হয়?'],place:'লিখুন বা বলুন: “আজ রাতে কী চলছে?”…',listening:'শুনছি… বলুন',online:'অনলাইন · শো খোঁজে, District-এ বুক করায়',
  book:'District-এ বুক করুন',details:'বিস্তারিত',popular:'জিজ্ঞেস করে দেখুন',related:'আরও প্রশ্ন',note:'Udayan-এর নিজস্ব সহকারী, সর্বশেষ শো-এর তথ্য দিয়ে। সিট ও পেমেন্ট District-এ নিরাপদে হয়।',mic:'বলে প্রশ্ন করুন',stop:'শোনা বন্ধ করুন',speakOn:'উত্তর পড়ে শোনান',speakOff:'পড়ে শোনানো বন্ধ করুন',noMic:'এই ব্রাউজারে ভয়েস ইনপুট নেই। অনুগ্রহ করে লিখে জিজ্ঞেস করুন।',micDenied:'মাইক্রোফোন বন্ধ আছে। ব্রাউজারে অনুমতি দিন, বা লিখে জিজ্ঞেস করুন।',loc:'আপনার কাছের হল খুঁজছি…',locNo:'লোকেশন পাওয়া গেল না। শহরের নাম বলুন।',
  noSpeech:'শুনতে পাইনি। মাইক ট্যাপ করে আবার বলুন, বা লিখে জিজ্ঞেস করুন।',noMicFound:'কোনও মাইক্রোফোন পাওয়া যায়নি। লিখে জিজ্ঞেস করুন।',voiceNet:'ভয়েসের জন্য ইন্টারনেট দরকার। লিখে জিজ্ঞেস করুন।',dictTitle:'Dictation চালু করুন',dictBody:'iPhone ও iPad কথা বুঝতে Dictation ব্যবহার করে। চালু করে ফিরে এসে “আবার চেষ্টা করুন” ট্যাপ করুন:',dictSteps:['Settings → General → Keyboard খুলুন','Enable Dictation চালু করুন','ফিরে এসে “আবার চেষ্টা করুন” ট্যাপ করুন'],
  thinking:'শো খুঁজছি…',speaking:'বলছি…',sayHint:'যেমন: “আজ রাতে আমার কাছে কী শো আছে”',tapStop:'থামাতে লাল বৃত্তে ট্যাপ করুন',keyboard:'লিখে বলুন',
  permTitle:'মাইক্রোফোন চালু করুন',permBody:'Udayan সহকারীর সঙ্গে কথা বলতে মাইক্রোফোনের অনুমতি দিন। লাল বৃত্ত দেখা গেলেই শুধু শোনে।',permAllow:'মাইক্রোফোনের অনুমতি দিন',permRetry:'আবার চেষ্টা করুন',permBlocked:'এই সাইটে মাইক্রোফোন বন্ধ আছে। চালু করতে:',
  insecureTitle:'ভয়েসের জন্য সুরক্ষিত সংযোগ দরকার',insecureBody:'ব্রাউজার শুধু https (বা localhost)-এ মাইক্রোফোন চালু করে। কথা বলতে https ঠিকানায় খুলুন; লিখে জিজ্ঞেস করতে পারেন।',unsupported:'এই ব্রাউজারে ভয়েস চলে না। Chrome, Edge বা Safari ব্যবহার করুন, বা লিখে জিজ্ঞেস করুন।',
  steps:{desktop:['ঠিকানা বারের বাঁদিকে 🔒 (বা ⓘ) আইকনে ক্লিক করুন','Microphone → Allow করুন','“আবার চেষ্টা করুন” ক্লিক করুন'],safari:['Safari মেনু → Settings for This Website…','Microphone → Allow করুন','“আবার চেষ্টা করুন” ক্লিক করুন'],ios:['Settings → Safari → Microphone খুলুন','Allow বেছে নিন','ফিরে এসে “আবার চেষ্টা করুন” ট্যাপ করুন'],android:['⋮ → Settings → Site settings → Microphone','এই সাইটকে Allow করুন','“আবার চেষ্টা করুন” ট্যাপ করুন']}},
};
/** What is playing now (from the server), so the welcome and suggestions name real, current films. */
type VLang='en'|'bn'|'hi';
type Live={films:string[];example:{film:string;town:string}|null;en:string[];bn:string[];hi?:string[]};
// Universal examples (no film named), so no title is singled out.
const example=(lang:VLang,_live?:Live|null)=>lang==='bn'?'“কাল সন্ধ্যায় আমার কাছে কী শো আছে”':lang==='hi'?'“कल शाम मेरे पास कौन-से शो हैं”':'“tomorrow evening shows near me”';
const welcomeOf=(lang:VLang,live:Live|null=null):Message=>{const ex=example(lang,live);
 const content=lang==='bn'?'নমস্কার! কোন ছবি দেখতে চান? শো, পার্কিং বা ডিপিডি ক্যাফে সম্পর্কে জিজ্ঞেস করুন।':lang==='hi'?'नमस्ते! कौन-सी फ़िल्म देखना चाहेंगे? शो, पार्किंग या डीपीडी कैफ़े के बारे में पूछिए।':'What would you like to see? Find a show at either Udayan cinema, or ask about parking, DPD Café and your visit.';
 return {id:0,role:'assistant',content,related:live?(lang==='hi'?live.hi||live.en:lang==='bn'?live.bn:live.en):T[lang==='bn'?'bn':'en'].starters.slice(1)}};
/** The voice language: what the microphone listens for and the language replies come in. */
const VOICE:Record<VLang,{rec:string;tag:string;name:string;label:string;listening:string;thinking:string;speaking:string;tryLead:string;place:(film?:string)=>string;picked:string}>={
 en:{rec:'en-IN',tag:'EN',name:'English',label:'Language',listening:'Listening… speak now',thinking:'Finding your show…',speaking:'Speaking…',tryLead:'Try:',place:()=>'Ask Udayan…',picked:'Voice set to English. Hindi and Bengali typed in English letters work too.'},
 bn:{rec:'bn-IN',tag:'বাং',name:'বাংলা',label:'কথা ও উত্তরের ভাষা',listening:'শুনছি… বলুন',thinking:'শো খুঁজছি…',speaking:'বলছি…',tryLead:'যেমন:',place:()=>'লিখুন বা বলুন: “আজ রাতে কী চলছে?”…',picked:'এখন বাংলায় বলুন — উত্তর বাংলায় পাবেন।'},
 hi:{rec:'hi-IN',tag:'हिं',name:'हिंदी',label:'बोलने और जवाब की भाषा',listening:'सुन रहा हूँ… बोलिए',thinking:'शो ढूँढ रहा हूँ…',speaking:'बोल रहा हूँ…',tryLead:'जैसे:',place:()=>'लिखिए या बोलिए: “आज रात क्या चल रहा है?”…',picked:'अब हिंदी में बोलिए — जवाब हिंदी में मिलेगा।'},
};
const BOOK_LABEL:Record<VLang,[string,string]>={en:['Book on District','All movies'],bn:['District-এ বুক করুন','বিস্তারিত'],hi:['District पर बुक करें','विवरण']};
const reducedMotion=()=>typeof window!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

/* Browser speech recognition (Chrome, Edge, Safari). Typed loosely: it is not in every TypeScript DOM library. */
type Recognition={lang:string;interimResults:boolean;continuous:boolean;maxAlternatives:number;start:()=>void;stop:()=>void;abort:()=>void;onresult:((e:{resultIndex:number;results:ArrayLike<ArrayLike<{transcript:string}>&{isFinal:boolean}>})=>void)|null;onend:(()=>void)|null;onerror:((e:{error:string})=>void)|null};
const recognitionClass=()=>typeof window==='undefined'?null:((window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition}).SpeechRecognition||(window as unknown as {webkitSpeechRecognition?:new()=>Recognition}).webkitSpeechRecognition||null);

/** Renders a reply line by line; "• " lines become a list. Words fade in when the message is new. */
function Reply({text,animate,onDone}:{text:string;animate:boolean;onDone:()=>void}){
 const words=text.split(/\s+/).length,step=Math.min(38,1400/Math.max(words,1));let index=0;
 useEffect(()=>{if(!animate){onDone();return}const timer=setTimeout(onDone,words*step+350);return()=>clearTimeout(timer)},[animate]);// eslint-disable-line react-hooks/exhaustive-deps
 const renderWords=(line:string)=>line.split(/(\s+)/).map((part,i)=>/^\s+$/.test(part)||!part?part:<span key={i} className={animate?'assistant-word':undefined} style={animate?{animationDelay:`${(index++)*step}ms`}:undefined}>{part}</span>);
 const blocks:React.ReactNode[]=[];let bullets:string[]=[];
 const flush=()=>{if(bullets.length){blocks.push(<ul key={'l'+blocks.length}>{bullets.map((b,i)=><li key={i}>{renderWords(b)}</li>)}</ul>);bullets=[]}};
 for(const line of text.split('\n')){if(line.startsWith('• ')){bullets.push(line.slice(2));continue}flush();if(line.trim())blocks.push(<p key={'p'+blocks.length}>{renderWords(line)}</p>)}
 flush();return <>{blocks}</>;
}

/** A show the assistant found: poster, time and cinema, with the District seat link (the app on phones). */
function ShowResult({s,bn,onLeave}:{s:ShowCard;bn:boolean;onLeave:()=>void}){
 const [bookL,detailL]=BOOK_LABEL[s.lang||(bn?'bn':'en')];
 return <article className={'assistant-show'+(s.exact?' exact':'')}>
  {s.poster&&<img src={s.poster} alt=""/>}
  <div className="assistant-show-body">
   <b>{s.time}<small>{s.day}</small></b>
   <span>{s.title}</span>
   <small>{[s.cinema,s.screen,s.format,s.price?`₹${s.price}`:''].filter(Boolean).join(' · ')}</small>
   <div className="assistant-show-acts">
    <DistrictLink className="assistant-book" href={s.url} startsAt={s.start}><Ticket size={14}/>{bookL}</DistrictLink>
    <Link className="assistant-detail" href={s.detail} onClick={onLeave}>{detailL}<ArrowRight size={13}/></Link>
   </div>
  </div>
 </article>;
}

export default function SiteAssistant(){
 const [open,setOpen]=useState(false),[bn,setBn]=useState(false),[vlang,setVlang]=useState<VLang>('en'),[messages,setMessages]=useState<Message[]>([welcomeOf('en')]),[draft,setDraft]=useState(''),[typing,setTyping]=useState(false),[revealed,setRevealed]=useState<Set<number>>(new Set([0]));
 const [voice,setVoice]=useState<'idle'|'listening'|'thinking'|'speaking'>('idle'),[notice,setNotice]=useState(''),[perm,setPerm]=useState<null|'ask'|'denied'|'insecure'|'unsupported'|'dictation'>(null);
 const listening=voice==='listening';const orb=useRef<HTMLButtonElement>(null);const meter=useRef<{stream:MediaStream;ctx:AudioContext;raf:number}|null>(null);const fake=useRef<{level:number;raf:number}|null>(null);const [live,setLive]=useState<Live|null>(null);
 const logRef=useRef<HTMLDivElement>(null),inputRef=useRef<HTMLInputElement>(null),launcherRef=useRef<HTMLButtonElement>(null),nextId=useRef(1);
 const agentState=useRef<AgentState>({});const coords=useRef<{lat:number;lng:number}|null>(null);const recog=useRef<Recognition|null>(null);const heard=useRef('');const stopNow=useRef<()=>void>(()=>{});const dropNow=useRef<()=>void>(()=>{});const alts=useRef<string[]>([]);
 const t=T[bn?'bn':'en'];
 useEffect(()=>{const b=isBn();setBn(b);const saved=read('udayan-assistant-lang');const v:VLang=saved==='en'||saved==='bn'||saved==='hi'?saved:b?'bn':'en';setVlang(v);try{const chat=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(chat&&Array.isArray(chat.messages)&&chat.messages.length){setMessages(chat.messages);setRevealed(new Set(chat.messages.map((m:Message)=>m.id)));nextId.current=Math.max(...chat.messages.map((m:Message)=>m.id))+1;agentState.current=chat.state||{}}else setMessages([welcomeOf(v)])}catch{setMessages([welcomeOf(v)])}},[]);
 useEffect(()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({messages:messages.map(({fresh,...m})=>m),state:agentState.current}))}catch{}},[messages]);
 useEffect(()=>{const log=logRef.current;if(log)log.scrollTo({top:log.scrollHeight,behavior:reducedMotion()?'auto':'smooth'})},[messages,typing,revealed,open,listening]);
 useEffect(()=>{if(!open)return;setBn(isBn());// Phones: no auto-focus, so the keyboard doesn't jump up the moment the chat opens.
  if(matchMedia('(pointer: fine)').matches)inputRef.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);launcherRef.current?.focus()}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[open]);
 useEffect(()=>{const toggle=()=>setOpen(o=>!o),close=()=>setOpen(false);window.addEventListener('udayan:assistant',toggle);window.addEventListener('udayan:assistant-close',close);return()=>{window.removeEventListener('udayan:assistant',toggle);window.removeEventListener('udayan:assistant-close',close)}},[]);
 useEffect(()=>{if(!open||live)return;fetch('/api/assistant').then(r=>r.ok?r.json():null).then((d:Live|null)=>{if(d&&Array.isArray(d.films))setLive(d)}).catch(()=>{})},[open,live]);
 useEffect(()=>{setMessages(m=>m.map(x=>x.id===0?welcomeOf(vlang,live):x))},[live,vlang]);
 const pathname=usePathname();
 useEffect(()=>{setOpen(false)},[pathname]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent('udayan:assistant-state',{detail:open}));document.documentElement.classList.toggle('assistant-open',open);if(!open){dropNow.current();stopMeter();setVoice('idle')}},[open]);// eslint-disable-line react-hooks/exhaustive-deps

 // Replies are text only (spoken replies were switched off on purpose); voice is for asking.

 async function ask(question:string,opts:{voice?:boolean;silent?:boolean;alts?:string[]}={}){
  const q=question.trim();if(!q||typing)return;
  const user:Message={id:nextId.current++,role:'user',content:q,voice:opts.voice};
  const history=[...messages.filter(m=>m.id!==0),...(opts.silent?[]:[user])];
  if(!opts.silent){setMessages(m=>[...m,user]);setRevealed(r=>new Set(r).add(user.id))}
  setDraft('');setTyping(true);setNotice('');
  const started=Date.now();let reply:Message;let askLocation=false;
  // Typing in Bengali or Hindi script switches the voice language too, so the mic and replies follow.
  const typed:VLang|null=/[\u0980-\u09ff]/.test(q)?'bn':/[\u0900-\u097f]/.test(q)?'hi':null;
  const useLang=typed||vlang;if(typed&&typed!==vlang){setVlang(typed);try{localStorage.setItem('udayan-assistant-lang',typed)}catch{}}
  try{
   const hints={cinemaId:read(cinemaPreferenceKey)||undefined,lang:useLang,...(coords.current||{})};
   const res=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:(opts.silent?[...history,user]:history).slice(-12).map(({role,content})=>({role,content:content.slice(0,1200)})),state:agentState.current,hints,...(opts.alts?.length?{alternatives:opts.alts.slice(0,4).map(a=>a.slice(0,300))}:{})})});
   const data=await res.json();
   if(res.ok&&data.state)agentState.current=data.state;askLocation=!!data.askLocation;
   reply={id:nextId.current++,role:'assistant',content:res.ok?data.reply:data.error||'I am unable to respond at the moment. Please try again shortly.',links:res.ok?data.links:[],related:res.ok?data.related:[],shows:res.ok?data.shows:[],chips:res.ok?data.chips:[],fresh:true};
  }catch{reply={id:nextId.current++,role:'assistant',content:'I am unable to connect at the moment. Please check your connection and try again.',fresh:true}}
  if(!reducedMotion())await pause(Math.max(0,Math.min(1200,500+reply.content.length*2)-(Date.now()-started)));
  setTyping(false);setMessages(m=>[...m,reply]);
  setVoice('idle');
  // "Near me": ask the browser for location once (kept in memory only), then answer the same question again.
  if(askLocation&&navigator.geolocation){setNotice(t.loc);navigator.geolocation.getCurrentPosition(p=>{coords.current={lat:p.coords.latitude,lng:p.coords.longitude};setNotice('');void ask(q,{voice:opts.voice,silent:true,alts:opts.alts})},()=>{setNotice(t.locNo)},{timeout:12000,maximumAge:600000})}
 }

 /** Live microphone level drives the orb (a CSS variable, eased each frame: no React re-render per frame). */
 function stopMeter(){if(fake.current){cancelAnimationFrame(fake.current.raf);fake.current=null;orb.current?.style.setProperty('--lvl','0')}const m=meter.current;if(!m)return;cancelAnimationFrame(m.raf);m.stream.getTracks().forEach(tr=>tr.stop());void m.ctx.close().catch(()=>{});meter.current=null;orb.current?.style.setProperty('--lvl','0')}
 function startMeter(stream:MediaStream){
  try{const Ctx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;const ctx=new Ctx();const an=ctx.createAnalyser();an.fftSize=512;ctx.createMediaStreamSource(stream).connect(an);
   const buf=new Uint8Array(an.fftSize);let level=0;
   const tick=()=>{an.getByteTimeDomainData(buf);let sum=0;for(let i=0;i<buf.length;i++){const x=(buf[i]-128)/128;sum+=x*x}const target=Math.min(1,Math.sqrt(sum/buf.length)*5);level+=(target-level)*(target>level?.35:.12);
    orb.current?.style.setProperty('--lvl',level.toFixed(3));if(meter.current)meter.current.raf=requestAnimationFrame(tick)};
   meter.current={stream,ctx,raf:requestAnimationFrame(tick)};
  }catch{stream.getTracks().forEach(tr=>tr.stop())}
 }
 /** Phones and Safari: speech recognition needs the microphone to itself, so the orb pulses with the words heard instead. */
 function startPulse(){const s={level:0,raf:0};const tick=()=>{s.level*=.93;orb.current?.style.setProperty('--lvl',s.level.toFixed(3));s.raf=requestAnimationFrame(tick)};s.raf=requestAnimationFrame(tick);fake.current=s}
 const bump=()=>{if(fake.current)fake.current.level=Math.min(1,fake.current.level+.6)};
 /** Asks the browser for the microphone (its own prompt appears the first time); explains when it can't. */
 async function micAccess():Promise<MediaStream|null>{
  if(!window.isSecureContext){setPerm('insecure');return null}
  if(!navigator.mediaDevices?.getUserMedia){setPerm('unsupported');return null}
  try{return await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}
  catch(e){const n=(e as DOMException).name;setPerm(n==='NotAllowedError'||n==='SecurityError'||n==='PermissionDeniedError'?'denied':'unsupported');return null}
 }
 /** Mic: listen, show the words as they come, and ask when the visitor stops speaking. */
 async function listen(){
  if(voice==='listening'){stopNow.current();return}
  if(voice==='speaking'){setVoice('idle');return}
  const Rec=recognitionClass();if(!Rec){setPerm('unsupported');return}
  try{const st=await navigator.permissions?.query({name:'microphone' as PermissionName});if(st?.state==='denied'){setPerm('denied');return}if(st?.state==='prompt'&&perm===null){setPerm('ask');return}}catch{}
  const stream=await micAccess();if(!stream)return;
  setPerm(null);setNotice('');
  if(platform==='desktop')startMeter(stream);else{stream.getTracks().forEach(tr=>tr.stop());startPulse()}
  const rec=new Rec();rec.lang=VOICE[vlang].rec;rec.interimResults=true;rec.maxAlternatives=5;heard.current='';alts.current=[];
  // Pauses are normal (Hindi and Bengali speakers often pause mid-sentence), so a pause never ends the turn early.
  // Desktop listens continuously: up to 8 s for the first word, then it ends after ~2.6 s of quiet.
  // Phones hear one phrase per session (Android repeats words in continuous mode), so after a pause with words already
  // heard the mic quietly starts again and adds on; it only sends after ~1.6 s with nothing new, or a tap on the orb.
  const longForm=platform==='desktop';rec.continuous=longForm;
  let quiet:ReturnType<typeof setTimeout>|undefined,grace:ReturnType<typeof setTimeout>|undefined;
  let base='',rounds=0,gotNew=false,closing=false,retried=false,again=false;
  const hush=()=>{if(!longForm)return;clearTimeout(quiet);quiet=setTimeout(()=>{closing=true;rec.stop()},heard.current.trim()?2600:8000)};hush();
  stopNow.current=()=>{closing=true;clearTimeout(grace);clearTimeout(quiet);try{rec.stop()}catch{}};
  // Cancel / close / switch language: end the turn and drop what was heard (no auto-continue, nothing sent).
  dropNow.current=()=>{closing=true;heard.current='';clearTimeout(grace);clearTimeout(quiet);try{rec.abort()}catch{}};
  // The recogniser's other guesses go to the server too; it keeps the one it understands best.
  rec.onresult=e=>{let text='';for(let i=0;i<e.results.length;i++)text+=e.results[i][0].transcript;
   heard.current=fixHeard((base?base+' ':'')+text.trim());setDraft(heard.current);bump();hush();
   if(text.trim()){gotNew=true;clearTimeout(grace)}
   const lastR=e.results[e.results.length-1];if(lastR?.isFinal){let head=base?base+' ':'';for(let i=0;i<e.results.length-1;i++)head+=e.results[i][0].transcript;const guesses:string[]=[];for(let k=1;k<lastR.length;k++)guesses.push((head+lastR[k].transcript).trim());alts.current=[...new Set(guesses.map(fixHeard).filter(Boolean))]}};
  // The microphone was already granted above, so a refusal here on iPhone/iPad means Dictation is switched off.
  // A late start ("no speech" before the visitor began talking) gets one quiet second try before any message;
  // "no speech" after words were heard just means they have finished.
  rec.onerror=e=>{const err=e.error;
   if(err==='no-speech'&&heard.current.trim()){closing=true;return}
   if(err==='no-speech'&&!retried&&!heard.current.trim()){retried=true;again=true;return}
   if(err==='aborted')return;
   closing=true;
   if(err==='not-allowed'||err==='service-not-allowed')setPerm(!window.isSecureContext?'insecure':platform==='ios'?'dictation':'denied');else if(err==='no-speech')setNotice(t.noSpeech);else if(err==='audio-capture')setNotice(t.noMicFound);else if(err==='network')setNotice(t.voiceNet)};
  const finish=()=>{clearTimeout(quiet);clearTimeout(grace);stopMeter();recog.current=null;stopNow.current=()=>{};dropNow.current=()=>{};const said=heard.current.trim();if(said){setVoice('thinking');void ask(said,{voice:true,alts:alts.current})}else setVoice('idle')};
  rec.onend=()=>{
   if(again){again=false;try{rec.start();hush();return}catch{}}
   // Phones: a pause after some words. Listen again for a moment; carry on if they keep talking.
   if(!longForm&&!closing&&heard.current.trim()&&rounds<6){rounds++;base=heard.current.trim();gotNew=false;
    try{rec.start();grace=setTimeout(()=>{if(!gotNew){closing=true;try{rec.abort()}catch{finish()}}},1600);return}catch{}}
   finish()};
  recog.current=rec;setDraft('');setVoice('listening');
  try{rec.start()}catch{stopMeter();setVoice('idle')}
 }
 const cancelVoice=()=>{dropNow.current();stopMeter();setVoice('idle');setDraft('');inputRef.current?.focus()};
 const platform:'desktop'|'safari'|'ios'|'android'=typeof navigator==='undefined'?'desktop':/iPhone|iPad|iPod/.test(navigator.userAgent)?'ios':/Android/.test(navigator.userAgent)?'android':/Safari/.test(navigator.userAgent)&&!/Chrome|Chromium|Edg/.test(navigator.userAgent)?'safari':'desktop';
 function reset(){dropNow.current();stopMeter();setVoice('idle');setPerm(null);agentState.current={};coords.current=null;setMessages([welcomeOf(vlang)]);setRevealed(new Set([0]));try{sessionStorage.removeItem(storageKey)}catch{}inputRef.current?.focus()}
 /** Voice language: what the mic listens for and the reply language. Remembered on this device. */
 function pickLang(l:VLang){if(l===vlang)return;dropNow.current();stopMeter();setVoice('idle');setVlang(l);setNotice(VOICE[l].picked);try{localStorage.setItem('udayan-assistant-lang',l)}catch{}}
 const leave=()=>{if(matchMedia('(max-width: 650px)').matches)setOpen(false)};
 const last=messages[messages.length-1];
 const canListen=typeof window!=='undefined'&&!!recognitionClass();

 return <>
  {open&&<section className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title">
   <header className="assistant-head"><img src={LOGO_DARK} alt=""/><div><strong id="assistant-title">Udayan Assistant</strong><span><i aria-hidden="true"/>{t.online}</span></div>
    <button className="assistant-icon" onClick={reset} disabled={typing} aria-label="Start a new conversation" title="New conversation"><RotateCcw size={16}/></button>
    <button className="assistant-icon" onClick={()=>{setOpen(false);launcherRef.current?.focus()}} aria-label="Close assistant"><X size={18}/></button></header>
   <div className="assistant-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
    {messages.map(m=><Fragment key={m.id}>
     <div className={'assistant-msg '+m.role}>{m.role==='assistant'&&<img className="assistant-avatar" src={LOGO_DARK} alt=""/>}<div className="assistant-bubble">{m.role==='assistant'?<Reply text={m.content} animate={!!m.fresh&&!reducedMotion()} onDone={()=>setRevealed(r=>r.has(m.id)?r:new Set(r).add(m.id))}/>:<p>{m.voice&&<Mic size={12} className="assistant-voice-tag" aria-label="spoken"/>}{m.content}</p>}</div></div>
     {m.role==='assistant'&&revealed.has(m.id)&&(m.shows?.length||m.links?.length||(m===last&&(m.related?.length||m.chips?.length)))?<div className="assistant-extras">
      {m.shows?.length?<div className="assistant-shows">{m.shows.map(s=><ShowResult key={s.url+s.start+s.title} s={s} bn={bn} onLeave={leave}/>)}</div>:null}
      {m.links?.length?<div className="assistant-links">{m.links.map(l=>l.external?<a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.label}<ArrowUpRight size={13}/></a>:<Link key={l.href} href={l.href} onClick={leave}>{l.label}<ArrowUpRight size={13}/></Link>)}</div>:null}
      {m===last&&m.chips?.length?<div className="assistant-chips">{m.chips.map(c=><button key={c.label+c.send} onClick={()=>void ask(c.send)} disabled={typing}>{c.label}</button>)}</div>:null}
      {m===last&&m.related?.length?<div className="assistant-related"><span>{m.id===0?t.popular:t.related}</span>{m.related.map(q=><button key={q} onClick={()=>void ask(q)} disabled={typing}>{q}</button>)}</div>:null}
     </div>:null}
    </Fragment>)}
    {typing&&<div className="assistant-msg assistant"><img className="assistant-avatar" src={LOGO_DARK} alt=""/><div className="assistant-bubble assistant-typing" aria-label="Udayan Assistant is typing"><span/><span/><span/></div></div>}
   </div>
   {notice&&<p className="assistant-notice" role="status">{notice}</p>}
   {perm&&<div className="assistant-perm" role="alertdialog" aria-labelledby="perm-title">
    <span className="assistant-perm-ico">{perm==='insecure'?<Lock size={22}/>:<MicOff size={22}/>}</span>
    <div><b id="perm-title">{perm==='insecure'?t.insecureTitle:perm==='dictation'?t.dictTitle:t.permTitle}</b>
     {perm==='ask'&&<p>{t.permBody}</p>}
     {perm==='insecure'&&<p>{t.insecureBody}</p>}
     {perm==='unsupported'&&<p>{t.unsupported}</p>}
     {perm==='denied'&&<><p>{t.permBlocked}</p><ol>{t.steps[platform].map(x=><li key={x}>{x}</li>)}</ol></>}
     {perm==='dictation'&&<><p>{t.dictBody}</p><ol>{t.dictSteps.map(x=><li key={x}>{x}</li>)}</ol></>}
     <div className="assistant-perm-acts">{(perm==='ask'||perm==='denied'||perm==='dictation')&&<button type="button" className="assistant-perm-go" onClick={()=>void listen()}><Mic size={15}/>{perm==='ask'?t.permAllow:t.permRetry}</button>}
      <button type="button" className="assistant-perm-no" onClick={()=>{setPerm(null);inputRef.current?.focus()}}><Keyboard size={15}/>{t.keyboard}</button></div></div>
   </div>}
   {voice!=='idle'&&<div className={'assistant-voice is-'+voice} role="status" aria-live="polite">
    <button type="button" ref={orb} className="assistant-orb" onClick={()=>void listen()} aria-label={listening?t.stop:t.tapStop} disabled={voice==='thinking'}><span className="r1"/><span className="r2"/><span className="r3"/>{voice==='speaking'?<Volume2 size={24}/>:<Mic size={24}/>}</button>
    <div className="assistant-voice-text"><b>{voice==='listening'?VOICE[vlang].listening:voice==='thinking'?VOICE[vlang].thinking:VOICE[vlang].speaking}</b><p key={voice}>{voice==='listening'?(draft||`${VOICE[vlang].tryLead} ${example(vlang)}`):voice==='thinking'?`“${draft||heard.current}”`:t.tapStop}</p></div>
    <button type="button" className="assistant-voice-x" onClick={cancelVoice} aria-label={t.keyboard} title={t.keyboard}><Keyboard size={17}/></button>
   </div>}
   <div className={'assistant-langbar'+(voice!=='idle'?' is-hidden':'')}><span id="assistant-lang-l">{VOICE[vlang].label}</span><div className="assistant-lang" role="group" aria-labelledby="assistant-lang-l">{(['en','bn','hi'] as VLang[]).map(l=><button key={l} type="button" lang={l} aria-pressed={vlang===l} title={VOICE[l].name} onClick={()=>pickLang(l)}>{VOICE[l].name}</button>)}</div></div>
   <form className={'assistant-input'+(voice!=='idle'?' is-hidden':'')} onSubmit={e=>{e.preventDefault();void ask(draft)}}>
    <input ref={inputRef} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={500} placeholder={listening?VOICE[vlang].listening:VOICE[vlang].place(live?.example?.film)} aria-label={t.place} readOnly={listening}/>
    {canListen&&<button type="button" className="assistant-mic" onClick={()=>void listen()} aria-label={t.mic} title={t.mic}><Mic size={18}/></button>}
    <button type="submit" disabled={!draft.trim()||typing} aria-label="Send question"><ArrowUp size={18}/></button>
   </form>
   <p className="assistant-note">{t.note}</p>
  </section>}
  <button ref={launcherRef} className={'assistant-launcher'+(open?' is-open':'')} onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={open?'Close Udayan Assistant':'Open Udayan Assistant'}>{open?<X size={24}/>:<MessagesSquare size={24}/>}<span className="assistant-launcher-label">Ask Udayan</span></button>
 </>;
}
