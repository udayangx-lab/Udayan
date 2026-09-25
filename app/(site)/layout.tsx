import {CinemaLoaderProvider} from '@/components/cinema-preloader';
import SiteShell from '@/components/site-shell';
import {getSiteContent} from '@/lib/server/content';
import {publicContent} from '@/lib/data';
export default async function SiteLayout({children}:{children:React.ReactNode}){const content=await getSiteContent();return <CinemaLoaderProvider><SiteShell content={publicContent(content)}>{children}</SiteShell></CinemaLoaderProvider>}
