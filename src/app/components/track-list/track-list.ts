import { Component, input, inject, effect, untracked } from '@angular/core';
import type { Track } from '../../models/track';
import { AudioService } from '../../services/audio.service';
import { DurationService } from '../../services/duration.service';
import { DownloadButton } from '../download-button/download-button';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { AddToPlaylist } from '../add-to-playlist/add-to-playlist';
import { TracksService } from '../../services/tracks.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-track-list',
  imports: [DownloadButton, FavoriteButton, AddToPlaylist],
  templateUrl: './track-list.html',
})
export class TrackList {
  readonly tracks = input.required<Track[]>();
  readonly playlistId = input<string | null>(null);
  protected readonly audio = inject(AudioService);
  private readonly tracksService = inject(TracksService);
  private readonly toast = inject(ToastService);
  private readonly durations = inject(DurationService);

  constructor() {
    effect(() => {
      const tracks = this.tracks();
      untracked(() => this.durations.preload(tracks));
    });
  }

  protected durationOf(track: Track): number {
    return this.durations.durationOf(track.id);
  }

  protected playTrack(track: Track, index: number): void {
    this.audio.playTrack(track, this.tracks());
    this.audio.openNowPlaying();
  }

  protected removeFromPlaylist(track: Track, event: Event): void {
    event.stopPropagation();
    const playlistId = this.playlistId();
    const playlist = playlistId ? this.tracksService.getPlaylist(playlistId) : undefined;
    if (!playlistId || !playlist) return;

    if (this.tracksService.removeTrackFromPlaylist(playlistId, track.id)) {
      this.toast.show(`Quitada de "${playlist.name}"`, 'success', track.cover, 'Playlist actualizada');
    }
  }

  protected formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
