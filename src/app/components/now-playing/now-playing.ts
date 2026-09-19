import {
  Component,
  computed,
  effect,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { AmbientColorService } from '../../services/ambient-color.service';
import { LyricsService, type LyricLine } from '../../services/lyrics.service';
import { LyricsPanel } from '../lyrics-panel/lyrics-panel';
import { DownloadButton } from '../download-button/download-button';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { PipButton } from '../pip-button/pip-button';

@Component({
  selector: 'app-now-playing',
  imports: [LyricsPanel, DownloadButton, FavoriteButton, PipButton],
  templateUrl: './now-playing.html',
  encapsulation: ViewEncapsulation.None,
  styles: [`
    .np-bar {
      flex: 1 1 0;
      min-width: 0;
      height: 100%;
      border-radius: 3px 3px 0 0;
      background: linear-gradient(to top, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.08));
      transform-origin: bottom;
      transform: scaleY(var(--min, 0.1));
      animation: np-bar-beat var(--dur, 700ms) ease-in-out infinite alternate;
      animation-delay: var(--delay, 0ms);
      will-change: transform;
    }

    .np-bars-paused .np-bar {
      animation-play-state: paused;
    }

    @keyframes np-bar-beat {
      from { transform: scaleY(var(--min, 0.1)); }
      to   { transform: scaleY(var(--h, 0.6)); }
    }

    @media (prefers-reduced-motion: reduce) {
      .np-bar {
        animation: none;
        transform: scaleY(calc(var(--h, 0.6) * 0.6));
      }
    }
  `],
})
export class NowPlaying {
  protected readonly audio = inject(AudioService);
  private readonly ambient = inject(AmbientColorService);
  private readonly lyricsService = inject(LyricsService);

  protected readonly background = signal(
    'linear-gradient(180deg, #181818 0%, #101010 55%, #000000 100%)',
  );
  protected readonly glowColor = signal('#ffffff');

  protected readonly lyrics = signal<LyricLine[] | null>(null);
  protected readonly lyricsLoading = signal(false);
  protected readonly lyricsError = signal(false);

  private static readonly WAVE_COUNT = 42;

  // Barras rítmicas de fondo (solo se muestran en canciones sin letra)
  protected readonly bgBars = Array.from({ length: 80 }, (_, i) => {
    const r = (n: number) => {
      const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    const envelope = 0.7 + 0.3 * Math.sin((i / 79) * Math.PI); // un poco más altas al centro
    return {
      max: +(0.4 + r(1) * 0.6 * envelope).toFixed(2),
      min: +(0.08 + r(2) * 0.12).toFixed(2),
      dur: Math.round(380 + r(3) * 620), // 380–1000 ms
      delay: Math.round(r(4) * 1000),
    };
  });

  constructor() {
    effect(() => {
      const track = this.audio.currentTrack();
      if (track) {
        void this.ambient.getGradient(track.cover).then((g) => this.background.set(g));
        void this.ambient.getColor(track.cover).then((c) => this.glowColor.set(c));
      }
    });

    effect((onCleanup) => {
      const url = this.audio.currentTrack()?.lyricsUrl;

      this.lyrics.set(null);
      this.lyricsLoading.set(!!url);
      this.lyricsError.set(false);

      if (!url) return;

      let settled = false;
      onCleanup(() => {
        settled = true;
      });

      this.lyricsService
        .get(url)
        .then((lines) => {
          if (settled) return;
          this.lyrics.set(lines);
          this.lyricsLoading.set(false);
        })
        .catch(() => {
          if (settled) return;
          this.lyricsError.set(true);
          this.lyricsLoading.set(false);
        });
    });
  }

  protected readonly hasTrack = computed(() => !!this.audio.currentTrack());

  protected readonly currentTrackList = computed(() => {
    const t = this.audio.currentTrack();
    return t ? [t] : [];
  });

  protected readonly waves = computed(() => {
    const track = this.audio.currentTrack();
    return this.makeWaves(track?.id ?? 'default');
  });

  protected readonly played = computed(() => {
    const duration = this.audio.duration();
    const time = this.audio.currentTime();
    if (!duration || duration <= 0) return 0;
    return Math.round(Math.min(1, time / duration) * NowPlaying.WAVE_COUNT);
  });

  private makeWaves(seed: string): number[] {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
    }

    const rand = (): number => {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
      h = (h ^ (h >>> 16)) >>> 0;
      return h / 4294967296;
    };

    const bars: number[] = [];
    for (let i = 0; i < NowPlaying.WAVE_COUNT; i++) {
      const envelope = 0.45 + 0.55 * Math.sin((i / NowPlaying.WAVE_COUNT) * Math.PI);
      const value = 18 + Math.round(rand() * 82 * envelope);
      bars.push(value);
    }
    return bars;
  }

  protected readonly activeLyricIndex = computed(() => {
    const lines = this.lyrics();
    if (!lines?.length) return -1;

    const t = this.audio.currentTime();
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.time > t) break;
      index = line.end !== undefined && t >= line.end ? -1 : i;
    }
    return index;
  });

  protected formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  protected progressStyle(): string {
    const duration = this.audio.duration();
    if (!duration) return '0%';
    return `${Math.min(100, (this.audio.currentTime() / duration) * 100)}%`;
  }

  protected onSeek(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.audio.seek(Number(input.value));
  }

  protected onWavePointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    const wave = event.currentTarget as HTMLElement;

    this.seekFromEvent(event, wave);

    target.setPointerCapture?.(event.pointerId);

    const stop = (): void => {
      wave.removeEventListener('pointermove', move);
      wave.removeEventListener('pointerup', stop);
      wave.removeEventListener('pointercancel', stop);
    };

    const move = (e: PointerEvent): void => {
      this.seekFromEvent(e, wave);
    };

    wave.addEventListener('pointermove', move);
    wave.addEventListener('pointerup', stop);
    wave.addEventListener('pointercancel', stop);
  }

  private seekFromEvent(event: PointerEvent, wave: HTMLElement): void {
    const rect = wave.getBoundingClientRect();
    const duration = this.audio.duration();
    if (!duration || rect.width <= 0) return;

    const frac = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    this.audio.seek(frac * duration);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.audio.closeNowPlaying();
  }

  private swipeStartX = 0;
  private swipeStartY = 0;

  protected onCoverTouchStart(event: TouchEvent): void {
    this.swipeStartX = event.touches[0].clientX;
    this.swipeStartY = event.touches[0].clientY;
  }

  protected onCoverTouchEnd(event: TouchEvent): void {
    const dx = event.changedTouches[0].clientX - this.swipeStartX;
    const dy = event.changedTouches[0].clientY - this.swipeStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) {
        this.audio.next();
      } else {
        this.audio.prev();
      }
    }
  }

  protected onCoverWheel(event: WheelEvent): void {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 20) {
      if (event.deltaX > 0) {
        this.audio.next();
      } else {
        this.audio.prev();
      }
    }
  }
}