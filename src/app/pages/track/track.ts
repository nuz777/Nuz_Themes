import { Component, inject, input, computed } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { TracksService } from '../../services/tracks.service';
import { TrackList } from '../../components/track-list/track-list';

@Component({
  selector: 'app-track-page',
  imports: [TrackList],
  templateUrl: './track.html',
})
export class TrackPage {
  readonly id = input.required<string>();
  protected readonly tracksService = inject(TracksService);
  protected readonly audio = inject(AudioService);

  protected readonly track = computed(() => this.tracksService.getTrack(this.id()));

  protected readonly tracks = computed(() => {
    const current = this.track();
    const queue = this.audio.queue();
    if (current && queue.some((t) => t.id === current.id)) return queue;
    return this.tracksService.tracks();
  });

  protected playThis(): void {
    const current = this.track();
    const list = this.tracks();
    if (!current) return;
    const index = list.findIndex((t) => t.id === current.id);
    this.audio.playQueue(list, index < 0 ? 0 : index);
  }

  protected formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
