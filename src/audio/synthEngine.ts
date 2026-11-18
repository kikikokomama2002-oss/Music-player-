import type { EqBands, Track } from '../types/music';

class StudioSynthEngine {
  private ctx: AudioContext | null = null;
  private filters: BiquadFilterNode[] = [];
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private stepTimer: number | null = null;
  private stepIndex = 0;
  private currentTrack: Track | null = null;
  private isPlaying = false;
  private volume = 0.78;
  private muted = false;
  private eqBands: EqBands = {
    hz60: 0,
    hz230: 0,
    hz910: 0,
    hz3600: 0,
    hz14000: 0,
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        const ctx = new AudioCtx();
        const master = ctx.createGain();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;

        const f60 = ctx.createBiquadFilter();
        f60.type = 'lowshelf';
        f60.frequency.value = 60;
        f60.gain.value = this.eqBands.hz60;

        const f230 = ctx.createBiquadFilter();
        f230.type = 'peaking';
        f230.frequency.value = 230;
        f230.Q.value = 1.1;
        f230.gain.value = this.eqBands.hz230;

        const f910 = ctx.createBiquadFilter();
        f910.type = 'peaking';
        f910.frequency.value = 910;
        f910.Q.value = 1.1;
        f910.gain.value = this.eqBands.hz910;

        const f3600 = ctx.createBiquadFilter();
        f3600.type = 'peaking';
        f3600.frequency.value = 3600;
        f3600.Q.value = 1.1;
        f3600.gain.value = this.eqBands.hz3600;

        const f14000 = ctx.createBiquadFilter();
        f14000.type = 'highshelf';
        f14000.frequency.value = 14000;
        f14000.gain.value = this.eqBands.hz14000;

        f60.connect(f230);
        f230.connect(f910);
        f910.connect(f3600);
        f3600.connect(f14000);
        f14000.connect(master);
        master.connect(analyser);
        analyser.connect(ctx.destination);

        master.gain.value = this.muted ? 0 : this.volume * 0.25;

        this.ctx = ctx;
        this.filters = [f60, f230, f910, f3600, f14000];
        this.masterGain = master;
        this.analyser = analyser;
      } catch {
        return null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public start(track: Track): void {
    this.currentTrack = track;
    this.isPlaying = true;
    this.stepIndex = 0;
    this.ensureContext();
    this.stopScheduler();

    const stepMs = Math.max(220, Math.round((60 / track.bpm) * 1000 * 0.5));
    this.triggerMusicalStep();
    this.stepTimer = window.setInterval(() => {
      if (this.isPlaying && this.currentTrack) {
        this.triggerMusicalStep();
      }
    }, stepMs);
  }

  public pause(): void {
    this.isPlaying = false;
    this.stopScheduler();
  }

  public stop(): void {
    this.isPlaying = false;
    this.stopScheduler();
  }

  public setVolume(vol: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setTargetAtTime(
          this.muted ? 0 : this.volume * 0.25,
          this.ctx.currentTime,
          0.03
        );
      } catch {
        // Ignore if context closed
      }
    }
  }

  public setEqBands(bands: EqBands): void {
    this.eqBands = bands;
    if (this.filters.length === 5 && this.ctx) {
      const vals = [
        bands.hz60,
        bands.hz230,
        bands.hz910,
        bands.hz3600,
        bands.hz14000,
      ];
      vals.forEach((db, idx) => {
        try {
          this.filters[idx].gain.setTargetAtTime(db, this.ctx!.currentTime, 0.04);
        } catch {
          // Ignore
        }
      });
    }
  }

  public getFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser || !this.isPlaying) return false;
    try {
      this.analyser.getByteFrequencyData(target);
      return true;
    } catch {
      return false;
    }
  }

  private stopScheduler(): void {
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private triggerMusicalStep(): void {
    const ctx = this.ctx;
    const track = this.currentTrack;
    const inputNode = this.filters[0];
    if (!ctx || !track || !inputNode || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const root = track.rootHz;
    // Musical intervals (minor 9th / pentatonic voicings)
    const chordProgression = [
      [1, 1.189, 1.498, 1.781],
      [0.891, 1.059, 1.335, 1.682],
      [0.794, 1.0, 1.189, 1.498],
      [0.944, 1.122, 1.414, 1.781],
    ];
    const bar = Math.floor(this.stepIndex / 8) % chordProgression.length;
    const beat = this.stepIndex % 8;
    const chord = chordProgression[bar];

    if (beat === 0) {
      // Warm chord pad / Rhodes sustain on bar downbeat
      chord.forEach((ratio, i) => {
        this.playVoice(
          ctx,
          inputNode,
          root * ratio * (i === 0 ? 1 : 2),
          now,
          track.synthProfile === 'analog-pad' ? 2.4 : 1.4,
          track.synthProfile === 'brass-quartet' ? 'sawtooth' : 'triangle',
          track.synthProfile === 'warm-rhodes' ? 0.14 : 0.11,
          track.synthProfile === 'analog-pad' ? 750 : 1200
        );
      });
    }

    // Melodic motif / pulse
    const arpNote = chord[beat % chord.length];
    if (track.synthProfile === 'dub-pulse' && beat % 2 === 0) {
      this.playVoice(ctx, inputNode, root * 0.5, now, 0.35, 'sine', 0.28, 320);
    }
    if (beat % 2 === 1 || track.synthProfile === 'nylon-pluck') {
      const wave: OscillatorType =
        track.synthProfile === 'nylon-pluck'
          ? 'triangle'
          : track.synthProfile === 'brass-quartet'
          ? 'sawtooth'
          : 'sine';
      this.playVoice(
        ctx,
        inputNode,
        root * arpNote * 2,
        now,
        0.55,
        wave,
        0.09,
        1800
      );
    }

    this.stepIndex += 1;
  }

  private playVoice(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    peakGain: number,
    cutoffHz: number
  ): void {
    try {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const env = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(cutoffHz, startTime);

      env.gain.setValueAtTime(0.0001, startTime);
      env.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(lpf);
      lpf.connect(env);
      env.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch {
      // Ignore audio scheduling failure
    }
  }
}

export const synthEngine = new StudioSynthEngine();
