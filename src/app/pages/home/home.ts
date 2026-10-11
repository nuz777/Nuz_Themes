import { Component, computed, inject } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { TracksService } from '../../services/tracks.service';
import { FavoritesService } from '../../services/favorites.service';
import { CoverCacheService } from '../../services/cover-cache.service';
import { PlaylistCard } from '../../components/playlist-card/playlist-card';
import { AddToPlaylist } from '../../components/add-to-playlist/add-to-playlist';
import { AudioQualityButton } from '../../components/audio-quality/audio-quality-button';
import type { Track } from '../../models/track';

@Component({
  selector: 'app-home',
  imports: [PlaylistCard, AddToPlaylist, AudioQualityButton],
  templateUrl: './home.html',
})
export class Home {
  protected readonly audio = inject(AudioService);
  protected readonly tracksService = inject(TracksService);
  protected readonly favorites = inject(FavoritesService);
  private readonly coverCache = inject(CoverCacheService);

  constructor() {
    // Pre-carga inmediata de carátulas destacadas y playlists visibles
    const featuredCovers = this.featuredTracks().map((t) => t.cover);
    const playlistCovers = this.tracksService.playlists().map((p) => p.cover);
    this.coverCache.preload([...featuredCovers, ...playlistCovers], 'high');

    // Pre-carga en segundo plano del resto de canciones para navegación instantánea
    const remaining = this.tracksService.tracks().map((t) => t.cover);
    this.coverCache.preload(remaining, 'idle');
  }

  protected readonly featuredTracks = computed(() => {
    const featuredIds = ['doom1', 'anim4', 'classic2', 'nuz1', 'ph1', 'sni4', 'nuz5'];
    const tracks = this.tracksService.tracks();
    return featuredIds
      .map((id) => tracks.find((track) => track.id === id))
      .filter((track): track is Track => !!track);
  });

  protected playTrack(track: Track): void {
    this.audio.playTrack(track, this.tracksService.tracks());
    this.audio.openNowPlaying();
  }
}
