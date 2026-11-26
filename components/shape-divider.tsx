/**
 * Decorative edges between page bands. A divider belongs to the band it sits in and grows out of
 * that band's top or bottom edge in the band's own colour (set with `--shape-fill` in CSS).
 * Waves are two layers, two periods wide, so the back layer can drift and loop seamlessly.
 */
type Shape = 'wave' | 'curve' | 'tilt' | 'arch';
type Side = 'top' | 'bottom';

const period = (x: number, y: number, a: number) =>
  `C${x + 240},${y - a} ${x + 480},${y - a} ${x + 720},${y} C${x + 960},${y + a} ${x + 1200},${y + a} ${x + 1440},${y}`;
const wave = (y: number, a: number) => `M0,${y} ${period(0, y, a)} ${period(1440, y, a)} L2880,120 L0,120 Z`;

const shapes: Record<Exclude<Shape, 'wave'>, string> = {
  curve: 'M0,120 C360,8 1080,8 1440,120 Z',
  arch: 'M0,120 L0,96 C420,-30 1020,-30 1440,96 L1440,120 Z',
  tilt: 'M0,120 L1440,18 L1440,120 Z',
};

export default function ShapeDivider({shape = 'wave', side = 'top', flip = false}: {shape?: Shape; side?: Side; flip?: boolean}) {
  const className = `shape-divider shape-${side} shape-${shape}` + (flip ? ' shape-flip' : '');
  if (shape === 'wave') return <div className={className} aria-hidden="true">
    <svg viewBox="0 0 2880 120" preserveAspectRatio="none" className="shape-wave-back"><path d={wave(64, 34)}/></svg>
    <svg viewBox="0 0 2880 120" preserveAspectRatio="none" className="shape-wave-front"><path d={wave(78, 26)}/></svg>
  </div>;
  return <div className={className} aria-hidden="true"><svg viewBox="0 0 1440 120" preserveAspectRatio="none"><path d={shapes[shape]}/></svg></div>;
}
