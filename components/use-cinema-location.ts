'use client';

import {useEffect, useRef, useState} from 'react';
import {createCinemaSelection, type LocationStatus} from '@/lib/cinema-location';
import type {Cinema} from '@/lib/data';

export function useCinemaLocation(cinemas: Cinema[]) {
  const [selection, setSelection] = useState<{index: number; status: LocationStatus}>({index: 0, status: 'idle'});
  const controller = useRef<ReturnType<typeof createCinemaSelection> | null>(null);
  const venues = useRef(cinemas);
  useEffect(() => {
    let storage: Storage | undefined;
    try {storage = window.localStorage;} catch {}
    const current = createCinemaSelection({venues: venues.current, storage,
      geolocation: window.isSecureContext ? navigator.geolocation : undefined, onChange: setSelection});
    controller.current = current;
    current.start();
    return () => {current.dispose(); controller.current = null;};
  }, []);
  return {...selection, setIndex: (index: number) => controller.current?.select(index), locate: () => controller.current?.locate()};
}
