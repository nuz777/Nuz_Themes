import { Injectable, computed, signal } from '@angular/core';

export interface EQBand {
  label: string;
  frequency: number;
  type: BiquadFilterType;
}

export interface EQPreset {
  id: string;
  label: string;
  gains: number[];
}

const BANDS: EQBand[] = [
  { label: '60', frequency: 60, type: 'lowshelf' },
  { label: '200', frequency: 200, type: 'peaking' },
  { label: '600', frequency: 600, type: 'peaking' },
  { label: '1.5K', frequency: 1500, type: 'peaking' },
  { label: '4K', frequency: 4000, type: 'peaking' },
  { label: '12K', frequency: 12000, type: 'highshelf' },
];

export const EQ_PRESETS: EQPreset[] = [
  { id: 'flat', label: 'Plano', gains: [0, 0, 0, 0, 0, 0] },
  { id: 'bass', label: 'Graves', gains: [6, 4, 2, 0, -1, -2] },
  { id: 'treble', label: 'Agudos', gains: [-2, -1, 0, 2, 4, 6] },
  { id: 'pop', label: 'Pop', gains: [-2, 2, 4, 4, 2, -2] },
  { id: 'rock', label: 'Rock', gains: [5, 3, -2, -2, 3, 4] },
];

@Injectable({ providedIn: 'root' })
export class EqualizerService {
  readonly bandValues = BANDS.map(() => signal(0));
  readonly enabled = signal(false);
  readonly activePreset = signal<'flat' | 'custom' | string>('flat');

  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private master: GainNode | null = null;
  private attached = false;

  get isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  get isSupported(): boolean {
    if (!this.isBrowser) return false;
    return !!(window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  }

  get isAttached(): boolean {
    return this.attached;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get audioSource(): MediaElementAudioSourceNode | null {
    return this.source;
  }

  get masterGain(): GainNode | null {
    return this.master;
  }

  readonly flat = computed(() => this.bandValues.every((b) => Math.abs(b()) < 0.01));

  attach(element: HTMLAudioElement): void {
    if (this.attached || !this.isSupported) return;

    const Ctor =
      window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    this.ctx = ctx;
    this.source = ctx.createMediaElementSource(element);

    this.filters = BANDS.map((band) => {
      const filter = ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.Q.value = 1.1;
      filter.gain.value = 0;
      return filter;
    });

    this.master = ctx.createGain();
    this.master.gain.value = 1;

    let node: AudioNode = this.source;
    for (const filter of this.filters) {
      node.connect(filter);
      node = filter;
    }
    node.connect(this.master);
    this.master.connect(ctx.destination);

    this.attached = true;
  }

  setBand(index: number, value: number): boolean {
    if (!this.attached || index < 0 || index >= this.bandValues.length) return false;
    const clamped = Math.max(-12, Math.min(12, value));
    this.bandValues[index].set(clamped);
    this.activePreset.set('custom');
    this.applyBand(index);
    return true;
  }

  applyPreset(id: string): void {
    const preset = EQ_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    this.bandValues.forEach((band, i) => band.set(preset.gains[i] ?? 0));
    this.activePreset.set(id);
    if (this.attached) this.filters.forEach((_, i) => this.applyBand(i));
  }

  reset(): void {
    this.applyPreset('flat');
  }

  setEnabled(value: boolean): void {
    this.enabled.set(value);
    if (!this.attached) return;
    this.filters.forEach((filter, i) => {
      filter.gain.setTargetAtTime(value ? this.bandValues[i]() : 0, this.ctx!.currentTime, 0.01);
    });
  }

  setVolume(value: number): void {
    if (!this.master) return;
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx!.currentTime, 0.01);
  }

  private applyBand(index: number): void {
    if (!this.ctx) return;
    const gain = this.enabled() ? this.bandValues[index]() : 0;
    this.filters[index].gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01);
  }
}