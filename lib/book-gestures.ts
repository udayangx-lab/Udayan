export type Finger = {id: number; x: number; y: number};
export type Swipe = 'next' | 'previous';

export function touchSwipe(start: Finger[], current: Finger[]): Swipe | 'horizontal' | 'cancel' | null {
  if (start.length < 1 || start.length > 2 || start.length !== current.length) return 'cancel';
  const matched = start.map(finger => current.find(point => point.id === finger.id));
  if (matched.some(point => !point)) return 'cancel';
  const movements = start.map((finger, index) => ({x: matched[index]!.x - finger.x, y: matched[index]!.y - finger.y}));
  if (start.length === 2) {
    const distance = (points: Finger[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const initial = distance(start);
    if (initial < 10 || Math.abs(distance(matched as Finger[]) - initial) > Math.max(12, initial * .14)) return 'cancel';
    if (movements.every(move => Math.abs(move.x) > 10) && Math.sign(movements[0].x) !== Math.sign(movements[1].x)) return 'cancel';
  }
  const dx = movements.reduce((sum, move) => sum + move.x, 0) / movements.length;
  const dy = movements.reduce((sum, move) => sum + move.y, 0) / movements.length;
  if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) return 'cancel';
  if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.4) return null;
  if (Math.abs(dx) < 48) return 'horizontal';
  return dx < 0 ? 'next' : 'previous';
}

// A trackpad swipe generates many wheel events, including a long inertial tail.
// Rearm only after silence, never merely because the page animation has ended.
export function createWheelSwipe() {
  let last = -Infinity;
  let distance = 0;
  let fired = false;
  return (event: {dx: number; dy: number; time: number; pinch?: boolean}) => {
    if (event.pinch) return {consume: false, direction: null};
    if (event.time - last > 240) {distance = 0; fired = false;}
    last = event.time;
    if (Math.abs(event.dx) <= Math.abs(event.dy) * 1.3 || Math.abs(event.dx) < .5) return {consume: false, direction: null};
    if (fired) return {consume: true, direction: null};
    if (Math.sign(distance) !== Math.sign(event.dx)) distance = 0;
    distance += event.dx;
    if (Math.abs(distance) < 60) return {consume: true, direction: null};
    fired = true;
    return {consume: true, direction: distance > 0 ? 'next' as const : 'previous' as const};
  };
}
