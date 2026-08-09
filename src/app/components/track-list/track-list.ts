import { Component, input, inject } from '@angular/core';
import type { Track } from '../../models/track';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-track-list',
  imports: [],
  templateUrl: './track-list.html',
})
export class TrackList {
  readonly tracks = input.required<Track[]>();
  protected readonly audio = inject(AudioService);

  protected playTrack(track: Track, index: number): void {
    this.audio.playTrack(track, this.tracks());
    this.audio.openNowPlaying();
  }

  protected formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
