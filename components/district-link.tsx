'use client';
import type {AnchorHTMLAttributes, MouseEvent} from 'react';
import {districtAppLink, isPhone} from '@/lib/district-link';

/**
 * A link to District that opens in a new tab. Given a show's `startsAt` and a seat-layout `href`, a tap on a phone
 * follows District's own app link for that show instead: with the District app installed it opens the seat page in
 * the app, and without it District's link server opens the same seat page on the website. The address is swapped
 * during the tap itself (a genuine tap is what lets a phone open an app) and restored afterwards.
 */
export default function DistrictLink({href, startsAt, children, onClick, ...rest}: {href: string; startsAt?: string} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const app = startsAt && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && isPhone() ? districtAppLink(href, startsAt) : null;
    if (!app) return;
    const link = event.currentTarget;
    link.href = app;
    setTimeout(() => { link.href = href; }, 1000);
  };
  return <a {...rest} href={href} target="_blank" rel="noopener noreferrer" onClick={handle}>{children}</a>;
}
