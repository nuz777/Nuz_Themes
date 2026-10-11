import { Injectable, inject, signal } from '@angular/core';
import type { Track } from '../models/track';
import { OfflineStorageService } from './offline-storage.service';
import { EqualizerService } from './equalizer.service';
import { AudioQualityService, type AudioQuality } from './audio-quality.service';
import { CoverCacheService } from './cover-cache.service';
import { DurationService } from './duration.service';
import { TracksService } from './tracks.service';

type RepeatMode = 'off' | 'all' | 'one';

const STORAGE_PREFIX = 'nuz-player-';
const KEY_TRACK_ID = `${STORAGE_PREFIX}track-id`;
const KEY_QUEUE = `${STORAGE_PREFIX}queue`;
const KEY_QUEUE_INDEX = `${STORAGE_PREFIX}queue-index`;
const KEY_QUEUE_TITLE = `${STORAGE_PREFIX}queue-title`;
const KEY_SHOW_LIVE_QUEUE = `${STORAGE_PREFIX}show-live-queue`;
const KEY_TIME = `${STORAGE_PREFIX}current-time`;
const KEY_VOLUME = `${STORAGE_PREFIX}volume`;
const KEY_SHUFFLE = `${STORAGE_PREFIX}shuffle`;
const KEY_REPEAT = `${STORAGE_PREFIX}repeat`;

@Injectable({ providedIn: 'root' })
export class AudioService {
  readonly currentTrack = signal<Track | null>(null);
  readonly queue = signal<Track[]>([]);
  readonly queueIndex = signal<number>(-1);
  readonly queueTitle = signal<string>('Cola de reproducción');
  readonly showLiveQueue = signal<boolean>(false);
  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly volume = signal(0.7);
  readonly shuffle = signal(false);
  readonly repeat = signal<RepeatMode>('off');
  readonly showNowPlaying = signal(false);
  readonly playbackError = signal(false);
  readonly loading = signal(false);

  readonly qualityService = inject(AudioQualityService);
  private readonly offline = inject(OfflineStorageService);
  private readonly equalizer = inject(EqualizerService);
  private readonly coverCache = inject(CoverCacheService);
  private readonly durationService = inject(DurationService);
  private readonly tracksService = inject(TracksService);

  private audio: HTMLAudioElement | null = null;
  private lastTimeSave = 0;

  constructor() {
    this.restoreSavedSettings();
    if (this.isBrowser) {
      window.addEventListener('beforeunload', () => {
        this.persistCurrentPlaybackTime();
      });
      queueMicrotask(() => {
        void this.restorePlayerState();
      });
    }
  }

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
   * Precarga de manera silenciosa una canción en el almacenamiento local
   * para que al hacer clic se reproduzca de forma instantánea.
   */
  warm(track: Track): void {
    if (!this.isBrowser) return;
    if (!track.audioUrl) return;
    if (this.currentTrack()?.id === track.id) return;
    if (this.offline.isCached(track.id)) return;

    void this.offline.autoCache(track);
  }

  playTrack(track: Track, queue?: Track[], title?: string): void {
    if (!this.isBrowser) return;

    this.ensureAudio();

    if (queue && queue.length) {
      this.queue.set(queue);
      const foundIdx = queue.findIndex((t) => t.id === track.id);
      this.queueIndex.set(foundIdx >= 0 ? foundIdx : 0);
    }
    if (title) {
      this.queueTitle.set(title);
    }

    if (this.currentTrack()?.id === track.id) {
      if (this.audio) {
        if (this.audio.ended || Math.abs(this.audio.currentTime - (this.duration() || 0)) < 0.5) {
          this.audio.currentTime = 0;
          this.currentTime.set(0);
        }
        if (!this.isPlaying()) void this.audio.play();
      }
      return;
    }

    this.currentTrack.set(track);
    this.currentTime.set(0);

    this.persistTrackAndQueue(track);

    void this.loadAndPlay(track);
    this.warmNext();
  }

  /** Precarga la siguiente canción de la cola en IndexedDB para transición instantánea sin buffer. */
  private warmNext(): void {
    this.coverCache.preloadQueue(this.currentTrack(), this.queue());
    const q = this.queue();
    const curIdx = this.queueIndex();
    if (!q.length || curIdx < 0) return;
    let nextIndex = curIdx + 1;
    if (nextIndex >= q.length) nextIndex = 0;
    const next = q[nextIndex];
    if (next) this.warm(next);
  }

