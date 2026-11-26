'use client';

import {useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import {ArrowLeft, MapPin} from 'lucide-react';
import {mapSize, neighbours, project, westBengal} from '@/lib/wb-map';
import type {Cinema} from '@/lib/data';
import type {Position} from './use-cinema-location';

export type MapView = 'state' | 'hooghly';
type Bounds = {north: number; south: number; west: number; east: number};

// What each view frames, in degrees.
const frames: Record<MapView, Bounds> = {
  state: {north: 27.3, south: 21.45, west: 85.8, east: 89.95},
  hooghly: {north: 23.02, south: 22.5, west: 87.7, east: 88.56},
};
// The Hooghly (Bhagirathi) from the Farakka offtake to the sea, plotted by hand along the towns on its banks.
const river = ([[24.8, 87.92], [24.45, 88.07], [24.18, 88.27], [23.95, 88.22], [23.62, 88.13], [23.41, 88.37], [23.22, 88.37], [22.97, 88.42], [22.9, 88.395],
  [22.86, 88.37], [22.8, 88.345], [22.765, 88.343], [22.7, 88.355], [22.64, 88.355], [22.585, 88.345], [22.545, 88.3], [22.5, 88.19], [22.47, 88.1], [22.3, 88.1],
  [22.19, 88.19], [21.95, 88.12], [21.65, 88.05]] as const).map(([lat, lon]) => project(lat, lon));
const riverPath = 'M' + river.map(([x, y], i) => {
  if (!i) return `${x} ${y}`;
  // Catmull-Rom through the plotted points, as cubic curves.
  const p0 = river[Math.max(0, i - 2)], p1 = river[i - 1], p3 = river[Math.min(river.length - 1, i + 1)];
  return `C${p1[0] + (x - p0[0]) / 6} ${p1[1] + (y - p0[1]) / 6} ${x - (p3[0] - p1[0]) / 6} ${y - (p3[1] - p1[1]) / 6} ${x} ${y}`;
}).join('');
// Orientation labels. `view` limits a label to one view.
const places: {name: string; lat: number; lon: number; view?: MapView; kind?: 'region' | 'city' | 'river'}[] = [
  {name: 'WEST BENGAL', lat: 23.25, lon: 87.25, view: 'state', kind: 'region'},
  {name: 'JHARKHAND', lat: 23.95, lon: 86.2, view: 'state', kind: 'region'}, {name: 'BIHAR', lat: 25.85, lon: 86.9, view: 'state', kind: 'region'},
  {name: 'ODISHA', lat: 21.75, lon: 86.35, view: 'state', kind: 'region'}, {name: 'BANGLADESH', lat: 24.05, lon: 89.45, view: 'state', kind: 'region'},
  {name: 'Darjeeling', lat: 27.04, lon: 88.26, view: 'state'}, {name: 'Siliguri', lat: 26.73, lon: 88.4, view: 'state'}, {name: 'Malda', lat: 25.0, lon: 88.14, view: 'state'},
  {name: 'Durgapur', lat: 23.52, lon: 87.31, view: 'state'}, {name: 'Kharagpur', lat: 22.33, lon: 87.32, view: 'state'}, {name: 'Digha', lat: 21.63, lon: 87.51, view: 'state'},
  {name: 'Kolkata', lat: 22.5726, lon: 88.3639, view: 'hooghly'},
  {name: 'Chandannagar', lat: 22.8671, lon: 88.3674, view: 'hooghly'}, {name: 'Chinsurah', lat: 22.9089, lon: 88.3967, view: 'hooghly'},
  {name: 'Singur', lat: 22.81, lon: 88.23, view: 'hooghly'}, {name: 'Arambagh', lat: 22.88, lon: 87.78, view: 'hooghly'},
  {name: 'Hooghly River', lat: 22.665, lon: 88.4, view: 'hooghly', kind: 'river'},
];

/** Fits `bounds` into a box of `width`×`height` pixels, returning the transform from map units to pixels. */
function fit(bounds: Bounds, width: number, height: number, padding: number) {
  const [x1, y1] = project(bounds.north, bounds.west), [x2, y2] = project(bounds.south, bounds.east);
  const scale = Math.min((width - padding * 2) / (x2 - x1), (height - padding * 2) / (y2 - y1));
  return {scale, x: (width - (x2 - x1) * scale) / 2 - x1 * scale, y: (height - (y2 - y1) * scale) / 2 - y1 * scale};
}

/**
 * West Bengal, drawn from simplified public-domain outlines, with Udayan's two cinemas in Hooghly. The state view shows
 * one Udayan marker; selecting it zooms into Hooghly, where each cinema is a button. Shapes scale with a CSS transform;
 * pins and labels are positioned with the same transform so they stay sharp and readable.
 */
export default function WestBengalMap({cinemas, selected, view, onView, onPick, position}: {
  cinemas: Cinema[]; selected: number | null; view: MapView; onView: (view: MapView) => void; onPick: (index: number) => void; position: Position | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({width: 0, height: 0});
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const update = () => setSize({width: element.clientWidth, height: element.clientHeight});
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const ready = size.width > 0;
  const t = ready ? fit(frames[view], size.width, size.height, view === 'state' ? 18 : 34) : {scale: 1, x: 0, y: 0};
  const at = (lat: number, lon: number): CSSProperties => {
    const [x, y] = project(lat, lon);
    return {transform: `translate3d(${x * t.scale + t.x}px, ${y * t.scale + t.y}px, 0)`};
  };
  const centre = cinemas.reduce((sum, cinema) => ({lat: sum.lat + cinema.coordinates.latitude / cinemas.length, lon: sum.lon + cinema.coordinates.longitude / cinemas.length}), {lat: 0, lon: 0});
  const inView = position && position.latitude <= frames[view].north + .3 && position.latitude >= frames[view].south - .3 && position.longitude >= frames[view].west - .3 && position.longitude <= frames[view].east + .3;

  return <div className="wb-map" ref={box} data-view={view} data-ready={ready}>
    <svg className="wb-map-shapes" width={size.width} height={size.height} aria-hidden="true">
      <defs>
        <linearGradient id="wb-fill" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#FFF5F6"/><stop offset="1" stopColor="#FFDDE2"/></linearGradient>
      </defs>
      <g className="wb-map-world" style={{transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`}}>
        {neighbours.map(shape => <path key={shape.name} d={shape.d} className="wb-map-neighbour" vectorEffect="non-scaling-stroke"/>)}
        <path d={westBengal} className="wb-map-state" fill="url(#wb-fill)" vectorEffect="non-scaling-stroke"/>
        <path d={riverPath} className="wb-map-river" vectorEffect="non-scaling-stroke"/>
      </g>
    </svg>
    <div className="wb-map-layer">
      {places.map(place => <span key={place.name} className={`wb-map-place ${place.kind || 'city'}`} data-visible={!place.view || place.view === view} style={at(place.lat, place.lon)} aria-hidden="true">
        {(place.kind || 'city') === 'city' && <i/>}<span>{place.name}</span>
      </span>)}
      {inView && <span className="wb-map-you" style={at(position.latitude, position.longitude)}><i/><span>You</span></span>}
      <button type="button" className="wb-map-cluster" data-visible={view === 'state'} tabIndex={view === 'state' ? 0 : -1} aria-hidden={view !== 'state'}
        style={at(centre.lat, centre.lon)} onClick={() => onView('hooghly')} aria-label={`Show Udayan’s ${cinemas.length} cinemas in Hooghly`}>
        <b>{cinemas.length}</b><span>Udayan · Hooghly</span>
      </button>
      {cinemas.map((cinema, index) => <button key={cinema.id} type="button" className="wb-map-pin" data-visible={view === 'hooghly'} data-selected={selected === index}
        tabIndex={view === 'hooghly' ? 0 : -1} aria-hidden={view !== 'hooghly'} aria-pressed={selected === index}
        style={at(cinema.coordinates.latitude, cinema.coordinates.longitude)} onClick={() => onPick(index)} aria-label={`Udayan ${cinema.name}`}>
        <span className="wb-map-pin-dot"><MapPin size={16} aria-hidden="true"/></span>
        <span className="wb-map-pin-label"><small>UDAYAN</small>{cinema.name}</span>
      </button>)}
    </div>
    {view === 'hooghly' && <button type="button" className="wb-map-back" onClick={() => onView('state')}><ArrowLeft size={16} aria-hidden="true"/>Whole map</button>}
  </div>;
}
