import { FileText, ImagePlus, Share2, X } from 'lucide-react';
import type { Track } from '../types/music';
import {
  estimateBitrateKbps,
  formatFileSize,
  formatTimecode,
} from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface TrackDetailsModalProps {
  track: Track | null;
  playCount: number;
  onClose: () => void;
  onShare: (track: Track) => void;
  onSelectCustomCover: (track: Track) => void;
  onAssociateLyricsFile: (track: Track) => void;
}

export function TrackDetailsModal({
  track,
  playCount,
  onClose,
  onShare,
  onSelectCustomCover,
  onAssociateLyricsFile,
}: TrackDetailsModalProps) {
  if (!track) return null;

  const bitrate = estimateBitrateKbps(
    track.sizeBytes,
    track.durationSec,
    track.bitrateKbps
  );

  const rows: { label: string; value: string }[] = [
    { label: 'Title', value: track.title },
    { label: 'Artist', value: track.artist },
    { label: 'Album', value: track.album },
    { label: 'Track #', value: String(track.trackNumber) },
    { label: 'Duration', value: formatTimecode(track.durationSec) },
    {
      label: 'Format',
      value: `${track.formatLabel} (${track.mimeType || 'audio'})`,
    },
    { label: 'Bitrate', value: bitrate > 0 ? `${bitrate} kbps` : 'Unknown' },
    { label: 'File Size', value: formatFileSize(track.sizeBytes) },
    {
      label: 'File Location',
      value: track.filePath || track.folderPath || track.folderName,
    },
    {
      label: 'Source',
      value: track.source === 'android' ? 'Android Device Storage' : 'Offline Browser Import',
    },
    { label: 'Play Count', value: String(playCount) },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Track Details"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#151519] border border-zinc-200 dark:border-white/[0.1] p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <CoverArt
              src={track.artworkUrl}
              alt={`${track.album} artwork`}
              size="sm"
              className="w-12 h-12 rounded-lg shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-zinc-900 dark:text-[#F4F4F6] truncate">
                Track Info
              </h2>
              <p className="text-xs text-zinc-500 dark:text-[#8C8C96] truncate">
                {track.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close track details"
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-[#F4F4F6]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <dl className="divide-y divide-zinc-200 dark:divide-white/[0.06] text-xs">
          {rows.map((r) => (
            <div
              key={r.label}
              className="py-2 flex items-start justify-between gap-4"
            >
              <dt className="text-zinc-500 dark:text-[#8C8C96] shrink-0">
                {r.label}
              </dt>
              <dd className="text-right font-mono text-zinc-900 dark:text-[#F4F4F6] break-all">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectCustomCover(track)}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-xs font-medium text-zinc-800 dark:text-[#F4F4F6] inline-flex items-center gap-1.5"
            >
              <ImagePlus className="w-3.5 h-3.5 text-[#E85D3F]" />
              <span>Custom Cover</span>
            </button>
            <button
              type="button"
              onClick={() => onAssociateLyricsFile(track)}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-xs font-medium text-zinc-800 dark:text-[#F4F4F6] inline-flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Load .LRC</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => onShare(track)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-xs font-medium text-zinc-800 dark:text-[#F4F4F6] inline-flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#E85D3F] text-white text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
