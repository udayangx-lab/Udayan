type Venue = {id: string; coordinates: {latitude: number; longitude: number}};
export type LocationStatus = 'idle' | 'locating' | 'nearest' | 'manual' | 'denied' | 'unavailable';
type Selection = {index: number; status: LocationStatus};
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const cinemaPreferenceKey = 'udayan:preferred-cinema';

export function nearestCinema(latitude: number, longitude: number, venues: Venue[]) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !venues.length) return null;
  const radians = (value: number) => value * Math.PI / 180;
  const distances = venues.map(({coordinates: destination}) => {
    const lat = radians(destination.latitude - latitude);
    const lon = radians(destination.longitude - longitude);
    return Math.sin(lat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(lon / 2) ** 2;
  });
  return distances.indexOf(Math.min(...distances));
}

// Coordinates stay in memory. Only an explicitly chosen cinema ID is saved.
export function createCinemaSelection({venues, geolocation, storage, onChange}: {
  venues: Venue[]; geolocation?: Pick<Geolocation, 'getCurrentPosition'>;
  storage?: StorageLike; onChange: (selection: Selection) => void;
}) {
  let index = 0;
  let generation = 0;
  let disposed = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const publish = (status: LocationStatus) => {if (!disposed) onChange({index, status});};
  function locate() {
    if (disposed) return;
    clearTimeout(timeout);
    const request = ++generation;
    if (!geolocation) {publish('unavailable'); return;}
    publish('locating');
    // Native geolocation timeouts can exclude time waiting for permission.
    timeout = setTimeout(() => {
      if (!disposed && request === generation) publish('unavailable');
    }, 12000);
    try {
      geolocation.getCurrentPosition(position => {
        if (disposed || request !== generation) return;
        clearTimeout(timeout);
        const nearest = nearestCinema(position.coords.latitude, position.coords.longitude, venues);
        if (nearest === null) {publish('unavailable'); return;}
        index = nearest;
        // A successful explicit re-detection opts back into automatic selection.
        try {storage?.removeItem(cinemaPreferenceKey);} catch {}
        publish('nearest');
      }, error => {
        if (!disposed && request === generation) {
          clearTimeout(timeout);
          publish(error.code === 1 ? 'denied' : 'unavailable');
        }
      }, {enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000});
    } catch {clearTimeout(timeout); publish('unavailable');}
  }
  return {
    start() {
      let saved: string | null = null;
      try {saved = storage?.getItem(cinemaPreferenceKey) ?? null;} catch {}
      const savedIndex = venues.findIndex(venue => venue.id === saved);
      if (savedIndex !== -1) {index = savedIndex; publish('manual');}
      else locate();
    },
    select(next: number) {
      if (disposed || !Number.isInteger(next) || !venues[next]) return;
      ++generation; // Ignore an in-flight location result after a manual choice.
      clearTimeout(timeout);
      index = next;
      try {storage?.setItem(cinemaPreferenceKey, venues[next].id);} catch {}
      publish('manual');
    },
    locate,
    dispose() {disposed = true; ++generation; clearTimeout(timeout);},
  };
}
