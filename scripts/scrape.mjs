import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
const origin='https://udayancinema.com';
const pages=['','about-us/','gallery/','dpd-cafe/','hooghly-river/','advertisement/','career/','contact-us/','patron-feedback/'];
const result={scrapedAt:new Date().toISOString(),source:origin,pages:[],assets:[],colors:[]};
const assetUrls=new Set(); const cssUrls=new Set();
for(const slug of pages){
 try{
 const response=await fetch(origin+'/'+slug);
 if(!response.ok)throw new Error('HTTP '+response.status);
 const html=await response.text();
 const $=cheerio.load(html); $('script,style,noscript').remove();
 const links=$('a[href]').map((_,e)=>({text:$(e).text().trim().replace(/\s+/g,' '),url:$(e).attr('href')})).get();
 const images=$('img[src]').map((_,e)=>({url:$(e).attr('src'),alt:$(e).attr('alt')||''})).get();
 for(const im of images) if(im.url.startsWith(origin+'/wp-content/uploads/')) assetUrls.add(im.url);
 $('link[rel="stylesheet"]').each((_,e)=>{const u=$(e).attr('href');if(u?.includes('/uploads/'))cssUrls.add(u.startsWith('//')?'https:'+u:u)});
 result.pages.push({slug:slug||'home',title:$('title').text(),text:$('body').text().replace(/\s+/g,' ').trim(),headings:$('h1,h2,h3,h4,h5').map((_,e)=>$(e).text().trim()).get(),links,images});
 await fs.writeFile('research/'+(slug.replaceAll('/','')||'home')+'.html',html);
 console.log('Page:',slug||'home');
 }catch(e){console.log('Failed page',slug,e.message)}
}
await Promise.all([...cssUrls].map(async(url,i)=>{try{const css=await(await fetch(url)).text();await fs.writeFile('research/styles-'+i+'.css',css);result.colors.push({url,colors:[...new Set(css.match(/#[0-9a-fA-F]{3,8}\b/g)||[])]});for(const m of css.matchAll(/url\(["']?(https:\/\/udayancinema.com\/wp-content\/uploads\/[^)'"\s]+)/g)) assetUrls.add(m[1]);}catch{}}));
const urls=[...assetUrls]; let index=0;
await Promise.all(Array.from({length:6},async()=>{while(index<urls.length){const url=urls[index++]; const name=decodeURIComponent(new URL(url).pathname.split('/').pop());try{const r=await fetch(url);if(!r.ok)throw Error(r.status);await fs.writeFile(path.join('public/images',name),Buffer.from(await r.arrayBuffer()));result.assets.push({source:url,local:'/images/'+name});}catch(e){console.log('Failed asset',name,e.message)}}}));
await fs.writeFile('research/scraped-content.json',JSON.stringify(result,null,2));
console.log('Saved',result.pages.length,'pages and',result.assets.length,'assets');
