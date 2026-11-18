import { useState, type FormEvent } from 'react';
import { Pause, Play, Plus, Trash2, X } from 'lucide-react';
import type { Playlist, Track } from '../types/music';
import { formatAlbumDuration, formatTimecode, validatePlaylistInput } from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface PlaylistsViewProps {
  playlists: Playlist[];
  selectedPlaylistId: string | null;
  allTracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelectPlaylist: (playlistId: string | null) => void;
  onCreatePlaylist: (name: string, description: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onAddTrackToPlaylist: (playlistId: string, trackId: string) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  onPlayTrack: (trackId: string, queueSourceIds?: string[]) => void;
  onTogglePlayPause: () => void;
}

export function PlaylistsView({
  playlists,
  selectedPlaylistId,
  allTracks,
  currentTrackId,
  isPlaying,
  onSelectPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onPlayTrack,
  onTogglePlayPause,
}: PlaylistsViewProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [trackToAddId, setTrackToAddId] = useState<string>(allTracks[0]?.id ?? '');

  const activePlaylist =
    playlists.find((p) => p.id === selectedPlaylistId) ?? playlists[0] ?? null;

  const activeTracks: Track[] = activePlaylist
    ? activePlaylist.trackIds
        .map((id) => allTracks.find((t) => t.id === id))
        .filter((t): t is Track => Boolean(t))
    : [];

  const availableTracksToAdd = activePlaylist
    ? allTracks.filter((t) => !activePlaylist.trackIds.includes(t.id))
    : [];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validation = validatePlaylistInput(name, playlists);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid playlist name.');
      return;
    }
    setError(null);
    onCreatePlaylist(
      validation.trimmedName,
      description.trim() || 'Custom studio listening sequence.'
    );
    setName('');
    setDescription('');
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-8 max-w-6xl">
      <div className="pb-5 border-b border-white/[0.08]">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#F4F4F6]">
          Playlists
        </h1>
        <p className="text-sm text-[#8C8C96] mt-1">
          Curate sequences for studio sessions, deep focus, or late-night playback.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
        {/* Left column: Create Form + Playlist Selector */}
        <div className="space-y-6">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="p-5 rounded-xl bg-[#131316] border border-white/[0.08] space-y-4"
          >
            <h2 className="text-sm font-semibold text-[#F4F4F6]">
              Create Playlist
            </h2>

            <div className="space-y-1.5">
              <label
                htmlFor="playlist-name-input"
                className="block text-xs font-medium text-[#9C9CA6]"
              >
                Playlist Name
              </label>
              <input
                id="playlist-name-input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Late Night Listening"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'playlist-name-error' : undefined}
                className="w-full h-10 px-3 rounded-lg bg-[#0B0B0D] border border-white/[0.1] text-sm text-[#F4F4F6] placeholder-[#6E6E78] focus:outline-none focus:border-[#E85D3F]"
              />
              {error && (
                <p
                  id="playlist-name-error"
                  role="alert"
                  className="text-xs text-[#F87171] pt-1"
                >
                  {error}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="playlist-desc-input"
                className="block text-xs font-medium text-[#9C9CA6]"
              >
                Notes (optional)
              </label>
              <input
                id="playlist-desc-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mood or mastering notes..."
                className="w-full h-10 px-3 rounded-lg bg-[#0B0B0D] border border-white/[0.1] text-sm text-[#F4F4F6] placeholder-[#6E6E78] focus:outline-none focus:border-[#E85D3F]"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Playlist</span>
            </button>
          </form>

          <div className="space-y-2">
            <h2 className="text-xs font-medium text-[#7C7C87] px-1">
              Saved Sequences ({playlists.length})
            </h2>
            <ul className="space-y-1">
              {playlists.map((pl) => {
                const isSelected = activePlaylist?.id === pl.id;
                return (
                  <li key={pl.id}>
                    <button
                      type="button"
                      onClick={() => onSelectPlaylist(pl.id)}
                      className={`w-full px-3.5 py-3 rounded-lg text-left border transition-colors flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#19191F] border-white/15 text-[#F4F4F6]'
                          : 'bg-transparent border-transparent text-[#9C9CA6] hover:bg-white/[0.03] hover:text-[#F4F4F6]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{pl.name}</p>
                        <p className="text-xs text-[#6E6E78] font-mono tabular-nums mt-0.5">
                          {pl.trackIds.length}{' '}
                          {pl.trackIds.length === 1 ? 'track' : 'tracks'}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Right column: Active Playlist Detail */}
        {activePlaylist ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-white/[0.08]">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-[#F4F4F6]">
                  {activePlaylist.name}
                </h2>
                <p className="text-sm text-[#9C9CA6]">
                  {activePlaylist.description}
                </p>
                <p className="text-xs font-mono tabular-nums text-[#7C7C87]">
                  {activeTracks.length}{' '}
                  {activeTracks.length === 1 ? 'track' : 'tracks'} ·{' '}
                  {formatAlbumDuration(activeTracks)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeTracks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const playingThis =
                        isPlaying &&
                        activeTracks.some((t) => t.id === currentTrackId);
                      if (playingThis) onTogglePlayPause();
                      else
                        onPlayTrack(
                          activeTracks[0].id,
                          activeTracks.map((t) => t.id)
                        );
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-sm font-semibold text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play All</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDeletePlaylist(activePlaylist.id)}
                  aria-label={`Delete playlist '${activePlaylist.name}'`}
                  className="min-h-[42px] px-3 py-2 rounded-lg border border-white/[0.1] text-xs font-medium text-[#9C9CA6] hover:text-[#F87171] hover:border-[#F87171]/40 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Add track selector */}
            {availableTracksToAdd.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <label htmlFor="add-track-select" className="sr-only">
                  Select a track to add
                </label>
                <select
                  id="add-track-select"
                  value={
                    availableTracksToAdd.some((t) => t.id === trackToAddId)
                      ? trackToAddId
                      : availableTracksToAdd[0].id
                  }
                  onChange={(e) => setTrackToAddId(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg bg-[#131316] border border-white/[0.1] text-sm text-[#F4F4F6] focus:outline-none focus:border-[#E85D3F]"
                >
                  {availableTracksToAdd.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} — {t.artist}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const target = availableTracksToAdd.some(
                      (t) => t.id === trackToAddId
                    )
                      ? trackToAddId
                      : availableTracksToAdd[0].id;
                    if (target) {
                      onAddTrackToPlaylist(activePlaylist.id, target);
                    }
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#23232A] hover:bg-[#2E2E37] text-xs font-semibold text-[#F4F4F6] whitespace-nowrap shrink-0 transition-colors"
                >
                  Add Track
                </button>
              </div>
            )}

            {activeTracks.length === 0 ? (
              <div className="py-12 px-6 rounded-xl bg-[#131316] border border-white/[0.07] text-center">
                <p className="text-sm text-[#9C9CA6]">
                  This playlist has no tracks yet. Choose a track above or click +
                  on any track in Discover.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.05] border-t border-white/[0.08]">
                {activeTracks.map((track, idx) => {
                  const isCurrent = track.id === currentTrackId;
                  const queueIds = activeTracks.map((t) => t.id);
                  return (
                    <li
                      key={track.id}
                      className={`flex items-center justify-between gap-4 px-3 py-2.5 transition-colors ${
                        isCurrent ? 'bg-[#19191F]' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (isCurrent) onTogglePlayPause();
                            else onPlayTrack(track.id, queueIds);
                          }}
                          aria-label={
                            isCurrent && isPlaying
                              ? `Pause '${track.title}'`
                              : `Play '${track.title}'`
                          }
                          className="w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs tabular-nums text-[#8C8C96] hover:text-[#F4F4F6] shrink-0"
                        >
                          {isCurrent && isPlaying ? (
                            <Pause className="w-4 h-4 text-[#E85D3F] fill-current" />
                          ) : (
                            <span>{String(idx + 1).padStart(2, '0')}</span>
                          )}
                        </button>
                        <CoverArt
                          src={track.coverUrl}
                          alt={`${track.albumTitle} cover`}
                          size="sm"
                          className="w-9 h-9 rounded shrink-0 border border-white/[0.08]"
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              isCurrent ? 'text-[#E85D3F]' : 'text-[#F4F4F6]'
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-xs text-[#8C8C96] truncate">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs tabular-nums text-[#7C7C87]">
                          {formatTimecode(track.durationSec)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onRemoveTrackFromPlaylist(activePlaylist.id, track.id)
                          }
                          aria-label={`Remove '${track.title}' from '${activePlaylist.name}'`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#7C7C87] hover:text-[#F87171] hover:bg-white/[0.05]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className="py-12 px-6 rounded-xl bg-[#131316] border border-white/[0.07] text-center">
            <p className="text-sm text-[#9C9CA6]">
              No playlists available. Create your first playlist on the left.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
