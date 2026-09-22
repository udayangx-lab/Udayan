import type {Metadata} from 'next';
import SiteShell from '@/components/site-shell';
import './globals.css';
export const metadata:Metadata={title:{default:'Udayan Cinema | A little closer to the movies',template:'%s | Udayan Cinema'},description:'Experience cinema at Udayan, entertaining since 1946. Explore movies, Dolby 7.1 sound, luxury seating and DPD Café in Sheoraphuli and Tarakeswar.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><SiteShell>{children}</SiteShell></body></html>}
