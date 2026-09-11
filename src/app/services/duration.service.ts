import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DurationService {
  readonly durations = signal<Record<string, number>>({});

  private readonly loading = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  durationOf(id: string): number {
    return this.durations()[id] ?? 0;
  }

  preload(tracks: { id: string; audioUrl: string }[]): void {
    if (!this.isBrowser) return;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.loadMissing(tracks);
    }, 120);
  }

  private loadMissing(tracks: { id: string; audioUrl: string }[]): void {
    const now = this.durations();

    for (const track of tracks) {
      if (now[track.id] !== undefined) continue;
      if (this.loading.has(track.id)) continue;
      this.loadMetadata(track);
    }
  }

  private loadMetadata(track: { id: string; audioUrl: string }): void {
    if (typeof Audio === 'undefined') return;

    this.loading.add(track.id);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = 0;
    audio.muted = true;

    audio.addEventListener(
      'loadedmetadata',
      () => {
        this.store(track.id, audio.duration);
        this.cleanup(audio, track.id);
      },
      { once: true },
    );
    audio.addEventListener('error', () => this.cleanup(audio, track.id), { once: true });

    audio.src = track.audioUrl;
  }

  private store(id: string, duration: number): void {
    if (!Number.isFinite(duration) || duration <= 0) return;
    this.durations.update((prev) => ({ ...prev, [id]: duration }));
  }

  private cleanup(audio: HTMLAudioElement, id: string): void {
    this.loading.delete(id);
    audio.src = '';
    audio.load();
  }
}