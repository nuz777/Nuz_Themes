import { Component, inject, signal, computed } from '@angular/core';
import { FavoritesService } from '../../services/favorites.service';
import { TracksService } from '../../services/tracks.service';
import { AudioService } from '../../services/audio.service';
import type { Track } from '../../models/track';

@Component({
  selector: 'app-favorites-fab',
  imports: [],
  templateUrl: './favorites-fab.html',
})
export class FavoritesFAB {
  protected readonly favorites = inject(FavoritesService);
  private readonly tracksService = inject(TracksService);
  protected readonly audio = inject(AudioService);
  protected readonly open = signal(false);

  protected readonly tracks = computed(() => {
    const ids = [...this.favorites.ids()];
    return ids
      .map((id) => this.tracksService.getTrack(id))
      .filter((t): t is Track => t != null);
  });

  protected toggle(): void {
    this.open.set(!this.open());
  }

  protected close(): void {
    this.open.set(false);
  }

  protected playTrack(track: Track): void {
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
