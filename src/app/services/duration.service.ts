import { Injectable, inject, signal } from '@angular/core';
import { TracksService } from './tracks.service';

export interface DurationTarget {
  id: string;
  audioUrl: string;
}

const CACHE_KEY = 'nuz-durations-cache';

@Injectable({ providedIn: 'root' })
export class DurationService {
  private readonly tracksService = inject(TracksService);
  readonly durations = signal<Record<string, number>>(this.loadCachedDurations());

  private readonly inFlight = new Set<string>();
  private readonly queue: DurationTarget[] = [];
  private isProcessing = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  durationOf(id: string): number {
    return this.durations()[id] ?? 0;
  }

  store(id: string, duration: number): void {
    const dur = Math.round(duration);
    if (!Number.isFinite(dur) || dur <= 0) return;
    if (this.durations()[id] === dur) return;

    this.durations.update((prev) => {
      const next = { ...prev, [id]: dur };
      this.persistCache(next);
      return next;
    });

    this.tracksService.updateTrackDuration(id, dur);
  }

  preload(tracks: DurationTarget[]): void {
    if (!this.isBrowser) return;

    let added = false;
    for (const track of tracks) {
      if (!track?.id || !track.audioUrl) continue;
      if (this.durations()[track.id]) continue;
      if (this.inFlight.has(track.id)) continue;
      if (this.queue.some((q) => q.id === track.id)) continue;

      this.queue.push(track);
      added = true;
    }

    if (added && !this.isProcessing) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.processQueue();
      }, 50);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // Procesar hasta 4 pistas simultáneamente en paralelo
        const batch = this.queue.splice(0, 4);
        await Promise.allSettled(
          batch.map(async (track) => {
            if (this.durations()[track.id]) return;
            this.inFlight.add(track.id);
            try {
              const dur = await this.fetchDuration(track.audioUrl);
              if (dur > 0) {
                this.store(track.id, dur);
              }
            } finally {
              this.inFlight.delete(track.id);
            }
          }),
        );
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private fetchDuration(audioUrl: string): Promise<number> {
    if (typeof Audio === 'undefined') return Promise.resolve(0);

    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.volume = 0;
      audio.muted = true;

      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        audio.removeAttribute('src');
        try { audio.load(); } catch {}
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve(0);
      }, 3500);

      const done = (dur: number) => {
        cleanup();
        resolve(Math.round(dur) || 0);
      };

      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          done(audio.duration);
        }
      };

      audio.ondurationchange = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          done(audio.duration);
        }
      };

      audio.oncanplay = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          done(audio.duration);
        }
      };

      audio.onerror = () => done(0);
      audio.onstalled = () => done(0);

      try {
        audio.src = audioUrl;
      } catch {
        done(0);
      }
    });
  }

  private loadCachedDurations(): Record<string, number> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private persistCache(data: Record<string, number>): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }
}
