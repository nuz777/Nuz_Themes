import { Injectable, signal } from '@angular/core';

interface DurationTarget {
  id: string;
  audioUrl: string;
}

@Injectable({ providedIn: 'root' })
export class DurationService {
  readonly durations = signal<Record<string, number>>({});

  private readonly loading = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: DurationTarget[] = [];
  private running = false;

  get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  durationOf(id: string): number {
    return this.durations()[id] ?? 0;
  }

  preload(tracks: DurationTarget[]): void {
    if (!this.isBrowser) return;

    this.pending = tracks;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.schedule();
    }, 120);
  }

  /** Se espera a que el navegador esté libre para no competir con la reproducción. */
  private schedule(): void {
    const run = (): void => {
      void this.run();
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 3000 });
    } else {
      run();
    }
  }

  /**
   * Las duraciones se leen de a una: pedir la metadata de toda la lista a la vez
   * saturaba la conexión y retrasaba la canción que el usuario acababa de elegir.
   */
  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      for (const track of this.pending) {
        if (this.durations()[track.id] !== undefined) continue;
        if (this.loading.has(track.id)) continue;
        if (!track.audioUrl) continue;

        await this.loadMetadata(track);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } finally {
      this.running = false;
    }
  }

  private loadMetadata(track: DurationTarget): Promise<void> {
    if (typeof Audio === 'undefined') return Promise.resolve();

    this.loading.add(track.id);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = 0;
    audio.muted = true;

    return new Promise((resolve) => {
      const done = (): void => {
        this.cleanup(audio, track.id);
        resolve();
      };

      audio.addEventListener('loadedmetadata', () => {
        this.store(track.id, audio.duration);
        done();
      });
      audio.addEventListener('error', done);
      audio.addEventListener('stalled', done);

      audio.src = track.audioUrl;
    });
  }

  private store(id: string, duration: number): void {
    if (!Number.isFinite(duration) || duration <= 0) return;
    this.durations.update((prev) => ({ ...prev, [id]: duration }));
  }

  private cleanup(audio: HTMLAudioElement, id: string): void {
    this.loading.delete(id);
    audio.removeAttribute('src');
    audio.load();
  }
}
