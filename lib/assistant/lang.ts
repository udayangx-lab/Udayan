/**
 * Language understanding for Udayan's own assistant (no outside AI service).
 * Customers write or speak English, Bengali or Hindi: in Bengali or Devanagari script, or in Latin letters
 * ("kal sham 7 baje", "ajke rate", "do ticket chahiye"). `understand()` rewrites any of these into one plain
 * English form ("tomorrow evening 7 oclock", "2 tickets") that the booking agent reads. Names (films, towns,
 * cinemas) are matched separately by sound with `translit()` and `skeleton()`, so "রামায়ণ", "रामायण" and
 * "Ramayan" all find "Ramayana".
 */
export type Lang='en'|'bn'|'hi';

const BN_DIGITS='০১২৩৪৫৬৭৮৯',HI_DIGITS='०१२३४५६७८९';
export const toAscii=(s:string)=>s.replace(/[০-৯]/g,d=>String(BN_DIGITS.indexOf(d))).replace(/[०-९]/g,d=>String(HI_DIGITS.indexOf(d)));
export const BENGALI=/[ঀ-৿]/,DEVANAGARI=/[ऀ-ॿ]/;

/* ---------------- script to Latin, for matching names by sound ---------------- */
const TR:Record<string,string>={
 // Bengali
 'ক':'k','খ':'kh','গ':'g','ঘ':'gh','ঙ':'ng','চ':'ch','ছ':'ch','জ':'j','ঝ':'jh','ঞ':'n','ট':'t','ঠ':'th','ড':'d','ঢ':'dh','ণ':'n','ত':'t','থ':'th','দ':'d','ধ':'dh','ন':'n','প':'p','ফ':'f','ব':'b','ভ':'bh','ম':'m','য':'j','র':'r','ল':'l','শ':'sh','ষ':'sh','স':'s','হ':'h','ড়':'r','ঢ়':'r','য়':'y','ৎ':'t','ং':'ng','ঃ':'h','ঁ':'',
 'অ':'o','আ':'a','ই':'i','ঈ':'i','উ':'u','ঊ':'u','ঋ':'ri','এ':'e','ঐ':'oi','ও':'o','ঔ':'ou','া':'a','ি':'i','ী':'i','ু':'u','ূ':'u','ৃ':'ri','ে':'e','ৈ':'oi','ো':'o','ৌ':'ou','্':'','ৗ':'',
 // Devanagari
 'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'n','ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n','प':'p','फ':'f','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','ळ':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h',
 'क़':'k','ख़':'kh','ग़':'g','ज़':'z','ड़':'r','ढ़':'r','फ़':'f','य़':'y',
 'अ':'a','आ':'a','इ':'i','ई':'i','उ':'u','ऊ':'u','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au','ऑ':'o','ऍ':'e','ा':'a','ि':'i','ी':'i','ु':'u','ू':'u','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au','ॉ':'o','ॅ':'e','ं':'n','ँ':'n','ः':'h','्':'',
};
const NUKTA:Record<string,string>={'ড':'r','ঢ':'r','য':'y','ड':'r','ढ':'r','ज':'z','फ':'f','क':'k','ख':'kh','ग':'g','य':'y'};
const isCons=(c:string)=>{const n=c.codePointAt(0)||0;return (n>=0x0995&&n<=0x09b9)||(n>=0x09dc&&n<=0x09df)||(n>=0x0915&&n<=0x0939)||(n>=0x0958&&n<=0x095f)};
/** Bengali or Devanagari to rough Latin: "কলকাতা" → "kolkata", "दुर्गापुर" → "durgapur". Latin text passes through. */
export function translit(s:string){
 // Bengali writes the English "a" of cat/Avengers as অ্যা or ক্যা: read it as a vowel, not a "y".
 s=s.normalize('NFC').replace(/অ্যা|এ্যা/g,'আ').replace(/\u09cd\u09af(?=\u09be)/g,'');
 const cp=[...s];let out='';
 for(let i=0;i<cp.length;i++){const c=cp[i];let v=TR[c];if(v===undefined){out+=c;continue}
  if(cp[i+1]==='़'||cp[i+1]==='়'){v=NUKTA[c]??v;i++}
  out+=v;
  // A consonant followed by another consonant keeps its inherent vowel ("কলকাতা" → kol-kata).
  if(isCons(c)&&cp[i+1]&&isCons(cp[i+1]))out+=c>='ঀ'?'o':'a';
 }
 return out;
}
export const latin=(s:string)=>s.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export const words=(s:string)=>latin(translit(s)).split(' ').filter(Boolean);
/** Consonant skeleton: "Ramayana", "Ramayan", "রামায়ণ" and "रामायण" all become "rmyn". */
export function skeleton(s:string){
 let t=latin(translit(s)).replace(/ph/g,'f').replace(/c(?=[ei])/g,'s').replace(/g(?=[ei])/g,'j').replace(/ck/g,'k').replace(/([bdgkjt])h/g,'$1').replace(/sh|zh/g,'s').replace(/ch/g,'c').replace(/[vw]/g,'b').replace(/q/g,'k').replace(/x/g,'ks').replace(/z/g,'j');
 t=t.replace(/h/g,'').replace(/[aeiou\s]/g,'');return t.replace(/(.)\1+/g,'$1');
}
export function lev(a:string,b:string){if(a===b)return 0;if(Math.abs(a.length-b.length)>3)return 9;const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const tmp=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=tmp}}return row[b.length]}

