import { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { synthEngine } from '../audio/synthEngine';
import { EQ_PRESETS } from '../data/catalog';
import type { EqBands, Track } from '../types/music';
import { clampEqGain, findMatchingEqPreset } from '../utils/musicLogic';

interface StudioEqViewProps {
  eqBands: EqBands;
  isPlaying: boolean;
  currentTrack: Track | null;
  onChangeBand: (band: keyof EqBands, value: number) => void;
  onApplyPreset: (bands: EqBands) => void;
}

const BAND_META: { key: keyof EqBands; label: string; role: string }[] = [
  { key: 'hz60', label: '60 Hz', role: 'Sub Bass' },
  { key: 'hz230', label: '230 Hz', role: 'Warmth' },
  { key: 'hz910', label: '910 Hz', role: 'Midrange' },
  { key: 'hz3600', label: '3.6 kHz', role: 'Presence' },
  { key: 'hz14000', label: '14 kHz', role: 'Air' },
];

export function StudioEqView({
  eqBands,
  isPlaying,
  currentTrack,
  onChangeBand,
  onApplyPreset,
}: StudioEqViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePresetId = findMatchingEqPreset(eqBands, EQ_PRESETS);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const freqData = new Uint8Array(64);
    let phase = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Subtle reference grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const y = Math.round((height / 4) * i) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const hasLiveAudio = synthEngine.getFrequencyData(freqData);
      const barCount = 40;
      const gap = 4;
      const barWidth = (width - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        let energy = 0.08;
        if (isPlaying) {
          if (hasLiveAudio && freqData.some((v) => v > 0)) {
            energy = Math.max(0.1, freqData[i % freqData.length] / 255);
          } else {
            // Smooth harmonic visualization synced to EQ curve if AudioContext is muted/headless
            const bandIdx = Math.min(4, Math.floor((i / barCount) * 5));
            const bandKeys: (keyof EqBands)[] = [
              'hz60',
              'hz230',
              'hz910',
              'hz3600',
              'hz14000',
            ];
            const eqOffset = eqBands[bandKeys[bandIdx]] / 24;
            energy = Math.max(
              0.12,
              Math.min(
                0.92,
                0.36 +
                  Math.sin(phase * 1.4 + i * 0.35) * 0.22 +
                  Math.cos(phase * 0.8 + i * 0.15) * 0.14 +
                  eqOffset
              )
            );
          }
        } else {
          // Static subtle EQ contour curve preview when paused
          const bandIdx = Math.min(4, Math.floor((i / barCount) * 5));
          const bandKeys: (keyof EqBands)[] = [
            'hz60',
            'hz230',
            'hz910',
            'hz3600',
            'hz14000',
          ];
          energy = Math.max(
            0.06,
            Math.min(0.45, 0.16 + eqBands[bandKeys[bandIdx]] / 30)
          );
        }

        const barH = Math.max(4, energy * (height - 16));
        const x = i * (barWidth + gap);
        const y = height - barH;

        ctx.fillStyle = isPlaying
          ? energy > 0.68
            ? '#E85D3F'
            : 'rgba(244, 244, 246, 0.72)'
          : 'rgba(156, 156, 166, 0.28)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 2);
        ctx.fill();
      }

      if (isPlaying) {
        phase += 0.06;
        rafId = window.requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isPlaying, eqBands]);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#F4F4F6]">
            Studio Equalizer
          </h1>
          <p className="text-sm text-[#8C8C96] mt-1">
            5-band parametric stage shaping live Web Audio output.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onApplyPreset(EQ_PRESETS[0].bands)}
          className="min-h-[40px] px-3.5 py-2 rounded-lg border border-white/[0.1] text-xs font-medium text-[#C4C4CC] hover:text-[#F4F4F6] hover:border-white/25 inline-flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Flat</span>
        </button>
      </div>

      {/* Live Spectrum Analyzer */}
      <section
        aria-label="Audio Spectrum Analyzer"
        className="p-5 rounded-xl bg-[#131316] border border-white/[0.08] space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-[#C4C4CC]">
            {currentTrack
              ? `${currentTrack.title} — ${currentTrack.artist}`
              : 'No track loaded'}
          </span>
          <span className="font-mono tabular-nums text-[#7C7C87]">
            {isPlaying ? 'Output Active' : 'Standby'} ·{' '}
            {currentTrack?.audioSpec ?? '24-bit / 96 kHz'}
          </span>
        </div>

        <canvas
          ref={canvasRef}
          width={800}
          height={140}
          data-testid="spectrum-canvas"
          data-state={isPlaying ? 'playing' : 'paused'}
          className="w-full h-[140px] rounded-lg bg-[#0B0B0D] border border-white/[0.06]"
        />
      </section>

      {/* EQ Presets */}
      <section aria-label="Equalizer Presets" className="space-y-3">
        <h2 className="text-xs font-medium text-[#8C8C96]">Voicing Presets</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {EQ_PRESETS.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset.bands)}
                aria-pressed={active}
                className={`p-3.5 rounded-xl border text-left transition-colors ${
                  active
                    ? 'bg-[#1D1D23] border-[#E85D3F] text-[#F4F4F6]'
                    : 'bg-[#131316] border-white/[0.08] text-[#C4C4CC] hover:border-white/20'
                }`}
              >
                <p className="text-sm font-semibold truncate">{preset.name}</p>
                <p className="text-xs text-[#7C7C87] mt-1 line-clamp-2">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5-Band Sliders */}
      <section
        aria-label="Frequency Bands"
        className="p-6 rounded-xl bg-[#131316] border border-white/[0.08]"
      >
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
          {BAND_META.map((band) => {
            const val = eqBands[band.key];
            const formatted = `${val > 0 ? '+' : ''}${val.toFixed(1)} dB`;
            const pct = ((val + 12) / 24) * 100;
            return (
              <div
                key={band.key}
                className="flex flex-col gap-3 py-2 sm:py-0 border-b sm:border-b-0 border-white/[0.05] last:border-b-0"
              >
                <div className="flex sm:flex-col items-baseline sm:items-center justify-between gap-1">
                  <div className="sm:text-center">
                    <label
                      htmlFor={`eq-${band.key}`}
                      className="block font-mono text-xs font-semibold text-[#F4F4F6]"
                    >
                      {band.label}
                    </label>
                    <span className="text-[11px] text-[#7C7C87]">{band.role}</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-[#E85D3F]">
                    {formatted}
                  </span>
                </div>

                <div className="relative flex items-center w-full h-6">
                  {/* Center 0 dB reference tick */}
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/25 pointer-events-none"
                  />
                  <input
                    id={`eq-${band.key}`}
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={val}
                    onChange={(e) =>
                      onChangeBand(band.key, clampEqGain(Number(e.target.value)))
                    }
                    aria-label={`${band.label} ${band.role} gain`}
                    style={{
                      background: `linear-gradient(to right, rgba(255,255,255,0.14) ${Math.min(
                        50,
                        pct
                      )}%, #E85D3F ${Math.min(50, pct)}%, #E85D3F ${Math.max(
                        50,
                        pct
                      )}%, rgba(255,255,255,0.14) ${Math.max(50, pct)}%)`,
                    }}
                    className="studio-range w-full h-1 rounded-full relative z-10"
                  />
                </div>

                <div className="hidden sm:flex justify-between font-mono text-[10px] tabular-nums text-[#6E6E78]">
                  <span>-12</span>
                  <span>0</span>
                  <span>+12</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
