import {
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { AmbientColorService } from '../../services/ambient-color.service';
import { LyricsService, type LyricLine } from '../../services/lyrics.service';
import { LyricsPanel } from '../lyrics-panel/lyrics-panel';

@Component({
  selector: 'app-now-playing',
  imports: [LyricsPanel],
  templateUrl: './now-playing.html',
})
export class NowPlaying {
  protected readonly audio = inject(AudioService);
  private readonly ambient = inject(AmbientColorService);
  private readonly lyricsService = inject(LyricsService);

  protected readonly background = signal(
    'linear-gradient(180deg, #181818 0%, #101010 55%, #000000 100%)',
  );

  protected readonly lyrics = signal<LyricLine[] | null>(null);
  protected readonly lyricsLoading = signal(false);
  protected readonly lyricsError = signal(false);

  constructor() {
    effect(() => {
      const track = this.audio.currentTrack();
      if (track) {
        void this.ambient.getGradient(track.cover).then((g) => this.background.set(g));
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

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.audio.closeNowPlaying();
  }
}
