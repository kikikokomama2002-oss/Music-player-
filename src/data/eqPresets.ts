import type { EqPreset } from '../types/music';

export const EQ_PRESETS: EqPreset[] = [
  {
    id: 'flat',
    name: 'Flat Reference',
    description: 'Neutral studio response with zero coloration.',
    bandGainsDb: [0, 0, 0, 0, 0],
  },
  {
    id: 'warm-analog',
    name: 'Warm Analog',
    description: 'Low-mid bloom with smooth, rolled-off treble.',
    bandGainsDb: [2.5, 3.5, 0.5, -1.5, -2.0],
  },
  {
    id: 'late-night',
    name: 'Late Night',
    description: 'Full low-end presence at quiet listening levels.',
    bandGainsDb: [4.0, 1.5, -1.0, 1.0, -1.0],
  },
  {
    id: 'acoustic-presence',
    name: 'Acoustic Presence',
    description: 'Articulate midrange and airy harmonic detail.',
    bandGainsDb: [-1.5, 0, 2.5, 3.5, 2.0],
  },
  {
    id: 'sub-punch',
    name: 'Sub & Punch',
    description: 'Extended sub-bass weight and crisp transients.',
    bandGainsDb: [5.5, 2.0, -1.5, 1.5, 3.0],
  },
];
