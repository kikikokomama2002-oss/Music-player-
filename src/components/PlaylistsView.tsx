import { useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Play,
  Plus,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import type { Playlist, Track } from '../types/music';
import {
  formatAlbumDuration,
  formatTimecode,
  validatePlaylistInput,
} from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface PlaylistsViewProps {
  playlists: Playlist[];
  selectedPlaylistId: string | null;
  allTracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelectPlaylist: (playlistId: string | null) => void;
  onCreatePlaylist: (name: string, description: string) => void;
  onRenamePlaylist: (playlistId: string, newName: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onAddTrackToPlaylist: (playlistId: string, trackId: string) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  onMovePlaylistTrack: (
    playlistId: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  onPlayPlaylist: (trackIds: string[], shuffle: boolean) => void;
  onPlayTrack: (trackId: string, queueSourceIds: string[]) => void;
}

export function PlaylistsView({
  playlists,
  selectedPlaylistId,
  allTracks,
  currentTrackId,
  onSelectPlaylist,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onMovePlaylistTrack,
  onPlayPlaylist,
  onPlayTrack,
}: PlaylistsViewProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [trackToAddId, setTrackToAddId] = useState<string>(allTracks[0]?.id ?? '');

  const activePlaylist =
    playlists.find((p) => p.id === selectedPlaylistId) ?? playlists[0] ?? null;

  const trackMap = new Map(allTracks.map((t) => [t.id, t]));
  const activeEntries = activePlaylist
    ? activePlaylist.trackIds.map((id) => ({
        id,
        track: trackMap.get(id) ?? null,
      }))
    : [];
  const playableTracks = activeEntries
    .map((e) => e.track)
    .filter((t): t is Track => Boolean(t));
  const playableIds = playableTracks.map((t) => t.id);

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
    onCreatePlaylist(validation.trimmedName, description.trim());
    setName('');
    setDescription('');
  };

  const handleSaveRename = (playlistId: string) => {
    const validation = validatePlaylistInput(renameText, playlists, playlistId);
    if (!validation.valid) {
      setRenameError(validation.error ?? 'Invalid playlist name.');
      return;
    }
    setRenameError(null);
    onRenamePlaylist(playlistId, validation.trimmedName);
    setRenamingId(null);
  };

  return (
    <div className="px-4 sm:px-8 py-6 space-y-8 max-w-6xl">
      <div className="pb-4 border-b border-zinc-200 dark:border-white/[0.08]">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6]">
          Playlists
        </h1>
        <p className="text-sm text-zinc-600 dark:text-[#8C8C96] mt-1">
          Organize local music sequences. Playlists persist offline across restarts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
        <div className="space-y-6">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="p-5 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-4"
          >
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6]">
              Create Playlist
            </h2>

            <div className="space-y-1.5">
              <label
                htmlFor="playlist-name-input"
                className="block text-xs font-medium text-zinc-600 dark:text-[#9C9CA6]"
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
                placeholder="e.g. Commute Mix"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'playlist-name-error' : undefined}
                className="w-full h-10 px-3 rounded-lg bg-stone-50 dark:bg-[#0B0B0D] border border-zinc-300 dark:border-white/[0.1] text-sm text-zinc-900 dark:text-[#F4F4F6] placeholder-zinc-400 dark:placeholder-[#6E6E78] focus:outline-none focus:border-[#E85D3F]"
              />
              {error && (
                <p
                  id="playlist-name-error"
                  role="alert"
                  className="text-xs text-red-500 pt-1"
                >
                  {error}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="playlist-desc-input"
                className="block text-xs font-medium text-zinc-600 dark:text-[#9C9CA6]"
              >
                Notes (optional)
              </label>
              <input
                id="playlist-desc-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description..."
                className="w-full h-10 px-3 rounded-lg bg-stone-50 dark:bg-[#0B0B0D] border border-zinc-300 dark:border-white/[0.1] text-sm text-zinc-900 dark:text-[#F4F4F6] placeholder-zinc-400 dark:placeholder-[#6E6E78] focus:outline-none focus:border-[#E85D3F]"
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
            <h2 className="text-xs font-medium text-zinc-500 dark:text-[#7C7C87] px-1">
              Your Playlists ({playlists.length})
            </h2>
            {playlists.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-[#6E6E78] px-1">
                Create your first playlist above.
              </p>
            ) : (
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
                            ? 'bg-zinc-100 dark:bg-[#19191F] border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-[#F4F4F6]'
                            : 'bg-transparent border-transparent text-zinc-600 dark:text-[#9C9CA6] hover:bg-zinc-100/70 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{pl.name}</p>
                          <p className="text-xs font-mono tabular-nums text-zinc-500 dark:text-[#6E6E78] mt-0.5">
                            {pl.trackIds.length}{' '}
                            {pl.trackIds.length === 1 ? 'track' : 'tracks'}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Active Playlist Detail */}
        {activePlaylist ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/[0.08]">
              <div className="space-y-2 flex-1 min-w-0">
                {renamingId === activePlaylist.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        aria-label="Rename playlist"
                        className="h-10 px-3 rounded-lg bg-white dark:bg-[#0B0B0D] border border-[#E85D3F] text-sm text-zinc-900 dark:text-[#F4F4F6]"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(activePlaylist.id)}
                        aria-label="Save playlist name"
                        className="min-w-[40px] min-h-[40px] rounded-lg bg-[#E85D3F] text-white flex items-center justify-center"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(null);
                          setRenameError(null);
                        }}
                        aria-label="Cancel rename"
                        className="min-w-[40px] min-h-[40px] rounded-lg border border-zinc-300 dark:border-white/[0.1] flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {renameError && (
                      <p role="alert" className="text-xs text-red-500">
                        {renameError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-[#F4F4F6] truncate">
                      {activePlaylist.name}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(activePlaylist.id);
                        setRenameText(activePlaylist.name);
                        setRenameError(null);
                      }}
                      aria-label={`Rename '${activePlaylist.name}'`}
                      className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-[#F4F4F6]"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {activePlaylist.description && (
                  <p className="text-sm text-zinc-600 dark:text-[#9C9CA6]">
                    {activePlaylist.description}
                  </p>
                )}
                <p className="text-xs font-mono tabular-nums text-zinc-500 dark:text-[#7C7C87]">
                  {playableTracks.length}{' '}
                  {playableTracks.length === 1 ? 'track' : 'tracks'} ·{' '}
                  {formatAlbumDuration(playableTracks)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {playableIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => onPlayPlaylist(playableIds, false)}
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onPlayPlaylist(playableIds, true)}
                      className="min-h-[40px] px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-white/[0.1] text-xs font-medium text-zinc-800 dark:text-[#F4F4F6] inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Shuffle</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => onDeletePlaylist(activePlaylist.id)}
                  aria-label={`Delete playlist '${activePlaylist.name}'`}
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-zinc-300 dark:border-white/[0.1] text-xs font-medium text-zinc-600 dark:text-[#9C9CA6] hover:text-red-500 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

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
                  className="flex-1 h-10 px-3 rounded-lg bg-white dark:bg-[#131316] border border-zinc-300 dark:border-white/[0.1] text-sm text-zinc-900 dark:text-[#F4F4F6]"
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
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-zinc-900 dark:bg-[#23232A] text-xs font-semibold text-white whitespace-nowrap shrink-0"
                >
                  Add Track
                </button>
              </div>
            )}

            {activeEntries.length === 0 ? (
              <div className="py-12 px-6 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.07] text-center">
                <p className="text-sm text-zinc-600 dark:text-[#9C9CA6]">
                  This playlist is empty. Add tracks from above or from any
                  track context menu.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-white/[0.05] border-t border-zinc-200 dark:border-white/[0.08]">
                {activeEntries.map(({ id, track }, idx) => {
                  const isCurrent = id === currentTrackId;
                  return (
                    <li
                      key={`${id}-${idx}`}
                      className="flex items-center justify-between gap-3 px-2 py-2.5 hover:bg-zinc-100/60 dark:hover:bg-white/[0.03]"
                    >
                      {track ? (
                        <button
                          type="button"
                          onClick={() => onPlayTrack(track.id, playableIds)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left"
                        >
                          <span className="w-7 text-center font-mono text-xs tabular-nums text-zinc-500">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <CoverArt
                            src={track.artworkUrl}
                            alt={`${track.album} cover`}
                            size="sm"
                            className="w-9 h-9 rounded shrink-0"
                          />
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                isCurrent
                                  ? 'text-[#E85D3F]'
                                  : 'text-zinc-900 dark:text-[#F4F4F6]'
                              }`}
                            >
                              {track.title}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-[#8C8C96] truncate">
                              {track.artist} · {formatTimecode(track.durationSec)}
                            </p>
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="w-7 text-center font-mono text-xs tabular-nums text-zinc-400">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-zinc-500 line-through truncate">
                              Unavailable file ({id})
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Audio file moved or deleted from device
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() =>
                            onMovePlaylistTrack(activePlaylist.id, idx, idx - 1)
                          }
                          aria-label="Move track up"
                          className="p-2 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-[#F4F4F6] disabled:opacity-25"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === activeEntries.length - 1}
                          onClick={() =>
                            onMovePlaylistTrack(activePlaylist.id, idx, idx + 1)
                          }
                          aria-label="Move track down"
                          className="p-2 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-[#F4F4F6] disabled:opacity-25"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRemoveTrackFromPlaylist(activePlaylist.id, id)
                          }
                          aria-label="Remove from playlist"
                          className="p-2 rounded text-zinc-500 hover:text-red-500"
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
          <div className="py-12 px-6 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.07] text-center">
            <p className="text-sm text-zinc-600 dark:text-[#9C9CA6]">
              Create a playlist on the left to start organizing your music.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
