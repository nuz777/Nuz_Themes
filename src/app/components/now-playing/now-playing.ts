import {
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { AmbientColorService } from '../../services/ambient-color.service';

@Component({
  selector: 'app-now-playing',
  templateUrl: './now-playing.html',
})
export class NowPlaying {
  protected readonly audio = inject(AudioService);
  private readonly ambient = inject(AmbientColorService);

  protected readonly background = signal(
    'linear-gradient(180deg, #181818 0%, #101010 55%, #000000 100%)',
  );

  constructor() {
    effect(() => {
      const track = this.audio.currentTrack();
      if (track) {
        void this.ambient.getGradient(track.cover).then((g) => this.background.set(g));
      }
    });
  }

  protected readonly hasTrack = computed(() => !!this.audio.currentTrack());

  protected readonly currentTrackList = computed(() => {
    const t = this.audio.currentTrack();
    return t ? [t] : [];
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
