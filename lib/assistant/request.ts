export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(!origin)return false;try{const url=new URL(origin);return url.host===req.headers.get('host')&&(url.protocol==='https:'||((process.env.NODE_ENV==='development'||process.env.ALLOW_HTTP_ORIGIN==='1')&&url.protocol==='http:'))}catch{return false}}
export function clientIp(req:Request){const h=req.headers;const ip=h.get('x-nf-client-connection-ip')||h.get('x-vercel-forwarded-for')?.split(',')[0]||h.get('cf-connecting-ip')||h.get('x-real-ip')||h.get('x-forwarded-for')?.split(',')[0];return ip?.trim()||(process.env.NODE_ENV==='development'?'local':'unknown')}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});}
export async function body(req:Request){
 if(!req.headers.get('content-type')?.includes('application/json'))throw Error('Invalid body');
 const reader=req.body?.getReader();if(!reader)throw Error('Missing body');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>40000){await reader.cancel();throw Error('Body too large')}chunks.push(value)}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