  private async loadAndPlay(track: Track): Promise<void> {
    let src: string;
    let isFromCache = false;

    if (track.id.startsWith('user-')) {
      src = await this.offline.resolveSourceUrl(track);
      if (!src) {
        src = track.audioUrl;
      }
    } else {
      const cached = await this.offline.resolveSourceUrl(track);
      if (cached && cached.startsWith('blob:')) {
        src = cached;
        isFromCache = true;
      } else {
        src = this.qualityService.resolveTrackUrl(track, this.qualityService.quality());
      }
    }

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

    // Si la pista se transmitió desde la red, guardarla silenciosamente en IndexedDB
    // para que jamás vuelva a cargarse por red.
    if (!isFromCache && !track.id.startsWith('user-')) {
      void this.offline.autoCache(track);
    }
  }

  /**
   * Cambia la calidad de audio en tiempo real. Si hay una canción sonando,
   * conmuta la fuente manteniendo la posición de reproducción exacta.
   */
  changeQuality(newQuality: AudioQuality): void {
    if (this.qualityService.quality() === newQuality) return;

    this.qualityService.setQuality(newQuality);

    const track = this.currentTrack();
    if (!track || !this.audio || track.id.startsWith('user-') || this.offline.isDownloaded(track.id)) {
      return;
    }

    const wasPlaying = this.isPlaying();
    const curTime = this.audio.currentTime || 0;
    const newSrc = this.qualityService.resolveTrackUrl(track, newQuality);

    if (this.audio.src !== newSrc) {
      this.audio.src = newSrc;
      this.audio.load();

      const onLoadedMetadata = () => {
        if (this.audio) {
          this.audio.currentTime = curTime;
          if (wasPlaying) {
            void this.audio.play();
          }
        }
      };
      this.audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    }
  }

  playQueue(queue: Track[], startIndex = 0, title?: string): void {
    if (!queue.length) return;
    this.queue.set(queue);
    this.queueIndex.set(startIndex);
    if (title) {
      this.queueTitle.set(title);
    }
    this.playTrack(queue[startIndex]);
  }

  playQueueIndex(index: number): void {
    const q = this.queue();
    if (index < 0 || index >= q.length) return;
    this.queueIndex.set(index);
    const track = q[index];
    if (this.currentTrack()?.id === track.id) {
      if (this.audio) {
        if (this.audio.ended || Math.abs(this.audio.currentTime - (this.duration() || 0)) < 0.5) {
          this.audio.currentTime = 0;
          this.currentTime.set(0);
        }
        if (!this.isPlaying()) {
          void this.audio.play();
        } else {
          this.audio.pause();
        }
      }
      return;
    }
    this.ensureAudio();
    this.currentTrack.set(track);
    this.currentTime.set(0);
    this.persistTrackAndQueue(track);
    void this.loadAndPlay(track);
    this.warmNext();
  }

  removeFromQueue(index: number): void {
    const q = [...this.queue()];
    if (index < 0 || index >= q.length) return;

    const curIdx = this.queueIndex();
    q.splice(index, 1);
    this.queue.set(q);

    if (q.length === 0) {
      this.stop();
      this.queueIndex.set(-1);
      return;
    }

    if (index < curIdx) {
      this.queueIndex.set(curIdx - 1);
      if (this.currentTrack()) {
        this.persistTrackAndQueue(this.currentTrack()!);
      }
    } else if (index === curIdx) {
      const nextIdx = index >= q.length ? 0 : index;
      this.playQueueIndex(nextIdx);
    } else {
      if (this.currentTrack()) {
        this.persistTrackAndQueue(this.currentTrack()!);
      }
    }
  }

  clearQueue(): void {
    const cur = this.currentTrack();
    if (cur) {
      this.queue.set([cur]);
      this.queueIndex.set(0);
      this.persistTrackAndQueue(cur);
    } else {
      this.stop();
      this.queue.set([]);
      this.queueIndex.set(-1);
    }
  }

  addToQueue(track: Track): void {
    const q = this.queue();
    if (!q.length) {
      this.playTrack(track, [track]);
      return;
    }
    this.queue.update((prev) => [...prev, track]);
    if (this.currentTrack()) {
      this.persistTrackAndQueue(this.currentTrack()!);
    }
  }

