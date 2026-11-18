import { useCallback, useEffect, useMemo, useState } from 'react';
import { synthEngine } from './audio/synthEngine';
import { AlbumDetailView } from './components/AlbumDetailView';
import { DiscoverView } from './components/DiscoverView';
import { LibraryView } from './components/LibraryView';
import { PlayerBar } from './components/PlayerBar';
import { PlaylistsView } from './components/PlaylistsView';
import { QueuePanel } from './components/QueuePanel';
import { Sidebar } from './components/Sidebar';
import { StudioEqView } from './components/StudioEqView';
import { TopBar } from './components/TopBar';
import { ALBUMS, DEFAULT_PLAYLISTS, EQ_PRESETS, TRACKS } from './data/catalog';
import type {
  EqBands,
  GenreFilter,
  Playlist,
  RepeatMode,
  ViewTab,
} from './types/music';
import {
  enqueueTrackUnique,
  filterAlbums,
  filterTracks,
  getNextTrackId,
  getPreviousTrackId,
  moveQueueItem,
} from './utils/musicLogic';

const STORAGE_KEYS = {
  likedTracks: 'cadence_liked_tracks_v1',
  savedAlbums: 'cadence_saved_albums_v1',
  playlists: 'cadence_playlists_v1',
  eqBands: 'cadence_eq_bands_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewTab>('discover');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>(ALBUMS[0].id);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState<GenreFilter>('All');

  const [likedTrackIds, setLikedTrackIds] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.likedTracks, ['trk-04', 'trk-08'])
  );
  const [savedAlbumIds, setSavedAlbumIds] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.savedAlbums, ['alb-obsidian'])
  );
  const [playlists, setPlaylists] = useState<Playlist[]>(() =>
    readStorage<Playlist[]>(STORAGE_KEYS.playlists, DEFAULT_PLAYLISTS)
  );
  const [eqBands, setEqBands] = useState<EqBands>(() =>
    readStorage<EqBands>(STORAGE_KEYS.eqBands, EQ_PRESETS[0].bands)
  );

  const [queueIds, setQueueIds] = useState<string[]>(() =>
    TRACKS.slice(0, 6).map((t) => t.id)
  );
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(
    TRACKS[0].id
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [volume, setVolume] = useState(0.78);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Persist user library, playlists, and EQ
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.likedTracks,
        JSON.stringify(likedTrackIds)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [likedTrackIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.savedAlbums,
        JSON.stringify(savedAlbumIds)
      );
    } catch {
      // Ignore
    }
  }, [savedAlbumIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.playlists,
        JSON.stringify(playlists)
      );
    } catch {
      // Ignore
    }
  }, [playlists]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.eqBands, JSON.stringify(eqBands));
    } catch {
      // Ignore
    }
    synthEngine.setEqBands(eqBands);
  }, [eqBands]);

  useEffect(() => {
    synthEngine.setVolume(volume, muted);
  }, [volume, muted]);

  const currentTrack = useMemo(
    () => TRACKS.find((t) => t.id === currentTrackId) ?? null,
    [currentTrackId]
  );

  // Sync Web Audio playback
  useEffect(() => {
    if (isPlaying && currentTrack) {
      synthEngine.start(currentTrack);
    } else {
      synthEngine.pause();
    }
  }, [isPlaying, currentTrack]);

  const handleNext = useCallback(() => {
    const nextId = getNextTrackId({
      queueIds,
      currentTrackId,
      repeatMode,
      shuffle,
    });
    if (nextId) {
      setCurrentTrackId(nextId);
      setCurrentTimeSec(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setCurrentTimeSec(0);
    }
  }, [queueIds, currentTrackId, repeatMode, shuffle]);

  // Playback progress timer
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;
    const interval = window.setInterval(() => {
      setCurrentTimeSec((prev) => {
        if (prev + 1 >= currentTrack.durationSec) {
          handleNext();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPlaying, currentTrack, handleNext]);

  const handlePlayTrack = (trackId: string, queueSourceIds?: string[]) => {
    if (queueSourceIds && queueSourceIds.length > 0) {
      setQueueIds(queueSourceIds);
    } else if (!queueIds.includes(trackId)) {
      setQueueIds((prev) => [trackId, ...prev]);
    }
    setCurrentTrackId(trackId);
    setCurrentTimeSec(0);
    setIsPlaying(true);
  };

  const handleTogglePlayPause = () => {
    if (!currentTrack && queueIds.length > 0) {
      setCurrentTrackId(queueIds[0]);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((p) => !p);
  };

  const handlePrev = () => {
    const res = getPreviousTrackId({
      queueIds,
      currentTrackId,
      currentTimeSec,
      repeatMode,
    });
    if (res.trackId) {
      setCurrentTrackId(res.trackId);
      setCurrentTimeSec(0);
      setIsPlaying(true);
    }
  };

  const handlePlayAlbum = (albumId: string) => {
    const albumTracks = TRACKS.filter((t) => t.albumId === albumId);
    if (albumTracks.length === 0) return;
    handlePlayTrack(
      albumTracks[0].id,
      albumTracks.map((t) => t.id)
    );
  };

  const handleOpenAlbum = (albumId: string) => {
    setSelectedAlbumId(albumId);
    setActiveView('album');
  };

  const handleToggleLikeTrack = (trackId: string) => {
    setLikedTrackIds((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [trackId, ...prev]
    );
  };

  const handleToggleSaveAlbum = (albumId: string) => {
    setSavedAlbumIds((prev) =>
      prev.includes(albumId)
        ? prev.filter((id) => id !== albumId)
        : [albumId, ...prev]
    );
  };

  const handleAddToQueue = (trackId: string) => {
    setQueueIds((prev) => enqueueTrackUnique(prev, trackId));
  };

  const handleMoveQueueItem = (fromIndex: number, toIndex: number) => {
    setQueueIds((prev) => moveQueueItem(prev, fromIndex, toIndex));
  };

  const handleRemoveQueueItem = (trackId: string) => {
    setQueueIds((prev) => prev.filter((id) => id !== trackId));
  };

  const handleCreatePlaylist = (name: string, description: string) => {
    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}`,
      name,
      description,
      trackIds: [],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);
    setSelectedPlaylistId(newPlaylist.id);
    setActiveView('playlists');
  };

  const handleDeletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => {
      const next = prev.filter((p) => p.id !== playlistId);
      if (selectedPlaylistId === playlistId) {
        setSelectedPlaylistId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleAddTrackToPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId && !pl.trackIds.includes(trackId)
          ? { ...pl, trackIds: [...pl.trackIds, trackId] }
          : pl
      )
    );
  };

  const handleRemoveTrackFromPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? { ...pl, trackIds: pl.trackIds.filter((id) => id !== trackId) }
          : pl
      )
    );
  };

  const handleCycleRepeat = () => {
    setRepeatMode((prev) =>
      prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'
    );
  };

  const filteredAlbums = useMemo(
    () => filterAlbums(ALBUMS, genreFilter, searchQuery),
    [genreFilter, searchQuery]
  );

  const filteredTracks = useMemo(
    () => filterTracks(TRACKS, genreFilter, searchQuery),
    [genreFilter, searchQuery]
  );

  const likedTracks = useMemo(() => {
    const raw = likedTrackIds
      .map((id) => TRACKS.find((t) => t.id === id))
      .filter((t): t is (typeof TRACKS)[number] => Boolean(t));
    return filterTracks(raw, genreFilter, searchQuery);
  }, [likedTrackIds, genreFilter, searchQuery]);

  const savedAlbums = useMemo(() => {
    const raw = savedAlbumIds
      .map((id) => ALBUMS.find((a) => a.id === id))
      .filter((a): a is (typeof ALBUMS)[number] => Boolean(a));
    return filterAlbums(raw, genreFilter, searchQuery);
  }, [savedAlbumIds, genreFilter, searchQuery]);

  const queueTracks = useMemo(
    () =>
      queueIds
        .map((id) => TRACKS.find((t) => t.id === id))
        .filter((t): t is (typeof TRACKS)[number] => Boolean(t)),
    [queueIds]
  );

  const featuredAlbum = ALBUMS[0];
  const featuredAlbumTracks = useMemo(
    () => TRACKS.filter((t) => t.albumId === featuredAlbum.id),
    [featuredAlbum.id]
  );

  const selectedAlbum =
    ALBUMS.find((a) => a.id === selectedAlbumId) ?? ALBUMS[0];
  const selectedAlbumTracks = useMemo(
    () => TRACKS.filter((t) => t.albumId === selectedAlbum.id),
    [selectedAlbum.id]
  );

  const hasActiveFilter =
    genreFilter !== 'All' || searchQuery.trim().length > 0;

  return (
    <div className="h-screen w-full flex flex-col bg-[#0B0B0D] text-[#F4F4F6] overflow-hidden">
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar
          activeView={activeView}
          selectedPlaylistId={selectedPlaylistId}
          playlists={playlists}
          likedCount={likedTrackIds.length}
          onSelectView={(v) => {
            setSelectedPlaylistId(null);
            setActiveView(v);
          }}
          onSelectPlaylist={(plId) => {
            setSelectedPlaylistId(plId);
            setActiveView('playlists');
          }}
          onOpenCreatePlaylist={() => {
            setSelectedPlaylistId(null);
            setActiveView('playlists');
          }}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            activeView={activeView}
            searchQuery={searchQuery}
            genreFilter={genreFilter}
            queueCount={queueTracks.length}
            isQueueOpen={isQueueOpen}
            onSearchChange={setSearchQuery}
            onGenreChange={setGenreFilter}
            onToggleQueue={() => setIsQueueOpen((o) => !o)}
            onNavigateHome={() => setActiveView('discover')}
          />

          <main className="flex-1 overflow-y-auto pb-28 lg:pb-8">
            {activeView === 'discover' && (
              <DiscoverView
                featuredAlbum={featuredAlbum}
                featuredAlbumTracks={featuredAlbumTracks}
                albums={filteredAlbums}
                tracks={filteredTracks}
                allTracks={TRACKS}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                likedTrackIds={likedTrackIds}
                savedAlbumIds={savedAlbumIds}
                playlists={playlists}
                hasActiveFilter={hasActiveFilter}
                onPlayTrack={handlePlayTrack}
                onTogglePlayPause={handleTogglePlayPause}
                onPlayAlbum={handlePlayAlbum}
                onOpenAlbum={handleOpenAlbum}
                onToggleLikeTrack={handleToggleLikeTrack}
                onToggleSaveAlbum={handleToggleSaveAlbum}
                onAddToQueue={handleAddToQueue}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
                onClearFilters={() => {
                  setGenreFilter('All');
                  setSearchQuery('');
                }}
              />
            )}

            {activeView === 'album' && (
              <AlbumDetailView
                album={selectedAlbum}
                tracks={selectedAlbumTracks}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                likedTrackIds={likedTrackIds}
                isSaved={savedAlbumIds.includes(selectedAlbum.id)}
                onBack={() => setActiveView('discover')}
                onPlayAlbum={handlePlayAlbum}
                onPlayTrack={handlePlayTrack}
                onTogglePlayPause={handleTogglePlayPause}
                onToggleSaveAlbum={handleToggleSaveAlbum}
                onToggleLikeTrack={handleToggleLikeTrack}
                onAddToQueue={handleAddToQueue}
              />
            )}

            {activeView === 'library' && (
              <LibraryView
                likedTracks={likedTracks}
                savedAlbums={savedAlbums}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onTogglePlayPause={handleTogglePlayPause}
                onToggleLikeTrack={handleToggleLikeTrack}
                onToggleSaveAlbum={handleToggleSaveAlbum}
                onPlayAlbum={handlePlayAlbum}
                onOpenAlbum={handleOpenAlbum}
                onAddToQueue={handleAddToQueue}
                onNavigateDiscover={() => setActiveView('discover')}
              />
            )}

            {activeView === 'playlists' && (
              <PlaylistsView
                playlists={playlists}
                selectedPlaylistId={selectedPlaylistId}
                allTracks={TRACKS}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                onSelectPlaylist={setSelectedPlaylistId}
                onCreatePlaylist={handleCreatePlaylist}
                onDeletePlaylist={handleDeletePlaylist}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
                onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
                onPlayTrack={handlePlayTrack}
                onTogglePlayPause={handleTogglePlayPause}
              />
            )}

            {activeView === 'eq' && (
              <StudioEqView
                eqBands={eqBands}
                isPlaying={isPlaying}
                currentTrack={currentTrack}
                onChangeBand={(band, value) =>
                  setEqBands((prev) => ({ ...prev, [band]: value }))
                }
                onApplyPreset={setEqBands}
              />
            )}
          </main>
        </div>

        <QueuePanel
          queueTracks={queueTracks}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          isOpenMobile={isQueueOpen}
          onCloseMobile={() => setIsQueueOpen(false)}
          onPlayTrack={(id) => handlePlayTrack(id)}
          onTogglePlayPause={handleTogglePlayPause}
          onMoveItem={handleMoveQueueItem}
          onRemoveItem={handleRemoveQueueItem}
          onClearQueue={() => setQueueIds([])}
        />
      </div>

      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTimeSec={currentTimeSec}
        volume={volume}
        muted={muted}
        shuffle={shuffle}
        repeatMode={repeatMode}
        isLiked={currentTrack ? likedTrackIds.includes(currentTrack.id) : false}
        isQueueOpen={isQueueOpen}
        activeView={activeView}
        onTogglePlayPause={handleTogglePlayPause}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={setCurrentTimeSec}
        onVolumeChange={(v) => {
          setVolume(v);
          if (muted && v > 0) setMuted(false);
        }}
        onToggleMute={() => setMuted((m) => !m)}
        onToggleShuffle={() => setShuffle((s) => !s)}
        onCycleRepeat={handleCycleRepeat}
        onToggleLike={() => {
          if (currentTrack) handleToggleLikeTrack(currentTrack.id);
        }}
        onToggleQueue={() => setIsQueueOpen((o) => !o)}
        onSelectView={(v) => {
          setSelectedPlaylistId(null);
          setActiveView(v);
        }}
      />
    </div>
  );
}