/** Town names as Hindi speakers write them. */
export const CITY_HI:Record<string,string[]>={Sheoraphuli:['शेवड़ाफुली','शेओड़ाफुली'],Tarakeswar:['तारकेश्वर','तारकेश्‍वर']};
export const cityHi=(c:string)=>CITY_HI[c]?.[0]||c;

/* ---------------- which language the customer is using ---------------- */
const HI_WORDS=new Set('ki me kaise kaisa kahan kitna chahta chahti dekhna hai hain kya kab kal aaj mujhe muje chahiye chahie karna karo kardo karde dikhao batao bataiye wala wali mein ka ke kitne baje raat shaam subah kaunsi konsi kaun chal rahi raha dekhna dekhni hoga milega abhi paas liye ko bhai yaar nayi naya lagi sabhi hum humko hamare mere'.split(' '));
const BN_WORDS=new Set('ki tay tar rate dekhabe cholbe hall e te ache achhe kothay kothai cholche chalche dekhbo dekhte chai lagbe kalke ajke sondhe sondhya bikel dupur sokal korbo kore kono koto kon notun amar ami amake jabo hobe hoy bolo dao nao kache kachhe ekta duto tinte jonno kotay kokhon kemon'.split(' '));
/** The reply language: the script used, else Hinglish/Banglish words, else the language the visitor chose. */
export function detectLang(q:string,hint?:Lang):Lang{
 const bn=(q.match(/[ঀ-৿]/g)||[]).length,hi=(q.match(/[ऀ-ॿ]/g)||[]).length;
 if(bn||hi)return bn>=hi?'bn':'hi';
 let h=0,b=0;for(const w of latin(q).split(' ')){if(HI_WORDS.has(w))h++;if(BN_WORDS.has(w))b++}
 if(h>=2&&h>b)return 'hi';if(b>=2&&b>h)return 'bn';
 return hint||'en';
}

/* ---------------- understanding: everything becomes plain English ---------------- */
const NB='(?<![\\p{L}\\p{M}\\p{N}])',NE='(?![\\p{L}\\p{M}])';
/** Whole-word pattern that works for Bengali and Devanagari too (JavaScript's \b only knows Latin). */
const W=(src:string)=>new RegExp(NB+'(?:'+src.normalize('NFC')+')'+NE,'gu');
const SB='(?:কে|তে|য়|য়ে|য়|য়ে|র|ের|এ|ে|টা|বেলা|বেলায়|বেলায়)?'; // Bengali case endings ("রাতে", "সন্ধ্যায়", "কালকে")
const at=(a:string,b:string)=>'(?:'+a.normalize('NFC')+')'+b;

const MONTHS:[string,string][]=[['जनवरी|জানুয়ারি|জানুয়ারি','jan'],['फ़रवरी|फरवरी|ফেব্রুয়ারি|ফেব্রুয়ারি','feb'],['मार्च|মার্চ','mar'],['अप्रैल|এপ্রিল','apr'],['मई|মে','may'],['जून|জুন','jun'],['जुलाई|জুলাই','jul'],['अगस्त|আগস্ট|অগাস্ট','aug'],['सितंबर|सितम्बर|সেপ্টেম্বর','sep'],['अक्टूबर|অক্টোবর','oct'],['नवंबर|नवम्बर|নভেম্বর','nov'],['दिसंबर|दिसम्बर|ডিসেম্বর','dec']];
const EN_NUM=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const HI_NUM:[string,number][]=[['एक',1],['दो',2],['तीन',3],['चार',4],['पांच|पाँच',5],['छह|छः|छे',6],['सात',7],['आठ',8],['नौ',9],['दस',10],['ग्यारह',11],['बारह',12]];
const BN_NUM:[string,number,boolean][]=[['এক',1,false],['দুই',2,false],['দু',2,true],['তিন',3,false],['চার',4,false],['পাঁচ',5,false],['ছয়|ছয়',6,false],['ছ',6,true],['সাত',7,false],['আট',8,false],['নয়|নয়',9,true],['ন',9,true],['দশ',10,false],['এগারো',11,false],['বারো',12,false]];
const BN_CLS='(টায়|টায়|টার|টাতে|টা|টে|টি|টো|জন|জনের)';
const ROMAN_NUM:Record<string,number>={ek:1,do:2,dui:2,du:2,teen:3,tin:3,char:4,chaar:4,paanch:5,panch:5,pach:5,chhe:6,chhah:6,che:6,choy:6,chhoy:6,saat:7,sat:7,aath:8,aat:8,nau:9,noy:9,das:10,dosh:10,gyarah:11,egaro:11,barah:12,baro:12};
const UNIT='(?=\\s*(?:baje|bje|bajhe|oclock|o clock|tay|tar|ta|te|tickets?|tikit|tiket|seats?|log|logon|logo|jon|people|pm|am)(?![a-z]))';

