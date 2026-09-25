import {Armchair, AudioLines, Car, Clock, Coffee, ExternalLink, Film, Heart, MapPin, Popcorn, Projector, Sparkles, Star, Ticket, Users, type LucideProps} from 'lucide-react';

const icons = {projector: Projector, sound: AudioLines, seat: Armchair, coffee: Coffee, ticket: Ticket, popcorn: Popcorn, film: Film,
  car: Car, star: Star, heart: Heart, sparkles: Sparkles, 'map-pin': MapPin, users: Users, clock: Clock, external: ExternalLink};

export default function ContentIcon({name, ...props}: {name: string} & LucideProps) {
  const Icon = icons[name as keyof typeof icons] || Sparkles;
  return <Icon {...props}/>;
}
