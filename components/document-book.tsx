'use client';

import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import {ArrowLeft, ArrowRight, BookOpen, Download, Grid2X2, Maximize2, X, ZoomIn, ZoomOut} from 'lucide-react';

type Page = {src: string; alt: string};
type Turn = {from: number; to: number; direction: 'next' | 'previous'};

export default function DocumentBook({pages, title, aspectRatio}: {pages: Page[]; title: string; aspectRatio: string}) {
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [thumbnails, setThumbnails] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const busy = useRef(false);
  const request = useRef(0);
  const gesture = useRef<{x: number; y: number} | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const enlargeButton = useRef<HTMLButtonElement>(null);
  const thumbnailStrip = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => () => {request.current++;}, []);
  useEffect(() => {
    if (!turn) return;
    const timer = setTimeout(() => {
      setPage(turn.to); setTurn(null); busy.current = false;
    }, 680);
    return () => clearTimeout(timer);
  }, [turn]);
  useEffect(() => {
    for (const next of [page - 1, page + 1]) {
      if (!pages[next]) continue;
      const image = new Image(); image.src = pages[next].src;
    }
    const active = thumbnailStrip.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (active && thumbnailStrip.current) {
      thumbnailStrip.current.scrollTo({left: active.offsetLeft - thumbnailStrip.current.clientWidth / 2 + active.clientWidth / 2, behavior: 'instant'});
    }
  }, [page, pages, thumbnails]);
  useEffect(() => {
    if (!enlarged) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => {document.body.style.overflow = previous;};
  }, [enlarged]);

  async function go(next: number) {
    if (busy.current || next === page || next < 0 || next >= pages.length) return;
    busy.current = true; setLoading(true); setError('');
    const token = ++request.current;
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        const timer = setTimeout(() => {image.onload = null; image.onerror = null; reject(new Error('Image timeout'));}, 12000);
        image.onload = () => {clearTimeout(timer); resolve();};
        image.onerror = () => {clearTimeout(timer); reject(new Error('Image unavailable'));};
        image.src = pages[next].src;
      });
      if (token !== request.current) return;
      setLoading(false);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || enlarged) {
        setPage(next); busy.current = false;
      } else setTurn({from: page, to: next, direction: next > page ? 'next' : 'previous'});
    } catch {
      if (token !== request.current) return;
      setLoading(false); busy.current = false;
      setError('This page could not load. Please try again.');
    }
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if ((event.target as HTMLElement).matches('select,input,textarea')) return;
    const target = {ArrowLeft: page - 1, ArrowRight: page + 1, Home: 0, End: pages.length - 1}[event.key];
    if (target === undefined) return;
    event.preventDefault(); void go(target);
  }
  function close() {dialog.current?.close(); setEnlarged(false); setZoomed(false); enlargeButton.current?.focus();}
  const visiblePage = turn ? (turn.direction === 'next' ? turn.to : turn.from) : page;
  const turningPage = turn ? (turn.direction === 'next' ? turn.from : turn.to) : page;
  const controls = <>
    <button type="button" className="icon-button" aria-label="Previous page" disabled={page === 0 || !!turn || loading} onClick={() => void go(page - 1)}><ArrowLeft size={19}/></button>
    <span className="book-pagination" role="status" aria-live="polite">Page <strong>{page + 1}</strong> of {pages.length}</span>
    <button type="button" className="icon-button" aria-label="Next page" disabled={page === pages.length - 1 || !!turn || loading} onClick={() => void go(page + 1)}><ArrowRight size={19}/></button>
  </>;

  return <section className="document-book" aria-label={title} aria-roledescription="page viewer" onKeyDown={keyboard}>
    <div className="book-toolbar"><span><BookOpen size={18} aria-hidden="true"/>{title}</span>
      <button ref={enlargeButton} type="button" className="book-enlarge" disabled={!!turn || loading} onClick={() => setEnlarged(true)}><Maximize2 size={16}/>Enlarge page</button>
    </div>
    <div className="book-desk">
      <div className="book-sheet" tabIndex={0} aria-label="Use left and right arrow keys to turn pages" style={{aspectRatio, maxWidth: `min(940px, calc(65dvh * (${aspectRatio})))`}}
        onTouchStart={event => {gesture.current = {x: event.touches[0].clientX, y: event.touches[0].clientY};}}
        onTouchEnd={event => {
          const start = gesture.current; gesture.current = null;
          if (!start) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) void go(page + (dx < 0 ? 1 : -1));
        }}>
        <img className="book-page" src={pages[visiblePage].src} alt={pages[visiblePage].alt} draggable={false}/>
        {turn && <div className="book-turn" data-direction={turn.direction} aria-hidden="true">
          <img src={pages[turningPage].src} alt="" draggable={false}/><span/>
        </div>}
      </div>
    </div>
    <div className="book-controls"><div className="book-arrows">{controls}</div>
      <label className="book-jump">Go to page<select value={page} disabled={!!turn || loading} onChange={event => void go(Number(event.target.value))}>
        {pages.map((_,index) => <option key={index} value={index}>{index + 1}</option>)}
      </select></label>
      <button type="button" className="book-thumbnails-toggle" aria-expanded={thumbnails} aria-controls={`${id}-pages`} onClick={() => setThumbnails(!thumbnails)}><Grid2X2 size={16}/>{thumbnails ? 'Hide pages' : 'All pages'}</button>
    </div>
    <p className="book-help" role="status">{error || (loading ? 'Loading page…' : 'Swipe or use the arrows to turn the pages.')}</p>
    {thumbnails && <div id={`${id}-pages`} className="book-thumbnails" ref={thumbnailStrip}>
      {pages.map((item,index) => <button type="button" key={item.src} aria-label={`Go to page ${index + 1}`} aria-current={page === index ? 'page' : undefined}
        disabled={!!turn || loading} onClick={() => void go(index)}><img src={item.src} alt="" loading="lazy"/><span>{String(index + 1).padStart(2,'0')}</span></button>)}
    </div>}
    <dialog ref={dialog} className="book-dialog" aria-label={`${title} — enlarged page`} onCancel={event => {event.preventDefault(); close();}}
      onClick={event => {if (event.target === event.currentTarget) close();}} onClose={() => setEnlarged(false)}>
      {enlarged && <><div className="book-dialog-heading"><span>{title}</span><button type="button" className="icon-button" aria-label="Close enlarged page" onClick={close}><X size={20}/></button></div>
        <div className="book-zoom-frame" data-zoomed={zoomed}><img src={pages[page].src} alt={pages[page].alt}/></div>
        <div className="book-dialog-footer"><div className="book-arrows">{controls}</div><div className="book-reading-tools">
          <button type="button" className="book-enlarge" aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}>{zoomed ? <ZoomOut size={17}/> : <ZoomIn size={17}/>}<span>{zoomed ? 'Zoom out' : 'Zoom in'}</span></button>
          <a href={pages[page].src} download className="book-download"><Download size={16}/>Download page</a></div></div></>}
    </dialog>
  </section>;
}
