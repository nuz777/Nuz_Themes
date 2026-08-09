import { Component, inject, input, computed } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { TracksService } from '../../services/tracks.service';
import { TrackList } from '../../components/track-list/track-list';

@Component({
  selector: 'app-playlist-page',
  imports: [TrackList],
  templateUrl: './playlist.html',
})
export class PlaylistPage {
  readonly id = input.required<string>();
  protected readonly tracksService = inject(TracksService);
  protected readonly audio = inject(AudioService);

  protected readonly playlist = computed(() => this.tracksService.getPlaylist(this.id()));
  protected readonly tracks = computed(() => this.tracksService.getPlaylistTracks(this.id()));

  protected playAll(): void {
    this.audio.playQueue(this.tracks());
  }
}
