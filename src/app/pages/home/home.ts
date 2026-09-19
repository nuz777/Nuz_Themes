import { Component, computed, inject } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { TracksService } from '../../services/tracks.service';
import { PlaylistCard } from '../../components/playlist-card/playlist-card';
import type { Track } from '../../models/track';

@Component({
  selector: 'app-home',
  imports: [PlaylistCard],
  templateUrl: './home.html',
})
export class Home {
  private readonly audio = inject(AudioService);
  protected readonly tracksService = inject(TracksService);

  protected readonly featuredTracks = computed(() => {
    const featuredIds = ['doom1', 'anim4', 'classic2', 'nuz1', 'ph1', 'nuz5'];
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
