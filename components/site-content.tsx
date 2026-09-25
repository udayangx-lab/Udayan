'use client';

import {createContext, useContext, type ReactNode} from 'react';
import {defaultContent, publicContent, type PublicContent} from '@/lib/data';

const Context = createContext<PublicContent>(publicContent(defaultContent));
export const useSiteContent = () => useContext(Context);
export function SiteContentProvider({content, children}: {content: PublicContent; children: ReactNode}) {
  return <Context.Provider value={content}>{children}</Context.Provider>;
}
