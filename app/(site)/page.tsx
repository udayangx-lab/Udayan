import type {Metadata} from 'next';
import YearCounter from '@/components/year-counter';
import {MotionLink as Link} from '@/components/site-motion';
import {ArrowUpRight, ArrowRight, MapPin} from 'lucide-react';
import {BookingLink} from '@/components/site-shell';
import {MovieBrowser} from '@/components/movie-browser';
import HeroBooking from '@/components/hero-booking';
import ContentIcon from '@/components/content-icon';
import ShapeDivider from '@/components/shape-divider';
import {Lines} from '@/components/rich-text';
import {getSiteContent} from '@/lib/server/content';

export async function generateMetadata(): Promise<Metadata> {
  const {home} = await getSiteContent();
  return {title: {absolute: home.seoTitle}, description: home.seoDescription};
}

export default async function Home() {
  const {cinemas, home: h} = await getSiteContent();
  // A Bengali greeting is shown large; an English small heading as a label.
  const bengali = /[ঀ-৿]/.test(h.heroEyebrow);
  const intro = <>
    <p className={bengali ? 'hero-accent bengali' : 'hero-accent'} lang={bengali ? 'bn' : undefined}>{h.heroEyebrow}<span aria-hidden="true"/></p>
    <h1><Lines text={h.heroHeading}/></h1>
    <p className="hero-lede"><Lines text={h.heroText}/></p>
  </>;
  const stats = [
    {value: <YearCounter year={Number(h.heritageYear) || 1946}/>, label: 'Entertaining since'},
    {value: cinemas.length, label: cinemas.length === 1 ? 'Cinema' : 'Cinemas'},
    {value: '7.1', label: 'Dolby surround'},
  ];
  // The ticker repeats its items so the loop never shows a gap; the copies are hidden from assistive technology.
  const ticker = (hidden: boolean) => <ul className="ticker-list" aria-hidden={hidden || undefined}>
    {[...h.strip, ...h.strip].map((item, i) => <li key={item.id + i}><ContentIcon name={item.icon} aria-hidden="true"/>{item.text}</li>)}
  </ul>;
  return <>
    <section className="hero">
      <div className="hero-decor" aria-hidden="true"><span className="hero-orb one"/><span className="hero-orb two"/><span className="hero-grid"/></div>
      <div className="container"><HeroBooking intro={intro} stats={stats}/></div>
    </section>

    <section className="ticker" aria-label="Highlights">
      <div className="ticker-track">{ticker(false)}{ticker(true)}</div>
    </section>

    <section className="band band-soft movies-band">
      <ShapeDivider shape="wave" side="top"/>
      <div className="container section movies-section">
        <div className="section-head"><div><span className="eyebrow">{h.moviesEyebrow}</span><h2>{h.moviesHeading}</h2></div>
          <Link className="text-link" href="/movies">All movies<ArrowUpRight size={18}/></Link></div>
        <MovieBrowser compact/>
      </div>
      <ShapeDivider shape="curve" side="bottom"/>
    </section>

    <section className="experience-feature container">
      <div className="feature-photo"><img src={h.featureImage} alt={h.featureImageAlt} loading="lazy"/>{h.featureNote && <span className="image-note glass">{h.featureNote}</span>}</div>
      <div className="feature-copy glass"><span className="eyebrow">{h.featureEyebrow}</span><h2><Lines text={h.featureHeading}/></h2><p>{h.featureText}</p>
        <Link className="button dark" href="/experience">{h.featureButton}<ArrowUpRight size={18}/></Link></div>
    </section>

    <section className="band band-red venues-band">
      <ShapeDivider shape="arch" side="top"/>
      <span className="band-rings" aria-hidden="true"/>
      <div className="section container">
        <div className="section-head"><div><span className="eyebrow light">{h.venuesEyebrow}</span><h2>{h.venuesHeading}</h2></div>
          <Link className="text-link on-dark" href="/contact">Plan your visit<ArrowUpRight size={18}/></Link></div>
        <div className="venue-grid">{cinemas.map((c, i) => <article className="venue-card" key={c.id}>
          <div className="venue-image"><img src={c.image} alt={'Udayan Cinema ' + c.name} loading="lazy"/><span className="venue-since glass">SINCE <YearCounter year={Number(c.since)}/></span></div>
          <div className="venue-info glass">
            <div><span className="eyebrow">UDAYAN CINEMA</span><h3>{c.name}</h3><p><MapPin size={16}/>{c.address}</p></div>
            <BookingLink className="circle-link" cinemaIndex={i} aria-label={'Book tickets at ' + c.name + ' on District'}><span className="sr-only">Book tickets</span></BookingLink>
          </div>
        </article>)}</div>
      </div>
      <ShapeDivider shape="wave" side="bottom"/>
    </section>

    <section className="cafe-banner container">
      <img src={h.cafeImage} alt="" loading="lazy"/>
      <div className="cafe-panel glass"><span className="eyebrow">{h.cafeEyebrow}</span><h2><Lines text={h.cafeHeading}/></h2><p><Lines text={h.cafeText}/></p>
        <Link className="button red" href="/dpd-cafe">{h.cafeButton}<ArrowUpRight size={18}/></Link></div>
    </section>

    <section className="band band-blush heritage-band">
      <ShapeDivider shape="tilt" side="top"/>
      <div className="heritage container">
        <span className="heritage-year"><YearCounter year={Number(h.heritageYear)}/><span className="heritage-caption">{h.heritageCaption}</span></span>
        <div><span className="eyebrow">{h.heritageEyebrow}</span><h2><Lines text={h.heritageHeading}/></h2><p>{h.heritageText}</p>
          <Link className="text-link" href="/about">{h.heritageLink}<ArrowRight size={18}/></Link></div>
      </div>
    </section>
  </>;
}
