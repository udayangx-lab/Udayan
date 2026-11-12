'use client';
import {MotionLink as Link} from '@/components/site-motion';
import {usePathname} from 'next/navigation';
import {useEffect, useState, createContext, useContext} from 'react';
import {ArrowUpRight, Ticket, Menu, X, Phone, Mail, Home, Clapperboard, MapPin} from 'lucide-react';
import {MotionProvider} from '@/components/site-motion';
import {BookingProvider, useBooking, type BookingSelection} from './booking-chooser';
import {LiveListingsProvider} from './live-listings';
import {CinemaPicker} from './cinema-picker';
import {useCinemaLocation} from './use-cinema-location';
import {SiteContentProvider} from './site-content';
import {nav, moreNav, type PublicContent} from '@/lib/data';
import HeaderMore from './header-more';

const CinemaContext = createContext({index: 0, setIndex: (_value: number) => {}});
export const useCinema = () => useContext(CinemaContext);

export function BookingLink({children = 'Book tickets', className = 'button red', 'aria-label': label, ...selection}: BookingSelection & {children?: React.ReactNode; className?: string; 'aria-label'?: string}) {
  const openBooking = useBooking();
  return <button type="button" className={className} aria-label={label} onClick={() => openBooking(selection)}>{children}<ArrowUpRight size={17}/></button>;
}

/** Whether the page has scrolled far enough for the header to float. A small hysteresis stops it flickering at the edge. */
function useFloatingHeader() {
  const [floating, setFloating] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => { frame = 0; setFloating(current => window.scrollY > (current ? 6 : 28)); };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);
  return floating;
}

/** App-style navigation along the bottom of phone screens (shown by CSS at 650px and below). */
function BottomNav({pathname, menuOpen, onMenu}: {pathname: string; menuOpen: boolean; onMenu: () => void}) {
  const openBooking = useBooking();
  const current = (href: string) => pathname === href ? 'page' : undefined;
  return <nav className="bottom-nav" aria-label="Quick navigation">
    <Link href="/" aria-current={current('/')}><Home aria-hidden="true"/>Home</Link>
    <Link href="/movies" aria-current={current('/movies')}><Clapperboard aria-hidden="true"/>Movies</Link>
    <button type="button" className="bottom-book" onClick={() => openBooking()} aria-label="Book tickets"><span className="bottom-book-ring"><Ticket aria-hidden="true"/></span>Book</button>
    <Link href="/contact" aria-current={current('/contact')}><MapPin aria-hidden="true"/>Visit</Link>
    <button type="button" aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={onMenu}>{menuOpen ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}Menu</button>
  </nav>;
}

export default function SiteShell({content, children}: {content: PublicContent; children: React.ReactNode}) {
  const {cinemas} = content;
  const {index, setIndex, status, locate} = useCinemaLocation(cinemas);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const floating = useFloatingHeader();
  useEffect(() => setOpen(false), [pathname]);
  // The menu is a sheet over the page: lock scrolling behind it and let Escape close it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); };
  }, [open]);
  return <SiteContentProvider content={content}><CinemaContext.Provider value={{index, setIndex}}><LiveListingsProvider><BookingProvider cinemaIndex={index}><MotionProvider>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="topbar"><div className="container"><span>{content.announcement}</span><span>{cinemas.map((c, i) => <span key={c.id}>{i > 0 && <i/>}{c.name}</span>)}</span></div></div>
    <header className="header" data-floating={floating}>
      <div className="header-bar">
        <div className="container header-inner">
          <Link href="/" aria-label="Udayan Cinema home" className="brand"><img src="/images/udayancinema-logo.png" alt="Udayan Cinema — entertaining since 1946" width="92" height="76"/></Link>
          <nav className="desktop-nav" aria-label="Main navigation">{nav.map(n => <Link className={pathname === n.href ? 'active' : ''} key={n.href} href={n.href}>{n.label}</Link>)}<HeaderMore key={pathname} pathname={pathname}/></nav>
          <div className="header-actions">
            <CinemaPicker key={pathname} index={index} onChange={setIndex} locationStatus={status} onLocate={locate}/>
            <BookingLink className="button red header-book"><Ticket size={17}/>Book tickets</BookingLink>
            <button className="menu-toggle icon-button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button>
          </div>
        </div>
      </div>
    </header>
    <main id="main">{children}</main>
    <footer>
      <div className="container footer-main">
        <div className="footer-brand"><Link href="/" className="footer-wordmark">UDAYAN<span>CINEMA</span></Link><p>Great stories. Shared memories.<br/>Your cinema, since 1946.</p><a href={'mailto:' + content.contactEmail}><Mail size={16}/>{content.contactEmail}</a></div>
        <div><h3>Explore</h3><Link href="/movies">Now showing</Link><a href="/movies?tab=upcoming">Coming soon</a><Link href="/experience">The experience</Link><Link href="/gallery">Gallery</Link><Link href="/hooghly-river">Along the Hooghly</Link></div>
        <div><h3>More at Udayan</h3><Link href="/about">Our story</Link><Link href="/dpd-cafe">DPD Café</Link><Link href="/advertisement">Advertise with us</Link><Link href="/career">Careers</Link><Link href="/patron-feedback">Patron feedback</Link></div>
        <div className="footer-cinemas"><h3>Find your Udayan</h3>{cinemas.map(c => <div key={c.id}><Link href="/contact">{c.name}<ArrowUpRight size={15}/></Link><a href={'tel:+91' + c.phone}><Phone size={14}/>+91 {c.phone}</a></div>)}</div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} Udayan Cinema. All rights reserved.</span><span>Made for the love of cinema.</span></div>
    </footer>
    {/* The menu sheet and its scrim sit outside the header so the glass effect's backdrop filter cannot capture them. */}
    <button type="button" className="mobile-scrim" aria-label="Close menu" tabIndex={-1} hidden={!open} onClick={() => setOpen(false)}/>
    <div className="mobile-menu-shell" data-open={open} aria-hidden={!open} inert={!open}>
      <div className="mobile-menu-content">
        <nav id="mobile-menu" className="mobile-nav" aria-label="Mobile navigation">
          <div className="mobile-nav-head"><span className="eyebrow">UDAYAN CINEMA</span><button type="button" className="icon-button" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20}/></button></div>
          {[{href: '/', label: 'Home'}, ...nav, ...moreNav].map(n => <Link key={n.href} href={n.href} aria-current={pathname === n.href ? 'page' : undefined} onClick={() => setOpen(false)}>{n.label}<ArrowUpRight size={18}/></Link>)}
          <div className="mobile-nav-cinemas">{cinemas.map(c => <a key={c.id} href={'tel:+91' + c.phone}><Phone size={15}/><span><b>{c.name}</b>+91 {c.phone}</span></a>)}</div>
          <BookingLink/>
        </nav>
      </div>
    </div>
    <BottomNav pathname={pathname} menuOpen={open} onMenu={() => setOpen(!open)}/>
  </MotionProvider></BookingProvider></LiveListingsProvider></CinemaContext.Provider></SiteContentProvider>;
}
