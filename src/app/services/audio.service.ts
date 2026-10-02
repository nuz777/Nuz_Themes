import { Injectable, inject, signal } from '@angular/core';
import type { Track } from '../models/track';
import { OfflineStorageService } from './offline-storage.service';
import { EqualizerService } from './equalizer.service';

type RepeatMode = 'off' | 'all' | 'one';

@Injectable({ providedIn: 'root' })
export class AudioService {
  readonly currentTrack = signal<Track | null>(null);
  readonly queue = signal<Track[]>([]);
  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly volume = signal(0.7);
  readonly shuffle = signal(false);
  readonly repeat = signal<RepeatMode>('off');
  readonly showNowPlaying = signal(false);
  readonly playbackError = signal(false);
  readonly loading = signal(false);

  private readonly offline = inject(OfflineStorageService);
  private readonly equalizer = inject(EqualizerService);

  private audio: HTMLAudioElement | null = null;
  private queueIndex = -1;
  private warmers = new Map<string, HTMLAudioElement>();

  get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  get element(): HTMLAudioElement | null {
    return this.audio;
  }

  openNowPlaying(): void {
    this.showNowPlaying.set(true);
  }

  closeNowPlaying(): void {
    this.showNowPlaying.set(false);
  }

  /**
   * Empieza a descargar el audio de una canción antes de que la reproduzcas
   * (al pasar el mouse o el foco por encima). En redes lentas esto hace que
   * el clic suene casi al instante porque la descarga ya viene en camino.
   */
  warm(track: Track): void {
    if (!this.isBrowser) return;
    if (!track.audioUrl || this.warmers.has(track.id)) return;
    if (this.currentTrack()?.id === track.id) return;
    if (this.offline.isDownloaded(track.id) || this.offline.isDeviceDownloaded(track.id)) return;

    const el = new Audio();
    el.preload = 'auto';
    el.src = track.audioUrl;
    el.load();
    this.warmers.set(track.id, el);
    this.trimWarmers(track.id);
  }

  private trimWarmers(keepId: string): void {
    while (this.warmers.size > 3) {
      const oldest = this.warmers.keys().next().value;
      if (oldest === undefined || oldest === keepId) break;
      const el = this.warmers.get(oldest);
      if (el) {
        el.removeAttribute('src');
        el.load();
      }
      this.warmers.delete(oldest);
    }
  }

  playTrack(track: Track, queue?: Track[]): void {
    if (!this.isBrowser) return;

    this.ensureAudio();

    if (queue && queue.length) {
      this.queue.set(queue);
      this.queueIndex = queue.findIndex((t) => t.id === track.id);
    }

    if (this.currentTrack()?.id === track.id) {
      if (!this.isPlaying()) void this.audio!.play();
      return;
    }

    this.currentTrack.set(track);
    const url = this.warmers.get(track.id);
    this.warmers.delete(track.id);
    if (url) {
      url.removeAttribute('src');
      url.load();
    }

    void this.loadAndPlay(track);
    this.warmNext();
  }

  /** Precarga la siguiente canción de la cola para que el cambio sea instantáneo. */
  private warmNext(): void {
    const q = this.queue();
    if (!q.length || this.queueIndex < 0) return;
    const nextIndex = this.queueIndex + 1;
    if (nextIndex >= q.length) return;
    const next = q[nextIndex];
    if (next) this.warm(next);
  }

  private async loadAndPlay(track: Track): Promise<void> {
    // Se pide la fuente sin esperar a IndexedDB: el audio online es el caso común.
    const src = this.offline.isDownloaded(track.id)
      ? await this.offline.resolveSourceUrl(track)
      : track.audioUrl;
    if (this.currentTrack()?.id !== track.id) return;

    this.audio!.preload = 'auto';
    this.audio!.src = src;
    this.audio!.load();
    this.equalizer.resume();
    try {
      await this.audio!.play();
    } catch {
      this.playbackError.set(true);
    }
  }

  playQueue(queue: Track[], startIndex = 0): void {
    if (!queue.length) return;
    this.queue.set(queue);
    this.queueIndex = startIndex;
    this.playTrack(queue[startIndex]);
  }

  togglePlay(): void {
    if (!this.audio || !this.currentTrack()) return;
    if (this.isPlaying()) {
      this.audio.pause();
    } else {
      void this.audio.play();
    }
  }

  next(): void {
    const q = this.queue();
    if (!q.length || this.queueIndex < 0) return;

    const mode = this.repeat();
    let nextIndex = this.queueIndex + 1;

    if (nextIndex >= q.length) {
      if (mode === 'all') {
        nextIndex = 0;
      } else {
        this.audio?.pause();
        this.isPlaying.set(false);
        this.currentTime.set(0);
        return;
      }
    }

    this.queueIndex = nextIndex;
    this.playTrack(q[nextIndex]);
  }

  prev(): void {
    const q = this.queue();
    if (!q.length || this.queueIndex < 0) return;

    if (this.currentTime() > 3) {
      this.seek(0);
      return;
    }

    let prevIndex = this.queueIndex - 1;
    if (prevIndex < 0) prevIndex = q.length - 1;

    this.queueIndex = prevIndex;
    this.playTrack(q[prevIndex]);
  }

  seek(time: number): void {
    if (!this.audio) return;
    this.audio.currentTime = time;
    this.currentTime.set(time);
  }

  seekBy(seconds: number): void {
    const duration = this.duration();
    const target = Math.max(0, this.currentTime() + seconds);
    this.seek(duration > 0 ? Math.min(duration, target) : target);
  }

  setVolume(value: number): void {
    this.volume.set(value);
    if (this.audio) this.audio.volume = value;
  }

  toggleShuffle(): void {
    this.shuffle.update((v) => !v);
    if (this.shuffle()) this.shuffleQueue();
  }

  toggleRepeat(): void {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const current = modes.indexOf(this.repeat());
    this.repeat.set(modes[(current + 1) % modes.length]);
  }

  private ensureAudio(): void {
    if (this.audio) return;

    this.audio = new Audio();
    this.audio.volume = this.volume();
    this.audio.preload = 'metadata';
    this.equalizer.attach(this.audio);

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime.set(this.audio!.currentTime);
    });
    this.audio.addEventListener('loadedmetadata', () => {
      this.duration.set(this.audio!.duration || 0);
    });
    this.audio.addEventListener('durationchange', () => {
      this.duration.set(this.audio!.duration || 0);
    });
    this.audio.addEventListener('play', () => this.isPlaying.set(true));
    this.audio.addEventListener('pause', () => this.isPlaying.set(false));
    this.audio.addEventListener('playing', () => this.playbackError.set(false));
    this.audio.addEventListener('error', () => this.playbackError.set(true));
    this.audio.addEventListener('loadstart', () => this.loading.set(true));
    this.audio.addEventListener('waiting', () => this.loading.set(true));
    this.audio.addEventListener('playing', () => this.loading.set(false));
    this.audio.addEventListener('canplay', () => this.loading.set(false));
    this.audio.addEventListener('loadeddata', () => this.loading.set(false));
    this.audio.addEventListener('error', () => this.loading.set(false));
    this.audio.addEventListener('ended', () => this.handleEnded());
  }

  private handleEnded(): void {
    if (this.repeat() === 'one') {
      if (this.audio) {
        this.audio.currentTime = 0;
        void this.audio.play();
      }
      return;
    }
    this.next();
  }

  private shuffleQueue(): void {
    const q = this.queue();
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    this.queue.set(q);
  }
}