/** [pattern, replacement] in order: phrases before the single words they contain. */
const RULES:[RegExp,string][]=([
 // greetings, help, starting again
 ['नमस्ते|नमस्कार|प्रणाम|हेलो|हैलो|हाय|নমস্কার|নমস্তে|হ্যালো|হাই|kaise\\s*ho|kemon\\s*acho|kemon\\s*achen|nomoshkar|nomoskar|namoskar','hello'],
 ['तुम\\s*कौन\\s*हो|आप\\s*कौन\\s*(?:हो|हैं)|(?:तुम|आप)\\s*क्या\\s*कर\\s*सकते|তুমি\\s*কে|আপনি\\s*কে|(?:কী|কি)\\s*করতে\\s*পার(?:ো|েন)?|tum\\s*kaun\\s*ho|aap\\s*kaun\\s*ho|tumi\\s*ke|apni\\s*ke','what can you do'],
 ['नई\\s*बुकिंग|फिर\\s*से\\s*शुरू|शुरू\\s*से|নতুন\\s*করে|আবার\\s*শুরু|নতুন\\s*বুকিং|phir\\s*se\\s*shuru|abar\\s*shuru|notun\\s*kore','start over'],
 // "last show", "first show"
 ['आखिरी\\s*शो|आख़िरी\\s*शो|लास्ट\\s*शो|শেষ\\s*শো|লাস্ট\\s*শো|last\\s*show|akhri\\s*show|aakhri\\s*show|sesh\\s*show|shesh\\s*show|late\\s*show','lastshow'],
 ['पहला\\s*शो|फर्स्ट\\s*शो|फ़र्स्ट\\s*शो|প্রথম\\s*শো|ফার্স্ট\\s*শো|first\\s*show|pehla\\s*show|pahla\\s*show|prothom\\s*show|earliest\\s*show','firstshow'],
 // the whole schedule, weeks, coming soon (before the single words they contain)
 ['अगला\\s*शो|अगले\\s*शो|পরের\\s*শো|porer\\s*show|agla\\s*show|agle\\s*show|next\\s*shows?|starting\\s*soon|shuru\\s*hone\\s*wala','next show'],
 ['सबसे\\s*सस्ता|सस्ता|सस्ती|सस्ते|কম\\s*দাম(?:ে|ের)?|সবচেয়ে\\s*সস্তা|সবচেয়ে\\s*সস্তা|সস্তা(?:য়|য়)?|sabse\\s*sasta|sasta|saste|sasti|kom\\s*dam(?:e)?|lowest\\s*price|least\\s*expensive|cheapest|cheap','cheapest'],
 ['ঠিক\\s*আছে|ঠিকাছে|আচ্ছা|ঠিক\\s*হ্যায়|ठीक\\s*है|अच्छा|thik\\s*ache|thik\\s*achhe|theek\\s*hai|thik\\s*hai|accha|achha|acha|okay|ok|alright|perfect','okay'],
 ['কোন\\s*কোন\\s*(?:দিন|তারিখ)'+'|কবে\\s*কবে|সব\\s*শো(?:গুলো)?|सारे\\s*शो|सभी\\s*शो|कौन\\s*कौन\\s*से\\s*दिन|किन\\s*दिनों|कब\\s*कब|kon\\s*kon\\s*din|kab\\s*kab|saare\\s*show|sob\\s*show','which days'],
 ['এই\\s*সপ্তাহে?|এই\\s*হপ্তায়|इस\\s*(?:हफ़्ते|हफ्ते|सप्ताह)|is\\s*hafte|ei\\s*soptahe','this week'],
 ['পরের\\s*সপ্তাহে?|আগামী\\s*সপ্তাহে?|अगले\\s*(?:हफ़्ते|हफ्ते|सप्ताह)|agle\\s*hafte|porer\\s*soptahe|agami\\s*soptahe','next week'],
 ['দিন\\s*পর(?:ে)?|দিন\\s*বাদে|दिन\\s*(?:बाद|में)|din\\s*pore|din\\s*baad','days later'],
 ['আসছে|আসন্ন|শীঘ্রই|মুক্তি\\s*পাবে|রিলিজ\\s*হবে|आने\\s*वाली|आने\\s*वाले|आ\\s*रही|जल्द\\s*(?:ही\\s*)?आ|रिलीज़?\\s*होगी|रिलीज़?\\s*होने|ane\\s*wali|aane\\s*wali|asche|ashche|coming\\s*soon','upcoming'],
 // days
 [at('आज\\s*(?:की\\s*)?रात(?:\\s*को|\\s*में)?|আজ(?:কে)?\\s*রাত',SB)+'|aa?j\\s*(?:ki\\s*)?raa?t|aj(?:ke)?\\s*rate?|tonite|2nite|tonigt|tonihgt','tonight'],
 [at('परसों|पर्सों|পরশু',SB)+'|parson|parso|porshu|porsu|porshudin|day\\s*after\\s*tomorrow','dayaftertomorrow'],
 [at('आगामी\\s*कल|कल|আগামী\\s*কাল|আগামীকাল|কাল',SB)+'|kal|kaal|kalke|kalk|agamikal|tmrw|tmr|tmrrw|tomoro|tomorow|tommorow|tommorrow|tomorrw|2moro|2morrow|tomorro|tommorw|tomarrow|tomrw','tomorrow'],
 [at('आज|আজ',SB)+'|aaj|aj|ajke|aajke|tdy|2day|tday|todya','today'],
 ['अभी|एखन|এখন|এখনই|abhi|ekhon|ekhuni|rightnow','now'],
 [at('वीकेंड|वीकएंड|सप्ताहांत|উইকেন্ড|সপ্তাহান্ত',SB)+'|wknd|weekend','weekend'],
 [at('रविवार|इतवार|রবিবার|রোববার',SB)+'|ravivar|raviwar|itwar|itvar|robibar|robbar|rabibar','sunday'],
 [at('सोमवार|সোমবার',SB)+'|somvar|somwar|sombar|shombar','monday'],
 [at('मंगलवार|মঙ্গলবার',SB)+'|mangalvar|mangalwar|mongolbar|mangalbar','tuesday'],
 [at('बुधवार|বুধবার',SB)+'|budhvar|budhwar|budhbar|budbar','wednesday'],
 [at('गुरुवार|बृहस्पतिवार|वीरवार|বৃহস্পতিবার|বিষ্যুদবার',SB)+'|guruvar|guruwar|brihaspativar|bishudbar|brihospotibar|veervar','thursday'],
 [at('शुक्रवार|শুক্রবার',SB)+'|shukravar|shukrawar|shukrobar|sukrobar|sukravar','friday'],
 [at('शनिवार|শনিবার',SB)+'|shanivar|shaniwar|shonibar|sonibar|shonibaar','saturday'],
 // parts of the day
 [at('सुबह|सवेरे|सुबे|সকাল',SB)+'|subah|subha|savere|sokal|sokale|sakal|mrng|morng|mornin|mornig|morining','morning'],
 [at('दोपहर|দুপুর',SB)+'|dopahar|dopehar|dupahar|dopher|dupur|dupure|aftrnoon|afternon|afternun','afternoon'],
 [at('शाम|सायं|সন্ধ্যা|সন্ধে|বিকেল|বিকাল',SB)+'|shaam|sham|sondhe|sondha|sondhya|sandhya|sondhebela|bikel|bikele|bikal|evng|evning|evenig|evenin','evening'],
 [at('रात|রাত',SB)+'|raat|raate|rater|ratre|nite','night'],
 // where
 ['सब\\s*जगह|हर\\s*जगह|সব\\s*জায়গায়|সব\\s*জায়গায়|সবখানে|sab\\s*jagah|har\\s*jagah|sob\\s*jaygay','everywhere'],
 // more ways to say "near me" (said before the town-word rules see them)
 ['আমার\\s*(?:এলাকায়|এলাকায়|পাড়ায়|পাড়ায়)|আশপাশে|আশে\\s*পাশে|কাছেই|কাছে\\s*পিঠে|পাশেই|এদিকে|এখানে|এই\\s*দিকে|'+
  'सामने\\s*ही|पास\\s*(?:में|मे)|पास\\s*ही|यहीं|यहाँ|यहां|इधर|आस\\s*पास\\s*में|मेरे\\s*(?:इलाके|मोहल्ले|एरिया)\\s*(?:में|मे)?|करीब\\s*में|'+
  'ashe\\s*pashe|ash\\s*pashe|kacha\\s*kachi|kache\\s*pithe|kachei|kachhei|pashei|edike|ekhane|amar\\s*elakay|samne\\s*hi|paas\\s*(?:mein|me|mai)|pass\\s*(?:mein|me)|yahin|yahan|idhar|aas\\s*pass|mere\\s*(?:ilake|area)|'+
  'close\\s*by|around\\s*here|near\\s*here|in\\s*my\\s*(?:area|locality|town|city)|close\\s*to\\s*me|near\\s*my\\s*(?:location|place|home|house)|around\\s*my\\s*(?:place|area)|walking\\s*distance','near me'],
 ['(?:मेरे|हमारे|मुझसे)\\s*(?:आस\\s*)?(?:पास|नज़दीक|नजदीक|करीब|क़रीब)|आस\\s*पास|आसपास|নিকটবর্তী|আমার\\s*(?:কাছে|কাছাকাছি|আশেপাশে)|কাছাকাছি|আশেপাশে|কাছে|पास|नज़दीक|नजदीक|नज़दीकी|नजदीकी|mere\\s*(?:paas|pass|najdik|nazdeek)|hamare\\s*paas|aas\\s*paas|aaspaas|amar\\s*kach?he|kach?he|kachakachi|ashepashe|nazdeek|najdik|nazdik|nazdeeki|nearme|nearst|neareast|nearrest','near me'],
 ['दूसरा|दूसरे|दूसरी|कोई\\s*और|অন্য|onno|dusra|dusre|dusri|koi\\s*aur','another'],
 [at('सिनेमा\\s*हॉल|सिनेमाघर|हॉल|थिएटर|थियेटर|मल्टीप्लेक्स|সিনেমা\\s*হল|সিনেমাহল|প্রেক্ষাগৃহ|থিয়েটার|থিয়েটার|হল',SB)+'|thetre|theatr|theator|hall|halls','cinema'],
 ['सभी|सब|सारे|सारी|সব|সমস্ত|সবগুলো|sabhi|sab|saare|saari|sob|shob','all'],
 ['कभी\\s*भी|किसी\\s*भी\\s*(?:समय|टाइम|वक्त)|কখনও|যেকোনো\\s*সময়|যেকোনো\\s*সময়|যে\\s*কোনও?\\s*সময়|kabhi\\s*bhi|kisi\\s*bhi\\s*time|je\\s*kono\\s*somoy','anytime'],
 // what the customer wants
 ['टिकट(?:ें|ों|स|्स)?|टिकिट|টিকিট|টিকেট|tikit|tiket|tikat|tickt|tickts|tikets|ticets|tickest|tkts?','tickets'],
 ['बुक(?:िंग)?|বুক(?:িং)?|bokking|boking|bookin','book'],
 ['सीट(?:ें|ों)?|সিট|সীট','seats'],
 [at('शो|शोज़|शोज|শো',SB)+'|shw|shws','show'],
 ['देख(?:ना|नी|ने|ूँ|ूं|ेंगे|ें|ो|नी\\s*है|ना\\s*है)|দেখ(?:ব|বো|তে|া|বে|ি|ার)|dekhna|dekhni|dekhne|dekhenge|dekhu|dekhbo|dekhte|dekhi|dekhabo','watch'],
 [at('फ़िल्म(?:ें|ों)?|फिल्म(?:ें|ों)?|मूवी(?:ज़|ज)?|पिक्चर|पिक्चरें|सिनेमा|ছবি|সিনেমা|মুভি|ফিল্ম',SB)+'|filam|filmen|movi|muvi|moovie|moovi|pikchar|picchar|chobi|chhobi|flim|flims','movies'],
 ['चल\\s*(?:रही|रहा|रहे)(?:\\s*(?:है|हैं))?|लगी\\s*(?:है|हुई)|लगी|লেগেছে|চলছে|চলবে|চলতেছে|চলতেছে|chal\\s*(?:rahi|raha|rahe|rhi|rha)(?:\\s*(?:hai|he|h))?|lagi\\s*(?:hai|he)|cholche|cholchhe|chalche|cholbe','playing'],
 ['कितने\\s*बजे|কটায়|কটায়|kitne\\s*baje|kotay|kotai','what time'],
 [at('क्या|कौन\\s*सी|कौन\\s*सा|कौनसी|कौनसा|कौन|कोई|कोन|কী|কি|কোন',SB)+'|কোনটা|কোনো|kya|kaun\\s*si|kaunsi|konsi|kaunsa|konsa|kaun|kon|konta|kono|koi|ki|wat|wht','what'],
 ['नई|नया|नयी|नए|ताज़ा|ताजा|लेटेस्ट|নতুন|নতুনগুলো|notun|nayi|naya|naye|latest','new'],
 // languages
 ['बंगाली|बांग्ला|बंगला|বাংলা|বাঙালি|bengoli|bangali','bengali'],['हिंदी|हिन्दी|হিন্দি','hindi'],['अंग्रेज़ी|अंग्रेजी|इंग्लिश|ইংরেজি|ইংলিশ|angrezi|angreji|ingreji|ingriji','english'],['असमिया|অসমিয়া|অসমিয়া|assamiya|asomiya|ahomiya','assamese'],
 ['तमिल','tamil'],['तेलुगु','telugu'],['मलयालम','malayalam'],['कन्नड़|कन्नड','kannada'],['मराठी','marathi'],['पंजाबी','punjabi'],['भोजपुरी','bhojpuri'],['ओड़िया|उड़िया|ওড়িয়া|ওড়িয়া','odia'],
 // who and what kind
 [at('बच्च(?:ों|े|ा)|परिवार|फैमिली|বাচ্চা|পরিবার|ছোটদের',SB)+'|bacche|bachche|bachon|bacchon|baccha|bachcha|parivar|poribar|chotoder','family'],
 ['कॉमेडी|हास्य|मज़ेदार|मजेदार|हंसी|কমেডি|হাসির|mazedar|majedar|hasir','comedy'],
 ['डरावनी|डरावना|हॉरर|भूत(?:िया|हा)?|ভূতের|ভূত|ভৌতিক|হরর|bhootiya|bhutiya|darawni|daravni|bhuter|bhoot','horror'],
 ['रोमांटिक|प्यार|प्रेम|लव\\s*स्टोरी|রোমান্টিক|প্রেমের','romantic'],
 ['एक्शन|मारधाड़|মারপিট|অ্যাকশন|অ্যাকশান|marpit|maar\\s*dhaad|dhishoom','action'],
 ['थ्रिलर|सस्पेंस|থ্রিলার|সাসপেন্স','thriller'],
 ['जासूसी|रहस्य|मिस्ट्री|গোয়েন্দা|গোয়েন্দা|রহস্য|jasoosi|jasusi|goyenda|goenda|rohosso','mystery'],
 ['पौराणिक|धार्मिक|भक्ति|পৌরাণিক|ভক্তিমূলক|dharmik|pouranik','mythological'],
 ['एनीमेशन|कार्टून|এনিমেশন|অ্যানিমেশন|কার্টুন','animation'],['ड्रामा|ড্রামা','drama'],
 // questions the FAQ answers
 ['ধন্যবাদ|থ্যাংক\\s*ইউ|धन्यवाद|शुक्रिया|थैंक\\s*यू|dhonnobad|dhanyavad|shukriya','thanks'],
 ['3d\\s*(?:চশমা|चश्मा)|3d\\s*chashma|3d\\s*chosma','3d glasses'],
 ['অ্যাপ|এপ|ऐप|एप|app\\s*ache|app\\s*hai','app'],
 ['হারিয়ে|হারিয়ে|ফেলে\\s*এসেছি|খো\\s*गया|खो\\s*गई|छूट\\s*गया|harie|kho\\s*gaya','lost'],
 ['পরিচয়পত্র|পরিচয়পত্র|আইডি|पहचान\\s*पत्र|आईडी|id\\s*card','id proof'],
 ['গিফট|গিফ্ট|गिफ्ट|गिफ़्ट','gift card'],
 ['অভিযোগ|शिकायत|complain|shikayat|obhijog','feedback'],
 ['রিক্লাইনার|रिक्लाइनर','recliner'],
 ['বয়স|বয়স|উম্র|उम्र|umar|boyosh','age'],
 ['গ্রুপ\\s*বুকিং|ग्रुप\\s*बुकिंग|প্রাইভেট\\s*শো|प्राइवेट\\s*शो|পুরো\\s*হল|पूरा\\s*हॉल','group booking'],
 ['খোলে|খোলা\\s*থাকে|बंद\\s*होता|खुलता|खुला\\s*रहता','hours open'],
 ['কাটব|কাটতে|কাটা|কেটে\\s*দাও','book'],
 ['শোয়ের\\s*সময়|শোয়ের\\s*সময়|শো-এর\\s*সময়|শো\\s*টাইম|शो\\s*टाइम|शो\\s*का\\s*समय|show\\s*time','showtimes'],
 ['দেখাও|দেখান|দিখাও|दिखाओ|दिखाइए|बताओ|बताइए|বলো|বলুন','show me'],
 ['চাই|লাগবে|चाहिए|चाहता|चाहती','want'],
 ['रिफंड|रिफ़ंड|पैसे\\s*वापस|রিফান্ড|টাকা\\s*ফেরত|paise\\s*wapas|paisa\\s*wapas|taka\\s*ferot','refund'],
 ['रद्द|कैंसल|ক্যানসেল|ক্যান্সেল|বাতিল|batil','cancel'],
 ['पार्किंग|পার্কিং','parking'],
 ['खाना|खाने|फूड|नाश्ता|पॉपकॉर्न|খাবার|খাওয়া|খাওয়া|পপকর্ন|khana|khane|khabar','food'],
 ['कैफ़े|कैफे|ক্যাফে','cafe'],
 ['पता|एड्रेस|ঠিকানা|thikana','address'],
 ['संपर्क|फ़ोन|फोन|नंबर|যোগাযোগ|ফোন|নম্বর|jogajog|sampark','contact'],
 ['नौकरी|জব|চাকরি|naukri|chakri','job'],
 ['पेमेंट|भुगतान|यूपीआई|পেমেন্ট|ইউপিআই','payment'],
 ['कीमत|दाम|रेट|कितने\\s*(?:का|की|के)|कितना|দাম|কত\\s*টাকা|koto\\s*taka|kitne\\s*(?:ka|ki|ke)|kitna|daam','price'],
 ['ऑफ़र|ऑफर|छूट|डिस्काउंट|অফার|ছাড়|ছাড়','offer'],
 ['व्हीलचेयर|হুইলচেয়ার|হুইলচেয়ার','wheelchair'],
 ['कब|কবে|কখন|kab|kobe|kokhon','when'],
 ['कहाँ|कहां|কোথায়|কোথায়|kahan|kaha|kothay|kothai','where'],
 // filler
 ['plz|pls|please|pleas|plse|pliz|कृपया|প্লিজ|দয়া\\s*করে|দয়া\\s*করে','']
] as [string,string][]).map(([src,to])=>[W(src),to]);

