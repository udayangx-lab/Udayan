// Only the public editorial model enters this index. Each passage links to the page that publishes it.
import type {SiteContent, PageSlug} from '../data';
import type {Lang} from './lang';
import {formDefinitions} from '../forms';

const stop = new Set('a an and are as at be by can cinema cinemas do does for from has have how i in is it its me my of on or our the their there to udayan we what when where which who with you your please tell about'.split(' '));
const tokens = (text:string) => [...new Set((text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{M}\d]+/gu)||[]).filter(w=>w.length>1&&!stop.has(w)))];
const display = (s:string) => s.replace(/\*/g,'').trim();

export function siteAnswer(question:string, understood:string, c:SiteContent, lang:Lang, preferred?:string) {
  const q = (question+' '+understood).toLowerCase().normalize('NFC');
  const local = (en:string,bn:string,hi:string) => lang==='bn'?bn:lang==='hi'?hi:en;
  const result = (page:PageSlug, text:string, direct=true) => ({text:display(text),direct,link:{label:c.pages[page].title,href:'/'+page}});
  const named = c.cinemas.filter(v=>q.includes(v.name.toLowerCase()) || (v.id==='sheoraphuli'?/sheorafuli|শেওড়াফুলি|शेवड़ाफुली/:/tarakeshwar|tarkeshwar|তারকেশ্বর|तारकेश्वर/).test(q));
  const venues = named.length?named:c.cinemas.filter(v=>!preferred||v.id===preferred);
  const location = venues.length?venues:c.cinemas;
  const venueLines = (field:'address'|'phone'|'parking') => location.map(v=>v.name+' · '+(field==='phone'?'+91 ':'')+v[field]).join('\n');
  if (/refund|cancel|deducted|payment failed|lost (?:ticket|item)/.test(q))
    return result('contact',local('For an existing booking, check the terms on your District ticket. The cinema team can help with booking enquiries.','বুকিং হয়ে থাকলে District টিকিটের শর্তগুলি দেখুন। সাহায্যের জন্য হলের সঙ্গে যোগাযোগ করুন।','अपनी District टिकट की शर्तें देखें। बुकिंग संबंधी सहायता के लिए सिनेमा टीम से संपर्क करें।')+'\n'+venueLines('phone'));
  if (/wheelchair|opening hours|opening time|pet policy|outside food|vegan|allerg|gluten|halal|vegetarian/.test(q))
    return result('contact',local('The site does not confirm that detail. Please check with your cinema before visiting.','এই তথ্যটি সাইটে নিশ্চিত করা নেই। যাওয়ার আগে হলে ফোন করুন।','वेबसाइट पर इसकी पुष्टि नहीं है। आने से पहले सिनेमा से पूछें।')+'\n'+venueLines('phone'));
  const landmark=c.cinemas.find(v=>q.includes(v.tagline.toLowerCase()));
  if (landmark && /where|which|inside|address|located/.test(q)) return result('contact',landmark.name+' · '+landmark.address);
  if (/\bpark\b|parking|two.wheeler|four.wheeler|car park|পার্কিং|पार्किंग/.test(q)) return result('contact',venueLines('parking'));
  if (/\b(phone|call|number|contact|email)\b/.test(q) && !/ticket number/.test(q)) return result('contact',venueLines('phone')+'\n'+c.contactEmail);
  if (/\b(address|directions?|reach|located)\b|ঠিকানা|पता/.test(q) && !/cafe|café/.test(q)) return result('contact',venueLines('address'));
  const entries:{page:PageSlug;text:string;tags:string;direct:boolean}[]=[];
  const add=(page:PageSlug,text:string,tags:string,direct=false)=>{if(text.trim())entries.push({page,text,tags,direct})};
  for(const f of c.contact.faq) add('contact',f.answer,f.question,true);
  add('about',c.about.text,'founder founded owner history opened heritage family oldest who started who owns');
  for(const m of c.about.timeline) add('about',m.year+' · '+m.text,m.year+' '+m.title);
  add('dpd-cafe',c.cafe.text,'dpd café cafe coffee food lounge restaurant');
  add('advertisement',c.advertising.text+'\n'+c.advertising.formats.map(f=>'• '+f.text).join('\n'),'advertise advertisement advertising branding campaigns standees');
  add('experience',c.experience.features.map(f=>'• '+f.label+' · '+f.text).join('\n'),'facilities amenities experience');
  for(const f of c.experience.features) add('experience',f.label+' · '+f.text,f.label+' '+f.title);
  for(const [key,d] of Object.entries(c.documents)) {
    const page=key==='hooghly'?'hooghly-river':'advertisement';
    add(page,[d.title,d.intro.replaceAll('{pages}',String(d.pages.length)),d.credit].filter(Boolean).join('\n'),key==='hooghly'?'hooghly river journal collection curator':'brochure published advertising rates rate card');
    for(const p of d.pages) add(page,p.alt,d.title);
  }
  for(const [slug,page] of Object.entries(c.pages)) add(slug as PageSlug,page.description,page.title+' '+slug);
  add('career',c.pages.career.description,'jobs hiring apply vacancy recruitment careers');
  add('patron-feedback',c.pages['patron-feedback'].description,'complaints feedback review suggestions');
  add('gallery',c.pages.gallery.description,'pictures photos gallery');
  for(const photo of c.gallery.photos) add('gallery',photo.alt,'');
  for(const photo of c.cafe.photos) add('dpd-cafe',photo.alt,'');
  add('about',c.announcement+' '+c.home.heritageText,'heritage announcement');
  add('experience',c.home.featureText,c.home.featureHeading);
  for(const [page,options] of [['contact',c.formOptions.contactTopic],['advertisement',c.formOptions.advertisingFormats],['dpd-cafe',c.formOptions.cafeEnquiry]] as const)
    add(page,options.map(o=>o.label).join(' · '),'enquiry options '+page);
  for (const form of Object.values(formDefinitions)) {
    const page=form.page.replace(/^\//,'') as PageSlug;
    if(!c.pages[page]) continue;
    for (const field of form.fields) if(field.hint) add(page,field.label+' · '+field.hint,form.label+' '+field.label);
  }
  const words=tokens(q);
  const corpus=entries.map(e=>({...e,keys:tokens(e.tags),body:tokens(e.text)}));
  const score=(w:string)=>Math.log(1+entries.length/(1+corpus.filter(e=>e.keys.includes(w)||e.body.includes(w)).length));
  let best:typeof corpus[number]|undefined, top=0;
  for(const e of corpus){
    const hits=words.filter(w=>e.keys.includes(w)||e.body.includes(w));
    const points=hits.reduce((n,w)=>n+score(w)*(e.keys.includes(w)?2:0.65),0);
    if(points>top && (hits.some(w=>e.keys.includes(w)) || hits.length>=2)){best=e;top=points}
  }
  if(!best || top<4) return null;
  const faqExact=best.direct && (question.trim().toLowerCase()===best.tags.toLowerCase() || /how (?:do i|to) book|without.*ticket|without.*movie|ticket prices|menu|offers/.test(q));
  return result(best.page,local('','ওয়েবসাইটের তথ্য (ইংরেজিতে)\n','वेबसाइट की जानकारी (अंग्रेज़ी में)\n')+best.text,faqExact);
}