  playNextInQueue(track: Track): void {
    const q = [...this.queue()];
    if (!q.length) {
      this.playTrack(track, [track]);
      return;
    }
    const insertIdx = Math.max(0, this.queueIndex() + 1);
    q.splice(insertIdx, 0, track);
    this.queue.set(q);
    if (this.currentTrack()) {
      this.persistTrackAndQueue(this.currentTrack()!);
    }
  }

  toggleLiveQueue(): void {
    this.showLiveQueue.update((v) => !v);
    if (this.isBrowser) {
      try {
        localStorage.setItem(KEY_SHOW_LIVE_QUEUE, this.showLiveQueue().toString());
      } catch {}
    }
  }

  openLiveQueue(): void {
    this.showLiveQueue.set(true);
    if (this.isBrowser) {
      try {
        localStorage.setItem(KEY_SHOW_LIVE_QUEUE, 'true');
      } catch {}
    }
  }

  closeLiveQueue(): void {
    this.showLiveQueue.set(false);
    if (this.isBrowser) {
      try {
        localStorage.setItem(KEY_SHOW_LIVE_QUEUE, 'false');
      } catch {}
    }
  }

  togglePlay(): void {
    if (!this.audio || !this.currentTrack()) return;
    if (this.isPlaying()) {
      this.audio.pause();
    } else {
      void this.audio.play();
    }
  }

  pause(): void {
    if (!this.audio) return;
    this.audio.pause();
  }

  stop(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentTrack.set(null);
    if (this.isBrowser) {
      try {
        localStorage.removeItem(KEY_TRACK_ID);
        localStorage.removeItem(KEY_TIME);
      } catch {}
    }
  }

  next(): void {
    const q = this.queue();
    const curIdx = this.queueIndex();
    if (!q.length || curIdx < 0) return;

    let nextIndex = curIdx + 1;

    if (nextIndex >= q.length) {
      // Al terminar la lista de reproducción, vuelve automáticamente al principio
      nextIndex = 0;
    }

    this.playQueueIndex(nextIndex);
  }

  prev(): void {
    const q = this.queue();
    const curIdx = this.queueIndex();
    if (!q.length || curIdx < 0) return;

    if (this.currentTime() > 3) {
      this.seek(0);
      return;
    }

    let prevIndex = curIdx - 1;
    if (prevIndex < 0) prevIndex = q.length - 1;

    this.playQueueIndex(prevIndex);
  }

  seek(time: number): void {
    if (!this.audio) return;
    this.audio.currentTime = time;
    this.currentTime.set(time);
    this.persistCurrentPlaybackTime();
  }

  seekBy(seconds: number): void {
    const duration = this.duration();
    const target = Math.max(0, this.currentTime() + seconds);
    this.seek(duration > 0 ? Math.min(duration, target) : target);
  }

  setVolume(value: number): void {
    this.volume.set(value);
    if (this.audio) this.audio.volume = value;
    if (this.isBrowser) {
      try {
        localStorage.setItem(KEY_VOLUME, value.toString());
      } catch {}
    }
  }

  toggleShuffle(): void {
    this.shuffle.update((v) => !v);
    if (this.shuffle()) this.shuffleQueue();
    if (this.isBrowser) {
      try {
        localStorage.setItem(KEY_SHUFFLE, this.shuffle().toString());
      } catch {}
    }
  }

  toggleRepeat(): void {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const current = modes.indexOf(this.repeat());
    const next = modes[(current + 1) % modes.length];
    this.repeat.set(next);
    if (this.isBrowser) {
      try {
        localStorage.setItem(KEY_REPEAT, next);
      } catch {}
    }
  }