/** Words the agent knows; a near miss of one of these ("tomorow", "evning", "tikcets") is read as it. */
const LEXICON='tomorrow tonight today evening morning afternoon night tickets ticket booking playing showing showtimes showtime cinema cinemas theatre theater movies movie films nearby nearest closest weekend saturday sunday monday tuesday wednesday thursday friday bengali hindi english comedy horror romantic thriller mystery animation family another different around anytime everywhere available latest newest release releases refund parking'.split(' ');

/**
 * Rewrites a message in English, Bengali or Hindi (any script) into plain English for the agent.
 * `keep` holds words that must never be "corrected" (film titles, towns, cinema names).
 */
export function understand(question:string,keep:Set<string>=new Set()){
 let t=toAscii(question.normalize('NFC')).toLowerCase().replace(/[’'`]/g,'').replace(/o\s?clock/g,' oclock ');
 t=t.replace(/[^\p{L}\p{M}\p{N}:.\s/]/gu,' ').replace(/\s+/g,' ');
 // months
 for(const [src,to] of MONTHS)t=t.replace(W(src),to);
 t=t.replace(new RegExp('(\\d{1,2})\\s*(?:'+'तारीख|तारीख़|তারিখ|তারিখে|tarikh|tarik'.normalize('NFC')+')','gu'),'$1th');
 // number words
 t=t.replace(W(EN_NUM.slice(1).join('|')),w=>String(EN_NUM.indexOf(w)));
 for(const [src,n] of HI_NUM)t=t.replace(W(src),String(n));
 for(const [src,n,needs] of BN_NUM)t=t.replace(new RegExp((NB+'(?:'+src+')'+BN_CLS+(needs?'':'?')+NE).normalize('NFC'),'gu'),(_m,cls?:string)=>`${n}${cls?' '+cls:''}`);
 t=t.replace(/(?<![a-z])(duto|duti|duta|tinte|tinta|tinti|charte|charta)(?![a-z])/g,w=>w.startsWith('du')?'2':w.startsWith('tin')?'3':'4');
 t=t.replace(new RegExp('(?<![a-z])('+Object.keys(ROMAN_NUM).join('|')+')'+UNIT,'g'),w=>String(ROMAN_NUM[w]));
 // half past, quarter past, quarter to (Hindi and Bengali say these a lot)
 const pre=(src:string,fn:(h:number)=>string)=>{t=t.replace(new RegExp(NB+'(?:'+src.normalize('NFC')+')\\s*(\\d{1,2})(?![\\d:])','gu'),(_m,h:string)=>fn(+h))};
 pre('साढ़े|साढे|सारे|সাড়ে|সাড়ে|sadhe|saadhe|saade|sade|sare|shade|half\\s*past',h=>`${h}:30`);
 pre('सवा|সোয়া|সোয়া|sawa|sava|swa|soa|soya|quarter\\s*past',h=>`${h}:15`);
 pre('पौने|পৌনে|paune|pone|poune|quarter\\s*to',h=>`${h===1?12:h-1}:45`);
 t=t.replace(W('डेढ़|डेढ|দেড়|দেড়|dedh|derh'),'1:30').replace(W('ढाई|আড়াই|আড়াই|dhai|arai|adai'),'2:30');
 t=t.replace(new RegExp('(\\d{1,2}):(\\d{2})\\s*(?:টায়|টার|টা|टा)?'.normalize('NFC'),'gu'),(_m,h:string,mm:string)=>`${h}:${mm} `);
 // "2 টা টিকিট", "दो टिकट", "3 jon" → "2 tickets"
 t=t.replace(new RegExp('(\\d{1,2})\\s*(?:টা|টি|টো|টে|ta|ti|to|te)?\\s*(?:tickets?|tikit|tiket|tikat|tkts?|tix|seats?|টিকিট|টিকেট|সিট|সীট|टिकट(?:ें|ों|स)?|टिकिट|सीट(?:ें|ों)?|लोग(?:ों)?|people|persons?|logon|logo|log|jon|জনের|জন)(?![a-z])'.normalize('NFC'),'gu'),'$1 tickets ');
 // "7টায়", "7 बजे", "7 baje" → "7 oclock"
 t=t.replace(new RegExp('(\\d{1,2}(?::\\d{2})?)\\s*(?:টায়|টায়|টার|টাতে|টা|টে|বাজে|বাজ|बजे|बज|baje|bje|bajhe|bajey|tay|tar|ta)'.normalize('NFC')+NE,'gu'),'$1 oclock');
 // "around 7", "7 बजे के आसपास", "৭টা নাগাদ"
 t=t.replace(new RegExp(NB+'(?:'+'करीब|क़रीब|लगभग|तकरीबन|প্রায়|প্রায়|আন্দাজ|lagbhag|karib|kareeb|takriban|takreeban|praay|andaj|approx|approximately'.normalize('NFC')+')(?=\\s*\\d)','gu'),'around');
 t=t.replace(new RegExp('oclock\\s*(?:'+'के\\s*आसपास|के\\s*करीब|के\\s*क़रीब|নাগাদ|এর\\s*কাছাকাছি|কাছাকাছি|নাগাত|ke\\s*aas\\s*paas|ke\\s*aaspaas|ke\\s*karib|nagad|nagaad'.normalize('NFC')+')','gu'),'oclock around');
 // "after 6" / "৬টার পরে" / "6 बजे के बाद", "before 9" / "৯টার আগে" / "9 से पहले"
 t=t.replace(new RegExp('(\\d{1,2}(?::\\d{2})?\\s*(?:oclock|am|pm)?)\\s*(?:'+'के\\s*बाद|के\\s*बाद\\s*से|ke\\s*baad|ke\\s*bad|এর\\s*পরে|পরে|er\\s*pore|pore|onwards|or\\s*later|or\\s*after'.normalize('NFC')+')(?![\\p{L}\\p{M}])','gu'),'$1 after ');
 t=t.replace(new RegExp('(\\d{1,2}(?::\\d{2})?\\s*(?:oclock|am|pm)?)\\s*(?:'+'से\\s*पहले|se\\s*pehle|se\\s*pahle|এর\\s*আগে|আগে|er\\s*age|or\\s*earlier'.normalize('NFC')+')(?![\\p{L}\\p{M}])','gu'),'$1 before ');
 // keywords
 for(const [re,to] of RULES)t=t.replace(re,to?` ${to} `:' ');
 // spelling slips, unless the word belongs to a film or a place
 t=t.replace(/\s+/g,' ').trim().split(' ').map(w=>{
  if(w.length<6||!/^[a-z]+$/.test(w)||keep.has(w)||LEXICON.includes(w))return w;
  const limit=w.length>=8?2:1;const sorted=[...w].sort().join('');let best=w,d=limit+1;
  for(const x of LEXICON){if(x.length<6)continue;const e=lev(w,x);const swap=e===2&&x.length===w.length&&[...x].sort().join('')===sorted?1:e;if(swap<d){d=swap;best=x}}return best;
 }).join(' ');
 return t;
}

/* ---------------- speech: how a reply should sound ---------------- */
const BN_DIG='০১২৩৪৫৬৭৮৯';
const bnDigits=(x:string)=>x.replace(/[0-9]/g,d=>BN_DIG[+d]);
/**
 * The reply as it should be spoken: no list bullets or emoji, at most three list items, times said the way people say
 * them ("সন্ধ্যা ৭টা ২০", "शाम 7 बजकर 20 मिनट"), prices in taka or rupees, Bengali digits for a Bengali voice.
 */
export function spoken(text:string,lang:Lang){
 const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);let items=0;const out:string[]=[];
 for(const l of lines){if(l.startsWith('• ')){items++;if(items<=3)out.push(l.slice(2).replace(/\s+—\s+/,', ')+(lang==='en'?'.':'।'));else if(items===4)out.push(lang==='bn'?'এবং আরও কয়েকটি।':lang==='hi'?'और कुछ और।':'and a few more.')}else out.push(l)}
 let t=out.join(' ').replace(/[“”"]/g,'').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').replace(/\s*·\s*/g,', ');
 t=t.replace(/₹\s?(\d+)/g,(_m,n)=>lang==='bn'?`${n} টাকা`:lang==='hi'?`${n} रुपये`:`${n} rupees`);
 if(lang==='bn')t=t.replace(/(\d{1,2}):(\d{2})(?:\s?(AM|PM))?/g,(_m,h,mm)=>`${+h}টা${mm==='00'?'':` ${+mm}`}`);
 if(lang==='hi')t=t.replace(/(\d{1,2}):(\d{2})(?:\s?(AM|PM))?/g,(_m,h,mm)=>mm==='00'?`${+h} बजे`:`${+h} बजकर ${+mm} मिनट`);
 // Each voice reads only its own script: name the other languages in it.
 if(lang==='bn')t=t.replace(/हिंदी/g,'হিন্দি');
 if(lang==='hi')t=t.replace(/বাংলা/g,'बांग्ला');
 if(lang==='bn')t=bnDigits(t);
 t=t.replace(/\s+/g,' ').trim();
 // Keep it short: whole sentences up to about 420 characters.
 if(t.length>420){const cut=t.slice(0,420);const end=Math.max(cut.lastIndexOf('।'),cut.lastIndexOf('. '),cut.lastIndexOf('? '));t=end>120?cut.slice(0,end+1):cut}
 return t;
}
