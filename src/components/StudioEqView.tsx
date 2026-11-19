import { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { EQ_PRESETS } from '../data/eqPresets';
import { playbackBridge } from '../services/playbackBridge';
import type { AudioEffectsState, Track } from '../types/music';

interface StudioEqViewProps {
  effects: AudioEffectsState;
  isPlaying: boolean;
  currentTrack: Track | null;
  onToggleEnabled: (enabled: boolean) => void;
  onChangeBand: (bandIndex: number, levelMb: number) => void;
  onApplyPreset: (bandGainsDb: number[]) => void;
  onChangeBassBoost: (strength: number) => void;
  onChangeVirtualizer: (strength: number) => void;
}

export function StudioEqView({
  effects,
  isPlaying,
  currentTrack,
  onToggleEnabled,
  onChangeBand,
  onApplyPreset,
  onChangeBassBoost,
  onChangeVirtualizer,
}: StudioEqViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (playbackBridge.isNativeAndroid) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const freqData = new Uint8Array(64);

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(140, 140, 150, 0.16)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const y = Math.round((height / 4) * i) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const hasAudio = playbackBridge.getWebFrequencyData(freqData);
      const barCount = 40;
      const gap = 4;
      const barWidth = (width - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        let energy = 0.08;
        if (isPlaying && hasAudio) {
          energy = Math.max(0.08, freqData[i % freqData.length] / 255);
        } else {
          const bandIdx = Math.min(
            effects.bands.length - 1,
            Math.floor((i / barCount) * Math.max(1, effects.bands.length))
          );
          const db = (effects.bands[bandIdx]?.levelMb ?? 0) / 100;
          energy = Math.max(0.06, Math.min(0.45, 0.16 + db / 30));
        }

        const barH = Math.max(4, energy * (height - 16));
        const x = i * (barWidth + gap);
        const y = height - barH;
        ctx.fillStyle =
          isPlaying && energy > 0.65 ? '#E85D3F' : 'rgba(156, 156, 166, 0.45)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 2);
        ctx.fill();
      }

      if (isPlaying) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isPlaying, effects.bands]);

  const minDb = effects.minLevelMb / 100;
  const maxDb = effects.maxLevelMb / 100;

  return (
    <div className="px-4 sm:px-8 py-6 space-y-7 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-white/[0.08]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6]">
            Audio Effects & Equalizer
          </h1>
          <p className="text-sm text-zinc-600 dark:text-[#8C8C96] mt-1">
            {playbackBridge.isNativeAndroid
              ? 'Hardware AudioEffect Equalizer, Bass Boost, and Virtualizer bound to ExoPlayer.'
              : 'Real-time 5-band Web Audio BiquadFilter stage.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onToggleEnabled(!effects.enabled)}
            aria-pressed={effects.enabled}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              effects.enabled
                ? 'bg-[#E85D3F] text-white'
                : 'border border-zinc-300 dark:border-white/[0.12] text-zinc-700 dark:text-[#C4C4CC]'
            }`}
          >
            {effects.enabled ? 'Effects On' : 'Effects Bypassed'}
          </button>

          <button
            type="button"
            onClick={() => onApplyPreset(EQ_PRESETS[0].bandGainsDb)}
            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-white/[0.1] text-xs font-medium text-zinc-700 dark:text-[#C4C4CC] inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Live Web Spectrum (Browser Mode) */}
      {!playbackBridge.isNativeAndroid && (
        <section className="p-5 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-zinc-800 dark:text-[#C4C4CC]">
              {currentTrack
                ? `${currentTrack.title} — ${currentTrack.artist}`
                : 'No track active'}
            </span>
            <span className="font-mono text-zinc-500 dark:text-[#7C7C87]">
              {isPlaying ? 'Output Active' : 'Standby'}
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={800}
            height={120}
            data-testid="spectrum-canvas"
            data-state={isPlaying ? 'playing' : 'paused'}
            className="w-full h-[120px] rounded-lg bg-zinc-100 dark:bg-[#0B0B0D] border border-zinc-200 dark:border-white/[0.06]"
          />
        </section>
      )}

      {/* Presets */}
      <section aria-label="Equalizer Presets" className="space-y-3">
        <h2 className="text-xs font-medium text-zinc-500 dark:text-[#8C8C96]">
          Voicing Presets
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {EQ_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={!effects.equalizerSupported}
              onClick={() => onApplyPreset(preset.bandGainsDb)}
              className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#131316] hover:border-[#E85D3F] text-left transition-colors disabled:opacity-45"
            >
              <p className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6] truncate">
                {preset.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-[#7C7C87] mt-1">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Equalizer Bands */}
      <section
        aria-label="Equalizer Frequency Bands"
        className="p-6 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08]"
      >
        {!effects.equalizerSupported || effects.bands.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-[#9C9CA6]">
            {playbackBridge.isNativeAndroid
              ? 'Start playing a track to bind Android hardware Equalizer bands, or this device does not expose an AudioEffect Equalizer.'
              : 'Equalizer unavailable in this browser audio context.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
            {effects.bands.map((band) => {
              const db = band.levelMb / 100;
              const formatted = `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
              const pct = ((db - minDb) / Math.max(1, maxDb - minDb)) * 100;
              const label =
                band.centerFreqHz >= 1000
                  ? `${(band.centerFreqHz / 1000).toFixed(1)} kHz`
                  : `${band.centerFreqHz} Hz`;

              return (
                <div
                  key={band.index}
                  className="flex flex-col gap-3 py-2 sm:py-0 border-b sm:border-b-0 border-zinc-200 dark:border-white/[0.05] last:border-b-0"
                >
                  <div className="flex sm:flex-col items-baseline sm:items-center justify-between gap-1">
                    <label
                      htmlFor={`eq-band-${band.index}`}
                      className="font-mono text-xs font-semibold text-zinc-900 dark:text-[#F4F4F6]"
                    >
                      {label}
                    </label>
                    <span className="font-mono text-xs tabular-nums text-[#E85D3F]">
                      {formatted}
                    </span>
                  </div>

                  <div className="relative flex items-center w-full h-6">
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-3 bg-zinc-400/50 dark:bg-white/25 pointer-events-none"
                    />
                    <input
                      id={`eq-band-${band.index}`}
                      type="range"
                      min={effects.minLevelMb}
                      max={effects.maxLevelMb}
                      step={50}
                      value={band.levelMb}
                      disabled={!effects.enabled}
                      onChange={(e) =>
                        onChangeBand(band.index, Number(e.target.value))
                      }
                      style={{
                        background: `linear-gradient(to right, rgba(160,160,170,0.22) ${Math.min(
                          50,
                          pct
                        )}%, #E85D3F ${Math.min(50, pct)}%, #E85D3F ${Math.max(
                          50,
                          pct
                        )}%, rgba(160,160,170,0.22) ${Math.max(50, pct)}%)`,
                      }}
                      className="studio-range w-full h-1 rounded-full relative z-10 disabled:opacity-40"
                    />
                  </div>

                  <div className="hidden sm:flex justify-between font-mono text-[10px] tabular-nums text-zinc-500 dark:text-[#6E6E78]">
                    <span>{minDb}</span>
                    <span>0</span>
                    <span>+{maxDb}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bass Boost & Virtualizer */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="bass-boost-slider"
              className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6]"
            >
              Bass Boost
            </label>
            <span className="font-mono text-xs tabular-nums text-[#E85D3F]">
              {effects.bassBoostSupported
                ? `${Math.round((effects.bassBoostStrength / 1000) * 100)}%`
                : 'Unavailable'}
            </span>
          </div>
          {effects.bassBoostSupported ? (
            <input
              id="bass-boost-slider"
              type="range"
              min={0}
              max={1000}
              step={25}
              value={effects.bassBoostStrength}
              disabled={!effects.enabled}
              onChange={(e) => onChangeBassBoost(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, #E85D3F ${
                  (effects.bassBoostStrength / 1000) * 100
                }%, rgba(160,160,170,0.22) ${
                  (effects.bassBoostStrength / 1000) * 100
                }%)`,
              }}
              className="studio-range w-full h-1 rounded-full disabled:opacity-40"
            />
          ) : (
            <p className="text-xs text-zinc-500 dark:text-[#7C7C87]">
              Hardware Bass Boost is not supported by this output device.
            </p>
          )}
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="virtualizer-slider"
              className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6]"
            >
              Spatial Virtualizer
            </label>
            <span className="font-mono text-xs tabular-nums text-[#E85D3F]">
              {effects.virtualizerSupported
                ? `${Math.round((effects.virtualizerStrength / 1000) * 100)}%`
                : 'Unavailable'}
            </span>
          </div>
          {effects.virtualizerSupported ? (
            <input
              id="virtualizer-slider"
              type="range"
              min={0}
              max={1000}
              step={25}
              value={effects.virtualizerStrength}
              disabled={!effects.enabled}
              onChange={(e) => onChangeVirtualizer(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, #E85D3F ${
                  (effects.virtualizerStrength / 1000) * 100
                }%, rgba(160,160,170,0.22) ${
                  (effects.virtualizerStrength / 1000) * 100
                }%)`,
              }}
              className="studio-range w-full h-1 rounded-full disabled:opacity-40"
            />
          ) : (
            <p className="text-xs text-zinc-500 dark:text-[#7C7C87]">
              {playbackBridge.isNativeAndroid
                ? 'Hardware Virtualizer is not supported on this Android audio device.'
                : 'Spatial Virtualizer requires native Android AudioEffect hardware.'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
