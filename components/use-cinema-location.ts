'use client';

import {useEffect, useRef, useState} from 'react';
import {createCinemaSelection, type LocationStatus} from '@/lib/cinema-location';
import type {Cinema} from '@/lib/data';

export type Position = {latitude: number; longitude: number};

/** The selected cinema, how it was chosen, and (after a location request) the visitor's position, kept in memory only. */
export function useCinemaLocation(cinemas: Cinema[]) {
  const [selection, setSelection] = useState<{index: number; status: LocationStatus}>({index: 0, status: 'idle'});
  const [position, setPosition] = useState<Position | null>(null);
  const controller = useRef<ReturnType<typeof createCinemaSelection> | null>(null);
  const venues = useRef(cinemas);
  useEffect(() => {
    let storage: Storage | undefined;
    try {storage = window.localStorage;} catch {}
    const current = createCinemaSelection({venues: venues.current, storage,
      geolocation: window.isSecureContext ? navigator.geolocation : undefined, onChange: setSelection, onPosition: setPosition});
    controller.current = current;
    current.start();
    return () => {current.dispose(); controller.current = null;};
  }, []);
  return {...selection, position, setIndex: (index: number) => controller.current?.select(index), locate: () => controller.current?.locate()};
}
