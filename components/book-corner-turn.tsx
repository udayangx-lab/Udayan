'use client';

import {useLayoutEffect, useRef, useState} from 'react';

type Point = {x: number; y: number};

// Clip a sheet against the crease, the perpendicular bisector between the
// original top-right corner and the corner being pulled across the booklet.
function clip(points: Point[], normal: Point, midpoint: Point, side: number) {
  const output: Point[] = [];
  const distance = (point: Point) => side * ((point.x - midpoint.x) * normal.x + (point.y - midpoint.y) * normal.y);
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = distance(a), db = distance(b);
    if (da <= 0) output.push(a);
    if ((da <= 0) !== (db <= 0)) {
      const fraction = da / (da - db);
      output.push({x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction});
    }
  }
  return output;
}

export default function BookCornerTurn({src, direction, onComplete}: {src: string; direction: 'next' | 'previous'; onComplete: () => void}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) {complete.current(); return;}
    const sheet = element.parentElement!;
    const image = new Image();
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, progress = direction === 'next' ? 0 : 1, start: number | null = null;
    let stopped = false, width = 0, height = 0, ratio = 1;
    const path = (points: Point[]) => {
      context.beginPath();
      points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.closePath();
    };
    function draw() {
      if (!image.complete || !image.naturalWidth || !width || !height) return;
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      context!.clearRect(0, 0, width, height);
      if (progress < .0001) {context!.drawImage(image, 0, 0, width, height); return;}
      if (progress > .9999) return;
      const corner = {x: width - 2 * width * progress, y: height * .48 * Math.sin(Math.PI * progress)};
      const dx = width - corner.x, dy = -corner.y;
      const length = Math.hypot(dx, dy);
      const n = {x: dx / length, y: dy / length};
      const midpoint = {x: (width + corner.x) / 2, y: corner.y / 2};
      const rectangle = [{x: 0, y: 0}, {x: width, y: 0}, {x: width, y: height}, {x: 0, y: height}];
      const front = clip(rectangle, n, midpoint, 1);
      const folded = clip(rectangle, n, midpoint, -1);
      const reflect = (point: Point) => {
        const d = (point.x - midpoint.x) * n.x + (point.y - midpoint.y) * n.y;
        return {x: point.x - 2 * d * n.x, y: point.y - 2 * d * n.y};
      };
      const back = folded.map(reflect);
      // The front stays flat while the corner peels diagonally off the next page.
      context!.save(); path(front); context!.clip(); context!.drawImage(image, 0, 0, width, height); context!.restore();
      const lift = Math.sin(Math.PI * progress);
      context!.save();
      context!.shadowColor = `rgba(35,22,9,${.3 * lift})`;
      context!.shadowBlur = 20 * ratio * lift;
      context!.shadowOffsetX = -8 * ratio * lift;
      context!.shadowOffsetY = 9 * ratio * lift;
      path(back); context!.fillStyle = '#eee5d5'; context!.fill(); context!.restore();
      context!.save(); path(back); context!.clip();
      const foldWidth = Math.min(width, height) * .1;
      const shade = context!.createLinearGradient(midpoint.x - n.x * foldWidth, midpoint.y - n.y * foldWidth, midpoint.x, midpoint.y);
      shade.addColorStop(0, '#e8decd'); shade.addColorStop(.65, '#faf5e9'); shade.addColorStop(.9, '#fffdf5'); shade.addColorStop(1, '#c2b69f');
      context!.fillStyle = shade; context!.fillRect(0, 0, width, height);
      // A faint reverse impression gives the folded paper a printed backside.
      context!.globalAlpha = .07;
      const dot = n.x * midpoint.x + n.y * midpoint.y;
      context!.transform(1 - 2*n.x*n.x, -2*n.x*n.y, -2*n.x*n.y, 1 - 2*n.y*n.y, 2*n.x*dot, 2*n.y*dot);
      context!.drawImage(image, 0, 0, width, height); context!.restore();
    }
    function size() {
      const bounds = sheet.getBoundingClientRect(); width = bounds.width; height = bounds.height;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      element!.width = Math.round(width * ratio); element!.height = Math.round(height * ratio); draw();
    }
    function finish() {if (!stopped) {stopped = true; cancelAnimationFrame(frame); complete.current();}}
    function animate(time: number) {
      if (stopped) return;
      if (preference.matches) {finish(); return;}
      start ??= time;
      const elapsed = Math.min((time - start) / 940, 1);
      const eased = elapsed * elapsed * (3 - 2 * elapsed);
      progress = direction === 'next' ? eased : 1 - eased;
      draw();
      if (elapsed === 1) finish(); else frame = requestAnimationFrame(animate);
    }
    const observer = new ResizeObserver(size); observer.observe(sheet);
    image.onload = () => {if (!stopped) {size(); setReady(true); frame = requestAnimationFrame(animate);}};
    image.onerror = finish;
    image.src = src;
    return () => {stopped = true; cancelAnimationFrame(frame); observer.disconnect(); image.onload = null; image.onerror = null;};
  }, [src, direction]);
  return <div className="book-corner-turn" aria-hidden="true">
    {!ready && direction === 'next' && <img src={src} alt=""/>}
    <canvas ref={canvas}/>
  </div>;
}
