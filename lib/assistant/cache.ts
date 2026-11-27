/**
 * In-memory stale-while-revalidate: callers get the last value immediately and a refresh runs in the
 * background once it is older than freshMs. Only the very first load waits, and at most waitMs before
 * the fallback is used. The remote database can take several seconds per read, so no request should wait on it.
 */
type Entry<T>={value?:T;at:number;pending?:Promise<T>};
// Kept on globalThis so every route bundle in the server process shares one cache.
const store=((globalThis as {udayanSwr?:Map<string,Entry<unknown>>}).udayanSwr??=new Map());
export async function swr<T>(key:string,freshMs:number,load:()=>Promise<T>,{waitMs=Infinity,fallback}:{waitMs?:number;fallback?:()=>T}={}):Promise<T>{
 const entry=(store.get(key)??{at:0}) as Entry<T>;store.set(key,entry);
 const refresh=()=>entry.pending??=load().then(value=>{entry.value=value;entry.at=Date.now();return value}).finally(()=>{entry.pending=undefined});
 if(entry.value!==undefined){if(Date.now()-entry.at>freshMs)refresh().catch(()=>{});return entry.value}
 const first=refresh();
 if(!fallback||waitMs===Infinity)return first;
 return Promise.race([first,new Promise<T>(resolve=>setTimeout(()=>resolve(fallback()),waitMs))]).catch(()=>fallback());
}
