export type Genre = 'Electronic' | 'Ambient' | 'Jazz' | 'Acoustic';

export type GenreFilter = 'All' | Genre;

export type RepeatMode = 'off' | 'all' | 'one';

export type ViewTab = 'discover' | 'library' | 'playlists' | 'eq' | 'album';

export type SynthProfile = 'analog-pad' | 'warm-rhodes' | 'dub-pulse' | 'brass-quartet' | 'nylon-pluck';

export interface Track {
  id: string;
  albumId: string;
  trackNumber: number;
  title: string;
  artist: string;
  albumTitle: string;
  genre: Genre;
  durationSec: number;
  bpm: number;
  audioSpec: string;
  coverUrl: string;
  synthProfile: SynthProfile;
  rootHz: number;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  year: number;
  label: string;
  audioSpec: string;
  coverUrl: string;
  linerNote: string;
  featured?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: string;
}

export interface EqBands {
  hz60: number;
  hz230: number;
  hz910: number;
  hz3600: number;
  hz14000: number;
}

export interface EqPreset {
  id: string;
  name: string;
  description: string;
  bands: EqBands;
}
