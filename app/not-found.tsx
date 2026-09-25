import {CinemaLoaderProvider} from '@/components/cinema-preloader';
import SiteShell from '@/components/site-shell';
import NotFoundContent from '@/components/not-found-content';
import {getSiteContent} from '@/lib/server/content';
import {publicContent} from '@/lib/data';
// Unmatched URLs render outside the (site) layout, so this page brings its own header and footer.
export default async function NotFound(){const content=await getSiteContent();return <CinemaLoaderProvider><SiteShell content={publicContent(content)}><NotFoundContent/></SiteShell></CinemaLoaderProvider>}
