import { Injectable, signal } from '@angular/core';
import type { Track } from '../models/track';

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

  private audio: HTMLAudioElement | null = null;
  private queueIndex = -1;

  get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  openNowPlaying(): void {
    this.showNowPlaying.set(true);
  }

  closeNowPlaying(): void {
    this.showNowPlaying.set(false);
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
    this.audio!.src = track.audioUrl;
    this.audio!.load();
    void this.audio!.play();
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
