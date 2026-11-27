import {defaultContent, type SiteContent} from '../data';
import type {ListingsFeed} from '../listings';
import {readContent} from '../server/content';
import {publicFeed, readListings} from '../server/listings';
import {swr} from './cache';

export type Venue = {id: string; shortName: string; city: string; lat: number; lng: number};
export type Screening = {title: string; start: string; format: string; language: string; auditorium: string; price?: number; url: string; poster: string};
export type Movie = {title: string; poster: string; cinemaIds: string[]; genres?: string[]; censor?: string; language?: string; releaseDate?: string; advance?: boolean};
export type AssistantData = {content: SiteContent; venues: Venue[]; movies: Movie[]; upcoming: Movie[]; shows: Map<string, Screening[]>};

function assemble(content: SiteContent, feed?: ListingsFeed): AssistantData {
  const venues = content.cinemas.map(c => ({id:c.id, shortName:'Udayan '+c.name, city:c.name, lat:c.coordinates.latitude, lng:c.coordinates.longitude}));
  const movies = new Map<string, Movie>();
  const shows = new Map<string, Screening[]>();
  for (const cinema of venues) {
    const venue = feed?.venues[cinema.id];
    const events: Screening[] = [];
    if (venue?.lastSuccessAt && Date.now()-Date.parse(venue.lastSuccessAt)<86400000) {
      for (const film of venue.movies) {
        const sessions = film.sessions.filter(s => Date.parse(s.startsAt)>Date.now());
        if (!sessions.length) continue;
        const movie = movies.get(film.id) || {title:film.title, poster:film.poster, genres:film.genres, censor:film.censor, releaseDate:film.releaseDate, language:film.languages.join(', '), cinemaIds:[]};
        movie.cinemaIds.push(cinema.id);
        movies.set(film.id,movie);
        for (const s of sessions) events.push({title:movie.title, start:s.startsAt, format:s.format, language:s.language, auditorium:s.screen, price:s.price, url:s.districtUrl, poster:movie.poster});
      }
    }
    shows.set(cinema.id,events);
  }
  return {content,venues,shows,movies:[...movies.values()],upcoming:(feed?.upcoming || content.upcoming).map(m=>({...m,cinemaIds:[]}))};
}

async function load() {
  const [content, raw] = await Promise.all([readContent(),readListings()]);
  const feed = await publicFeed(raw || {version:2, refreshIntervalMinutes:15, lastAttemptAt:'', venues:{}});
  return assemble(content,feed);
}

export const assistantData = () => swr('assistant',60000,load,{waitMs:1500,fallback:()=>assemble(defaultContent)});
