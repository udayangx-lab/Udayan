'use client';
import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import type {ListingsFeed} from '@/lib/listings';
const Context = createContext<{data: ListingsFeed | null; unavailable: boolean; now: number}>({data: null, unavailable: false, now: 0});
export const useLiveListings = () => useContext(Context);
export function LiveListingsProvider({children}: {children: ReactNode}) {
  const [data, setData] = useState<ListingsFeed | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    async function refresh() {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12000);
      setNow(Date.now());
      try {
        const response = await fetch('/data/live-listings.json', {cache: 'no-store', signal: controller.signal});
        if (!response.ok) throw new Error('Listings unavailable');
        const next = await response.json();
        if (next.version !== 1 || !next.venues || !Object.values(next.venues).every(venue => Array.isArray((venue as {movies?: unknown}).movies)) || (next.upcoming !== undefined && !Array.isArray(next.upcoming))) throw new Error('Invalid listings');
        if (active) { setData(next); setUnavailable(false); }
      } catch { if (active) setUnavailable(true); }
      finally { clearTimeout(timeout); }
    }
    void refresh();
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearInterval(timer); controller?.abort(); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  return <Context.Provider value={{data, unavailable, now}}>{children}</Context.Provider>;
}
