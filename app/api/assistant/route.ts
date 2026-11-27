import {z} from 'zod';
import {body,clientIp,json,sameOrigin} from '@/lib/assistant/request';
import {siteAnswer} from '@/lib/assistant/knowledge';
import {assistantData} from '@/lib/assistant/data';
import {agent,helpReply,starters} from '@/lib/assistant/agent';
import {detectLang,understand} from '@/lib/assistant/lang';

// Udayan's own assistant: the booking agent and the FAQ engine run here on our server, on our own data. No outside AI service.
const state=z.object({film:z.string().max(200).optional(),cinemaId:z.string().max(40).optional(),town:z.string().max(200).optional(),day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),times:z.array(z.number().int().min(0).max(1500)).max(4).optional(),part:z.enum(['morning','afternoon','evening','night']).optional(),count:z.number().int().min(1).max(20).optional(),after:z.number().int().min(0).max(1800).optional(),before:z.number().int().min(0).max(1800).optional(),asked:z.enum(['film','cinema','day']).nullable().optional()}).partial();
const hints=z.object({cinemaId:z.string().max(40).optional(),lat:z.number().min(-90).max(90).optional(),lng:z.number().min(-180).max(180).optional(),lang:z.enum(['en','bn','hi']).optional()}).partial();
const conversation=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(1200)})).min(1).max(12),state:state.optional(),hints:hints.optional(),alternatives:z.array(z.string().trim().min(1).max(300)).max(4).optional()}).refine(v=>v.messages[v.messages.length-1].role==='user');
// Chat throttling is kept in memory: a database round trip per message made replies slow. 40 messages per 15 minutes per visitor.
const hits:Map<string,number[]>=((globalThis as {udayanChatHits?:Map<string,number[]>}).udayanChatHits??=new Map());
function allow(req:Request){const ip=clientIp(req);const now=Date.now(),recent=(hits.get(ip)||[]).filter((t:number)=>now-t<900000);if(recent.length>=40)return false;recent.push(now);hits.set(ip,recent);if(hits.size>5000)hits.clear();return true}
// The chat window's opening suggestions, from the films playing now.
export async function GET(){return json(starters(await assistantData()))}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Request origin rejected.'},403);
 let input;try{input=conversation.safeParse(await body(req))}catch{return json({error:'Please send a shorter message.'},400)}
 if(!input.success)return json({error:'Please type a question.'},400);
 if(!allow(req))return json({error:'You have sent several messages in a short time. Please try again in a few minutes.'},429);
 const history=input.data.messages,question=history[history.length-1].content;
 const data=await assistantData();
 // Finding or booking a show: the booking agent (it keeps the conversation's details in `state`).
 // Speech recognisers return a few guesses for what was said; the one the agent understands best wins.
 const prev=input.data.state||{},hints=input.data.hints||{};
 const lang=detectLang(question,hints.lang);
 const knowledge=siteAnswer(question,understand(question),data.content,lang,prev.cinemaId || hints.cinemaId);
 const siteReply=()=>json({reply:knowledge!.text,links:[knowledge!.link],related:[],shows:[],chips:[],state:prev,askLocation:false,source:'site'});
 if(knowledge?.direct)return siteReply();
 let booking=agent(question,prev,hints,data);
 for(const alt of input.data.alternatives||[]){if(alt===question)continue;const r=agent(alt,prev,hints,data);if((r.score||0)>(booking.score||0)+1)booking=r}
 if(booking.handled)return json({reply:booking.reply,shows:booking.shows,chips:booking.chips,links:booking.links,related:[],state:booking.state,askLocation:booking.askLocation||false,source:'agent'});
 if(knowledge)return siteReply();
 const help=helpReply(data,lang,Date.now());
 const fallback=(lang==='bn'?'এই প্রশ্নের নিশ্চিত তথ্য পাইনি।':lang==='hi'?'इस सवाल की पुष्टि नहीं हो पाई।':'I couldn’t find a confirmed answer on the Udayan site.');
 return json({reply:fallback,links:[{label:lang==='bn'?'যোগাযোগ':lang==='hi'?'संपर्क करें':'Contact Udayan',href:'/contact'}],related:[],shows:[],chips:help.chips,state:prev,askLocation:false,source:'site'});
}