  private ensureAudio(): void {
    if (this.audio) return;

    this.audio = new Audio();
    this.audio.volume = this.volume();
    this.audio.preload = 'metadata';
    this.equalizer.attach(this.audio);

    this.audio.addEventListener('timeupdate', () => {
      if (!this.audio) return;
      const cur = this.audio.currentTime;
      this.currentTime.set(cur);

      const now = Date.now();
      if (now - this.lastTimeSave > 1200) {
        this.lastTimeSave = now;
        this.persistCurrentPlaybackTime();
      }
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.duration.set(this.audio!.duration || 0);
    });
    this.audio.addEventListener('durationchange', () => {
      this.duration.set(this.audio!.duration || 0);
    });
    this.audio.addEventListener('play', () => this.isPlaying.set(true));
    this.audio.addEventListener('pause', () => {
      this.isPlaying.set(false);
      this.persistCurrentPlaybackTime();
    });
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

  private persistCurrentPlaybackTime(): void {
    if (!this.isBrowser || !this.audio) return;
    try {
      const t = this.audio.currentTime;
      if (Number.isFinite(t) && t >= 0) {
        localStorage.setItem(KEY_TIME, t.toFixed(1));
      }
    } catch {}
  }

  private persistTrackAndQueue(track: Track): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(KEY_TRACK_ID, track.id);
      localStorage.setItem(KEY_QUEUE, JSON.stringify(this.queue().map((t) => t.id)));
      localStorage.setItem(KEY_QUEUE_INDEX, this.queueIndex().toString());
      localStorage.setItem(KEY_QUEUE_TITLE, this.queueTitle());
      localStorage.setItem(KEY_TIME, '0');
    } catch {}
  }

  private restoreSavedSettings(): void {
    if (!this.isBrowser) return;
    try {
      const savedVolume = localStorage.getItem(KEY_VOLUME);
      if (savedVolume !== null) {
        const v = parseFloat(savedVolume);
        if (!isNaN(v) && v >= 0 && v <= 1) {
          this.volume.set(v);
        }
      }

      const savedShuffle = localStorage.getItem(KEY_SHUFFLE);
      if (savedShuffle !== null) {
        this.shuffle.set(savedShuffle === 'true');
      }

      const savedRepeat = localStorage.getItem(KEY_REPEAT) as RepeatMode | null;
      if (savedRepeat && ['off', 'all', 'one'].includes(savedRepeat)) {
        this.repeat.set(savedRepeat);
      }

      const savedTitle = localStorage.getItem(KEY_QUEUE_TITLE);
      if (savedTitle) {
        this.queueTitle.set(savedTitle);
      }

      const savedLiveQueue = localStorage.getItem(KEY_SHOW_LIVE_QUEUE);
      if (savedLiveQueue !== null) {
        this.showLiveQueue.set(savedLiveQueue === 'true');
      }
    } catch {}
  }

  private async restorePlayerState(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      const trackId = localStorage.getItem(KEY_TRACK_ID);
      if (!trackId) return;

      const track = this.tracksService.getTrack(trackId);
      if (!track) return;

      const savedQueueRaw = localStorage.getItem(KEY_QUEUE);
      let restoredQueue: Track[] = [];
      if (savedQueueRaw) {
        try {
          const ids: string[] = JSON.parse(savedQueueRaw);
          restoredQueue = ids.map((id) => this.tracksService.getTrack(id)).filter((t): t is Track => !!t);
        } catch {}
      }
      if (!restoredQueue.length) {
        restoredQueue = [track];
      }

      const indexRaw = localStorage.getItem(KEY_QUEUE_INDEX);
      const index = indexRaw !== null ? parseInt(indexRaw, 10) : restoredQueue.findIndex((t) => t.id === track.id);

      const timeRaw = localStorage.getItem(KEY_TIME);
      const savedTime = timeRaw !== null ? parseFloat(timeRaw) : 0;

      this.currentTrack.set(track);
      this.queue.set(restoredQueue);
      this.queueIndex.set(index >= 0 ? index : 0);
      this.currentTime.set(savedTime);
      this.duration.set(track.duration || 0);

      this.ensureAudio();
      const src = await this.offline.resolveSourceUrl(track);
      if (this.currentTrack()?.id !== track.id) return;

      this.audio!.preload = 'metadata';
      this.audio!.src = src || this.qualityService.resolveTrackUrl(track, this.qualityService.quality());

      if (savedTime > 0) {
        const onLoaded = () => {
          if (this.audio && Math.abs(this.audio.currentTime - savedTime) > 0.5) {
            this.audio.currentTime = savedTime;
          }
        };
        this.audio!.addEventListener('loadedmetadata', onLoaded, { once: true });
      }
    } catch (e) {
      console.warn('Failed to restore player state', e);
    }
  }
}
