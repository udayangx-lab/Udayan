'use client';
import {createContext, useContext, useEffect, useRef, useState, type ReactNode, type MouseEvent} from 'react';
import {usePathname} from 'next/navigation';
import {ArrowUpRight, MapPin, Ticket, X} from 'lucide-react';
import {useSiteContent} from './site-content';
import {dateLabel} from '@/lib/listings';
export type BookingSelection = {cinemaIndex?: number; movie?: string; language?: string; date?: string; time?: string; upcoming?: boolean};
const Context = createContext<(selection?: BookingSelection) => void>(() => {});
export const useBooking = () => useContext(Context);
export function BookingProvider({children, cinemaIndex}: {children: ReactNode; cinemaIndex: number}) {
  const {cinemas} = useSiteContent();
  const [selection, setSelection] = useState<BookingSelection | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const closing = useRef(false);
  const exit = useRef<Animation | null>(null);
  function close() {
    const element = dialog.current;
    if (!element?.open || closing.current) return;
    const finish = () => { element.close(); setSelection(null); closing.current = false; exit.current?.cancel(); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    closing.current = true;
    exit.current = element.animate([{opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform}, {opacity: 0, transform: 'translateY(8px) scale(.98)'}], {duration: 150, easing: 'ease-in', fill: 'forwards'});
    void exit.current.finished.then(finish).catch(() => {});
  }
  useEffect(() => () => exit.current?.cancel(), []);
  useEffect(() => { exit.current?.cancel(); closing.current = false; dialog.current?.close(); setSelection(null); }, [pathname]);
  useEffect(() => {
    if (!selection) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [selection]);
  const venue = cinemas[selection?.cinemaIndex ?? cinemaIndex] || cinemas[0];
  const date = selection?.date;
  const district = venue.district + (date ? `?fromdate=${date}` : '');
  const bookmyshow = venue.booking + (date ? date.replaceAll('-', '') : '');
  const outside = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  };
  return <Context.Provider value={request => setSelection({...request, cinemaIndex: request?.cinemaIndex ?? cinemaIndex})}>
    {children}
    <dialog className="booking-dialog" ref={dialog} aria-labelledby="booking-title" aria-describedby="booking-description" onCancel={event => { event.preventDefault(); close(); }} onClick={outside}>
      <button className="icon-button booking-close" aria-label="Close booking options" onClick={close}><X size={20}/></button>
      <span className="booking-ticket"><Ticket size={25}/></span>
      <span className="eyebrow">YOUR MOVIE DAY STARTS HERE</span>
      <h2 id="booking-title">Choose your<br/>booking platform.</h2>
      <p className="booking-venue"><MapPin size={16}/>Udayan {venue.name}</p>
      {selection?.movie && <div className="booking-selection"><strong>{selection.movie}</strong><span>{[selection.language, date ? dateLabel(date) : '', selection.time].filter(Boolean).join(' · ') || (selection.upcoming ? 'Coming soon' : 'Check available shows')}</span></div>}
      <p id="booking-description">{selection?.upcoming ? 'Advance bookings may not be open yet. Check your preferred platform for availability.' : 'Continue to your preferred platform to select your show and seats.'}</p>
      <div className="booking-platforms">
        <a className="booking-platform" href={district} target="_blank" rel="noopener noreferrer" onClick={close} aria-label={`Continue with District for Udayan ${venue.name}`}><span className="platform-logo district-logo"><img src="/brands/district.png" alt="District" width="160" height="64"/></span><span>Book on District<ArrowUpRight size={19}/></span></a>
        <a className="booking-platform" href={bookmyshow} target="_blank" rel="noopener noreferrer" onClick={close} aria-label={`Continue with BookMyShow for Udayan ${venue.name}`}><span className="platform-logo"><img src="/images/Bookmyshow-logoid.png" alt="BookMyShow" width="160" height="40"/></span><span>Book on BookMyShow<ArrowUpRight size={19}/></span></a>
      </div>
      <p className="booking-footnote">{selection?.movie ? 'Select the same movie and show on the booking platform. ' : ''}Prices and availability are confirmed there. Opens in a new tab.</p>
    </dialog>
  </Context.Provider>;
}
