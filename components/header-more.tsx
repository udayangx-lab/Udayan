'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {ArrowUpRight, ChevronDown} from 'lucide-react';
import {MotionLink as Link} from './site-motion';
import {moreNav} from '@/lib/data';

export default function HeaderMore({pathname}: {pathname: string}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {if (!root.current?.contains(event.target as Node)) setOpen(false);};
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={root} className="header-more" data-open={open}
    onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);}}
    onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault(); setOpen(false); trigger.current?.focus();}}}>
    <button ref={trigger} type="button" className={moreNav.some(item => item.href === pathname) ? 'active' : ''}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      More <ChevronDown size={14} aria-hidden="true"/>
    </button>
    <div id={id} className="header-more-panel" data-open={open} inert={!open}>
      <span>MORE AT UDAYAN</span>
      {moreNav.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}
        onClick={() => setOpen(false)}>{item.label}<ArrowUpRight size={16} aria-hidden="true"/></Link>)}
    </div>
  </div>;
}
