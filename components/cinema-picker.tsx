'use client';

import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import {Check, ChevronDown, MapPin} from 'lucide-react';
import {cinemas} from '@/lib/data';

export function CinemaPicker({index, onChange}: {index: number; onChange: (index: number) => void}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    // Wait for the hidden panel to become focusable after its styles update.
    const frame = requestAnimationFrame(() => options.current[index]?.focus({preventScroll: true}));
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [open, index]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const current = options.current.findIndex(option => option === document.activeElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown': next = (current + 1) % cinemas.length; break;
      case 'ArrowUp': next = (current - 1 + cinemas.length) % cinemas.length; break;
      case 'Home': next = 0; break;
      case 'End': next = cinemas.length - 1; break;
      default: return;
    }
    event.preventDefault();
    options.current[next]?.focus();
  }

  return (
    <div className="cinema-picker" ref={root} data-open={open}
      onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);}}>
      <button ref={trigger} type="button" className="cinema-picker-trigger"
        aria-label={`Select cinema: ${cinemas[index].name}`} aria-haspopup="menu"
        aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            if (open) options.current[index]?.focus({preventScroll: true});
          }
        }}>
        <span className="cinema-picker-pin"><MapPin size={17} aria-hidden="true"/></span>
        <span>{cinemas[index].name}</span>
        <ChevronDown className="cinema-picker-chevron" size={15} aria-hidden="true"/>
      </button>
      <div className="cinema-picker-panel" data-open={open} inert={!open} aria-hidden={!open}>
        <p className="cinema-picker-caption" id={`${menuId}-label`}>Choose your cinema</p>
        <div id={menuId} role="menu" aria-labelledby={`${menuId}-label`} onKeyDown={navigate}>
          {cinemas.map((cinema, optionIndex) => (
            <button type="button" role="menuitemradio" aria-checked={index === optionIndex}
              className="cinema-picker-option" key={cinema.id} tabIndex={-1}
              ref={element => {options.current[optionIndex] = element;}}
              onClick={() => {onChange(optionIndex); close();}}>
              <span className="cinema-option-pin"><MapPin size={18} aria-hidden="true"/></span>
              <span className="cinema-option-copy"><strong>{cinema.name}</strong>
                <span>{cinema.id === 'sheoraphuli' ? 'Grand Trunk Road · Since 1946' : 'Silvision Mall · Since 2025'}</span>
              </span>
              {index === optionIndex && <Check className="cinema-option-check" size={17} aria-hidden="true"/>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
